import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, FileText, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { cn, cyrName } from '../../lib/utils';

// Bir "metric" (masalan: draft, done, overdue...) yoki jurnal bo'yicha hujjatlar
// ro'yxati. Dashboard/jurnal/kalendar/hisobotdagi RAQAM ustiga bosilganda ochiladi.
export interface StatDocRow {
  id: string;
  number: string;
  docUid?: string | null;
  subject: string;
  status: string;
  type?: string;
  createdAt?: string;
  createdBy?: { fullName: string } | null;
}

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  in_review: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-sky-100 text-sky-700',
  podpisana: 'bg-indigo-100 text-indigo-700',
  done: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  overdue: 'bg-rose-100 text-rose-700',
};

export function StatDocListModal({
  open,
  onClose,
  title,
  metric,
  from,
  to,
  journalId,
  journalKind,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  // Server rejimi:
  metric?: string | null;
  from?: string;
  to?: string;
  journalId?: string;
  journalKind?: string;
  // Lokal rejim (kalendar kabi — ma'lumot allaqachon yuklangan):
  rows?: StatDocRow[];
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';

  const isLocal = Array.isArray(rows);

  const params = new URLSearchParams();
  if (metric) params.set('metric', metric);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (journalId) params.set('journalId', journalId);
  if (journalKind) params.set('journalKind', journalKind);

  const { data: fetched = [], isLoading } = useQuery({
    queryKey: ['stat-doc-list', metric, from, to, journalId, journalKind],
    queryFn: async () =>
      (await api.get<StatDocRow[]>(`/stats/documents?${params.toString()}`)).data,
    enabled: open && !isLocal,
  });

  if (!open) return null;

  const data = isLocal ? (rows as StatDocRow[]) : fetched;
  const loading = !isLocal && isLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sarlavha */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? t('common.loading') : `${data.length} ${t('edo.stats.docs_count')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ro'yxat */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              {t('common.loading')}
            </div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center">
              <FileText size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">{t('edo.stats.empty')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/edo/documents/${d.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {d.subject}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {d.docUid || d.number}
                        </span>
                        {d.createdBy?.fullName && (
                          <span className="truncate">{cyrName(d.createdBy.fullName)}</span>
                        )}
                        {d.createdAt && (
                          <span>{new Date(d.createdAt).toLocaleDateString(lang)}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
                        STATUS_CLS[d.status] || 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {t(`edo.status.${d.status}`)}
                    </span>
                    <ExternalLink
                      size={15}
                      className="text-slate-300 group-hover:text-asaka-500 shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
