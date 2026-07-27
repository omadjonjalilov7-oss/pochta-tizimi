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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ChatGroupService } from './chat-group.service';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

class CreateGroupDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  memberIds: string[];
}

class SendGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  body?: string;
}

class EditGroupMsgDto {
  @IsString()
  @MaxLength(10000)
  body: string;
}

class RenameGroupDto {
  @IsString()
  @MaxLength(255)
  name: string;
}

class MembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  memberIds: string[];
}

@Controller('chat/groups')
@UseGuards(JwtAuthGuard)
export class ChatGroupController {
  constructor(
    private readonly groups: ChatGroupService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.groups.getGroups(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateGroupDto,
  ) {
    const res = await this.groups.createGroup(user.id, dto.name, dto.memberIds);
    this.gateway.emitGroupCreated(res.memberIds, res.groupId);
    return res;
  }

  @Get(':id/info')
  info(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groups.getGroupInfo(user.id, id);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groups.getMessages(user.id, id);
  }

  @Post(':id/messages')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async send(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendGroupDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const msg = await this.groups.sendMessage(user.id, id, dto.body ?? '', file);
    const { memberIds } = await this.groups.memberIdsOf(id);
    // Yuboruvchidan boshqa a'zolarga real-vaqt yuboramiz
    this.gateway.emitGroupMessage(
      memberIds.filter((m) => m !== user.id),
      msg,
    );
    return msg;
  }

  @Post(':id/read')
  read(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groups.markRead(user.id, id);
  }

  @Patch('messages/:msgId')
  async editMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('msgId', new ParseUUIDPipe()) msgId: string,
    @Body() dto: EditGroupMsgDto,
  ) {
    const msg = await this.groups.editMessage(user.id, msgId, dto.body);
    const { memberIds } = await this.groups.memberIdsOf(msg.groupId);
    this.gateway.emitGroupEdited(
      memberIds.filter((m) => m !== user.id),
      msg,
    );
    return msg;
  }

  @Delete('messages/:msgId')
  async deleteMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('msgId', new ParseUUIDPipe()) msgId: string,
  ) {
    const res = await this.groups.deleteMessage(user.id, msgId);
    const { memberIds } = await this.groups.memberIdsOf(res.groupId);
    this.gateway.emitGroupDeleted(
      memberIds.filter((m) => m !== user.id),
      res.groupId,
      msgId,
    );
    return res;
  }

  @Post(':id/members')
  async addMembers(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MembersDto,
  ) {
    const res = await this.groups.addMembers(user.id, id, dto.memberIds);
    this.gateway.emitGroupUpdated(res.memberIds, id);
    // Yangi qo'shilganlarga guruh yaratildi kabi signal
    this.gateway.emitGroupCreated(dto.memberIds, id);
    return res;
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    const res = await this.groups.removeMember(user.id, id, memberId);
    this.gateway.emitGroupUpdated(res.memberIds, id);
    return res;
  }

  @Post(':id/leave')
  async leave(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const { memberIds } = await this.groups.memberIdsOf(id);
    const res = await this.groups.leaveGroup(user.id, id);
    this.gateway.emitGroupUpdated(memberIds, id);
    return res;
  }

  @Patch(':id')
  async rename(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RenameGroupDto,
  ) {
    const res = await this.groups.renameGroup(user.id, id, dto.name);
    const { memberIds } = await this.groups.memberIdsOf(id);
    this.gateway.emitGroupUpdated(memberIds, id);
    return res;
  }

  @Get('attachments/:attId/download')
  async downloadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('attId', new ParseUUIDPipe()) attId: string,
    @Res() res: Response,
  ) {
    const f = await this.groups.downloadAttachment(user.id, attId);
    res.set({
      'Content-Type': f.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      'Content-Length': String(f.sizeBytes),
    });
    createReadStream(f.fullPath).pipe(res);
  }
}
