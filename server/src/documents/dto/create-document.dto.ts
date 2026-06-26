import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  subject: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortInfo?: string;

  @IsOptional()
  @IsString()
  body?: string;

  // Raqamlash uchun bo'lim (odatda yaratuvchining bo'limi)
  @IsOptional()
  @IsUUID()
  numberDeptId?: string;

  // Hujjat qaysi bo'limga yuborilayotgani (qabul qiluvchi bo'lim)
  @IsOptional()
  @IsUUID()
  targetDeptId?: string;

  // Tashqi qabul qiluvchi (faqat outgoing tipida)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalRecipient?: string;

  // Bajarish muddati — ISO sanasi (frontend datetime-local'dan keladi)
  @IsOptional()
  @IsDateString()
  deadline?: string;

  // Tasdiqlash zanjiri — tartibli foydalanuvchi UUID ro'yxati (1-tasdiqlovchi, 2-tasdiqlovchi, ...).
  // Bo'sh bo'lsa, serverda eski mantiq (yaratuvchi+qabul qiluvchi bo'lim boshlig'i) ishlatiladi.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  approverIds?: string[];
}
