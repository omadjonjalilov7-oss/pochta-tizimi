import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Search, X, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoTemplate } from '../../lib/types';
import { cn } from '../../lib/utils';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Joylarni to'ldirib, HTML shablonni qaytaradi (ko'rinish uchun)
function applyTemplate(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER_RE, (_m, key) => escapeHtml(values[key] ?? ''));
}

export function TemplatePickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (body: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EdoTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['edo-templates'],
    queryFn: async () => (await api.get<EdoTemplate[]>('/templates')).data,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(q) ||
        tpl.category.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const grouped = useMemo(() => {
    const m = new Map<string, EdoTemplate[]>();
    for (const tpl of filtered) {
      const key = tpl.category || '—';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(tpl);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleSelect = (tpl: EdoTemplate) => {
    setSelected(tpl);
    const init: Record<string, string> = {};
    tpl.placeholders.forEach((p) => (init[p] = ''));
    setValues(init);
  };

  const handleApply = () => {
    if (!selected) return;
    onPick(applyTemplate(selected.bodyTemplate, values));
    onClose();
  };

  const preview = selected ? applyTemplate(selected.bodyTemplate, values) : '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col',
          selected ? 'max-w-5xl' : 'max-w-3xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {selected && (
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-900">
              {selected ? selected.name : t('edo.template_picker.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {!selected ? (
          <>
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('edo.template_picker.search_ph')}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {isLoading ? (
                <div className="text-slate-400">{t('common.loading')}</div>
              ) : grouped.length === 0 ? (
                <div className="text-center text-slate-500 py-10">
                  <FileText size={28} className="mx-auto text-slate-300 mb-2" />
                  <div className="text-sm">{t('edo.templates.empty')}</div>
                </div>
              ) : (
                <div className="space-y-5">
                  {grouped.map(([category, items]) => (
                    <div key={category}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        {category}
                      </div>
                      <div className="space-y-1.5">
                        {items.map((tpl) => (
                          <button
                            key={tpl.id}
                            onClick={() => handleSelect(tpl)}
                            className="w-full text-left bg-white border border-slate-200 hover:border-asaka-300 hover:bg-asaka-50/50 rounded-lg px-3 py-2.5 transition flex items-start gap-3"
                          >
                            <FileText size={16} className="text-asaka-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-slate-900 truncate">
                                {tpl.name}
                              </div>
                              {tpl.placeholders.length > 0 && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {t('edo.templates.placeholder_count', { count: tpl.placeholders.length })}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="overflow-hidden flex-1 grid md:grid-cols-2 gap-0 md:divide-x divide-slate-200">
              {/* Chap: maydonlarni to'ldirish */}
              <div className="overflow-y-auto p-5 space-y-2.5">
                {selected.placeholders.length > 0 ? (
                  <>
                    <div className="text-sm font-medium text-slate-700 mb-1">
                      {t('edo.template_picker.fill_fields')}
                    </div>
                    {selected.placeholders.map((p) => (
                      <div key={p}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          <code className="font-mono text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{`{{${p}}}`}</code>
                        </label>
                        <input
                          type="text"
                          value={values[p] || ''}
                          onChange={(e) => setValues({ ...values, [p]: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
                        />
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-sm text-slate-500">
                    {t('edo.template_picker.no_fields')}
                  </div>
                )}
              </div>
              {/* O'ng: jonli ko'rinish — ma'lumot kiritilganda hujjat shakllanib boradi */}
              <div className="overflow-y-auto p-5 bg-slate-50/60">
                <div className="text-sm font-medium text-slate-700 mb-2">
                  {t('edo.template_picker.preview')}
                </div>
                <div
                  className="edo-doc-body prose prose-sm max-w-none text-sm bg-white border border-slate-200 rounded-lg px-3 py-3 text-slate-800"
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  {t('edo.template_picker.plain_note')}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                {t('common.back')}
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 text-sm rounded-lg bg-asaka-600 hover:bg-asaka-700 text-white font-medium"
              >
                {t('edo.template_picker.apply')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
