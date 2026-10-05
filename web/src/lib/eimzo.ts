// E-IMZO CAPIWS klient — mahalliy WebSocket xizmati orqali sertifikatlarni o'qish va PKCS#7 yaratish.
//
// CAPIWS — bu O'zbekiston Respublikasi E-IMZO infratuzilmasining mahalliy komponenti.
// Foydalanuvchi kompyuterida ishlaydigan xizmat:
//   https sahifa → wss://127.0.0.1:64443/service/cryptapi
//   http  sahifa → ws://127.0.0.1:64646/service/cryptapi
//
// MUHIM: E-IMZO protokoli HAR BIR funksiya uchun ALOHIDA WebSocket ochadi
// (bitta so'rov → bitta javob → ulanish yopiladi). Javoblar `id` qaytarmaydi.
// Shuningdek, funksiyalardan oldin domen uchun API-KEY o'rnatilishi kerak.
//
// Foydalanish:
//   const client = new EimzoClient();
//   await client.connect();                            // versiya + apikey
//   const certs = await client.listAllUserKeys();      // sertifikatlar ro'yxati
//   const keyId = await client.loadKey(cert);          // PIN/parol dialogi ochiladi
//   const pkcs7Base64 = await client.createPkcs7(keyId, dataBase64);

// Rasmiy E-IMZO hujjatidagi ommaviy API-KEY lar (localhost va 127.0.0.1 uchun).
// Boshqa production domen uchun alohida API-KEY NIC NT'dan olinadi va bu ro'yxatga
// qo'shiladi (yoki E-IMZO Tray menyusidagi "Dasturchi rejimi" yoqiladi).
// E-IMZO v6+ API-KEY ni ochiq sahifa domeni bo'yicha o'zi yuklaydi.
const EIMZO_API_KEYS: string[] = [
  'localhost',
  '96D0C1491615C82B9A54D9989779DF825B690748224C2B04F500F370D51827CE2644D8D4A82C18184D73AB8530BB8ED537269603F61DB0D03D2104ABF789970B',
  '127.0.0.1',
  'A7BCFA5D490B351BE0754130DF03A068F855DB4333D43921125B9CF2670EF6A40370C646B90401955E1F7BC9CDBF59CE0B2C5467D820BE189C845D0B79CFC96F',
];

function capiwsUrl(): string {
  const isHttps =
    typeof window !== 'undefined' && window.location.protocol.toLowerCase() === 'https:';
  return (isHttps ? 'wss://127.0.0.1:64443' : 'ws://127.0.0.1:64646') + '/service/cryptapi';
}

export interface EimzoCert {
  disk: string;
  path: string;
  name: string; // certificate path (load_key uchun)
  alias: string; // asl X500 alias (load_key uchun)
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
  readonly cause?: string;

  constructor(message: string, cause?: string) {
    super(message);
    this.name = 'EimzoError';
    this.cause = cause;
  }
}

