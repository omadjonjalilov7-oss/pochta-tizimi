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
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

class DepartmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;
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
    return this.prisma.department.create({ data: { name: dto.name } });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DepartmentDto) {
    return this.prisma.department.update({ where: { id }, data: { name: dto.name } });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.department.delete({ where: { id } });
  }
}
