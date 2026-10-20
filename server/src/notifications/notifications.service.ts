import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';
import { PushService } from './push.service';
import { WebPushService } from './webpush.service';

// Tashqi kanallar (Telegram + SMS) bo'yicha yagona kirish nuqtasi.
// Pochta ichidagi xabar/realtime alohida (documents.service) — bu faqat
// telefon/telegram orqali chetga chiqadigan bildirishnomalar uchun.
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly sms: SmsService,
    private readonly push: PushService,
    private readonly webPush: WebPushService,
  ) {}

  // Bitta foydalanuvchiga tashqi bildirishnoma. telegram matni HTML bo'lishi
  // mumkin; sms — qisqa oddiy matn (bo'lmasa SMS yuborilmaydi). push —
  // berilmasa telegram matnidan avtomatik hosil qilinadi (sarlavha + tana).
  async notifyUser(
    userId: string,
    opts: {
      telegram: string;
      sms?: string;
      push?: { title: string; body: string; data?: Record<string, string> };
    },
  ): Promise<void> {
    // Kanallarni parallel, xatolar oqimni to'xtatmaydi.
    const jobs: Promise<unknown>[] = [];
    jobs.push(this.telegram.sendToUser(userId, opts.telegram).catch(() => undefined));
    if (opts.sms) {
      jobs.push(this.sendSmsToUser(userId, opts.sms).catch(() => undefined));
    }
    const push = opts.push ?? this.pushFromTelegram(opts.telegram);
    if (push) {
      jobs.push(this.push.sendToUser(userId, push).catch(() => undefined));
      jobs.push(this.webPush.sendToUser(userId, push).catch(() => undefined));
    }
    await Promise.all(jobs);
  }

  // Telegram HTML matnidan oddiy push (1-qator sarlavha, qolgani tana) yasaydi.
  private pushFromTelegram(
    telegram: string,
  ): { title: string; body: string } | null {
    const plain = telegram
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    if (!plain) return null;
    const lines = plain.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    const title = lines[0].slice(0, 100);
    const body = (lines.slice(1).join(' ') || lines[0]).slice(0, 240);
    return { title, body };
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
