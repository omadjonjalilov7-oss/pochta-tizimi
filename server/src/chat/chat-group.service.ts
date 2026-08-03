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
export class ChatGroupService {
  private readonly attDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.attDir =
      this.config.get<string>('ATTACHMENTS_DIR') ||
      'C:\\D\\pochta\\storage\\attachments';
  }

  // ── Guruh yaratish ─────────────────────────────────────────────────────
  async createGroup(userId: string, name: string, memberIds: string[]) {
    const cleanName = (name || '').trim();
    if (!cleanName) throw new BadRequestException('Guruh nomi kiritilishi kerak');

    // O'zidan tashqari, faol foydalanuvchilarni tekshiramiz
    const uniqueMembers = Array.from(new Set(memberIds.filter((id) => id !== userId)));
    if (uniqueMembers.length === 0) {
      throw new BadRequestException("Kamida bitta a'zo tanlanishi kerak");
    }
    const found = await this.prisma.user.findMany({
      where: { id: { in: uniqueMembers }, isActive: true },
      select: { id: true },
    });
    const validIds = found.map((u) => u.id);
    if (validIds.length === 0) {
      throw new BadRequestException("Yaroqli a'zolar topilmadi");
    }

    const group = await this.prisma.chatGroup.create({
      data: {
        name: cleanName,
        ownerId: userId,
        members: {
          create: [
            { userId, isAdmin: true },
            ...validIds.map((id) => ({ userId: id })),
          ],
        },
      },
      include: { members: { select: { userId: true } } },
    });

    return {
      groupId: group.id,
      memberIds: group.members.map((m) => m.userId),
    };
  }

  // ── Foydalanuvchi guruhlari (oxirgi xabar + o'qilmagan soni) ────────────
  async getGroups(userId: string) {
    const memberships = await this.prisma.chatGroupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
    });

    const result: any[] = [];
    for (const mem of memberships) {
      const last = await this.prisma.chatGroupMessage.findFirst({
        where: { groupId: mem.groupId },
        orderBy: { sentAt: 'desc' },
        include: {
          attachments: { select: { filename: true } },
          fromUser: { select: { id: true, fullName: true } },
        },
      });
      const unread = await this.prisma.chatGroupMessage.count({
        where: {
          groupId: mem.groupId,
          fromUserId: { not: userId },
          ...(mem.lastReadAt ? { sentAt: { gt: mem.lastReadAt } } : {}),
        },
      });
      result.push({
        group: {
          id: mem.group.id,
          name: mem.group.name,
          avatarPath: mem.group.avatarPath,
          memberCount: mem.group._count.members,
          isAdmin: mem.isAdmin,
        },
        lastMessage: last
          ? {
              id: last.id,
              fromUserId: last.fromUserId,
              fromName: last.fromUser.fullName,
              body: last.deletedForAll ? '' : last.body,
              deleted: last.deletedForAll,
              sentAt: last.sentAt,
              attachments: last.attachments.map((a) => ({ filename: a.filename })),
            }
          : null,
        unread,
      });
    }

    result.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : 0;
      return tb - ta;
    });
    return result;
  }

  // ── Guruh ma'lumoti (a'zolar) ──────────────────────────────────────────
  async getGroupInfo(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    const group = await this.prisma.chatGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarPath: true,
                position: { select: { name: true } },
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    return {
      id: group.id,
      name: group.name,
      avatarPath: group.avatarPath,
      ownerId: group.ownerId,
      members: group.members.map((m) => ({
        id: m.user.id,
        fullName: m.user.fullName,
        avatarPath: m.user.avatarPath,
        position: m.user.position,
        isAdmin: m.isAdmin,
      })),
    };
  }

  // ── Guruh xabarlari ────────────────────────────────────────────────────
  async getMessages(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    const msgs = await this.prisma.chatGroupMessage.findMany({
      where: { groupId },
      orderBy: { sentAt: 'asc' },
      include: {
        attachments: true,
        fromUser: { select: { id: true, fullName: true, avatarPath: true } },
      },
    });
    return msgs.map((m) => this.serializeMsg(m));
  }

  // ── Guruhga xabar yuborish ─────────────────────────────────────────────
  async sendMessage(
    userId: string,
    groupId: string,
    body: string,
    file?: Express.Multer.File,
  ) {
    await this.assertMember(userId, groupId);
    if (!body?.trim() && !file) {
      throw new BadRequestException("Xabar matni yoki fayl bo'lishi kerak");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.chatGroupMessage.create({
        data: { groupId, fromUserId: userId, body: body?.trim() || '' },
      });
      if (file) {
        if (file.size > CHAT_MAX_BYTES) {
          throw new BadRequestException("Fayl 50 MB dan katta bo'lmasligi kerak");
        }
        const grpOriginalName = decodeMulterFilename(file.originalname);
        const ext = path.extname(grpOriginalName).toLowerCase();
        if (FORBIDDEN_EXTS.includes(ext)) {
          throw new BadRequestException(`'${ext}' kengaytmali fayllar taqiqlangan`);
        }
        const now = new Date();
        const subDir = path.join(
          'chat-groups',
          String(now.getFullYear()),
          String(now.getMonth() + 1).padStart(2, '0'),
        );
        const fullDir = path.join(this.attDir, subDir);
        await fs.mkdir(fullDir, { recursive: true });
        const attId = uuid();
        const storedFilename = `${attId}${ext}`;
        await fs.writeFile(path.join(fullDir, storedFilename), file.buffer);
        await tx.chatGroupAttachment.create({
          data: {
            messageId: msg.id,
            filename: grpOriginalName,
            storedPath: path.join(subDir, storedFilename),
            sizeBytes: BigInt(file.size),
            mimeType: file.mimetype,
          },
        });
      }
      // Yuboruvchi uchun o'qilgan deb belgilaymiz
      await tx.chatGroupMember.updateMany({
        where: { groupId, userId },
        data: { lastReadAt: new Date() },
      });
      return tx.chatGroupMessage.findUniqueOrThrow({
        where: { id: msg.id },
        include: {
          attachments: true,
          fromUser: { select: { id: true, fullName: true, avatarPath: true } },
        },
      });
    });

    return this.serializeMsg(created);
  }

  // ── O'qilgan deb belgilash ─────────────────────────────────────────────
  async markRead(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    await this.prisma.chatGroupMember.updateMany({
      where: { groupId, userId },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  // ── Xabarni tahrirlash (faqat yuboruvchi) ─────────────────────────────
  async editMessage(userId: string, msgId: string, body: string) {
    const msg = await this.prisma.chatGroupMessage.findUnique({
      where: { id: msgId },
    });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    if (msg.fromUserId !== userId) {
      throw new ForbiddenException("Faqat o'z xabaringizni tahrirlashingiz mumkin");
    }
    if (msg.deletedForAll) {
      throw new BadRequestException("O'chirilgan xabarni tahrirlab bo'lmaydi");
    }
    if (!body?.trim()) {
      throw new BadRequestException("Xabar matni bo'sh bo'lishi mumkin emas");
    }
    const updated = await this.prisma.chatGroupMessage.update({
      where: { id: msgId },
      data: { body: body.trim(), editedAt: new Date() },
      include: {
        attachments: true,
        fromUser: { select: { id: true, fullName: true, avatarPath: true } },
      },
    });
    return this.serializeMsg(updated);
  }

  // ── Xabarni o'chirish (hamma uchun — yuboruvchi yoki admin) ────────────
  async deleteMessage(userId: string, msgId: string) {
    const msg = await this.prisma.chatGroupMessage.findUnique({
      where: { id: msgId },
      include: { attachments: true },
    });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    const membership = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId: msg.groupId, userId } },
    });
    if (!membership) throw new ForbiddenException("Siz bu guruh a'zosi emassiz");
    if (msg.fromUserId !== userId && !membership.isAdmin) {
      throw new ForbiddenException(
        "Xabarni faqat yuborgan a'zo yoki admin o'chira oladi",
      );
    }
    for (const a of msg.attachments) {
      await fs
        .unlink(path.join(this.attDir, a.storedPath))
        .catch(() => undefined);
    }
    await this.prisma.chatGroupAttachment.deleteMany({
      where: { messageId: msgId },
    });
    await this.prisma.chatGroupMessage.update({
      where: { id: msgId },
      data: { body: '', deletedForAll: true },
    });
    return { ok: true, groupId: msg.groupId };
  }

  // ── A'zo qo'shish (admin) ──────────────────────────────────────────────
  async addMembers(userId: string, groupId: string, memberIds: string[]) {
    const membership = await this.assertMember(userId, groupId);
    if (!membership.isAdmin) {
      throw new ForbiddenException("Faqat admin a'zo qo'sha oladi");
    }
    const existing = await this.prisma.chatGroupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const have = new Set(existing.map((m) => m.userId));
    const toAdd = Array.from(new Set(memberIds)).filter((id) => !have.has(id));
    const valid = await this.prisma.user.findMany({
      where: { id: { in: toAdd }, isActive: true },
      select: { id: true },
    });
    if (valid.length > 0) {
      await this.prisma.chatGroupMember.createMany({
        data: valid.map((u) => ({ groupId, userId: u.id })),
        skipDuplicates: true,
      });
    }
    return this.memberIdsOf(groupId);
  }

  // ── A'zoni chiqarish (admin) ───────────────────────────────────────────
  async removeMember(userId: string, groupId: string, targetId: string) {
    const membership = await this.assertMember(userId, groupId);
    if (!membership.isAdmin) {
      throw new ForbiddenException("Faqat admin a'zoni chiqara oladi");
    }
    const group = await this.prisma.chatGroup.findUnique({
      where: { id: groupId },
      select: { ownerId: true },
    });
    if (group?.ownerId === targetId) {
      throw new BadRequestException("Guruh egasini chiqarib bo'lmaydi");
    }
    const before = await this.memberIdsOf(groupId);
    await this.prisma.chatGroupMember.deleteMany({
      where: { groupId, userId: targetId },
    });
    return { memberIds: before.memberIds, removedId: targetId };
  }

  // ── Guruhdan chiqish ───────────────────────────────────────────────────
  async leaveGroup(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    const group = await this.prisma.chatGroup.findUnique({
      where: { id: groupId },
      select: { ownerId: true },
    });
    if (group?.ownerId === userId) {
      // Egasi chiqsa — guruh o'chiriladi
      await this.prisma.chatGroup.delete({ where: { id: groupId } });
      return { ok: true, deleted: true };
    }
    await this.prisma.chatGroupMember.deleteMany({
      where: { groupId, userId },
    });
    return { ok: true, deleted: false };
  }

  // ── Guruh nomini o'zgartirish (admin) ──────────────────────────────────
  async renameGroup(userId: string, groupId: string, name: string) {
    const membership = await this.assertMember(userId, groupId);
    if (!membership.isAdmin) {
      throw new ForbiddenException("Faqat admin nomni o'zgartira oladi");
    }
    const clean = (name || '').trim();
    if (!clean) throw new BadRequestException('Guruh nomi kiritilishi kerak');
    await this.prisma.chatGroup.update({
      where: { id: groupId },
      data: { name: clean },
    });
    return { ok: true, name: clean };
  }

  // ── Fayl yuklab olish ──────────────────────────────────────────────────
  async downloadAttachment(userId: string, attId: string) {
    const att = await this.prisma.chatGroupAttachment.findUnique({
      where: { id: attId },
      include: { message: { select: { groupId: true } } },
    });
    if (!att) throw new NotFoundException('Fayl topilmadi');
    await this.assertMember(userId, att.message.groupId);
    return {
      fullPath: path.join(this.attDir, att.storedPath),
      filename: att.filename,
      mimeType: att.mimeType,
      sizeBytes: Number(att.sizeBytes),
    };
  }

  // ── Barcha guruhlardagi jami o'qilmagan xabarlar ───────────────────────
  async totalUnread(userId: string) {
    const memberships = await this.prisma.chatGroupMember.findMany({
      where: { userId },
      select: { groupId: true, lastReadAt: true },
    });
    let count = 0;
    for (const m of memberships) {
      count += await this.prisma.chatGroupMessage.count({
        where: {
          groupId: m.groupId,
          fromUserId: { not: userId },
          ...(m.lastReadAt ? { sentAt: { gt: m.lastReadAt } } : {}),
        },
      });
    }
    return count;
  }

  // ── Yordamchilar ───────────────────────────────────────────────────────
  async memberIdsOf(groupId: string) {
    const members = await this.prisma.chatGroupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    return { memberIds: members.map((m) => m.userId) };
  }

  private async assertMember(userId: string, groupId: string) {
    const membership = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) throw new ForbiddenException("Siz bu guruh a'zosi emassiz");
    return membership;
  }

  private serializeMsg(m: any) {
    return {
      id: m.id,
      groupId: m.groupId,
      fromUserId: m.fromUserId,
      fromName: m.fromUser?.fullName ?? '',
      fromAvatar: m.fromUser?.avatarPath ?? null,
      body: m.body,
      sentAt: m.sentAt,
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
