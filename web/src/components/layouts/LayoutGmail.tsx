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
  Search,
  HelpCircle,
  Palette,
  LayoutGrid,
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';

function GmailNav({
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
          'flex items-center gap-4 pl-6 pr-4 py-1.5 rounded-r-full text-sm transition-colors',
          isActive
            ? 'bg-brand-100 text-brand-800 font-bold'
            : 'text-slate-700 hover:bg-slate-100 font-medium',
        )
      }
    >
      <Icon size={18} />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-bold">{badge}</span>
      )}
    </NavLink>
  );
}

export function LayoutGmail() {
  const { user, unread, notification, handleLogout, handleInboxClick } = useLayoutData();
  const { openTheme, openDesign, modals } = useAppearanceModals();

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Top search bar — Gmail style */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-4">
        <Link to="/inbox" className="flex items-center gap-2 font-semibold text-xl text-slate-700 px-2 min-w-[200px]">
          <Logo size={26} className="text-brand-700" />
          <span>Pochta</span>
        </Link>
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Pochtada qidirish"
              className="w-full pl-12 pr-4 py-2.5 text-sm rounded-lg bg-slate-100 hover:bg-white hover:shadow focus:bg-white focus:shadow-md outline-none transition"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {notification && (
            <div className="flex items-center gap-2 bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full text-xs animate-pulse">
              <Bell size={14} />
              <span className="max-w-xs truncate">{notification}</span>
            </div>
          )}
          <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500" title="Yordam">
            <HelpCircle size={18} />
          </button>
          <Link to="/profile" className="rounded-full hover:ring-2 hover:ring-brand-200" title={user.fullName}>
            <Avatar fullName={user.fullName} avatarPath={user.avatarPath} size="sm" />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
            title="Chiqish"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — Gmail style with rounded compose pill */}
        <aside className="w-64 flex flex-col py-3 pr-2 overflow-y-auto">
          <div className="px-4 mb-4">
            <Link
              to="/compose"
              className="inline-flex items-center gap-3 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-2xl pl-4 pr-6 py-4 font-medium shadow-sm transition-colors"
            >
              <Pencil size={18} />
              Yozish
            </Link>
          </div>

          <nav className="flex flex-col gap-0.5">
            <GmailNav to="/inbox" icon={Inbox} label="Kiruvchi" badge={unread} onClick={handleInboxClick} />
            <GmailNav to="/starred" icon={Star} label="Yulduzli" />
            <GmailNav to="/sent" icon={Send} label="Yuborilgan" />
            <GmailNav to="/archive" icon={Archive} label="Arxiv" />
            <GmailNav to="/trash" icon={Trash2} label="Savatcha" />
          </nav>

          {user.isAdmin && (
            <>
              <div className="mt-6 mb-2 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Boshqaruv
              </div>
              <nav className="flex flex-col gap-0.5">
                <GmailNav to="/admin/users" icon={Users} label="Xodimlar" />
                <GmailNav to="/admin/departments" icon={Building2} label="Bo'limlar" />
                <GmailNav to="/admin/positions" icon={Briefcase} label="Lavozimlar" />
              </nav>
            </>
          )}

          <div className="mt-6 mb-2 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Dizayn
          </div>
          <nav className="flex flex-col gap-0.5">
            <button
              onClick={openTheme}
              className="flex items-center gap-4 pl-6 pr-4 py-1.5 rounded-r-full text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              <Palette size={18} />
              <span className="flex-1">Rang</span>
            </button>
            <button
              onClick={openDesign}
              className="flex items-center gap-4 pl-6 pr-4 py-1.5 rounded-r-full text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              <LayoutGrid size={18} />
              <span className="flex-1">Ko'rinish</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 overflow-auto bg-white rounded-tl-2xl border-t border-l border-slate-200">
          <Outlet />
        </main>
      </div>
      {modals}
    </div>
  );
}
