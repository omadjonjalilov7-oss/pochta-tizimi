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
  Subscript,
  Superscript,
  RemoveFormatting,
  AArrowUp,
  AArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Table as TableIcon,
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
// tahrirlaydi; saqlanганда HTML yana asl Office formatига qaytariladi.
// OnlyOffice/ServiceWorker/HTTPS kerak emas.
export default function WordEditorModal({
  documentId,
  attId,
  filename,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  // Kursor oxirgi marta turgan jadval katagini doimiy eslab boramiz. Toolbar
  // dropdown'iga bosilганда tanlov yo'qolса ham, jadval amallари shu katakни
  // ishlatади.
  const lastCellRef = useRef<HTMLTableCellElement | null>(null);
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

  // Berilган tugundан yuqoriга chиqиб jadval katагини topadi (root ичida).
  const cellFromNode = (node: Node | null): HTMLTableCellElement | null => {
    const root = editorRef.current;
    while (node && node !== root) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName;
        if (tag === 'TD' || tag === 'TH') return node as HTMLTableCellElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  // Joriy tanlovdан kursor qaysи katакда turганини eslab qo'yamiz.
  const trackCell = () => {
    const sel = window.getSelection();
    const node = sel?.anchorNode || null;
    if (!node || !editorRef.current?.contains(node)) return;
    const cell = cellFromNode(node);
    if (cell) lastCellRef.current = cell;
  };

  // Tanlov o'zgарganда ham kursor turган katакни kuzatib boramiz.
  useEffect(() => {
    document.addEventListener('selectionchange', trackCell);
    return () => document.removeEventListener('selectionchange', trackCell);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tanlangan matn diapazonini eslab qolamiz (toolbar bosilganda yo'qolmasин).
  const rememberSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }
    trackCell();
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

  // Blok uslubi (Oddiy matn / Sarlavha 1-3).
  const applyBlock = (tag: string) => {
    if (!tag) return;
    exec('formatBlock', tag);
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

  // Tanlangan matnning joriy pt xajmini (taxminan) o'qiydi.
  const currentPt = (): number => {
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode || null;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const el =
      (node as HTMLElement) || editorRef.current || document.body;
    const px = parseFloat(getComputedStyle(el).fontSize) || 16;
    return Math.round((px * 72) / 96);
  };

  // Shriftни kattalashtirish/kichraytirish (Word A▲/A▼ kabi).
  const stepFontSize = (dir: 1 | -1) => {
    const cur = currentPt();
    let idx = SIZES.findIndex((s) => s >= cur);
    if (idx < 0) idx = SIZES.length - 1;
    if (dir === 1 && SIZES[idx] <= cur) idx += 1;
    const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, idx + (dir === -1 ? -1 : 0)))];
    const target = dir === 1 ? SIZES[Math.min(SIZES.length - 1, idx)] : next;
    setSize(String(target));
    applyFontSize(String(target));
  };

  // Faqat tanlangan matn qismini (formatlarни saqlab) o'zgartiradi — regist.
  const transformSelection = (fn: (s: string) => string) => {
    if (!editable) return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const rootNode =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;
    if (!rootNode) return;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (range.intersectsNode(n)) nodes.push(n as Text);
    }
    nodes.forEach((tn) => {
      const text = tn.nodeValue || '';
      let start = 0;
      let end = text.length;
      if (tn === range.startContainer) start = range.startOffset;
      if (tn === range.endContainer) end = range.endOffset;
      tn.nodeValue =
        text.slice(0, start) + fn(text.slice(start, end)) + text.slice(end);
    });
    editorRef.current?.focus();
    rememberSelection();
  };

  const toUpper = () => transformSelection((s) => s.toLocaleUpperCase());
  const toLower = () => transformSelection((s) => s.toLocaleLowerCase());
  const toCapitalize = () =>
    transformSelection((s) =>
      s.replace(/\S+/g, (w) => w.charAt(0).toLocaleUpperCase() + w.slice(1).toLocaleLowerCase()),
    );

  // Qator intervalini tanlangan bloklarga (paragraflarga) qo'llaymiz.
  const applyLineHeight = (value: string) => {
    if (!editable) return;
    restoreSelection();
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !editor) return;
    const range = sel.getRangeAt(0);
    const blocks = Array.from(
      editor.querySelectorAll('p, div, li, td, h1, h2, h3, h4, h5, h6'),
    ).filter((el) => range.intersectsNode(el));
    if (blocks.length === 0) {
      editor.style.lineHeight = value;
    } else {
      blocks.forEach((el) => {
        (el as HTMLElement).style.lineHeight = value;
      });
    }
    editor.focus();
    rememberSelection();
  };

  // Havola qo'shish / olib tashlash.
  const insertLink = () => {
    rememberSelection();
    const url = window.prompt(t('edo.editor.link_prompt'), 'https://');
    if (!url) return;
    exec('createLink', url);
  };

  // Rasm qo'shish (faylni base64 data-URI qilib ichига joylaymiz).
  const pickImage = () => {
    rememberSelection();
    imageInputRef.current?.click();
  };
  const onImageChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      restoreSelection();
      document.execCommand('insertImage', false, dataUrl);
      // Rasm kengligini cheklaymiz (sahifadan chiqib ketmasin).
      editorRef.current
        ?.querySelectorAll('img:not([data-sized])')
        .forEach((img) => {
          const el = img as HTMLImageElement;
          el.style.maxWidth = '100%';
          el.setAttribute('data-sized', '1');
        });
      editorRef.current?.focus();
      rememberSelection();
    };
    reader.readAsDataURL(file);
  };

  // Jadval katagi uslubi (yangi kataklar uchun).
  const TD_STYLE = 'border:1px solid #888;padding:4px 6px;min-width:2em';

  // Yangi jadval qo'shish (qator × ustun).
  const insertTable = () => {
    rememberSelection();
    const rows = parseInt(window.prompt(t('edo.editor.table_rows'), '3') || '', 10);
    const cols = parseInt(window.prompt(t('edo.editor.table_cols'), '3') || '', 10);
    if (!rows || !cols || rows < 1 || cols < 1) return;
    let html = '<table style="border-collapse:collapse;width:100%" border="1">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += `<td style="${TD_STYLE}">&nbsp;</td>`;
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    exec('insertHTML', html);
  };

  // Kursor turgan jadval katagini topadi (yo'q bo'lsa null).
  const currentCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    return cellFromNode(sel?.anchorNode || null);
  };

  // Jadval amallari: yangi jadval / qator qo'shish / ustun qo'shish /
  // qatorни o'chirish / ustunни o'chirish / jadvalni o'chirish.
  const tableAction = (action: string) => {
    if (!editable || !action) return;
    if (action === 'insert') {
      insertTable();
      return;
    }
    restoreSelection();
    // Avval joriy tanlovдан katakни izlaymiz; topilмаса — oxirgi eslab qolган
    // katакни ishlatamiz (dropdown bosilганда tanlov yo'qolган bo'lishi mumkin).
    let cell = currentCell();
    if (!cell || !editorRef.current?.contains(cell)) {
      const last = lastCellRef.current;
      cell = last && editorRef.current?.contains(last) ? last : null;
    }
    if (!cell) {
      window.alert(t('edo.editor.table_need_cursor'));
      return;
    }
    const row = cell.closest('tr') as HTMLTableRowElement | null;
    const table = cell.closest('table') as HTMLTableElement | null;
    const idx = cell.cellIndex;
    if (!table || !row) return;

    if (action === 'row_add') {
      const nr = row.cloneNode(true) as HTMLTableRowElement;
      Array.from(nr.cells).forEach((c) => {
        c.innerHTML = '&nbsp;';
      });
      row.after(nr);
    } else if (action === 'col_add') {
      Array.from(table.rows).forEach((r) => {
        const ref = r.cells[idx];
        const nc = document.createElement(
          (ref?.tagName || 'TD').toLowerCase(),
        ) as HTMLTableCellElement;
        nc.setAttribute('style', ref?.getAttribute('style') || TD_STYLE);
        nc.innerHTML = '&nbsp;';
        if (ref) ref.after(nc);
        else r.appendChild(nc);
      });
    } else if (action === 'row_del') {
      row.remove();
      if (table.rows.length === 0) table.remove();
    } else if (action === 'col_del') {
      Array.from(table.rows).forEach((r) => {
        if (r.cells[idx]) r.deleteCell(idx);
      });
      if (!table.rows[0] || table.rows[0].cells.length === 0) table.remove();
    } else if (action === 'del') {
      table.remove();
    }
    editorRef.current?.focus();
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
        <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0">
          {/* Uslub (Заголовок) */}
          <select
            defaultValue=""
            onMouseDown={rememberSelection}
            onChange={(e) => {
              applyBlock(e.target.value);
              e.target.value = '';
            }}
            className="h-8 text-sm border border-slate-300 rounded-md px-1.5 bg-white"
            title={t('edo.editor.style')}
          >
            <option value="" disabled>
              {t('edo.editor.style')}
            </option>
            <option value="P">{t('edo.editor.style_normal')}</option>
            <option value="H1">{t('edo.editor.style_h1')}</option>
            <option value="H2">{t('edo.editor.style_h2')}</option>
            <option value="H3">{t('edo.editor.style_h3')}</option>
          </select>

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
          <ToolBtn onMouseDown={keepFocus} onClick={() => stepFontSize(1)} title={t('edo.editor.grow_font')}>
            <AArrowUp size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => stepFontSize(-1)} title={t('edo.editor.shrink_font')}>
            <AArrowDown size={16} />
          </ToolBtn>

          <Divider />

          {/* Uslub belgilar */}
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
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('subscript')} title={t('edo.editor.subscript')}>
            <Subscript size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('superscript')} title={t('edo.editor.superscript')}>
            <Superscript size={16} />
          </ToolBtn>

          {/* Regist (Aa) */}
          <select
            defaultValue=""
            onMouseDown={rememberSelection}
            onChange={(e) => {
              if (e.target.value === 'upper') toUpper();
              else if (e.target.value === 'lower') toLower();
              else if (e.target.value === 'cap') toCapitalize();
              e.target.value = '';
            }}
            className="h-8 text-sm border border-slate-300 rounded-md px-1.5 bg-white"
            title={t('edo.editor.case')}
          >
            <option value="" disabled>
              Aa
            </option>
            <option value="upper">{t('edo.editor.case_upper')}</option>
            <option value="lower">{t('edo.editor.case_lower')}</option>
            <option value="cap">{t('edo.editor.case_capitalize')}</option>
          </select>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('removeFormat')} title={t('edo.editor.clear_format')}>
            <RemoveFormatting size={16} />
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

          {/* Interval */}
          <select
            defaultValue=""
            onMouseDown={rememberSelection}
            onChange={(e) => {
              applyLineHeight(e.target.value);
              e.target.value = '';
            }}
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

          {/* Chekinish (otstup) */}
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('outdent')} title={t('edo.editor.indent_decrease')}>
            <IndentDecrease size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('indent')} title={t('edo.editor.indent_increase')}>
            <IndentIncrease size={16} />
          </ToolBtn>

          <Divider />

          {/* Ro'yxat */}
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('insertUnorderedList')} title={t('edo.editor.bullet_list')}>
            <List size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('insertOrderedList')} title={t('edo.editor.number_list')}>
            <ListOrdered size={16} />
          </ToolBtn>

          <Divider />

          {/* Qo'shish: havola / rasm / jadval */}
          <ToolBtn onMouseDown={keepFocus} onClick={insertLink} title={t('edo.editor.link')}>
            <LinkIcon size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('unlink')} title={t('edo.editor.unlink')}>
            <Unlink size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={pickImage} title={t('edo.editor.image')}>
            <ImageIcon size={16} />
          </ToolBtn>
          {/* Jadval menyusi (qo'shish / qator-ustun / o'chirish) */}
          <span className="inline-flex items-center gap-1" title={t('edo.editor.table_menu')}>
            <TableIcon size={16} className="text-slate-600" />
            <select
              defaultValue=""
              onMouseDown={rememberSelection}
              onChange={(e) => {
                tableAction(e.target.value);
                e.target.value = '';
              }}
              className="h-8 text-sm border border-slate-300 rounded-md px-1.5 bg-white"
            >
              <option value="" disabled>
                {t('edo.editor.table_menu')}
              </option>
              <option value="insert">{t('edo.editor.table_insert')}</option>
              <option value="row_add">{t('edo.editor.table_row_add')}</option>
              <option value="col_add">{t('edo.editor.table_col_add')}</option>
              <option value="row_del">{t('edo.editor.table_row_del')}</option>
              <option value="col_del">{t('edo.editor.table_col_del')}</option>
              <option value="del">{t('edo.editor.table_del')}</option>
            </select>
          </span>

          <Divider />

          {/* Bekor / Qaytarish */}
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('undo')} title={t('edo.editor.undo')}>
            <Undo2 size={16} />
          </ToolBtn>
          <ToolBtn onMouseDown={keepFocus} onClick={() => exec('redo')} title={t('edo.editor.redo')}>
            <Redo2 size={16} />
          </ToolBtn>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onImageChosen}
          />
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

      {/* Sahifа ichидаги rasm sahифадан kengроq bo'lса kichraytiramiz. Jadval
          uslубларига tegmaymiz — asl fayldагидек ko'rinsин. */}
      <style>{`
        .wordedit-page img { max-width: 100%; height: auto; }
      `}</style>

      {/* Tahrirlash maydoni */}
      <div className="relative flex-1 bg-slate-200 overflow-auto p-6">
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
            width: 'fit-content',
            minWidth: '210mm',
            minHeight: '297mm',
            padding: '25mm 20mm',
            boxSizing: 'border-box',
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
