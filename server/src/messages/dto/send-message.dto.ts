import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Importance } from '@prisma/client';

export class SendMessageDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  recipientIds: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  ccRecipientIds?: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  subject: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsEnum(Importance)
  importance?: Importance;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  attachmentIds?: string[];
}
