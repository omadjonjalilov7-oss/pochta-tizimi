import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessageFolder } from '@prisma/client';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly gateway: MessagesGateway,
  ) {}

  @Post()
  async send(@CurrentUser() user: CurrentUserPayload, @Body() dto: SendMessageDto) {
    const result = await this.messages.send(user.id, dto);
    const allRecipients = [...(dto.recipientIds || []), ...(dto.ccRecipientIds || [])];
    this.gateway.notifyNewMessage(allRecipients, result);
    return result;
  }

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('folder', new ParseEnumPipe(MessageFolder, { optional: true }))
    folder: MessageFolder = MessageFolder.inbox,
    @Query('search') search?: string,
    // 'true' → faqat tashqi pochta, 'false' → faqat ichki, aks holda — barchasi.
    @Query('external') external?: string,
  ) {
    const externalFilter =
      external === 'true' ? true : external === 'false' ? false : undefined;
    return this.messages.list(user.id, folder, search, externalFilter);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: CurrentUserPayload) {
    return this.messages.unreadCount(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messages.findOne(user.id, id);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messages.markRead(user.id, id);
  }

  @Patch(':id/star')
  toggleStar(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messages.toggleStar(user.id, id);
  }

  @Get(':id/read-status')
  readStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messages.getReadStatus(user.id, id);
  }

  @Get(':id/read-logs')
  readLogs(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messages.getReadLogs(user.id, id);
  }

  @Delete(':id/recall')
  async recall(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.messages.recall(user.id, id);
    if (result.recalledFrom.length > 0) {
      this.gateway.notifyMessageRecalled(result.recalledFrom, id, result.subject);
    }
    return result;
  }

  @Patch(':id/move/:folder')
  move(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('folder', new ParseEnumPipe(MessageFolder)) folder: MessageFolder,
  ) {
    return this.messages.moveToFolder(user.id, id, folder);
  }
}
