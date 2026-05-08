import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageFolder, RecipientKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async send(fromUserId: string, dto: SendMessageDto) {
    const toIds = Array.from(new Set(dto.recipientIds));
    const ccIds = Array.from(new Set(dto.ccRecipientIds || [])).filter(
      (id) => !toIds.includes(id),
    );

    const allIds = [...toIds, ...ccIds];
    const activeRecipients = await this.prisma.user.findMany({
      where: { id: { in: allIds }, isActive: true },
      select: { id: true },
    });
    const activeIdSet = new Set(activeRecipients.map((u) => u.id));
    const activeTo = toIds.filter((id) => activeIdSet.has(id));
    const activeCc = ccIds.filter((id) => activeIdSet.has(id));

    if (activeTo.length === 0) {
      throw new BadRequestException('Hech qanday faol qabul qiluvchi topilmadi');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          fromUserId,
          subject: dto.subject,
          body: dto.body,
          importance: dto.importance ?? 'normal',
          isExternal: false,
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

    return this.findOne(fromUserId, message.id);
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
    });
    if (!r) throw new NotFoundException('Xabar topilmadi');
    if (r.isRead) return r;

    return this.prisma.messageRecipient.update({
      where: { id: r.id },
      data: { isRead: true, readAt: new Date() },
    });
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

  async unreadCount(userId: string) {
    const count = await this.prisma.messageRecipient.count({
      where: { userId, folder: MessageFolder.inbox, isRead: false, deletedAt: null },
    });
    return { count };
  }
}
