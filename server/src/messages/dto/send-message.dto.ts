import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Importance } from '@prisma/client';

export class SendMessageDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsUUID('all', { each: true })
  recipientIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsUUID('all', { each: true })
  ccRecipientIds?: string[];

  // Tashqi pochta qabul qiluvchilari (boshqa kompaniyalar yoki shaxsiy email'lar)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsEmail({}, { each: true, message: 'Tashqi email manzili noto\'g\'ri formatda' })
  externalToEmails?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsEmail({}, { each: true })
  externalCcEmails?: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  subject: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  signature?: string; // Tahrirlanmaydigan imzo (HTML)

  @IsOptional()
  @IsEnum(Importance)
  importance?: Importance;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  attachmentIds?: string[];
}
