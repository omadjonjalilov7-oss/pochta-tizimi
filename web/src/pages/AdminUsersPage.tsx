import { type FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, KeyRound, Lock, Unlock, ShieldCheck, Globe } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import type { User, Department, Position } from '../lib/types';

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [resettingFor, setResettingFor] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  });

  if (!currentUser?.isAdmin) {
    return <div className="p-8 text-slate-400">Faqat administratorlar uchun</div>;
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const handleDelete = async (id: string) => {
    if (!confirm("Foydalanuvchini o'chirishni tasdiqlaysizmi?")) return;
    try {
      await api.delete(`/users/${id}`);
      refresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "O'chirishda xatolik");
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await api.post(`/users/${u.id}/${u.isActive ? 'block' : 'activate'}`);
      refresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Xatolik");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center">
          <h1 className="text-xl font-semibold text-slate-900">Foydalanuvchilar</h1>
          <span className="ml-3 text-sm text-slate-400">{users.length} ta</span>
          <button
            onClick={() => setCreating(true)}
            className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-3 py-2 rounded-lg"
          >
            <Plus size={16} />
            Yangi foydalanuvchi
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Yuklanmoqda...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">F.I.SH</th>
                  <th className="px-4 py-3 text-left">Login</th>
                  <th className="px-4 py-3 text-left">Lavozim / Bo'lim</th>
                  <th className="px-4 py-3 text-center">Holat</th>
                  <th className="px-4 py-3 text-center">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar fullName={u.fullName} avatarPath={u.avatarPath} size="sm" />
                        <div>
                          <div className="font-medium text-slate-900">{u.fullName}</div>
                          {u.email && (
                            <div className="text-xs text-slate-500">{u.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{u.login}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.position?.name || '—'}
                      {u.department?.name && (
                        <div className="text-xs text-slate-400">{u.department.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {u.isActive ? (
                          <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">
                            Aktiv
                          </span>
                        ) : (
                          <span className="inline-block bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded">
                            Bloklangan
                          </span>
                        )}
                        {u.isAdmin && (
                          <span title="Administrator" className="text-brand-600">
                            <ShieldCheck size={14} />
                          </span>
                        )}
                        {u.canSendExternal && (
                          <span title="Tashqi pochta" className="text-amber-600">
                            <Globe size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditing(u)}
                          title="Tahrirlash"
                          className="p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setResettingFor(u)}
                          title="Parolni tiklash"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          title={u.isActive ? 'Bloklash' : 'Faollashtirish'}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          {u.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            title="O'chirish"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <UserModal
          user={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            refresh();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {resettingFor && (
        <ResetPasswordModal
          user={resettingFor}
          onClose={() => setResettingFor(null)}
        />
      )}
    </div>
  );
}

function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [login, setLogin] = useState(user?.login || '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [departmentId, setDepartmentId] = useState(user?.departmentId || '');
  const [positionId, setPositionId] = useState(user?.positionId || '');
  const [canSendExternal, setCanSendExternal] = useState(user?.canSendExternal || false);
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin || false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
  });
  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => (await api.get<Position[]>('/positions')).data,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: any = {
        login: login.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        departmentId: departmentId || undefined,
        positionId: positionId || undefined,
        canSendExternal,
        isAdmin,
      };
      if (user) {
        await api.patch(`/users/${user.id}`, body);
      } else {
        if (!password || password.length < 6) {
          setError("Parol kamida 6 belgidan iborat bo'lsin");
          setSaving(false);
          return;
        }
        body.password = password;
        await api.post('/users', body);
      }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">
            {user ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="To'liq F.I.SH *">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                maxLength={255}
                className="input"
              />
            </Field>

            <Field label="Login *">
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                minLength={2}
                maxLength={64}
                className="input font-mono"
              />
            </Field>

            {!user && (
              <Field label="Parol *">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input"
                />
              </Field>
            )}

            <Field label="Telefon">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={32}
                className="input"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Bo'lim">
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="input"
              >
                <option value="">— Tanlang —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Lavozim">
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="input"
              >
                <option value="">— Tanlang —</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (rank {p.rank})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={canSendExternal}
                onChange={(e) => setCanSendExternal(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Tashqi pochta yuborish huquqi
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Administrator huquqlari
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg"
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          outline: none;
          background: white;
          font-size: 0.875rem;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(219, 234, 254, 1);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Parol kamida 6 belgidan iborat bo'lsin");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { newPassword: password });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Parolni tiklash</h2>
          <button
            onClick={onClose}
            className="ml-auto p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X size={20} />
          </button>
        </div>
        {done ? (
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              Parol muvaffaqiyatli yangilandi. Foydalanuvchiga yangi parolni xabar bering:
              <div className="mt-2 font-mono text-base bg-white border border-green-300 px-3 py-2 rounded">
                {password}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg"
            >
              Yopish
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="text-sm text-slate-600">
              <span className="font-semibold">{user.fullName}</span> uchun yangi parol o'rnatish
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Yangi parol
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg"
              >
                {saving ? 'Saqlanmoqda...' : 'Tiklash'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
