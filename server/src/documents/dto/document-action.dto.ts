import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Hujjatni tasdiqlash uchun 4-xonalik PIN-kod (faqat tasdiqlash payti so'raladi).
// addApproverIds — joriy tasdiqlovchi o'zidan keyin zanjirga qo'shimcha tasdiqlovchilar
// kiritmoqchi bo'lsa shu yerda ro'yxat sifatida beradi (masalan, "men tasdiqladim,
// keyin mening xodimim ham ko'rib chiqib tasdiqlasin").
export class ApproveDocumentDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN aniq 4 raqamdan iborat bo'lishi shart" })
  pin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  approvalNotes?: string; // Tasdiq xususi izohatlari (ixtiyoriy)

  @IsOptional()
  @IsString()
  @MaxLength(20)
  approvalMethod?: string; // 'signature', 'qr', 'digital', 'manual'

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  addApproverIds?: string[];
}

export class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text: string;
}

export class RejectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string; // Qo'shimcha izohlar (ixtiyoriy)

  // Rad etish xam tasdiqlash zanjiridagi qaror — shu sabab PIN talab qilinadi
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN aniq 4 raqamdan iborat bo'lishi shart" })
  pin!: string;
}

// Hujjatni boshqa odamga uzatish (responsibility transfer).
// Joriy tasdiqlovchi hujjatni TASDIQLAMASDAN boshqa odamga o'tkazadi.
// toUserId — yangi javobgar (joriy tasdiqlovchi o'rnini egallaydi)
// additionalApproverIds — toUserId'dan keyin zanjirga qo'shiladigan qo'shimcha tasdiqlovchilar
export class ForwardDto {
  @IsUUID()
  toUserId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  // Forward — javobgarlikni o'tkazish — shu sababli PIN talab qilinadi
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN aniq 4 raqamdan iborat bo'lishi shart" })
  pin!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  additionalApproverIds?: string[];
}

// Muddati o'tgan hujjatlarni director tasdiqlab berish
// Overdue xujjat — muddati o'tgani sababli director ruxsati kerak
export class ApproveOverdueDocumentDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN aniq 4 raqamdan iborat bo'lishi shart" })
  pin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string; // Director nima sababli ruxsat berganini izohla
}

// Hujjat muddatini uzaytirish
// Yaratuvchi yoki rahbar muddatni uzaytira oladi — overdue statusni o'chiradi
export class ExtendDeadlineDto {
  @IsISO8601()
  newDeadline: string; // ISO 8601 format: 2026-06-30T23:59:59Z

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string; // Nima sababli muddatni uzaytirilgani
}
