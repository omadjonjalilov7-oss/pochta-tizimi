import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { PushService } from './push.service';
import { WebPushService } from './webpush.service';

interface WebPushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Mobil ilova (FCM) + PWA web-push (VAPID) obunalarini boshqarish.
@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly webPush: WebPushService,
  ) {}

  // ── Mobil ilova (FCM device token) ──────────────────────────────

  @Post('register')
  async register(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { token: string; platform?: string },
  ) {
    await this.push.saveToken(user.id, body.token, body.platform || 'android');
    return { ok: true };
  }

  @Post('unregister')
  async unregister(@Body() body: { token: string }) {
    await this.push.removeToken(body.token);
    return { ok: true };
  }

  // ── PWA web-push (VAPID) ────────────────────────────────────────

  // Brauzer obuna bo'lish uchun VAPID ochiq kalitini oladi (maxfiy emas).
  @Get('vapid-public-key')
  vapidKey() {
    return { key: this.webPush.vapidPublicKey };
  }

  @Post('web/subscribe')
  async webSubscribe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { subscription: WebPushSub; platform?: string },
  ) {
    await this.webPush.saveSubscription(
      user.id,
      body.subscription,
      body.platform || 'web',
    );
    return { ok: true };
  }

  @Post('web/unsubscribe')
  async webUnsubscribe(@Body() body: { endpoint: string }) {
    await this.webPush.removeSubscription(body.endpoint);
    return { ok: true };
  }
}
