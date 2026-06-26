/**
 * RichEditor — contenteditable asosida Word-ga o'xshash matn muharriri.
 * Toolbar: shrift oilasi, o'lchami, qalin/kursiv/tagiga chiziq/kesib o'tish,
 *          matn rangi, hizalama (chap/markaziy/o'ng/to'la),
 *          tartibsiz/tartibli ro'yxat, undo/redo.
 */
import { useEffect, useRef, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo2, Redo2, Palette,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Toolbar tugmasi ────────────────────────────────────────────────────────
function TB({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // focus yo'qolmasin
        onClick();
      }}
      className={cn(
        'w-7 h-7 rounded flex items-center justify-center text-sm transition-colors',
        active
          ? 'bg-brand-100 text-brand-700'
          : 'hover:bg-slate-100 text-slate-700',
      )}
    >
      {children}
    </button>
  );
}

// ─── Separator ─────────────────────────────────────────────────────────────
function Sep() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />;
}

// ─── Shrift oilalari ────────────────────────────────────────────────────────
const FONTS = [
  'Arial', 'Times New Roman', 'Georgia', 'Courier New',
  'Verdana', 'Tahoma', 'Trebuchet MS',
];

// ─── Shrift o'lchamlari (px) ────────────────────────────────────────────────
const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36];

// ─── exec buyrug'i yuborish ─────────────────────────────────────────────────
function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value ?? undefined);
}

// ─── Asosiy komponent ───────────────────────────────────────────────────────
interface RichEditorProps {
  value: string;           // HTML string (controlled)
  onChange: (html: string) => void;
  minHeight?: number;      // px
  placeholder?: string;
  className?: string;
  noBottomRadius?: boolean; // imzo bloki davom etganda pastki burchaklar keskin bo'lsin
}

export function RichEditor({
  value,
  onChange,
  minHeight = 260,
  placeholder = 'Xabar matni...',
  className,
  noBottomRadius = false,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUserEdit = useRef(false);

  // Tashqi qiymat o'zgarganda (masalan reply/forward pre-fill)
  useEffect(() => {
    if (isUserEdit.current) return;
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    isUserEdit.current = true;
    onChange(editorRef.current?.innerHTML ?? '');
  }, [onChange]);

  // ── Formatlar ─────────────────────────────────────────────────────────────
  const bold       = () => exec('bold');
  const italic     = () => exec('italic');
  const underline  = () => exec('underline');
  const strike     = () => exec('strikeThrough');
  const ul         = () => exec('insertUnorderedList');
  const ol         = () => exec('insertOrderedList');
  const alignL     = () => exec('justifyLeft');
  const alignC     = () => exec('justifyCenter');
  const alignR     = () => exec('justifyRight');
  const alignJ     = () => exec('justifyFull');
  const undo       = () => exec('undo');
  const redo       = () => exec('redo');

  const setFont = (font: string) => exec('fontName', font);

  const setSize = (px: number) => {
    // execCommand fontSize faqat 1-7 qiymat qabul qiladi, shuning uchun
    // biz span bilan wrap qilamiz
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    range.surroundContents(span);
    sel.removeAllRanges();
  };

  const setColor = () => {
    const color = window.prompt('Matn rangi (hex, masalan #ff0000):');
    if (color) exec('foreColor', color);
  };

  return (
    <div className={cn(
      'border border-slate-300 overflow-hidden focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100',
      noBottomRadius ? 'rounded-t-lg' : 'rounded-lg',
      className,
    )}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50">

        {/* Shrift oilasi */}
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setFont(e.target.value)}
          defaultValue="Arial"
          className="h-7 text-xs border border-slate-200 rounded px-1 bg-white focus:outline-none focus:border-brand-400 max-w-[120px]"
          title="Shrift"
        >
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>

        {/* Shrift o'lchami */}
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setSize(Number(e.target.value))}
          defaultValue="14"
          className="h-7 text-xs border border-slate-200 rounded px-1 bg-white focus:outline-none focus:border-brand-400 w-[56px]"
          title="O'lcham"
        >
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <Sep />

        {/* Qalin, kursiv, tagiga chiziq, kesib o'tish */}
        <TB onClick={bold} title="Qalin (Ctrl+B)">
          <Bold size={14} />
        </TB>
        <TB onClick={italic} title="Kursiv (Ctrl+I)">
          <Italic size={14} />
        </TB>
        <TB onClick={underline} title="Tagiga chiziq (Ctrl+U)">
          <Underline size={14} />
        </TB>
        <TB onClick={strike} title="Kesib o'tish">
          <Strikethrough size={14} />
        </TB>

        <Sep />

        {/* Matn rangi */}
        <TB onClick={setColor} title="Matn rangi">
          <Palette size={14} />
        </TB>

        <Sep />

        {/* Hizalama */}
        <TB onClick={alignL} title="Chapga">
          <AlignLeft size={14} />
        </TB>
        <TB onClick={alignC} title="Markazga">
          <AlignCenter size={14} />
        </TB>
        <TB onClick={alignR} title="O'ngga">
          <AlignRight size={14} />
        </TB>
        <TB onClick={alignJ} title="To'la kenglik">
          <AlignJustify size={14} />
        </TB>

        <Sep />

        {/* Ro'yxatlar */}
        <TB onClick={ul} title="Tartibsiz ro'yxat">
          <List size={14} />
        </TB>
        <TB onClick={ol} title="Tartibli ro'yxat">
          <ListOrdered size={14} />
        </TB>

        <Sep />

        {/* Undo / Redo */}
        <TB onClick={undo} title="Bekor qilish (Ctrl+Z)">
          <Undo2 size={14} />
        </TB>
        <TB onClick={redo} title="Qaytarish (Ctrl+Y)">
          <Redo2 size={14} />
        </TB>
      </div>

      {/* ── Tahrirlash maydoni ───────────────────────────────────────────── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className={cn(
          'px-4 py-3 outline-none text-sm text-slate-900 overflow-y-auto',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400',
        )}
      />
    </div>
  );
}
