import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { MessagesGateway } from '../messages/messages.gateway';

const REMINDER_WINDOW_HOURS = 24; // muddat tugashidan 24 soat oldin eslatma
const REMINDER_KEY_PREFIX = 'reminded_';

/**
 * Hujjat muddatlarini kuzatuvchi cron.
 * - Har 15 daqiqada: muddati o'tgan hujjatlarni `overdue` deb belgilaydi
 * - Har soatda: muddat tugashidan 24 soat oldin eslatma yuboradi (1 marta)
 */
@Injectable()
export class DocumentsCron {
  private readonly logger = new Logger(DocumentsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly gateway: MessagesGateway,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async markOverdue() {
    const now = new Date();
    const overdueDocs = await this.prisma.document.findMany({
      where: {
        deadline: { lt: now },
        status: { in: [DocumentStatus.in_review, DocumentStatus.in_progress] },
      },
      select: {
        id: true,
        number: true,
        subject: true,
        createdById: true,
        currentHolderId: true,
      },
    });

    if (overdueDocs.length === 0) return;
    this.logger.log(`Topildi ${overdueDocs.length} ta muddati o'tgan hujjat`);

    for (const d of overdueDocs) {
      await this.prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id: d.id },
          data: { status: DocumentStatus.overdue },
        });
        await tx.documentAuditLog.create({
          data: { documentId: d.id, action: 'overdue' },
        });
      });
      // Bildirishnoma: yuboruvchini va qabul qiluvchini tanlash
      // — actor (Pochta xabari kimdan ko'rinadi) qabul qiluvchilar ichida bo'lmasligi kerak
      await this.notifyOverdue(d);
    }
  }

  private async notifyOverdue(d: {
    id: string;
    number: string;
    subject: string;
    createdById: string;
    currentHolderId: string | null;
  }) {
    const subject = `[EDO ${d.number}] Muddati o'tdi: ${d.subject}`;
    const body =
      `Hujjat muddati o'tib ketdi!\n\n` +
      `Mavzu: ${d.subject}\nRaqam: ${d.number}\n\n` +
      `Hujjat sahifasi: /edo/documents/${d.id}`;

    if (d.currentHolderId && d.currentHolderId !== d.createdById) {
      // Ikkala tomonni xabardor qilamiz — har biriga o'zaro yuboramiz
      await this.broadcast([d.currentHolderId], d.createdById, subject, body, 'important');
      await this.broadcast([d.createdById], d.currentHolderId, subject, body, 'important');
    } else {
      // Bir kishi — o'ziga xabar yubora olmaymiz, audit yetarli
      this.logger.log(`Overdue doc ${d.number}: yaratuvchi=hozirgi egasi, faqat audit`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendDeadlineReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

    const docs = await this.prisma.document.findMany({
      where: {
        deadline: { gte: now, lte: windowEnd },
        status: { in: [DocumentStatus.in_review, DocumentStatus.in_progress] },
      },
      select: {
        id: true,
        number: true,
        subject: true,
        deadline: true,
        createdById: true,
        currentHolderId: true,
      },
    });

    if (docs.length === 0) return;

    for (const d of docs) {
      const key = `${REMINDER_KEY_PREFIX}${d.id}`;
      // Audit log orqali eslatmani 1 marta yuborganligini tekshiramiz
      const alreadyReminded = await this.prisma.documentAuditLog.findFirst({
        where: { documentId: d.id, action: key },
        select: { id: true },
      });
      if (alreadyReminded) continue;

      const deadlineStr = d.deadline ? new Date(d.deadline).toLocaleString('uz-UZ') : '';
      const subject = `[EDO ${d.number}] Muddat yaqinlashmoqda — ${d.subject}`;
      const body =
        `Eslatma: hujjat muddati 24 soat ichida tugaydi.\n\n` +
        `Mavzu: ${d.subject}\nMuddat: ${deadlineStr}\n\n` +
        `Hujjat sahifasi: /edo/documents/${d.id}`;

      if (d.currentHolderId && d.currentHolderId !== d.createdById) {
        await this.broadcast([d.currentHolderId], d.createdById, subject, body, 'normal');
        await this.broadcast([d.createdById], d.currentHolderId, subject, body, 'normal');
      }

      await this.prisma.documentAuditLog.create({
        data: { documentId: d.id, action: key },
      });
    }
  }

  private async broadcast(
    recipientIds: string[],
    actorId: string,
    subject: string,
    body: string,
    importance: 'normal' | 'important' | 'urgent',
  ) {
    if (recipientIds.length === 0) return;
    // Hech kim qabul qiluvchilarda actorId bilan bir xil bo'lmasligi kerak
    const filtered = recipientIds.filter((id) => id !== actorId);
    if (filtered.length === 0) return;
    try {
      const result = await this.messages.send(actorId, {
        recipientIds: filtered,
        subject,
        body,
        importance,
      });
      this.gateway.notifyNewMessage(filtered, result);
    } catch (e) {
      this.logger.error(`Xabar yuborish xatosi: ${(e as Error).message}`);
    }
  }
}
