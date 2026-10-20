import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

// PWA web-push bildirishnomalari (standart Web Push / VAPID).
//   - iPhone Safari (16.4+) "Bosh ekranga qo'shish"dan keyin ishlaydi,
//     shuningdek Android/desktop brauzerlarda.
//   - VAPID kalitlar .env: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
//     Bo'lmasa — web-push o'chiq, jim o'tadi.
//   - Obunalar web_push_subscriptions jadvalida (ilova /push/web/subscribe
//     orqali yuboradi). Eskirgan obunalar (404/410) yuborishda tozalanadi.
@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger('WebPush');
  private ready = false;
  private publicKey = '';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get enabled(): boolean {
    return this.ready;
  }

  get vapidPublicKey(): string {
    return this.publicKey;
  }

  onModuleInit() {
    const pub = (this.config.get<string>('VAPID_PUBLIC_KEY') || '').trim();
    const priv = (this.config.get<string>('VAPID_PRIVATE_KEY') || '').trim();
    const subject =
      (this.config.get<string>('VAPID_SUBJECT') || '').trim() ||
      'mailto:admin@asaka-motors.uz';
    if (!pub || !priv) {
      this.logger.warn('VAPID kalitlar yo\u2018q — web-push o\u2018chirilgan');
      return;
    }
    try {
      webpush.setVapidDetails(subject, pub, priv);
      this.publicKey = pub;
      this.ready = true;
      this.logger.log('Web-push yoqildi (VAPID)');
    } catch (e) {
      this.logger.error(`Web-push init xato: ${String(e)}`);
    }
  }

  // ── ULASH ────────────────────────────────────────────────────────

  async saveSubscription(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    platform = 'web',
  ): Promise<void> {
    const endpoint = (sub?.endpoint || '').trim();
    const p256dh = (sub?.keys?.p256dh || '').trim();
    const auth = (sub?.keys?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) return;
    // Bitta endpoint faqat bitta egada — upsert bilan egasini yangilaymiz.
    await this.prisma.webPushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh, auth, platform },
      update: { userId, p256dh, auth, platform },
    });
  }

  async removeSubscription(endpoint: string): Promise<void> {
    const e = (endpoint || '').trim();
    if (!e) return;
    await this.prisma.webPushSubscription.deleteMany({ where: { endpoint: e } });
  }

  // ── YUBORISH ─────────────────────────────────────────────────────

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    if (!this.ready) return;
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifyPush: true, isActive: true },
    });
    if (!u?.notifyPush || !u.isActive) return;

    const subs = await this.prisma.webPushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    });

    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 3600 },
          );
        } catch (e: unknown) {
          const code = (e as { statusCode?: number })?.statusCode;
          // 404/410 — obuna o'chgan/eskirgan, tozalaymiz.
          if (code === 404 || code === 410) {
            stale.push(s.endpoint);
          }
        }
      }),
    );

    if (stale.length) {
      await this.prisma.webPushSubscription
        .deleteMany({ where: { endpoint: { in: stale } } })
        .catch(() => undefined);
    }
  }
}
