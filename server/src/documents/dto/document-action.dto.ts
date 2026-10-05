import {
  ArrayMaxSize,
  IsArray,
  IsBase64,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Hujjatni tasdiqlash. Ikki usul:
//   1) PIN — 4 xonali kod (elektron kaliti yo'q xodimlar uchun, zaxira usul);
//   2) E-IMZO — elektron kalit bilan imzolash (pkcs7Data... maydonlari to'ldiriladi).
// Qaysi usul ekani yuborilgan maydonlarga qarab aniqlanadi: pkcs7Data bo'lsa — E-IMZO.
// addApproverIds — joriy tasdiqlovchi o'zidan keyin zanjirga qo'shimcha tasdiqlovchilar
// kiritmoqchi bo'lsa shu yerda ro'yxat sifatida beradi.
export class ApproveDocumentDto {
  // PIN endi IXTIYORIY — E-IMZO bilan tasdiqlanganda talab qilinmaydi.
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN aniq 4 raqamdan iborat bo'lishi shart" })
  pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  approvalNotes?: string; // Tasdiq xususi izohatlari (ixtiyoriy)

  @IsOptional()
  @IsString()
  @MaxLength(20)
  approvalMethod?: string; // 'eimzo', 'signature', 'qr', 'digital', 'manual'

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  addApproverIds?: string[];

  // ── E-IMZO (elektron kalit) bilan tasdiqlash maydonlari ──────────────
  // CAPIWS'dan qaytgan PKCS#7 (CMS) imzo, base64.
  @IsOptional()
  @IsBase64()
  pkcs7Data?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  certSerial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  certSubject?: string;

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

  // Imzolangan kanonik matnning SHA-256 hash'i (hex). Server o'zi qayta hisoblab
  // taqqoslaydi — mos kelmasa imzo rad etiladi (hujjat o'zgartirilgan/boshqa).
  @IsOptional()
  @IsString()
  @MaxLength(128)
  signatureHash?: string;
}

// Admin/kanselyariya hujjat tasdiqlash zanjiriga qo'shimcha xodim(lar) qo'shadi.
// Bu tasdiqlash EMAS — faqat zanjirga yangi tasdiqlovchi kiritish, shu sababli
// PIN talab qilinmaydi. Hujjat hali yakunlanmagan (in_review/in_progress/overdue)
// bo'lishi kerak.
export class AddApproversDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  approverIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
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

// Kiruvchi hujjatni rahbarga ma'ruza qilish — kanselyariya/yaratuvchi
// ro'yxatdan rahbarni tanlaydi, hujjat unga ko'rib chiqish uchun boradi va
// rahbar rezolyutsiya (topshiriq) yozadi.
export class PresentToLeaderDto {
  @IsUUID()
  leaderId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
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
