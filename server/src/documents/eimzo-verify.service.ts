import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export interface SignatureVerifyInput {
  pkcs7Base64: string;
  payload: string; // server tomonda qurilgan kanonik imzolanadigan matn
  submittedHash?: string; // frontend hisoblagan SHA-256 (hex)
  certValidFrom?: string | Date | null;
  certValidTo?: string | Date | null;
}

export interface SignatureVerifyResult {
  verified: boolean; // E-IMZO server orqali to'liq kriptografik tasdiqlanganmi
  method: 'eimzo-server' | 'structural';
  tsaTime: Date | null; // TSA vaqt tamg'asi (uzoq muddatli yuridik kuch)
  error: string | null; // strukturaviy rejimda ogohlantirish matni
}

// E-IMZO (O'zbekiston) imzosini tekshirish.
//
// MUHIM: O'zbekiston E-IMZO imzolari GOST (O'zDSt 1092:2009, 1106:2009)
// algoritmlarida yaratiladi. Bu algoritmlarni oddiy Node.js kutubxonalari
// kriptografik tekshira olmaydi — buning uchun rasmiy "E-IMZO Server"
// (yoki DSV) tekshiruv xizmati kerak.
//
// Shu sabab bu servis ikki rejimda ishlaydi:
//   1) TO'LIQ (yuridik kuchga ega) — EIMZO_VERIFY_URL sozlangan bo'lsa:
//      PKCS#7 E-IMZO server xizmatiga yuboriladi, imzo + sertifikat zanjiri
//      tekshiriladi, TSA vaqt tamg'asi olinadi.
//   2) STRUKTURAVIY (server ulanmagan holatda) — hujjat butunligini
//      kafolatlaydi: server imzolanadigan matndan SHA-256 ni QAYTA hisoblab,
//      frontend yuborgan hash bilan taqqoslaydi (mos kelmasa — rad etiladi)
//      va sertifikat amal muddatini tekshiradi. Imzo blobi bazada saqlanadi,
//      shuning uchun E-IMZO server ulangach keyin ham qayta tekshirsa bo'ladi.
@Injectable()
export class EimzoVerifyService {
  private readonly logger = new Logger('EimzoVerify');

  constructor(private readonly config: ConfigService) {}

  private sha256Hex(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }

  async verify(input: SignatureVerifyInput): Promise<SignatureVerifyResult> {
    // 1) Hujjat butunligi: server hash'ni o'zi qayta hisoblaydi (frontendga ishonmaymiz).
    const serverHash = this.sha256Hex(input.payload);
    if (input.submittedHash) {
      if (input.submittedHash.toLowerCase() !== serverHash.toLowerCase()) {
        throw new BadRequestException(
          "Imzo hujjat mazmuniga mos kelmadi — hujjat o'zgartirilgan bo'lishi mumkin. Tasdiqlash bekor qilindi.",
        );
      }
    }

    // 2) PKCS#7 blobi sanity
    let pkcs7: Buffer;
    try {
      pkcs7 = Buffer.from(input.pkcs7Base64, 'base64');
    } catch {
      throw new BadRequestException("PKCS#7 imzosi noto'g'ri formatda");
    }
    if (pkcs7.length < 64) {
      throw new BadRequestException("PKCS#7 imzosi juda kichik — noto'g'ri ma'lumot");
    }

    // 3) Sertifikat amal muddati
    const now = Date.now();
    const vFrom = input.certValidFrom ? new Date(input.certValidFrom).getTime() : null;
    const vTo = input.certValidTo ? new Date(input.certValidTo).getTime() : null;
    if (vTo !== null && !Number.isNaN(vTo) && vTo < now) {
      throw new BadRequestException("Elektron kalit (sertifikat) muddati tugagan");
    }
    if (vFrom !== null && !Number.isNaN(vFrom) && vFrom > now) {
      throw new BadRequestException("Elektron kalit (sertifikat) hali kuchga kirmagan");
    }

    // 4) To'liq kriptografik tekshiruv — E-IMZO server orqali (sozlangan bo'lsa)
    const verifyUrl = this.config.get<string>('EIMZO_VERIFY_URL');
    if (verifyUrl) {
      return this.verifyWithEimzoServer(verifyUrl, input.pkcs7Base64);
    }

    // 5) Server ulanmagan — strukturaviy rejim
    this.logger.warn(
      'EIMZO_VERIFY_URL sozlanmagan — imzo faqat strukturaviy tekshirildi (to\'liq kriptografik tekshiruv yo\'q).',
    );
    return {
      verified: false,
      method: 'structural',
      tsaTime: null,
      error: "E-IMZO server ulanmagan: imzo strukturaviy tekshirildi (hash + sertifikat muddati). To'liq kriptografik tekshiruv uchun EIMZO_VERIFY_URL sozlang.",
    };
  }

  private async verifyWithEimzoServer(
    verifyUrl: string,
    pkcs7Base64: string,
  ): Promise<SignatureVerifyResult> {
    const timeoutMs = parseInt(this.config.get('EIMZO_VERIFY_TIMEOUT_MS', '10000'), 10);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pkcs7: pkcs7Base64, pkcs7_64: pkcs7Base64 }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new Error(`E-IMZO server HTTP ${resp.status}`);
      }
      const data: any = await resp.json();
      // Turli E-IMZO server implementatsiyalariga moslashuvchan o'qish
      const ok =
        data?.success === true ||
        data?.status === 1 ||
        data?.status === '1' ||
        data?.valid === true;
      if (!ok) {
        throw new BadRequestException(
          `Elektron imzo tekshiruvdan o'tmadi: ${data?.reason || data?.message || 'noma\'lum sabab'}`,
        );
      }
      // TSA / imzo vaqtini topishga harakat qilamiz
      const signer = data?.pkcs7Info?.signers?.[0] || data?.signers?.[0] || data;
      const tsaRaw =
        signer?.tsaStampTime ||
        signer?.tsaTime ||
        signer?.signingTime ||
        data?.timeStampTokenInfo?.genTime ||
        null;
      const tsaTime = tsaRaw ? new Date(tsaRaw) : null;
      return {
        verified: true,
        method: 'eimzo-server',
        tsaTime: tsaTime && !Number.isNaN(tsaTime.getTime()) ? tsaTime : null,
        error: null,
      };
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      // Server sozlangan, lekin ulanib bo'lmadi — YURIDIK KUCH talab qilingani uchun
      // tasdiqlashni to'xtatamiz (imzo tasdiqlanmaguncha qabul qilinmaydi).
      this.logger.error(`E-IMZO server tekshiruvi muvaffaqiyatsiz: ${e?.message}`);
      throw new BadRequestException(
        "Elektron imzoni tekshirish xizmatiga ulanib bo'lmadi. Keyinroq qayta urinib ko'ring.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
