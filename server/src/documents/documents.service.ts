import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  ParticipantRole,
  ParticipantStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SendDocumentDto } from './dto/send-document.dto';
import { sanitizeRichHtml } from '../common/sanitize';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import {
  ApproveDocumentDto,
  ApproveOverdueDocumentDto,
  CommentDto,
  ExtendDeadlineDto,
  ForwardDto,
  RejectDto,
} from './dto/document-action.dto';
import { CompleteTargetDto, CreateResolutionDto } from './dto/resolution.dto';
import { SignDocumentDto } from './dto/sign.dto';
import { buildDocumentPdf } from './documents.pdf';
import {
  AUTO_CHAIN_LOGINS,
  buildIchkiTokens,
  renderIchki,
  fillCustomPlaceholders,
} from './template-fill';
import { ConfigService } from '@nestjs/config';
import { QrApprovalService } from './qr-approval.service';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

const FORBIDDEN_EXTS = ['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.scr', '.js', '.msi'];

const MAX_CHAIN_DEPTH = 10;

function countBy<T>(arr: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) {
    const k = key(x);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function categoryFromType(type: DocumentType): string {
  switch (type) {
    case 'internal':
      return 'INT';
    case 'incoming':
      return 'IN';
    case 'outgoing':
      return 'OUT';
  }
}

// Bo'limning eng yuqori (rank kichik) lavozimga ega xodimini topadi
async function findDeptHead(
  prisma: PrismaService,
  deptId: string,
  excludeUserId?: string,
): Promise<string | null> {
  const candidates = await prisma.user.findMany({
    where: {
      departmentId: deptId,
      isActive: true,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true, position: { select: { rank: true } } },
    orderBy: [{ position: { rank: 'asc' } }],
  });
  if (candidates.length === 0) return null;
  // Eng kichik rank — eng yuqori lavozim
  return candidates[0].id;
}

const FULL_INCLUDE = {
  createdBy: {
    select: { id: true, fullName: true, login: true, avatarPath: true, position: { select: { name: true, rank: true } }, department: { select: { name: true } } },
  },
  numberDept: { select: { id: true, name: true, code: true } },
  targetDept: { select: { id: true, name: true, code: true } },
  senderOrg: { select: { id: true, name: true, inn: true, address: true, phone: true, note: true } },
  journal: { select: { id: true, name: true, prefix: true, kind: true } },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      uploadedBy: { select: { id: true, fullName: true, login: true, avatarPath: true } },
    },
  },
  currentHolder: {
    select: { id: true, fullName: true, login: true, avatarPath: true },
  },
  participants: {
    orderBy: { order: 'asc' as const },
    include: {
      user: {
        select: { id: true, fullName: true, login: true, avatarPath: true, position: { select: { name: true, rank: true } } },
      },
    },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: { id: true, fullName: true, login: true, avatarPath: true } },
    },
  },
  audit: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      actor: { select: { id: true, fullName: true, login: true, avatarPath: true } },
    },
  },
  resolutions: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: { id: true, fullName: true, login: true, avatarPath: true } },
      targets: {
        include: {
          user: { select: { id: true, fullName: true, login: true, avatarPath: true } },
        },
      },
    },
  },
  signatures: {
    orderBy: { signedAt: 'asc' as const },
    select: {
      id: true,
      documentId: true,
      signerId: true,
      certSerial: true,
      certSubject: true,
      certIssuer: true,
      certValidFrom: true,
      certValidTo: true,
      signatureHash: true,
      signedAt: true,
      verified: true,
      verifiedAt: true,
      verifyError: true,
      signer: { select: { id: true, fullName: true, login: true, avatarPath: true } },
    },
  },
};

