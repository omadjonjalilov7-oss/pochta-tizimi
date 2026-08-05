import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Google Gemini orqali matn tarjimasi. API kaliti faqat serverda (.env) saqlanadi
// va hech qachon frontendga chiqmaydi. Frontend faqat /api/translate ga murojaat qiladi.

// Til kodlari → Gemini uchun tushunarli nom.
const LANG_NAMES: Record<string, string> = {
  auto: 'the source language (auto-detect)',
  uz: 'Uzbek (Latin script)',
  uzc: 'Uzbek (Cyrillic script)',
  ru: 'Russian',
  en: 'English',
  tr: 'Turkish',
  kk: 'Kazakh',
  ky: 'Kyrgyz',
  tg: 'Tajik',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
};

// Bitta elementning umumiy uzunligi chegarasi. Undan uzun matn avtomatik
// bo'laklarga bo'linadi (chunk), shuning uchun chegara yuqori.
const MAX_ITEM_LEN = 200_000;
const MAX_ITEMS = 5;
// Har bir Gemini so'rovi uchun matn bo'lagi (belgi). Uzun xabarlar shu
// hajmda bo'laklanadi va ketma-ket tarjima qilinadi.
const CHUNK_LEN = 12_000;

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  constructor(private readonly config: ConfigService) {}

  supportedLanguages() {
    return Object.keys(LANG_NAMES).filter((k) => k !== 'auto');
  }

  async translate(items: string[], to: string, from = 'auto'): Promise<string[]> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Tarjima xizmati sozlanmagan (GEMINI_API_KEY yo\'q)');
    }
    if (!LANG_NAMES[to]) {
      throw new BadRequestException('Noto\'g\'ri maqsad tili');
    }
    const model = this.config.get<string>('GEMINI_MODEL') || 'gemini-flash-latest';

    // Bo'sh bo'lmagan elementlarni tarjima qilamiz; bo'sh joyni asl holida qaytaramiz.
    const out: string[] = [];
    for (const raw of items) {
      const text = (raw ?? '').toString();
      if (!text.trim()) {
        out.push(text);
        continue;
      }
      out.push(await this.translateOne(text, to, from, model, apiKey));
    }
    return out;
  }

  // Uzun matnni bo'laklarga bo'lib, har birini alohida tarjima qiladi va
  // natijalarni birlashtiradi. Bo'lish afzal ravishda qator (\n) chegaralarida
  // amalga oshiriladi — HTML teglari imkon qadar buzilmasligi uchun.
  private chunkText(text: string): string[] {
    if (text.length <= CHUNK_LEN) return [text];
    const chunks: string[] = [];
    const lines = text.split(/(?<=\n)/); // \n belgisini saqlab bo'lamiz
    let cur = '';
    for (const line of lines) {
      if (cur && cur.length + line.length > CHUNK_LEN) {
        chunks.push(cur);
        cur = '';
      }
      if (line.length > CHUNK_LEN) {
        // Juda uzun bitta qator — majburan kesamiz
        let rest = line;
        while (rest.length > CHUNK_LEN) {
          chunks.push(rest.slice(0, CHUNK_LEN));
          rest = rest.slice(CHUNK_LEN);
        }
        cur = rest;
      } else {
        cur += line;
      }
    }
    if (cur) chunks.push(cur);
    return chunks;
  }

  private async translateOne(
    text: string,
    to: string,
    from: string,
    model: string,
    apiKey: string,
  ): Promise<string> {
    const chunks = this.chunkText(text);
    if (chunks.length === 1) {
      return this.translateChunk(chunks[0], to, from, model, apiKey);
    }
    const parts: string[] = [];
    for (const chunk of chunks) {
      parts.push(await this.translateChunk(chunk, to, from, model, apiKey));
    }
    return parts.join('');
  }

  private async translateChunk(
    text: string,
    to: string,
    from: string,
    model: string,
    apiKey: string,
  ): Promise<string> {
    const sourceHint =
      from && from !== 'auto' && LANG_NAMES[from]
        ? ` The source text is in ${LANG_NAMES[from]}.`
        : '';
    const prompt =
      `You are a professional translator for official corporate correspondence. ` +
      `Translate the text below into ${LANG_NAMES[to]}.${sourceHint} ` +
      `Keep any HTML tags, line breaks and formatting exactly as they are. ` +
      `Do not add explanations, notes or quotation marks — output ONLY the translated text.\n\n` +
      text;

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    let resp: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      this.logger.error(`Gemini so'rovi muvaffaqiyatsiz: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Tarjima xizmatiga ulanib bo\'lmadi');
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      this.logger.error(`Gemini xato ${resp.status}: ${body.slice(0, 300)}`);
      throw new ServiceUnavailableException('Tarjima xizmatida xatolik');
    }

    const data = (await resp.json()) as GeminiResponse;
    const translated = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!translated) {
      this.logger.warn('Gemini bo\'sh javob qaytardi');
      throw new ServiceUnavailableException('Tarjima natijasi bo\'sh');
    }
    return translated;
  }

  static validateItems(items: unknown): string[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Tarjima uchun matn yo\'q');
    }
    if (items.length > MAX_ITEMS) {
      throw new BadRequestException('Juda ko\'p element');
    }
    return items.map((it) => {
      const s = (it ?? '').toString();
      if (s.length > MAX_ITEM_LEN) {
        throw new BadRequestException('Matn juda uzun');
      }
      return s;
    });
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}
