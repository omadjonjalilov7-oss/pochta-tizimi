import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Search, X, Calculator, Wallet, Loader2, GripVertical, Building2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoDocument } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { DocListItem } from './EdoDocList';
import { cn } from '../../lib/utils';

interface AccountantDoneResp {
  documents: EdoDocument[];
  paidIds: string[];
  otherIds: string[];
  markedIds?: string[];
}

type Pane = 'other' | 'mid' | 'paid';

// Bitta tomon uchun filtr holati (qidiruv + sana oralig'i).
function useFilter() {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const apply = (docs: EdoDocument[]) => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : null;
    return docs.filter((d) => {
      if (fromTs && new Date(d.createdAt).getTime() < fromTs) return false;
      if (toTs && new Date(d.createdAt).getTime() > toTs) return false;
      if (q) {
        const hay = `${d.number} ${d.docUid ?? ''} ${d.subject} ${d.shortInfo ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };
  const hasFilters = !!search || !!dateFrom || !!dateTo;
  const clear = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };
  return { search, setSearch, dateFrom, setDateFrom, dateTo, setDateTo, apply, hasFilters, clear };
}

function FilterBar({ f }: { f: ReturnType<typeof useFilter> }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 mb-3">
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
        <input
          value={f.search}
          onChange={(e) => f.setSearch(e.target.value)}
          placeholder={t('edo.mydocs.search_ph')}
          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={f.dateFrom}
          onChange={(e) => f.setDateFrom(e.target.value)}
          title={t('edo.mydocs.date_from')}
          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 outline-none"
        />
        <span className="text-slate-400 text-xs">—</span>
        <input
          type="date"
          value={f.dateTo}
          onChange={(e) => f.setDateTo(e.target.value)}
          title={t('edo.mydocs.date_to')}
          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 outline-none"
        />
        {f.hasFilters && (
          <button
            onClick={f.clear}
            title={t('edo.mydocs.clear')}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function EdoBuxgalterPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  // "Boshqa bo'lim" oynasiga olish faqat buxgalter (yoki admin) uchun.
  const canMoveOther = user?.role === 'buxgalter' || user?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['edo-accountant-done'],
    queryFn: async () => (await api.get<AccountantDoneResp>('/documents/accountant/done')).data,
  });

  // Belgilash mutatsiyalari — har biri serverga yozadi va ro'yxatni yangilaydi.
  const mark = useMutation({
    mutationFn: async (vars: { documentId: string; kind: 'paid' | 'other' }) =>
      (await api.post('/documents/accountant/mark', vars)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edo-accountant-done'] }),
  });
  const unmark = useMutation({
    mutationFn: async (documentId: string) =>
      (await api.delete(`/documents/accountant/mark/${documentId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edo-accountant-done'] }),
  });

  const otherF = useFilter();
  const midF = useFilter();
  const paidF = useFilter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overPane, setOverPane] = useState<Pane | null>(null);

  const docs = data?.documents ?? [];
  const paid = useMemo(() => new Set(data?.paidIds ?? data?.markedIds ?? []), [data?.paidIds, data?.markedIds]);
  const other = useMemo(() => new Set(data?.otherIds ?? []), [data?.otherIds]);

  const otherDocs = useMemo(() => otherF.apply(docs.filter((d) => other.has(d.id))), [docs, other, otherF]);
  const midDocs = useMemo(
    () => midF.apply(docs.filter((d) => !paid.has(d.id) && !other.has(d.id))),
    [docs, paid, other, midF],
  );
  const paidDocs = useMemo(() => paidF.apply(docs.filter((d) => paid.has(d.id))), [docs, paid, paidF]);

  const onDrop = (pane: Pane) => {
    setOverPane(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    if (pane === 'paid') {
      if (!paid.has(id)) mark.mutate({ documentId: id, kind: 'paid' });
    } else if (pane === 'other') {
      // Faqat buxgalter/admin "Boshqa bo'lim" oynasiga olib qo'ya oladi.
      if (canMoveOther && !other.has(id)) mark.mutate({ documentId: id, kind: 'other' });
    } else {
      // O'rtaga qaytarish — har qanday belgini olib tashlaydi.
      if (paid.has(id) || other.has(id)) unmark.mutate(id);
    }
  };

  const PaneBox = ({
    side,
    title,
    icon: Icon,
    docsList,
    filter,
    accent,
    ring,
    emptyHint,
    disabledDrop,
  }: {
    side: Pane;
    title: string;
    icon: typeof Wallet;
    docsList: EdoDocument[];
    filter: ReturnType<typeof useFilter>;
    accent: string;
    ring: string;
    emptyHint: string;
    disabledDrop?: boolean;
  }) => (
    <div
      onDragOver={(e) => {
        if (disabledDrop) return;
        e.preventDefault();
        setOverPane(side);
      }}
      onDragLeave={() => setOverPane((p) => (p === side ? null : p))}
      onDrop={() => !disabledDrop && onDrop(side)}
      className={cn(
        'flex-1 min-w-0 flex flex-col rounded-2xl border bg-slate-50/60 p-3 md:p-4 transition',
        overPane === side ? ring : 'border-slate-200',
      )}
    >
      <div className={cn('flex items-center gap-2 mb-3 px-1 font-semibold text-sm', accent)}>
        <Icon size={18} />
        <span>{title}</span>
        <span className="ml-auto text-xs font-medium bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
          {docsList.length}
        </span>
      </div>
      <FilterBar f={filter} />
      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {isLoading ? (
          <div className="text-slate-400 p-6 text-sm">{t('common.loading')}</div>
        ) : docsList.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
            <FileText size={30} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-xs">{emptyHint}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {docsList.map((d) => (
              <div
                key={d.id}
                draggable
                onDragStart={() => setDragId(d.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverPane(null);
                }}
                className={cn('flex items-start gap-1 cursor-grab active:cursor-grabbing', dragId === d.id && 'opacity-50')}
              >
                <GripVertical size={16} className="mt-4 text-slate-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <DocListItem
                    d={d}
                    isAdmin={false}
                    selected={false}
                    onToggle={() => {}}
                    showHolder
                    onDeleteDraft={() => {}}
                    deletingDraft={false}
                  />
                </div>
              </div>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const busy = mark.isPending || unmark.isPending;

  return (
    <div className="w-full px-3 md:px-6 py-4 md:py-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={22} className="text-emerald-600" />
        <h1 className="text-lg md:text-xl font-semibold text-slate-900">{t('edo.buxgalter.title')}</h1>
        {busy && <Loader2 size={16} className="animate-spin text-slate-400" />}
      </div>
      <p className="text-xs text-slate-500 mb-4">{t('edo.buxgalter.hint')}</p>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* CHAP: Boshqa bo'lim hujjatlari (faqat buxgalter olib qo'ya oladi) */}
        <PaneBox
          side="other"
          title={t('edo.buxgalter.pane_other')}
          icon={Building2}
          docsList={otherDocs}
          filter={otherF}
          accent="text-sky-700"
          ring="border-sky-400 ring-2 ring-sky-200 bg-sky-50/40"
          emptyHint={t('edo.buxgalter.empty_other')}
          disabledDrop={!canMoveOther}
        />
        {/* O'RTA: Bajarilgan hujjatlar */}
        <PaneBox
          side="mid"
          title={t('edo.buxgalter.pane_done')}
          icon={FileText}
          docsList={midDocs}
          filter={midF}
          accent="text-slate-700"
          ring="border-asaka-400 ring-2 ring-asaka-200 bg-asaka-50/40"
          emptyHint={t('edo.buxgalter.empty_done')}
        />
        {/* O'NG: To'langan */}
        <PaneBox
          side="paid"
          title={t('edo.buxgalter.pane_paid')}
          icon={Wallet}
          docsList={paidDocs}
          filter={paidF}
          accent="text-emerald-700"
          ring="border-emerald-400 ring-2 ring-emerald-200 bg-emerald-50/40"
          emptyHint={t('edo.buxgalter.empty_paid')}
        />
      </div>
    </div>
  );
}
