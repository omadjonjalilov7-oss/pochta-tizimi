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
  Palette,
  LayoutGrid,
  Languages,
  Menu,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { Resizer } from '../Resizer';
import { HeaderSearch } from '../HeaderSearch';
import { AppSwitcher } from '../AppSwitcher';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';
import { FloatingChatWidget } from '../FloatingChatWidget';
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
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm border transition-all duration-150',
          isActive
            ? 'bg-gradient-to-r from-brand-50 to-white text-brand-800 font-semibold border-brand-200 shadow-sm'
            : 'text-slate-700 bg-white border-slate-200/70 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-px',
        )
      }
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-bold bg-brand-600 text-white rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export function LayoutOutlook() {
  const { t } = useTranslation();
  const { user, unread, notification, handleLogout, handleInboxClick } = useLayoutData();
  const { openTheme, openDesign, openLanguage, modals } = useAppearanceModals();
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

  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => setMobileNav(false), [location.pathname]);

  return (
    <div className="flex h-full flex-col bg-[#faf9f8]">
      <header className="h-12 bg-brand-700 text-white flex items-center px-3 md:px-4 gap-2 md:gap-4">
        <button
          onClick={() => setMobileNav((v) => !v)}
          className="md:hidden p-1.5 -ml-1 rounded hover:bg-brand-600"
          aria-label="Menu"
        >
          {mobileNav ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link to="/inbox" className="flex items-center gap-2 font-semibold text-sm">
          <Logo size={18} />
          Pochta
        </Link>
        <AppSwitcher className="bg-brand-600 mr-3" />
        <div className="flex-1 max-w-xl mx-auto">
          <HeaderSearch
            iconSize={14}
            iconClassName="absolute left-3 top-1/2 -translate-y-1/2 text-brand-200 pointer-events-none"
            inputClassName="w-full pl-9 pr-3 py-1.5 text-sm rounded bg-brand-600 placeholder:text-brand-200 text-white focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 outline-none transition"
            placeholder={t('common.search')}
          />
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
          <button onClick={handleLogout} className="text-brand-100 hover:text-white" title={t('common.logout')}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {mobileNav && (
          <div
            className="md:hidden fixed inset-x-0 bottom-0 top-12 z-30 bg-black/40"
            onClick={() => setMobileNav(false)}
          />
        )}
        <aside
          style={{ width: sidebarWidth }}
          className={cn(
            'bg-slate-50 border-r border-slate-200 flex flex-col p-3 gap-1.5 overflow-y-auto',
            'fixed top-12 bottom-0 left-0 z-40 max-w-[80vw] shadow-2xl transition-transform duration-200',
            mobileNav ? 'translate-x-0' : '-translate-x-full',
            'md:static md:top-auto md:bottom-auto md:z-auto md:max-w-none md:shadow-none md:translate-x-0 md:flex-shrink-0',
          )}
        >
          <Link
            to="/compose"
            className="bg-gradient-to-b from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white rounded-lg py-2.5 px-3 mb-2 flex items-center gap-2 text-sm font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Pencil size={14} />
            {t('nav.compose')}
          </Link>

          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-2 pb-1 border-t border-slate-200 mt-1">
            {t('nav.folders')}
          </div>
          <OutlookNav to="/inbox" icon={Inbox} label={t('nav.inbox')} badge={unread} onClick={handleInboxClick} />
          <OutlookNav to="/starred" icon={Star} label={t('nav.starred')} />
          <OutlookNav to="/sent" icon={Send} label={t('nav.sent')} />
          <OutlookNav to="/archive" icon={Archive} label={t('nav.archive')} />
          <OutlookNav to="/trash" icon={Trash2} label={t('nav.trash')} />

          {user.role === 'admin' && (
            <>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-3 pb-1 border-t border-slate-200 mt-2">
                {t('nav.admin')}
              </div>
              <OutlookNav to="/admin/users" icon={Users} label={t('nav.users')} />
              <OutlookNav to="/admin/departments" icon={Building2} label={t('nav.departments')} />
              <OutlookNav to="/admin/positions" icon={Briefcase} label={t('nav.positions')} />
            </>
          )}

          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-3 pb-1 border-t border-slate-200 mt-2">
            {t('common.settings')}
          </div>
          <button
            onClick={openLanguage}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 bg-white border border-slate-200/70 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-px transition-all duration-150 text-left"
          >
            <Languages size={16} className="flex-shrink-0" />
            <span className="flex-1">{t('common.language')}</span>
          </button>
          <button
            onClick={openTheme}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 bg-white border border-slate-200/70 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-px transition-all duration-150 text-left"
          >
            <Palette size={16} className="flex-shrink-0" />
            <span className="flex-1">{t('common.theme')}</span>
          </button>
          <button
            onClick={openDesign}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 bg-white border border-slate-200/70 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-px transition-all duration-150 text-left"
          >
            <LayoutGrid size={16} />
            <span className="flex-1">{t('common.design')}</span>
          </button>
        </aside>

        <div className="hidden md:block">
          <Resizer onResize={(d) => setSidebarWidth((w) => clamp(w + d, SIDEBAR_MIN, SIDEBAR_MAX))} />
        </div>

        <main className="flex-1 overflow-hidden flex">
          {showMailbox && (
            <>
              <MailboxOutlook
                folder={activeMailbox.folder}
                starredOnly={activeMailbox.starred}
                width={listWidth}
                className={cn('max-md:!w-full', isMessageRoute && 'max-md:hidden')}
              />
              <div className="hidden md:block">
                <Resizer onResize={(d) => setListWidth((w) => clamp(w + d, LIST_MIN, LIST_MAX))} />
              </div>
            </>
          )}
          <div className={cn(showMailbox && !isMessageRoute ? 'hidden md:block md:flex-1 md:overflow-auto' : 'flex-1 overflow-auto')}>
            <Outlet />
          </div>
          {showMailbox && !isMessageRoute && (
            <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 bg-[#faf9f8]">
              <div className="text-center">
                <Inbox size={64} className="mx-auto mb-3 text-slate-200" />
                <div className="text-sm">{t('mailbox.no_selection')}</div>
              </div>
            </div>
          )}
        </main>
      </div>
      <FloatingChatWidget />
      {modals}
    </div>
  );
}
