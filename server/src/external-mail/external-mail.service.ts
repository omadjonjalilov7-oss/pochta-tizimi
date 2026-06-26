import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectExternalMailDto } from './dto/connect-external-mail.dto';
import { decryptSecret, encryptSecret } from './crypto.util';

const ALLOWED_DOMAIN = 'asaka-motors.uz';

@Injectable()
export class ExternalMailService {
  private readonly logger = new Logger(ExternalMailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getImapHost(): string {
    return process.env.EXTERNAL_MAIL_IMAP_HOST || 'mail.asaka-motors.uz';
  }
  private getImapPort(): number {
    return Number(process.env.EXTERNAL_MAIL_IMAP_PORT || 993);
  }

  /**
   * IMAP serverga sinov ulanishi. Login muvaffaqiyatli bo'lsa true qaytaradi.
   */
  async testConnection(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const client = new ImapFlow({
      host: this.getImapHost(),
      port: this.getImapPort(),
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
      // tls sertifikati o'z-o'zidan imzolangan bo'lsa ham qabul qilamiz (LAN ichida)
      tls: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      await client.logout();
      return { ok: true };
    } catch (err: any) {
      this.logger.warn(`IMAP test failed for ${email}: ${err?.message || err}`);
      return { ok: false, error: err?.message || 'Ulanib bo\'lmadi' };
    }
  }

  async getStatus(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        externalMailLogin: true,
        externalMailEnabled: true,
        externalMailLastSyncAt: true,
      },
    });
    return {
      connected: !!u?.externalMailEnabled,
      email: u?.externalMailLogin || null,
      lastSyncAt: u?.externalMailLastSyncAt || null,
      domain: ALLOWED_DOMAIN,
    };
  }

  async connect(userId: string, dto: ConnectExternalMailDto) {
    const email = dto.email.trim().toLowerCase();
    if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
      throw new ForbiddenException(`Faqat @${ALLOWED_DOMAIN} pochta manzili qo\'shilishi mumkin`);
    }

    // Avval ulanishni sinab ko'ramiz
    const test = await this.testConnection(email, dto.password);
    if (!test.ok) {
      throw new BadRequestException(
        `Pochta serveriga ulanib bo\'lmadi: ${test.error || 'parol noto\'g\'ri'}`,
      );
    }

    const enc = encryptSecret(dto.password);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        externalMailLogin: email,
        externalMailPasswordEnc: enc,
        externalMailEnabled: true,
        externalMailLastUid: null, // yangi ulanishda UID ni resetlaymiz
      },
    });

    return { ok: true, email };
  }

  /**
   * Sinxronlash kursorini reset qiladi — keyingi pollda eng oxirgi N ta xabar qaytadan tekshiriladi.
   * Foydalanuvchi "qayta sinxronlash" tugmasini bosganda.
   */
  async resync(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { externalMailLastUid: 0, externalMailLastSyncAt: null },
    });
    return { ok: true, message: 'Keyingi sinxronizatsiyada eski xabarlar ham olib kelinadi (~200 ta)' };
  }

  async disconnect(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        externalMailLogin: null,
        externalMailPasswordEnc: null,
        externalMailEnabled: false,
        externalMailLastSyncAt: null,
        externalMailLastUid: null,
      },
    });
    return { ok: true };
  }

  /**
   * Foydalanuvchining shifrlangan parolini dekriptlab qaytaradi.
   * IMAP/SMTP polling vazifasi tomonidan ishlatiladi.
   */
  async getDecryptedCredentials(
    userId: string,
  ): Promise<{ email: string; password: string } | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        externalMailLogin: true,
        externalMailPasswordEnc: true,
        externalMailEnabled: true,
      },
    });
    if (!u?.externalMailEnabled || !u.externalMailLogin || !u.externalMailPasswordEnc) {
      return null;
    }
    try {
      return { email: u.externalMailLogin, password: decryptSecret(u.externalMailPasswordEnc) };
    } catch (err) {
      this.logger.error(`Decrypt failed for user ${userId}`, err);
      return null;
    }
  }
}
