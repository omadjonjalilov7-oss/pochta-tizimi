// Jadval ustun/satrlarini sichqoncha bilan cheklab o'lchash uchun yordamchi.
// contentEditable ichidagi <table>larga <colgroup> qo'shadi (Word'dan kelgan
// jadvallar odatda ustun kengligisiz keladi va siqilib buziladi) hamda jadval
// chegarasini sudrab ustun kengligi / satr balandligini o'zgartirishga imkon beradi.

const EDGE = 6; // chegaraga necha px yaqinlikda "resize" kursori chiqadi
const MIN_COL = 32;
const MIN_ROW = 20;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Jadvaldagi ustunlar soni (colspan hisobga olinadi).
function columnCount(table: HTMLTableElement): number {
  let max = 0;
  for (const row of Array.from(table.rows)) {
    let count = 0;
    for (const cell of Array.from(row.cells)) count += cell.colSpan || 1;
    if (count > max) max = count;
  }
  return max;
}

// Har bir ustun uchun boshlang'ich kenglik — katakdagi matn uzunligiga qarab.
function measureColWidths(table: HTMLTableElement, cols: number): number[] {
  const widths = new Array<number>(cols).fill(0);
  for (const row of Array.from(table.rows)) {
    let ci = 0;
    for (const cell of Array.from(row.cells)) {
      const span = cell.colSpan || 1;
      if (span === 1 && ci < cols) {
        const len = (cell.textContent || '').trim().length;
        const w = len ? clamp(len * 7 + 20, 60, 240) : 120;
        if (w > widths[ci]) widths[ci] = w;
      }
      ci += span;
    }
  }
  for (let i = 0; i < cols; i++) if (!widths[i]) widths[i] = 120;
  return widths;
}

// Jadvalga <colgroup> qo'shadi (bo'lmasa) va har bir <col> ga kenglik beradi.
// table-layout: fixed — ustun kengliklari colgroup orqali boshqariladi.
function ensureColgroup(table: HTMLTableElement): HTMLTableColElement[] {
  const cols = columnCount(table);
  if (!cols) return [];
  table.style.tableLayout = 'fixed';
  let colgroup = table.querySelector(':scope > colgroup') as HTMLElement | null;
  const widths = measureColWidths(table, cols);
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }
  const list: HTMLTableColElement[] = [];
  for (let i = 0; i < cols; i++) {
    let col = colgroup.children[i] as HTMLTableColElement | undefined;
    if (!col) {
      col = document.createElement('col');
      colgroup.appendChild(col);
    }
    if (!col.style.width) col.style.width = `${widths[i]}px`;
    list.push(col);
  }
  while (colgroup.children.length > cols) colgroup.removeChild(colgroup.lastChild!);
  return list;
}

// Jadval ustunlari yig'indisi varaqning ichki kengligidan oshsa — barcha ustun
// kengliklarini bir xil nisbatda kichraytiramiz (proporsiya saqlanadi). Faqat
// KICHRAYTIRADI: kichik jadvallar (blanka imzo bloklari) o'z holida qoladi.
// Natijada Word'dan kelgan keng jadval A4 ramkasiga aynan sig'adi, kataklar
// nisbati o'zgarmaydi, matn faqat pastga tushadi.
function fitTablesToWidth(root: HTMLElement) {
  const cs = getComputedStyle(root);
  const pad =
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const avail = root.clientWidth - pad;
  if (!(avail > 0)) return;
  root.querySelectorAll('table').forEach((t) => {
    const table = t as HTMLTableElement;
    const colgroup = table.querySelector(':scope > colgroup');
    if (!colgroup) return;
    const cols = Array.from(colgroup.children) as HTMLElement[];
    const widths = cols.map((c) => parseFloat(c.style.width) || 0);
    const total = widths.reduce((a, b) => a + b, 0);
    if (total > avail && total > 0) {
      const f = avail / total;
      cols.forEach((c, i) => {
        c.style.width = `${Math.max(6, Math.round(widths[i] * f))}px`;
      });
    }
  });
}

