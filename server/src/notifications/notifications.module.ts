import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';
import { PushService } from './push.service';
import { WebPushService } from './webpush.service';
import { PushController } from './push.controller';
import { NotificationsService } from './notifications.service';

// Tashqi bildirishnoma kanallari: Telegram bot + SMS (Eskiz) + Push (FCM) +
// PWA web-push (VAPID). Global emas — kerakli modullar import qiladi.
@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [
    TelegramService,
    SmsService,
    PushService,
    WebPushService,
    NotificationsService,
  ],
  exports: [
    TelegramService,
    SmsService,
    PushService,
    WebPushService,
    NotificationsService,
  ],
})
export class NotificationsModule {}
