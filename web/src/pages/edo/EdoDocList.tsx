import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Clock, ChevronRight, Trash2, Loader2, Pencil, Search, X, ShieldCheck } from 'lucide-react';
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
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
            <DocListItem
              key={d.id}
              d={d}
              isAdmin={isAdmin}
              selected={selected.has(d.id)}
              onToggle={toggle}
              showHolder={showHolder}
              onDeleteDraft={onDeleteDraft}
              deletingDraft={deleteDraft.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// Yagona hujjat qatori — DocList va "Mening hujjatlarim" sahifasida qayta ishlatiladi.
export function DocListItem({
  d,
  isAdmin,
  selected,
  onToggle,
  showHolder,
  onDeleteDraft,
  deletingDraft,
}: {
  d: EdoDocument;
  isAdmin: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  showHolder?: boolean;
  onDeleteDraft: (id: string) => void;
  deletingDraft: boolean;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  return (
    <li className="flex items-start gap-2">
      {isAdmin && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(d.id)}
          className="mt-4 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
          title={t('edo.list.select_for_delete')}
        />
      )}
      <Link
        to={`/edo/documents/${d.id}`}
        className={cn(
          'flex-1 min-w-0 flex items-start gap-2.5 bg-white border border-slate-200 hover:border-asaka-300 hover:shadow-sm rounded-xl px-3 py-2.5 md:px-4 md:py-3 transition',
          ageAccentClass(d.createdAt, d.status),
          isAdmin && selected && 'ring-2 ring-red-400 border-red-300',
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
            disabled={deletingDraft}
            title={t('common.delete')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </li>
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

// ── "Mening hujjatlarim" — kategoriya tablari + qidiruv/filtr paneli ──
type MyDocTab = 'all' | 'outgoing' | 'reply' | 'internal' | 'other';

function matchTab(d: EdoDocument, tab: MyDocTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'outgoing':
      return d.type === 'outgoing';
    case 'reply':
      return !!d.replyRequired;
    case 'internal':
      return d.type === 'internal';
    case 'other':
      return d.type === 'incoming' || (d.type !== 'outgoing' && d.type !== 'internal');
  }
}

export function EdoMyDocsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['edo-mine'],
    queryFn: async () => (await api.get<EdoDocument[]>('/documents/mine')).data,
  });

  const [tab, setTab] = useState<MyDocTab>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => (await api.post('/documents/bulk-delete', { ids })).data,
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['edo-mine'] });
    },
  });
  const deleteDraft = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/documents/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edo-mine'] }),
  });
  const onDeleteDraft = (id: string) => {
    if (!window.confirm(t('edo.list.delete_confirm', { count: 1 }))) return;
    deleteDraft.mutate(id);
  };
  const onBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(t('edo.list.delete_confirm', { count: ids.length }))) return;
    bulkDelete.mutate(ids);
  };

  const tabCounts = useMemo(() => {
    const c: Record<MyDocTab, number> = { all: 0, outgoing: 0, reply: 0, internal: 0, other: 0 };
    for (const d of docs) {
      (['all', 'outgoing', 'reply', 'internal', 'other'] as MyDocTab[]).forEach((tb) => {
        if (matchTab(d, tb)) c[tb] += 1;
      });
    }
    return c;
  }, [docs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : null;
    return docs.filter((d) => {
      if (!matchTab(d, tab)) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (fromTs && new Date(d.createdAt).getTime() < fromTs) return false;
      if (toTs && new Date(d.createdAt).getTime() > toTs) return false;
      if (q) {
        const hay = `${d.number} ${d.docUid ?? ''} ${d.subject} ${d.shortInfo ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, tab, statusFilter, dateFrom, dateTo, search]);

  const hasFilters = !!search || statusFilter !== 'all' || !!dateFrom || !!dateTo;
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const tabs: MyDocTab[] = ['all', 'outgoing', 'reply', 'internal', 'other'];
  const statuses: DocumentStatus[] = ['draft', 'in_review', 'in_progress', 'done', 'rejected', 'overdue'];

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-lg md:text-xl font-semibold text-slate-900">{t('edo.nav.my_documents')}</h1>
        {isAdmin && selected.size > 0 && (
          <button
            onClick={onBulkDelete}
            disabled={bulkDelete.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition"
          >
            {bulkDelete.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {t('edo.list.delete_selected', { count: selected.size })}
          </button>
        )}
      </div>

      {/* Kategoriya tablari */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition',
              tab === tb
                ? 'bg-asaka-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-asaka-300',
            )}
          >
            {t(`edo.mydocs.tab_${tb}`)}
            <span
              className={cn(
                'text-[11px] px-1.5 rounded-full',
                tab === tb ? 'bg-white/20' : 'bg-slate-100 text-slate-500',
              )}
            >
              {tabCounts[tb]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Chap ustun — hujjatlar ro'yxati */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="text-slate-400 p-6">{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <FileText size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">{t('edo.list.empty_mine')}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((d) => (
                <DocListItem
                  key={d.id}
                  d={d}
                  isAdmin={isAdmin}
                  selected={selected.has(d.id)}
                  onToggle={toggle}
                  showHolder
                  onDeleteDraft={onDeleteDraft}
                  deletingDraft={deleteDraft.isPending}
                />
              ))}
            </ul>
          )}
        </div>

        {/* O'ng ustun — qidiruv / filtr paneli */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{t('edo.mydocs.filters')}</h2>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
                >
                  <X size={12} />
                  {t('edo.mydocs.clear')}
                </button>
              )}
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('edo.mydocs.search_ph')}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('edo.stats.status') || t('edo.mydocs.status')}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | 'all')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 outline-none bg-white"
              >
                <option value="all">{t('edo.mydocs.tab_all')}</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {t(`edo.status.${s}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('edo.mydocs.date_from')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('edo.mydocs.date_to')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 outline-none"
              />
            </div>

            <div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
              {t('edo.mydocs.found', { count: filtered.length })}
            </div>
          </div>
        </aside>
      </div>
    </div>
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

interface MineTaskStats {
  tasks: { total: number; byStatus: Record<string, number> };
}

export function EdoTasksPage() {
  const { t } = useTranslation();
  const { data: stats } = useQuery({
    queryKey: ['edo-tasks-stats'],
    queryFn: async () => (await api.get<MineTaskStats>('/documents/stats/mine')).data,
  });
  const by = stats?.tasks.byStatus ?? {};
  const chips: { key: string; value: number; cls: string }[] = [
    { key: 'pending', value: by.pending ?? 0, cls: 'bg-amber-50 text-amber-700' },
    { key: 'in_progress', value: by.in_progress ?? 0, cls: 'bg-sky-50 text-sky-700' },
    { key: 'done', value: by.done ?? 0, cls: 'bg-emerald-50 text-emerald-700' },
    { key: 'overdue', value: by.overdue ?? 0, cls: 'bg-rose-50 text-rose-700' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-6 py-4 md:py-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-lg md:text-xl font-semibold text-slate-900">{t('edo.tasks.title')}</h1>
        <Link
          to="/edo/control?tab=internal"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-asaka-600 hover:bg-asaka-700 rounded-lg transition"
        >
          <ShieldCheck size={16} />
          {t('edo.tasks.internal_control')}
        </Link>
      </div>

      {/* Topshiriqlar ijro holati */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{t('edo.tasks.exec_status')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {chips.map((c) => (
            <div key={c.key} className={cn('rounded-xl px-4 py-3', c.cls)}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs font-medium opacity-80">{t(`edo.task_status.${c.key}`)}</div>
            </div>
          ))}
        </div>
      </div>

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
    </div>
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
