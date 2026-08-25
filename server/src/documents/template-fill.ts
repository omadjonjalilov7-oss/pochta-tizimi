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
  // "ichki_yuristli" varianti: _asaka_10 → tasdiqlangach QR kod (mavzu emas),
  // _sana_8 → bosh direktor tasdiqlagan sana. Aks holda oddiy "ichki" xatti-harakat.
  yuristli?: boolean;
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

// Lotincha (o'zbek) matnni krill alifbosiga o'giradi. Avtomat to'ldiriladigan
// oddiy matnli qiymatlar (F.I.Sh., bo'lim nomi, mavzu) krillda ko'rsatilishi
// uchun ishlatiladi. Allaqachon krill bo'lgan matn o'zgarmaydi (lotin harflari
// yo'q). HTML matn (hujjat tanasi) BU funksiyadan O'TKAZILMAYDI — teglar buziladi.
const CYR_DIGRAPHS: Record<string, string> = {
  "o'": 'ў', 'o‘': 'ў', 'oʻ': 'ў', "g'": 'ғ', 'g‘': 'ғ', 'gʻ': 'ғ',
  sh: 'ш', ch: 'ч', yo: 'ё', yu: 'ю', ya: 'я', ye: 'е', ts: 'ц',
};
const CYR_MONO: Record<string, string> = {
  a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с',
  t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з', c: 'к',
};
const APOS = new Set(["'", '‘', '’', 'ʻ']);

// Xujjatni kiritgan xodim F.I.Sh.ni qisqa ko'rinishga o'giradi:
// familiya to'liq, ism va sharif bosh harflari nuqta bilan — "Жалилов .О.А.".
// Harflar krill alifbosida. "o'g'li"/"qizi" kabi qo'shimchalar hisobga olinmaydi.
const NAME_SUFFIX_RE = /^(o['’ʻ`]?\s*g['’ʻ`]?\s*li|o['’ʻ`]?g['’ʻ`]?li|ugli|qizi|kizi)$/i;
export function formatCreatorShort(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const surname = toCyrillic(parts[0]);
  const rest = parts.slice(1).filter((p) => !NAME_SUFFIX_RE.test(p));
  const initials = rest
    .slice(0, 2)
    .map((p) => toCyrillic(p).charAt(0).toUpperCase())
    .filter(Boolean);
  if (initials.length === 0) return surname;
  return `${surname} .${initials.join('.')}.`;
}

export function toCyrillic(input: string | null | undefined): string {
  const s = input ?? '';
  if (!s) return '';
  const lower = s.toLowerCase();
  const isUpper = (ch: string) => ch !== ch.toLowerCase();
  const withCase = (cyr: string, upper: boolean) =>
    upper ? cyr.toUpperCase() : cyr;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const two = lower.substr(i, 2);
    if (CYR_DIGRAPHS[two]) {
      out += withCase(CYR_DIGRAPHS[two], isUpper(s[i]));
      i += 2;
      continue;
    }
    const ch = s[i];
    const lc = lower[i];
    if (CYR_MONO[lc]) {
      out += withCase(CYR_MONO[lc], isUpper(ch));
    } else if (APOS.has(ch)) {
      // Bog'lovchi apostrof (masalan, "ma'lumot") — krillda tashlab yuboriladi.
    } else {
      out += ch; // raqam, tinish belgisi, bo'sh joy yoki noma'lum belgi
    }
    i++;
  }
  return out;
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
    kod1?: string; // hujjatning yagona ID'si (asaka-YYYYMMDDNN)
    xodim?: string;
    xodimTopshiriq?: string;
    approveDate?: Date | null;
    // {{xujjat_raqami}} — faqat avazbek (bosh direktor) tasdiqlagach yoziladi,
    // ungacha bo'sh turadi. Bo'sh string uzatilsa — bo'sh chiqadi.
    xujjatRaqami?: string;
  },
): string {
  // Topshiriq matni qisqa bo'lsa (100 belgidan kam) — keyingi o'zgaruvchilar
  // bilan orasida uchta bo'sh qator (br) tashlab, blankada joy qoldiriladi.
  const topshiriqRaw = input.xodimTopshiriq ?? '';
  const topshiriqHtml =
    escapeHtml(topshiriqRaw) +
    (topshiriqRaw.trim().length > 0 && topshiriqRaw.length < 100
      ? '<br><br><br>'
      : '');
  return html
    .replace(/\{\{\s*xujjat_matni\s*\}\}/g, input.matn ?? '')
    .replace(/\{\{\s*matn\s*\}\}/g, input.matn ?? '')
    .replace(/\{\{\s*mavzu\s*\}\}/g, escapeHtml(input.mavzu ?? ''))
    .replace(/\{\{\s*qr_kod\s*\}\}/g, input.qr ?? '')
    .replace(/\{\{\s*kod1\s*\}\}/g, escapeHtml(input.kod1 ?? ''))
    .replace(/\{\{\s*xodim_topshiriq\s*\}\}/g, topshiriqHtml)
    .replace(/\{\{\s*xodim\s*\}\}/g, escapeHtml(input.xodim ?? ''))
    .replace(/\{\{\s*xujjat_raqami\s*\}\}/g, escapeHtml(input.xujjatRaqami ?? ''))
    .replace(/\{\{\s*xujjat_n\s*\}\}/g, escapeHtml(input.number))
    .replace(/\{\{\s*sana_soat\s*\}\}/g, escapeHtml(fmtCyrDate(input.date)))
    .replace(
      /\{\{\s*sana\s*\}\}/g,
      escapeHtml(fmtLatinDate(input.approveDate ?? input.date)),
    );
}

