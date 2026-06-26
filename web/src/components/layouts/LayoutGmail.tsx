import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Inbox,
  Send,
  Star,
  Trash2,
  Archive,
  Pencil,
  Users,
  Building2,
  Briefcase,
  LogOut,
  Bell,
  HelpCircle,
  Palette,
  LayoutGrid,
  Languages,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { HeaderSearch } from '../HeaderSearch';
import { AppSwitcher } from '../AppSwitcher';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';
import { FloatingChatWidget } from '../FloatingChatWidget';

function GmailNav({
  to,
  icon: Icon,
  label,
  badge,
  onClick,
  collapsed,
}: {
  to: string;
  icon: typeof Inbox;
  label: string;
  badge?: number;
  onClick?: (e: React.MouseEvent) => void;
  collapsed?: boolean;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      end
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-r-full text-sm transition-colors relative',
          collapsed ? 'justify-center py-2 px-2' : 'gap-4 pl-6 pr-4 py-1.5',
          isActive
            ? 'bg-brand-100 text-brand-800 font-bold'
            : 'text-slate-700 hover:bg-slate-100 font-medium',
        )
      }
    >
      <Icon size={18} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {badge !== undefined && badge > 0 && (
        collapsed
          ? <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>
          : <span className="text-xs font-bold">{badge}</span>
      )}
    </NavLink>
  );
}

export function LayoutGmail() {
  const { t } = useTranslation();
  const { user, unread, notification, handleLogout, handleInboxClick } = useLayoutData();
  const { openTheme, openDesign, openLanguage, modals } = useAppearanceModals();
  const location = useLocation();
  const composing = location.pathname.startsWith('/compose');

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Top search bar — Gmail style */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-4">
        <Link to="/inbox" className="flex items-center gap-2 font-semibold text-xl text-slate-700 px-2 min-w-[200px]">
          <Logo size={26} className="text-brand-700" />
          <span>Pochta</span>
        </Link>
        <AppSwitcher />
        <div className="flex-1 max-w-2xl">
          <HeaderSearch
            iconSize={18}
            iconClassName="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            inputClassName="w-full pl-12 pr-4 py-2.5 text-sm rounded-lg bg-slate-100 hover:bg-white hover:shadow focus:bg-white focus:shadow-md outline-none transition"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {notification && (
            <div className="flex items-center gap-2 bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full text-xs animate-pulse">
              <Bell size={14} />
              <span className="max-w-xs truncate">{notification}</span>
            </div>
          )}
          <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500" title={t('common.profile')}>
            <HelpCircle size={18} />
          </button>
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
        {/* Sidebar — Gmail style with rounded compose pill */}
        <aside className={cn(
          'flex flex-col py-3 overflow-y-auto transition-[width] duration-200',
          composing ? 'w-14 items-center pr-1' : 'w-64 pr-2',
        )}>
          <div className={cn('mb-4', composing ? 'px-1' : 'px-4')}>
            <Link
              to="/compose"
              title={composing ? t('nav.compose_short') : undefined}
              className={cn(
                'inline-flex items-center bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-2xl font-medium shadow-sm transition-colors',
                composing ? 'justify-center w-10 h-10 p-0' : 'gap-3 pl-4 pr-6 py-4',
              )}
            >
              <Pencil size={18} />
              {!composing && t('nav.compose_short')}
            </Link>
          </div>

          <nav className="flex flex-col gap-0.5">
            <GmailNav to="/inbox" icon={Inbox} label={t('nav.inbox')} badge={unread} onClick={handleInboxClick} collapsed={composing} />
            <GmailNav to="/starred" icon={Star} label={t('nav.starred')} collapsed={composing} />
            <GmailNav to="/sent" icon={Send} label={t('nav.sent')} collapsed={composing} />
            <GmailNav to="/archive" icon={Archive} label={t('nav.archive')} collapsed={composing} />
            <GmailNav to="/trash" icon={Trash2} label={t('nav.trash')} collapsed={composing} />
          </nav>

          {user.isAdmin && (
            <>
              {!composing && (
                <div className="mt-6 mb-2 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {t('nav.admin')}
                </div>
              )}
              {composing && <div className="mt-3 border-t border-slate-100 w-full" />}
              <nav className="flex flex-col gap-0.5">
                <GmailNav to="/admin/users" icon={Users} label={t('nav.users')} collapsed={composing} />
                <GmailNav to="/admin/departments" icon={Building2} label={t('nav.departments')} collapsed={composing} />
                <GmailNav to="/admin/positions" icon={Briefcase} label={t('nav.positions')} collapsed={composing} />
              </nav>
            </>
          )}

          {!composing && (
            <div className="mt-6 mb-2 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {t('common.settings')}
            </div>
          )}
          {composing && <div className="mt-3 border-t border-slate-100 w-full" />}
          <nav className="flex flex-col gap-0.5">
            <button
              onClick={openLanguage}
              title={composing ? t('common.language') : undefined}
              className={cn('flex items-center rounded-r-full text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left', composing ? 'justify-center py-2 px-2' : 'gap-4 pl-6 pr-4 py-1.5')}
            >
              <Languages size={18} />
              {!composing && <span className="flex-1">{t('common.language')}</span>}
            </button>
            <button
              onClick={openTheme}
              title={composing ? t('common.theme') : undefined}
              className={cn('flex items-center rounded-r-full text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left', composing ? 'justify-center py-2 px-2' : 'gap-4 pl-6 pr-4 py-1.5')}
            >
              <Palette size={18} />
              {!composing && <span className="flex-1">{t('common.theme')}</span>}
            </button>
            <button
              onClick={openDesign}
              title={composing ? t('common.design') : undefined}
              className={cn('flex items-center rounded-r-full text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left', composing ? 'justify-center py-2 px-2' : 'gap-4 pl-6 pr-4 py-1.5')}
            >
              <LayoutGrid size={18} />
              {!composing && <span className="flex-1">{t('common.design')}</span>}
            </button>
          </nav>
        </aside>

        <main className="flex-1 overflow-auto bg-white rounded-tl-2xl border-t border-l border-slate-200">
          <Outlet />
        </main>
      </div>
      <FloatingChatWidget />
      {modals}
    </div>
  );
}
