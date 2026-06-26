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
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

class DepartmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]{1,16}$/, {
    message: "Kod 1-16 belgi (faqat katta harf, raqam yoki tire) bo'lishi kerak",
  })
  code?: string | null;
}

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: DepartmentDto) {
    return this.prisma.department.create({
      data: { name: dto.name, code: dto.code || null },
    });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DepartmentDto) {
    return this.prisma.department.update({
      where: { id },
      data: { name: dto.name, code: dto.code || null },
    });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.department.delete({ where: { id } });
  }
}
