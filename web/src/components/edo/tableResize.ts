// Hujjat matnidagi jadvallar uchun umumiy yordamchi (TemplateFillEditor va
// RichBodyEditor'da ishlatiladi).
//
// 1) TABLE_INSERT_HTML — jadval `table-layout:fixed` va teng foizli ustunlar
//    bilan quriladi: matn hajmiga qarab ustunlar o'zi sakramaydi.
// 2) attachTableResize — ustun chegarasini sichqoncha bilan tortib kenglikni
//    o'zgartirish. Kengliklar FOIZ (%) bilan boshqariladi — shuning uchun
//    jadval har doim varaq ichida qoladi (ramkadan chiqmaydi). Qo'shni ustun
//    teskari o'zgaradi, umumiy 100% saqlanadi. Eng o'ng chegara (varaq cheti)
//    tortilmaydi.

const EDGE = 6; // ustun o'ng chegarasidan necha px ichida "tortish" boshlanadi
const MIN_PCT = 5; // ustunning eng kichik kengligi (%)

export function TABLE_INSERT_HTML(rows: number, cols: number): string {
  const r = Math.max(1, Math.min(20, rows || 1));
  const c = Math.max(1, Math.min(10, cols || 1));
  const w = (100 / c).toFixed(4);
  const colTags = Array.from({ length: c })
    .map(() => `<col style="width:${w}%" />`)
    .join('');
  const cell =
    '<td style="border:1px solid #333;padding:4px 6px;vertical-align:top;">&nbsp;</td>';
  const row = `<tr>${cell.repeat(c)}</tr>`;
  return (
    `<table class="tpl-table" style="border-collapse:collapse;width:100%;table-layout:fixed;margin:6px 0;">` +
    `<colgroup>${colTags}</colgroup><tbody>${row.repeat(r)}</tbody></table>` +
    `<p><br/></p>`
  );
}

// Jadvalda <colgroup> bo'lmasa yoki ustunlar soni mos kelmasa — qayta quramiz.
function ensureCols(table: HTMLTableElement): HTMLTableColElement[] {
  const firstRow = table.rows[0];
  const n = firstRow ? firstRow.cells.length : 0;
  let cg = table.querySelector('colgroup');
  if (!cg || cg.querySelectorAll('col').length !== n) {
    if (cg) cg.remove();
    cg = document.createElement('colgroup');
    for (let k = 0; k < n; k++) cg.appendChild(document.createElement('col'));
    table.insertBefore(cg, table.firstChild);
  }
  return Array.from(cg.querySelectorAll('col')) as HTMLTableColElement[];
}

export function attachTableResize(
  container: HTMLElement,
  onCommit: () => void,
): () => void {
  let active: {
    cols: HTMLTableColElement[];
    index: number;
    startX: number;
    tableW: number; // jadval ichki kengligi (px) — dx ni % ga aylantirish uchun
    pcts: number[]; // boshlang'ich ustun kengliklari (%)
  } | null = null;

  const cellFromEvent = (e: MouseEvent): HTMLTableCellElement | null => {
    const t = e.target as HTMLElement | null;
    const cell = t?.closest?.('td,th') as HTMLTableCellElement | null;
    return cell && container.contains(cell) ? cell : null;
  };

  // Ustunning o'ng chegarasiga yaqinmi va u oxirgi ustun EMASmi (oxirgisi = varaq
  // cheti, tortilmaydi).
  const isResizeEdge = (cell: HTMLTableCellElement, clientX: number): boolean => {
    const row = cell.parentElement as HTMLTableRowElement | null;
    if (!row) return false;
    if (cell.cellIndex >= row.cells.length - 1) return false;
    const r = cell.getBoundingClientRect();
    return r.right - clientX <= EDGE && r.right - clientX >= -EDGE;
  };

  const onHover = (e: MouseEvent) => {
    if (active) return;
    const cell = cellFromEvent(e);
    const want = cell && isResizeEdge(cell, e.clientX);
    const next = want ? 'col-resize' : '';
    if (container.style.cursor !== next) container.style.cursor = next;
  };

  const onDown = (e: MouseEvent) => {
    const cell = cellFromEvent(e);
    if (!cell || !isResizeEdge(cell, e.clientX)) return;
    const table = cell.closest('table') as HTMLTableElement | null;
    const firstRow = table?.rows[0];
    if (!table || !firstRow) return;
    table.style.tableLayout = 'fixed';
    const cols = ensureCols(table);
    const cellWidths = Array.from(firstRow.cells).map(
      (cc) => cc.getBoundingClientRect().width,
    );
    const tableW = cellWidths.reduce((a, b) => a + b, 0) || 1;
    const pcts = cellWidths.map((w) => (w / tableW) * 100);
    // Foizlarni aniq qilib qotiramiz (keyingi tortish bashoratli bo'lsin).
    cols.forEach((col, k) => {
      col.style.width = pcts[k].toFixed(4) + '%';
    });
    active = { cols, index: cell.cellIndex, startX: e.clientX, tableW, pcts };
    e.preventDefault();
    document.addEventListener('mousemove', onDrag, true);
    document.addEventListener('mouseup', onUp, true);
  };

  const onDrag = (e: MouseEvent) => {
    if (!active) return;
    const { cols, index, startX, tableW, pcts } = active;
    const i = index;
    const j = index + 1;
    const dPct = ((e.clientX - startX) / tableW) * 100;
    const pair = pcts[i] + pcts[j];
    let ni = pcts[i] + dPct;
    if (ni < MIN_PCT) ni = MIN_PCT;
    if (ni > pair - MIN_PCT) ni = pair - MIN_PCT;
    cols[i].style.width = ni.toFixed(4) + '%';
    cols[j].style.width = (pair - ni).toFixed(4) + '%';
    e.preventDefault();
  };

  const onUp = () => {
    if (!active) return;
    active = null;
    container.style.cursor = '';
    document.removeEventListener('mousemove', onDrag, true);
    document.removeEventListener('mouseup', onUp, true);
    onCommit();
  };

  container.addEventListener('mousedown', onDown);
  container.addEventListener('mousemove', onHover);

  return () => {
    container.removeEventListener('mousedown', onDown);
    container.removeEventListener('mousemove', onHover);
    document.removeEventListener('mousemove', onDrag, true);
    document.removeEventListener('mouseup', onUp, true);
  };
}
