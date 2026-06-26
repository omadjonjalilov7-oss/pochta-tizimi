import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ConnectExternalMailDto {
  @IsEmail({}, { message: 'Email manzili noto\'g\'ri' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(1, { message: 'Parol bo\'sh bo\'lmasligi kerak' })
  @MaxLength(255)
  password: string;
}
