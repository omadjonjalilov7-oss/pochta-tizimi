import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bold, Italic, Baseline } from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoTemplate } from '../../lib/types';

// Shablon tanlanganda hujjatning to'liq ko'rinishi ochiladi, lekin faqat ikkita
// o'zgaruvchi tahrirlanadi:
//   {{mavzu}}        → hujjat mavzusi (subject)
//   {{xujjat_matni}} → hujjat asosiy matni (body, {{matn}} ham qo'llab-quvvatlanadi)
// Qolgan blanka qismi qulflangan (o'zgartirib bo'lmaydi).
function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SIZE_OPTIONS = [
  { label: 'Kichik', value: '2' },
  { label: "O'rta", value: '3' },
  { label: 'Katta', value: '5' },
];

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
  const lastValidMatn = useRef<string>(body || '');
  const [count, setCount] = useState(0);

  const { data: templates = [] } = useQuery({
    queryKey: ['edo-templates'],
    queryFn: async () => (await api.get<EdoTemplate[]>('/templates')).data,
  });
  const tpl = templates.find((x) => x.id === templateId);

  // Shablon HTML tayyor bo'lganda — bir marta joylashtiramiz (matn/subject
  // o'zgarganda qayta joylamasdan, kursor sakramasligi uchun).
  useEffect(() => {
    const el = ref.current;
    if (!el || !tpl) return;
    const editable = disabled ? 'false' : 'true';
    let html = tpl.bodyTemplate
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
        `<div data-fill="matn" contenteditable="${editable}" class="tpl-fill">${body || ''}</div>`,
      );
    el.innerHTML = html;
    lastValidMatn.current = body || '';
    const matnEl = el.querySelector('[data-fill="matn"]') as HTMLElement | null;
    setCount(matnEl?.textContent?.length ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl?.id, disabled]);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    const mavzuEl = el.querySelector('[data-fill="mavzu"]') as HTMLElement | null;
    const matnEl = el.querySelector('[data-fill="matn"]') as HTMLElement | null;
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
      onBody(matnEl.innerHTML);
    }
  };

  const exec = (cmd: string, val?: string) => {
    if (disabled) return;
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, val);
    sync();
  };

  if (!tpl) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
        Shablon yuklanmoqda…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-300 overflow-hidden">
      {!disabled && (
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
          <span className="w-px h-5 bg-slate-200 mx-1" />
          {SIZE_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec('fontSize', s.value)}
              className="px-2 py-1 rounded hover:bg-slate-200 text-slate-600 text-xs font-medium"
            >
              {s.label}
            </button>
          ))}
          <label
            className="relative inline-flex items-center p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
            title="Matn rangi"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Baseline size={15} />
            <input
              type="color"
              defaultValue="#0f172a"
              onChange={(e) => exec('foreColor', e.target.value)}
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
          className="tpl-sheet bg-white mx-auto shadow-sm text-slate-900"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '18mm 16mm',
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
