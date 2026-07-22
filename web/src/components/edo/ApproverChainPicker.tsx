import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Search, Trash2, UserPlus } from 'lucide-react';
import { Avatar } from '../Avatar';
import type { User } from '../../lib/types';

type ShortUser = Pick<User, 'id' | 'fullName' | 'avatarPath' | 'departmentId' | 'isActive'> & {
  position?: { name?: string | null; rank?: number } | null;
  department?: { name?: string | null } | null;
};

interface Props {
  users: ShortUser[];
  // Joriy tanlangan tasdiqlovchilar UUID ro'yxati (tartibli)
  value: string[];
  onChange: (next: string[]) => void;
  // Pikerda ko'rinmasligi kerak bo'lgan UUID lar (masalan yaratuvchi)
  excludeUserIds?: string[];
  // Maksimal ruxsat etilgan zanjir uzunligi
  max?: number;
  // Faqat o'qish rejimi (qoralama emas)
  disabled?: boolean;
  // Heading/title sarlavhasi
  label?: string;
  // Tarif ostida ko'rinadigan yordamchi matn
  hint?: string;
}

export function ApproverChainPicker({
  users,
  value,
  onChange,
  excludeUserIds = [],
  max = 20,
  disabled,
  label,
  hint,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const userMap = useMemo(() => {
    const m = new Map<string, ShortUser>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const excludeSet = useMemo(
    () => new Set<string>([...excludeUserIds, ...value]),
    [excludeUserIds, value],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter(
      (u) => u.isActive && !excludeSet.has(u.id),
    );
    if (!q) return list.slice(0, 30);
    return list
      .filter((u) => {
        const hay = [u.fullName, u.position?.name ?? '', u.department?.name ?? '']
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);
  }, [users, query, excludeSet]);

  const add = (id: string) => {
    if (disabled) return;
    if (value.includes(id)) return;
    if (value.length >= max) return;
    onChange([...value, id]);
    setQuery('');
  };

  const remove = (id: string) => {
    if (disabled) return;
    onChange(value.filter((x) => x !== id));
  };

  const move = (idx: number, dir: -1 | 1) => {
    if (disabled) return;
    const next = [...value];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}
      {hint && <p className="text-xs text-slate-500 -mt-1">{hint}</p>}

      {/* Tanlangan zanjir */}
      {value.length === 0 ? (
        <div className="px-3 py-2 text-xs italic text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          {t('edo.compose.approvers_empty')}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {value.map((uid, idx) => {
            const u = userMap.get(uid);
            return (
              <li
                key={uid}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white border border-emerald-300 text-emerald-700 text-xs font-semibold shrink-0">
                  {idx + 1}
                </span>
                {u ? (
                  <>
                    <Avatar
                      fullName={u.fullName}
                      avatarPath={u.avatarPath ?? undefined}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {u.fullName}
                      </div>
                      {(u.position?.name || u.department?.name) && (
                        <div className="text-xs text-slate-500 truncate">
                          {u.position?.name}
                          {u.position?.name && u.department?.name ? ' — ' : ''}
                          {u.department?.name}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 text-sm text-slate-500 italic">
                    {t('edo.compose.unknown_user')} ({uid.slice(0, 8)}…)
                  </div>
                )}
                {!disabled && (
                  <>
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      title={t('edo.compose.move_up')}
                      className="p-1 text-slate-500 hover:text-asaka-700 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === value.length - 1}
                      title={t('edo.compose.move_down')}
                      className="p-1 text-slate-500 hover:text-asaka-700 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(uid)}
                      title={t('common.delete')}
                      className="p-1 text-slate-500 hover:text-red-600 hover:bg-white rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Qo'shish — search + ro'yxat */}
      {!disabled && value.length < max && (
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg focus-within:border-asaka-500 focus-within:ring-2 focus-within:ring-asaka-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // Mouse-down event'lari avval ishlashi uchun kichik kechikish bilan yopamiz
                setTimeout(() => setOpen(false), 150);
              }}
              placeholder={t('edo.compose.approvers_search_ph')}
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>

          {open && (
            <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {candidates.length === 0 ? (
                <div className="px-3 py-3 text-xs italic text-slate-400">
                  {t('edo.compose.approvers_no_match')}
                </div>
              ) : (
                <ul>
                  {candidates.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          add(u.id);
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-slate-50"
                      >
                        <Avatar
                          fullName={u.fullName}
                          avatarPath={u.avatarPath ?? undefined}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {u.fullName}
                          </div>
                          {(u.position?.name || u.department?.name) && (
                            <div className="text-xs text-slate-500 truncate">
                              {u.position?.name}
                              {u.position?.name && u.department?.name ? ' — ' : ''}
                              {u.department?.name}
                            </div>
                          )}
                        </div>
                        <UserPlus size={14} className="text-asaka-600 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {value.length >= max && (
        <p className="text-xs text-amber-600">
          {t('edo.compose.approvers_max_reached', { max })}
        </p>
      )}
    </div>
  );
}
