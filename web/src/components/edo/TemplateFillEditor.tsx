import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Baseline,
  Type,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoTemplate } from '../../lib/types';

// Shablon tanlanganda hujjatning to'liq ko'rinishi ochiladi, lekin faqat ikkita
// o'zgaruvchi tahrirlanadi:
//   {{mavzu}}        → hujjat mavzusi (subject) — oddiy matn (formatlanmaydi)
//   {{xujjat_matni}} → hujjat asosiy matni (body, {{matn}} ham qo'llab-quvvatlanadi)
// Qolgan blanka qismi qulflangan. Matn maydoni Word kabi to'liq formatlanadi:
// qalin/kursiv/tagchiziq, shrift turi/hajmi, qatorlar oralig'i (interval), rang,
// ro'yxatlar va matnni chap/markaz/o'ng/eniga tekislash.
function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

// Matn maydonining umumiy uslubini (shrift/hajm/interval) saqlash o'rami.
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

export function TemplateFillEditor({
  templateId,
  subject,
  body,
  onSubject,
  onBody,
  disabled,
  maxBodyChars = 3000,
}: {
  templateId: string;
  subject: string;
  body: string;
  onSubject: (v: string) => void;
  onBody: (html: string) => void;
  disabled?: boolean;
  maxBodyChars?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValidMatn = useRef<string>('');
  const [count, setCount] = useState(0);
  const [docStyle, setDocStyle] = useState<DocStyle>(DEFAULT_STYLE);

  const { data: templates = [] } = useQuery({
    queryKey: ['edo-templates'],
    queryFn: async () => (await api.get<EdoTemplate[]>('/templates')).data,
  });
  const tpl = templates.find((x) => x.id === templateId);

  // matnEl — tahrirlanadigan {{xujjat_matni}} maydoni.
  const matnField = () =>
    ref.current?.querySelector('[data-fill="matn"]') as HTMLElement | null;

  // Shablon HTML tayyor bo'lganda — bir marta joylashtiramiz (matn/subject
  // o'zgarganda qayta joylamasdan, kursor sakramasligi uchun).
  useEffect(() => {
    const el = ref.current;
    if (!el || !tpl) return;
    const editable = disabled ? 'false' : 'true';
    const { style: parsedStyle, inner } = parseWrapper(body || '');
    const html = tpl.bodyTemplate
      // Avtomat to'ldiriladigan _asaka_* / _sana_* / _gen_dir tokenlari
      // foydalanuvchiga ko'rinmasin — ular tasdiqlash jarayonida "fonda"
      // avtomat to'ladi. Ham {{_asaka_1}}, ham yalang'och _asaka_1 ko'rinishi.
      .replace(
        /\{\{\s*(?:_(?:asaka|sana)_\d+|_gen_dir)\s*\}\}|_(?:asaka|sana)_\d+|_gen_dir/g,
        '',
      )
      .replace(/\{\{\s*xujjat_n\s*\}\}/g, '<span class="tpl-ph">[рақам]</span>')
      .replace(/\{\{\s*sana_soat\s*\}\}/g, '<span class="tpl-ph">[сана]</span>')
      .replace(/\{\{\s*qr_kod\s*\}\}/g, '')
      .replace(
        /\{\{\s*mavzu\s*\}\}/g,
        `<span data-fill="mavzu" contenteditable="${editable}" class="tpl-fill">${escapeHtml(
          subject,
        )}</span>`,
      )
      .replace(
        /\{\{\s*(xujjat_matni|matn)\s*\}\}/g,
        `<div data-fill="matn" contenteditable="${editable}" class="tpl-fill">${inner}</div>`,
      );
    el.innerHTML = html;
    const matnEl = matnField();
    if (matnEl && parsedStyle) {
      matnEl.style.fontFamily = parsedStyle.fontFamily;
      matnEl.style.fontSize = parsedStyle.fontSize;
      matnEl.style.lineHeight = parsedStyle.lineHeight;
    }
    setDocStyle(parsedStyle ?? DEFAULT_STYLE);
    lastValidMatn.current = matnEl?.innerHTML ?? '';
    setCount(matnEl?.textContent?.length ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl?.id, disabled]);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    const mavzuEl = el.querySelector('[data-fill="mavzu"]') as HTMLElement | null;
    const matnEl = matnField();
    if (mavzuEl) onSubject((mavzuEl.textContent ?? '').replace(/\s+/g, ' ').trimStart());
    if (matnEl) {
      const text = matnEl.textContent ?? '';
      if (text.length > maxBodyChars) {
        // Chegaradan oshsa — oxirgi to'g'ri holatga qaytaramiz.
        matnEl.innerHTML = lastValidMatn.current;
        placeCaretEnd(matnEl);
        return;
      }
      lastValidMatn.current = matnEl.innerHTML;
      setCount(text.length);
      onBody(wrap(matnEl.innerHTML, docStyle));
    }
  };

  // Rang tanlashda tanlangan diapazon yo'qolmasligi uchun saqlab boramiz.
  const savedRange = useRef<Range | null>(null);
  const saveSelection = () => {
    const sel = window.getSelection();
    const el = matnField();
    if (sel && sel.rangeCount > 0 && el?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  // Belgilangan matnga formatlash buyrug'i (qalin, kursiv, tekislash, ro'yxat...).
  const exec = (cmd: string, val?: string) => {
    if (disabled) return;
    matnField()?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, val);
    saveSelection();
    sync();
  };

  const applyColor = (color: string) => {
    if (disabled) return;
    const el = matnField();
    el?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color);
    sync();
  };

  // Shrift turi / hajmi / interval — butun matn maydoniga qo'llanadi va saqlanadi.
  const changeStyle = (patch: Partial<DocStyle>) => {
    if (disabled) return;
    const next = { ...docStyle, ...patch };
    setDocStyle(next);
    const matnEl = matnField();
    if (matnEl) {
      matnEl.style.fontFamily = next.fontFamily;
      matnEl.style.fontSize = next.fontSize;
      matnEl.style.lineHeight = next.lineHeight;
      onBody(wrap(matnEl.innerHTML, next));
    }
  };

  if (!tpl) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
        Shablon yuklanmoqda…
      </div>
    );
  }

  // Ichki / ichki_yuristli blanka: jadval chapga yopishib, listni to'liq egallaydi
  // (abzatssiz, to'liq kenglik) — foydalanuvchi talabi.
  const isIchki = tpl.name === 'ichki' || tpl.name === 'ichki_yuristli';

  const btnCls = 'p-1.5 rounded hover:bg-slate-200 text-slate-600';
  const selCls =
    'h-8 text-xs border border-slate-200 rounded-md px-1.5 bg-white text-slate-600 outline-none focus:border-asaka-400';

  return (
    <div className="rounded-xl border border-slate-300 overflow-hidden">
      {!disabled && (
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
          {/* Qalin / kursiv / tagchiziq */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} className={btnCls} title="Qalin">
            <Bold size={15} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} className={btnCls} title="Kursiv">
            <Italic size={15} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} className={btnCls} title="Tagchiziq">
            <Underline size={15} />
          </button>

          <span className="w-px h-5 bg-slate-200 mx-1" />

          {/* Ro'yxatlar */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')} className={btnCls} title="Belgili ro'yxat">
            <List size={15} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')} className={btnCls} title="Raqamli ro'yxat">
            <ListOrdered size={15} />
          </button>

          <span className="w-px h-5 bg-slate-200 mx-1" />

          {/* Tekislash: chap / markaz / o'ng / eniga */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyLeft')} className={btnCls} title="Chapga">
            <AlignLeft size={15} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyCenter')} className={btnCls} title="Markazga">
            <AlignCenter size={15} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyRight')} className={btnCls} title="O'ngga">
            <AlignRight size={15} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyFull')} className={btnCls} title="Eniga">
            <AlignJustify size={15} />
          </button>

          <span className="w-px h-5 bg-slate-200 mx-1" />

          {/* Shrift turi / hajmi / interval — butun matnga */}
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

          <span className="w-px h-5 bg-slate-200 mx-1" />

          {/* Matn rangi (belgilangan qismga qo'llanadi) */}
          <label
            className="relative inline-flex items-center p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
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

          <span className="ml-auto text-xs text-slate-400 pr-1">
            {count} / {maxBodyChars}
          </span>
        </div>
      )}
      <div className="max-h-[560px] overflow-auto bg-slate-100 p-4">
        {/* A4 varaq ko'rinishi */}
        <div
          ref={ref}
          onInput={sync}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          className={`tpl-sheet bg-white mx-auto shadow-sm text-slate-900${
            isIchki ? ' edo-ichki-doc' : ''
          }`}
          style={{
            width: '210mm',
            minHeight: '297mm',
            // Ichki blankada yon otступ kichik — jadval listni to'ldirsin.
            padding: isIchki ? '12mm 6mm' : '18mm 16mm',
            boxSizing: 'border-box',
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  );
}

function placeCaretEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
