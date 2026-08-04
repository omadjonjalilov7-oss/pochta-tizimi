import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SendDocumentDto {
  // Yuborishdan oldin tanlangan tasdiqlovchilar zanjiri (tartibli).
  // Bo'sh bo'lsa — persist qilingan zanjir yoki bo'lim raxbarlari ishlatiladi.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  approverIds?: string[];

  // Alohida-alohida (parallel) yuborish: tanlangan xodimlarning har biriga hujjat
  // bir vaqtda boradi va ular navbat kutmasdan mustaqil tasdiqlaydi. false bo'lsa —
  // odatdagi ketma-ket (zanjir) tartibi.
  @IsOptional()
  @IsBoolean()
  parallel?: boolean;
}
