import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';
import { NotificationsService } from './notifications.service';

// Tashqi bildirishnoma kanallari: Telegram bot + SMS (Eskiz).
// Global emas — kerakli modullar (Documents, Users) import qiladi.
@Module({
  imports: [PrismaModule],
  providers: [TelegramService, SmsService, NotificationsService],
  exports: [TelegramService, SmsService, NotificationsService],
})
export class NotificationsModule {}
