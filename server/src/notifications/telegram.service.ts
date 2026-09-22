import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Telegram bot bilan integratsiya.
//   - Ulash: xodim profilida "Telegram'ni ulash" bosadi → t.me/bot?start=CODE
//     havolasiga o'tadi → "Start" bosadi → bot /start CODE ni oladi va chat_id
//     profilga bog'lanadi. Shundan keyin botdan xabar keladi.
//   - Yuborish: sendToUser(userId, text) — chat_id bo'lsa va notifyTelegram
//     yoqilgan bo'lsa xabar jo'natadi.
// Token .env dagi TELEGRAM_BOT_TOKEN'dan olinadi (git'ga yozilmaydi).
// Xabarlarni long-polling (getUpdates) orqali oladi — nginx/webhook shart emas.
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Telegram');
  private readonly token: string;
  private readonly username: string;
  private readonly apiBase: string;
  // Oxirgi qayta ishlangan update id — keyingi getUpdates offseti.
  private offset = 0;
  private polling = false;
  private stopped = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.token = (this.config.get<string>('TELEGRAM_BOT_TOKEN') || '').trim();
    this.username = (this.config.get<string>('TELEGRAM_BOT_USERNAME') || '')
      .trim()
      .replace(/^@/, '');
    this.apiBase = this.token
      ? `https://api.telegram.org/bot${this.token}`
      : '';
  }

  get enabled(): boolean {
    return !!this.token;
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('TELEGRAM_BOT_TOKEN yo\u2018q — bot o\u2018chirilgan');
      return;
    }
    this.logger.log(`Telegram bot yoqildi (@${this.username || '?'})`);
    // Polling'ni fon rejimida boshlaymiz (serverni bloklamaydi).
    void this.pollLoop();
  }

  onModuleDestroy() {
    this.stopped = true;
  }

  // ── ULASH ────────────────────────────────────────────────────────

  // Profil uchun ulash holati + deep-link. Kod bo'lmasa yangi kod yaratadi.
  async getLinkInfo(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, telegramLinkCode: true },
    });
    if (!u) return { linked: false, enabled: this.enabled, url: null };
    if (u.telegramChatId) {
      return { linked: true, enabled: this.enabled, url: null };
    }
    let code = u.telegramLinkCode;
    if (!code) {
      code = crypto.randomBytes(8).toString('hex');
      await this.prisma.user.update({
        where: { id: userId },
        data: { telegramLinkCode: code },
      });
    }
    const url = this.username
      ? `https://t.me/${this.username}?start=${code}`
      : null;
    return { linked: false, enabled: this.enabled, url };
  }

  async unlink(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: null, telegramLinkCode: null },
    });
    return { linked: false };
  }

  // ── YUBORISH ─────────────────────────────────────────────────────

  // Bitta foydalanuvchiga xabar. Ulanmagan/o'chirilgan bo'lsa — jim o'tadi.
  async sendToUser(userId: string, text: string): Promise<void> {
    if (!this.enabled) return;
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, notifyTelegram: true, isActive: true },
    });
    if (!u?.telegramChatId || !u.notifyTelegram || !u.isActive) return;
    await this.sendMessage(u.telegramChatId, text);
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      const res = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`sendMessage xato ${res.status}: ${body.slice(0, 200)}`);
      }
    } catch (e) {
      this.logger.warn(`sendMessage istisno: ${String(e)}`);
    }
  }

  // ── POLLING ──────────────────────────────────────────────────────

  private async pollLoop(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    while (!this.stopped) {
      try {
        const res = await fetch(
          `${this.apiBase}/getUpdates?timeout=30&offset=${this.offset}`,
          { signal: AbortSignal.timeout(40000) },
        );
        if (!res.ok) {
          await this.delay(5000);
          continue;
        }
        const data: any = await res.json();
        const updates: any[] = Array.isArray(data?.result) ? data.result : [];
        for (const upd of updates) {
          this.offset = Math.max(this.offset, (upd.update_id ?? 0) + 1);
          await this.handleUpdate(upd).catch((e) =>
            this.logger.warn(`update xato: ${String(e)}`),
          );
        }
      } catch (e) {
        // Timeout yoki tarmoq xatosi — biroz kutib qayta urinamiz.
        await this.delay(3000);
      }
    }
    this.polling = false;
  }

  private async handleUpdate(upd: any): Promise<void> {
    const msg = upd?.message;
    const text: string = (msg?.text || '').trim();
    const chatId = msg?.chat?.id;
    if (!chatId || !text) return;

    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const code = parts[1];
      if (!code) {
        await this.sendMessage(
          String(chatId),
          'Assalomu alaykum! Bu — ASAKA MOTORS EDO bildirishnoma boti.\n\n' +
            'Ulash uchun tizimdagi profilingizdan "Telegram\u2019ni ulash" tugmasini bosing.',
        );
        return;
      }
      const user = await this.prisma.user.findFirst({
        where: { telegramLinkCode: code },
        select: { id: true, fullName: true },
      });
      if (!user) {
        await this.sendMessage(
          String(chatId),
          '\u274c Ulash kodi topilmadi yoki eskirgan. Profildan qayta urinib ko\u2018ring.',
        );
        return;
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: String(chatId), telegramLinkCode: null },
      });
      await this.sendMessage(
        String(chatId),
        `\u2705 Profil ulandi, ${user.fullName}!\n\n` +
          'Endi sizga yangi hujjat va muddat eslatmalari shu yerga keladi.',
      );
      return;
    }

    if (text === '/stop') {
      await this.prisma.user
        .updateMany({
          where: { telegramChatId: String(chatId) },
          data: { telegramChatId: null },
        })
        .catch(() => undefined);
      await this.sendMessage(
        String(chatId),
        'Bildirishnomalar o\u2018chirildi. Qayta ulash uchun profildan foydalaning.',
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
