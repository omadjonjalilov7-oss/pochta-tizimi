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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { AppSwitcher } from '../AppSwitcher';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';
import { FloatingChatWidget } from '../FloatingChatWidget';

function YandexNav({
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
          'flex items-center rounded text-sm transition-colors relative',
          collapsed ? 'justify-center p-1.5' : 'gap-2.5 px-3 py-1.5',
          isActive ? 'bg-brand-600 text-white font-semibold' : 'text-slate-800 hover:bg-yellow-50',
        )
      }
    >
      <Icon size={15} />
      {!collapsed && <span className="flex-1">{label}</span>}
      {badge !== undefined && badge > 0 && (
        collapsed
          ? <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>
          : <span className="text-xs font-bold">{badge}</span>
      )}
    </NavLink>
  );
}

export function LayoutYandex() {
  const { t } = useTranslation();
  const { user, unread, notification, handleLogout, handleInboxClick } = useLayoutData();
  const { openTheme, openDesign, openLanguage, modals } = useAppearanceModals();
  const location = useLocation();
  const composing = location.pathname.startsWith('/compose');

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Compact top bar — Yandex style */}
      <header className="h-11 bg-white border-b border-slate-200 flex items-center px-4 gap-3 text-sm">
        <Link to="/inbox" className="flex items-center gap-1.5 font-bold text-slate-900">
          <Logo size={18} className="text-brand-600" />
          Pochta
        </Link>
        <AppSwitcher />
        <div className="flex-1" />
        {notification && (
          <div className="flex items-center gap-2 bg-yellow-100 text-yellow-900 px-2 py-1 rounded text-xs animate-pulse">
            <Bell size={12} />
            <span className="max-w-[220px] truncate">{notification}</span>
          </div>
        )}
        <Link to="/profile" className="flex items-center gap-2 hover:bg-slate-100 px-2 py-1 rounded transition">
          <Avatar fullName={user.fullName} avatarPath={user.avatarPath} size="sm" />
          <span className="text-xs font-medium hidden md:inline">{user.fullName}</span>
        </Link>
        <button
          onClick={handleLogout}
          className="text-slate-500 hover:text-slate-900 p-1"
          title={t('common.logout')}
        >
          <LogOut size={15} />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Narrow sidebar */}
        <aside className={cn(
          'bg-slate-50 border-r border-slate-200 flex flex-col p-2 gap-0.5 overflow-y-auto transition-[width] duration-200',
          composing ? 'w-12 items-center' : 'w-48',
        )}>
          <Link
            to="/compose"
            title={composing ? t('nav.compose_short') : undefined}
            className={cn(
              'bg-brand-600 hover:bg-brand-700 text-white rounded mb-2 flex items-center justify-center text-sm font-semibold transition-colors',
              composing ? 'w-8 h-8 p-0' : 'py-2 px-3 gap-2',
            )}
          >
            <Pencil size={14} />
            {!composing && t('nav.compose_short')}
          </Link>

          <YandexNav to="/inbox" icon={Inbox} label={t('nav.inbox')} badge={unread} onClick={handleInboxClick} collapsed={composing} />
          <YandexNav to="/sent" icon={Send} label={t('nav.sent')} collapsed={composing} />
          <YandexNav to="/starred" icon={Star} label={t('nav.starred')} collapsed={composing} />
          <YandexNav to="/archive" icon={Archive} label={t('nav.archive')} collapsed={composing} />
          <YandexNav to="/trash" icon={Trash2} label={t('nav.trash')} collapsed={composing} />

          {user.role === 'admin' && (
            <>
              {!composing && <div className="mt-4 mb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('nav.admin')}</div>}
              {composing && <div className="mt-2 border-t border-slate-200 w-full" />}
              <YandexNav to="/admin/users" icon={Users} label={t('nav.users')} collapsed={composing} />
              <YandexNav to="/admin/departments" icon={Building2} label={t('nav.departments')} collapsed={composing} />
              <YandexNav to="/admin/positions" icon={Briefcase} label={t('nav.positions')} collapsed={composing} />
            </>
          )}

          {!composing && <div className="mt-4 mb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('common.settings')}</div>}
          {composing && <div className="mt-2 border-t border-slate-200 w-full" />}
          <button onClick={openLanguage} title={composing ? t('common.language') : undefined}
            className={cn('flex items-center rounded text-sm text-slate-800 hover:bg-yellow-50 transition-colors text-left', composing ? 'justify-center p-1.5' : 'gap-2.5 px-3 py-1.5')}>
            <Languages size={15} />
            {!composing && <span className="flex-1">{t('common.language')}</span>}
          </button>
          <button onClick={openTheme} title={composing ? t('common.theme') : undefined}
            className={cn('flex items-center rounded text-sm text-slate-800 hover:bg-yellow-50 transition-colors text-left', composing ? 'justify-center p-1.5' : 'gap-2.5 px-3 py-1.5')}>
            <Palette size={15} />
            {!composing && <span className="flex-1">{t('common.theme')}</span>}
          </button>
          <button onClick={openDesign} title={composing ? t('common.design') : undefined}
            className={cn('flex items-center rounded text-sm text-slate-800 hover:bg-yellow-50 transition-colors text-left', composing ? 'justify-center p-1.5' : 'gap-2.5 px-3 py-1.5')}>
            <LayoutGrid size={15} />
            {!composing && <span className="flex-1">{t('common.design')}</span>}
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
