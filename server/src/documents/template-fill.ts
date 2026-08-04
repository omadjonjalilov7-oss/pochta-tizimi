// "ichki" shabloni uchun avtomat to'ldirish. Shablon tanlanmagan hujjatlar
// yuborilganda shu modul yordamida jonli to'ldiriladi (o'qishda hisoblanadi).

// Tasdiqlash zanjiri qat'iy: aziza → raxmatjon → abduxalil → mirzaxid
export const AUTO_CHAIN_LOGINS = ['aziza', 'raxmatjon', 'abduxalil', 'mirzaxid'] as const;

// Majburiy tasdiqlovchilar — chiquvchi va ichki hujjatlarga zanjirdan qat'iy nazar
// har doim qo'shiladi. Ular xabar oladi, navbatdan tashqari tasdiqlay oladi va
// hujjatni ko'ra oladi: aziza → raxmatjon → abduxalil → mirzaxid → zulxumor → avazbek
export const MANDATORY_APPROVER_LOGINS = [
  'aziza',
  'raxmatjon',
  'abduxalil',
  'mirzaxid',
  'zulxumor',
  'avazbek',
] as const;

export interface AutoFillApprover {
  login: string;
  fullName: string;
  actedAt: Date | null;
  approved: boolean;
}

export interface AutoFillInput {
  creatorName: string;
  number: string;
  senderDept: string;
  recipientDept: string;
  subject: string;
  body: string; // xom HTML — bu token escape qilinmaydi
  recipientName: string;
  createdAt: Date;
  closedAt: Date | null;
  approvers: AutoFillApprover[];
  // Hujjatning ommaviy QR kodi (PNG data URL). Tasdiqlagan xodim katakchasida
  // "TASDIQLANDI" yozuvi o'rniga shu QR ko'rsatiladi. Bo'sh bo'lsa — matn qoladi.
  qrDataUrl?: string;
}

// Sana Toshkent vaqti bo'yicha (UTC+5, yozgi vaqt yo'q) ko'rsatiladi —
// server qaysi mintaqada bo'lishidan qat'i nazar.
function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const t = new Date(dt.getTime() + 5 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getUTCDate())}.${p(t.getUTCMonth() + 1)}.${t.getUTCFullYear()} ${p(
    t.getUTCHours(),
  )}:${p(t.getUTCMinutes())}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Foydalanuvchi shabloniga (firmenniy blanka) qo'yadigan maxsus o'zgaruvchilar.
// Kirill oy nomlari — "28 июль 2026 йил" ko'rinishi uchun.
const CYR_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

// Sana Toshkent vaqti (UTC+5) bo'yicha: "28 июль 2026 йил".
function fmtCyrDate(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const t = new Date(dt.getTime() + 5 * 60 * 60 * 1000);
  return `${t.getUTCDate()} ${CYR_MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()} йил`;
}

// Lotin oy nomlari — "2026 yil 04 avgust" ko'rinishi uchun.
const LAT_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

