import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DocumentDefaultsDto } from './dto/document-defaults.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Har qanday tizimga kirgan foydalanuvchi o'qiy oladi (compose formasi uchun)
  @Get('document-defaults')
  getDocumentDefaults() {
    return this.settings.getDocumentDefaults();
  }

  // Faqat admin o'zgartiradi
  @Patch('document-defaults')
  @UseGuards(AdminGuard)
  async setDocumentDefaults(@Body() dto: DocumentDefaultsDto) {
    const days = dto.internalDeadlineDays ?? null;
    await this.settings.setInternalDeadlineDays(days);
    return this.settings.getDocumentDefaults();
  }
}
