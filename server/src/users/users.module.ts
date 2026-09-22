import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ExternalMailModule } from '../external-mail/external-mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ExternalMailModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
