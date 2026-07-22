import { useEffect, useRef } from 'react';
import { Bold, Italic, List } from 'lucide-react';

// Hujjat matni uchun HTML muharrir — Word'dan kelgan jadval/formatlashni saqlaydi.
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

  // Tashqaridan value o'zgarsa (shablon qo'llanganda) — muharrirni yangilaymiz.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value || '';
  }, [value]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const exec = (cmd: string) => {
    if (disabled) return;
    document.execCommand(cmd, false);
    ref.current?.focus();
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

  return (
    <div className="rounded-xl border border-slate-300 focus-within:border-asaka-500 focus-within:ring-2 focus-within:ring-asaka-100 overflow-hidden">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
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
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        className="edo-doc-body prose prose-sm max-w-none min-h-[180px] max-h-[520px] overflow-auto px-4 py-3 text-slate-800 outline-none"
      />
    </div>
  );
}
