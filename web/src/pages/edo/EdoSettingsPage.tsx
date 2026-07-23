import { type FormEvent, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export function EdoSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [days, setDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['document-defaults'],
    queryFn: async () =>
      (
        await api.get<{ internalDeadlineDays: number | null }>('/settings/document-defaults')
      ).data,
  });

  useEffect(() => {
    if (data) setDays(data.internalDeadlineDays != null ? String(data.internalDeadlineDays) : '');
  }, [data]);

  if (user?.role !== 'admin') {
    return <div className="p-8 text-slate-400">{t('admin.admin_only')}</div>;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setSaving(true);
    try {
      const trimmed = days.trim();
      const value = trimmed === '' ? null : parseInt(trimmed, 10);
      await api.patch('/settings/document-defaults', { internalDeadlineDays: value });
      queryClient.invalidateQueries({ queryKey: ['document-defaults'] });
      setSavedMsg(t('edo.settings.saved'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('admin.error_save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h1 className="text-xl font-semibold text-slate-900">{t('edo.settings.title')}</h1>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('edo.settings.internal_deadline_label')}
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder={t('edo.settings.internal_deadline_placeholder')}
                className="w-40 px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                {t('edo.settings.internal_deadline_hint')}
              </p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {savedMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
                {savedMsg}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg"
              >
                <Save size={16} />
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
