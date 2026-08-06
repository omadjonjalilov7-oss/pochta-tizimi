// Jadval ustun/satrlarini sichqoncha bilan cheklab o'lchash uchun yordamchi.
// contentEditable ichidagi <table>larga <colgroup> qo'shadi (Word'dan kelgan
// jadvallar odatda ustun kengligisiz keladi va siqilib buziladi) hamda jadval
// chegarasini sudrab ustun kengligi / satr balandligini o'zgartirishga imkon beradi.

const EDGE = 8; // chegaraga necha px yaqinlikda "resize" kursori chiqadi
const MIN_COL = 24;
const MIN_ROW = 18;

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
function fitTablesToWidth(root: HTMLElement, attempt = 0) {
  const cs = getComputedStyle(root);
  const pad =
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const avail = root.clientWidth - pad;
  // Modal ochilish paytida varaq hali o'lchanmagan bo'lishi mumkin (clientWidth=0).
  // Shu holda keyingi kadrda qayta urinamiz.
  if (!(avail > 0)) {
    if (attempt < 10 && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => fitTablesToWidth(root, attempt + 1));
    }
    return;
  }
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

/* ================= Jadvalni tahrirlash (satr/ustun qo'shish-o'chirish) =================
   Word'dan kelgan jadvallarda birlashtirilgan kataklar (colspan/rowspan) bo'ladi.
   Shu sabab har bir amal uchun avval jadvalning "vizual to'ri" (grid) quriladi:
   grid[r][c] — (r,satr; c,ustun) katakchada qaysi <td> turishini ko'rsatadi. */

interface GridRef {
  cell: HTMLTableCellElement;
  r: number; // katak boshlangan satr
  c: number; // katak boshlangan ustun
}

function buildGrid(table: HTMLTableElement): GridRef[][] {
  const grid: GridRef[][] = [];
  const rows = Array.from(table.rows);
  rows.forEach((row, r) => {
    if (!grid[r]) grid[r] = [];
    let c = 0;
    for (const cell of Array.from(row.cells)) {
      while (grid[r][c]) c++;
      const cs = cell.colSpan || 1;
      const rs = cell.rowSpan || 1;
      const ref: GridRef = { cell, r, c };
      for (let i = 0; i < rs; i++) {
        for (let j = 0; j < cs; j++) {
          if (!grid[r + i]) grid[r + i] = [];
          grid[r + i][c + j] = ref;
        }
      }
      c += cs;
    }
  });
  return grid;
}

function gridCols(grid: GridRef[][]): number {
  return grid.reduce((m, row) => Math.max(m, row.length), 0);
}

function findRef(grid: GridRef[][], cell: HTMLTableCellElement): GridRef | null {
  for (const row of grid) {
    for (const ref of row) {
      if (ref && ref.cell === cell) return ref;
    }
  }
  return null;
}

function newCell(sample?: HTMLTableCellElement): HTMLTableCellElement {
  const td = document.createElement(sample?.tagName === 'TH' ? 'th' : 'td');
  td.innerHTML = '<br>';
  return td;
}

// Jadval ustunlarini emit'gacha o'lchash mumkin bo'lishi uchun colgroup'ni
// ustun soniga moslaymiz.
function syncColgroup(table: HTMLTableElement) {
  ensureColgroup(table);
}

