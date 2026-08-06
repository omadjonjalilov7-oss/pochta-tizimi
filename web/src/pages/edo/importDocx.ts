// Word (.docx) faylni to'liq ko'rinishini saqlagan holda HTML'ga aylantirish.
//
// Backenddagi mammoth "sof" HTML chiqaradi — barcha shrift, rang, chegara,
// kenglik ma'lumotini yo'qotadi. Buning o'rniga biz docx-preview bilan hujjatni
// brauzerda (yashirin konteynerda) render qilamiz, so'ng har bir elementning
// hisoblangan (computed) uslublarini inline `style` ga ko'chiramiz va <style>
// teglari bilan class'larni olib tashlaymiz. Natija — o'zini o'zi ta'minlaydigan,
// sanitizer bilan mos, Word ko'rinishini to'liq saqlaydigan HTML.

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function extractPlaceholders(body: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(body)) !== null) set.add(m[1]);
  return Array.from(set);
}

function normTextAlign(v: string): string | null {
  if (v === 'start' || v === 'left') return 'left';
  if (v === 'end' || v === 'right') return 'right';
  if (v === 'center' || v === 'justify') return v;
  return null;
}

function isZero(v: string): boolean {
  return !v || v === '0px' || v === 'auto' || v === '0' || v === 'none';
}

const WIDTH_TAGS = new Set(['table', 'td', 'th', 'col', 'colgroup', 'img', 'section', 'div']);
const HEIGHT_TAGS = new Set(['td', 'th', 'tr', 'img']);

// Bitta elementning hisoblangan uslublarini inline `style` ga yozadi.
function inlineStyles(el: HTMLElement): void {
  const cs = getComputedStyle(el);
  const tag = el.tagName.toLowerCase();
  const parts: string[] = [];

  // Shriftlar (fidelity uchun har doim yoziladi)
  const ff = cs.fontFamily;
  if (ff) parts.push(`font-family:${ff}`);
  if (cs.fontSize) parts.push(`font-size:${cs.fontSize}`);
  if (cs.fontWeight && cs.fontWeight !== '400' && cs.fontWeight !== 'normal')
    parts.push(`font-weight:${cs.fontWeight}`);
  if (cs.fontStyle && cs.fontStyle !== 'normal') parts.push(`font-style:${cs.fontStyle}`);

  const deco = cs.textDecorationLine;
  if (deco && deco !== 'none') {
    const d = deco.includes('underline')
      ? 'underline'
      : deco.includes('line-through')
        ? 'line-through'
        : null;
    if (d) parts.push(`text-decoration:${d}`);
  }

  // Ranglar (standart qora / shaffofni tashlab yuboramiz)
  if (cs.color && cs.color !== 'rgb(0, 0, 0)') parts.push(`color:${cs.color}`);
  const bg = cs.backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') parts.push(`background-color:${bg}`);

  // Joylashuv
  const ta = normTextAlign(cs.textAlign);
  if (ta && ta !== 'left') parts.push(`text-align:${ta}`);
  const va = cs.verticalAlign;
  if (va === 'top' || va === 'middle' || va === 'bottom') parts.push(`vertical-align:${va}`);
  if (cs.lineHeight && cs.lineHeight !== 'normal') parts.push(`line-height:${cs.lineHeight}`);
  if (cs.whiteSpace && cs.whiteSpace !== 'normal') parts.push(`white-space:${cs.whiteSpace}`);

  // Ichki bo'shliq (padding) — 4 tomon shorthand
  const pt = cs.paddingTop,
    pr = cs.paddingRight,
    pb = cs.paddingBottom,
    pl = cs.paddingLeft;
  if ([pt, pr, pb, pl].some((v) => v && v !== '0px')) {
    parts.push(`padding:${pt} ${pr} ${pb} ${pl}`);
  }

  // Chegaralar — har tomon uchun alohida shorthand (faqat mavjud bo'lsa)
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const w = cs.getPropertyValue(`border-${side}-width`);
    const st = cs.getPropertyValue(`border-${side}-style`);
    const co = cs.getPropertyValue(`border-${side}-color`);
    if (w && st && st !== 'none' && parseFloat(w) > 0) {
      parts.push(`border-${side}:${w} ${st} ${co}`);
    }
  }

  // Kenglik/balandlik — faqat jadval/rasm kabi tegishli elementlarda
  if (WIDTH_TAGS.has(tag)) {
    const w = cs.width;
    if (!isZero(w)) parts.push(`width:${w}`);
  }
  if (HEIGHT_TAGS.has(tag)) {
    const h = cs.height;
    if (!isZero(h)) parts.push(`height:${h}`);
  }

  el.setAttribute('style', parts.join(';'));
}

// Word faylni to'liq ko'rinishli, sanitizer-mos HTML'ga aylantiradi.
export async function importDocxToHtml(
  file: File,
): Promise<{ html: string; placeholders: string[] }> {
  const { renderAsync } = await import('docx-preview');
  const buf = await file.arrayBuffer();

  // Yashirin, lekin joylashuvi (layout) hisoblanadigan konteyner.
  // display:none ishlamaydi — unda kengliklar 0/auto bo'lib qoladi.
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-10000px;top:0;width:920px;background:#fff;pointer-events:none;';
  document.body.appendChild(container);

  try {
    await renderAsync(buf, container, container, {
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: false,
      useBase64URL: true,
      renderChanges: false,
    });

    // 1) Barcha elementlarga computed uslublarni inline yozamiz
    container.querySelectorAll<HTMLElement>('*').forEach(inlineStyles);

    // 2) Endi <style> teglari va class'lar keraksiz — olib tashlaymiz
    container.querySelectorAll('style').forEach((s) => s.remove());
    container.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));

    const html = container.innerHTML;
    return { html, placeholders: extractPlaceholders(html) };
  } finally {
    container.remove();
  }
}
