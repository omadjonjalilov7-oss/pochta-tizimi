import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ExternalMailService } from './external-mail.service';
import { SmtpSendService } from './smtp-send.service';
import { ImapPollService } from './imap-poll.service';
import { ConnectExternalMailDto } from './dto/connect-external-mail.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

// 1x1 prozrachno-shaffof GIF (43 bayt)
const TRACKING_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('external-mail')
export class ExternalMailController {
  constructor(
    private readonly service: ExternalMailService,
    private readonly smtp: SmtpSendService,
    private readonly imapPoll: ImapPollService,
  ) {}

  /**
   * Tracking pixel — publik (autentifikatsiyasiz) URL.
   * Tashqi qabul qiluvchi xabarni ochganda email klienti rasm yuklaydi → o'qildi deb belgilanadi.
   * Har doim 1x1 shaffof GIF qaytaradi (rasm xatosi ko'rinmasin).
   */
  @Get('track/:token.gif')
  async trackPixel(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
  ) {
    // Fire-and-forget — pikselni darhol qaytaramiz
    this.smtp.markPixelRead(token, ip, userAgent).catch(() => undefined);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.send(TRACKING_PIXEL_GIF);
  }

  /**
   * Tracking link bosilganda — user xabarni o'qish uchun tasdiqladi.
   * Fire-and-forget: read status yangilanadi, keyin user inbox'ga qaytariladi.
   */
  @Get('track-link/:token')
  async trackLink(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
  ) {
    // Fire-and-forget — read status yangilash
    this.smtp.markLinkRead(token, ip, userAgent).catch(() => undefined);
    // User inbox'ga qaytarish
    res.redirect('/');
  }

  // ===== Autentifikatsiyani talab qiluvchi marshrutlar =====

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getStatus(user.id);
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  connect(@CurrentUser() user: CurrentUserPayload, @Body() dto: ConnectExternalMailDto) {
    return this.service.connect(user.id, dto);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async test(@Body() dto: ConnectExternalMailDto) {
    const r = await this.service.testConnection(dto.email, dto.password);
    return r;
  }

  @Post('resync')
  @UseGuards(JwtAuthGuard)
  resync(@CurrentUser() user: CurrentUserPayload) {
    return this.service.resync(user.id);
  }

  /**
   * Pochtaga kirganda darhol sinxronlash — 15 sekundlik tsiklni kutmasdan
   * tashqi pochtadagi yangi xabarlarni olib keladi.
   */
  @Post('sync-now')
  @UseGuards(JwtAuthGuard)
  syncNow(@CurrentUser() user: CurrentUserPayload) {
    return this.imapPoll.syncNow(user.id);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  disconnect(@CurrentUser() user: CurrentUserPayload) {
    return this.service.disconnect(user.id);
  }

  /**
   * Diagnostika — IMAP serverdagi barcha papkalarni va har birining oxirgi 20
   * xabarini qaytaradi. Bugungi xabarlar qaerga tushib qolganini topish uchun.
   */
  @Get('debug')
  @UseGuards(JwtAuthGuard)
  debug(@CurrentUser() user: CurrentUserPayload) {
    return this.imapPoll.debugInspect(user.id);
  }
}
