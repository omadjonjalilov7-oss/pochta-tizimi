import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FilePlus, FileText, ListTodo, Inbox, Send, ScrollText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * EDO bosh sahifasi — foydalanuvchi kirgan birinchi sahifa.
 * Sprint 1+ da bu yerda real "Mening hujjatlarim" jadvali bo'ladi.
 */
export function EdoHomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const tiles: Array<{ to: string; icon: typeof FilePlus; titleKey: string; descKey: string }> = [
    { to: '/edo/compose', icon: FilePlus, titleKey: 'edo.tiles.new_doc', descKey: 'edo.tiles.new_doc_desc' },
    { to: '/edo/tasks', icon: ListTodo, titleKey: 'edo.tiles.tasks', descKey: 'edo.tiles.tasks_desc' },
    { to: '/edo/incoming', icon: Inbox, titleKey: 'edo.tiles.incoming', descKey: 'edo.tiles.incoming_desc' },
    { to: '/edo/outgoing', icon: Send, titleKey: 'edo.tiles.outgoing', descKey: 'edo.tiles.outgoing_desc' },
    { to: '/edo/drafts', icon: ScrollText, titleKey: 'edo.tiles.drafts', descKey: 'edo.tiles.drafts_desc' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t('edo.home.greeting', { name: user?.fullName?.split(' ')[0] || '' })}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('edo.home.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-300 hover:shadow-md transition"
          >
            <div className="bg-brand-50 text-brand-600 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-brand-100">
              <tile.icon size={20} />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{t(tile.titleKey)}</h3>
            <p className="text-xs text-slate-500">{t(tile.descKey)}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <h3 className="font-semibold text-amber-900 mb-1 flex items-center gap-2">
          <FileText size={16} />
          {t('edo.home.dev_notice_title')}
        </h3>
        <p className="text-sm text-amber-800">{t('edo.home.dev_notice_body')}</p>
      </div>
    </div>
  );
}
