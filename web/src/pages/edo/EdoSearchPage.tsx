import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Clock, ChevronRight, Search } from 'lucide-react';
import { api } from '../../lib/api';
import type { DocumentStatus, EdoDocument } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { cn } from '../../lib/utils';

function StatusPill({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation();
  const cls: Record<DocumentStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    in_review: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-sky-100 text-sky-800',
    done: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-700',
    overdue: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded', cls[status])}>
      {t(`edo.status.${status}`)}
    </span>
  );
}

export function EdoSearchPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  const { data: docs = [], isFetching } = useQuery({
    queryKey: ['edo-search', query],
    queryFn: async () =>
      (await api.get<EdoDocument[]>(`/documents/search?q=${encodeURIComponent(query)}`)).data,
    enabled: query.trim().length > 0,
  });

  return (
    <div className="w-full px-6 py-6">
      <h1 className="text-xl font-semibold text-slate-900 mb-4">{t('edo.search.title')}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input);
        }}
        className="flex items-center gap-2 mb-6"
      >
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('edo.search.placeholder')}
            className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-asaka-500 focus:border-asaka-500"
          />
        </div>
        <button
          type="submit"
          className="bg-asaka-600 hover:bg-asaka-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
        >
          {t('edo.search.button')}
        </button>
      </form>

      {query.trim().length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Search size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">{t('edo.search.hint')}</p>
        </div>
      ) : isFetching ? (
        <div className="text-slate-400 p-6">{t('common.loading')}</div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <FileText size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">{t('edo.search.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                to={`/edo/documents/${d.id}`}
                className="flex items-start gap-3 bg-white border border-slate-200 hover:border-asaka-300 hover:shadow-sm rounded-xl px-4 py-3 transition"
              >
                <div className="bg-asaka-50 text-asaka-600 rounded-lg p-2 mt-0.5">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {d.number}
                    </span>
                    {d.docUid && (
                      <span className="font-mono text-xs bg-asaka-50 text-asaka-700 px-1.5 py-0.5 rounded">
                        {d.docUid}
                      </span>
                    )}
                    <StatusPill status={d.status} />
                    <span className="text-xs text-slate-400">{t(`edo.doc_type.${d.type}`)}</span>
                  </div>
                  <div className="font-medium text-slate-900 truncate">{d.subject}</div>
                  {d.shortInfo && (
                    <div className="text-sm text-slate-500 truncate">{d.shortInfo}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Avatar fullName={d.createdBy.fullName} avatarPath={d.createdBy.avatarPath} size="sm" />
                      <span>{d.createdBy.fullName}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(d.updatedAt).toLocaleString(lang)}
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 mt-2 flex-shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
