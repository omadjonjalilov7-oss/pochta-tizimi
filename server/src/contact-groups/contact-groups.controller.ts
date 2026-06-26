import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ContactGroupsService } from './contact-groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

class CreateGroupDto {
  @IsString()
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;
}

class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;
}

class MemberDto {
  @IsUUID()
  memberId: string;
}

@Controller('contact-groups')
@UseGuards(JwtAuthGuard)
export class ContactGroupsController {
  constructor(private readonly svc: ContactGroupsService) {}

  /** Barcha guruhlar (a'zolari bilan) */
  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.findAll(user.id);
  }

  /** Kontaktlar → guruh teglari xaritasi */
  @Get('tags')
  tags(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.getGroupsForContacts(user.id);
  }

  /** Yangi guruh */
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateGroupDto,
  ) {
    return this.svc.create(user.id, dto.name, dto.color);
  }

  /** Guruhni tahrirlash */
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.svc.update(user.id, id, dto.name, dto.color);
  }

  /** Guruhni o'chirish */
  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(user.id, id);
  }

  /** Guruhga a'zo qo'shish */
  @Post(':id/members')
  addMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MemberDto,
  ) {
    return this.svc.addMember(user.id, id, dto.memberId);
  }

  /** Guruhdan a'zoni olib tashlash */
  @Delete(':id/members/:memberId')
  removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    return this.svc.removeMember(user.id, id, memberId);
  }
}