// Konteyner ichidagi barcha jadvallarni tayyorlaydi (colgroup + fixed layout)
// va A4 varaq kengligiga sig'diradi.
export function normalizeTables(root: HTMLElement) {
  root.querySelectorAll('table').forEach((t) => ensureColgroup(t as HTMLTableElement));
  fitTablesToWidth(root);
}

type Handle =
  | { kind: 'col'; table: HTMLTableElement; col: HTMLTableColElement }
  | { kind: 'row'; table: HTMLTableElement; row: HTMLTableRowElement };

// contentEditable konteynerga jadval o'lchash imkonini ulaydi. Tozalash
// funksiyasini qaytaradi (useEffect cleanup uchun).
export function attachTableResize(root: HTMLElement, onChange: () => void): () => void {
  let drag: (Handle & { startX: number; startY: number; startVal: number }) | null = null;

  const cellFromEvent = (e: MouseEvent): HTMLTableCellElement | null => {
    let n = e.target as Node | null;
    while (n && n !== root) {
      if (n instanceof HTMLTableCellElement) return n;
      n = n.parentNode;
    }
    return null;
  };

  // Katakning jadvaldagi boshlang'ich ustun indeksi (colspan hisobga olinadi).
  const colStart = (cell: HTMLTableCellElement): number => {
    const row = cell.parentElement as HTMLTableRowElement;
    let idx = 0;
    for (const c of Array.from(row.cells)) {
      if (c === cell) break;
      idx += c.colSpan || 1;
    }
    return idx;
  };

  const detect = (e: MouseEvent): Handle | null => {
    const cell = cellFromEvent(e);
    if (!cell) return null;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!table) return null;
    const rect = cell.getBoundingClientRect();
    // O'ng chegara — shu ustunning kengligi
    if (Math.abs(e.clientX - rect.right) <= EDGE) {
      const cols = ensureColgroup(table);
      const idx = colStart(cell) + (cell.colSpan || 1) - 1;
      if (cols[idx]) return { kind: 'col', table, col: cols[idx] };
    }
    // Chap chegara — oldingi ustun
    if (Math.abs(e.clientX - rect.left) <= EDGE) {
      const cols = ensureColgroup(table);
      const idx = colStart(cell) - 1;
      if (idx >= 0 && cols[idx]) return { kind: 'col', table, col: cols[idx] };
    }
    // Pastki chegara — satr balandligi
    if (Math.abs(e.clientY - rect.bottom) <= EDGE) {
      return { kind: 'row', table, row: cell.parentElement as HTMLTableRowElement };
    }
    return null;
  };

  const onMove = (e: MouseEvent) => {
    if (drag) return;
    const h = detect(e);
    root.style.cursor = h ? (h.kind === 'col' ? 'col-resize' : 'row-resize') : '';
  };

  const onDown = (e: MouseEvent) => {
    const h = detect(e);
    if (!h) return;
    e.preventDefault(); // matn belgilashni to'xtatamiz
    const startVal =
      h.kind === 'col'
        ? parseFloat(h.col.style.width) || h.col.getBoundingClientRect().width || 100
        : h.row.getBoundingClientRect().height;
    drag = { ...h, startX: e.clientX, startY: e.clientY, startVal };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', onUp);
  };

  const onDrag = (e: MouseEvent) => {
    if (!drag) return;
    e.preventDefault();
    if (drag.kind === 'col') {
      const w = clamp(drag.startVal + (e.clientX - drag.startX), MIN_COL, 2000);
      drag.col.style.width = `${Math.round(w)}px`;
    } else {
      const hgt = Math.max(MIN_ROW, drag.startVal + (e.clientY - drag.startY));
      drag.row.style.height = `${Math.round(hgt)}px`;
    }
  };

  const onUp = () => {
    if (!drag) return;
    drag = null;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', onUp);
    root.style.cursor = '';
    onChange();
  };

  root.addEventListener('mousemove', onMove);
  root.addEventListener('mousedown', onDown);
  return () => {
    root.removeEventListener('mousemove', onMove);
    root.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', onUp);
    root.style.cursor = '';
  };
}
