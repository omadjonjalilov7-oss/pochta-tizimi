import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Clock, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import type { DocumentStatus, EdoDocument } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { cn } from '../../lib/utils';

interface DocListProps {
  queryKey: string;
  endpoint: string;
  titleKey: string;
  emptyKey: string;
  showHolder?: boolean;
}

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

function DocList({ queryKey, endpoint, titleKey, emptyKey, showHolder }: DocListProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const { data: docs = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await api.get<EdoDocument[]>(endpoint)).data,
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <h1 className="text-xl font-semibold text-slate-900 mb-4">{t(titleKey)}</h1>

      {isLoading ? (
        <div className="text-slate-400 p-6">{t('common.loading')}</div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <FileText size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">{t(emptyKey)}</p>
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
                    {d.deadline && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium',
                          isDeadlinePast(d.deadline, d.status)
                            ? 'text-red-600'
                            : isDeadlineSoon(d.deadline)
                              ? 'text-amber-600'
                              : 'text-slate-500',
                        )}
                        title={t('edo.view.deadline')}
                      >
                        ⏰ {new Date(d.deadline).toLocaleDateString(lang)}
                      </span>
                    )}
                    {showHolder && d.currentHolder && d.status === 'in_review' && (
                      <span className="text-asaka-700">
                        → {d.currentHolder.fullName}
                      </span>
                    )}
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

function isDeadlinePast(iso: string, status: DocumentStatus): boolean {
  return new Date(iso).getTime() < Date.now() && status !== 'done';
}

function isDeadlineSoon(iso: string): boolean {
  const ms = new Date(iso).getTime() - Date.now();
  return ms >= 0 && ms < 24 * 60 * 60 * 1000;
}

export function EdoMyDocsPage() {
  return (
    <DocList
      queryKey="edo-mine"
      endpoint="/documents/mine"
      titleKey="edo.nav.my_documents"
      emptyKey="edo.list.empty_mine"
      showHolder
    />
  );
}

export function EdoDraftsPage() {
  return (
    <DocList
      queryKey="edo-drafts"
      endpoint="/documents/drafts"
      titleKey="edo.nav.drafts"
      emptyKey="edo.list.empty_drafts"
    />
  );
}

export function EdoTasksPage() {
  return (
    <>
      <DocList
        queryKey="edo-tasks"
        endpoint="/documents/tasks"
        titleKey="edo.nav.tasks_approval"
        emptyKey="edo.list.empty_tasks"
      />
      <DocList
        queryKey="edo-executions"
        endpoint="/documents/executions"
        titleKey="edo.nav.tasks_execution"
        emptyKey="edo.list.empty_executions"
      />
    </>
  );
}

export function EdoIncomingPage() {
  return (
    <DocList
      queryKey="edo-incoming"
      endpoint="/documents/incoming"
      titleKey="edo.nav.incoming"
      emptyKey="edo.list.empty_incoming"
      showHolder
    />
  );
}

export function EdoOutgoingPage() {
  return (
    <DocList
      queryKey="edo-outgoing"
      endpoint="/documents/outgoing"
      titleKey="edo.nav.outgoing"
      emptyKey="edo.list.empty_outgoing"
      showHolder
    />
  );
}

export function EdoArchivePage() {
  return (
    <DocList
      queryKey="edo-archive"
      endpoint="/documents/archive"
      titleKey="edo.nav.archive"
      emptyKey="edo.list.empty_archive"
    />
  );
}

export function EdoToSignPage() {
  return (
    <DocList
      queryKey="edo-to-sign"
      endpoint="/documents/to-sign"
      titleKey="edo.nav.to_sign"
      emptyKey="edo.list.empty_to_sign"
    />
  );
}

export function EdoControlPage() {
  return (
    <DocList
      queryKey="edo-control"
      endpoint="/documents/control"
      titleKey="edo.nav.control"
      emptyKey="edo.list.empty_control"
      showHolder
    />
  );
}

export function EdoDepartmentPage() {
  return (
    <DocList
      queryKey="edo-department"
      endpoint="/documents/department"
      titleKey="edo.nav.department"
      emptyKey="edo.list.empty_department"
      showHolder
    />
  );
}
