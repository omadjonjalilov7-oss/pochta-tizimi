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
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

class PositionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;
}

@Controller('positions')
@UseGuards(JwtAuthGuard)
export class PositionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.position.findMany({ orderBy: [{ rank: 'asc' }, { name: 'asc' }] });
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: PositionDto) {
    return this.prisma.position.create({
      data: { name: dto.name, rank: dto.rank ?? 100 },
    });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PositionDto) {
    return this.prisma.position.update({
      where: { id },
      data: { name: dto.name, rank: dto.rank },
    });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.position.delete({ where: { id } });
  }
}
