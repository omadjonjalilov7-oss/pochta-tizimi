import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module, forwardRef } from '@nestjs/common';
import { ExternalMailController } from './external-mail.controller';
import { ExternalMailService } from './external-mail.service';
import { ImapPollService } from './imap-poll.service';
import { SmtpSendService } from './smtp-send.service';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    forwardRef(() => MessagesModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
      }),
    }),
  ],
  controllers: [ExternalMailController],
  providers: [ExternalMailService, ImapPollService, SmtpSendService],
  exports: [ExternalMailService, ImapPollService, SmtpSendService],
})
export class ExternalMailModule {}
