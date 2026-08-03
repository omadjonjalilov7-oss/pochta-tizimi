import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { DocumentsService } from './documents.service';

// Login/parolsiz OMMAVIY endpointlar (QR skaner + OnlyOffice uchun).
// DIQQAT: bu kontrollerda @UseGuards(JwtAuthGuard) YO'Q — ataylab ochiq.
// OnlyOffice endpointlari imzolangan (JWT) token orqali himoyalangan.
@Controller('public')
export class PublicController {
  constructor(private readonly docs: DocumentsService) {}

  @Get('documents/:token')
  snapshot(@Param('token') token: string) {
    return this.docs.getPublicSnapshot(token);
  }

  // OnlyOffice yoqilganmi (frontend tugmani ko'rsatish uchun so'raydi).
  @Get('onlyoffice/enabled')
  onlyOfficeEnabled() {
    return { enabled: this.docs.isOnlyOfficeEnabled() };
  }

  // OnlyOffice serveri faylni yuklab oladi (imzolangan token orqali).
  @Get('onlyoffice/file/:token')
  async onlyOfficeFile(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const f = await this.docs.getOnlyOfficeFile(token);
    if (!existsSync(f.fullPath)) {
      res.status(404).send('Not found');
      return;
    }
    res.set({
      'Content-Type': f.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        f.filename,
      )}"`,
    });
    createReadStream(f.fullPath).pipe(res);
  }

  // OnlyOffice saqlaganda callback yuboradi (JWT ichida holat keladi).
  @Post('onlyoffice/callback/:token')
  async onlyOfficeCallback(
    @Param('token') token: string,
    @Body() body: any,
  ) {
    return this.docs.handleOnlyOfficeCallback(token, body);
  }
}