@Injectable()
export class DocumentsService {
  private readonly attDir: string;
  private readonly attMaxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messages: MessagesService,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly gateway: MessagesGateway,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly settings: SettingsService,
    @Inject(forwardRef(() => QrApprovalService))
    private readonly qrApproval: QrApprovalService,
  ) {
    this.attDir =
      this.config.get<string>('ATTACHMENTS_DIR') || 'C:\\D\\pochta\\storage\\attachments';
    this.attMaxBytes =
      parseInt(this.config.get('MAX_FILE_SIZE_MB', '50'), 10) * 1024 * 1024;
  }

  // ── YARATISH / TAHRIRLASH ──────────────────────────────────────────────

  async create(userId: string, dto: CreateDocumentDto) {
    const year = new Date().getFullYear();
    const category = categoryFromType(dto.type);
    // Qoralama uchun raqam vaqtinchalik — yuborilganda haqiqiy raqamga almashtiriladi
    const draftNumber = `DRAFT-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    if (dto.type === 'outgoing') {
      const me = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { canSignExternal: true, canSendExternal: true },
      });
      if (!me?.canSignExternal && !me?.canSendExternal) {
        throw new ForbiddenException(
          'Tashqi hujjat yaratish uchun maxsus huquq talab qilinadi',
        );
      }
    }

    // Ro'yxatga olish jurnali har doim yaratuvchining bo'limi bo'ladi —
    // hech kim (admin ham) uni o'zgartira olmaydi.
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const numberDeptId = creator?.departmentId ?? null;

    // Ijro muddati faqat xodim qo'lda kiritganda o'rnatiladi (avtomatik 3/5/7 kun yo'q).
    const deadline: Date | null = dto.deadline ? new Date(dto.deadline) : null;

    const doc = await this.prisma.$transaction(async (tx) => {
      const docUid = await this.allocateDocUid(tx);
      const d = await tx.document.create({
        data: {
          number: draftNumber,
          docUid,
          numberCategory: category,
          publicToken: randomBytes(16).toString('hex'), // 32 belgili ommaviy QR token
          year,
          type: dto.type,
          internalKind:
            dto.type === 'internal' ? (dto.internalKind ?? 'service_letter') : null,
          subject: dto.subject,
          shortInfo: dto.shortInfo,
          body: sanitizeRichHtml(dto.body ?? ''),
          status: 'draft',
          isExternal: dto.type === 'outgoing',
          externalRecipient: dto.type === 'outgoing' ? dto.externalRecipient : null,
          senderOrgId: dto.type !== 'internal' ? (dto.senderOrgId ?? null) : null,
          journalId: dto.journalId ?? null,
          deadline,
          createdById: userId,
          currentHolderId: userId,
          numberDeptId,
          targetDeptId: dto.targetDeptId ?? null,
          templateId: dto.templateId ?? null,
          issueGroup: dto.issueGroup ?? null,
          issues: dto.issues ?? null,
          tags: dto.tags ?? [],
          xdfuDsp: dto.xdfuDsp ?? false,
          qrLess: dto.qrLess ?? false,
          deliverAsAppeal: dto.type === 'outgoing' ? (dto.deliverAsAppeal ?? false) : false,
          replyRequired: dto.type === 'outgoing' ? (dto.replyRequired ?? false) : false,
          formApproversAfterSign:
            dto.type === 'internal' ? (dto.formApproversAfterSign ?? false) : false,
          // Kiruvchi korrespondensiyani ro'yxatga olish maydonlari
          deliveryType: dto.deliveryType ?? null,
          incomingDocKind: dto.incomingDocKind ?? null,
          docName: dto.docName ?? null,
          higherOrder: dto.higherOrder ?? null,
          predmet: dto.predmet ?? null,
          incomingNumber: dto.incomingNumber ?? null,
          outgoingNumber: dto.outgoingNumber ?? null,
          incomingDate: dto.incomingDate ? new Date(dto.incomingDate) : null,
          outgoingDate: dto.outgoingDate ? new Date(dto.outgoingDate) : null,
          signatory: dto.signatory ?? null,
          executor: dto.executor ?? null,
          contactPhone: dto.contactPhone ?? null,
          directRouting: dto.directRouting ?? false,
          urgent: dto.urgent ?? false,
        },
      });
      await tx.documentParticipant.create({
        data: {
          documentId: d.id,
          userId,
          role: ParticipantRole.creator,
          order: 0,
          status: ParticipantStatus.approved,
          actedAt: new Date(),
        },
      });
      if (dto.approverIds && dto.approverIds.length > 0) {
        await this.saveApproverChain(tx, d.id, dto.approverIds, userId);
      }
      await tx.documentAuditLog.create({
        data: { documentId: d.id, actorId: userId, action: 'created' },
      });
      return d;
    });

    return this.findOne(userId, doc.id);
  }

  async update(userId: string, id: string, dto: UpdateDocumentDto) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    if (doc.createdById !== userId) {
      throw new ForbiddenException('Hujjatni faqat yaratuvchi tahrirlay oladi');
    }
    if (doc.status !== 'draft') {
      throw new BadRequestException('Faqat qoralama tahrirlanadi');
    }

    const data: Prisma.DocumentUpdateInput = {};
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.shortInfo !== undefined) data.shortInfo = dto.shortInfo;
    if (dto.body !== undefined) data.body = sanitizeRichHtml(dto.body);
    if (dto.externalRecipient !== undefined && doc.type === 'outgoing') {
      data.externalRecipient = dto.externalRecipient;
    }
    if (dto.senderOrgId !== undefined) {
      const effTypeForSender = dto.type ?? doc.type;
      data.senderOrg =
        effTypeForSender !== 'internal' && dto.senderOrgId
          ? { connect: { id: dto.senderOrgId } }
          : { disconnect: true };
    }
    if (dto.journalId !== undefined) {
      data.journal = dto.journalId
        ? { connect: { id: dto.journalId } }
        : { disconnect: true };
    }
    if (dto.type !== undefined && dto.type !== doc.type) {
      // Qoralama bo'lgani uchun tipni o'zgartirishga ruxsat berishimiz mumkin
      data.type = dto.type;
      data.numberCategory = categoryFromType(dto.type);
      data.isExternal = dto.type === 'outgoing';
    }
    if (dto.deadline !== undefined) {
      data.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }
    // Ro'yxatga olish jurnali (numberDept) — hech kim o'zgartira olmaydi,
    // har doim yaratuvchining bo'limi qat'iy qoladi.
    if (dto.targetDeptId !== undefined) {
      data.targetDept = dto.targetDeptId
        ? { connect: { id: dto.targetDeptId } }
        : { disconnect: true };
    }
    if (dto.templateId !== undefined) {
      data.template = dto.templateId
        ? { connect: { id: dto.templateId } }
        : { disconnect: true };
    }
    if (dto.issueGroup !== undefined) data.issueGroup = dto.issueGroup || null;
    if (dto.issues !== undefined) data.issues = dto.issues || null;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.xdfuDsp !== undefined) data.xdfuDsp = dto.xdfuDsp;
    if (dto.qrLess !== undefined) data.qrLess = dto.qrLess;
    // Faqat mos tur uchun saqlaymiz
    const effType = dto.type ?? doc.type;
    if (dto.deliverAsAppeal !== undefined) {
      data.deliverAsAppeal = effType === 'outgoing' ? dto.deliverAsAppeal : false;
    }
    if (dto.replyRequired !== undefined) {
      data.replyRequired = effType === 'outgoing' ? dto.replyRequired : false;
    }
    if (dto.formApproversAfterSign !== undefined) {
      data.formApproversAfterSign =
        effType === 'internal' ? dto.formApproversAfterSign : false;
    }
    // Kiruvchi korrespondensiyani ro'yxatga olish maydonlari
    if (dto.deliveryType !== undefined) data.deliveryType = dto.deliveryType || null;
    if (dto.incomingDocKind !== undefined) data.incomingDocKind = dto.incomingDocKind || null;
    if (dto.docName !== undefined) data.docName = dto.docName || null;
    if (dto.higherOrder !== undefined) data.higherOrder = dto.higherOrder || null;
    if (dto.predmet !== undefined) data.predmet = dto.predmet || null;
    if (dto.incomingNumber !== undefined) data.incomingNumber = dto.incomingNumber || null;
    if (dto.outgoingNumber !== undefined) data.outgoingNumber = dto.outgoingNumber || null;
    if (dto.incomingDate !== undefined) {
      data.incomingDate = dto.incomingDate ? new Date(dto.incomingDate) : null;
    }
    if (dto.outgoingDate !== undefined) {
      data.outgoingDate = dto.outgoingDate ? new Date(dto.outgoingDate) : null;
    }
    if (dto.signatory !== undefined) data.signatory = dto.signatory || null;
    if (dto.executor !== undefined) data.executor = dto.executor || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone || null;
    if (dto.directRouting !== undefined) data.directRouting = dto.directRouting;
    if (dto.urgent !== undefined) data.urgent = dto.urgent;
    // Ichki hujjat turi (xizmat xati / buyruq)
    if (effType === 'internal') {
      if (dto.internalKind !== undefined) {
        data.internalKind = dto.internalKind;
      } else if (dto.type !== undefined && doc.type !== 'internal') {
        // internal'ga o'zgardi, lekin kind kelmadi — default xizmat xati
        data.internalKind = 'service_letter';
      }
    } else if (dto.type !== undefined) {
      data.internalKind = null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id }, data });
      if (dto.approverIds !== undefined) {
        await this.saveApproverChain(tx, id, dto.approverIds, userId);
      }
    });
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    if (doc.createdById !== userId) {
      throw new ForbiddenException("Faqat yaratuvchi o'chira oladi");
    }
    if (doc.status !== 'draft' && doc.status !== 'rejected') {
      throw new BadRequestException(
        "Faqat qoralama yoki rad etilgan hujjatlarni o'chirish mumkin",
      );
    }
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }

  // Admin — bir nechta hujjatni ommaviy o'chirish (holatidan qat'i nazar)
  async bulkRemove(ids: string[]) {
    const clean = [...new Set(ids)].filter((x) => typeof x === 'string' && x);
    if (clean.length === 0) return { ok: true, deleted: 0 };
    const res = await this.prisma.document.deleteMany({
      where: { id: { in: clean } },
    });
    return { ok: true, deleted: res.count };
  }

  // ── YUBORISH ──────────────────────────────────────────────────────────

  async sendForApproval(userId: string, id: string, dto?: SendDocumentDto) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { participants: true, numberDept: true, targetDept: true },
    });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    if (doc.createdById !== userId) {
      throw new ForbiddenException('Faqat yaratuvchi hujjatni yubora oladi');
    }
    if (doc.status !== 'draft') {
      throw new BadRequestException('Faqat qoralamani yuborish mumkin');
    }
    if (!doc.numberDeptId || !doc.numberDept?.code) {
      throw new BadRequestException(
        "Yaratuvchi bo'limi tanlanmagan yoki bo'lim kodi yo'q. Bo'lim sozlamalarini tekshiring",
      );
    }

    // "Buyruq" turidagi ichki hujjatda tasdiqlovchilar qo'lda tanlanadi —
    // avtomatik ichki zanjir (aziza → ... → mirzaxid) ishlamaydi.
    const isOrder = doc.type === 'internal' && doc.internalKind === 'order';

    // Shablon tanlanmagan bo'lsa (va "buyruq" bo'lmasa) — hujjat "ichki" shabloniga
    // avtomat solinadi va qat'iy zanjir (aziza → raxmatjon → abduxalil → mirzaxid) qo'yiladi.
    let autoIchkiTemplateId: string | null = null;
    let autoIchkiChain: string[] | null = null;
    if (!doc.templateId && !isOrder) {
      const tpl = await this.prisma.documentTemplate.findFirst({
        where: { name: { equals: 'ichki', mode: 'insensitive' } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!tpl) {
        throw new BadRequestException(
          '"ichki" nomli shablon topilmadi. Uni Shablonlar bo\'limida yarating',
        );
      }
      const chainUsers = await this.prisma.user.findMany({
        where: { login: { in: [...AUTO_CHAIN_LOGINS] } },
        select: { id: true, login: true, isActive: true },
      });
      const byLogin = new Map(chainUsers.map((u) => [u.login, u] as const));
      const resolved: string[] = [];
      for (const login of AUTO_CHAIN_LOGINS) {
        const u = byLogin.get(login);
        if (!u) {
          throw new BadRequestException(
            `Tasdiqlovchi topilmadi: "${login}". Foydalanuvchini yarating`,
          );
        }
        if (!u.isActive) {
          throw new BadRequestException(`Tasdiqlovchi faol emas: "${login}"`);
        }
        resolved.push(u.id);
      }
      autoIchkiTemplateId = tpl.id;
      autoIchkiChain = resolved;
    }

    // Yuborish paytida tanlangan tasdiqlovchilar ustuvor. Bo'lmasa — qoralamaga
    // biriktirilgan zanjir; u ham bo'lmasa eski mantiq: o'z + maqsadli bo'lim raxbari.
    const selectedApprovers = (dto?.approverIds ?? []).filter(
      (uid, i, arr) => uid !== userId && arr.indexOf(uid) === i,
    );
    const persistedApprovers = doc.participants
      .filter((p) => p.role === ParticipantRole.approver)
      .sort((a, b) => a.order - b.order)
      .map((p) => p.userId);

    let chain: string[];
    if (autoIchkiChain) {
      chain = autoIchkiChain;
    } else if (selectedApprovers.length > 0) {
      chain = selectedApprovers;
    } else if (persistedApprovers.length > 0) {
      chain = persistedApprovers;
    } else {
      // Avtomatik zanjir — bo'lim rahbarlari orqali quriladi. Faqat shu holatda
      // yuboriladigan bo'lim ko'rsatilishi shart (rahbarni topish uchun).
      if (!doc.targetDeptId) {
        throw new BadRequestException("Hujjat yuboriladigan bo'lim tanlanmagan");
      }
      chain = [];
      const ownHead = await findDeptHead(this.prisma, doc.numberDeptId, userId);
      if (ownHead) chain.push(ownHead);
      const targetHead = await findDeptHead(this.prisma, doc.targetDeptId, userId);
      if (targetHead && !chain.includes(targetHead)) chain.push(targetHead);
    }

    if (chain.length === 0) {
      throw new BadRequestException(
        "Tasdiqlash zanjirini qurib bo'lmadi: bo'lim raxbarlari aniqlanmadi yoki zanjir tanlanmagan",
      );
    }

    // Raqam berish qoidasi:
    //  - kiruvchi (incoming) → eski shart: yuborishdayoq raqam beriladi;
    //  - ichki/chiquvchi → raqam faqat tasdiqlanib bo'lganda (done) beriladi,
    //    tasdiqlash bosqichida qoralama raqam saqlanib turadi.
    const number =
      doc.type === 'incoming'
        ? await this.allocateNumber(doc.numberDept.code)
        : doc.number;

    // Birinchi tasdiqlovchi — to'g'ridan-to'g'ri rahbar
    const firstApproverId = chain[0];

    await this.prisma.$transaction(async (tx) => {
      // Avvalgi (creator) ishtirokchini saqlaymiz, yangilarini qo'shamiz
      let order = 1;
      for (const uid of chain) {
        const currentOrder = order++;
        await tx.documentParticipant.upsert({
          where: {
            documentId_userId_role: {
              documentId: id,
              userId: uid,
              role: ParticipantRole.approver,
            },
          },
          create: {
            documentId: id,
            userId: uid,
            role: ParticipantRole.approver,
            order: currentOrder,
            status: ParticipantStatus.pending,
          },
          update: { order: currentOrder },
        });
      }
      await tx.document.update({
        where: { id },
        data: {
          number,
          status: DocumentStatus.in_review,
          currentHolderId: firstApproverId,
          signatureChainPosition: 1,
          ...(autoIchkiTemplateId
            ? { templateId: autoIchkiTemplateId, autoFilled: true }
            : {}),
        },
      });
      await tx.documentAuditLog.create({
        data: {
          documentId: id,
          actorId: userId,
          action: 'sent',
          payload: { chain, number } as any,
        },
      });
    });

    // Birinchi rahbarga Pochta orqali xabar yuboramiz
    await this.notifyApprover(firstApproverId, userId, id, number, doc.subject);

    return this.findOne(userId, id);
  }

  // ── HARAKATLAR ────────────────────────────────────────────────────────

  async approve(userId: string, id: string, dto: ApproveDocumentDto) {
    await this.users.verifyApprovalPin(userId, dto.pin);
    const doc = await this.requireActiveApprover(userId, id);

    // Joriy tasdiqlovchining zanjirdagi pozitsiyasini topamiz
    const me = await this.prisma.documentParticipant.findFirst({
      where: {
        documentId: id,
        userId,
        role: ParticipantRole.approver,
        status: ParticipantStatus.pending,
      },
    });
    if (!me) {
      throw new BadRequestException("Sizga biriktirilgan tasdiqlash topilmadi");
    }

    // Qo'shimcha tasdiqlovchilarni tozalaymiz va validatsiya qilamiz
    const addIds = await this.validateAdditionalApprovers(
      id,
      dto.addApproverIds,
      userId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.documentParticipant.updateMany({
        where: {
          documentId: id,
          userId,
          role: ParticipantRole.approver,
          status: ParticipantStatus.pending,
        },
        data: {
          status: ParticipantStatus.approved,
          actedAt: new Date(),
          approvalNotes: dto.approvalNotes || null,
          approvalMethod: dto.approvalMethod || 'manual',
        },
      });

      if (addIds.length > 0) {
        // Joriy tasdiqlovchidan keyingilarni siljitamiz va yangilarni o'rtaga qistiramiz
        await tx.documentParticipant.updateMany({
          where: {
            documentId: id,
            order: { gt: me.order },
          },
          data: { order: { increment: addIds.length } },
        });
        let nextOrder = me.order + 1;
        for (const uid of addIds) {
          await tx.documentParticipant.upsert({
            where: {
              documentId_userId_role: {
                documentId: id,
                userId: uid,
                role: ParticipantRole.approver,
              },
            },
            create: {
              documentId: id,
              userId: uid,
              role: ParticipantRole.approver,
              order: nextOrder++,
              status: ParticipantStatus.pending,
            },
            update: {
              order: nextOrder++,
              status: ParticipantStatus.pending,
              actedAt: null,
              rejectReason: null,
            },
          });
        }
      }

      await tx.documentAuditLog.create({
        data: {
          documentId: id,
          actorId: userId,
          action: 'approved',
          payload: addIds.length > 0 ? ({ addApproverIds: addIds } as any) : undefined,
        },
      });
    });

    // Keyingi tasdiqlovchini qidiramiz
    const next = await this.prisma.documentParticipant.findFirst({
      where: {
        documentId: id,
        role: ParticipantRole.approver,
        status: ParticipantStatus.pending,
      },
      orderBy: { order: 'asc' },
    });

    if (next) {
      await this.prisma.document.update({
        where: { id },
        data: {
          currentHolderId: next.userId,
          signatureChainPosition: { increment: 1 },
        },
      });
      await this.notifyApprover(
        next.userId,
        userId,
        id,
        doc.number,
        doc.subject,
      );
    } else {
      // Zanjir tugadi — bajarildi va chop bo'lish uchun tayyorlanadi
      let finalNumber = doc.number;
      await this.prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id },
          data: {
            status: DocumentStatus.done,
            currentHolderId: null,
            closedAt: new Date(),
            isSigned: true,
            isPrintable: true, // Yakunlangan hujjat chop bo'lishi mumkin
          },
        });
        // Yakuniy tartib raqamini AYNAN shu yerda beramiz (tasdiqlangach).
        finalNumber = (await this.finalizeNumber(tx, id)) ?? finalNumber;
        await tx.documentAuditLog.create({
          data: { documentId: id, actorId: userId, action: 'completed' },
        });
      });
      // Yaratuvchini xabardor qilamiz
      await this.notifyCreator(doc.createdById, userId, id, finalNumber, doc.subject, 'completed');
      // Ichki "xizmat xati" (avtomatik zanjir) tugagach — barcha kanselyariya
      // xodimlariga ijrochi biriktirish uchun xabar yuboriladi.
      const isServiceLetter =
        doc.type === 'internal' && (doc.internalKind ?? 'service_letter') === 'service_letter';
      if (isServiceLetter && doc.autoFilled) {
        await this.notifyChancelleryForResolution(userId, id, doc.number, doc.subject);
      }
    }

    return this.findOne(userId, id);
  }

  async reject(userId: string, id: string, dto: RejectDto) {
    await this.users.verifyApprovalPin(userId, dto.pin);
    const doc = await this.requireActiveApprover(userId, id);

    // Rad etish sababi + qo'shimcha izohlar
    const fullReason = dto.notes ? `${dto.reason}\n---\n${dto.notes}` : dto.reason;

    await this.prisma.$transaction(async (tx) => {
      // Tasdiqlovchini rad etilgan deb belgilaymiz
      await tx.documentParticipant.updateMany({
        where: {
          documentId: id,
          userId,
          role: ParticipantRole.approver,
          status: ParticipantStatus.pending,
        },
        data: {
          status: ParticipantStatus.rejected,
          actedAt: new Date(),
          rejectReason: fullReason,
        },
      });

      // Hujjat statusini rad etilgan qilamiz — keyingi qadamga o'tmaydi
      await tx.document.update({
        where: { id },
        data: {
          status: DocumentStatus.rejected,
          currentHolderId: doc.createdById, // Yaratuvchiga qaytarish
          isPrintable: false, // Rad etilgan hujjat chop bo'lmaydi
        },
      });

      // Komment qo'shamiz
      await tx.documentComment.create({
        data: {
          documentId: id,
          authorId: userId,
          text: `[Rad etildi]\n${fullReason}`,
        },
      });

      // Audit logga yozamiz
      await tx.documentAuditLog.create({
        data: {
          documentId: id,
          actorId: userId,
          action: 'rejected',
          payload: { reason: dto.reason, notes: dto.notes } as any,
        },
      });
    });

    await this.notifyCreator(doc.createdById, userId, id, doc.number, doc.subject, 'rejected', dto.reason);

    return this.findOne(userId, id);
  }

  async addComment(userId: string, id: string, dto: CommentDto) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    await this.requireAccess(userId, doc);

    await this.prisma.documentComment.create({
      data: { documentId: id, authorId: userId, text: dto.text },
    });
    await this.prisma.documentAuditLog.create({
      data: { documentId: id, actorId: userId, action: 'commented' },
    });

    return this.findOne(userId, id);
  }

  async forward(userId: string, id: string, dto: ForwardDto) {
    // Forward — javobgarlikni o'tkazish; PIN talab qilinadi (tasdiqlashga teng harakat)
    await this.users.verifyApprovalPin(userId, dto.pin);
    const doc = await this.requireActiveApprover(userId, id);
    if (dto.toUserId === userId) {
      throw new BadRequestException("O'zingizga yo'naltirib bo'lmaydi");
    }
    const target = await this.prisma.user.findUnique({
      where: { id: dto.toUserId },
      select: { id: true, isActive: true },
    });
    if (!target || !target.isActive) {
      throw new BadRequestException('Belgilangan foydalanuvchi topilmadi yoki bloklangan');
    }

    // Joriy tasdiqlovchining pozitsiyasi
    const me = await this.prisma.documentParticipant.findFirst({
      where: {
        documentId: id,
        userId,
        role: ParticipantRole.approver,
        status: ParticipantStatus.pending,
      },
    });
    if (!me) throw new BadRequestException("Sizga biriktirilgan tasdiqlash yo'q");

    // Qo'shimcha tasdiqlovchilarni tekshiramiz (yangi javobgar + qo'shimchalar dublikat bo'lmasin)
    const extraIds = await this.validateAdditionalApprovers(
      id,
      dto.additionalApproverIds,
      userId,
      [dto.toUserId],
    );

    // Joriy tasdiqlovchini ALMASHTIRAMIZ — javobgarlik o'tkaziladi.
    // Yangi tartib: [..., toUserId (me.order), ...extraIds (me.order+1..), ...keyingilar]
    // Eski "me" yozuvini "forwarded" sifatida belgilab tarixga qoldiramiz, lekin tasdiqlash zanjiridan chiqarib yuboramiz.
    const totalInsert = 1 + extraIds.length; // toUserId + extras
    // Eski "me" yozuvi o'rniga 1 ta yangi yozuv keladi → shift = totalInsert - 1

    await this.prisma.$transaction(async (tx) => {
      // 1) Joriy tasdiqlovchini zanjirdan chiqaramiz — lekin o'chirmaymiz.
      //    Observer rolga o'tkazamiz: ko'rish huquqi saqlanadi, ammo tasdiqlovchi emas.
      //    Shu orqali forward qilgan foydalanuvchi hujjatga kirish huquqini yo'qotmaydi.
      await tx.documentParticipant.update({
        where: { id: me.id },
        data: {
          role: ParticipantRole.observer,
          status: ParticipantStatus.done,
          actedAt: new Date(),
        },
      });

      // 2) me.order'dan keyingilarni siljitamiz
      const shift = totalInsert - 1;
      if (shift > 0) {
        await tx.documentParticipant.updateMany({
          where: { documentId: id, order: { gt: me.order } },
          data: { order: { increment: shift } },
        });
      }

      // 3) toUserId'ni me.order o'rniga qo'yamiz
      await tx.documentParticipant.upsert({
        where: {
          documentId_userId_role: {
            documentId: id,
            userId: dto.toUserId,
            role: ParticipantRole.approver,
          },
        },
        create: {
          documentId: id,
          userId: dto.toUserId,
          role: ParticipantRole.approver,
          order: me.order,
          status: ParticipantStatus.pending,
        },
        update: {
          order: me.order,
          status: ParticipantStatus.pending,
          actedAt: null,
          rejectReason: null,
        },
      });

      // 4) Qo'shimcha tasdiqlovchilarni toUserId'dan keyin joylaymiz
      let nextOrder = me.order + 1;
      for (const uid of extraIds) {
        await tx.documentParticipant.upsert({
          where: {
            documentId_userId_role: {
              documentId: id,
              userId: uid,
              role: ParticipantRole.approver,
            },
          },
          create: {
            documentId: id,
            userId: uid,
            role: ParticipantRole.approver,
            order: nextOrder++,
            status: ParticipantStatus.pending,
          },
          update: {
            order: nextOrder++,
            status: ParticipantStatus.pending,
            actedAt: null,
            rejectReason: null,
          },
        });
      }

      await tx.document.update({
        where: { id },
        data: { currentHolderId: dto.toUserId },
      });
      if (dto.note) {
        await tx.documentComment.create({
          data: {
            documentId: id,
            authorId: userId,
            text: `[Yo'naltirildi] ${dto.note}`,
          },
        });
      }
      await tx.documentAuditLog.create({
        data: {
          documentId: id,
          actorId: userId,
          action: 'forwarded',
          payload: {
            toUserId: dto.toUserId,
            note: dto.note ?? null,
            additionalApproverIds: extraIds,
          } as any,
        },
      });
    });

    await this.notifyApprover(dto.toUserId, userId, id, doc.number, doc.subject);

    return this.findOne(userId, id);
  }

  // ── E-IMZO BILAN IMZOLASH (tashqi hujjatlar uchun) ───────────────────

  async sign(userId: string, id: string, dto: SignDocumentDto) {
    const doc = await this.requireActiveApprover(userId, id);
    if (doc.type !== 'outgoing') {
      throw new BadRequestException(
        "E-IMZO faqat tashqi (chiquvchi) hujjatlarda qo'llaniladi",
      );
    }

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { canSignExternal: true, fullName: true },
    });
    if (!me?.canSignExternal) {
      throw new ForbiddenException("Sizda tashqi hujjatlarni imzolash huquqi yo'q");
    }

    // PKCS#7 base64 → Buffer
    let pkcs7: Buffer;
    try {
      pkcs7 = Buffer.from(dto.pkcs7Data, 'base64');
    } catch {
      throw new BadRequestException("PKCS#7 imzosi noto'g'ri formatda");
    }
    if (pkcs7.length < 64) {
      throw new BadRequestException("PKCS#7 imzosi juda kichik — noto'g'ri ma'lumot");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documentSignature.create({
        data: {
          documentId: id,
          signerId: userId,
          pkcs7Data: pkcs7,
          certSerial: dto.certSerial,
          certSubject: dto.certSubject,
          certIssuer: dto.certIssuer ?? null,
          certValidFrom: dto.certValidFrom ? new Date(dto.certValidFrom) : null,
          certValidTo: dto.certValidTo ? new Date(dto.certValidTo) : null,
          signatureHash: dto.signatureHash,
        },
      });
      // Imzo qo'yilganini va tasdiqlashni belgilaymiz
      await tx.documentParticipant.updateMany({
        where: {
          documentId: id,
          userId,
          role: ParticipantRole.approver,
          status: ParticipantStatus.pending,
        },
        data: { status: ParticipantStatus.approved, actedAt: new Date() },
      });
      await tx.documentAuditLog.create({
        data: {
          documentId: id,
          actorId: userId,
          action: 'signed',
          payload: { certSerial: dto.certSerial, certSubject: dto.certSubject } as any,
        },
      });
    });

    // Imzodan keyin zanjirni davom ettiramiz (approve singari)
    const next = await this.prisma.documentParticipant.findFirst({
      where: {
        documentId: id,
        role: ParticipantRole.approver,
        status: ParticipantStatus.pending,
      },
      orderBy: { order: 'asc' },
    });

    if (next) {
      await this.prisma.document.update({
        where: { id },
        data: {
          currentHolderId: next.userId,
          signatureChainPosition: { increment: 1 },
        },
      });
      await this.notifyApprover(next.userId, userId, id, doc.number, doc.subject);
    } else {
      let finalNumber = doc.number;
      await this.prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id },
          data: {
            status: DocumentStatus.done,
            currentHolderId: null,
            closedAt: new Date(),
            isSigned: true,
          },
        });
        // Chiquvchi hujjat raqami imzolash to'liq tugagach (done) beriladi.
        finalNumber = (await this.finalizeNumber(tx, id)) ?? finalNumber;
        await tx.documentAuditLog.create({
          data: { documentId: id, actorId: userId, action: 'completed' },
        });
      });
      await this.notifyCreator(doc.createdById, userId, id, finalNumber, doc.subject, 'completed');
    }

    return this.findOne(userId, id);
  }

  // Imzolash uchun kanonik matn — frontend SHA-256 hash'ini shu matn ustida hisoblaydi
  buildSignablePayload(doc: { number: string; subject: string; body: string }): string {
    return `${doc.number}\n${doc.subject}\n${doc.body}`;
  }

  async getSignablePayload(userId: string, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, number: true, subject: true, body: true, type: true, status: true, createdById: true },
    });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    await this.requireAccess(userId, doc);
    return { payload: this.buildSignablePayload(doc), number: doc.number };
  }

  // Menga biriktirilgan imzolanadigan tashqi hujjatlar ro'yxati
  async listToSign(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { canSignExternal: true },
    });
    if (!me?.canSignExternal) return [];

    const docs = await this.prisma.document.findMany({
      where: {
        type: 'outgoing',
        status: 'in_review',
        currentHolderId: userId,
        participants: {
          some: {
            userId,
            role: ParticipantRole.approver,
            status: ParticipantStatus.pending,
          },
        },
      },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // ── REZOLYUTSIYA / IJROCHI VAZIFALARI ─────────────────────────────────

  async addResolution(
    userId: string,
    id: string,
    dto: CreateResolutionDto,
    role?: string,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    if (doc.status !== 'in_review' && doc.status !== 'in_progress' && doc.status !== 'done') {
      throw new BadRequestException(
        "Rezolyutsiya faqat tasdiqlangan yoki ijrodagi hujjatga yoziladi",
      );
    }

    // Yaratuvchi, tasdiqlovchi (imzolagan) yoki kanselyariya/admin (nazorat bandi)
    const isCreator = doc.createdById === userId;
    const isApprover = doc.participants.some(
      (p) =>
        p.userId === userId &&
        p.role === ParticipantRole.approver &&
        p.status === ParticipantStatus.approved,
    );
    const isStaff = role === 'admin' || role === 'chancellery';
    if (!isCreator && !isApprover && !isStaff) {
      throw new ForbiddenException("Sizda rezolyutsiya yozish huquqi yo'q");
    }

    // Ijrochilar haqiqiy foydalanuvchilar bo'lishi kerak
    const targetIds = Array.from(new Set(dto.targets.map((t) => t.userId)));
    if (targetIds.length === 0) {
      throw new BadRequestException("Kamida bitta ijrochi tanlang");
    }
    const validUsers = await this.prisma.user.findMany({
      where: { id: { in: targetIds }, isActive: true },
      select: { id: true },
    });
    if (validUsers.length !== targetIds.length) {
      throw new BadRequestException('Ba\'zi ijrochilar topilmadi yoki bloklangan');
    }

    const maxOrder = Math.max(0, ...doc.participants.map((p) => p.order));

    const created = await this.prisma.$transaction(async (tx) => {
      const res = await tx.resolution.create({
        data: { documentId: id, authorId: userId, text: dto.text },
      });
      let nextOrder = maxOrder + 1;
      for (const t of dto.targets) {
        await tx.resolutionTarget.create({
          data: {
            resolutionId: res.id,
            userId: t.userId,
            deadline: t.deadline ? new Date(t.deadline) : null,
          },
        });
        // Ijrochi sifatida ham qatnashchi sifatida yozamiz (kirish huquqi uchun)
        await tx.documentParticipant.upsert({
          where: {
            documentId_userId_role: {
              documentId: id,
              userId: t.userId,
              role: ParticipantRole.executor,
            },
          },
          create: {
            documentId: id,
            userId: t.userId,
            role: ParticipantRole.executor,
            order: nextOrder++,
            status: ParticipantStatus.pending,
            deadline: t.deadline ? new Date(t.deadline) : null,
          },
          update: {
            deadline: t.deadline ? new Date(t.deadline) : null,
            status: ParticipantStatus.pending,
            actedAt: null,
          },
        });
      }
      await tx.document.update({
        where: { id },
        data: { status: DocumentStatus.in_progress, currentHolderId: null },
      });
      await tx.documentAuditLog.create({
        data: {
          documentId: id,
          actorId: userId,
          action: 'resolution_added',
          payload: { targets: dto.targets } as any,
        },
      });
      return res;
    });

    // Ijrochilarni xabardor qilamiz
    for (const t of dto.targets) {
      await this.notifyExecutor(t.userId, userId, id, doc.number, doc.subject, dto.text);
    }

    return this.findOne(userId, id);
  }

  async completeTarget(userId: string, targetId: string, dto: CompleteTargetDto) {
    const target = await this.prisma.resolutionTarget.findUnique({
      where: { id: targetId },
      include: { resolution: { include: { document: true } } },
    });
    if (!target) throw new NotFoundException('Topshiriq topilmadi');
    if (target.userId !== userId) {
      throw new ForbiddenException("Bu vazifa siznikiga tegishli emas");
    }
    if (target.status === 'done') {
      throw new BadRequestException('Vazifa allaqachon bajarilgan');
    }

    const docId = target.resolution.documentId;

    await this.prisma.$transaction(async (tx) => {
      await tx.resolutionTarget.update({
        where: { id: targetId },
        data: {
          status: 'done',
          doneAt: new Date(),
          doneNote: dto.note,
        },
      });
      await tx.documentParticipant.updateMany({
        where: { documentId: docId, userId, role: ParticipantRole.executor },
        data: { status: ParticipantStatus.done, actedAt: new Date() },
      });
      await tx.documentAuditLog.create({
        data: {
          documentId: docId,
          actorId: userId,
          action: 'task_completed',
          payload: { targetId, note: dto.note ?? null } as any,
        },
      });
    });

    // Hamma topshiriqlar bajarilganmi tekshiramiz
    const remaining = await this.prisma.resolutionTarget.count({
      where: { resolution: { documentId: docId }, status: { not: 'done' } },
    });

    if (remaining === 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id: docId },
          data: { status: DocumentStatus.done, closedAt: new Date() },
        });
        await tx.documentAuditLog.create({
          data: { documentId: docId, actorId: userId, action: 'all_tasks_done' },
        });
      });
    }

    // Rezolyutsiya muallifi va hujjat yaratuvchisini xabardor qilamiz
    const doc = target.resolution.document;
    await this.notifyTaskDone(
      target.resolution.authorId,
      userId,
      docId,
      doc.number,
      doc.subject,
      dto.note,
    );
    if (doc.createdById !== target.resolution.authorId && doc.createdById !== userId) {
      await this.notifyTaskDone(doc.createdById, userId, docId, doc.number, doc.subject, dto.note);
    }

    return this.findOne(userId, docId);
  }

  // ── SO'ROVLAR ─────────────────────────────────────────────────────────

  async findOne(userId: string, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: FULL_INCLUDE,
    });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    await this.requireAccess(userId, doc);
    await this.attachRenderedBody(doc);
    return this.serialize(doc);
  }

  // "ichki" shabloniga avtomat solingan hujjat uchun to'ldirilgan matnni
  // jonli hisoblaydi (asl matn saqlanadi; sana tokenlari tasdiqlash bo'yicha
  // to'ladi, shu bois o'qishda hisoblaymiz).
  private async attachRenderedBody(doc: any): Promise<void> {
    // Shablon (ichki avto yoki foydalanuvchi blankasi) bo'lsa — to'liq render.
    const rendered = await this.renderTemplateHtml(doc);
    if (rendered != null) {
      doc.renderedBody = rendered;
      return;
    }
    // Shablon yo'q — matn ichida embedded {{xujjat_n}} / {{sana_soat}} bo'lsa to'ldiramiz.
    if (doc.body) {
      const filled = fillCustomPlaceholders(doc.body, {
        number: doc.number ?? '',
        date: this.effectiveDocDate(doc),
      });
      if (filled !== doc.body) doc.renderedBody = filled;
    }
  }

  // "ichki" shabloniga solingan hujjatning to'ldirilgan HTML matnini quradi.
  // FULL_INCLUDE bilan yuklangan doc kutiladi (participants, createdBy, dept...).
  // Shablon yo'q bo'lsa null qaytaradi. Bu metod HTML ko'rinishi, PDF/Word
  // eksporti va ommaviy QR skaneri uchun YAGONA manba — barchasi bir xil holat.
  private async renderTemplateHtml(doc: any): Promise<string | null> {
    if (!doc?.templateId) return null;
    const tpl = await this.prisma.documentTemplate.findUnique({
      where: { id: doc.templateId },
      select: { bodyTemplate: true },
    });
    if (!tpl?.bodyTemplate) return null;

    // Foydalanuvchi tanlagan blanka (ichki avto-shablon emas): blanka ramka bo'lib,
    // {{matn}} → hujjat matni, {{xujjat_n}} → raqam, {{sana_soat}} → sana.
    // {{qr_kod}} → hujjat QR kodi, faqat hujjat "bajarildi" (done) bo'lganda.
    if (!doc.autoFilled) {
      let qrHtml = '';
      if (doc.status === DocumentStatus.done) {
        try {
          const token = await this.ensurePublicToken(doc.id, doc.publicToken);
          const qrDataUrl = await QRCode.toDataURL(this.buildScanUrl(token), {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 160,
          });
          // QR — inline rasm: "Бош директор  {{qr_kod}}  Жалилов.А.А" kabi bir
          // qatorda, matn bilan yonma-yon (vertikal markazda) chiqadi.
          qrHtml =
            `<img src="${qrDataUrl}" alt="QR" title="Hujjatni skanerlab ko'rish" ` +
            `style="width:96px;height:96px;display:inline-block;vertical-align:middle;" />`;
        } catch {
          qrHtml = ''; // QR yaratilmasa — bo'sh qoladi
        }
      }
      return fillCustomPlaceholders(tpl.bodyTemplate, {
        matn: doc.body ?? '',
        number: doc.number ?? '',
        date: this.effectiveDocDate(doc),
        qr: qrHtml,
      });
    }

    const approvers = (doc.participants ?? [])
      .filter((p: any) => p.role === ParticipantRole.approver && p.user?.login)
      .map((p: any) => ({
        login: p.user.login,
        fullName: p.user.fullName ?? '',
        actedAt: p.actedAt ?? null,
        approved: p.status === ParticipantStatus.approved,
      }));
    // Tasdiqlash katakchalarida "TASDIQLANDI" o'rniga hujjat QR kodi ko'rsatiladi.
    let qrDataUrl: string | undefined;
    try {
      const token = await this.ensurePublicToken(doc.id, doc.publicToken);
      qrDataUrl = await QRCode.toDataURL(this.buildScanUrl(token), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 160,
      });
    } catch {
      qrDataUrl = undefined; // QR yaratilmasa — eski matnli belgiga qaytadi
    }
    const { values, raw } = buildIchkiTokens({
      creatorName: doc.createdBy?.fullName ?? '',
      number: doc.number ?? '',
      senderDept: doc.numberDept?.name ?? doc.createdBy?.department?.name ?? '',
      recipientDept: doc.targetDept?.name ?? '',
      subject: doc.subject ?? '',
      body: doc.body ?? '',
      recipientName: '',
      createdAt: doc.createdAt,
      closedAt: doc.closedAt ?? null,
      approvers,
      qrDataUrl,
    });
    return renderIchki(tpl.bodyTemplate, values, raw);
  }

  // Mening barcha hujjatlarim (yaratganlarim + ishtirok etganlarim)
  async listMine(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: await this.participantScope(userId),
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Qidiruv — yagona ID (asaka-...), tartib raqami yoki mavzu bo'yicha.
  // Rol bo'yicha ko'rish doirasi: oddiy user faqat o'zi qatnashgan, admin/konselyariya hammasi.
  async search(userId: string, query: string) {
    const q = (query ?? '').trim();
    if (!q) return [];
    const scope = await this.participantScope(userId);
    const docs = await this.prisma.document.findMany({
      where: {
        AND: [
          scope,
          {
            OR: [
              { docUid: { contains: q, mode: 'insensitive' } },
              { number: { contains: q, mode: 'insensitive' } },
              { subject: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return docs.map((d) => this.serialize(d));
  }

  // Alohida nazorat — faol hujjatlar (oddiy user: o'zi yaratganlar; admin/konselyariya: hammasi)
  async listControl(userId: string) {
    const seeAll = await this.canSeeAllDocs(userId);
    const docs = await this.prisma.document.findMany({
      where: {
        status: { in: ['in_review', 'in_progress', 'overdue'] },
        ...(seeAll ? {} : { createdById: userId }),
      },
      include: FULL_INCLUDE,
      orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
    });
    return docs.map((d) => this.serialize(d));
  }

  // Bo'lim hujjatlari — foydalanuvchi bo'limiga tegishli barcha hujjatlar
  async listDepartment(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (!me?.departmentId) return [];
    const deptId = me.departmentId;
    const docs = await this.prisma.document.findMany({
      where: {
        status: { not: 'draft' },
        OR: [
          { numberDeptId: deptId },
          { targetDeptId: deptId },
          { createdBy: { departmentId: deptId } },
        ],
      },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Taqvim — muddati belgilangan, men ishtirok etayotgan hujjatlar
  async getCalendar(userId: string, fromIso?: string, toIso?: string) {
    const deadlineFilter: any = fromIso || toIso ? {} : { not: null };
    if (fromIso) deadlineFilter.gte = new Date(fromIso);
    if (toIso) deadlineFilter.lte = new Date(toIso);
    const docs = await this.prisma.document.findMany({
      where: {
        deadline: deadlineFilter,
        ...(await this.participantScope(userId)),
      },
      include: FULL_INCLUDE,
      orderBy: { deadline: 'asc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Qoralamalar
  async listDrafts(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: { createdById: userId, status: 'draft' },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Menga biriktirilgan vazifalar (tasdiqlash kutilayotgan)
  async listTasks(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: {
        participants: {
          some: {
            userId,
            role: ParticipantRole.approver,
            status: ParticipantStatus.pending,
          },
        },
        status: 'in_review',
      },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Menga biriktirilgan ijro topshiriqlari (rezolyutsiyalar)
  async listExecutions(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: {
        status: { in: ['in_progress', 'overdue'] },
        resolutions: {
          some: {
            targets: { some: { userId, status: { not: 'done' } } },
          },
        },
      },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Kiruvchi hujjatlar — type=incoming, men ishtirokchi yoki yaratuvchiman
  async listIncoming(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: {
        type: 'incoming',
        ...(await this.participantScope(userId)),
      },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Chiquvchi hujjatlar — type=outgoing, men ishtirokchi yoki yaratuvchiman
  async listOutgoing(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: {
        type: 'outgoing',
        ...(await this.participantScope(userId)),
      },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Arxiv — yopilgan (done) yoki rad etilgan (rejected)
  async listArchive(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: {
        status: { in: ['done', 'rejected'] },
        ...(await this.participantScope(userId)),
      },
      include: FULL_INCLUDE,
      orderBy: { closedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // ── NAZORAT (Kanselyariya) ─────────────────────────────────────────────
  // Nazorat oynalari faqat admin/kanselyariya uchun — barcha hujjatlar (ochiq/yopiq)
  // ko'rinadi (participantScope qo'llanmaydi).

  async listControlByType(type: DocumentType) {
    const docs = await this.prisma.document.findMany({
      where: { type, status: { not: 'draft' } },
      include: FULL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Tayyor ichki hujjatlar — bajarilgan (done) ichki hujjatlar
  async listControlReadyInternal() {
    const docs = await this.prisma.document.findMany({
      where: { type: 'internal', status: 'done' },
      include: FULL_INCLUDE,
      orderBy: { closedAt: 'desc' },
    });
    return docs.map((d) => this.serialize(d));
  }

  // Topshiriqlar (rezolyutsiya ijrochilari) bo'yicha ijro statistikasi.
  // "Статус выполнения поручений" dashboard'i uchun.
  async getControlStats() {
    const targets = await this.prisma.resolutionTarget.findMany({
      include: {
        resolution: {
          select: {
            authorId: true,
            author: {
              select: {
                id: true,
                fullName: true,
                avatarPath: true,
                position: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
            document: { select: { id: true, type: true } },
          },
        },
      },
    });

    const now = Date.now();
    // Har bir topshiriqni bir "savat"ga ajratamiz
    type Bucket = 'inProgress' | 'notDone' | 'done' | 'doneLate';
    const classify = (t: (typeof targets)[number]): Bucket => {
      const dl = t.deadline ? new Date(t.deadline).getTime() : null;
      if (t.status === 'done') {
        const late = dl && t.doneAt ? new Date(t.doneAt).getTime() > dl : false;
        return late ? 'doneLate' : 'done';
      }
      // Bajarilmagan: muddati o'tgan bo'lsa — "не выполненные", aks holda "выполняются"
      if (t.status === 'overdue' || (dl !== null && now > dl)) return 'notDone';
      return 'inProgress';
    };

    // ── Hujjat turi bo'yicha kesim ──
    const typeAgg = new Map<
      string,
      { docs: Set<string>; orders: number; inProgress: number; notDone: number; done: number; doneLate: number }
    >();
    const ensureType = (ty: string) => {
      let a = typeAgg.get(ty);
      if (!a) {
        a = { docs: new Set(), orders: 0, inProgress: 0, notDone: 0, done: 0, doneLate: 0 };
        typeAgg.set(ty, a);
      }
      return a;
    };

    // ── Rahbarlar (rezolyutsiya mualliflari) bo'yicha kesim ──
    const mgrAgg = new Map<
      string,
      {
        id: string;
        fullName: string;
        avatarPath: string | null;
        position: string | null;
        department: string | null;
        orders: number;
        inProgress: number;
        notDone: number;
        done: number;
        doneLate: number;
      }
    >();

    for (const t of targets) {
      const ty = t.resolution.document.type;
      const a = ensureType(ty);
      a.docs.add(t.resolution.document.id);
      a.orders += 1;
      const b = classify(t);
      a[b] += 1;

      const author = t.resolution.author;
      let m = mgrAgg.get(author.id);
      if (!m) {
        m = {
          id: author.id,
          fullName: author.fullName,
          avatarPath: author.avatarPath ?? null,
          position: author.position?.name ?? null,
          department: author.department?.name ?? null,
          orders: 0,
          inProgress: 0,
          notDone: 0,
          done: 0,
          doneLate: 0,
        };
        mgrAgg.set(author.id, m);
      }
      m.orders += 1;
      m[b] += 1;
    }

    const byType = [...typeAgg.entries()].map(([type, a]) => ({
      type,
      documents: a.docs.size,
      orders: a.orders,
      inProgress: a.inProgress,
      notDone: a.notDone,
      done: a.done,
      doneLate: a.doneLate,
      renewed: 0, // "Возобновленные" — hozircha tushuncha yo'q
    }));

    const total = byType.reduce(
      (acc, r) => {
        acc.documents += r.documents;
        acc.orders += r.orders;
        acc.inProgress += r.inProgress;
        acc.notDone += r.notDone;
        acc.done += r.done;
        acc.doneLate += r.doneLate;
        return acc;
      },
      { documents: 0, orders: 0, inProgress: 0, notDone: 0, done: 0, doneLate: 0, renewed: 0 },
    );

    const managers = [...mgrAgg.values()]
      .map((m) => ({ ...m, onApproval: 0 }))
      .sort((x, y) => y.orders - x.orders);

    return { byType, total, managers };
  }

  // ── OMMAVIY QR / SKANER ────────────────────────────────────────────────
  // Login/parolsiz foydalanuvchi uchun hujjatning qisqacha holati (public_token orqali).
  // 1-etap: faqat holat. Keyingi etapda ichki ma'lumotlar ham qo'shiladi.
  async getPublicSnapshot(token: string) {
    // To'liq yuklaymiz — shablon holatini (renderedHtml) ham hisoblash uchun.
    const doc = await this.prisma.document.findUnique({
      where: { publicToken: token },
      include: FULL_INCLUDE,
    });
    if (!doc) {
      throw new NotFoundException('Hujjat topilmadi yoki QR kod yaroqsiz');
    }
    // Skaner ham HTML ko'rinish bilan bir xil to'ldirilgan shablonni ko'rsatadi.
    const renderedHtml = await this.renderTemplateHtml(doc);

    // Tasdiqlash zanjiri (kim tasdiqladi / kim tasdiqlamadi) — QR sahifasidagi tugma uchun.
    const chain = (doc.participants ?? [])
      .filter((p: any) => p.role === ParticipantRole.approver)
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((p: any) => ({
        fullName: p.user?.fullName ?? '—',
        position: p.user?.position?.name ?? null,
        status: p.status,
        order: p.order ?? 0,
        actedAt: p.actedAt ?? null,
        rejectReason: p.rejectReason ?? null,
      }));

    // Hujjat tarixi (kim qanday reaksiya qildi) — QR sahifasidagi tugma uchun.
    const history = (doc.audit ?? []).map((a: any) => ({
      action: a.action,
      actorName: a.actor?.fullName ?? null,
      createdAt: a.createdAt,
    }));

    return {
      number: doc.number.startsWith('DRAFT-') ? null : doc.number,
      docUid: doc.docUid,
      type: doc.type,
      internalKind: doc.internalKind,
      subject: doc.subject,
      status: doc.status,
      isSigned: doc.isSigned,
      deadline: doc.deadline,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      closedAt: doc.closedAt,
      createdByName: doc.createdBy?.fullName ?? null,
      createdByDept: doc.createdBy?.department?.name ?? null,
      // Shablon bo'lmasa oddiy matnni ham beramiz (skaner to'g'ridan hujjatni ko'rsatadi).
      body: renderedHtml ? null : (doc.body ?? null),
      renderedHtml,
      chain,
      history,
    };
  }

  // Skaner linkini quradi (ommaviy QR uchun umumiy manzil).
  private buildScanUrl(token: string, baseOverride?: string): string {
    const base = (
      baseOverride ||
      process.env.PUBLIC_BASE_URL ||
      'https://edo.asaka-motors.uz'
    ).replace(/\/+$/, '');
    return `${base}/skaner/${token}`;
  }

  // Hujjatning ommaviy tokenini qaytaradi (yo'q bo'lsa yaratib saqlaydi).
  private async ensurePublicToken(id: string, existing?: string | null): Promise<string> {
    if (existing) return existing;
    const token = randomBytes(16).toString('hex');
    await this.prisma.document.update({
      where: { id },
      data: { publicToken: token },
    });
    return token;
  }

  // Hujjat uchun QR kod (data URL PNG) va ommaviy skaner linkini qaytaradi.
  async generateQr(id: string, baseOverride?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { publicToken: true },
    });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    const token = await this.ensurePublicToken(id, doc.publicToken);
    const url = this.buildScanUrl(token, baseOverride);
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });
    return { url, token, dataUrl };
  }

  // ── YORDAMCHILAR ──────────────────────────────────────────────────────

  private async buildManagerChain(userId: string): Promise<string[]> {
    const chain: string[] = [];
    const seen = new Set<string>([userId]);
    let currentId: string | null = userId;
    for (let i = 0; i < MAX_CHAIN_DEPTH; i++) {
      const u: { managerId: string | null } | null = await this.prisma.user.findUnique({
        where: { id: currentId! },
        select: { managerId: true },
      });
      if (!u || !u.managerId) break;
      if (seen.has(u.managerId)) break; // sikldan qochish
      chain.push(u.managerId);
      seen.add(u.managerId);
      currentId = u.managerId;
    }
    return chain;
  }

  private async allocateNumber(
    deptCode: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const counter = await client.documentCounter.upsert({
      where: { deptCode },
      create: { deptCode, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const padded = String(counter.lastNumber).padStart(2, '0');
    // Xodimlar uchun tartib raqami: avval tartib, keyin bo'lim kodi (01-05)
    return `${padded}-${deptCode}`;
  }

  // Hujjatning ko'rsatiladigan sanasi:
  //  - kiruvchi (incoming) → yaratilgan (ro'yxatga olingan) sana (eski shart);
  //  - ichki/chiquvchi → TASDIQLANGAN (yakunlangan) sana; hali yakunlanmagan
  //    bo'lsa vaqtincha yaratilgan sana ko'rsatiladi.
  private effectiveDocDate(doc: {
    type: string;
    createdAt: Date;
    closedAt: Date | null;
  }): Date {
    if (doc.type === 'incoming') return doc.createdAt;
    return doc.closedAt ?? doc.createdAt;
  }

  // Ichki/chiquvchi hujjatga YAKUNIY tartib raqamini beradi — faqat hujjat
  // tasdiqlanib (done) bo'lganda, ya'ni raqam hali qoralama (DRAFT-) bo'lsa.
  // Transaksiya ichida chaqiriladi. Yakuniy raqamni qaytaradi.
  private async finalizeNumber(
    tx: Prisma.TransactionClient,
    docId: string,
  ): Promise<string | null> {
    const d = await tx.document.findUnique({
      where: { id: docId },
      select: { number: true, numberDept: { select: { code: true } } },
    });
    if (!d) return null;
    // Allaqachon haqiqiy raqam berilgan bo'lsa — qayta bermaymiz.
    if (d.number && !d.number.startsWith('DRAFT-')) return d.number;
    const code = d.numberDept?.code;
    if (!code) return d.number ?? null; // bo'lim kodi yo'q — raqamsiz qoladi
    const number = await this.allocateNumber(code, tx);
    await tx.document.update({ where: { id: docId }, data: { number } });
    return number;
  }

  // Tizim uchun yagona ID: asaka-YYYYMMDDNN (kunlik tartib bilan). Yaratishda beriladi.
  private async allocateDocUid(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}`;
    const counter = await tx.docUidCounter.upsert({
      where: { day },
      create: { day, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const seq = String(counter.lastNumber).padStart(2, '0');
    return `asaka-${day}${seq}`;
  }

  // Keyingi hujjat raqamini oldindan ko'rsatish — counter'ni OSHIRMAYDI (faqat preview).
  // Xodim hujjat yaratayotganda nechchinchi tartib raqamli hujjat ekanini ko'rishi uchun.
  async previewNextNumber(deptId: string): Promise<{ number: string | null }> {
    const dept = await this.prisma.department.findUnique({
      where: { id: deptId },
      select: { code: true },
    });
    if (!dept?.code) return { number: null };

    const counter = await this.prisma.documentCounter.findUnique({
      where: { deptCode: dept.code },
    });
    // allocateNumber bilan bir xil mantiq: counter yo'q bo'lsa 1, aks holda lastNumber+1
    const next = (counter?.lastNumber ?? 0) + 1;
    const padded = String(next).padStart(2, '0');
    return { number: `${padded}-${dept.code}` };
  }

  // ── PDF eksport ────────────────────────────────────────────────────────
  async exportPdf(
    userId: string,
    id: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const doc = await this.findOne(userId, id); // access check ichida
    const buffer = await buildDocumentPdf(doc);
    const safeNumber = doc.number.replace(/[^a-zA-Z0-9_-]/g, '_');
    return { filename: `${safeNumber}.pdf`, buffer };
  }

  // ── STATISTIKA / HISOBOTLAR ────────────────────────────────────────────
  async getStats(userId: string, fromIso?: string, toIso?: string) {
    const from = fromIso ? new Date(fromIso) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toIso ? new Date(toIso) : new Date();

    // Foydalanuvchi yaratgan hujjatlar bo'yicha kesim
    const created = await this.prisma.document.findMany({
      where: { createdById: userId, createdAt: { gte: from, lte: to } },
      select: { id: true, status: true, type: true, createdAt: true },
    });

    // Foydalanuvchining tasdiqlash navbati statistikasi
    const myApprovals = await this.prisma.documentParticipant.findMany({
      where: {
        userId,
        role: 'approver',
        document: { createdAt: { gte: from, lte: to } },
      },
      select: { status: true, actedAt: true },
    });

    // Topshiriqlar (ResolutionTarget) bo'yicha kesim
    const myTasks = await this.prisma.resolutionTarget.findMany({
      where: {
        userId,
        resolution: { document: { createdAt: { gte: from, lte: to } } },
      },
      select: { status: true, doneAt: true, deadline: true },
    });

    const byStatus = countBy(created, (d) => d.status);
    const byType = countBy(created, (d) => d.type);

    const approvalsByStatus = countBy(myApprovals, (p) => p.status);
    const tasksByStatus = countBy(myTasks, (t) => t.status);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      created: {
        total: created.length,
        byStatus,
        byType,
      },
      approvals: {
        total: myApprovals.length,
        byStatus: approvalsByStatus,
      },
      tasks: {
        total: myTasks.length,
        byStatus: tasksByStatus,
      },
    };
  }

  async getGlobalStats(fromIso?: string, toIso?: string) {
    const from = fromIso ? new Date(fromIso) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toIso ? new Date(toIso) : new Date();

    const docs = await this.prisma.document.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        id: true,
        status: true,
        type: true,
        createdAt: true,
        closedAt: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    const byStatus = countBy(docs, (d) => d.status);
    const byType = countBy(docs, (d) => d.type);

    // Top yaratuvchilar
    const creatorMap = new Map<string, { name: string; count: number }>();
    for (const d of docs) {
      const k = d.createdBy.id;
      const prev = creatorMap.get(k);
      if (prev) prev.count += 1;
      else creatorMap.set(k, { name: d.createdBy.fullName, count: 1 });
    }
    const topCreators = Array.from(creatorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // O'rtacha yopilish vaqti (soatlarda) — faqat closedAt bor hujjatlar uchun
    const closed = docs.filter((d) => d.closedAt);
    const avgCloseHours = closed.length
      ? closed.reduce(
          (sum, d) =>
            sum +
            (new Date(d.closedAt as any).getTime() - new Date(d.createdAt).getTime()) /
              (1000 * 60 * 60),
          0,
        ) / closed.length
      : 0;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      total: docs.length,
      closed: closed.length,
      byStatus,
      byType,
      topCreators,
      avgCloseHours: Number(avgCloseHours.toFixed(1)),
    };
  }

  // ── HUJJAT FAYLLARI ──────────────────────────────────────────────────
  async uploadAttachment(userId: string, docId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    const doc = await this.prisma.document.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    await this.requireAccess(userId, doc);
    // Hujjatda qatnashayotgan xar bir foydalanuvchi fayl briktira oladi
    // (lekin faqat draft, in_review, in_progress statuslarida)
    if (!['draft', 'in_review', 'in_progress'].includes(doc.status)) {
      throw new BadRequestException('Fayllar bajarilgan yoki rad etilgan hujjatlarga yuklanmaydi');
    }
    if (file.size > this.attMaxBytes) {
      throw new BadRequestException(
        `Fayl ${this.attMaxBytes / 1024 / 1024} MB dan katta bo'lmasligi kerak`,
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (FORBIDDEN_EXTS.includes(ext)) {
      throw new BadRequestException(`'${ext}' kengaytmali fayllar taqiqlangan`);
    }

    const now = new Date();
    const subDir = path.join(
      'edo',
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
    );
    const fullDir = path.join(this.attDir, subDir);
    await fs.mkdir(fullDir, { recursive: true });

    const id = uuid();
    const storedFilename = `${id}${ext}`;
    const relativePath = path.join(subDir, storedFilename);
    await fs.writeFile(path.join(fullDir, storedFilename), file.buffer);

    const created = await this.prisma.documentAttachment.create({
      data: {
        id,
        documentId: docId,
        uploadedById: userId,
        filename: file.originalname,
        storedPath: relativePath,
        sizeBytes: BigInt(file.size),
        mimeType: file.mimetype,
      },
    });
    return {
      id: created.id,
      filename: created.filename,
      mimeType: created.mimeType,
      sizeBytes: Number(created.sizeBytes),
    };
  }

  async downloadAttachment(userId: string, docId: string, attId: string) {
    const att = await this.prisma.documentAttachment.findUnique({
      where: { id: attId },
      include: { document: { select: { id: true, createdById: true } } },
    });
    if (!att || !att.document || att.documentId !== docId) {
      throw new NotFoundException('Fayl topilmadi');
    }
    await this.requireAccess(userId, att.document);
    return {
      fullPath: path.join(this.attDir, att.storedPath),
      filename: att.filename,
      mimeType: att.mimeType,
      sizeBytes: Number(att.sizeBytes),
    };
  }

  async deleteAttachment(userId: string, docId: string, attId: string) {
    const att = await this.prisma.documentAttachment.findUnique({
      where: { id: attId },
      include: { document: true },
    });
    if (!att || !att.document || att.documentId !== docId) {
      throw new NotFoundException('Fayl topilmadi');
    }
    // Faylni o'chirish: yaratuvchi yoki fayl yuklaydigan foydalanuvchi
    if (att.document.createdById !== userId && att.uploadedById !== userId) {
      throw new ForbiddenException("Fayl faqat yaratuvchi yoki fayl yuklaydigan foydalanuvchi tomonidan o'chirilib oladi");
    }
    if (att.document.status !== 'draft') {
      throw new BadRequestException("Faqat qoralamadan o'chirish mumkin");
    }
    try {
      await fs.unlink(path.join(this.attDir, att.storedPath));
    } catch {}
    await this.prisma.documentAttachment.delete({ where: { id: attId } });
    return { ok: true };
  }

  // Qoralama holatida tasdiqlash zanjirini saqlash/yangilash.
  // - Faqat pending statusdagi approver-larni o'chiramiz (allaqachon harakat qilinganlarni saqlaymiz).
  // - Yangi ro'yxat tartibida 1, 2, 3, ... order bilan kiritamiz.
  // - Yaratuvchi ro'yxatga kira olmaydi.
  private async saveApproverChain(
    tx: Prisma.TransactionClient,
    docId: string,
    approverIds: string[],
    creatorId: string,
  ) {
    const cleanIds = Array.from(
      new Set((approverIds || []).filter((x) => x && x !== creatorId)),
    );
    if (cleanIds.length > 20) {
      throw new BadRequestException(
        "Tasdiqlash zanjirida 20 dan ortiq foydalanuvchi bo'lmasligi kerak",
      );
    }
    if (cleanIds.length > 0) {
      const users = await tx.user.findMany({
        where: { id: { in: cleanIds }, isActive: true },
        select: { id: true },
      });
      if (users.length !== cleanIds.length) {
        throw new BadRequestException(
          "Ba'zi tasdiqlovchilar topilmadi yoki bloklangan",
        );
      }
    }
    // Eski pending approver-larni o'chiramiz
    await tx.documentParticipant.deleteMany({
      where: {
        documentId: docId,
        role: ParticipantRole.approver,
        status: ParticipantStatus.pending,
      },
    });
    // Yangi zanjirni 1-tartibdan boshlab kiritamiz
    let order = 1;
    for (const uid of cleanIds) {
      const currentOrder = order++;
      await tx.documentParticipant.upsert({
        where: {
          documentId_userId_role: {
            documentId: docId,
            userId: uid,
            role: ParticipantRole.approver,
          },
        },
        create: {
          documentId: docId,
          userId: uid,
          role: ParticipantRole.approver,
          order: currentOrder,
          status: ParticipantStatus.pending,
        },
        update: {
          order: currentOrder,
          status: ParticipantStatus.pending,
          actedAt: null,
          rejectReason: null,
        },
      });
    }
  }

  // Approve/forward paytida qo'shimcha tasdiqlovchilarni tekshirib, toza ro'yxat qaytaradi.
  // - Bo'sh/null → []
  // - Yaratuvchi va requesterId ishtirok eta olmaydi
  // - Allaqachon zanjirda tasdiqlangan/rad etgan foydalanuvchilar takrorlanmasligi kerak
  // - excludeIds — qo'shimcha bilan birga keladigan foydalanuvchilar (forward'da toUserId)
  private async validateAdditionalApprovers(
    docId: string,
    rawIds: string[] | undefined,
    requesterId: string,
    excludeIds: string[] = [],
  ): Promise<string[]> {
    const ids = Array.from(
      new Set((rawIds || []).filter((x) => x && x !== requesterId)),
    );
    if (ids.length === 0) return [];
    if (ids.length > 20) {
      throw new BadRequestException(
        "20 dan ortiq qo'shimcha tasdiqlovchi qo'sha olmaysiz",
      );
    }
    // Hujjat yaratuvchisi va boshqa exclude qilinishi kerak bo'lganlar bilan dublikat bo'lmasin
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { createdById: true },
    });
    const exclude = new Set<string>([
      ...(doc ? [doc.createdById] : []),
      ...excludeIds.filter(Boolean),
    ]);
    for (const id of ids) {
      if (exclude.has(id)) {
        throw new BadRequestException(
          "Yaratuvchi yoki yo'naltirilayotgan shaxs qo'shimcha tasdiqlovchi sifatida kiritilmaydi",
        );
      }
    }
    // Foydalanuvchilarni tekshiramiz
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });
    if (users.length !== ids.length) {
      throw new BadRequestException(
        "Ba'zi tasdiqlovchilar topilmadi yoki bloklangan",
      );
    }
    // Zanjirda allaqachon approved/rejected bo'lganlar — qaytadan kiritishga ruxsat bermaymiz
    const acted = await this.prisma.documentParticipant.findMany({
      where: {
        documentId: docId,
        userId: { in: ids },
        role: ParticipantRole.approver,
        status: { in: [ParticipantStatus.approved, ParticipantStatus.rejected] },
      },
      select: { userId: true },
    });
    if (acted.length > 0) {
      throw new BadRequestException(
        "Allaqachon zanjirda harakat qilgan foydalanuvchini qayta tasdiqlovchi sifatida qo'sha olmaysiz",
      );
    }
    return ids;
  }

  // Hujjatga kirish huquqi (yaratuvchi yoki ishtirokchi)
  private async requireAccess(userId: string, doc: { id: string; createdById: string }) {
    if (doc.createdById === userId) return;
    // Admin va konselyariya har qanday hujjatni ko'ra oladi
    if (await this.canSeeAllDocs(userId)) return;
    const p = await this.prisma.documentParticipant.findFirst({
      where: { documentId: doc.id, userId },
      select: { id: true },
    });
    if (!p) throw new ForbiddenException("Sizda hujjatni ko'rish huquqi yo'q");
  }

  // Admin/konselyariya barcha hujjatlarni ko'radi; oddiy foydalanuvchi — faqat o'ziniki
  private async canSeeAllDocs(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return u?.role === 'admin' || u?.role === 'chancellery';
  }

  // Ro'lga qarab ro'yxat filtri: admin/konselyariya — hammasi, oddiy user — o'zi ishtirok etganlari
  private async participantScope(userId: string): Promise<Prisma.DocumentWhereInput> {
    if (await this.canSeeAllDocs(userId)) return {};
    return {
      OR: [{ createdById: userId }, { participants: { some: { userId } } }],
    };
  }

  // Faqat hozir tasdiqlash navbatida turgan foydalanuvchi
  private async requireActiveApprover(userId: string, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    if (doc.status !== 'in_review') {
      throw new BadRequestException("Hujjat tasdiqlash bosqichida emas");
    }
    if (doc.currentHolderId !== userId) {
      throw new ForbiddenException("Hujjat hozir sizning navbatingizda emas");
    }
    return doc;
  }

  private async shouldNotify(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifyEdo: true, isActive: true },
    });
    return !!u && u.isActive && u.notifyEdo;
  }

  private async notifyApprover(
    approverId: string,
    actorId: string,
    docId: string,
    number: string,
    subject: string,
  ) {
    if (!(await this.shouldNotify(approverId))) return;
    try {
      const link = `/edo/documents/${docId}`;
      const result = await this.messages.send(actorId, {
        recipientIds: [approverId],
        subject: `[EDO ${number}] ${subject}`,
        body: `Sizga tasdiqlash uchun hujjat keldi.\n\nMavzu: ${subject}\nRaqam: ${number}\n\nHujjat sahifasi: ${link}`,
        importance: 'important',
      });
      this.gateway.notifyNewMessage([approverId], result);

      // Tashqi email'ga xam jo'natish
      const approver = await this.prisma.user.findUnique({
        where: { id: approverId },
        select: { email: true, fullName: true },
      });

      if (approver?.email) {
        try {
          const serverUrl = this.config.get<string>('SERVER_URL') || 'http://192.168.100.252';
          const fullLink = `${serverUrl}/edo/documents/${docId}`;
          const emailBody = `Salom ${approver.fullName},\n\nSizga tasdiqlash uchun yangi hujjat keldi:\n\nMavzu: ${subject}\nRaqam: ${number}\n\nHujjatni ko'rish: ${fullLink}\n\nSog'Likat,\nPochta Tizimi`;

          // TODO: SMTP orqali email jo'natish (smtp-send.service.ts'ni ishlatish)
          // Hozircha console'ga yozamiz
          console.log(`[EMAIL] ${approver.email}'ga email jo'natilishi kerak:\n${emailBody}`);
        } catch (emailErr) {
          console.warn('[EDO] external email failed:', emailErr);
        }
      }
    } catch (e) {
      // Pochta yuborilmasa ham hujjat oqimi davom etadi
      // eslint-disable-next-line no-console
      console.error('[EDO] approver notify failed:', e);
    }
  }

  private async notifyCreator(
    creatorId: string,
    actorId: string,
    docId: string,
    number: string,
    subject: string,
    action: 'rejected' | 'completed',
    reason?: string,
  ) {
    if (!(await this.shouldNotify(creatorId))) return;
    try {
      const link = `/edo/documents/${docId}`;
      const verb = action === 'rejected' ? 'rad etildi' : 'imzo zanjiri tugadi';
      const body =
        `Hujjatingiz holati: ${verb}\n\n` +
        `Mavzu: ${subject}\nRaqam: ${number}\n` +
        (reason ? `\nSabab: ${reason}\n` : '') +
        `\nHujjat sahifasi: ${link}`;
      const result = await this.messages.send(actorId, {
        recipientIds: [creatorId],
        subject: `[EDO ${number}] ${subject}`,
        body,
        importance: action === 'rejected' ? 'important' : 'normal',
      });
      this.gateway.notifyNewMessage([creatorId], result);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[EDO] creator notify failed:', e);
    }
  }

  /**
   * Ichki "xizmat xati" avtomatik zanjiri (mirzaxid) tugagach, barcha
   * kanselyariya rolidagi xodimlarni xabardor qiladi. Ular ijrochi
   * biriktirib, rezolyutsiya yozib xabar yubora oladi.
   */
  private async notifyChancelleryForResolution(
    actorId: string,
    docId: string,
    number: string,
    subject: string,
  ) {
    try {
      const staff = await this.prisma.user.findMany({
        where: { role: 'chancellery', isActive: true },
        select: { id: true },
      });
      const recipientIds = staff.map((u) => u.id).filter((rid) => rid !== actorId);
      if (recipientIds.length === 0) return;
      const link = `/edo/documents/${docId}`;
      const result = await this.messages.send(actorId, {
        recipientIds,
        subject: `[EDO ${number}] Ijro uchun: ${subject}`,
        body:
          `Xizmat xati imzo zanjiri yakunlandi. Ijrochi biriktiring.\n\n` +
          `Mavzu: ${subject}\nRaqam: ${number}\n\n` +
          `Hujjat sahifasi: ${link}`,
        importance: 'important',
      });
      this.gateway.notifyNewMessage(recipientIds, result);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[EDO] chancellery notify failed:', e);
    }
  }

  private async notifyExecutor(
    executorId: string,
    actorId: string,
    docId: string,
    number: string,
    subject: string,
    resolutionText: string,
  ) {
    if (executorId === actorId) return;
    if (!(await this.shouldNotify(executorId))) return;
    try {
      const link = `/edo/documents/${docId}`;
      const result = await this.messages.send(actorId, {
        recipientIds: [executorId],
        subject: `[EDO ${number}] Topshiriq: ${subject}`,
        body:
          `Sizga yangi topshiriq biriktirildi.\n\n` +
          `Mavzu: ${subject}\nRaqam: ${number}\n\n` +
          `Rezolyutsiya:\n${resolutionText}\n\n` +
          `Hujjat sahifasi: ${link}`,
        importance: 'important',
      });
      this.gateway.notifyNewMessage([executorId], result);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[EDO] executor notify failed:', e);
    }
  }

  private async notifyTaskDone(
    recipientId: string,
    actorId: string,
    docId: string,
    number: string,
    subject: string,
    note?: string,
  ) {
    if (recipientId === actorId) return;
    if (!(await this.shouldNotify(recipientId))) return;
    try {
      const link = `/edo/documents/${docId}`;
      const result = await this.messages.send(actorId, {
        recipientIds: [recipientId],
        subject: `[EDO ${number}] Topshiriq bajarildi: ${subject}`,
        body:
          `Topshiriq bajarildi.\n\n` +
          `Mavzu: ${subject}\nRaqam: ${number}\n` +
          (note ? `\nIzoh: ${note}\n` : '') +
          `\nHujjat sahifasi: ${link}`,
        importance: 'normal',
      });
      this.gateway.notifyNewMessage([recipientId], result);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[EDO] task-done notify failed:', e);
    }
  }

  /**
   * Hujjat muddatini uzaytirish
   * - Overdue statusni o'chirish (agar overdue bo'lsa)
   * - Deadline yangilash
   * - Approval chain davom etish
   * - Audit log yozish
   */
  async extendDeadline(userId: string, id: string, dto: { newDeadline: string; reason?: string }) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        deadline: true,
        status: true,
        createdById: true,
        currentHolderId: true,
      },
    });

    if (!doc) throw new NotFoundException('Hujjat topilmadi');

    // Muddatni uzaytirish imkoni: yaratuvchi yoki rahbar
    const isCreator = doc.createdById === userId;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const canManageAll = user?.role === 'admin' || user?.role === 'chancellery';

    if (!isCreator && !canManageAll) {
      throw new ForbiddenException('Faqat yaratuvchi yoki rahbar muddatni uzayta oladi');
    }

    const newDeadline = new Date(dto.newDeadline);
    const now = new Date();

    if (newDeadline < now) {
      throw new BadRequestException('Yangi muddati hozirgi vaqtdan keyin bo\'lishi shart');
    }

    // Muddatni yangilash va overdue statusini o'chirish
    await this.prisma.$transaction(async (tx) => {
      // Status overdue bo'lsa → in_review ga qaytarish
      const newStatus = doc.status === 'overdue' ? DocumentStatus.in_review : doc.status;

      await tx.document.update({
        where: { id },
        data: {
          deadline: newDeadline,
          status: newStatus,
          isOverdueApprovalRequired: false,
        },
      });

      // Komment qo'shamiz
      await tx.documentComment.create({
        data: {
          documentId: id,
          authorId: userId,
          text: `[Muddat uzaytirildi]\nYangi muddat: ${newDeadline.toLocaleString('uz-UZ')}\n${dto.reason ? `Sabab: ${dto.reason}` : ''}`,
        },
      });

      // Audit log
      await tx.documentAuditLog.create({
        data: {
          documentId: id,
          actorId: userId,
          action: 'extended_deadline',
          payload: { newDeadline, reason: dto.reason } as any,
        },
      });
    });

    return this.findOne(userId, id);
  }

  /**
   * Muddati o'tgan hujjatni director tasdiq berish
   * - Hujjat status: overdue → in_review
   * - Director ruxsatini qayd etish
   * - Normal tasdiqlash zanjirini davom ettirish
   */
  async approveOverdueDocument(userId: string, id: string, dto: { pin: string; notes?: string }) {
    await this.users.verifyApprovalPin(userId, dto.pin);

    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        deadline: true,
        isOverdueApprovalRequired: true,
        createdById: true,
      },
    });

    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    if (!doc.isOverdueApprovalRequired) {
      throw new BadRequestException('Bu hujjat muddati o\'tgan emas yoki allaqachon tasdiqlanib ketgan');
    }

    // Director tasdiqini qayd etib, status'ni in_review ga qaytaramiz
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id },
        data: {
          status: DocumentStatus.in_review,
          isOverdueApprovalRequired: false,
          overdueApprovedById: userId,
          overdueApprovedAt: new Date(),
        },
      });

      // Komment qo'shamiz
      await tx.documentComment.create({
        data: {
          documentId: id,
          authorId: userId,
          text: `[Director tasdiq - Muddati o'tgan] ${dto.notes || 'Ruxsat berildi'}`,
        },
      });

      // Audit log
      await tx.documentAuditLog.create({
        data: {
          documentId: id,
          actorId: userId,
          action: 'approved_overdue',
          payload: { notes: dto.notes } as any,
        },
      });
    });

    // Kommentda director qabuli qayd bo'lgan, alohida xabar jo'natmiz
    // (Overdue tasdiq — normal notifikatsiya emas, ko'rib chiquvchilar davom ettirsa o'zini biladi)

    return this.findOne(userId, id);
  }

  private serialize(d: any) {
    return d;
  }

  // ── QR TASDIQQA ──────────────────────────────────────────────────

  async approveDocumentWithQr(
    userId: string,
    documentId: string,
    participantId: string,
    qrCode: string,
  ) {
    // Ishtirok etayotgan participant tekshiring
    const participant = await this.prisma.documentParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant || participant.userId !== userId) {
      throw new ForbiddenException('Sizga bu hujjatni tasdiqlash huquqi yo\'q');
    }

    if (participant.documentId !== documentId) {
      throw new BadRequestException('Hujjat topilmadi');
    }

    return this.qrApproval.approveDocumentWithQr(documentId, participantId, qrCode);
  }

  async rejectDocumentWithQr(
    userId: string,
    documentId: string,
    participantId: string,
    qrCode: string,
    reason: string,
  ) {
    // Ishtirok etayotgan participant tekshiring
    const participant = await this.prisma.documentParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant || participant.userId !== userId) {
      throw new ForbiddenException('Sizga bu hujjatni rad etish huquqi yo\'q');
    }

    if (participant.documentId !== documentId) {
      throw new BadRequestException('Hujjat topilmadi');
    }

    return this.qrApproval.rejectDocumentWithQr(documentId, participantId, qrCode, reason);
  }
}
