import { Link, NavLink, Outlet } from 'react-router-dom';
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
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';

function YandexNav({
  to,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  to: string;
  icon: typeof Inbox;
  label: string;
  badge?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      end
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 py-1.5 rounded text-sm transition-colors',
          isActive ? 'bg-brand-600 text-white font-semibold' : 'text-slate-800 hover:bg-yellow-50',
        )
      }
    >
      <Icon size={15} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'text-xs font-bold',
          )}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export function LayoutYandex() {
  const { user, unread, notification, handleLogout, handleInboxClick } = useLayoutData();
  const { openTheme, openDesign, modals } = useAppearanceModals();

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Compact top bar — Yandex style */}
      <header className="h-11 bg-white border-b border-slate-200 flex items-center px-4 gap-3 text-sm">
        <Link to="/inbox" className="flex items-center gap-1.5 font-bold text-slate-900">
          <Logo size={18} className="text-brand-600" />
          Pochta
        </Link>
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
          title="Chiqish"
        >
          <LogOut size={15} />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Narrow sidebar */}
        <aside className="w-48 bg-slate-50 border-r border-slate-200 flex flex-col p-2 gap-0.5 overflow-y-auto">
          <Link
            to="/compose"
            className="bg-brand-600 hover:bg-brand-700 text-white rounded py-2 px-3 mb-2 flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
          >
            <Pencil size={14} />
            Yozish
          </Link>

          <YandexNav to="/inbox" icon={Inbox} label="Kiruvchi" badge={unread} onClick={handleInboxClick} />
          <YandexNav to="/sent" icon={Send} label="Yuborilgan" />
          <YandexNav to="/starred" icon={Star} label="Yulduzli" />
          <YandexNav to="/archive" icon={Archive} label="Arxiv" />
          <YandexNav to="/trash" icon={Trash2} label="O'chirilgan" />

          {user.isAdmin && (
            <>
              <div className="mt-4 mb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Boshqaruv
              </div>
              <YandexNav to="/admin/users" icon={Users} label="Xodimlar" />
              <YandexNav to="/admin/departments" icon={Building2} label="Bo'limlar" />
              <YandexNav to="/admin/positions" icon={Briefcase} label="Lavozimlar" />
            </>
          )}

          <div className="mt-4 mb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Dizayn
          </div>
          <button
            onClick={openTheme}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded text-sm text-slate-800 hover:bg-yellow-50 transition-colors text-left"
          >
            <Palette size={15} />
            <span className="flex-1">Rang</span>
          </button>
          <button
            onClick={openDesign}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded text-sm text-slate-800 hover:bg-yellow-50 transition-colors text-left"
          >
            <LayoutGrid size={15} />
            <span className="flex-1">Ko'rinish</span>
          </button>
        </aside>

        <main className="flex-1 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
      {modals}
    </div>
  );
}
