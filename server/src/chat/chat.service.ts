import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { decodeMulterFilename } from '../common/filename';
import { v4 as uuid } from 'uuid';

const CHAT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const FORBIDDEN_EXTS = ['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.scr', '.msi'];

@Injectable()
export class ChatService {
  private readonly attDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.attDir =
      this.config.get<string>('ATTACHMENTS_DIR') ||
      'C:\\D\\pochta\\storage\\attachments';
  }

  // ── Barcha faol foydalanuvchilar ro'yxati (o'zidan tashqari) ──────────
  async getContacts(userId: string) {
    return this.prisma.user.findMany({
      where: { isActive: true, NOT: { id: userId } },
      select: {
        id: true,
        fullName: true,
        login: true,
        avatarPath: true,
        lastSeenAt: true,
        position: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  // ── Suhbatlar ro'yxati (oxirgi xabar + o'qilmagan soni) ───────────────
  async getConversations(userId: string) {
    // Barcha ulashgan foydalanuvchilarni topamiz
    const partners = await this.prisma.$queryRaw<{ partner_id: string }[]>`
      SELECT DISTINCT
        CASE WHEN from_user_id = ${userId}::uuid THEN to_user_id
             ELSE from_user_id END AS partner_id
      FROM chat_messages
      WHERE from_user_id = ${userId}::uuid OR to_user_id = ${userId}::uuid
    `;

    const result: Array<{ partner: any; lastMessage: any; unread: number }> = [];
    for (const { partner_id } of partners) {
      const last = await this.prisma.chatMessage.findFirst({
        where: {
          OR: [
            { fromUserId: userId, toUserId: partner_id, deletedForFrom: false },
            { fromUserId: partner_id, toUserId: userId, deletedForTo: false },
          ],
        },
        orderBy: { sentAt: 'desc' },
        include: { attachments: { select: { filename: true } } },
      });
      const unread = await this.prisma.chatMessage.count({
        where: {
          fromUserId: partner_id,
          toUserId: userId,
          readAt: null,
          deletedForTo: false,
        },
      });
      const partner = await this.prisma.user.findUnique({
        where: { id: partner_id },
        select: {
          id: true,
          fullName: true,
          login: true,
          avatarPath: true,
          lastSeenAt: true,
          position: { select: { name: true } },
          department: { select: { name: true } },
        },
      });
      if (!partner || !last) continue;
      result.push({ partner, lastMessage: this.serializeMsg(last), unread });
    }
    // Oxirgi xabar vaqti bo'yicha tartiblash
    result.sort(
      (a, b) =>
        new Date(b.lastMessage.sentAt).getTime() -
        new Date(a.lastMessage.sentAt).getTime(),
    );
    return result;
  }

  // ── Ikki foydalanuvchi o'rtasidagi barcha xabarlar ───────────────────
  async getMessages(userId: string, partnerId: string) {
    const msgs = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: partnerId, deletedForFrom: false },
          { fromUserId: partnerId, toUserId: userId, deletedForTo: false },
        ],
      },
      orderBy: { sentAt: 'asc' },
      include: { attachments: true },
    });
    return msgs.map((m) => this.serializeMsg(m));
  }

  // ── Xabar yuborish ─────────────────────────────────────────────────────
  async sendMessage(
    userId: string,
    toUserId: string,
    body: string,
    file?: Express.Multer.File,
  ) {
    if (userId === toUserId) {
      throw new BadRequestException("O'zingizga xabar yubora olmaysiz");
    }
    const recipient = await this.prisma.user.findUnique({
      where: { id: toUserId },
      select: { isActive: true },
    });
    if (!recipient?.isActive) {
      throw new BadRequestException('Foydalanuvchi topilmadi yoki bloklangan');
    }
    if (!body?.trim() && !file) {
      throw new BadRequestException("Xabar matni yoki fayl bo'lishi kerak");
    }

    const msg = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          fromUserId: userId,
          toUserId,
          body: body?.trim() || '',
        },
        include: { attachments: true },
      });

      if (file) {
        if (file.size > CHAT_MAX_BYTES) {
          throw new BadRequestException('Fayl 50 MB dan katta bo\'lmasligi kerak');
        }
        const chatOriginalName = decodeMulterFilename(file.originalname);
        const ext = path.extname(chatOriginalName).toLowerCase();
        if (FORBIDDEN_EXTS.includes(ext)) {
          throw new BadRequestException(`'${ext}' kengaytmali fayllar taqiqlangan`);
        }
        const now = new Date();
        const subDir = path.join(
          'chat',
          String(now.getFullYear()),
          String(now.getMonth() + 1).padStart(2, '0'),
        );
        const fullDir = path.join(this.attDir, subDir);
        await fs.mkdir(fullDir, { recursive: true });
        const attId = uuid();
        const storedFilename = `${attId}${ext}`;
        const relativePath = path.join(subDir, storedFilename);
        await fs.writeFile(path.join(fullDir, storedFilename), file.buffer);
        await tx.chatAttachment.create({
          data: {
            messageId: created.id,
            filename: chatOriginalName,
            storedPath: relativePath,
            sizeBytes: BigInt(file.size),
            mimeType: file.mimetype,
          },
        });
        // Faylni qayta o'qib attachments bilan birga qaytaramiz
        return tx.chatMessage.findUniqueOrThrow({
          where: { id: created.id },
          include: { attachments: true },
        });
      }
      return created;
    });

    return this.serializeMsg(msg);
  }

  // ── O'qilgan deb belgilash ─────────────────────────────────────────────
  async markRead(userId: string, partnerId: string) {
    const now = new Date();
    await this.prisma.chatMessage.updateMany({
      where: { fromUserId: partnerId, toUserId: userId, readAt: null },
      data: { readAt: now },
    });
    return { ok: true };
  }

  // ── Jami o'qilmagan xabarlar soni ─────────────────────────────────────
  async unreadCount(userId: string) {
    const count = await this.prisma.chatMessage.count({
      where: { toUserId: userId, readAt: null },
    });
    return { count };
  }

  // ── Xabarni tahrirlash (faqat yuboruvchi) ─────────────────────────────
  async editMessage(userId: string, msgId: string, body: string) {
    const msg = await this.prisma.chatMessage.findUnique({
      where: { id: msgId },
    });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    if (msg.fromUserId !== userId) {
      throw new ForbiddenException("Faqat o'zingiz yuborgan xabarni tahrirlashingiz mumkin");
    }
    if (msg.deletedForAll) {
      throw new BadRequestException("O'chirilgan xabarni tahrirlab bo'lmaydi");
    }
    if (!body?.trim()) {
      throw new BadRequestException("Xabar matni bo'sh bo'lishi mumkin emas");
    }
    const updated = await this.prisma.chatMessage.update({
      where: { id: msgId },
      data: { body: body.trim(), editedAt: new Date() },
      include: { attachments: true },
    });
    return this.serializeMsg(updated);
  }

  // ── Xabarni o'chirish ─────────────────────────────────────────────────
  //  scope='me'  → faqat o'zidan yashirish
  //  scope='all' → hamma uchun o'chirish (faqat yuboruvchi)
  async deleteMessage(
    userId: string,
    msgId: string,
    scope: 'me' | 'all',
  ) {
    const msg = await this.prisma.chatMessage.findUnique({
      where: { id: msgId },
      include: { attachments: true },
    });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    const isFrom = msg.fromUserId === userId;
    const isTo = msg.toUserId === userId;
    if (!isFrom && !isTo) {
      throw new ForbiddenException("Sizda bu xabarni o'chirish huquqi yo'q");
    }

    if (scope === 'all') {
      if (!isFrom) {
        throw new ForbiddenException(
          "Hamma uchun o'chirishni faqat xabarni yuborgan xodim qila oladi",
        );
      }
      // Fayllarni diskdan va bazadan o'chiramiz
      for (const a of msg.attachments) {
        await fs
          .unlink(path.join(this.attDir, a.storedPath))
          .catch(() => undefined);
      }
      await this.prisma.chatAttachment.deleteMany({
        where: { messageId: msgId },
      });
      await this.prisma.chatMessage.update({
        where: { id: msgId },
        data: {
          body: '',
          deletedForAll: true,
          deletedForFrom: true,
          deletedForTo: true,
        },
      });
      return { ok: true, scope, partnerId: msg.toUserId, fromUserId: msg.fromUserId };
    }

    // scope === 'me'
    await this.prisma.chatMessage.update({
      where: { id: msgId },
      data: isFrom ? { deletedForFrom: true } : { deletedForTo: true },
    });
    return { ok: true, scope, partnerId: isFrom ? msg.toUserId : msg.fromUserId };
  }

  // ── Fayl yuklash ──────────────────────────────────────────────────────
  async downloadAttachment(userId: string, attId: string) {
    const att = await this.prisma.chatAttachment.findUnique({
      where: { id: attId },
      include: { message: true },
    });
    if (!att) throw new NotFoundException('Fayl topilmadi');
    if (att.message.fromUserId !== userId && att.message.toUserId !== userId) {
      throw new ForbiddenException("Sizda bu faylga kirish huquqi yo'q");
    }
    return {
      fullPath: path.join(this.attDir, att.storedPath),
      filename: att.filename,
      mimeType: att.mimeType,
      sizeBytes: Number(att.sizeBytes),
    };
  }

  private serializeMsg(m: any) {
    return {
      id: m.id,
      fromUserId: m.fromUserId,
      toUserId: m.toUserId,
      body: m.body,
      sentAt: m.sentAt,
      readAt: m.readAt ?? null,
      editedAt: m.editedAt ?? null,
      deleted: !!m.deletedForAll,
      attachments: (m.attachments || []).map((a: any) => ({
        id: a.id,
        filename: a.filename,
        sizeBytes: Number(a.sizeBytes),
        mimeType: a.mimeType,
      })),
    };
  }
}
