import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatGroupService } from './chat-group.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { ChatGateway } from './chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

class SendChatDto {
  @IsUUID()
  toUserId: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  body?: string;
}

class EditChatDto {
  @IsString()
  @MaxLength(10000)
  body: string;
}

class CallLogDto {
  @IsUUID()
  toUserId: string;

  @IsIn(['voice', 'video'])
  kind: 'voice' | 'video';

  @IsIn(['answered', 'missed', 'declined'])
  outcome: 'answered' | 'missed' | 'declined';

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
    private readonly groups: ChatGroupService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('contacts')
  contacts(@CurrentUser() user: CurrentUserPayload) {
    return this.chat.getContacts(user.id);
  }

  // Qo'ng'iroq uchun ICE serverlari (STUN/TURN). TURN — har xil tarmoqdagilar
  // (uy/mobil internet) uchun zarur; .env dan olinadi:
  //   TURN_URL (masalan turn:turn.asaka-motors.uz:3478), TURN_USERNAME,
  //   TURN_PASSWORD. STUN_URLS — vergul bilan (standart: Google STUN).
  @Get('ice-servers')
  iceServers() {
    const stunRaw =
      process.env.STUN_URLS || 'stun:stun.l.google.com:19302';
    const stunUrls = stunRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const servers: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }> = [];
    if (stunUrls.length) servers.push({ urls: stunUrls });
    const turnUrl = (process.env.TURN_URL || '').trim();
    if (turnUrl) {
      servers.push({
        urls: turnUrl.split(',').map((s) => s.trim()).filter(Boolean),
        username: process.env.TURN_USERNAME || undefined,
        credential: process.env.TURN_PASSWORD || undefined,
      });
    }
    return { iceServers: servers };
  }

  // Qo'ng'iroq yozuvi — chaqiruvchi qo'ng'iroq tugagach yuboradi. Chatда
  // "📞 Qo'ng'iroq" yozuvi bo'lib ko'rinadi va ikki tomonning suhbatlar
  // ro'yxatiga tushadi.
  @Post('call-log')
  async callLog(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: CallLogDto,
  ) {
    const msg = await this.chat.logCall(
      user.id,
      body.toUserId,
      body.kind,
      body.outcome,
      body.duration ?? 0,
    );
    if (msg) {
      // Ikkala tomonga ham real-vaqt (chaqiruvchining ochiq chatига ham tushsin).
      this.gateway.emitChatMessage(body.toUserId, msg);
      this.gateway.emitChatMessage(user.id, msg);
    }
    return msg;
  }

  @Get('conversations')
  conversations(@CurrentUser() user: CurrentUserPayload) {
    return this.chat.getConversations(user.id);
  }

  @Get('messages/:userId')
  messages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.chat.getMessages(user.id, userId);
  }

  @Get('unread')
  async unread(@CurrentUser() user: CurrentUserPayload) {
    const dm = await this.chat.unreadCount(user.id);
    const groups = await this.groups.totalUnread(user.id);
    return { count: dm.count + groups };
  }

  @Post('messages')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async send(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: SendChatDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const msg = await this.chat.sendMessage(
      user.id,
      body.toUserId,
      body.body ?? '',
      file,
    );
    // Real-vaqt: qabul qiluvchiga xabar yuboramiz
    this.gateway.emitChatMessage(body.toUserId, msg);
    // Qabul qiluvchi offline bo'lsa — PWA/FCM push ("chatdan yangi xabar").
    // Online bo'lsa socket orqali ilovaning o'zi ogohlantiradi (ikki marta emas).
    if (!(await this.gateway.isOnline(body.toUserId))) {
      const name = await this.chat.senderName(user.id);
      const preview =
        (msg.attachments?.length ?? 0) > 0 && !msg.body
          ? '📎 Fayl'
          : msg.body || 'Yangi xabar';
      const { count } = await this.chat.unreadCount(body.toUserId);
      void this.notifications.pushOnly(body.toUserId, {
        title: name,
        body: preview.slice(0, 240),
        data: { url: '/edo/chat', tag: `chat-${user.id}`, badge: String(count) },
      });
    }
    return msg;
  }

  @Patch('messages/:id')
  async editMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EditChatDto,
  ) {
    const msg = await this.chat.editMessage(user.id, id, body.body);
    // Suhbatdoshga real-vaqt yangilanish
    const peerId = msg.fromUserId === user.id ? msg.toUserId : msg.fromUserId;
    this.gateway.emitChatEdited(peerId, msg);
    return msg;
  }

  @Delete('messages/:id')
  async deleteMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('scope') scope?: string,
  ) {
    const s = scope === 'all' ? 'all' : scope === 'me' ? 'me' : null;
    if (!s) throw new BadRequestException("scope 'me' yoki 'all' bo'lishi kerak");
    const res = await this.chat.deleteMessage(user.id, id, s);
    if (s === 'all' && res.partnerId) {
      this.gateway.emitChatDeleted(res.partnerId, id, user.id);
    }
    return res;
  }

  @Post('read/:userId')
  async markRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId', new ParseUUIDPipe()) partnerId: string,
  ) {
    await this.chat.markRead(user.id, partnerId);
    // Yuboruvchiga o'qildi signali
    this.gateway.emitChatRead(partnerId, user.id);
    return { ok: true };
  }

  @Get('attachments/:id/download')
  async downloadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const f = await this.chat.downloadAttachment(user.id, id);
    res.set({
      'Content-Type': f.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      'Content-Length': String(f.sizeBytes),
    });
    createReadStream(f.fullPath).pipe(res);
  }
}
