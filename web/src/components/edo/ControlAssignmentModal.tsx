import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  X,
  Search,
  Check,
  Loader2,
  UserRound,
  CalendarClock,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { User } from '../../lib/types';
import { Avatar } from '../Avatar';

// "Nazorat bandi" oynasi — kanselyariya (yoki yaratuvchi/tasdiqlovchi) hujjat ichida
// ijrochi xodim(lar) tanlab, topshiriq matni va ijro muddatini belgilaydi.
// Backendda mavjud POST /documents/:id/resolution endpointidan foydalanadi.
interface Props {
  documentNumber: string;
  documentSubject: string;
  onClose: () => void;
  onSubmit: (text: string, targets: { userId: string; deadline?: string }[]) => void;
  submitting: boolean;
  error: string | null;
}

export function ControlAssignmentModal({
  documentNumber,
  documentSubject,
  onClose,
  onSubmit,
  submitting,
  error,
}: Props) {
  const { t } = useTranslation();

  const [taskType, setTaskType] = useState<string>('execution');
  const [deadline, setDeadline] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [selected, setSelected] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-short'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
    staleTime: 60_000,
  });

  const taskTypes = ['execution', 'info', 'review'] as const;
  const samples = t('edo.control_assignment.samples', { returnObjects: true }) as string[];

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

  const selectedUsers = useMemo(
    () => users.filter((u) => selected.includes(u.id)),
    [users, selected],
  );

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const appendSample = (s: string) =>
    setText((cur) => (cur.trim() ? `${cur.trim()}\n${s}` : s));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (selected.length === 0) {
      setLocalError(t('edo.control_assignment.err_no_executor'));
      return;
    }
    if (text.trim().length < 2) {
      setLocalError(t('edo.control_assignment.err_no_text'));
      return;
    }
    // Topshiriq turi matn boshiga qo'shiladi (Ijro uchun: ...).
    const typeLabel = t(`edo.control_assignment.type_${taskType}`);
    const fullText = `${typeLabel}: ${text.trim()}`;
    const targets = selected.map((userId) => ({
      userId,
      deadline: deadline || undefined,
    }));
    onSubmit(fullText, targets);
  };

  const fieldCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6"
      >
        {/* Sarlavha */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-asaka-50 text-asaka-600 flex items-center justify-center">
              <ClipboardList size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t('edo.control_assignment.title')}
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

        {/* Kontent */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Topshiriq turi + muddat */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('edo.control_assignment.type_label')}</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className={fieldCls}
              >
                {taskTypes.map((k) => (
                  <option key={k} value={k}>
                    {t(`edo.control_assignment.type_${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                <CalendarClock size={12} className="inline -mt-0.5 mr-1" />
                {t('edo.control_assignment.deadline_label')}
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>

          {/* Ijrochilar */}
          <div>
            <label className={labelCls}>
              <UserRound size={12} className="inline -mt-0.5 mr-1" />
              {t('edo.control_assignment.executors_label')}
              {selected.length > 0 && (
                <span className="ml-1 text-asaka-600">({selected.length})</span>
              )}
            </label>

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 bg-asaka-50 text-asaka-700 text-xs font-medium pl-2 pr-1 py-1 rounded-full"
                  >
                    {u.fullName}
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      className="hover:bg-asaka-100 rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative mb-2">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('edo.control_assignment.executor_search')}
                className={`${fieldCls} pl-9`}
              />
            </div>

            <div className="border border-slate-200 rounded-lg max-h-44 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 size={15} className="animate-spin" />
                  {t('common.loading')}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400">
                  {t('edo.control_assignment.no_users')}
                </div>
              ) : (
                filtered.map((u) => {
                  const on = selected.includes(u.id);
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => toggle(u.id)}
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
                        className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                          on
                            ? 'bg-asaka-600 border-asaka-600 text-white'
                            : 'border-slate-300'
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

          {/* Topshiriq mazmuni */}
          <div>
            <label className={labelCls}>{t('edo.control_assignment.content_label')}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder={t('edo.control_assignment.content_ph')}
              className={fieldCls}
            />
          </div>

          {/* Namunalar */}
          {Array.isArray(samples) && samples.length > 0 && (
            <div>
              <label className={labelCls}>{t('edo.control_assignment.samples_label')}</label>
              <div className="flex flex-wrap gap-1.5">
                {samples.map((s, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => appendSample(s)}
                    className="text-xs text-slate-600 bg-slate-100 hover:bg-asaka-50 hover:text-asaka-700 px-2.5 py-1 rounded-full"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(localError || error) && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {localError || error}
            </div>
          )}
        </div>

        {/* Pastki tugmalar */}
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
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {t('edo.control_assignment.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
