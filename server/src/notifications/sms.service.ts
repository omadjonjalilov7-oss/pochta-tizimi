import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// SMS shlyuzi (Eskiz.uz) bilan integratsiya.
//   .env: ESKIZ_EMAIL, ESKIZ_PASSWORD, ESKIZ_FROM (tasdiqlangan sender, mas: "4546").
// Token 30 kunga yaroqli — keshlaymiz, 401 bo'lsa qayta login qilamiz.
// Kredensiallar bo'lmasa — sms xizmati o'chiq (jim o'tadi).
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SMS');
  private readonly base = 'https://notify.eskiz.uz/api';
  private readonly email: string;
  private readonly password: string;
  private readonly from: string;
  private token: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.email = (this.config.get<string>('ESKIZ_EMAIL') || '').trim();
    this.password = (this.config.get<string>('ESKIZ_PASSWORD') || '').trim();
    this.from = (this.config.get<string>('ESKIZ_FROM') || '4546').trim();
  }

  get enabled(): boolean {
    return !!(this.email && this.password);
  }

  // Telefon raqamini 998XXXXXXXXX ko'rinishiga keltiradi. Yaroqsiz bo'lsa null.
  private normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    let d = phone.replace(/\D/g, '');
    if (d.length === 9) d = '998' + d; // XXXXXXXXX
    if (d.length === 12 && d.startsWith('998')) return d;
    return null;
  }

  private async login(): Promise<string | null> {
    try {
      const form = new URLSearchParams();
      form.set('email', this.email);
      form.set('password', this.password);
      const res = await fetch(`${this.base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const data: any = await res.json().catch(() => ({}));
      const token = data?.data?.token;
      if (!token) {
        this.logger.warn(`Eskiz login muvaffaqiyatsiz: ${JSON.stringify(data).slice(0, 200)}`);
        return null;
      }
      this.token = token;
      return token;
    } catch (e) {
      this.logger.warn(`Eskiz login istisno: ${String(e)}`);
      return null;
    }
  }

  // Bitta raqamga SMS. Muvaffaqiyat bo'lsa true.
  async sendToPhone(phone: string | null | undefined, message: string): Promise<boolean> {
    if (!this.enabled) return false;
    const mobile = this.normalizePhone(phone);
    if (!mobile) return false;

    let token = this.token || (await this.login());
    if (!token) return false;

    const doSend = async (t: string) => {
      const form = new URLSearchParams();
      form.set('mobile_phone', mobile);
      form.set('message', message);
      form.set('from', this.from);
      return fetch(`${this.base}/message/sms/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
    };

    try {
      let res = await doSend(token);
      if (res.status === 401) {
        // Token eskirgan — qayta login qilib bir marta urinamiz.
        token = (await this.login()) || '';
        if (!token) return false;
        res = await doSend(token);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`SMS xato ${res.status} (${mobile}): ${body.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`SMS istisno (${mobile}): ${String(e)}`);
      return false;
    }
  }
}
