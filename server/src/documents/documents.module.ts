import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsCron } from './documents.cron';
import { QrApprovalService } from './qr-approval.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ReportService } from './report.service';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';

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
    SettingsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsCron, QrApprovalService, PdfGeneratorService, ReportService],
  exports: [DocumentsService, QrApprovalService, PdfGeneratorService, ReportService],
})
export class DocumentsModule {}