// Sana Toshkent vaqti (UTC+5) bo'yicha lotincha: "2026 yil 04 avgust".
function fmtLatinDate(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const t = new Date(dt.getTime() + 5 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()} yil ${p(t.getUTCDate())} ${LAT_MONTHS[t.getUTCMonth()]}`;
}

// Foydalanuvchi blankasidagi maxsus o'zgaruvchilar:
//   {{xujjat_n}}     → hujjat tartib raqami (escape)
//   {{sana_soat}}    → kirill sana "28 июль 2026 йил" (escape)
//   {{mavzu}}        → hujjat mavzusi (escape)
//   {{xujjat_matni}} → hujjat asosiy matni (xom HTML — escape qilinmaydi)
//   {{matn}}         → {{xujjat_matni}} ning eski nomi (moslik uchun)
//   {{qr_kod}}       → hujjat QR kodi <img> (faqat hujjat bajarilganda; xom HTML)
// Kiruvchi hujjat blankasi uchun qo'shimcha o'zgaruvchilar:
//   {{kod1}}          → hujjat identifikatori (UUID)
//   {{xodim}}         → topshiriq berilgan xodim F.I.Sh. (kanselyariya kiritgan poruchenie)
//   {{xodim_topshiriq}} → xodimga berilgan topshiriq matni
//   {{xujjat_raqami}} → hujjat raqami ({{xujjat_n}} bilan bir xil)
//   {{sana}}          → avazbek (bosh direktor) tasdiqlagan sana "2026 yil 04 avgust"
// Faqat mavjud bo'lsagina almashadi.
export function fillCustomPlaceholders(
  html: string,
  input: {
    number: string;
    date: Date | null | undefined;
    matn?: string;
    mavzu?: string;
    qr?: string;
    docId?: string;
    xodim?: string;
    xodimTopshiriq?: string;
    approveDate?: Date | null;
  },
): string {
  return html
    .replace(/\{\{\s*xujjat_matni\s*\}\}/g, input.matn ?? '')
    .replace(/\{\{\s*matn\s*\}\}/g, input.matn ?? '')
    .replace(/\{\{\s*mavzu\s*\}\}/g, escapeHtml(input.mavzu ?? ''))
    .replace(/\{\{\s*qr_kod\s*\}\}/g, input.qr ?? '')
    .replace(/\{\{\s*kod1\s*\}\}/g, escapeHtml(input.docId ?? ''))
    .replace(/\{\{\s*xodim_topshiriq\s*\}\}/g, escapeHtml(input.xodimTopshiriq ?? ''))
    .replace(/\{\{\s*xodim\s*\}\}/g, escapeHtml(input.xodim ?? ''))
    .replace(/\{\{\s*xujjat_raqami\s*\}\}/g, escapeHtml(input.number))
    .replace(/\{\{\s*xujjat_n\s*\}\}/g, escapeHtml(input.number))
    .replace(/\{\{\s*sana_soat\s*\}\}/g, escapeHtml(fmtCyrDate(input.date)))
    .replace(
      /\{\{\s*sana\s*\}\}/g,
      escapeHtml(fmtLatinDate(input.approveDate ?? input.date)),
    );
}

export function buildIchkiTokens(input: AutoFillInput): {
  values: Record<string, string>;
  raw: Set<string>;
} {
  const byLogin = new Map(
    input.approvers.map((a) => [a.login.toLowerCase(), a] as const),
  );
  // Tasdiqlagan xodim katakchasida QR kod (hujjatni ko'rsatuvchi). QR bo'lmasa
  // eski xatti-harakat: "TASDIQLANDI" yozuvi.
  const qrTag = input.qrDataUrl
    ? `<img src="${input.qrDataUrl}" alt="QR" title="Hujjatni skanerlab ko'rish" ` +
      `style="width:84px;height:84px;display:block;margin:0 auto;" />`
    : 'TASDIQLANDI';
  // Tasdiqlash belgisi: shaxs tasdiqlagan bo'lsa QR (yoki matn), aks holda bo'sh.
  const markOf = (login: string) =>
    byLogin.get(login)?.approved ? qrTag : '';
  const dateOf = (login: string) => fmtDate(byLogin.get(login)?.actedAt ?? null);

  const values: Record<string, string> = {
    _asaka_1: input.creatorName,
    // Yaratuvchi hujjatni yuborish bilan tasdiqlagan hisoblanadi.
    _asaka_2: qrTag,
    _asaka_3: markOf('aziza'),
    _asaka_4: markOf('raxmatjon'),
    _asaka_5: markOf('abduxalil'),
    _asaka_6: markOf('mirzaxid'),
    _asaka_7: input.number,
    _asaka_8: input.senderDept,
    _asaka_9: input.recipientDept,
    _asaka_10: input.subject,
    _asaka_11: input.body,
    _asaka_12: input.recipientName,
    // Bosh direktor (avazbek) tasdig'i — QR kod (tasdiqlagan bo'lsa).
    _gen_dir: markOf('avazbek'),
    // Ichki hujjat sanasi — ochilgan emas, TASDIQLANGAN (yakunlangan) sana.
    _sana_1: fmtDate(input.closedAt ?? input.createdAt),
    _sana_2: dateOf('aziza'),
    _sana_3: dateOf('raxmatjon'),
    _sana_4: dateOf('abduxalil'),
    _sana_5: dateOf('mirzaxid'),
    _sana_6: fmtDate(input.closedAt),
    // Bosh direktor tasdiqlagan sana va vaqt.
    _sana_7: dateOf('avazbek'),
  };
  // Hujjat matni (_asaka_11) va tasdiqlash katakchalaridagi QR <img> teglari
  // (jumladan bosh direktor _gen_dir) xom HTML sifatida joylanadi.
  const raw = new Set<string>([
    '_asaka_11',
    '_asaka_2',
    '_asaka_3',
    '_asaka_4',
    '_asaka_5',
    '_asaka_6',
    '_gen_dir',
  ]);
  return { values, raw };
}

// Ham `{{_asaka_1}}`, ham yalang'och `_asaka_1` ko'rinishini almashtiradi.
// `\d+` ochko'z bo'lgani uchun `_asaka_12` to'liq mos keladi (`_asaka_1` bilan
// qisman to'qnashmaydi).
const TOKEN_RE =
  /\{\{\s*(_(?:asaka|sana)_\d+|_gen_dir)\s*\}\}|(_(?:asaka|sana)_\d+|_gen_dir)/g;

export function renderIchki(
  bodyTemplate: string,
  values: Record<string, string>,
  raw: Set<string>,
): string {
  return bodyTemplate.replace(TOKEN_RE, (match, braced, bare) => {
    const key: string = braced ?? bare;
    if (!(key in values)) return match; // noma'lum token — o'zgarishsiz qoldiramiz
    const v = values[key] ?? '';
    return raw.has(key) ? v : escapeHtml(v);
  });
}
