import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DocumentDefaultsDto {
  // null yoki 0 => xodim muddatni o'zi tanlaydi
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  internalDeadlineDays?: number | null;
}