// Porucheniya (topshiriq) matnidan tur prefiksini olib tashlaydi. Kanselyariya
// topshiriq yozganda oldiga "Ijro uchun: ", "Ma'lumot uchun: " kabi tur nomi
// qo'shilishi mumkin. Blankada faqat sof topshiriq matni kerak — shu yerda
// birinchi ikki nuqtagacha (":") bo'lgan qisqa (60 belgidan kam) prefiks
// kesib tashlanadi. Ichida ":" bo'lgan uzun matnlar buzilmaydi.
export function stripTaskTypePrefix(text: string): string {
  const s = (text ?? '').trim();
  const idx = s.indexOf(':');
  if (idx > 0 && idx < 60 && !/\d/.test(s.slice(0, idx))) {
    return s.slice(idx + 1).trim();
  }
  return s;
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
  // QR kod imzo katakchasiga sig'ishi uchun kichik (jadval chegarasiga tegmasin).
  const qrTag = input.qrDataUrl
    ? `<img src="${input.qrDataUrl}" alt="QR" title="Hujjatni skanerlab ko'rish" ` +
      `style="width:50px;height:50px;max-width:96%;display:block;margin:3px auto;" />`
    : 'TASDIQLANDI';
  // Tasdiqlash belgisi: shaxs tasdiqlagan bo'lsa QR (yoki matn), aks holda bo'sh.
  const markOf = (login: string) =>
    byLogin.get(login)?.approved ? qrTag : '';
  const dateOf = (login: string) => fmtDate(byLogin.get(login)?.actedAt ?? null);

  const values: Record<string, string> = {
    // Xujjatni kiritgan xodim: familiya to'liq + ism/sharif bosh harflari (krill).
    _asaka_1: formatCreatorShort(input.creatorName),
    // Yaratuvchi hujjatni yuborish bilan tasdiqlagan hisoblanadi.
    _asaka_2: qrTag,
    _asaka_3: markOf('aziza'),
    _asaka_4: markOf('raxmatjon'),
    _asaka_5: markOf('abduxalil'),
    _asaka_6: markOf('mirzaxid'),
    _asaka_7: input.number,
    _asaka_8: toCyrillic(input.senderDept),
    _asaka_9: toCyrillic(input.recipientDept),
    // "ichki_yuristli" da _asaka_10 → tasdiqlangach hujjat QR kodi; oddiy "ichki"
    // da esa hujjat mavzusi (krillda).
    _asaka_10: input.yuristli ? markOf('avazbek') : toCyrillic(input.subject),
    _asaka_11: input.body,
    _asaka_12: toCyrillic(input.recipientName),
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
    // "ichki_yuristli" da _sana_8 → bosh direktor tasdiqlagan sana/vaqt.
    _sana_8: input.yuristli ? dateOf('avazbek') : '',
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
  // "ichki_yuristli" da _asaka_10 QR <img> — xom HTML sifatida joylanadi.
  if (input.yuristli) raw.add('_asaka_10');
  return { values, raw };
}

// ─────────────────────────────────────────────────────────────────────────
// "ichki yangi" shabloni — dinamik tasdiqlovchilar.
//
// Yangi (moslashuvchan) ichki shablon quyidagi o'zgaruvchilardan foydalanadi:
//   {{ichki_nom}}     → ichki hujjat turi (masalan "Хизмат хати") — escape
//   {{mavzu}}         → hujjat mavzusi (krillga o'giriladi) — escape
//   {{xujjat_matni}}  → hujjat asosiy matni (xom HTML — escape qilinmaydi)
//   {{fio1}}..{{fio10}}     → tasdiqlagan xodimlar F.I.Sh. (krill)
//   {{sana1}}..{{sana10}}   → tasdiqlagan sana/vaqt "14.08.2026 15:50"
//   {{qr_kod1}}..{{qr_kod10}} → tasdiqlagan paytdagi hujjat QR kodi (<img>)
//
// Tasdiqlash zanjiri qat'iy emas — nechta xodim tasdiqlagan bo'lsa, o'shancha
// slot (fio/sana/qr_kod) KETMA-KET to'ldiriladi. Masalan 4 xodim tasdiqlasa
// faqat 1..4 to'ldiriladi, 5..10 tokenlari bo'shatiladi ("avtomat o'chadi").
// Bo'sh slotlar bo'shliq bilan almashtiriladi, xom token hech qachon ko'rinmaydi.

export interface IchkiYangiApprover {
  fullName: string;
  actedAt: Date | null;
  approved: boolean;
}

export interface IchkiYangiInput {
  ichkiNom: string; // ko'rsatishga tayyor (krill) tur nomi
  mavzu: string; // xom mavzu (krillga bu yerda o'giriladi)
  body: string; // xom HTML hujjat matni
  approvers: IchkiYangiApprover[]; // BARCHA tasdiqlovchilar (tartibda)
  qrDataUrl?: string; // hujjatning ommaviy QR kodi (PNG data URL)
  maxSlots?: number; // default 10
}

// internal_kind bo'yicha ko'rsatiladigan (krill) tur nomi.
export function internalKindLabel(
  internalKind: string | null | undefined,
  fallbackName?: string | null,
): string {
  switch ((internalKind ?? '').trim().toLowerCase()) {
    case 'service_letter':
      return 'Хизмат хати';
    case 'order':
      return 'Буйруқ';
    default:
      return toCyrillic(fallbackName ?? '');
  }
}

export function renderIchkiYangi(
  bodyTemplate: string,
  input: IchkiYangiInput,
): string {
  const slots = input.maxSlots ?? 10;
  // Tasdiqlagan paytdagi QR kod (hujjatni ko'rsatuvchi). Imzo katakchasiga
  // sig'ishi uchun kichik. QR bo'lmasa — bo'sh (matn qoldirilmaydi).
  const qrTag = input.qrDataUrl
    ? `<img src="${input.qrDataUrl}" alt="QR" title="Hujjatni skanerlab ko'rish" ` +
      `style="width:50px;height:50px;max-width:96%;display:block;margin:3px auto;" />`
    : '';

  // Faqat TASDIQLAGAN xodimlar, tasdiqlagan vaqti bo'yicha ketma-ket. Shu tariqa
  // slotlar bo'shliqsiz to'ladi ("4 tasdiqlasa — 1..4").
  const approved = input.approvers
    .filter((a) => a.approved)
    .sort(
      (a, b) =>
        (a.actedAt ? new Date(a.actedAt).getTime() : 0) -
        (b.actedAt ? new Date(b.actedAt).getTime() : 0),
    );

  let html = bodyTemplate
    .replace(/\{\{\s*ichki_nom\s*\}\}/g, escapeHtml(input.ichkiNom))
    .replace(/\{\{\s*mavzu\s*\}\}/g, escapeHtml(toCyrillic(input.mavzu)))
    .replace(/\{\{\s*xujjat_matni\s*\}\}/g, input.body ?? '')
    .replace(/\{\{\s*matn\s*\}\}/g, input.body ?? '');

  for (let i = 1; i <= slots; i++) {
    const a = approved[i - 1];
    const fio = a ? escapeHtml(toCyrillic(a.fullName)) : '';
    const sana = a ? escapeHtml(fmtDate(a.actedAt)) : '';
    const qr = a ? qrTag : '';
    // `fio1` `{{fio10}}` ichida noto'g'ri mos kelmasligi uchun yopuvchi `}}`
    // talab qilinadi (raqamdan keyin darhol `\s*}}`).
    html = html
      .replace(new RegExp(`\\{\\{\\s*fio${i}\\s*\\}\\}`, 'g'), fio)
      .replace(new RegExp(`\\{\\{\\s*sana${i}\\s*\\}\\}`, 'g'), sana)
      .replace(new RegExp(`\\{\\{\\s*qr_kod${i}\\s*\\}\\}`, 'g'), qr);
  }
  return html;
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
  return bodyTemplate.replace(TOKEN_RE, (_match, braced, bare) => {
    const key: string = braced ?? bare;
    // Noma'lum _asaka_/_sana_ tokeni — foydalanuvchiga xom ko'rinmasligi uchun
    // bo'sh qoldiriladi ("fonda" bo'lsin talabi).
    if (!(key in values)) return '';
    const v = values[key] ?? '';
    return raw.has(key) ? v : escapeHtml(v);
  });
}
