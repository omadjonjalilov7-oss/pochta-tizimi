import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Clock, ChevronRight, Trash2, Loader2, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { DocumentStatus, EdoDocument } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { cn, cyrName } from '../../lib/utils';

export interface DocListProps {
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

export function DocList({ queryKey, endpoint, titleKey, emptyKey, showHolder }: DocListProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const { data: docs = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await api.get<EdoDocument[]>(endpoint)).data,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) =>
      (await api.post('/documents/bulk-delete', { ids })).data,
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  const onDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(t('edo.list.delete_confirm', { count: ids.length }))) return;
    bulkDelete.mutate(ids);
  };

  // Qoralamani (yaratuvchi o'zi) o'chirish — bittalab.
  const deleteDraft = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/documents/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });
  const onDeleteDraft = (id: string) => {
    if (!window.confirm(t('edo.list.delete_confirm', { count: 1 }))) return;
    deleteDraft.mutate(id);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-6 py-4 md:py-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-lg md:text-xl font-semibold text-slate-900">{t(titleKey)}</h1>
        {isAdmin && selected.size > 0 && (
          <button
            onClick={onDelete}
            disabled={bulkDelete.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition"
          >
            {bulkDelete.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            {t('edo.list.delete_selected', { count: selected.size })}
          </button>
        )}
      </div>

      {docs.some((d) => d.deadline && d.status !== 'done') && (
        <div className="mb-3">
          <ControlLegend />
        </div>
      )}

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
            <li key={d.id} className="flex items-start gap-2">
              {isAdmin && (
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                  className="mt-4 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  title={t('edo.list.select_for_delete')}
                />
              )}
              <Link
                to={`/edo/documents/${d.id}`}
                className={cn(
                  'flex-1 min-w-0 flex items-start gap-2.5 bg-white border border-slate-200 hover:border-asaka-300 hover:shadow-sm rounded-xl px-3 py-2.5 md:px-4 md:py-3 transition',
                  ageAccentClass(d.createdAt, d.status),
                  isAdmin && selected.has(d.id) && 'ring-2 ring-red-400 border-red-300',
                )}
              >
                <div className="bg-asaka-50 text-asaka-600 rounded-lg p-1.5 md:p-2 mt-0.5 shrink-0">
                  <FileText size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <TrafficDot traffic={deadlineTraffic(d.deadline, d.status)} />
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {d.number}
                    </span>
                    {d.docUid && (
                      <span className="font-mono text-[11px] bg-asaka-50 text-asaka-700 px-1.5 py-0.5 rounded">
                        {d.docUid}
                      </span>
                    )}
                    <StatusPill status={d.status} />
                    <span className="text-[11px] text-slate-400">{t(`edo.doc_type.${d.type}`)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 truncate">{d.subject}</div>
                  {d.shortInfo && (
                    <div className="text-xs text-slate-500 truncate">{d.shortInfo}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 min-w-0">
                      <Avatar fullName={d.createdBy.fullName} avatarPath={d.createdBy.avatarPath} size="sm" />
                      <span className="truncate">{cyrName(d.createdBy.fullName)}</span>
                    </span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Clock size={11} className="shrink-0" />
                      {new Date(d.updatedAt).toLocaleString(lang)}
                    </span>
                    {d.deadline && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-medium whitespace-nowrap',
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
                      <span className="text-asaka-700 truncate min-w-0">
                        → {cyrName(d.currentHolder.fullName)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 mt-1 flex-shrink-0" />
              </Link>
              {/* Qoralama uchun — tahrirlash / o'chirish (faqat yaratuvchi ko'radi) */}
              {d.status === 'draft' && (
                <div className="flex flex-col gap-1 mt-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/edo/compose?id=${d.id}`)}
                    title={t('common.edit')}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-asaka-700 hover:bg-asaka-50 border border-slate-200"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(d.id)}
                    disabled={deleteDraft.isPending}
                    title={t('common.delete')}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Hujjat ochiqligi (yakunlanmagan) davomida yoshiga qarab rang:
// 1 kun — yashil, 2 kun — sariq, 3+ kun — qizil.
function ageAccentClass(createdAt: string, status: DocumentStatus): string {
  if (status === 'done' || status === 'rejected') return 'border-l-4 border-l-transparent';
  const days = (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000);
  if (days >= 2) return 'border-l-4 border-l-red-500';
  if (days >= 1) return 'border-l-4 border-l-amber-400';
  return 'border-l-4 border-l-emerald-500';
}

function isDeadlinePast(iso: string, status: DocumentStatus): boolean {
  return new Date(iso).getTime() < Date.now() && status !== 'done';
}

function isDeadlineSoon(iso: string): boolean {
  const ms = new Date(iso).getTime() - Date.now();
  return ms >= 0 && ms < 24 * 60 * 60 * 1000;
}

// Svetofor nazorati (PF-6118): muddatga qarab yagona nazorat holati.
//  green  — muddat yetarli (48 soatdan ko'p)
//  yellow — muddat yaqin (48 soat ichida)
//  red    — muddat o'tgan (va hujjat bajarilmagan)
//  done   — nazoratdan chiqqan (bajarilgan)
type Traffic = 'green' | 'yellow' | 'red' | 'done' | null;
function deadlineTraffic(
  deadline: string | null | undefined,
  status: DocumentStatus,
): Traffic {
  if (status === 'done') return 'done';
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return 'red';
  if (ms < 48 * 60 * 60 * 1000) return 'yellow';
  return 'green';
}

function TrafficDot({ traffic }: { traffic: Traffic }) {
  const { t } = useTranslation();
  if (!traffic) return null;
  const cfg: Record<Exclude<Traffic, null>, { cls: string; label: string }> = {
    green: { cls: 'bg-emerald-500', label: t('edo.list.control_green') },
    yellow: { cls: 'bg-amber-400', label: t('edo.list.control_yellow') },
    red: { cls: 'bg-red-500 animate-pulse', label: t('edo.list.control_red') },
    done: { cls: 'bg-slate-300', label: t('edo.status.done') },
  };
  const c = cfg[traffic];
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', c.cls)}
      title={c.label}
      aria-label={c.label}
    />
  );
}

function ControlLegend() {
  const { t } = useTranslation();
  const items: { cls: string; label: string }[] = [
    { cls: 'bg-emerald-500', label: t('edo.list.control_green') },
    { cls: 'bg-amber-400', label: t('edo.list.control_yellow') },
    { cls: 'bg-red-500', label: t('edo.list.control_red') },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
      <span className="font-medium text-slate-600">{t('edo.list.control_legend')}:</span>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={cn('inline-block h-2.5 w-2.5 rounded-full', it.cls)} />
          {it.label}
        </span>
      ))}
    </div>
  );
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

export function EdoInternalPage() {
  return (
    <DocList
      queryKey="edo-internal"
      endpoint="/documents/internal"
      titleKey="edo.nav.internal"
      emptyKey="edo.list.empty_internal"
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

// Ochiq topshiriqlar nazorati (kanselyariya) — bajarilmagan porucheniyali hujjatlar.
export function EdoOpenTasksPage() {
  return (
    <DocList
      queryKey="edo-open-tasks"
      endpoint="/documents/control/open-tasks"
      titleKey="edo.nav.open_tasks"
      emptyKey="edo.list.empty_open_tasks"
      showHolder
    />
  );
}
