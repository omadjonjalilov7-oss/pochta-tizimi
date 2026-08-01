import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserCheck, X, Search, Check, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { User } from '../../lib/types';
import { Avatar } from '../Avatar';

// Kiruvchi hujjatni rahbarga ma'ruza qilish oynasi — ro'yxatdan bitta rahbar
// tanlanadi va ixtiyoriy izoh yoziladi. Backend: POST /documents/:id/present-to-leader.
interface Props {
  documentNumber: string;
  documentSubject: string;
  onClose: () => void;
  onSubmit: (leaderId: string, note?: string) => void;
  submitting: boolean;
  error: string | null;
}

export function PresentToLeaderModal({
  documentNumber,
  documentSubject,
  onClose,
  onSubmit,
  submitting,
  error,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-short'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter((u) => u.isActive !== false);
    if (!q) return list;
    return list.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.position?.name?.toLowerCase().includes(q) ||
        u.department?.name?.toLowerCase().includes(q),
    );
  }, [users, query]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!leaderId) {
      setLocalError(t('edo.present_leader.err_no_leader'));
      return;
    }
    onSubmit(leaderId, note.trim() || undefined);
  };

  const fieldCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-6">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-asaka-50 text-asaka-600 flex items-center justify-center">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t('edo.present_leader.title')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {documentNumber} · {documentSubject}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={labelCls}>{t('edo.present_leader.leader_label')}</label>
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('edo.present_leader.leader_search')}
                className={`${fieldCls} pl-9`}
              />
            </div>
            <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 size={15} className="animate-spin" />
                  {t('common.loading')}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400">
                  {t('edo.present_leader.no_users')}
                </div>
              ) : (
                filtered.map((u) => {
                  const on = leaderId === u.id;
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => setLeaderId(u.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 ${
                        on ? 'bg-asaka-50/60' : ''
                      }`}
                    >
                      <Avatar fullName={u.fullName} avatarPath={u.avatarPath} size="sm" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">
                          {u.fullName}
                        </span>
                        {(u.position?.name || u.department?.name) && (
                          <span className="block text-xs text-slate-400 truncate">
                            {[u.position?.name, u.department?.name].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                      <span
                        className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                          on ? 'bg-asaka-600 border-asaka-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {on && <Check size={13} />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('edo.present_leader.note_label')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={t('edo.present_leader.note_ph')}
              className={fieldCls}
            />
          </div>

          {(localError || error) && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {localError || error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-asaka-600 hover:bg-asaka-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
            {t('edo.present_leader.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
