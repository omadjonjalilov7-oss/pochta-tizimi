import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetApprovalPinDto } from './dto/approval-pin.dto';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

class UpdatePreferencesDto {
  @IsBoolean()
  notifyEdo: boolean;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // hamma autentifikatsiya qilingan foydalanuvchilar ko'ra oladi (kontaktlar uchun)
  @Get()
  findAll() {
    return this.users.findAll();
  }

  // avatar yuklash — foydalanuvchining o'zi
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadMyAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.users.uploadAvatar(user.id, file);
  }

  @Delete('me/avatar')
  deleteMyAvatar(@CurrentUser() user: CurrentUserPayload) {
    return this.users.deleteAvatar(user.id);
  }

  @Patch('me/preferences')
  updateMyPreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.users.update(user.id, { notifyEdo: dto.notifyEdo });
  }

  // EDO tasdiqlash PIN-kodini o'rnatish/yangilash — foydalanuvchining o'zi
  @Post('me/approval-pin')
  setMyApprovalPin(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SetApprovalPinDto,
  ) {
    return this.users.setApprovalPin(user.id, dto.pin, dto.currentPin);
  }

  // Admin foydalanuvchining PIN-kodini tozalashi (unutib qo'ygan bo'lsa)
  @Post(':id/approval-pin/clear')
  @UseGuards(AdminGuard)
  clearApprovalPin(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.clearApprovalPin(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  // admin amallari
  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.remove(id);
  }

  @Post(':id/reset-password')
  @UseGuards(AdminGuard)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.users.resetPassword(id, newPassword);
  }

  @Post(':id/activate')
  @UseGuards(AdminGuard)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.setActive(id, true);
  }

  @Post(':id/block')
  @UseGuards(AdminGuard)
  block(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.setActive(id, false);
  }
}
