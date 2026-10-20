import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';

// Mobil ilova push-bildirishnomalari (Firebase Cloud Messaging).
//   - Service account kaliti .env dagi FIREBASE_SERVICE_ACCOUNT (JSON fayl yo'li)
//     orqali beriladi (git'ga yozilmaydi). Bo'lmasa — push o'chiq, jim o'tadi.
//   - Qurilma token'lari push_tokens jadvalida (ilova /push/register orqali
//     yuboradi). Eskirgan token'lar yuborishda avtomatik tozalanadi.
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger('Push');
  private app: App | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get enabled(): boolean {
    return !!this.app;
  }

  onModuleInit() {
    const path = (this.config.get<string>('FIREBASE_SERVICE_ACCOUNT') || '').trim();
    if (!path) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT yo\u2018q — push o\u2018chirilgan');
      return;
    }
    try {
      if (!fs.existsSync(path)) {
        this.logger.warn(`Service account fayli topilmadi: ${path}`);
        return;
      }
      const sa = JSON.parse(fs.readFileSync(path, 'utf8'));
      this.app = initializeApp({ credential: cert(sa) }, 'fcm');
      this.logger.log(`FCM push yoqildi (project: ${sa.project_id || '?'})`);
    } catch (e) {
      this.logger.error(`FCM init xato: ${String(e)}`);
    }
  }

  // ── ULASH ────────────────────────────────────────────────────────

  async saveToken(userId: string, token: string, platform = 'android'): Promise<void> {
    const t = (token || '').trim();
    if (!t) return;
    // Bitta token faqat bitta foydalanuvchida bo'lishi kerak (qurilma qo'ldan
    // qo'lga o'tgan bo'lishi mumkin) — upsert bilan egasini yangilaymiz.
    await this.prisma.pushToken.upsert({
      where: { token: t },
      create: { userId, token: t, platform },
      update: { userId, platform },
    });
  }

  async removeToken(token: string): Promise<void> {
    const t = (token || '').trim();
    if (!t) return;
    await this.prisma.pushToken.deleteMany({ where: { token: t } });
  }

  // ── YUBORISH ─────────────────────────────────────────────────────

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    if (!this.app) return;
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifyPush: true, isActive: true },
    });
    if (!u?.notifyPush || !u.isActive) return;

    const tokens = (
      await this.prisma.pushToken.findMany({
        where: { userId },
        select: { token: true },
      })
    ).map((r) => r.token);
    if (tokens.length === 0) return;

    try {
      const res = await getMessaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: { priority: 'high', notification: { sound: 'default' } },
      });
      // Eskirgan/yaroqsiz token'larni tozalaymiz.
      const stale: string[] = [];
      res.responses.forEach((r, i) => {
        const code = r.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        ) {
          stale.push(tokens[i]);
        }
      });
      if (stale.length) {
        await this.prisma.pushToken
          .deleteMany({ where: { token: { in: stale } } })
          .catch(() => undefined);
      }
    } catch (e) {
      this.logger.warn(`push yuborish xato: ${String(e)}`);
    }
  }
}
