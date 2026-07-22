import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class SendDocumentDto {
  // Yuborishdan oldin tanlangan tasdiqlovchilar zanjiri (tartibli).
  // Bo'sh bo'lsa — persist qilingan zanjir yoki bo'lim raxbarlari ishlatiladi.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  approverIds?: string[];
}
