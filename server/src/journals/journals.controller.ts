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
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

const JOURNAL_KINDS = ['general', 'incoming', 'outgoing', 'internal'];

class JournalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  prefix?: string | null;

  @IsOptional()
  @IsIn(JOURNAL_KINDS)
  kind?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  seq?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('journals')
@UseGuards(JwtAuthGuard)
export class JournalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.journal.findMany({
      orderBy: [{ seq: 'asc' }, { name: 'asc' }],
    });
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: JournalDto) {
    return this.prisma.journal.create({
      data: {
        name: dto.name.trim(),
        prefix: dto.prefix?.trim() || null,
        kind: dto.kind ?? 'general',
        seq: dto.seq ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: JournalDto) {
    return this.prisma.journal.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        prefix: dto.prefix?.trim() || null,
        kind: dto.kind ?? 'general',
        seq: dto.seq ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.journal.delete({ where: { id } });
  }
}
