import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';

// Tashqi kanallar (Telegram + SMS) bo'yicha yagona kirish nuqtasi.
// Pochta ichidagi xabar/realtime alohida (documents.service) — bu faqat
// telefon/telegram orqali chetga chiqadigan bildirishnomalar uchun.
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly sms: SmsService,
  ) {}

  // Bitta foydalanuvchiga tashqi bildirishnoma. telegram matni HTML bo'lishi
  // mumkin; sms — qisqa oddiy matn (bo'lmasa SMS yuborilmaydi).
  async notifyUser(
    userId: string,
    opts: { telegram: string; sms?: string },
  ): Promise<void> {
    // Ikkala kanalni parallel, xatolar oqimni to'xtatmaydi.
    const jobs: Promise<unknown>[] = [];
    jobs.push(this.telegram.sendToUser(userId, opts.telegram).catch(() => undefined));
    if (opts.sms) {
      jobs.push(this.sendSmsToUser(userId, opts.sms).catch(() => undefined));
    }
    await Promise.all(jobs);
  }

  private async sendSmsToUser(userId: string, text: string): Promise<void> {
    if (!this.sms.enabled) return;
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, notifySms: true, isActive: true },
    });
    if (!u?.phone || !u.notifySms || !u.isActive) return;
    await this.sms.sendToPhone(u.phone, text);
  }
}
