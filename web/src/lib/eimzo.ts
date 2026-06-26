// E-IMZO CAPIWS klient — mahalliy WebSocket xizmati orqali sertifikatlarni o'qish va PKCS#7 yaratish.
//
// CAPIWS — bu O'zbekiston Respublikasi E-IMZO infratuzilmasining mahalliy komponenti.
// Foydalanuvchi kompyuterida 64443 portda ishlaydigan xizmat: wss://127.0.0.1:64443/service/cryptapi
//
// Foydalanish:
//   const client = new EimzoClient();
//   await client.connect();
//   const certs = await client.listAllUserKeys();   // sertifikatlar ro'yxati
//   const keyId = await client.loadKey(cert);        // PIN dialog ochiladi
//   const pkcs7Base64 = await client.createPkcs7(keyId, data);
//   client.close();

const CAPIWS_URL = 'wss://127.0.0.1:64443/service/cryptapi';

export interface EimzoCert {
  disk: string;
  path: string;
  name: string; // certificate path
  alias: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  CN: string;
  TIN: string;
  PINFL: string;
  O: string;
  T: string;
}

interface CapiwsResponse {
  success: boolean;
  reason?: string;
  [key: string]: any;
}

export class EimzoError extends Error {
  constructor(message: string, public readonly cause?: string) {
    super(message);
    this.name = 'EimzoError';
  }
}

export class EimzoClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: CapiwsResponse) => void; reject: (e: Error) => void }
  >();
  private connectionPromise: Promise<void> | null = null;

  async connect(timeoutMs = 5000): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(CAPIWS_URL);
      } catch (e) {
        reject(new EimzoError('E-IMZO xizmatiga ulanib bo\'lmadi', (e as Error).message));
        return;
      }

      const timer = setTimeout(() => {
        try { ws.close(); } catch { /* noop */ }
        reject(
          new EimzoError(
            "E-IMZO xizmati javob bermayapti. Iltimos, E-IMZO dasturini ishga tushiring va qaytadan urinib ko'ring.",
          ),
        );
      }, timeoutMs);

      ws.onopen = () => {
        clearTimeout(timer);
        this.ws = ws;
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timer);
        reject(
          new EimzoError(
            "E-IMZO xizmati topilmadi. Iltimos, E-IMZO dasturini ishga tushiring (https://e-imzo.uz)",
          ),
        );
      };

      ws.onclose = () => {
        // Barcha kutilayotgan so'rovlarni qaytaramiz
        for (const { reject } of this.pending.values()) {
          reject(new EimzoError('E-IMZO ulanishi yopildi'));
        }
        this.pending.clear();
        this.ws = null;
        this.connectionPromise = null;
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // CAPIWS javoblari id qaytaradi (agar so'rovda yuborilsa)
          // Asl protokol: { id, success, reason, ...payload }
          const id = raw.id;
          if (typeof id === 'number' && this.pending.has(id)) {
            const handler = this.pending.get(id)!;
            this.pending.delete(id);
            if (raw.success === false) {
              handler.reject(new EimzoError(raw.reason || 'E-IMZO xatosi', raw.reason));
            } else {
              handler.resolve(raw);
            }
          }
        } catch (e) {
          console.error('[E-IMZO] xato javob:', e);
        }
      };
    });

    return this.connectionPromise;
  }

  private send(plugin: string, name: string, args: any[]): Promise<CapiwsResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new EimzoError("E-IMZO ulanmagan"));
    }
    const id = this.nextId++;
    const payload = { id, plugin, name, arguments: args };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(payload));
    });
  }

  async listAllUserKeys(): Promise<EimzoCert[]> {
    const resp = await this.send('pfx', 'list_all_certificates', []);
    const items = resp.certificates as any[] | undefined;
    if (!items || items.length === 0) {
      throw new EimzoError(
        "Sertifikatlar topilmadi. E-IMZO kalitlaringiz mavjudligini tekshiring.",
      );
    }
    return items.map((c) => ({
      disk: c.disk,
      path: c.path,
      name: c.name,
      alias: c.alias ?? c.subjectName ?? c.CN ?? c.name,
      serialNumber: c.serialNumber ?? '',
      validFrom: c.validFrom ?? '',
      validTo: c.validTo ?? '',
      CN: c.CN ?? '',
      TIN: c.TIN ?? '',
      PINFL: c.PINFL ?? '',
      O: c.O ?? '',
      T: c.T ?? '',
    }));
  }

  async loadKey(cert: EimzoCert): Promise<string> {
    const resp = await this.send('pfx', 'load_key', [cert.disk, cert.path, cert.name, cert.alias]);
    const keyId = (resp.keyId as string) || (resp.id as string);
    if (!keyId) throw new EimzoError("E-IMZO kalit ID qaytarmadi");
    return keyId;
  }

  // PKCS#7 (CMS) imzosini yaratish. `data` — base64 ko'rinishida ma'lumot, `attached=true` —
  // imzo ichida ma'lumotning o'zi ham bo'ladi.
  async createPkcs7(keyId: string, data: string, attached = true): Promise<string> {
    const resp = await this.send('pkcs7', 'create_pkcs7', [data, keyId, attached ? 'yes' : 'no']);
    const pkcs7 = (resp.pkcs7_64 as string) || (resp.pkcs7 as string);
    if (!pkcs7) throw new EimzoError("PKCS#7 imzo qaytarilmadi");
    return pkcs7;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
    this.connectionPromise = null;
    this.pending.clear();
  }
}

// SHA-256 hash hex ko'rinishida — backend audit/hash uchun
export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// UTF-8 satrni base64 ga aylantirish (CAPIWS uchun)
export function strToBase64(text: string): string {
  // btoa unicode bilan ishlamaydi — UTF-8 binary stringga aylantiramiz
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
