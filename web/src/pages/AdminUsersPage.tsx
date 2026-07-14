import { type FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, X, KeyRound, Lock, Unlock, ShieldCheck, ShieldOff, Globe } from 'lucide-react';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import type { User, Department, Position } from '../lib/types';
import { SecretInput } from '../components/SecretInput';

export function AdminUsersPage() {
  const { t } = useTranslation();
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
    return <div className="p-8 text-slate-400">{t('admin.admin_only')}</div>;
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.delete_user_confirm'))) return;
    try {
      await api.delete(`/users/${id}`);
      refresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || t('admin.error_delete'));
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await api.post(`/users/${u.id}/${u.isActive ? 'block' : 'activate'}`);
      refresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || t('common.error'));
    }
  };

  const clearPin = async (u: User) => {
    if (!u.hasApprovalPin) return;
    if (!confirm(t('admin.clear_pin_confirm', { name: u.fullName }))) return;
    try {
      await api.post(`/users/${u.id}/approval-pin/clear`);
      refresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || t('common.error'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center">
          <h1 className="text-xl font-semibold text-slate-900">{t('admin.users_title')}</h1>
          <span className="ml-3 text-sm text-slate-400">{t('admin.count_short', { count: users.length })}</span>
          <button
            onClick={() => setCreating(true)}
            className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-3 py-2 rounded-lg"
          >
            <Plus size={16} />
            {t('admin.add_user')}
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">{t('admin.table_name')}</th>
                  <th className="px-4 py-3 text-left">{t('admin.table_login')}</th>
                  <th className="px-4 py-3 text-left">{t('admin.table_position_department')}</th>
                  <th className="px-4 py-3 text-center">{t('admin.table_status')}</th>
                  <th className="px-4 py-3 text-center">{t('admin.table_actions')}</th>
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
                            {t('common.active')}
                          </span>
                        ) : (
                          <span className="inline-block bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded">
                            {t('common.blocked')}
                          </span>
                        )}
                        {u.isAdmin && (
                          <span title={t('admin.tooltip_admin')} className="text-brand-600">
                            <ShieldCheck size={14} />
                          </span>
                        )}
                        {u.canSendExternal && (
                          <span title={t('admin.tooltip_external_mail')} className="text-amber-600">
                            <Globe size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditing(u)}
                          title={t('admin.tooltip_edit')}
                          className="p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setResettingFor(u)}
                          title={t('admin.tooltip_reset_password')}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                        >
                          <KeyRound size={16} />
                        </button>
                        {u.hasApprovalPin && (
                          <button
                            onClick={() => clearPin(u)}
                            title={t('admin.tooltip_clear_pin')}
                            className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                          >
                            <ShieldOff size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => toggleActive(u)}
                          title={u.isActive ? t('admin.tooltip_block') : t('admin.tooltip_activate')}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          {u.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            title={t('admin.tooltip_delete')}
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
  const { t } = useTranslation();
  const [login, setLogin] = useState(user?.login || '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [mailType, setMailType] = useState<'internal' | 'external'>(
    user?.externalMailEnabled ? 'external' : 'internal',
  );
  const [email, setEmail] = useState(
    user?.externalMailEnabled ? user?.externalMailLogin || '' : user?.email || '',
  );
  const [externalMailPassword, setExternalMailPassword] = useState('');
  const [departmentId, setDepartmentId] = useState(user?.departmentId || '');
  const [positionId, setPositionId] = useState(user?.positionId || '');
  const [managerId, setManagerId] = useState(user?.managerId || '');
  const [canSendExternal, setCanSendExternal] = useState(user?.canSendExternal || false);
  const [canSignExternal, setCanSignExternal] = useState(user?.canSignExternal || false);
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
  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  });
  const managerOptions = allUsers.filter((u) => !user || u.id !== user.id);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: any = {
        login: login.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        // Ichki pochta uchun email yubormaymiz — backend `login@pochta.local` yaratadi
        email: mailType === 'external' ? email.trim() || undefined : undefined,
        mailType,
        departmentId: departmentId || undefined,
        positionId: positionId || undefined,
        managerId: managerId || undefined,
        canSendExternal,
        canSignExternal,
        isAdmin,
      };
      if (mailType === 'external') {
        // Yangi xodim yoki parol kiritilgan bo'lsa yuboramiz (tahrirda bo'sh qoldirilsa — eski saqlanadi)
        body.externalMailPassword = externalMailPassword || undefined;
        if (!email.trim()) {
          setError(t('admin.external_email_required'));
          setSaving(false);
          return;
        }
        if (!user && !externalMailPassword) {
          setError(t('admin.external_password_required'));
          setSaving(false);
          return;
        }
      }
      if (user) {
        await api.patch(`/users/${user.id}`, body);
      } else {
        if (!password || password.length < 6) {
          setError(t('admin.password_min_length'));
          setSaving(false);
          return;
        }
        body.password = password;
        await api.post('/users', body);
      }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || t('admin.error_save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">
            {user ? t('admin.edit_user') : t('admin.add_user')}
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
            <Field label={t('admin.form_full_name_label')}>
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

            <Field label={t('admin.form_login_label')}>
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
              <Field label={t('admin.form_password_label')}>
                <SecretInput
                  name="admin-new-user-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input w-full"
                />
              </Field>
            )}

            <Field label={t('admin.form_phone_label')}>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={32}
                className="input"
              />
            </Field>

            <Field label={t('admin.form_mail_type_label')}>
              <select
                value={mailType}
                onChange={(e) => setMailType(e.target.value as 'internal' | 'external')}
                className="input"
              >
                <option value="internal">{t('admin.mail_type_internal')}</option>
                <option value="external">{t('admin.mail_type_external')}</option>
              </select>
            </Field>

            {mailType === 'external' ? (
              <>
                <Field label={t('admin.form_external_email_label')}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ism@asaka-motors.uz"
                    className="input"
                  />
                </Field>

                <Field label={t('admin.form_external_password_label')}>
                  <SecretInput
                    name="admin-external-mail-password"
                    value={externalMailPassword}
                    onChange={(e) => setExternalMailPassword(e.target.value)}
                    placeholder={user ? t('admin.external_password_keep_hint') : ''}
                    className="input w-full"
                  />
                </Field>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                {t('admin.internal_mail_hint', {
                  email: `${login.trim() || 'login'}@pochta.local`,
                })}
              </p>
            )}

            <Field label={t('admin.form_department_label')}>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="input"
              >
                <option value="">{t('admin.form_select_placeholder')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('admin.form_position_label')}>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="input"
              >
                <option value="">{t('admin.form_select_placeholder')}</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t('admin.position_rank', { name: p.name, rank: p.rank })}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('admin.form_manager_label')}>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="input"
              >
                <option value="">{t('admin.form_no_manager')}</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                    {m.position?.name ? ` — ${m.position.name}` : ''}
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
              {t('admin.can_send_external')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={canSignExternal}
                onChange={(e) => setCanSignExternal(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {t('admin.can_sign_external')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {t('admin.is_admin_perms')}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg"
            >
              {saving ? t('common.saving') : t('common.save')}
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
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t('admin.password_min_length'));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { newPassword: password });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{t('admin.reset_password')}</h2>
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
              {t('admin.reset_success')}
              <div className="mt-2 font-mono text-base bg-white border border-green-300 px-3 py-2 rounded">
                {password}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="text-sm text-slate-600">
              {t('admin.reset_password_for', { name: user.fullName })}
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('admin.new_password')}
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
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg"
              >
                {saving ? t('common.saving') : t('admin.reset_action')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
