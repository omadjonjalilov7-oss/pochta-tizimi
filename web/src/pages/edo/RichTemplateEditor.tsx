import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces } from 'lucide-react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Plugin,
  ButtonView,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Code,
  CodeBlock,
  RemoveFormat,
  Alignment,
  List,
  ListProperties,
  TodoList,
  Indent,
  IndentBlock,
  Link,
  LinkImage,
  Bookmark,
  BlockQuote,
  HorizontalLine,
  PageBreak,
  Highlight,
  SpecialCharacters,
  SpecialCharactersEssentials,
  FindAndReplace,
  ShowBlocks,
  SourceEditing,
  Autoformat,
  PasteFromOffice,
  FontColor,
  FontBackgroundColor,
  FontSize,
  FontFamily,
  Image,
  ImageBlock,
  ImageInline,
  ImageInsert,
  ImageInsertViaUrl,
  ImageUpload,
  ImageResize,
  ImageStyle,
  ImageCaption,
  ImageToolbar,
  ImageTextAlternative,
  AutoImage,
  Base64UploadAdapter,
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
// To'liq matn muharriri: jadval (sudrab kengaytirish, birlashtirish, qator/
// ustun), rasm (o'lchamli), sahifa uzilishi, maxsus belgilar, marker, qidirish/
// almashtirish, HTML manba va h.k. Chiqishi HTML — shablon → hujjat tizimiga
// to'g'ridan-to'g'ri tushadi. Alohida faylda, lazy() bilan yuklanadi.

