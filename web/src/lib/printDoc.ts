import type { EdoDocument } from './types';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Hujjatning faqat o'zini (A4 blank/matn) chop etish/PDF oynasida ochadi — chap
// menyu, o'ng paneldagi zanjir/tarix, meta-sarlavha, ilovalar va izohlarsiz.
// Shablon bo'lsa matn sifatida to'ldirilgan shablon (renderedBody) ishlatiladi.
export function openDocumentPrint(
  doc: EdoDocument,
  autoPrint: boolean,
): void {
  const content = doc.renderedBody ?? doc.body ?? '';
  const isHtml = /^\s*<[a-z]/i.test(content);
  const bodyInner = isHtml
    ? content
    : `<div style="white-space:pre-wrap;font-size:12px;line-height:1.5">${esc(content)}</div>`;

  const printScript = autoPrint
    ? '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},250);};<\/script>'
    : '';

  // Hujjat doim A4 varaqqa (210×297mm) joylanadi — PDF/chop etishda yozuvlar
  // tarqalib ketmasligi va bir xil ko'rinishi uchun.
  const html = `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8">
<title>${esc(doc.number)} — ${esc(doc.subject)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #eef2f6; }
  body { font-family: "Calibri","Arial",sans-serif; color: #0f172a; }
  .sheet {
    width: 210mm; min-height: 297mm; margin: 12px auto; padding: 18mm 16mm;
    background: #fff; color: #0f172a; font-size: 12px; line-height: 1.5;
    box-shadow: 0 1px 6px rgba(15,23,42,.15);
  }
  table { border-collapse: collapse; }
  img { max-width: 100%; height: auto; }
  @page { size: A4; margin: 0; }
  @media print {
    html, body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; }
  }
</style></head><body><div class="sheet"><div class="doc-body">${bodyInner}</div></div>${printScript}</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
