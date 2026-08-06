import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Clock,
  Search,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoDocument } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { cn, cyrName } from '../../lib/utils';
import InlineAttachmentPreview from '../../components/edo/InlineAttachmentPreview';

// "Sektor fishka" — kiruvchi hujjatlarni rezolyutsiya (poruchenie) holatiga
// qarab guruhlaydi. Har bir submenu bitta holatni ko'rsatadi.
export type ResState = 'exists' | 'none' | 'rejected' | 'signed' | 'no_leader';

export const RES_STATES: ResState[] = [
  'exists',
  'none',
  'rejected',
  'signed',
  'no_leader',
];

// Kiruvchi hujjatning rezolyutsiya holatini aniqlaydi (o'zaro istisno).
export function resState(d: EdoDocument): ResState {
  if (d.status === 'rejected') return 'rejected';
  if (d.status === 'done') return 'signed';
  // Rahbar tanlanganmi? — present-to-leader rahbarni "approver" sifatida qo'shadi.
  const hasApprover = d.participants?.some((p) => p.role === 'approver');
  if (!hasApprover) return 'no_leader';
  if ((d.resolutions?.length ?? 0) > 0) return 'exists';
  return 'none';
}

export function EdoKanselyariyaPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const params = useParams<{ filter?: string }>();
  const filter = (params.filter as ResState) || 'exists';

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['edo-kanselyariya-incoming'],
    queryFn: async () =>
      (await api.get<EdoDocument[]>('/documents/control/incoming')).data,
  });

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Faol filtrga mos hujjatlar. Rezolyutsiya javob berilishiga qarab tartib:
  // eng oxirgi yangilangan (javob) yuqorida.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs
      .filter((d) => resState(d) === filter)
      .filter((d) => {
        if (!q) return true;
        const hay =
          `${d.number} ${d.docUid ?? ''} ${d.subject} ${d.createdBy?.fullName ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [docs, filter, search]);

  // Filtr almashsa yoki ro'yxat o'zgarsa — birinchi hujjatni tanlaymiz.
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
    } else if (!filtered.some((d) => d.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((d) => d.id === selectedId) ?? null;

  // Har bir holat uchun soni (submenu badge'lari uchun).
  const counts = useMemo(() => {
    const c: Record<ResState, number> = {
      exists: 0,
      none: 0,
      rejected: 0,
      signed: 0,
      no_leader: 0,
    };
    for (const d of docs) c[resState(d)] += 1;
    return c;
  }, [docs]);

  const primaryAtt = selected?.attachments?.[0];
  const shownBody = selected?.renderedBody ?? selected?.body ?? '';
  const isHtml = /^\s*<[a-z]/i.test(shownBody || '');
  const isFaithful = /<section[\s>]/i.test(shownBody || '');

  return (
    <div className="w-full h-full flex flex-col">
      {/* Sarlavha + filtr chiplari */}
      <div className="px-3 md:px-5 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-base md:text-lg font-semibold text-slate-900">
            {t('edo.kanselyariya.title')}
          </h1>
          <span className="text-xs text-slate-400">
            {t('edo.kanselyariya.subtitle')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RES_STATES.map((s) => (
            <Link
              key={s}
              to={`/edo/kanselyariya/${s}`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition',
                s === filter
                  ? 'bg-asaka-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {t(`edo.kanselyariya.state_${s}`)}
              <span
                className={cn(
                  'text-[11px] px-1.5 rounded-full',
                  s === filter ? 'bg-white/20' : 'bg-white text-slate-500',
                )}
              >
                {counts[s]}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Ikki panel: chapda ro'yxat, o'ngda hujjat kartochkasi + asosiy fayl */}
      <div className="flex-1 flex min-h-0">
        {/* Chap panel — ro'yxat */}
        <div className="w-full md:w-96 shrink-0 border-r border-slate-200 flex flex-col min-h-0 bg-white">
          <div className="p-2.5 border-b border-slate-100">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('edo.kanselyariya.search_ph')}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none"
              />
            </div>
            <div className="mt-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {t('edo.kanselyariya.for_resolution')} ({filtered.length})
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {t('common.loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">{t('edo.kanselyariya.empty')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 hover:bg-slate-50 transition',
                        d.id === selectedId && 'bg-asaka-50/70',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-medium text-sm text-slate-900 truncate">
                          {d.subject}
                        </span>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(d.updatedAt).toLocaleDateString(lang)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {d.number}
                        </span>
                        <span className="flex items-center gap-1 min-w-0">
                          <Avatar
                            fullName={d.createdBy.fullName}
                            avatarPath={d.createdBy.avatarPath}
                            size="sm"
                          />
                          <span className="truncate">{cyrName(d.createdBy.fullName)}</span>
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* O'ng panel — tanlangan hujjat kartochkasi + asosiy fayl */}
        <div className="hidden md:flex flex-1 flex-col min-h-0 bg-slate-50">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Info size={36} className="mb-2" />
              <p className="text-sm">{t('edo.kanselyariya.select_hint')}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Hujjat sarlavhasi */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900">
                      {selected.subject}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                        {selected.number}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(selected.createdAt).toLocaleString(lang)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Avatar
                          fullName={selected.createdBy.fullName}
                          avatarPath={selected.createdBy.avatarPath}
                          size="sm"
                        />
                        {cyrName(selected.createdBy.fullName)}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/edo/documents/${selected.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-asaka-600 hover:bg-asaka-700 px-3 py-1.5 rounded-lg shrink-0"
                  >
                    <ExternalLink size={15} />
                    {t('edo.kanselyariya.open')}
                  </Link>
                </div>
              </div>

              {/* Hujjat kartochkasi (kiruvchi shablon) */}
              {shownBody && (
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {t('edo.kanselyariya.card')}
                  </div>
                  <div className="edo-a4-scroll overflow-auto bg-slate-100 rounded-lg p-3 max-h-[420px]">
                    <div className="edo-a4-sheet mx-auto bg-white shadow-md">
                      {isHtml ? (
                        <div
                          className={
                            isFaithful
                              ? 'edo-faithful max-w-none'
                              : 'edo-doc-body prose prose-sm max-w-none text-slate-800'
                          }
                          dangerouslySetInnerHTML={{ __html: shownBody }}
                        />
                      ) : (
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-800">
                          {shownBody}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Asosiy fayl (tashqaridan kelgan hujjat) */}
              {primaryAtt && (
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {t('edo.view.primary_document')}
                  </div>
                  <InlineAttachmentPreview
                    key={primaryAtt.id}
                    documentId={selected.id}
                    attId={primaryAtt.id}
                    filename={primaryAtt.filename}
                    heightClass="h-[520px]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