export class EimzoClient {
  // Har bir funksiya chaqiruvi uchun alohida WebSocket ochiladi (E-IMZO protokoli shunaqa).
  private callFunction(funcDef: object, timeoutMs = 15000): Promise<CapiwsResponse> {
    return new Promise<CapiwsResponse>((resolve, reject) => {
      let socket: WebSocket;
      try {
        socket = new WebSocket(capiwsUrl());
      } catch (e) {
        reject(new EimzoError("E-IMZO xizmatiga ulanib bo'lmadi", (e as Error).message));
        return;
      }

      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          /* noop */
        }
        fn();
      };

      const timer = setTimeout(() => {
        finish(() =>
          reject(
            new EimzoError(
              "E-IMZO javob bermadi. Iltimos, E-IMZO dasturini ishga tushiring va qaytadan urinib ko'ring.",
            ),
          ),
        );
      }, timeoutMs);

      socket.onopen = () => {
        try {
          socket.send(JSON.stringify(funcDef));
        } catch (e) {
          finish(() => reject(new EimzoError("E-IMZO ga so'rov yuborilmadi", (e as Error).message)));
        }
      };

      socket.onmessage = (event) => {
        let data: CapiwsResponse;
        try {
          data = JSON.parse(event.data);
        } catch {
          finish(() => reject(new EimzoError("E-IMZO javobini o'qib bo'lmadi")));
          return;
        }
        finish(() => {
          if (data.success === false) {
            reject(new EimzoError(data.reason || 'E-IMZO xatosi', data.reason));
          } else {
            resolve(data);
          }
        });
      };

      socket.onerror = () => {
        finish(() =>
          reject(
            new EimzoError(
              'E-IMZO xizmati topilmadi. Iltimos, E-IMZO dasturini ishga tushiring (https://e-imzo.uz)',
            ),
          ),
        );
      };

      socket.onclose = (e) => {
        // Javob kelmasdan ulanish yopilsa — xato
        finish(() =>
          reject(
            new EimzoError(
              'E-IMZO ulanishi yopildi' +
                (e && e.code && e.code !== 1000 ? ` (kod ${e.code})` : ''),
            ),
          ),
        );
      };
    });
  }

  // E-IMZO ishlayotganini tekshirish va domen uchun API-KEY o'rnatish.
  async connect(): Promise<void> {
    // 1) Versiya — E-IMZO ishga tushganini bildiradi
    await this.callFunction({ name: 'version' }, 8000);
    // 2) API-KEY handshake — best-effort (v6 o'zi domen bo'yicha yuklaydi,
    //    noma'lum domen uchun xatolikni jim o'tkazamiz)
    try {
      await this.callFunction({ name: 'apikey', arguments: EIMZO_API_KEYS }, 8000);
    } catch (e) {
      console.warn('[E-IMZO] apikey handshake:', (e as Error).message);
    }
  }

  async listAllUserKeys(): Promise<EimzoCert[]> {
    const resp = await this.callFunction({ plugin: 'pfx', name: 'list_all_certificates' }, 10000);
    const items = resp.certificates as any[] | undefined;
    if (!items || items.length === 0) {
      throw new EimzoError(
        'Sertifikatlar topilmadi. E-IMZO kalitlaringiz mavjudligini tekshiring.',
      );
    }
    return items
      .map((c) => {
        // alias — X500 satr; maydonlar undan ajratib olinadi
        const alias = String(c.alias ?? '')
          .toUpperCase()
          .replace('1.2.860.3.16.1.1=', 'INN=')
          .replace('1.2.860.3.16.1.2=', 'PINFL=');
        return {
          disk: c.disk,
          path: c.path,
          name: c.name,
          alias: c.alias, // asl alias — load_key uchun
          serialNumber: x500Val(alias, 'SERIALNUMBER'),
          validFrom: x500ValToIso(x500Val(alias, 'VALIDFROM')),
          validTo: x500ValToIso(x500Val(alias, 'VALIDTO')),
          CN: x500Val(alias, 'CN'),
          TIN: x500Val(alias, 'INN') || x500Val(alias, 'UID'),
          PINFL: x500Val(alias, 'PINFL'),
          O: x500Val(alias, 'O'),
          T: x500Val(alias, 'T'),
        } as EimzoCert;
      })
      .filter((v) => v.TIN || v.PINFL);
  }

  async loadKey(cert: EimzoCert): Promise<string> {
    // Parol/PIN dialogi shu bosqichda ochilishi mumkin — timeout uzoqroq
    const resp = await this.callFunction(
      { plugin: 'pfx', name: 'load_key', arguments: [cert.disk, cert.path, cert.name, cert.alias] },
      120000,
    );
    const keyId = (resp.keyId as string) || (resp.id as string);
    if (!keyId) throw new EimzoError('E-IMZO kalit ID qaytarmadi');
    return keyId;
  }

  // PKCS#7 (CMS) imzosini yaratish.
  //   dataBase64 — base64 ko'rinishidagi ma'lumot (E-IMZO dekod qiladi, imzolaydi).
  //   detached=false → ma'lumot imzo ichiga joylanadi (attached),
  //   detached=true  → ma'lumotsiz (detached) imzo.
  async createPkcs7(keyId: string, dataBase64: string, detached = false): Promise<string> {
    const resp = await this.callFunction(
      {
        plugin: 'pkcs7',
        name: 'create_pkcs7',
        arguments: [dataBase64, keyId, detached ? 'yes' : 'no'],
      },
      120000,
    );
    const pkcs7 = (resp.pkcs7_64 as string) || (resp.pkcs7 as string);
    if (!pkcs7) throw new EimzoError('PKCS#7 imzo qaytarilmadi');
    return pkcs7;
  }

  // Doimiy ulanish yo'q — close() API moslik uchun bo'sh qoldirilgan.
  close() {
    /* noop — har bir chaqiruv o'z socketini yopadi */
  }
}

// X500 alias satridan maydon qiymatini ajratib olish.
// Masalan: "CN=...,SERIALNUMBER=...,VALIDFROM=2026.01.01 00:00:00,..."
function x500Val(alias: string, field: string): string {
  const parts = alias.split(/,(?=[0-9A-Z.]+=)/);
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    if (p.slice(0, eq).trim() === field) return p.slice(eq + 1).trim();
  }
  return '';
}

// "yyyy.MM.dd HH:mm:ss" → ISO
function x500ValToIso(s: string): string {
  if (!s) return '';
  const iso = s.replace(/\./g, '-').replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? s : d.toISOString();
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
