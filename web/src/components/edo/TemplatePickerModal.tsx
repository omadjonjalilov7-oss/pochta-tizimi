import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoTemplate } from '../../lib/types';

export function TemplatePickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (body: string, templateId: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

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

  // Blankani to'g'ridan-to'g'ri qo'yamiz — {{xujjat_n}}, {{sana_soat}} kabi
  // o'zgaruvchilar hujjat ochilganda avtomat to'ladi, qo'lda to'ldirish oynasi yo'q.
  const handleSelect = (tpl: EdoTemplate) => {
    onPick(tpl.bodyTemplate, tpl.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('edo.template_picker.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

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
                    {['internal', 'incoming', 'outgoing'].includes(category)
                      ? t(`edo.doc_type.${category}`)
                      : category}
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
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
