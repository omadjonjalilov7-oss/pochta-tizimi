import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ResolutionTargetInputDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class CreateResolutionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  text: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ResolutionTargetInputDto)
  targets: ResolutionTargetInputDto[];
}

export class CompleteTargetDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpdateResolutionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  text: string;

  // Ijrochilar ro'yxati ham to'liq yangilanishi mumkin (topshiriq oynasidan
  // tahrirlashda). Berilmasa — faqat matn yangilanadi.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolutionTargetInputDto)
  targets?: ResolutionTargetInputDto[];
}

// Topshiriqni "qayta yuklash" — muddatni o'zgartirib, ijrochini qayta xabardor qilish.
export class RescheduleTargetDto {
  @IsDateString()
  deadline: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
