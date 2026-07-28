import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  // Ichki hujjat turi. Faqat type === 'internal' uchun ma'noli.
  // service_letter avtomatik zanjir bilan; qolganlari hozircha buyruq kabi.
  @IsOptional()
  @IsIn([
    'service_letter',
    'order',
    'protocol',
    'directive',
    'decision',
    'conclusion',
    'joint_plan',
  ])
  internalKind?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  subject: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortInfo?: string;

  @IsOptional()
  @IsString()
  body?: string;

  // Raqamlash uchun bo'lim (odatda yaratuvchining bo'limi)
  @IsOptional()
  @IsUUID()
  numberDeptId?: string;

  // Hujjat qaysi bo'limga yuborilayotgani (qabul qiluvchi bo'lim)
  @IsOptional()
  @IsUUID()
  targetDeptId?: string;

  // Qo'lda tanlangan shablon. Bo'sh bo'lsa — hujjat "ichki" shabloniga
  // avtomat solinadi (yuborishda).
  @IsOptional()
  @IsUUID()
  templateId?: string;

  // Tashqi qabul qiluvchi (faqat outgoing tipida)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalRecipient?: string;

  // Yuboruvchi tashkilot (kiruvchi/tashqi hujjat uchun) — Organization id
  @IsOptional()
  @IsUUID()
  senderOrgId?: string;

  // Ro'yxatga olish jurnali (kategoriya) — Journal id
  @IsOptional()
  @IsUUID()
  journalId?: string;

  // Bajarish muddati — ISO sanasi (frontend datetime-local'dan keladi)
  @IsOptional()
  @IsDateString()
  deadline?: string;

  // Tasdiqlash zanjiri — tartibli foydalanuvchi UUID ro'yxati (1-tasdiqlovchi, 2-tasdiqlovchi, ...).
  // Bo'sh bo'lsa, serverda eski mantiq (yaratuvchi+qabul qiluvchi bo'lim boshlig'i) ishlatiladi.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  approverIds?: string[];

  // ── Yaratish formasidagi qo'shimcha maydonlar ──
  // Masalalar guruhi
  @IsOptional()
  @IsString()
  @MaxLength(255)
  issueGroup?: string;

  // Masalalar
  @IsOptional()
  @IsString()
  @MaxLength(255)
  issues?: string;

  // Hujjat heshteglari
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  // XDFU / DSP rejimi
  @IsOptional()
  @IsBoolean()
  xdfuDsp?: boolean;

  // QR kodsiz yaratish
  @IsOptional()
  @IsBoolean()
  qrLess?: boolean;

  // Qabul qiluvchiga murojaat sifatida yetkazish (outgoing)
  @IsOptional()
  @IsBoolean()
  deliverAsAppeal?: boolean;

  // Javob xati talab qilinadi (outgoing)
  @IsOptional()
  @IsBoolean()
  replyRequired?: boolean;

  // Imzodan so'ng kelishuvchilar ro'yxatini shakllantirish (internal)
  @IsOptional()
  @IsBoolean()
  formApproversAfterSign?: boolean;

  // ── Kiruvchi korrespondensiyani ro'yxatga olish maydonlari ──
  @IsOptional()
  @IsString()
  @MaxLength(32)
  deliveryType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  incomingDocKind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  docName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  higherOrder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  predmet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  incomingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  outgoingNumber?: string;

  @IsOptional()
  @IsDateString()
  incomingDate?: string;

  @IsOptional()
  @IsDateString()
  outgoingDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  signatory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  executor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactPhone?: string;

  @IsOptional()
  @IsBoolean()
  directRouting?: boolean;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;
}
