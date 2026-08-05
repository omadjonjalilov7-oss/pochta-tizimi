import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

class OrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  // INN/STIR endi majburiy emas — faqat nom yetarli.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  inn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('q') q?: string) {
    return this.prisma.organization.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { inn: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  create(@Body() dto: OrganizationDto) {
    return this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        inn: dto.inn?.trim() || null,
        address: dto.address?.trim() || null,
        phone: dto.phone?.trim() || null,
        note: dto.note?.trim() || null,
      },
    });
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OrganizationDto) {
    return this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        inn: dto.inn?.trim() || null,
        address: dto.address?.trim() || null,
        phone: dto.phone?.trim() || null,
        note: dto.note?.trim() || null,
      },
    });
  }

  // Tashkilotni o'chirish faqat administrator huquqiga ega foydalanuvchilar uchun.
  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.organization.delete({ where: { id } });
  }
}