// ------- Ustun qo'shish (chapga/o'ngga) -------
export function tableInsertColumn(
  cell: HTMLTableCellElement,
  side: 'left' | 'right',
) {
  const table = cell.closest('table') as HTMLTableElement | null;
  if (!table) return;
  const grid = buildGrid(table);
  const ref = findRef(grid, cell);
  if (!ref) return;
  const cs = cell.colSpan || 1;
  const at = side === 'left' ? ref.c : ref.c + cs; // shu vizual ustun oldiga qo'shamiz
  const rows = Array.from(table.rows);
  const expanded = new Set<HTMLTableCellElement>();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rAt = grid[r]?.[at];
    const rLeft = at - 1 >= 0 ? grid[r]?.[at - 1] : undefined;
    // Chegara ustidan o'tuvchi bitta katak (ikkala tomonni ham egallagan) — kengaytiramiz.
    if (rAt && rLeft && rAt.cell === rLeft.cell) {
      if (!expanded.has(rAt.cell)) {
        rAt.cell.colSpan = (rAt.cell.colSpan || 1) + 1;
        expanded.add(rAt.cell);
      }
      continue;
    }
    const td = newCell(cell);
    if (rAt && rAt.r === r) {
      row.insertBefore(td, rAt.cell);
    } else {
      // `at` ustuni yuqoridan tushgan rowspan bilan qoplangan — shu satrda
      // `at` yoki undan keyin boshlanadigan birinchi katakdan oldin qo'yamiz.
      let target: HTMLTableCellElement | null = null;
      for (const cc of Array.from(row.cells)) {
        // cc ning boshlang'ich vizual ustunini grid'dan topamiz
        let originC = -1;
        for (let c = 0; c < (grid[r]?.length || 0); c++) {
          if (grid[r][c]?.cell === cc) {
            originC = grid[r][c].c;
            break;
          }
        }
        if (originC >= at) {
          target = cc;
          break;
        }
      }
      if (target) row.insertBefore(td, target);
      else row.appendChild(td);
    }
  }
  // colgroup'ga yangi ustun
  const colgroup = table.querySelector(':scope > colgroup');
  if (colgroup) {
    const cols = Array.from(colgroup.children) as HTMLElement[];
    const nc = document.createElement('col');
    const srcW = cols[Math.min(at, cols.length - 1)]?.style.width || '80px';
    nc.style.width = srcW;
    if (at < cols.length) colgroup.insertBefore(nc, cols[at]);
    else colgroup.appendChild(nc);
  }
  syncColgroup(table);
}

// ------- Ustunni o'chirish -------
export function tableDeleteColumn(cell: HTMLTableCellElement) {
  const table = cell.closest('table') as HTMLTableElement | null;
  if (!table) return;
  const grid = buildGrid(table);
  const ref = findRef(grid, cell);
  if (!ref) return;
  const total = gridCols(grid);
  if (total <= 1) return;
  const col = ref.c;
  const rows = Array.from(table.rows);
  const handled = new Set<HTMLTableCellElement>();
  for (let r = 0; r < rows.length; r++) {
    const cref = grid[r]?.[col];
    if (!cref) continue;
    if (handled.has(cref.cell)) continue;
    handled.add(cref.cell);
    const c = cref.cell;
    if ((c.colSpan || 1) > 1) {
      c.colSpan = c.colSpan - 1; // kengligi kamayadi, katak qoladi
    } else {
      c.remove();
    }
  }
  // colgroup'dan olib tashlaymiz
  const colgroup = table.querySelector(':scope > colgroup');
  if (colgroup && colgroup.children[col]) {
    colgroup.removeChild(colgroup.children[col]);
  }
  syncColgroup(table);
}

// ------- Satr qo'shish (tepaga/pastga) -------
export function tableInsertRow(
  cell: HTMLTableCellElement,
  side: 'above' | 'below',
) {
  const table = cell.closest('table') as HTMLTableElement | null;
  if (!table) return;
  const grid = buildGrid(table);
  const ref = findRef(grid, cell);
  if (!ref) return;
  const total = gridCols(grid);
  const rs = cell.rowSpan || 1;
  const at = side === 'above' ? ref.r : ref.r + rs; // shu satr oldiga
  const tr = document.createElement('tr');
  // Chegaradan o'tuvchi rowspan kataklar — ularni kengaytiramiz, yangi satrda o'rin bermaymiz.
  const crossing = new Set<HTMLTableCellElement>();
  for (let c = 0; c < total; c++) {
    const above = at - 1 >= 0 ? grid[at - 1]?.[c] : undefined;
    const below = at < grid.length ? grid[at]?.[c] : undefined;
    if (above && below && above.cell === below.cell) crossing.add(above.cell);
  }
  crossing.forEach((c) => (c.rowSpan = (c.rowSpan || 1) + 1));
  let c = 0;
  while (c < total) {
    const below = grid[at]?.[c];
    if (below && crossing.has(below.cell)) {
      // shu ustun(lar) o'tuvchi katak bilan qoplandi
      c += below.cell.colSpan || 1;
      continue;
    }
    tr.appendChild(newCell(cell));
    c += 1;
  }
  const rows = Array.from(table.rows);
  const refRow = rows[at];
  if (refRow && refRow.parentNode) {
    refRow.parentNode.insertBefore(tr, refRow);
  } else {
    const tb = table.tBodies[0] || table;
    tb.appendChild(tr);
  }
}