// --- Katak matnini aylantirish (CSS class'lar orqali; GHS'ning public API'si) ---
const ROT90 = 'edo-rot-90';
const ROT180 = 'edo-rot-180';
const LS_CLASSES = ['edo-ls-1', 'edo-ls-2', 'edo-ls-3'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = any;

// Belgilangan (yoki kursor turgan) jadval kataklarini qaytaradi.
function cellsFromSelection(model: AnyModel): AnyModel[] {
  const sel = model.document.selection;
  const cells = new Set<AnyModel>();
  for (const range of sel.getRanges()) {
    let cur: AnyModel = range.start.nodeAfter || range.start.parent;
    while (cur) {
      if (cur.is && cur.is('element', 'tableCell')) {
        cells.add(cur);
        break;
      }
      cur = cur.parent;
    }
  }
  return Array.from(cells);
}

// Katakdagi joriy CSS class'lar to'plami (GHS qaysi kalitda saqlashidan qat'i nazar).
function cellClasses(cell: AnyModel): Set<string> {
  for (const key of cell.getAttributeKeys()) {
    if (/^html.*Attributes$/i.test(key)) {
      const v = cell.getAttribute(key);
      if (v && Array.isArray(v.classes)) return new Set<string>(v.classes);
    }
  }
  return new Set<string>();
}

// Katak matnini aylantirish va harflar oralig'i tugmalarini qo'shadigan plagin.
class CellDecorations extends Plugin {
  static get requires() {
    return [GeneralHtmlSupport];
  }

  init(): void {
    const editor = this.editor;
    const model = editor.model;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ghs: any = editor.plugins.get('GeneralHtmlSupport');

    const safe = (fn: () => void) => {
      try {
        fn();
      } catch {
        /* e'tibor bermaymiz */
      }
    };
    const addCls = (cell: AnyModel, c: string) => {
      safe(() => ghs.addModelHtmlClass('td', c, cell));
      safe(() => ghs.addModelHtmlClass('th', c, cell));
    };
    const remCls = (cell: AnyModel, c: string) => {
      safe(() => ghs.removeModelHtmlClass('td', c, cell));
      safe(() => ghs.removeModelHtmlClass('th', c, cell));
    };

    const addButton = (name: string, label: string, run: (cells: AnyModel[]) => void) => {
      editor.ui.componentFactory.add(name, (locale) => {
        const btn = new ButtonView(locale);
        btn.set({ label, withText: true, tooltip: true });
        btn.on('execute', () => {
          const cells = cellsFromSelection(model);
          if (cells.length) run(cells);
          editor.editing.view.focus();
        });
        return btn;
      });
    };

    // 90° — vertikal (masalan "Согласовано"). 180° oldingi holatini olib tashlaydi.
    addButton('edoRot90', '⟲ 90°', (cells) => {
      for (const cell of cells) {
        remCls(cell, ROT180);
        addCls(cell, ROT90);
      }
    });
    // 180° — teskari (ustma-ust). 90° oldingi holatini olib tashlaydi.
    addButton('edoRot180', '180°', (cells) => {
      for (const cell of cells) {
        remCls(cell, ROT90);
        addCls(cell, ROT180);
      }
    });
    // Tekis — aylantirishni va oraliqni bekor qiladi.
    addButton('edoRotReset', '⭯ Tekis', (cells) => {
      for (const cell of cells) {
        remCls(cell, ROT90);
        remCls(cell, ROT180);
        for (const ls of LS_CLASSES) remCls(cell, ls);
      }
    });
    // Harf oralig'i — 0→1→2→3→0 aylanadi (90° aylantirilgach harflar yopishmasin).
    addButton('edoLetterSpacing', 'A↔A oraliq', (cells) => {
      const cur = cellClasses(cells[0]);
      let level = 0;
      for (let i = 0; i < LS_CLASSES.length; i++) if (cur.has(LS_CLASSES[i])) level = i + 1;
      const next = (level + 1) % (LS_CLASSES.length + 1);
      for (const cell of cells) {
        for (const ls of LS_CLASSES) remCls(cell, ls);
        if (next > 0) addCls(cell, LS_CLASSES[next - 1]);
      }
    });
  }
}

const CK_PLUGINS = [
  Essentials, Paragraph, Heading, Autoformat, PasteFromOffice,
  Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code, CodeBlock,
  RemoveFormat, Alignment,
  List, ListProperties, TodoList, Indent, IndentBlock,
  Link, LinkImage, Bookmark, BlockQuote, HorizontalLine, PageBreak,
  Highlight, SpecialCharacters, SpecialCharactersEssentials, FindAndReplace,
  ShowBlocks, SourceEditing,
  FontColor, FontBackgroundColor, FontSize, FontFamily,
  Image, ImageBlock, ImageInline, ImageInsert, ImageInsertViaUrl, ImageUpload,
  ImageResize, ImageStyle, ImageCaption, ImageToolbar, ImageTextAlternative,
  AutoImage, Base64UploadAdapter,
  Table, TableToolbar, TableColumnResize, TableProperties, TableCellProperties,
  TableCaption, GeneralHtmlSupport,
  CellDecorations,
];

const CK_CONFIG: EditorConfig = {
  licenseKey: 'GPL',
  plugins: CK_PLUGINS,
  toolbar: {
    items: [
      'undo', 'redo', '|',
      'sourceEditing', 'showBlocks', 'findAndReplace', '|',
      'heading', '|',
      'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', 'highlight', '|',
      'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'code', 'removeFormat', '|',
      'alignment', '|',
      'bulletedList', 'numberedList', 'todoList', 'outdent', 'indent', '|',
      'insertTable', 'insertImage', 'pageBreak', 'horizontalLine', 'specialCharacters', 'link', 'bookmark', 'blockQuote', 'codeBlock',
    ],
    shouldNotGroupWhenFull: false,
  },
  table: {
    contentToolbar: [
      'tableColumn', 'tableRow', 'mergeTableCells', '|',
      'edoRot90', 'edoRot180', 'edoRotReset', 'edoLetterSpacing', '|',
      'tableProperties', 'tableCellProperties',
    ],
  },
  image: {
    insert: { type: 'auto' },
    toolbar: [
      'imageStyle:inline', 'imageStyle:alignLeft', 'imageStyle:alignCenter', 'imageStyle:alignRight', '|',
      'toggleImageCaption', 'imageTextAlternative', '|', 'resizeImage',
    ],
  },
  list: { properties: { styles: true, startIndex: true, reversed: true } },
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
            "Ustun chegarasini sudrab kengaytiring. Jadval ustiga bosib chiqadigan menyudan qator/ustun qo'shing, kataklarni birlashtiring yoki matnni aylantiring."}
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
