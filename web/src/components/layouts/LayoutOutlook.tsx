import { useEffect, useState } from 'react';
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
  Search,
  Palette,
  LayoutGrid,
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { Resizer } from '../Resizer';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';
import { MailboxOutlook } from '../../pages/mailbox/MailboxOutlook';
import type { MessageFolder } from '../../lib/types';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 400;
const LIST_MIN = 280;
const LIST_MAX = 720;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FOLDER_ROUTES: Record<string, { folder: MessageFolder; starred?: boolean }> = {
  '/inbox': { folder: 'inbox' },
  '/sent': { folder: 'sent' },
  '/starred': { folder: 'inbox', starred: true },
  '/archive': { folder: 'archive' },
  '/trash': { folder: 'trash' },
};

const ADMIN_ROUTES = ['/admin/users', '/admin/departments', '/admin/positions', '/profile', '/compose'];

function OutlookNav({
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
          'flex items-center gap-3 px-3 py-1.5 rounded text-sm transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-800 font-semibold border-l-4 border-brand-600 -ml-1 pl-2'
            : 'text-slate-700 hover:bg-slate-100',
        )
      }
    >
      <Icon size={16} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-semibold text-brand-700">{badge}</span>
      )}
    </NavLink>
  );
}

export function LayoutOutlook() {
  const { user, unread, notification, handleLogout, handleInboxClick } = useLayoutData();
  const { openTheme, openDesign, modals } = useAppearanceModals();
  const location = useLocation();

  const isAdminPage = ADMIN_ROUTES.some((p) => location.pathname.startsWith(p));
  const isMessageRoute = location.pathname.startsWith('/messages/');
  const folderRoute = FOLDER_ROUTES[location.pathname];

  const [lastFolder, setLastFolder] = useState<{ folder: MessageFolder; starred?: boolean }>(
    () => {
      const saved = sessionStorage.getItem('outlook_folder');
      return saved ? JSON.parse(saved) : { folder: 'inbox' };
    },
  );

  useEffect(() => {
    if (folderRoute) {
      setLastFolder(folderRoute);
      sessionStorage.setItem('outlook_folder', JSON.stringify(folderRoute));
    }
  }, [location.pathname]);

  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clamp(parseInt(localStorage.getItem('outlook_sidebar_w') || '208', 10), SIDEBAR_MIN, SIDEBAR_MAX),
  );
  const [listWidth, setListWidth] = useState(() =>
    clamp(parseInt(localStorage.getItem('outlook_list_w') || '384', 10), LIST_MIN, LIST_MAX),
  );

  useEffect(() => {
    localStorage.setItem('outlook_sidebar_w', String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(() => {
    localStorage.setItem('outlook_list_w', String(listWidth));
  }, [listWidth]);

  const showMailbox = !isAdminPage; // show list on folder routes and /messages/:id
  const activeMailbox = folderRoute || lastFolder;

  return (
    <div className="flex h-full flex-col bg-[#faf9f8]">
      <header className="h-12 bg-brand-700 text-white flex items-center px-4 gap-4">
        <Link to="/inbox" className="flex items-center gap-2 font-semibold text-sm">
          <Logo size={18} />
          Pochta
        </Link>
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-200" />
            <input
              type="search"
              placeholder="Qidirish"
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded bg-brand-600 placeholder:text-brand-200 text-white focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 outline-none transition"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {notification && (
            <div className="flex items-center gap-2 bg-brand-600 px-2 py-1 rounded text-xs animate-pulse">
              <Bell size={14} />
              <span className="max-w-[200px] truncate">{notification}</span>
            </div>
          )}
          <Link to="/profile" className="hover:bg-brand-600 px-2 py-1 rounded transition flex items-center gap-2">
            <Avatar fullName={user.fullName} avatarPath={user.avatarPath} size="sm" />
            <span className="text-xs hidden md:inline">{user.fullName}</span>
          </Link>
          <button onClick={handleLogout} className="text-brand-100 hover:text-white" title="Chiqish">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          style={{ width: sidebarWidth }}
          className="bg-white border-r border-slate-200 flex flex-col p-2 gap-0.5 overflow-y-auto flex-shrink-0"
        >
          <Link
            to="/compose"
            className="bg-brand-700 hover:bg-brand-800 text-white rounded py-2 px-3 mb-2 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Pencil size={14} />
            Yangi xabar
          </Link>

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 pt-2 pb-1">
            Papkalar
          </div>
          <OutlookNav to="/inbox" icon={Inbox} label="Kiruvchi" badge={unread} onClick={handleInboxClick} />
          <OutlookNav to="/starred" icon={Star} label="Yulduzli" />
          <OutlookNav to="/sent" icon={Send} label="Yuborilgan" />
          <OutlookNav to="/archive" icon={Archive} label="Arxiv" />
          <OutlookNav to="/trash" icon={Trash2} label="Savatcha" />

          {user.isAdmin && (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 pt-4 pb-1">
                Boshqaruv
              </div>
              <OutlookNav to="/admin/users" icon={Users} label="Xodimlar" />
              <OutlookNav to="/admin/departments" icon={Building2} label="Bo'limlar" />
              <OutlookNav to="/admin/positions" icon={Briefcase} label="Lavozimlar" />
            </>
          )}

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 pt-4 pb-1">
            Dizayn
          </div>
          <button
            onClick={openTheme}
            className="flex items-center gap-3 px-3 py-1.5 rounded text-sm text-slate-700 hover:bg-slate-100 transition-colors text-left"
          >
            <Palette size={16} />
            <span className="flex-1">Rang</span>
          </button>
          <button
            onClick={openDesign}
            className="flex items-center gap-3 px-3 py-1.5 rounded text-sm text-slate-700 hover:bg-slate-100 transition-colors text-left"
          >
            <LayoutGrid size={16} />
            <span className="flex-1">Ko'rinish</span>
          </button>
        </aside>

        <Resizer onResize={(d) => setSidebarWidth((w) => clamp(w + d, SIDEBAR_MIN, SIDEBAR_MAX))} />

        <main className="flex-1 overflow-hidden flex">
          {showMailbox && (
            <>
              <MailboxOutlook
                folder={activeMailbox.folder}
                starredOnly={activeMailbox.starred}
                width={listWidth}
              />
              <Resizer onResize={(d) => setListWidth((w) => clamp(w + d, LIST_MIN, LIST_MAX))} />
            </>
          )}
          <div className={cn(showMailbox && !isMessageRoute ? 'hidden' : 'flex-1 overflow-auto')}>
            <Outlet />
          </div>
          {showMailbox && !isMessageRoute && (
            <div className="flex-1 flex items-center justify-center text-slate-400 bg-[#faf9f8]">
              <div className="text-center">
                <Inbox size={64} className="mx-auto mb-3 text-slate-200" />
                <div className="text-sm">O'qish uchun xabar tanlang</div>
              </div>
            </div>
          )}
        </main>
      </div>
      {modals}
    </div>
  );
}
