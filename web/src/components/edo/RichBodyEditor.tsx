import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, Type, AlignJustify, Baseline, Table } from 'lucide-react';

// Hujjat matni uchun HTML muharrir — Word'dan kelgan jadval/formatlashni saqlaydi.
// A4 ga moslash uchun: shrift turi, harflar hajmi va qatorlar oralig'i (interval)
// butun matnga qo'llanadi va saqlanadi (data-doc-style o'ram orqali).

interface DocStyle {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
}

const DEFAULT_STYLE: DocStyle = { fontFamily: '', fontSize: '', lineHeight: '' };

const FONT_FAMILIES = [
  { value: '', label: 'Shrift' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
  { value: "'Courier New', monospace", label: 'Courier New' },
];

const FONT_SIZES = [
  { value: '', label: 'Hajm' },
  { value: '12px', label: '12' },
  { value: '14px', label: '14' },
  { value: '16px', label: '16' },
  { value: '18px', label: '18' },
  { value: '20px', label: '20' },
  { value: '24px', label: '24' },
];

const LINE_HEIGHTS = [
  { value: '', label: 'Interval' },
  { value: '1', label: '1.0' },
  { value: '1.15', label: '1.15' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2.0' },
];

// value ni o'ramdan ajratib olish (agar oldin bizning o'ramimiz bilan saqlangan bo'lsa).
function parseWrapper(html: string): { style: DocStyle | null; inner: string } {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  const first = tmp.firstElementChild;
  if (
    tmp.childNodes.length === 1 &&
    first instanceof HTMLElement &&
    first.hasAttribute('data-doc-style')
  ) {
    return {
      style: {
        fontFamily: first.style.fontFamily || '',
        fontSize: first.style.fontSize || '',
        lineHeight: first.style.lineHeight || '',
      },
      inner: first.innerHTML,
    };
  }
  return { style: null, inner: html || '' };
}

function wrap(inner: string, s: DocStyle): string {
  if (!inner || !inner.trim()) return '';
  const hasStyle = s.fontFamily || s.fontSize || s.lineHeight;
  if (!hasStyle) return inner;
  const style = [
    s.fontFamily ? `font-family:${s.fontFamily}` : '',
    s.fontSize ? `font-size:${s.fontSize}` : '',
    s.lineHeight ? `line-height:${s.lineHeight}` : '',
  ]
    .filter(Boolean)
    .join(';');
  return `<div data-doc-style style="${style}">${inner}</div>`;
}

export function RichBodyEditor({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [docStyle, setDocStyle] = useState<DocStyle>(DEFAULT_STYLE);
  const [tableOpen, setTableOpen] = useState(false);
  const [tRows, setTRows] = useState(2);
  const [tCols, setTCols] = useState(2);

  // Tashqaridan value o'zgarsa (shablon qo'llanganda) — muharrirni yangilaymiz.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { style, inner } = parseWrapper(value || '');
    if (el.innerHTML !== inner) el.innerHTML = inner;
    if (style) setDocStyle(style);
  }, [value]);

  // docStyle o'zgarsa — muharrirga vizual qo'llaymiz.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.fontFamily = docStyle.fontFamily;
    el.style.fontSize = docStyle.fontSize;
    el.style.lineHeight = docStyle.lineHeight;
  }, [docStyle]);

  const emit = () => {
    if (ref.current) onChange(wrap(ref.current.innerHTML, docStyle));
  };

  const exec = (cmd: string) => {
    if (disabled) return;
    document.execCommand(cmd, false);
    ref.current?.focus();
    emit();
  };

  // Belgilangan matn rangini o'zgartirish. Rang tanlashda tanlov (selection)
  // yo'qolmasligi uchun oxirgi tanlangan diapazonni saqlab boramiz.
  const savedRange = useRef<Range | null>(null);
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const applyColor = (color: string) => {
    if (disabled) return;
    const el = ref.current;
    el?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color);
    emit();
  };

  const changeStyle = (patch: Partial<DocStyle>) => {
    if (disabled) return;
    const next = { ...docStyle, ...patch };
    setDocStyle(next);
    const el = ref.current;
    if (el) {
      el.style.fontFamily = next.fontFamily;
      el.style.fontSize = next.fontSize;
      el.style.lineHeight = next.lineHeight;
      onChange(wrap(el.innerHTML, next));
    }
  };

  // Jadval qo'shish: matn maydoniga HTML jadval joylanadi.
  const insertTable = () => {
    if (disabled) return;
    const rows = Math.max(1, Math.min(20, tRows || 1));
    const cols = Math.max(1, Math.min(10, tCols || 1));
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    const cell =
      '<td style="border:1px solid #333;padding:4px 6px;min-width:48px;">&nbsp;</td>';
    const row = `<tr>${cell.repeat(cols)}</tr>`;
    const table =
      `<table class="tpl-table" style="border-collapse:collapse;width:100%;margin:6px 0;">${row.repeat(
        rows,
      )}</table><p><br/></p>`;
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('insertHTML', false, table);
    setTableOpen(false);
    emit();
  };

  if (disabled) {
    return (
      <div
        className="edo-doc-body prose prose-sm max-w-none min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800"
        dangerouslySetInnerHTML={{ __html: value || '' }}
      />
    );
  }

  const selCls =
    'h-8 text-xs border border-slate-200 rounded-md px-1.5 bg-white text-slate-600 outline-none focus:border-asaka-400';

  return (
    <div className="rounded-xl border border-slate-300 focus-within:border-asaka-500 focus-within:ring-2 focus-within:ring-asaka-100 overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('bold')}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('italic')}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertUnorderedList')}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
        >
          <List size={15} />
        </button>

        <span className="w-px h-5 bg-slate-200 mx-1" />

        {/* A4 ga moslash: shrift turi / harflar hajmi / qatorlar oralig'i */}
        <Type size={14} className="text-slate-400" />
        <select
          value={docStyle.fontFamily}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => changeStyle({ fontFamily: e.target.value })}
          className={selCls}
          title="Shrift turi"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={docStyle.fontSize}
          onChange={(e) => changeStyle({ fontSize: e.target.value })}
          className={selCls}
          title="Harflar hajmi"
        >
          {FONT_SIZES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="inline-flex items-center gap-1">
          <AlignJustify size={14} className="text-slate-400" />
          <select
            value={docStyle.lineHeight}
            onChange={(e) => changeStyle({ lineHeight: e.target.value })}
            className={selCls}
            title="Qatorlar oralig'i (interval)"
          >
            {LINE_HEIGHTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </span>

        <span className="w-px h-5 bg-slate-200 mx-1" />

        {/* Matn rangi (belgilangan qismga qo'llanadi) */}
        <label
          className="relative inline-flex items-center gap-1 p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
          title="Matn rangi"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Baseline size={15} />
          <input
            type="color"
            defaultValue="#0f172a"
            onChange={(e) => applyColor(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>

        <span className="w-px h-5 bg-slate-200 mx-1" />

        {/* Jadval qo'shish */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
            }}
            onClick={() => setTableOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
            title="Jadval qo'shish"
          >
            <Table size={15} />
          </button>
          {tableOpen && (
            <div
              className="absolute z-20 top-9 left-0 w-44 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-slate-600">Qatorlar</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tRows}
                  onChange={(e) => setTRows(Number(e.target.value))}
                  className="w-14 h-7 text-xs border border-slate-200 rounded px-1.5 text-slate-700"
                />
              </div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs text-slate-600">Ustunlar</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={tCols}
                  onChange={(e) => setTCols(Number(e.target.value))}
                  className="w-14 h-7 text-xs border border-slate-200 rounded px-1.5 text-slate-700"
                />
              </div>
              <button
                type="button"
                onClick={insertTable}
                className="w-full h-8 rounded-md bg-asaka-600 text-white text-xs font-medium hover:bg-asaka-700"
              >
                Qo'shish
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        data-placeholder={placeholder}
        className="edo-doc-body prose prose-sm max-w-none min-h-[180px] max-h-[520px] overflow-auto px-4 py-3 text-slate-800 outline-none"
      />
    </div>
  );
}
