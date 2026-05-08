import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  login: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
