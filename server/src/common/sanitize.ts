import sanitizeHtml from 'sanitize-html';

const RICH_HTML_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'colgroup', 'col',
    'span', 'div', 'a', 'img', 'figure', 'figcaption',
    // Qo'shimcha bepul plaginlar chiqishi: Highlight (mark), Code/CodeBlock
    // (code/pre), TodoList (input/label), gorizontal chiziq (allaqachon hr).
    'mark', 'code', 'pre', 'input', 'label',
  ],
  allowedAttributes: {
    // Bookmark plagini <a id="..."> chiqaradi — id'ga ruxsat beramiz.
    a: ['href', 'target', 'rel', 'id', 'name'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    img: ['src', 'alt', 'title', 'width', 'height', 'style'],
    // ListProperties: raqamli ro'yxat boshlanishi/teskarisi/turi.
    ol: ['start', 'reversed', 'type'],
    // TodoList belgilash katakchasi (faqat ko'rsatish — disabled).
    input: ['type', 'checked', 'disabled'],
    // CKEditor jadval o'lchamlari va joylashuvini class + style orqali saqlaydi
    // (masalan ck-table-resized). class'ga ruxsat beramiz — XSS xavfi yo'q.
    '*': ['style', 'class'],
  },
  // Rasm manbalari: base64 (data:) va tashqi http(s). Blanka/firmenniy
  // sarlavha rasmlari uchun zarur.
  allowedSchemesByTag: {
    img: ['data', 'http', 'https'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^(bold|bolder|[1-9]00)$/],
      'font-style': [/^(italic|normal)$/],
      'text-decoration': [/^(underline|line-through|none)$/],
      // Word import: shrift oilasi va o'lchami (docx-preview computed px qiymatlar).
      // Tirnoq, bo'sh joy, vergul, chiziqcha — url()/expression() ga yo'l yo'q.
      'font-family': [/^[a-zA-Z0-9\s,"'\u2019.\-]+$/],
      'font-size': [/^\d+(\.\d+)?(px|pt|em|%)$/],
      'line-height': [/^(normal|\d+(\.\d+)?(px|em|%)?)$/],
      width: [/^\d+(\.\d+)?(px|%|em)$/],
      height: [/^\d+(\.\d+)?(px|%|em)$/],
      // Matnni aylantirish (90°/180°/270°) va vertikal yozuv — shablon
      // muharririda katak matnini burish uchun. Saqlashda o'chib ketmasin.
      transform: [/^rotate\(-?\d+(\.\d+)?deg\)$/],
      'writing-mode': [/^(horizontal-tb|vertical-rl|vertical-lr)$/],
      'text-orientation': [/^(mixed|upright|sideways)$/],
      'vertical-align': [/^(top|middle|bottom|baseline)$/],
      'white-space': [/^(normal|nowrap|pre|pre-wrap)$/],
      // 90° aylantirilgach harflar oralig'ini ochish (edo-ls-* class'lari CSS'da,
      // lekin qo'lda kiritilgan inline qiymat ham buzilmasin).
      'letter-spacing': [/^-?[\d.]+(px|em)$/],
      // Ro'yxat belgisi turi (ListProperties: disc/circle/decimal/...).
      'list-style-type': [/^[a-z-]+$/i],
      // Sahifa uzilishi (PageBreak plagini).
      'page-break-after': [/^(always|auto|avoid)$/],
      'page-break-before': [/^(always|auto|avoid)$/],
      'break-after': [/^(page|auto|avoid)$/],
      'break-before': [/^(page|auto|avoid)$/],
      // Rasm/blok joylashuvi uchun cheklangan display qiymatlari.
      display: [/^(block|inline|inline-block|table|none)$/],
      float: [/^(left|right|none)$/],
      margin: [/^[\d.]+(px|em|%|auto)(\s+([\d.]+(px|em|%)|auto)){0,3}$/],
      'margin-left': [/^([\d.]+(px|em|%)|auto)$/],
      'margin-right': [/^([\d.]+(px|em|%)|auto)$/],
      // Jadval ranglari va chegaralari (CKEditor Table properties) — url()/
      // expression() kabi xavfli qiymatlarga yo'l qo'ymaydigan tor regexlar.
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.,\s]+\)$/, /^hsla?\([\d.,%\s]+\)$/, /^[a-z]+$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.,\s]+\)$/, /^hsla?\([\d.,%\s]+\)$/, /^[a-z]+$/i],
      border: [/^[\d.]+px\s+(solid|dashed|dotted|double|none)(\s+(#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+))?$/i],
      'border-top': [/^[\d.]+px\s+(solid|dashed|dotted|double|none)(\s+(#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+))?$/i],
      'border-right': [/^[\d.]+px\s+(solid|dashed|dotted|double|none)(\s+(#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+))?$/i],
      'border-bottom': [/^[\d.]+px\s+(solid|dashed|dotted|double|none)(\s+(#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+))?$/i],
      'border-left': [/^[\d.]+px\s+(solid|dashed|dotted|double|none)(\s+(#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+))?$/i],
      'border-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.,\s]+\)$/, /^hsla?\([\d.,%\s]+\)$/, /^[a-z]+$/i],
      'border-style': [/^(solid|dashed|dotted|double|none)$/i],
      'border-width': [/^[\d.]+px$/],
      'border-collapse': [/^(collapse|separate)$/],
      padding: [/^[\d.]+(px|em|%)(\s+[\d.]+(px|em|%)){0,3}$/],
      'table-layout': [/^(auto|fixed)$/],
    },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
  },
};

// Boy matnli (jadval, formatlash) HTML'ni XSS'dan tozalaydi.
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html ?? '', RICH_HTML_OPTS).trim();
}
