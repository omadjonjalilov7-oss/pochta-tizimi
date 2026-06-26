import { IsOptional, IsString, Matches } from 'class-validator';

export class SetApprovalPinDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN aniq 4 raqamdan iborat bo'lishi shart" })
  pin!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: "Joriy PIN aniq 4 raqamdan iborat bo'lishi shart" })
  currentPin?: string;
}
