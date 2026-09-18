import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as path from 'path';
import { DocumentsService } from './documents.service';

// ONLYOFFICE Document Server bilan integratsiya. Biriktirilgan Word fayllar
// haqiqiy online muharrirда ochiladi va saqlanganda faylga qaytadi.
//   - buildConfig: brauzer uchun imzolangan editor konfiguratsiyasi.
//   - file: DS faylni yuklab oladi (token bilan himoyalangan ochiq endpoint).
//   - callback: DS tahrir tugaganda yangilangan faylni shu yerga POST qiladi.
// Config va callback OnlyOffice JWT (shared secret) bilan imzolanadi.
@Injectable()
export class OnlyOfficeService {
  private readonly logger = new Logger('OnlyOffice');
  private readonly jwtSecret: string;
  // DS backendga (fayl olish + callback) shu manzil orqali yetadi.
  private readonly backendUrl: string;
  // Backend DS'dan tahrirlangan faylni shu ichki manzildan oladi.
  private readonly dsInternalUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly docs: DocumentsService,
  ) {
    // .env qiymatida ko'rinmas belgi (Windows'dan kelgan CRLF, bo'sh joy)
    // bo'lsa — imzo mos kelmaydi. Shuning uchun kesib tashlaymiz.
    this.jwtSecret = (this.config.get<string>('ONLYOFFICE_JWT_SECRET') || '').trim();
    // Ishga tushishда sirning "barmoq izi"ni bir marta yozamiz — DS bilan bir
    // xilligini tekshirish uchun (haqiqiy sirni ochib bermaydi). len=64 va
    // sha256_12=ba9cf20dfd66 kutiladi.
    const fp = this.jwtSecret
      ? crypto.createHash('sha256').update(this.jwtSecret).digest('hex').slice(0, 12)
      : '(bo\u2018sh)';
    this.logger.log(`JWT secret yuklandi: len=${this.jwtSecret.length} sha256_12=${fp}`);
    this.backendUrl = (
      this.config.get<string>('ONLYOFFICE_BACKEND_URL') ||
      'https://edo.asaka-motors.uz'
    ).replace(/\/+$/, '');
    this.dsInternalUrl = (
      this.config.get<string>('ONLYOFFICE_DS_INTERNAL_URL') ||
      'http://127.0.0.1:8080'
    ).replace(/\/+$/, '');
  }

  private documentType(filename: string): string {
    const e = path.extname(filename).toLowerCase();
    if (['.xls', '.xlsx', '.ods', '.csv'].includes(e)) return 'cell';
    if (['.ppt', '.pptx', '.odp'].includes(e)) return 'slide';
    return 'word';
  }

  // Brauzer uchun imzolangan editor config. userId — ruxsat tekshiruvi uchun.
  async buildConfig(
    userId: string,
    docId: string,
    attId: string,
    displayName: string,
  ) {
    if (!this.jwtSecret) {
      throw new BadRequestException(
        'OnlyOffice sozlanmagan (ONLYOFFICE_JWT_SECRET yo‘q)',
      );
    }
    const att = await this.docs.resolveAttachmentForOnlyOffice(
      userId,
      docId,
      attId,
    );
    const ext = path.extname(att.filename).replace('.', '').toLowerCase() || 'docx';

    const fileToken = this.jwt.sign(
      { docId, attId, act: 'file' },
      { secret: this.jwtSecret, expiresIn: '2h' },
    );
    const cbToken = this.jwt.sign(
      { docId, attId, act: 'callback' },
      { secret: this.jwtSecret, expiresIn: '24h' },
    );
    const base = `${this.backendUrl}/api/onlyoffice`;

    // document.key har ochishда noyob bo'lsin — DS bir marta ko'rgan kalitni
    // (hatto xato holatда) keshlaydi va faylni qayta o'qimaydi. Salt qo'shsak,
    // DS har safar faylni toza yuklaб, joriy nusxani ko'rsatadi.
    const rawKey = `${att.versionKey}-${Date.now().toString(36)}`;

    const config: any = {
      documentType: this.documentType(att.filename),
      document: {
        fileType: ext,
        key: rawKey.replace(/[^0-9a-zA-Z_-]/g, '').slice(0, 128),
        title: att.filename,
        url: `${base}/file/${docId}/${attId}?token=${fileToken}`,
        permissions: {
          edit: att.editable,
          download: true,
          print: true,
        },
      },
      editorConfig: {
        mode: att.editable ? 'edit' : 'view',
        lang: 'ru',
        callbackUrl: `${base}/callback/${docId}/${attId}?token=${cbToken}`,
        user: { id: userId, name: displayName || 'Foydalanuvchi' },
        customization: {
          forcesave: true,
          chat: false,
          comments: false,
          help: false,
        },
      },
    };
    config.token = this.jwt.sign(config, { secret: this.jwtSecret });
    return config;
  }

  // Fayl/callback URL'laridagi qisqa muddatli tokenni tekshiradi.
  verifyToken(token: string, act: string, docId: string, attId: string) {
    try {
      const p: any = this.jwt.verify(token, { secret: this.jwtSecret });
      if (p.act !== act || p.docId !== docId || p.attId !== attId) {
        throw new Error('mismatch');
      }
    } catch {
      throw new BadRequestException('Token yaroqsiz');
    }
  }

  // DS callback'ini qayta ishlaydi. Body OnlyOffice JWT bilan imzolangan.
  async handleCallback(docId: string, attId: string, body: any) {
    let payload = body;
    if (this.jwtSecret && body?.token) {
      try {
        payload = this.jwt.verify(body.token, { secret: this.jwtSecret });
      } catch {
        throw new BadRequestException('Callback token yaroqsiz');
      }
    }
    const status = payload?.status;
    // 2 = barcha muharrirlar chiqdi (saqlash kerak); 6 = force-save (tahrir davomida).
    if (status === 2 || status === 6) {
      const url: string = payload.url;
      if (url) {
        try {
          const buffer = await this.fetchEditedFile(url);
          await this.docs.saveOnlyOfficeEdit(docId, attId, buffer);
        } catch (e) {
          this.logger.error(`Saqlashда xato (att=${attId}): ${String(e)}`);
          return { error: 1 };
        }
      }
    }
    return { error: 0 };
  }

  // DS bergan URL o'z (ichki) manzilini ko'rsatadi — host qismini backend
  // yeta oladigan ichki manzilga almashtiramiz, yo'l va so'rovni saqlaymiz.
  private async fetchEditedFile(dsUrl: string): Promise<Buffer> {
    let fetchUrl = dsUrl;
    try {
      const u = new URL(dsUrl);
      fetchUrl = `${this.dsInternalUrl}${u.pathname}${u.search}`;
    } catch {}
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new BadRequestException('Tahrirlangan faylni olishда xato');
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
}
