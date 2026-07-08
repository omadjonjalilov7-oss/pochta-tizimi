import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FileText,
  Inbox,
  Send,
  FilePlus,
  ListTodo,
  FileSearch,
  LogOut,
  Bell,
  Palette,
  LayoutGrid,
  Languages,
  ScrollText,
  FileSignature,
  Files,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { AppSwitcher } from '../AppSwitcher';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';
import { FloatingChatWidget } from '../FloatingChatWidget';

function EdoNav({
  to,
  icon: Icon,
  label,
  end,
  collapsed,
}: {
  to: string;
  icon: typeof Inbox;
  label: string;
  end?: boolean;
  collapsed?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5',
          isActive
            ? 'bg-brand-600 text-white'
            : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700',
        )
      }
    >
      <Icon size={18} />
      {!collapsed && <span className="flex-1">{label}</span>}
    </NavLink>
  );
}

export function LayoutEdo() {
  const { t } = useTranslation();
  const { user, notification, handleLogout } = useLayoutData();
  const { openTheme, openDesign, openLanguage, modals } = useAppearanceModals();
  const location = useLocation();
  // Yangi hujjat oynasida sidebar avtomatik kichrayadi (faqat ikonkalar)
  const collapsed = location.pathname.startsWith('/edo/compose');

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-4">
        <Link to="/edo" className="flex items-center gap-2 font-semibold text-xl text-slate-700 px-2 min-w-[220px]">
          <Logo size={26} className="text-brand-700" />
          <div className="flex flex-col leading-tight">
            <span className="text-base">{t('edo.app_name')}</span>
            <span className="text-xs font-normal text-slate-500">{t('edo.app_tagline')}</span>
          </div>
        </Link>
        <AppSwitcher className="ml-2" />
        <div className="flex items-center gap-2 ml-auto">
          {notification && (
            <div className="flex items-center gap-2 bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full text-xs animate-pulse">
              <Bell size={14} />
              <span className="max-w-xs truncate">{notification}</span>
            </div>
          )}
          <Link to="/profile" className="rounded-full hover:ring-2 hover:ring-brand-200" title={user.fullName}>
            <Avatar fullName={user.fullName} avatarPath={user.avatarPath} size="sm" />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
            title={t('common.logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={cn(
            'bg-white border-r border-slate-200 flex flex-col p-4 gap-1 overflow-y-auto transition-[width] duration-200',
            collapsed ? 'w-[68px]' : 'w-64',
          )}
        >
          <Link
            to="/edo/compose"
            title={collapsed ? t('edo.nav.compose') : undefined}
            className={cn(
              'bg-brand-600 hover:bg-brand-700 text-white rounded-lg mb-3 flex items-center justify-center font-medium shadow-sm transition-colors',
              collapsed ? 'p-2.5' : 'py-2.5 px-4 gap-2',
            )}
          >
            <FilePlus size={16} />
            {!collapsed && t('edo.nav.compose')}
          </Link>

          <EdoNav to="/edo" end icon={FileText} label={t('edo.nav.my_documents')} collapsed={collapsed} />
          <EdoNav to="/edo/approval" icon={CheckCircle2} label={t('edo.nav.approval') || 'Tasdiqlash'} collapsed={collapsed} />
          <EdoNav to="/edo/tasks" icon={ListTodo} label={t('edo.nav.tasks')} collapsed={collapsed} />
          <EdoNav to="/edo/incoming" icon={Inbox} label={t('edo.nav.incoming')} collapsed={collapsed} />
          <EdoNav to="/edo/outgoing" icon={Send} label={t('edo.nav.outgoing')} collapsed={collapsed} />
          <EdoNav to="/edo/drafts" icon={ScrollText} label={t('edo.nav.drafts')} collapsed={collapsed} />
          <EdoNav to="/edo/archive" icon={FileSearch} label={t('edo.nav.archive')} collapsed={collapsed} />

          {user.canSignExternal && (
            <>
              {!collapsed && (
                <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {t('edo.nav.signing')}
                </div>
              )}
              {collapsed && <div className="mt-4 border-t border-slate-100" />}
              <EdoNav to="/edo/signing" icon={FileSignature} label={t('edo.nav.to_sign')} collapsed={collapsed} />
            </>
          )}

          {!collapsed ? (
            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {t('edo.nav.tools')}
            </div>
          ) : (
            <div className="mt-4 border-t border-slate-100" />
          )}
          <EdoNav to="/edo/templates" icon={Files} label={t('edo.nav.templates')} collapsed={collapsed} />
          <EdoNav to="/edo/reports" icon={BarChart3} label={t('edo.nav.reports')} collapsed={collapsed} />

          {!collapsed ? (
            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {t('common.settings')}
            </div>
          ) : (
            <div className="mt-4 border-t border-slate-100" />
          )}
          <button
            onClick={openLanguage}
            title={collapsed ? t('common.language') : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5',
            )}
          >
            <Languages size={18} />
            {!collapsed && <span className="flex-1">{t('common.language')}</span>}
          </button>
          <button
            onClick={openTheme}
            title={collapsed ? t('common.theme') : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5',
            )}
          >
            <Palette size={18} />
            {!collapsed && <span className="flex-1">{t('common.theme')}</span>}
          </button>
          <button
            onClick={openDesign}
            title={collapsed ? t('common.design') : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5',
            )}
          >
            <LayoutGrid size={18} />
            {!collapsed && <span className="flex-1">{t('common.design')}</span>}
          </button>
        </aside>

        <main className="flex-1 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
      <FloatingChatWidget />
      {modals}
    </div>
  );
}
