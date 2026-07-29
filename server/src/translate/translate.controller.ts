import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TranslateService } from './translate.service';

class TranslateDto {
  @IsArray()
  @IsString({ each: true })
  items!: string[];

  @IsString()
  @MaxLength(8)
  to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  from?: string;
}

@Controller('translate')
@UseGuards(JwtAuthGuard)
export class TranslateController {
  constructor(private readonly translate: TranslateService) {}

  @Get('languages')
  languages() {
    return { languages: this.translate.supportedLanguages() };
  }

  // Gemini API tekin kvotasini asrash uchun cheklov.
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post()
  async run(@Body() dto: TranslateDto) {
    const items = TranslateService.validateItems(dto.items);
    const result = await this.translate.translate(items, dto.to, dto.from);
    return { items: result };
  }
}
