import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function EdoSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <div className="p-8 text-slate-400">{t('admin.admin_only')}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h1 className="text-xl font-semibold text-slate-900">{t('edo.settings.title')}</h1>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600">
            <Info size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <p>{t('edo.settings.no_settings')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
