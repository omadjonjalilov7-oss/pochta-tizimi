import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces } from 'lucide-react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Alignment,
  List,
  Indent,
  IndentBlock,
  Link,
  BlockQuote,
  HorizontalLine,
  RemoveFormat,
  Autoformat,
  PasteFromOffice,
  FontColor,
  FontBackgroundColor,
  FontSize,
  FontFamily,
  Table,
  TableToolbar,
  TableColumnResize,
  TableProperties,
  TableCellProperties,
  TableCaption,
  GeneralHtmlSupport,
} from 'ckeditor5';
import type { EditorConfig } from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';

// ---- CKEditor (Word'ga o'xshash) shablon muharriri ----
// Ustunlarni sichqoncha bilan sudrab kengaytirish, kataklarni birlashtirish/
// ajratish, qator/ustun qo'shish-o'chirish — hammasi tayyor. Chiqishi HTML,
// shuning uchun mavjud shablon → hujjat tizimiga to'g'ridan-to'g'ri tushadi.
// Alohida faylda — lazy() bilan yuklanadi, asosiy bundle yengil qoladi.
const CK_PLUGINS = [
  Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough,
  Subscript, Superscript, Alignment, List, Indent, IndentBlock, Link,
  BlockQuote, HorizontalLine, RemoveFormat, Autoformat, PasteFromOffice,
  FontColor, FontBackgroundColor, FontSize, FontFamily,
  Table, TableToolbar, TableColumnResize, TableProperties, TableCellProperties,
  TableCaption, GeneralHtmlSupport,
];

const CK_CONFIG: EditorConfig = {
  licenseKey: 'GPL',
  plugins: CK_PLUGINS,
  toolbar: {
    items: [
      'undo', 'redo', '|',
      'heading', '|',
      'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|',
      'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', '|',
      'alignment', '|',
      'bulletedList', 'numberedList', 'outdent', 'indent', '|',
      'insertTable', 'horizontalLine', 'link', 'blockQuote', '|',
      'removeFormat',
    ],
    shouldNotGroupWhenFull: true,
  },
  table: {
    contentToolbar: [
      'tableColumn', 'tableRow', 'mergeTableCells',
      'tableProperties', 'tableCellProperties',
    ],
  },
  fontFamily: { supportAllValues: true },
  fontSize: { options: [9, 10, 11, 12, 'default', 14, 16, 18, 24], supportAllValues: true },
  // Word'dan import qilingan HTML (uslublar, class'lar, colgroup kengliklari)
  // muharrirda buzilmasin — hamma narsaga ruxsat beramiz (server tomonda
  // sanitize baribir XSS'dan tozalaydi).
  htmlSupport: {
    allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
  },
};

export default function RichTemplateEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const { t } = useTranslation();
  const editorRef = useRef<ClassicEditor | null>(null);

  // Kursor turgan joyga {{joy}} almashtiruvchini qo'yadi.
  const insertPlaceholder = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const raw = window.prompt(t('edo.templates.placeholder_prompt') ?? '');
    if (!raw) return;
    const key = raw
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^([0-9])/, '_$1');
    if (!key) return;
    editor.model.change((writer) => {
      editor.model.insertContent(
        writer.createText(`{{${key}}}`),
        editor.model.document.selection,
      );
    });
    editor.editing.view.focus();
  };

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0 focus-within:border-asaka-500 focus-within:ring-2 focus-within:ring-asaka-100">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1.5 shrink-0">
        <button
          type="button"
          onClick={insertPlaceholder}
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded shrink-0"
        >
          <Braces size={14} />
          {t('edo.templates.insert_placeholder')}
        </button>
        <span className="text-[11px] text-slate-500 leading-tight">
          {t('edo.templates.ck_hint') ??
            "Ustun chegarasini sudrab kengaytiring. Jadval ustiga bosib chiqadigan menyudan qator/ustun qo'shing yoki kataklarni birlashtiring."}
        </span>
      </div>
      {/* WYSIWYG muharrir — jadval, shrift va joylashuv hujjatga o'tadi. */}
      <div className="flex-1 min-h-0 overflow-auto bg-slate-200 p-4 edo-tpl-ck">
        <CKEditor
          editor={ClassicEditor}
          config={CK_CONFIG}
          data={value || ''}
          onReady={(editor) => {
            editorRef.current = editor;
          }}
          onChange={(_evt, editor) => onChange(editor.getData())}
        />
      </div>
    </div>
  );
}
