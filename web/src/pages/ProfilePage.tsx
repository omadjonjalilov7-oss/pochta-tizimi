import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Mail, CheckCircle2, AlertCircle, Loader2, LinkIcon, Unlink, RefreshCw, Stethoscope, X, Bell, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { formatDateTime, cn } from '../lib/utils';
import { api } from '../lib/api';
import type { User } from '../lib/types';
import { SecretInput } from '../components/SecretInput';

interface ExternalMailStatus {
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  domain: string;
}

interface DebugInspectResult {
  folders: { path: string; specialUse?: string; exists?: number; uidNext?: number }[];
  recentByFolder: Record<
    string,
    { uid: number; from: string; subject: string; date: string; seen: boolean }[]
  >;
  user: { lastUid: number | null; lastSyncAt: string | null };
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<User>('/users/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
    } catch (err: any) {
      setError(err.response?.data?.message || t('profile.avatar_error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('profile.delete_avatar_confirm'))) return;
    setError(null);
    setUploading(true);
    try {
      const { data } = await api.delete<User>('/users/me/avatar');
      setUser(data);
    } catch (err: any) {
      setError(err.response?.data?.message || t('profile.avatar_error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
          <div className="relative group">
            <Avatar fullName={user.fullName} avatarPath={user.avatarPath} size="lg" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              title={t('profile.upload_avatar')}
            >
              <Camera size={22} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{user.fullName}</h1>
            <p className="text-slate-500">
              {user.position?.name}
              {user.department?.name && ` • ${user.department.name}`}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-brand-700 hover:text-brand-800 font-medium disabled:opacity-50"
              >
                <Camera size={14} />
                {uploading ? t('profile.avatar_uploading') : t('profile.upload_avatar')}
              </button>
              {user.avatarPath && (
                <button
                  onClick={handleDelete}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {t('common.delete')}
                </button>
              )}
            </div>
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            <div className="mt-1 text-xs text-slate-400">
              JPG, PNG, WEBP / GIF — 5 MB
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t('profile.login')} value={user.login} />
          <Field label={t('profile.email')} value={user.email || '—'} />
          <Field label={t('admin.form_full_name')} value={user.fullName} />
          <Field
            label={t('profile.position')}
            value={user.position?.name || '—'}
          />
          <Field
            label={t('profile.department')}
            value={user.department?.name || '—'}
          />
          {user.role !== 'user' && (
            <Field
              label={t('profile.role')}
              value={
                <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-2 py-0.5 rounded">
                  {user.role === 'admin' ? t('profile.role_admin') : t('admin.role_chancellery')}
                </span>
              }
            />
          )}
        </dl>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PreferencesSection />
        <ApprovalPinSection />
      </div>

      <ExternalMailSection />
    </div>
  );
}

function PreferencesSection() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!user) return null;

  const notifyEdo = user.notifyEdo ?? true;

  const toggle = async () => {
    setSaving(true);
    setErr(null);
    try {
      const { data } = await api.patch<User>('/users/me/preferences', {
        notifyEdo: !notifyEdo,
      });
      setUser(data);
    } catch (e: any) {
      setErr(e.response?.data?.message || t('profile.prefs_save_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-brand-50/50 to-white">
        <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
          <Bell size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">{t('profile.prefs_title')}</h2>
          <p className="text-xs text-slate-500">{t('profile.prefs_subtitle')}</p>
        </div>
      </div>
      <div className="p-8 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={notifyEdo}
            onChange={toggle}
            disabled={saving}
            className="mt-1 h-4 w-4 accent-brand-600"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">{t('profile.prefs_notify_edo')}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t('profile.prefs_notify_edo_hint')}</div>
          </div>
          {saving && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </label>
        {err && <div className="text-xs text-red-600">{err}</div>}
      </div>
    </div>
  );
}

function ApprovalPinSection() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  if (!user) return null;

  const hasPin = !!user.hasApprovalPin;

  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!/^\d{4}$/.test(pin)) {
      setMsg({ kind: 'err', text: t('profile.pin_err_format') });
      return;
    }
    if (pin !== confirmPin) {
      setMsg({ kind: 'err', text: t('profile.pin_err_mismatch') });
      return;
    }
    if (hasPin && !/^\d{4}$/.test(currentPin)) {
      setMsg({ kind: 'err', text: t('profile.pin_err_current_required') });
      return;
    }
    setSaving(true);
    try {
      await api.post('/users/me/approval-pin', {
        pin,
        ...(hasPin ? { currentPin } : {}),
      });
      setMsg({ kind: 'ok', text: t('profile.pin_saved') });
      setPin('');
      setConfirmPin('');
      setCurrentPin('');
      // refresh hasApprovalPin flag
      try {
        const { data } = await api.get<User>(`/users/${user.id}`);
        setUser({ ...user, hasApprovalPin: data.hasApprovalPin });
      } catch {}
    } catch (err: any) {
      setMsg({ kind: 'err', text: err.response?.data?.message || t('profile.pin_save_error') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-brand-50/50 to-white">
        <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
          <ShieldCheck size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">{t('profile.pin_title')}</h2>
          <p className="text-xs text-slate-500">{t('profile.pin_subtitle')}</p>
        </div>
        {hasPin && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={14} />
            {t('profile.pin_set_badge')}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="p-8 space-y-4">
        {hasPin && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('profile.pin_current_label')}
            </label>
            <SecretInput
              inputMode="numeric"
              name="approval-pin-current"
              value={currentPin}
              onChange={(e) => setCurrentPin(onlyDigits(e.target.value))}
              placeholder="••••"
              wrapperClassName="w-40"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-base font-mono tracking-[0.6em] text-center"
              maxLength={4}
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {hasPin ? t('profile.pin_new_label') : t('profile.pin_label')}
            </label>
            <SecretInput
              inputMode="numeric"
              name="approval-pin-new"
              value={pin}
              onChange={(e) => setPin(onlyDigits(e.target.value))}
              placeholder="••••"
              wrapperClassName="w-40"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-base font-mono tracking-[0.6em] text-center"
              maxLength={4}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('profile.pin_confirm_label')}
            </label>
            <SecretInput
              inputMode="numeric"
              name="approval-pin-confirm"
              value={confirmPin}
              onChange={(e) => setConfirmPin(onlyDigits(e.target.value))}
              placeholder="••••"
              wrapperClassName="w-40"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-base font-mono tracking-[0.6em] text-center"
              maxLength={4}
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          {t('profile.pin_hint')}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 text-white text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 transition"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {hasPin ? t('profile.pin_change') : t('profile.pin_set')}
          </button>
        </div>
        {msg && (
          <div
            className={
              'flex items-start gap-2 text-sm rounded-lg px-3 py-2 ' +
              (msg.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200')
            }
          >
            {msg.kind === 'ok' ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}
      </form>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
}

// ============================================================
// Tashqi pochta (asaka-motors.uz) — ulash/uzish
// ============================================================
function ExternalMailSection() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ExternalMailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugInspectResult | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);

  const openDebug = async () => {
    setDebugOpen(true);
    setDebugLoading(true);
    setDebugError(null);
    setDebugData(null);
    try {
      const { data } = await api.get<DebugInspectResult>('/external-mail/debug');
      setDebugData(data);
    } catch (err: any) {
      setDebugError(err.response?.data?.message || t('external_mail.debug_error'));
    } finally {
      setDebugLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ExternalMailStatus>('/external-mail/status');
      setStatus(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!email.trim() || !password.trim()) {
      setMsg({ kind: 'err', text: t('external_mail.validation_email_password') });
      return;
    }
    setBusy(true);
    try {
      await api.post('/external-mail/connect', { email: email.trim(), password });
      setMsg({ kind: 'ok', text: t('external_mail.connect_success') });
      setEmail('');
      setPassword('');
      await load();
    } catch (err: any) {
      setMsg({
        kind: 'err',
        text: err.response?.data?.message || t('external_mail.connect_error'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!email.trim() || !password.trim()) {
      setMsg({ kind: 'err', text: t('external_mail.validation_email_password') });
      return;
    }
    setMsg({ kind: 'info', text: t('external_mail.test_in_progress') });
    setBusy(true);
    try {
      const { data } = await api.post<{ ok: boolean; error?: string }>(
        '/external-mail/test',
        { email: email.trim(), password },
      );
      if (data.ok) {
        setMsg({ kind: 'ok', text: t('external_mail.test_ok') });
      } else {
        setMsg({ kind: 'err', text: t('external_mail.test_error', { error: data.error || '' }) });
      }
    } catch (err: any) {
      setMsg({
        kind: 'err',
        text: err.response?.data?.message || t('external_mail.test_generic_error'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResync = async () => {
    if (!confirm(t('external_mail.resync_confirm'))) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await api.post<{ ok: boolean; message: string }>('/external-mail/resync');
      setMsg({ kind: 'ok', text: data.message || t('external_mail.resync_started') });
      await load();
    } catch (err: any) {
      setMsg({
        kind: 'err',
        text: err.response?.data?.message || t('external_mail.resync_error'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t('external_mail.disconnect_confirm'))) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.delete('/external-mail/disconnect');
      setMsg({ kind: 'ok', text: t('external_mail.disconnect_success') });
      await load();
    } catch (err: any) {
      setMsg({
        kind: 'err',
        text: err.response?.data?.message || t('external_mail.disconnect_error'),
      });
    } finally {
      setBusy(false);
    }
  };

  const domain = status?.domain || 'asaka-motors.uz';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-brand-50/50 to-white">
        <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
          <Mail size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">{t('external_mail.section_title')}</h2>
          <p className="text-xs text-slate-500">
            {t('external_mail.section_subtitle', { domain })}
          </p>
        </div>
        {status?.connected && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={14} />
            {t('external_mail.connected_badge')}
          </span>
        )}
      </div>

      <div className="p-8 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            {t('common.loading')}
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label={t('external_mail.connected_email')}
                value={
                  <span className="font-mono text-sm text-slate-900">{status.email}</span>
                }
              />
              <Field
                label={t('external_mail.last_sync')}
                value={status.lastSyncAt ? formatDateTime(status.lastSyncAt) : t('external_mail.never_synced')}
              />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {t('external_mail.info_polling')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openDebug}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                  title={t('external_mail.diagnostics_tooltip')}
                >
                  <Stethoscope size={14} />
                  {t('external_mail.diagnostics')}
                </button>
                <button
                  onClick={handleResync}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 px-3 py-1.5 rounded-lg hover:bg-brand-50 disabled:opacity-50"
                  title={t('external_mail.resync_tooltip')}
                >
                  <RefreshCw size={14} />
                  {t('external_mail.resync')}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  <Unlink size={14} />
                  {t('external_mail.disconnect')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t('external_mail.email_label')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('external_mail.email_placeholder', { domain })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
                autoComplete="off"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t('external_mail.password_label')}
              </label>
              <SecretInput
                name="ext-mail-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('external_mail.password_placeholder')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {t('external_mail.password_hint')}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 text-white text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 transition"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />}
                {t('external_mail.connect')}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t('external_mail.test')}
              </button>
            </div>
          </form>
        )}

        {msg && (
          <div
            className={
              'flex items-start gap-2 text-sm rounded-lg px-3 py-2 ' +
              (msg.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : msg.kind === 'err'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-slate-50 text-slate-700 border border-slate-200')
            }
          >
            {msg.kind === 'ok' ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : msg.kind === 'err' ? (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            ) : (
              <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
            )}
            <span>{msg.text}</span>
          </div>
        )}
      </div>

      {debugOpen && (
        <DebugModal
          data={debugData}
          loading={debugLoading}
          error={debugError}
          onClose={() => setDebugOpen(false)}
        />
      )}
    </div>
  );
}

function DebugModal({
  data,
  loading,
  error,
  onClose,
}: {
  data: DebugInspectResult | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t('external_mail.debug_title')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('external_mail.debug_subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              {t('external_mail.debug_loading')}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          {data && (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold">{t('external_mail.debug_state')}</span>{' '}
                lastUid = <code className="bg-white px-1 rounded">{data.user.lastUid ?? 0}</code>,{' '}
                {t('external_mail.debug_last_sync')}{' '}
                {data.user.lastSyncAt ? formatDateTime(data.user.lastSyncAt) : t('external_mail.debug_no_sync')}
              </div>

              {data.folders.map((f) => {
                const items = data.recentByFolder[f.path] || [];
                return (
                  <div
                    key={f.path}
                    className="border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {f.path}
                      </span>
                      {f.specialUse && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">
                          {f.specialUse}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-500">
                        {t('external_mail.debug_folder_total', { count: f.exists ?? 0 })}
                        {typeof f.uidNext === 'number' && (
                          <> · UIDNEXT: {f.uidNext}</>
                        )}
                      </span>
                    </div>
                    {items.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400 italic">
                        {t('external_mail.debug_folder_empty')}
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {items.map((m) => (
                          <li key={m.uid} className="px-4 py-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-400 shrink-0">
                                #{m.uid}
                              </span>
                              <span className="font-mono text-slate-500 shrink-0">
                                {m.date}
                              </span>
                              <span
                                className={cn(
                                  'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                                  m.seen
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-amber-100 text-amber-700',
                                )}
                              >
                                {m.seen ? t('external_mail.debug_seen') : t('external_mail.debug_unseen')}
                              </span>
                              <span className="font-medium text-slate-700 truncate">
                                {m.from}
                              </span>
                            </div>
                            <div className="text-slate-500 ml-12 truncate mt-0.5">
                              {m.subject || t('common.no_subject')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
