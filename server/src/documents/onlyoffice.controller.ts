import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { OnlyOfficeService } from './onlyoffice.service';
import { DocumentsService } from './documents.service';

// ONLYOFFICE Document Server uchun endpointlar.
//   - config: foydalanuvchi autentifikatsiyasi bilan (imzolangan config beradi).
//   - file/callback: DS chaqiradi — user JWT yo'q, token bilan himoyalangan.
@Controller('onlyoffice')
export class OnlyOfficeController {
  constructor(
    private readonly oo: OnlyOfficeService,
    private readonly docs: DocumentsService,
  ) {}

  @Get('config/:id/:attId')
  @UseGuards(JwtAuthGuard)
  config(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('attId') attId: string,
  ) {
    return this.oo.buildConfig(user.id, id, attId, user.login);
  }

  // DS faylni yuklab oladi (imzolangan token bilan).
  @Get('file/:id/:attId')
  async file(
    @Param('id') id: string,
    @Param('attId') attId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    this.oo.verifyToken(token, 'file', id, attId);
    const f = await this.docs.resolveAttachmentPath(id, attId);
    res.set({
      'Content-Type': f.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        f.filename,
      )}`,
    });
    createReadStream(f.fullPath).pipe(res);
  }

  // DS tahrir tugagach yangilangan faylni shu yerga POST qiladi.
  // DS faqat HTTP 200'ni qabul qiladi (201 = xato deb hisoblaydi), shuning
  // uchun status kodini majburan 200 qilamiz.
  @Post('callback/:id/:attId')
  @HttpCode(200)
  async callback(
    @Param('id') id: string,
    @Param('attId') attId: string,
    @Query('token') token: string,
    @Body() body: any,
  ) {
    this.oo.verifyToken(token, 'callback', id, attId);
    return this.oo.handleCallback(id, attId, body);
  }
}
