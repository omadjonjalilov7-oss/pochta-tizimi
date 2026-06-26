import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  category: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  bodyTemplate: string;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
