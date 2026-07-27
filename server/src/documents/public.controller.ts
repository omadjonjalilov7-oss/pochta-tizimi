import { Controller, Get, Param } from '@nestjs/common';
import { DocumentsService } from './documents.service';

// Login/parolsiz OMMAVIY endpointlar (QR skaner uchun).
// DIQQAT: bu kontrollerda @UseGuards(JwtAuthGuard) YO'Q — ataylab ochiq.
// Faqat public_token orqali hujjatning qisqacha holatini qaytaradi.
@Controller('public')
export class PublicController {
  constructor(private readonly docs: DocumentsService) {}

  @Get('documents/:token')
  snapshot(@Param('token') token: string) {
    return this.docs.getPublicSnapshot(token);
  }
}
