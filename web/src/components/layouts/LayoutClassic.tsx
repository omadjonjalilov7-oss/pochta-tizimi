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

function NavItem({
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
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-600 text-white'
            : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700',
        )
      }
    >
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-white text-brand-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export function LayoutClassic() {
  const { user, unread, notification, handleLogout, handleInboxClick } = useLayoutData();
  const { openTheme, openDesign, modals } = useAppearanceModals();

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="h-14 bg-brand-700 text-white flex items-center justify-between px-6 shadow-sm">
        <Link to="/inbox" className="flex items-center gap-2 font-semibold text-lg">
          <Logo size={22} />
          Pochta
        </Link>
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
            title="Chiqish"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-60 bg-white border-r border-slate-200 flex flex-col p-4 gap-1 overflow-y-auto">
          <Link
            to="/compose"
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2.5 px-4 mb-3 flex items-center justify-center gap-2 font-medium shadow-sm transition-colors"
          >
            <Pencil size={16} />
            Yangi xabar
          </Link>

          <NavItem to="/inbox" icon={Inbox} label="Kiruvchi" badge={unread} onClick={handleInboxClick} />
          <NavItem to="/sent" icon={Send} label="Yuborilgan" />
          <NavItem to="/starred" icon={Star} label="Yulduzli" />
          <NavItem to="/archive" icon={Archive} label="Arxiv" />
          <NavItem to="/trash" icon={Trash2} label="Savatcha" />

          {user.isAdmin && (
            <>
              <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Administrator
              </div>
              <NavItem to="/admin/users" icon={Users} label="Xodimlar" />
              <NavItem to="/admin/departments" icon={Building2} label="Bo'limlar" />
              <NavItem to="/admin/positions" icon={Briefcase} label="Lavozimlar" />
            </>
          )}

          <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Dizayn
          </div>
          <button
            onClick={openTheme}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left"
          >
            <Palette size={18} />
            <span className="flex-1">Rang</span>
          </button>
          <button
            onClick={openDesign}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left"
          >
            <LayoutGrid size={18} />
            <span className="flex-1">Ko'rinish</span>
          </button>
        </aside>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      {modals}
    </div>
  );
}
