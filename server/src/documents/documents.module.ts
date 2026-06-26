import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsCron } from './documents.cron';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
      }),
    }),
    forwardRef(() => MessagesModule),
    UsersModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsCron],
  exports: [DocumentsService],
})
export class DocumentsModule {}
