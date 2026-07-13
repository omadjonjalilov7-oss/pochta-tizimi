import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  IsEmail,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  login: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsBoolean()
  canSendExternal?: boolean;

  @IsOptional()
  @IsBoolean()
  canSignExternal?: boolean;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  // Pochta turi: 'internal' (ichki @pochta.local) yoki 'external' (tashqi @asaka-motors.uz)
  @IsOptional()
  @IsIn(['internal', 'external'])
  mailType?: 'internal' | 'external';

  // Tashqi pochta paroli — faqat mailType 'external' bo'lganda kerak (admin qo'lda kiritadi)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalMailPassword?: string;
}
