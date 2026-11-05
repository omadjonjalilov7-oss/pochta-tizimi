// Mobil "lupa" — sahifani kattalashtirish/kichraytirish (menyu va matnni
// yaxshi o'qish uchun). Brauzerning sahifa masshtabi (zoom) kabi ishlaydi:
// butun sahifani bir xilda kattalashtiradi yoki kichraytiradi. Tanlangan
// daraja localStorage'da saqlanadi va har ochilishda qayta qo'llanadi.
//   - `zoom` xususiyati Android Chrome va iOS Safari (WebKit)'da ishlaydi.

const KEY = 'ui-zoom';
export const ZOOM_LEVELS = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;
const DEFAULT = 1;

export function getZoom(): number {
  try {
    const v = parseFloat(localStorage.getItem(KEY) || '');
    if (ZOOM_LEVELS.includes(v as (typeof ZOOM_LEVELS)[number])) return v;
  } catch {
    // ignore
  }
  return DEFAULT;
}

export function applyZoom(scale: number): void {
  try {
    // TypeScript'da `zoom` standart CSS tipida yo'q — shuning uchun `any`.
    (document.documentElement.style as unknown as { zoom: string }).zoom =
      String(scale);
  } catch {
    // ignore
  }
}

export function setZoom(scale: number): number {
  const s = ZOOM_LEVELS.includes(scale as (typeof ZOOM_LEVELS)[number])
    ? scale
    : DEFAULT;
  try {
    localStorage.setItem(KEY, String(s));
  } catch {
    // ignore
  }
  applyZoom(s);
  return s;
}

// Ilova ochilishida saqlangan masshtabni qo'llaymiz (main.tsx'dan chaqiriladi).
export function initZoom(): void {
  applyZoom(getZoom());
}
