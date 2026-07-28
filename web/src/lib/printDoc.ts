import type { EdoDocument } from './types';

// Hujjatning aynan ko'rinayotgan holatini chop etish/PDF oynasida ochadi.
// Shablon bo'lsa — to'ldirilgan shablon (renderedBody), aks holda asl matn.
// O'zimiz jadval yoki xodimlar zanjirini yasamaymiz: barcha PDF/HTML eksporti
// uchun yagona manba shu. autoPrint=true bo'lsa yuklangach chop etish (Save as
// PDF) oynasi avtomatik chiqadi.
export function openDocumentPrint(doc: EdoDocument, autoPrint: boolean): void {
  const content = doc.renderedBody ?? doc.body ?? '';
  const isHtml = /^\s*<[a-z]/i.test(content);
  const esc = (s: string) =>
    (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyInner = isHtml
    ? content
    : `<div style="white-space:pre-wrap;font-size:12px;line-height:1.5">${esc(content)}</div>`;
  const printScript = autoPrint
    ? '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},250);};<\/script>'
    : '';
  const html = `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8">
<title>${esc(doc.number)} — ${esc(doc.subject)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Calibri","Arial",sans-serif; margin: 1cm 1.2cm; color: #000; }
  table { border-collapse: collapse; }
  img { max-width: 100%; }
  @media print { body { margin: 0.6cm 0.8cm; } }
</style></head><body>${bodyInner}${printScript}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
