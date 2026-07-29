import type { EdoDocument } from './types';

// Chop etishda ko'rsatiladigan sarlavha ma'lumotlari (i18n chaqiruvchi tomonda
// tayyorlanadi — bu modul til fayllariga bog'liq emas).
export interface PrintMeta {
  statusLabel: string;
  typeLabel: string; // masalan: "Ichki · Xizmat xati"
  createdByName: string;
  createdByPosition?: string;
  createdAtText: string;
  deadlineText?: string; // to'liq matn, masalan: "Muddat: 01.08.2026"
  bodyHeading: string; // "Hujjat matni"
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Hujjatning ekrandagi ko'rinishini (sarlavha kartochkasi + matn) chop etish/PDF
// oynasida ochadi — chap menyu, o'ng paneldagi zanjir/tarix, ilovalar va izohlarsiz.
// Shablon bo'lsa matn sifatida to'ldirilgan shablon (renderedBody) ishlatiladi.
// meta berilmasa faqat matn chop etiladi (eski xatti-harakat).
export function openDocumentPrint(
  doc: EdoDocument,
  autoPrint: boolean,
  meta?: PrintMeta,
): void {
  const content = doc.renderedBody ?? doc.body ?? '';
  const isHtml = /^\s*<[a-z]/i.test(content);
  const bodyInner = isHtml
    ? content
    : `<div style="white-space:pre-wrap;font-size:12px;line-height:1.5">${esc(content)}</div>`;

  const head = meta
    ? `<header class="doc-head">
    <div class="doc-meta">
      <span class="num">${esc(doc.number)}</span>
      ${doc.docUid ? `<span class="uid">${esc(doc.docUid)}</span>` : ''}
      <span class="status">${esc(meta.statusLabel)}</span>
      <span class="type">${esc(meta.typeLabel)}</span>
    </div>
    <h1 class="subject">${esc(doc.subject)}</h1>
    <div class="who">${esc(meta.createdByName)}${
        meta.createdByPosition ? ` — ${esc(meta.createdByPosition)}` : ''
      } · ${esc(meta.createdAtText)}${meta.deadlineText ? ` · ${esc(meta.deadlineText)}` : ''}</div>
  </header>
  <h2 class="body-heading">${esc(meta.bodyHeading)}</h2>`
    : '';

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
  .doc-head { border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; }
  .doc-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; margin-bottom: 6px; }
  .doc-meta .num, .doc-meta .uid { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
  .doc-meta .uid { background: #fff2e8; color: #b45309; }
  .doc-meta .status { background: #eef2ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; }
  .doc-meta .type { color: #64748b; padding: 2px 0; }
  .subject { font-size: 18px; margin: 4px 0; }
  .who { font-size: 11px; color: #64748b; }
  .body-heading { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; margin: 14px 0 6px; }
  @page { size: A4; margin: 0; }
  @media print {
    html, body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; }
  }
</style></head><body><div class="sheet">${head}<div class="doc-body">${bodyInner}</div></div>${printScript}</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
