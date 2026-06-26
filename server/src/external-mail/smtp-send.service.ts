import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from './crypto.util';

interface SendExternalArgs {
  fromUserId: string;
  fromUserFullName: string;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  signatureHtml?: string; // Tahrirlanmaydigan imzo (alohida)
  messageId: string; // ichki Message.id (tracking pixel uchun)
  attachments?: Array<{ filename: string; path: string }>;
}

@Injectable()
export class SmtpSendService {
  private readonly logger = new Logger(SmtpSendService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getHost(): string {
    return process.env.EXTERNAL_MAIL_SMTP_HOST || 'mail.asaka-motors.uz';
  }
  private getPort(): number {
    return Number(process.env.EXTERNAL_MAIL_SMTP_PORT || 465);
  }

  /**
   * Tashqi qabul qiluvchilarga foydalanuvchining @asaka-motors.uz akkaunti orqali
   * SMTP bilan xabar yuboradi. Har bir tashqi email uchun unique tracking pixel qo'shadi.
   */
  async sendExternal(args: SendExternalArgs): Promise<{ ok: boolean; error?: string }> {
    const u = await this.prisma.user.findUnique({
      where: { id: args.fromUserId },
      select: {
        externalMailLogin: true,
        externalMailPasswordEnc: true,
        externalMailEnabled: true,
      },
    });

    if (!u?.externalMailEnabled || !u.externalMailLogin || !u.externalMailPasswordEnc) {
      return {
        ok: false,
        error:
          "Tashqi pochta ulanmagan. Profil sahifasidan @asaka-motors.uz pochtangizni ulang.",
      };
    }

    let password: string;
    try {
      password = decryptSecret(u.externalMailPasswordEnc);
    } catch {
      return { ok: false, error: "Saqlangan parolni dekriptlab bo'lmadi" };
    }

    const transporter = nodemailer.createTransport({
      host: this.getHost(),
      port: this.getPort(),
      secure: this.getPort() === 465,
      auth: { user: u.externalMailLogin, pass: password },
      tls: { rejectUnauthorized: false },
    });

    // Har bir tashqi qabul qiluvchi uchun tracking record yaratamiz
    const trackingRecords = await Promise.all(
      [...args.toEmails, ...args.ccEmails].map((email) =>
        this.prisma.externalReadReceipt.create({
          data: {
            messageId: args.messageId,
            email: email.toLowerCase(),
            trackToken: crypto.randomBytes(24).toString('hex'),
            readLinkToken: crypto.randomBytes(24).toString('hex'), // Tracking link token
          },
        }),
      ),
    );

    const serverUrl = process.env.SERVER_PUBLIC_URL || 'http://localhost:3000';

    // Har bir qabul qiluvchi uchun alohida xabar yuboramiz — har birida o'ziga xos tracking pixel + link
    let sentOk = 0;
    const errors: string[] = [];
    for (const rec of trackingRecords) {
      const pixelUrl = `${serverUrl}/api/external-mail/track/${rec.trackToken}.gif`;
      const linkUrl = `${serverUrl}/api/external-mail/track-link/${rec.readLinkToken}`;

      // Tracking pixel (invisible)
      const trackingPixelHtml = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;margin:0;padding:0" />`;

      // Tracking button (visible) - "O'qishni tasdiqlash" tugmasi
      const trackingButtonHtml = `
        <div style="margin:24px 0;padding:16px;background-color:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;text-align:center">
          <p style="margin:0 0 12px 0;font-size:13px;color:#1e40af;font-weight:500">
            Xabarni o'qib ko'rgansiz uchun quyidagi tugmani bosing:
          </p>
          <a href="${linkUrl}" style="display:inline-block;padding:10px 24px;background-color:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;transition:background-color 0.2s">
            ✓ O'qishni tasdiqlash
          </a>
        </div>
      `;

      // HTML emailga o'rab olish — FAQAT SMTP'GA, storage'ga emas
      // Body + Signature + Tracking button/pixel
      const htmlForEmail = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 0; }
    .content { padding: 20px; background-color: #fff; }
    .signature { padding-top: 0; border-top: none; background-color: #f9fafb; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      ${args.bodyHtml}
      ${trackingButtonHtml}
    </div>
    ${args.signatureHtml ? `<div class="signature">${args.signatureHtml}</div>` : ''}
    ${trackingPixelHtml}
  </div>
</body>
</html>`;

      const isCc = args.ccEmails.includes(rec.email);
      try {
        await transporter.sendMail({
          from: { name: args.fromUserFullName, address: u.externalMailLogin },
          to: isCc ? undefined : rec.email,
          cc: isCc ? rec.email : undefined,
          subject: args.subject,
          html: htmlForEmail,
          text: args.bodyText,
          priority: 'normal',
          replyTo: u.externalMailLogin,
          headers: {
            // O'qish kvitansiyasi so'rovi (RFC 8098)
            'Disposition-Notification-To': u.externalMailLogin,
            'X-Confirm-Reading-To': u.externalMailLogin,
            // Spam filtering yaxshilashtirish
            'X-Mailer': 'Pochta 1.0',
            'X-Priority': '3',
            'Importance': 'normal',
            'X-MSMail-Priority': 'Normal',
          },
          attachments: args.attachments?.map((a) => ({
            filename: a.filename,
            path: a.path,
          })),
        });
        sentOk++;
        this.logger.log(`[SMTP] Xabar yuborildi: ${rec.email} (tracking: pixel + link)`);
      } catch (err: any) {
        this.logger.warn(`SMTP send xato (${rec.email}): ${err?.message || err}`);
        errors.push(`${rec.email}: ${err?.message || err}`);
      }
    }

    transporter.close();

    if (sentOk === 0 && errors.length > 0) {
      return { ok: false, error: errors.join('; ') };
    }
    if (errors.length > 0) {
      this.logger.warn(`SMTP qisman muvaffaqiyatli: ${sentOk}/${trackingRecords.length}`);
    }
    return { ok: true };
  }

  /**
   * Tracking pixel yuklanganda — o'qish vaqtini yozib qo'yamiz.
   * Faqat birinchi marta qaydlanadi, keyingi yuklanishlar e'tiborga olinmaydi.
   */
  async markPixelRead(
    trackToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const r = await this.prisma.externalReadReceipt.findUnique({
      where: { trackToken },
      select: { id: true, readAt: true, messageId: true, email: true },
    });
    if (!r) return;
    if (r.readAt) return; // allaqachon yozilgan
    await this.prisma.externalReadReceipt.update({
      where: { id: r.id },
      data: {
        readAt: new Date(),
        readMethod: 'pixel', // ← Pixel orqali o'qildi
        readIp: ip?.slice(0, 64) || null,
        readUserAgent: userAgent?.slice(0, 1000) || null,
      },
    });
    this.logger.log(`Tashqi o'qish kvitansiyasi (PIXEL): ${r.email} (msg ${r.messageId})`);
  }

  /**
   * Tracking link bosilganda — o'qish vaqtini yozib qo'yamiz.
   * User link'ni bosgan demak, message'ni aniq o'qib ko'rgan.
   */
  async markLinkRead(
    readLinkToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const r = await this.prisma.externalReadReceipt.findUnique({
      where: { readLinkToken },
      select: { id: true, readAt: true, messageId: true, email: true },
    });
    if (!r) return;
    if (r.readAt) return; // allaqachon yozilgan
    await this.prisma.externalReadReceipt.update({
      where: { id: r.id },
      data: {
        readAt: new Date(),
        readMethod: 'link', // ← Link click orqali o'qildi
        readIp: ip?.slice(0, 64) || null,
        readUserAgent: userAgent?.slice(0, 1000) || null,
      },
    });
    this.logger.log(`Tashqi o'qish kvitansiyasi (LINK): ${r.email} (msg ${r.messageId})`);
  }
}
