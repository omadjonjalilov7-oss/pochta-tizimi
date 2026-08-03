import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Save,
  Loader2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Baseline,
  Highlighter,
} from 'lucide-react';
import { api } from '../../lib/api';

interface Props {
  documentId: string;
  attId: string;
  filename: string;
  onClose: () => void;
  onSaved?: () => void;
}

// Word/ODT/RTF fayllar uchun mos shriftlar (Word bilan bir xil ko'rinsin).
const FONTS = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Cambria',
  'Courier New',
  'Georgia',
  'Tahoma',
  'Verdana',
];

// Shrift xajmlari (pt — Word bilan bir xil).
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

// Qatorlar orasidagi interval.
const LINE_HEIGHTS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
];

// Tez tanlash uchun ranglar.
const COLOR_PRESETS = [
  '#000000', '#e11d48', '#ea580c', '#ca8a04',
  '#16a34a', '#0891b2', '#2563eb', '#7c3aed',
];

// O'zimizning brauzer ichi Word muharririmiz. Fayl serverda LibreOffice orqali
// HTML'ga aylantirilib ochiladi; foydalanuvchi to'g'ridan-to'g'ri matnни
// tahrirlaydi (shrift, xajm, joylashuv, rang, interval); saqlanганда HTML yana
// asl Office formatига qaytariladi. OnlyOffice/ServiceWorker/HTTPS kerak emas.
export default function WordEditorModal({
  documentId,
  attId,
  filename,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editable, setEditable] = useState(true);
  const [font, setFont] = useState('');
  const [size, setSize] = useState('');

  // Faylni HTML sifatida yuklaymiz.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(
          `/documents/${documentId}/attachments/${attId}/html`,
        );
        if (cancelled) return;
        setEditable(res.data?.editable !== false);
        if (editorRef.current) {
          editorRef.current.innerHTML = res.data?.html || '';
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(t('edo.editor.err_load'));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, attId]);

  // Tanlangan matn diapazonini eslab qolamiz (toolbar bosilganda yo'qolmasин).
  const rememberSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  // Buyruq bajarish (execCommand — barcha brauzerlarда ishlaydi).
  const exec = (command: string, value?: string) => {
    if (!editable) return;
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      /* ba'zi brauzerlar qo'llab-quvvatlamaydi */
    }
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    rememberSelection();
  };

  // Shrift xajmini (pt) qo'llash: execCommand('fontSize') faqat 1-7 ni oladi,
  // shuning uchun avval 7 bilan belgilaymiz, so'ng <font> elementlarини topib
  // haqiqiy pt xajmini beramiz.
  const applyFontSize = (pt: string) => {
    if (!editable || !pt) return;
    restoreSelection();
    document.execCommand('fontSize', false, '7');
    const editor = editorRef.current;
    if (editor) {
      editor.querySelectorAll('font[size="7"]').forEach((el) => {
        const f = el as HTMLElement;
        f.removeAttribute('size');
        f.style.fontSize = `${pt}pt`;
      });
    }
    editor?.focus();
    rememberSelection();
  };

  // Qator intervalini tanlangan bloklarga (paragraflarga) qo'llaymiz.
  const applyLineHeight = (value: string) => {
    if (!editable) return;
    restoreSelection();
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !editor) return;
    const range = sel.getRangeAt(0);

    // Diapazon bilan kesishgan blok elementlarни topamiz.
    const blocks = Array.from(
      editor.querySelectorAll('p, div, li, td, h1, h2, h3, h4, h5, h6'),
    ).filter((el) => range.intersectsNode(el));

    if (blocks.length === 0) {
      // Tanlanmagan bo'lsa — butun hujjatga.
      editor.style.lineHeight = value;
    } else {
      blocks.forEach((el) => {
        (el as HTMLElement).style.lineHeight = value;
      });
    }
    editor.focus();
    rememberSelection();
  };

  const handleSave = async () => {
    if (!editable || !editorRef.current) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/documents/${documentId}/attachments/${attId}/html`, {
        html: editorRef.current.innerHTML,
      });
      onSaved?.();
      onClose();
    } catch {
      setError(t('edo.editor.err_save'));
      setSaving(false);
    }
  };

  // Toolbar tugmasi bosilганда tanlov yo'qolmasин (mousedown'ni to'xtatamiz).
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 flex flex-col">
      {/* Sarlavha */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-asaka-700 px-2.5 py-1.5 rounded-md hover:bg-slate-100"
        >
          <ArrowLeft size={18} />
          {t('common.back')}
        </button>
        <span className="font-semibold text-slate-800 truncate mx-3 flex-1 text-center">
          {filename}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || !editable}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-asaka-600 hover:bg-asaka-700 disabled:opacity-50 px-4 py-1.5 rounded-md"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {/* Asboblar paneli */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0">
          {/* Shrift */}
          <select
            value={font}
            onMouseDown={rememberSelection}
            onChange={(e) => {
              setFont(e.target.value);
              exec('fontName', e.target.value);
            }}
            className="h-8 text-sm border border-slate-300 rounded-md px-1.5 bg-white max-w-[130px]"
            title={t('edo.editor.font')}
          >
            <option value="">{t('edo.editor.font')}</option>
            {FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>

          {/* Shrift xajmi */}
          <select
            value={size}
            onMouseDown={rememberSelection}
            onChange={(e) => {
              setSize(e.target.value);
              applyFontSize(e.target.value);
            }}
            className="h-8 text-sm border border-slate-300 rounded-md px-1.5 bg-white w-16"
            title={t('edo.editor.size')}
          >
            <option value="">{t('edo.editor.size')}</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <Divider />

          {/* Uslub */}
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('bold')} title={t('edo.editor.bold')}>
            <Bold size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('italic')} title={t('edo.editor.italic')}>
            <Italic size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('underline')} title={t('edo.editor.underline')}>
            <Underline size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('strikeThrough')} title={t('edo.editor.strike')}>
            <Strikethrough size={16} />
          </ToolBtn>

          <Divider />

          {/* Rang */}
          <label
            className="inline-flex items-center gap-1 h-8 px-1.5 rounded-md hover:bg-slate-200 cursor-pointer"
            title={t('edo.editor.text_color')}
            onMouseDown={rememberSelection}
          >
            <Baseline size={16} />
            <input
              type="color"
              className="w-5 h-5 border-0 bg-transparent cursor-pointer p-0"
              onChange={(e) => exec('foreColor', e.target.value)}
            />
          </label>
          <label
            className="inline-flex items-center gap-1 h-8 px-1.5 rounded-md hover:bg-slate-200 cursor-pointer"
            title={t('edo.editor.highlight')}
            onMouseDown={rememberSelection}
          >
            <Highlighter size={16} />
            <input
              type="color"
              className="w-5 h-5 border-0 bg-transparent cursor-pointer p-0"
              onChange={(e) => exec('hiliteColor', e.target.value)}
            />
          </label>
          {/* Tez ranglar */}
          <div className="hidden md:flex items-center gap-0.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={rememberSelection}
                onClick={() => exec('foreColor', c)}
                className="w-5 h-5 rounded border border-slate-300"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          <Divider />

          {/* Joylashuv */}
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('justifyLeft')} title={t('edo.editor.align_left')}>
            <AlignLeft size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('justifyCenter')} title={t('edo.editor.align_center')}>
            <AlignCenter size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('justifyRight')} title={t('edo.editor.align_right')}>
            <AlignRight size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('justifyFull')} title={t('edo.editor.align_justify')}>
            <AlignJustify size={16} />
          </ToolBtn>

          <Divider />

          {/* Interval */}
          <select
            defaultValue=""
            onMouseDown={rememberSelection}
            onChange={(e) => applyLineHeight(e.target.value)}
            className="h-8 text-sm border border-slate-300 rounded-md px-1.5 bg-white"
            title={t('edo.editor.line_height')}
          >
            <option value="" disabled>
              {t('edo.editor.line_height')}
            </option>
            {LINE_HEIGHTS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>

          <Divider />

          {/* Ro'yxat */}
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('insertUnorderedList')} title={t('edo.editor.bullet_list')}>
            <List size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('insertOrderedList')} title={t('edo.editor.number_list')}>
            <ListOrdered size={16} />
          </ToolBtn>

          <Divider />

          {/* Bekor / Qaytarish */}
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('undo')} title={t('edo.editor.undo')}>
            <Undo2 size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('redo')} title={t('edo.editor.redo')}>
            <Redo2 size={16} />
          </ToolBtn>
        </div>
      )}

      {error && (
        <div className="px-4 py-1.5 bg-red-50 text-red-700 text-sm text-center shrink-0">
          {error}
        </div>
      )}
      {!editable && !loading && (
        <div className="px-4 py-1.5 bg-amber-50 text-amber-700 text-sm text-center shrink-0">
          {t('edo.editor.readonly')}
        </div>
      )}

      {/* Tahrirlash maydoni */}
      <div className="relative flex-1 bg-slate-200 overflow-auto py-6">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">{t('edo.editor.loading')}</span>
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={editable && !loading}
          suppressContentEditableWarning
          onKeyUp={rememberSelection}
          onMouseUp={rememberSelection}
          className="wordedit-page mx-auto bg-white shadow-lg outline-none"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '25mm 20mm',
            boxSizing: 'border-box',
            maxWidth: '100%',
          }}
        />
      </div>
    </div>
  );
}

// Kichik ajratuvchi chiziq.
function Divider() {
  return <span className="w-px h-6 bg-slate-300 mx-0.5" />;
}

// Bir xil ko'rinishдаги toolbar tugmasi.
function ToolBtn({
  children,
  onClick,
  onMouseDown,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={onMouseDown}
      title={title}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-700 hover:bg-slate-200"
    >
      {children}
    </button>
  );
}
