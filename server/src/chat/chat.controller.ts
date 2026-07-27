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
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
    private readonly groups: ChatGroupService,
  ) {}

  @Get('contacts')
  contacts(@CurrentUser() user: CurrentUserPayload) {
    return this.chat.getContacts(user.id);
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
