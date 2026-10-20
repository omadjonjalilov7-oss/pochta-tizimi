import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { NotificationsService } from './notifications.service';

// Tashqi bildirishnoma kanallari: Telegram bot + SMS (Eskiz) + Push (FCM).
// Global emas — kerakli modullar (Documents, Users) import qiladi.
@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [TelegramService, SmsService, PushService, NotificationsService],
  exports: [TelegramService, SmsService, PushService, NotificationsService],
})
export class NotificationsModule {}
