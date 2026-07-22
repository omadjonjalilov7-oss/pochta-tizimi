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
  Palette,
  LayoutGrid,
  Languages,
  Tag,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { AppSwitcher } from '../AppSwitcher';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';
import { FloatingChatWidget } from '../FloatingChatWidget';

function NavItem({
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
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-lg text-sm font-medium transition-colors relative',
          collapsed ? 'justify-center p-2' : 'gap-3 px-4 py-2.5',
          isActive
            ? 'bg-brand-600 text-white'
            : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700',
        )
      }
    >
      <Icon size={18} />
      {!collapsed && <span className="flex-1">{label}</span>}
      {badge !== undefined && badge > 0 && (
        collapsed
          ? <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>
          : <span className="ml-auto bg-white text-brand-700 text-xs font-semibold px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </NavLink>
  );
}

export function LayoutClassic() {
  const { t } = useTranslation();
  const { user, unread, notification, handleLogout, handleInboxClick } = useLayoutData();
  const { openTheme, openDesign, openLanguage, modals } = useAppearanceModals();
  const location = useLocation();
  const composing = location.pathname.startsWith('/compose');

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="h-14 bg-brand-700 text-white flex items-center justify-between px-6 shadow-sm">
        <Link to="/inbox" className="flex items-center gap-2 font-semibold text-lg">
          <Logo size={22} />
          Pochta
        </Link>
        <AppSwitcher className="bg-brand-600/40" />
        <div className="flex items-center gap-4">
          {notification && (
            <div className="flex items-center gap-2 bg-brand-600 px-3 py-1.5 rounded-lg text-sm animate-pulse">
              <Bell size={16} />
              <span className="max-w-xs truncate">{notification}</span>
            </div>
          )}
          <Link
            to="/profile"
            className="flex items-center gap-2 hover:bg-brand-600 px-2 py-1 rounded-lg transition-colors"
          >
            <Avatar fullName={user.fullName} avatarPath={user.avatarPath} size="sm" />
            <div className="text-sm leading-tight">
              <div className="font-medium">{user.fullName}</div>
              <div className="text-xs text-brand-100">
                {user.position?.name || user.login}
              </div>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-brand-100 hover:text-white"
            title={t('common.logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className={cn(
          'bg-white border-r border-slate-200 flex flex-col p-3 gap-1 overflow-y-auto transition-[width] duration-200',
          composing ? 'w-[56px] items-center' : 'w-60',
        )}>
          <Link
            to="/compose"
            title={composing ? t('nav.compose') : undefined}
            className={cn(
              'bg-brand-600 hover:bg-brand-700 text-white rounded-lg mb-3 flex items-center justify-center font-medium shadow-sm transition-colors',
              composing ? 'w-9 h-9 p-0' : 'py-2.5 px-4 gap-2 w-full',
            )}
          >
            <Pencil size={16} />
            {!composing && t('nav.compose')}
          </Link>

          <NavItem to="/inbox" icon={Inbox} label={t('nav.inbox')} badge={unread} onClick={handleInboxClick} collapsed={composing} />
          <NavItem to="/contact-groups" icon={Tag} label="Guruhlar" collapsed={composing} />
          <NavItem to="/sent" icon={Send} label={t('nav.sent')} collapsed={composing} />
          <NavItem to="/starred" icon={Star} label={t('nav.starred')} collapsed={composing} />
          <NavItem to="/archive" icon={Archive} label={t('nav.archive')} collapsed={composing} />
          <NavItem to="/trash" icon={Trash2} label={t('nav.trash')} collapsed={composing} />

          {user.role === 'admin' && (
            <>
              {!composing && (
                <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {t('nav.admin')}
                </div>
              )}
              {composing && <div className="mt-3 border-t border-slate-100 w-full" />}
              <NavItem to="/admin/users" icon={Users} label={t('nav.users')} collapsed={composing} />
              <NavItem to="/admin/departments" icon={Building2} label={t('nav.departments')} collapsed={composing} />
              <NavItem to="/admin/positions" icon={Briefcase} label={t('nav.positions')} collapsed={composing} />
            </>
          )}

          {!composing && (
            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {t('common.settings')}
            </div>
          )}
          {composing && <div className="mt-3 border-t border-slate-100 w-full" />}
          <button
            onClick={openLanguage}
            title={composing ? t('common.language') : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left',
              composing ? 'justify-center p-2' : 'gap-3 px-4 py-2.5',
            )}
          >
            <Languages size={18} />
            {!composing && <span className="flex-1">{t('common.language')}</span>}
          </button>
          <button
            onClick={openTheme}
            title={composing ? t('common.theme') : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left',
              composing ? 'justify-center p-2' : 'gap-3 px-4 py-2.5',
            )}
          >
            <Palette size={18} />
            {!composing && <span className="flex-1">{t('common.theme')}</span>}
          </button>
          <button
            onClick={openDesign}
            title={composing ? t('common.design') : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left',
              composing ? 'justify-center p-2' : 'gap-3 px-4 py-2.5',
            )}
          >
            <LayoutGrid size={18} />
            {!composing && <span className="flex-1">{t('common.design')}</span>}
          </button>
        </aside>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <FloatingChatWidget />
      {modals}
    </div>
  );
}
