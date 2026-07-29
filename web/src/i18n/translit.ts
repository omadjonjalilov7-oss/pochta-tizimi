// O'zbek lotin → krill transliteratori.
// Krill til varianti alohida fayl sifatida saqlanmaydi — lotin (uz.json) manbasi
// ish vaqtida krillga o'giriladi. Shu bois faqat bitta manba fayl yuritiladi.
//
// MUHIM: `{{...}}` interpolatsiya o'zgaruvchilariga (masalan {{count}}, {{time}})
// tegilmaydi — ular kod tomonidagi o'zgaruvchilar bo'lib, asl holida qoladi.

// Apostrof variantlarini bitta belgiga keltirish (o' / oʻ / oʼ / o`).
const APOS = /['ʻʼ`’]/g;

// Ko'p harfli (digraf) mosliklar — birinchi navbatda almashtiriladi.
const DIGRAPHS: [RegExp, string][] = [
  [/O\u0001/g, 'Ў'],
  [/o\u0001/g, 'ў'],
  [/G\u0001/g, 'Ғ'],
  [/g\u0001/g, 'ғ'],
  [/Sh/g, 'Ш'],
  [/SH/g, 'Ш'],
  [/sh/g, 'ш'],
  [/Ch/g, 'Ч'],
  [/CH/g, 'Ч'],
  [/ch/g, 'ч'],
  [/Ya/g, 'Я'],
  [/YA/g, 'Я'],
  [/ya/g, 'я'],
  [/Yo/g, 'Ё'],
  [/YO/g, 'Ё'],
  [/yo/g, 'ё'],
  [/Yu/g, 'Ю'],
  [/YU/g, 'Ю'],
  [/yu/g, 'ю'],
  [/Ye/g, 'Е'],
  [/YE/g, 'Е'],
  [/ye/g, 'е'],
  [/Ts/g, 'Ц'],
  [/ts/g, 'ц'],
];

// Bitta harf mosliklari.
const SINGLE: Record<string, string> = {
  A: 'А', a: 'а', B: 'Б', b: 'б', D: 'Д', d: 'д', E: 'Е', e: 'е',
  F: 'Ф', f: 'ф', G: 'Г', g: 'г', H: 'Ҳ', h: 'ҳ', I: 'И', i: 'и',
  J: 'Ж', j: 'ж', K: 'К', k: 'к', L: 'Л', l: 'л', M: 'М', m: 'м',
  N: 'Н', n: 'н', O: 'О', o: 'о', P: 'П', p: 'п', Q: 'Қ', q: 'қ',
  R: 'Р', r: 'р', S: 'С', s: 'с', T: 'Т', t: 'т', U: 'У', u: 'у',
  V: 'В', v: 'в', X: 'Х', x: 'х', Y: 'Й', y: 'й', Z: 'З', z: 'з',
  C: 'К', c: 'к', W: 'В', w: 'в',
};

function convertChunk(input: string): string {
  // Apostrofli o'/g' ni vaqtinchalik belgi (\u0001) bilan birlashtiramiz.
  let s = input.replace(APOS, '\u0001');
  s = s.replace(/([OoGg])\u0001/g, (_m, l: string) => l + '\u0001');
  // Qolgan yolg'iz apostroflarni olib tashlaymiz (masalan so'z oxirida).
  // (yuqoridagi qadam faqat O/G dan keyingisini saqladi)

  for (const [re, rep] of DIGRAPHS) s = s.replace(re, rep);

  // So'z boshidagi "e" → "э" (lotin e ko'pincha so'z boshida э bo'ladi).
  s = s.replace(/(^|[^A-Za-zА-Яа-яЁёЎўҒғҚқҲҳ])e/g, (_m, p1: string) => p1 + 'э');
  s = s.replace(/(^|[^A-Za-zА-Яа-яЁёЎўҒғҚқҲҳ])E/g, (_m, p1: string) => p1 + 'Э');

  let out = '';
  for (const ch of s) {
    // Qolgan yolg'iz apostrof — tutuq belgisi (masalan ta'sischi → таъсисчи).
    if (ch === '\u0001') {
      out += 'ъ';
      continue;
    }
    out += SINGLE[ch] ?? ch;
  }
  return out;
}

// Matnni krillga o'giradi, `{{...}}` bloklarini o'zgarishsiz qoldiradi.
export function latinToCyrillic(text: string): string {
  if (!text) return text;
  const parts = text.split(/(\{\{[^}]*\}\})/g);
  return parts
    .map((p) => (p.startsWith('{{') && p.endsWith('}}') ? p : convertChunk(p)))
    .join('');
}

// i18n resurs obyektini rekursiv o'giradi. Kalitlarga TEGILMAYDI (ular kod
// tomonidagi o'zgaruvchilar) — faqat qiymatlar (matnlar) o'giriladi.
export function transliterateBundle(value: any): any {
  if (typeof value === 'string') return latinToCyrillic(value);
  if (Array.isArray(value)) return value.map((v) => transliterateBundle(v));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) out[k] = transliterateBundle(value[k]);
    return out;
  }
  return value;
}
