// Hujjat matnidagi jadvallar uchun umumiy yordamchi (TemplateFillEditor va
// RichBodyEditor'da ishlatiladi).
//
// 1) TABLE_INSERT_HTML — jadval `table-layout:fixed` bilan quriladi: ustunlar
//    matn hajmiga qarab o'zi kengayib/torayib ketmaydi, barqaror turadi.
// 2) attachTableResize — ustun chegarasini sichqoncha bilan tortib kenglikni
//    o'zgartirish (col-resize). contenteditable ichida matn belgilanib
//    ketmasligi uchun faqat chegara yaqinida ushlanadi.

const EDGE = 6; // ustun o'ng chegarasidan necha px ichida "tortish" boshlanadi

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

// Jadvalda <colgroup> bo'lmasa — yaratamiz (eski qo'shilgan jadvallar uchun).
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
    widths: number[];
  } | null = null;

  const cellFromEvent = (e: MouseEvent): HTMLTableCellElement | null => {
    const t = e.target as HTMLElement | null;
    const cell = t?.closest?.('td,th') as HTMLTableCellElement | null;
    return cell && container.contains(cell) ? cell : null;
  };

  const onHover = (e: MouseEvent) => {
    if (active) return;
    const cell = cellFromEvent(e);
    if (cell) {
      const r = cell.getBoundingClientRect();
      container.style.cursor = r.right - e.clientX <= EDGE ? 'col-resize' : '';
    } else if (container.style.cursor) {
      container.style.cursor = '';
    }
  };

  const onDown = (e: MouseEvent) => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    const r = cell.getBoundingClientRect();
    if (r.right - e.clientX > EDGE) return; // chegara yaqinida emas
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!table) return;
    table.style.tableLayout = 'fixed';
    table.style.width = table.getBoundingClientRect().width + 'px';
    const cols = ensureCols(table);
    const firstRow = table.rows[0];
    // Hozirgi ustun kengliklarini px'da qotiramiz — tortish bashoratli bo'lsin.
    const widths = Array.from(firstRow.cells).map(
      (cc) => cc.getBoundingClientRect().width,
    );
    cols.forEach((col, k) => {
      col.style.width = widths[k] + 'px';
    });
    active = { cols, index: cell.cellIndex, startX: e.clientX, widths };
    e.preventDefault();
    document.addEventListener('mousemove', onDrag, true);
    document.addEventListener('mouseup', onUp, true);
  };

  const onDrag = (e: MouseEvent) => {
    if (!active) return;
    const { cols, index, startX, widths } = active;
    const min = 24;
    const dx = e.clientX - startX;
    let nw = widths[index] + dx;
    const j = index + 1;
    if (j < widths.length) {
      const pair = widths[index] + widths[j];
      if (nw < min) nw = min;
      if (nw > pair - min) nw = pair - min;
      cols[index].style.width = nw + 'px';
      cols[j].style.width = pair - nw + 'px';
    } else {
      if (nw < min) nw = min;
      cols[index].style.width = nw + 'px';
    }
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
