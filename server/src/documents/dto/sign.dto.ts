import { IsBase64, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SignDocumentDto {
  // E-IMZO CAPIWS dan qaytgan PKCS#7 imzo (base64 ko'rinishida)
  @IsBase64()
  pkcs7Data: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  certSerial: string;

  @IsString()
  @MinLength(2)
  @MaxLength(512)
  certSubject: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  certIssuer?: string;

  @IsOptional()
  @IsString()
  certValidFrom?: string;

  @IsOptional()
  @IsString()
  certValidTo?: string;

  // SHA-256 hash of the signed payload (hex)
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  signatureHash: string;
}