// ------- Satrni o'chirish -------
export function tableDeleteRow(cell: HTMLTableCellElement) {
  const table = cell.closest('table') as HTMLTableElement | null;
  if (!table) return;
  if (table.rows.length <= 1) return;
  const grid = buildGrid(table);
  const domRow = cell.parentElement as HTMLTableRowElement | null;
  if (!domRow) return;
  const rIndex = Array.from(table.rows).indexOf(domRow);
  if (rIndex < 0) return;
  const nextRow = table.rows[rIndex + 1] || null;
  // Yuqoridan tushib shu satrni qoplagan kataklar rowspan'ini kamaytiramiz.
  const seen = new Set<HTMLTableCellElement>();
  const rowCols = grid[rIndex]?.length || 0;
  for (let c = 0; c < rowCols; c++) {
    const cref = grid[rIndex][c];
    if (cref && cref.r < rIndex && !seen.has(cref.cell)) {
      cref.cell.rowSpan = Math.max(1, (cref.cell.rowSpan || 1) - 1);
      seen.add(cref.cell);
    }
  }
  // Shu satrda boshlanib pastga cho'zilgan kataklarni keyingi satrga ko'chiramiz.
  if (nextRow) {
    for (const cc of Array.from(domRow.cells)) {
      if ((cc.rowSpan || 1) > 1) {
        cc.rowSpan = cc.rowSpan - 1;
        nextRow.insertBefore(cc, nextRow.firstChild);
      }
    }
  }
  domRow.remove();
}

// Belgilangan katakning matnini 0→90→180→270→0 aylantiradi (vertikal yozuv).
// Uslub katak ichidagi o'rovchi <div>ga qo'yiladi; class saqlashda o'chsa ham
// (writing-mode/transform) uslub qoladi, shu sabab holat uslubdan aniqlanadi.
export function rotateCellText(cell: HTMLTableCellElement): void {
  let wrap = Array.from(cell.children).find(
    (ch) =>
      ch instanceof HTMLElement &&
      ch.tagName === 'DIV' &&
      (ch.style.writingMode !== '' || /rotate/.test(ch.style.transform)),
  ) as HTMLElement | undefined;
  const hadWrap = !!wrap;
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.setAttribute('data-rot', '1');
    while (cell.firstChild) wrap.appendChild(cell.firstChild);
    cell.appendChild(wrap);
  }
  const hasWM = wrap.style.writingMode === 'vertical-rl';
  const hasRot = /rotate\(180deg\)/.test(wrap.style.transform);
  let next: 0 | 90 | 180 | 270;
  if (!hadWrap) next = 90;
  else if (hasWM && hasRot) next = 180;
  else if (!hasWM && hasRot) next = 270;
  else if (hasWM && !hasRot) next = 0;
  else next = 90;
  wrap.style.writingMode = '';
  wrap.style.transform = '';
  wrap.style.whiteSpace = '';
  if (next === 90) {
    wrap.style.writingMode = 'vertical-rl';
    wrap.style.transform = 'rotate(180deg)';
  } else if (next === 180) {
    wrap.style.transform = 'rotate(180deg)';
  } else if (next === 270) {
    wrap.style.writingMode = 'vertical-rl';
  }
  if (next === 0) {
    while (wrap.firstChild) cell.insertBefore(wrap.firstChild, wrap);
    cell.removeChild(wrap);
  }
}
