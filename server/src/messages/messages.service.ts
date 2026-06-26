import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { MessageFolder, RecipientKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ImapPollService } from '../external-mail/imap-poll.service';
import { SmtpSendService } from '../external-mail/smtp-send.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ImapPollService))
    private readonly imapPoll: ImapPollService,
    @Inject(forwardRef(() => SmtpSendService))
    private readonly smtpSend: SmtpSendService,
  ) {}

  async send(fromUserId: string, dto: SendMessageDto) {
    const toIds = Array.from(new Set(dto.recipientIds || []));
    const ccIds = Array.from(new Set(dto.ccRecipientIds || [])).filter(
      (id) => !toIds.includes(id),
    );

    const allIds = [...toIds, ...ccIds];
    const activeRecipients =
      allIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: allIds }, isActive: true },
            select: { id: true },
          })
        : [];
    const activeIdSet = new Set(activeRecipients.map((u) => u.id));
    const activeTo = toIds.filter((id) => activeIdSet.has(id));
    const activeCc = ccIds.filter((id) => activeIdSet.has(id));

    // Tashqi email qabul qiluvchilarni normallashtiramiz
    const externalTo = Array.from(
      new Set((dto.externalToEmails || []).map((e) => e.trim().toLowerCase()).filter(Boolean)),
    );
    const externalCc = Array.from(
      new Set((dto.externalCcEmails || []).map((e) => e.trim().toLowerCase()).filter(Boolean)),
    ).filter((e) => !externalTo.includes(e));

    if (activeTo.length === 0 && externalTo.length === 0) {
      throw new BadRequestException('Hech qanday qabul qiluvchi tanlanmagan');
    }

    // Agar tashqi qabul qiluvchilar bo'lsa — yuboruvchining tashqi pochtasi ulanganligini tekshiramiz
    if (externalTo.length > 0 || externalCc.length > 0) {
      const sender = await this.prisma.user.findUnique({
        where: { id: fromUserId },
        select: { externalMailEnabled: true, fullName: true },
      });
      if (!sender?.externalMailEnabled) {
        throw new BadRequestException(
          'Tashqi email manzillariga yuborish uchun Profil sahifasidan @asaka-motors.uz pochtangizni ulang',
        );
      }
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          fromUserId,
          subject: dto.subject,
          body: dto.body,
          importance: dto.importance ?? 'normal',
          isExternal: false, // ichki tomondan yuborilgan, lekin externalToEmails ham bo'lishi mumkin
          externalToEmails: externalTo,
          externalCcEmails: externalCc,
        },
      });

      const recipientRows: {
        messageId: string;
        userId: string;
        folder: MessageFolder;
        kind: RecipientKind;
      }[] = [
        ...activeTo.map((id) => ({
          messageId: created.id,
          userId: id,
          folder: MessageFolder.inbox,
          kind: RecipientKind.to,
        })),
        ...activeCc.map((id) => ({
          messageId: created.id,
          userId: id,
          folder: MessageFolder.inbox,
          kind: RecipientKind.cc,
        })),
        {
          messageId: created.id,
          userId: fromUserId,
          folder: MessageFolder.sent,
          kind: RecipientKind.to,
        },
      ];

      await tx.messageRecipient.createMany({ data: recipientRows, skipDuplicates: true });

      if (dto.attachmentIds?.length) {
        await tx.attachment.updateMany({
          where: { id: { in: dto.attachmentIds }, messageId: null as any },
          data: { messageId: created.id },
        });
      }

      return created;
    });

    // Tashqi qabul qiluvchilarga SMTP orqali yuboramiz (fire-and-forget)
    if (externalTo.length > 0 || externalCc.length > 0) {
      const sender = await this.prisma.user.findUnique({
        where: { id: fromUserId },
        select: { fullName: true },
      });
      const attachments = dto.attachmentIds?.length
        ? await this.prisma.attachment.findMany({
            where: { id: { in: dto.attachmentIds } },
            select: { filename: true, storedPath: true },
          })
        : [];

      // SMTP yuborishni xato bo'lsa ham yuborilgan deb belgilaymiz — UI'da xatolik ko'rinadi
      this.smtpSend
        .sendExternal({
          fromUserId,
          fromUserFullName: sender?.fullName || 'Pochta',
          toEmails: externalTo,
          ccEmails: externalCc,
          subject: dto.subject,
          bodyHtml: this.bodyToHtml(dto.body),
          bodyText: dto.body,
          signatureHtml: dto.signature || '', // Imzo alohida
          messageId: message.id,
          attachments: attachments.map((a) => ({ filename: a.filename, path: a.storedPath })),
        })
        .then((result) => {
          if (!result.ok) {
            // SMTP xato — log qilamiz (UI'ga ham kelajakda WebSocket orqali yuboramiz)
            // eslint-disable-next-line no-console
            console.error(`[SMTP] xato xabar ${message.id}:`, result.error);
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(`[SMTP] kutilmagan xato xabar ${message.id}:`, err);
        });
    }

    return this.findOne(fromUserId, message.id);
  }

  private bodyToHtml(plain: string): string {
    // Ichki foydalanuvchi yozgan oddiy matn — HTML'ga aylantiramiz
    const escaped = plain
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;white-space:pre-wrap">${escaped}</div>`;
  }

  async list(userId: string, folder: MessageFolder, search?: string) {
    const items = await this.prisma.messageRecipient.findMany({
      where: {
        userId,
        folder,
        deletedAt: null,
        ...(search
          ? {
              message: {
                OR: [
                  { subject: { contains: search, mode: 'insensitive' } },
                  { body: { contains: search, mode: 'insensitive' } },
                  { fromUser: { fullName: { contains: search, mode: 'insensitive' } } },
                  { fromUser: { login: { contains: search, mode: 'insensitive' } } },
                  { externalFromName: { contains: search, mode: 'insensitive' } },
                  { externalFromEmail: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        message: {
          include: {
            fromUser: {
              select: {
                id: true,
                fullName: true,
                login: true,
                avatarPath: true,
                position: { select: { name: true, rank: true } },
                department: { select: { name: true } },
              },
            },
            attachments: { select: { id: true, filename: true, sizeBytes: true } },
            _count: { select: { recipients: true } },
          },
        },
      },
      orderBy: { message: { sentAt: 'desc' } },
      take: 200,
    });

    return items.map((it) => ({
      id: it.id,
      messageId: it.messageId,
      folder: it.folder,
      isRead: it.isRead,
      readAt: it.readAt,
      isStarred: it.isStarred,
      message: it.message,
    }));
  }

  async findOne(userId: string, messageId: string) {
    const recipient = await this.prisma.messageRecipient.findFirst({
      where: { messageId, userId, deletedAt: null },
      include: {
        message: {
          include: {
            fromUser: {
              select: {
                id: true,
                fullName: true,
                login: true,
                avatarPath: true,
                position: { select: { name: true, rank: true } },
                department: { select: { name: true } },
              },
            },
            attachments: true,
            recipients: {
              where: { folder: MessageFolder.inbox },
              select: {
                kind: true,
                user: { select: { id: true, fullName: true, login: true } },
              },
            },
            externalReceipts: {
              select: {
                email: true,
                readAt: true,
              },
            },
          },
        },
      },
    });
    if (!recipient) throw new NotFoundException('Xabar topilmadi');
    return recipient;
  }

  async markRead(userId: string, messageId: string) {
    const r = await this.prisma.messageRecipient.findFirst({
      where: { messageId, userId, folder: MessageFolder.inbox },
      include: {
        message: {
          select: { isExternal: true, externalImapUid: true },
        },
      },
    });
    if (!r) throw new NotFoundException('Xabar topilmadi');
    if (r.isRead) return r;

    const now = new Date();
    const updated = await this.prisma.messageRecipient.update({
      where: { id: r.id },
      data: { isRead: true, readAt: now },
    });

    // Xabar o'qish jurnalini yozib qo'yamiz (UI orqali o'qish)
    this.prisma.messageReadLog
      .upsert({
        where: {
          messageId_userId_readAt: { messageId, userId, readAt: now },
        },
        create: {
          messageId,
          userId,
          readAt: now,
          readMethod: 'opened', // UI orqali o'qildi
        },
        update: {
          readMethod: 'opened',
        },
      })
      .catch(() => undefined); // Jurnal xatosi asosiy operatsiyani to'xtatmasin

    // Agar tashqi pochta xabari bo'lsa — IMAP serverda ham \Seen flagini qo'yamiz
    if (r.message.isExternal && r.message.externalImapUid) {
      // Fire-and-forget — markRead javobini sekinlashtirmasin
      this.imapPoll
        .markSeenOnImap(userId, r.message.externalImapUid)
        .catch(() => undefined);
    }

    return updated;
  }

  async toggleStar(userId: string, messageId: string) {
    const r = await this.prisma.messageRecipient.findFirst({
      where: { messageId, userId, deletedAt: null },
    });
    if (!r) throw new NotFoundException('Xabar topilmadi');
    return this.prisma.messageRecipient.update({
      where: { id: r.id },
      data: { isStarred: !r.isStarred },
    });
  }

  async moveToFolder(userId: string, messageId: string, folder: MessageFolder) {
    const r = await this.prisma.messageRecipient.findFirst({
      where: { messageId, userId },
    });
    if (!r) throw new NotFoundException('Xabar topilmadi');
    if (folder === MessageFolder.sent && r.folder !== MessageFolder.sent) {
      throw new ForbiddenException('Bu xabarni "Yuborilgan" papkasiga ko\'chirib bo\'lmaydi');
    }
    return this.prisma.messageRecipient.update({
      where: { id: r.id },
      data: { folder, deletedAt: folder === MessageFolder.trash ? new Date() : null },
    });
  }

  async recall(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, fromUserId: true, subject: true, recalledAt: true },
    });
    if (!message) throw new NotFoundException('Xabar topilmadi');
    if (message.fromUserId !== userId) {
      throw new ForbiddenException('Faqat yuboruvchi xabarni qaytarib ola oladi');
    }
    if (message.recalledAt) {
      throw new BadRequestException('Xabar allaqachon qaytarib olingan');
    }

    const inboxRecipients = await this.prisma.messageRecipient.findMany({
      where: { messageId, folder: MessageFolder.inbox },
      select: { userId: true, isRead: true },
    });
    const unreadUserIds = inboxRecipients.filter((r) => !r.isRead).map((r) => r.userId);
    const readUserIds = inboxRecipients.filter((r) => r.isRead).map((r) => r.userId);

    await this.prisma.$transaction(async (tx) => {
      // Hali ochmaganlardan o'chiramiz
      if (unreadUserIds.length > 0) {
        await tx.messageRecipient.deleteMany({
          where: { messageId, userId: { in: unreadUserIds }, folder: MessageFolder.inbox },
        });
      }
      // Xabar va yuboruvchining "Sent" papkasidagi nusxasi bazada qoladi — statusi belgilanadi
      await tx.message.update({
        where: { id: messageId },
        data: { recalledAt: new Date() },
      });
    });

    return {
      recalledFrom: unreadUserIds,
      keptFor: readUserIds,
      subject: message.subject,
    };
  }

  async getReadStatus(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        fromUserId: true,
        externalToEmails: true,
        externalCcEmails: true,
      },
    });
    if (!message) throw new NotFoundException('Xabar topilmadi');
    if (message.fromUserId !== userId) {
      throw new ForbiddenException("Faqat yuboruvchi qabul qiluvchilar holatini ko'ra oladi");
    }

    const recipients = await this.prisma.messageRecipient.findMany({
      where: { messageId, folder: MessageFolder.inbox },
      select: {
        kind: true,
        isRead: true,
        readAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            login: true,
            avatarPath: true,
            position: { select: { name: true } },
          },
        },
      },
      orderBy: [{ isRead: 'desc' }, { readAt: 'desc' }],
    });

    // Tashqi qabul qiluvchilar — yuborilgan manzillar + tracking receipts
    const externalReceipts = await this.prisma.externalReadReceipt.findMany({
      where: { messageId },
      select: { email: true, readAt: true, readMethod: true, createdAt: true },
    });

    // Read receipts xarita: email → {readAt, readMethod}
    const receiptMap = new Map<string, { readAt: Date | null; readMethod: string | null }>();
    for (const r of externalReceipts) {
      receiptMap.set(r.email.toLowerCase(), { readAt: r.readAt, readMethod: r.readMethod });
    }

    // Yuborilgan tashqi manzillar + ularning read receipts holati
    const externalTo = (message.externalToEmails || [])
      .map((email) => {
        const receipt = receiptMap.get(email.toLowerCase());
        return {
          email,
          kind: 'to' as const,
          isRead: !!receipt?.readAt,
          readAt: receipt?.readAt || null,
          readMethod: receipt?.readMethod || null,
        };
      })
      .sort((a, b) => {
        // O'qilganlar oldinroq, keyin oxirgi o'qilgan vaqt bo'yicha
        if (a.isRead !== b.isRead) return b.isRead ? 1 : -1;
        return (b.readAt?.getTime() || 0) - (a.readAt?.getTime() || 0);
      });

    const externalCc = (message.externalCcEmails || [])
      .map((email) => {
        const receipt = receiptMap.get(email.toLowerCase());
        return {
          email,
          kind: 'cc' as const,
          isRead: !!receipt?.readAt,
          readAt: receipt?.readAt || null,
          readMethod: receipt?.readMethod || null,
        };
      })
      .sort((a, b) => {
        if (a.isRead !== b.isRead) return b.isRead ? 1 : -1;
        return (b.readAt?.getTime() || 0) - (a.readAt?.getTime() || 0);
      });

    const externalRecipients = [...externalTo, ...externalCc];

    // Jami va o'qilgan hisob
    const totalAll = recipients.length + externalRecipients.length;
    const readAll =
      recipients.filter((r) => r.isRead).length +
      externalRecipients.filter((r) => r.isRead).length;

    return {
      total: totalAll,
      readCount: readAll,
      recipients,
      externalRecipients,
    };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.messageRecipient.count({
      where: { userId, folder: MessageFolder.inbox, isRead: false, deletedAt: null },
    });
    return { count };
  }

  /**
   * Xabar o'qish jurnalini olish — kim va soat nechchida o'qili?
   * Faqat xabar yuboruvchi (sender) ko'ra oladi
   */
  async getReadLogs(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, fromUserId: true },
    });
    if (!message) throw new NotFoundException('Xabar topilmadi');
    if (message.fromUserId !== userId) {
      throw new ForbiddenException('Faqat yuboruvchi jurnalni ko\'ra oladi');
    }

    // Barcha read log yozuvlari
    const logs = await this.prisma.messageReadLog.findMany({
      where: { messageId },
      select: {
        id: true,
        userId: true,
        readAt: true,
        readMethod: true,
        readIp: true,
        readUserAgent: true,
        user: {
          select: {
            id: true,
            fullName: true,
            login: true,
            email: true,
            avatarPath: true,
            position: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { readAt: 'desc' },
    });

    return {
      messageId,
      totalReads: logs.length,
      logs: logs.map((log) => ({
        id: log.id,
        user: log.user,
        readAt: log.readAt,
        readMethod: log.readMethod,
        ip: log.readIp,
        userAgent: log.readUserAgent,
      })),
    };
  }
}
