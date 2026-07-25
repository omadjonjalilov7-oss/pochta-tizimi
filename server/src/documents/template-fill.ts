// "ichki" shabloni uchun avtomat to'ldirish. Shablon tanlanmagan hujjatlar
// yuborilganda shu modul yordamida jonli to'ldiriladi (o'qishda hisoblanadi).

// Tasdiqlash zanjiri qat'iy: aziza → raxmatjon → abduxalil → mirzaxid
export const AUTO_CHAIN_LOGINS = ['aziza', 'raxmatjon', 'abduxalil', 'mirzaxid'] as const;

export interface AutoFillApprover {
  login: string;
  fullName: string;
  actedAt: Date | null;
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
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()} ${p(
    dt.getHours(),
  )}:${p(dt.getMinutes())}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildIchkiTokens(input: AutoFillInput): {
  values: Record<string, string>;
  raw: Set<string>;
} {
  const byLogin = new Map(
    input.approvers.map((a) => [a.login.toLowerCase(), a] as const),
  );
  const nameOf = (login: string) => byLogin.get(login)?.fullName ?? '';
  const dateOf = (login: string) => fmtDate(byLogin.get(login)?.actedAt ?? null);

  const values: Record<string, string> = {
    _asaka_1: input.creatorName,
    _asaka_2: input.creatorName ? `${input.creatorName} tomonidan tasdiqlandi` : '',
    _asaka_3: nameOf('aziza'),
    _asaka_4: nameOf('raxmatjon'),
    _asaka_5: nameOf('abduxalil'),
    _asaka_6: nameOf('mirzaxid'),
    _asaka_7: input.number,
    _asaka_8: input.senderDept,
    _asaka_9: input.recipientDept,
    _asaka_10: input.subject,
    _asaka_11: input.body,
    _asaka_12: input.recipientName,
    _sana_1: fmtDate(input.createdAt),
    _sana_2: dateOf('aziza'),
    _sana_3: dateOf('raxmatjon'),
    _sana_4: dateOf('abduxalil'),
    _sana_5: dateOf('mirzaxid'),
    _sana_6: fmtDate(input.closedAt),
  };
  // Faqat hujjat matni (_asaka_11) xom HTML sifatida joylanadi.
  const raw = new Set<string>(['_asaka_11']);
  return { values, raw };
}

// Ham `{{_asaka_1}}`, ham yalang'och `_asaka_1` ko'rinishini almashtiradi.
// `\d+` ochko'z bo'lgani uchun `_asaka_12` to'liq mos keladi (`_asaka_1` bilan
// qisman to'qnashmaydi).
const TOKEN_RE = /\{\{\s*(_(?:asaka|sana)_\d+)\s*\}\}|(_(?:asaka|sana)_\d+)/g;

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
