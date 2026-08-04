import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Home,
  FileText,
  FolderInput,
  Inbox,
  Send,
  FilePlus,
  FileSearch,
  LogOut,
  Bell,
  Palette,
  LayoutGrid,
  Languages,
  FileSignature,
  Files,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  CheckCircle2,
  ClipboardCheck,
  CalendarDays,
  MessagesSquare,
  ShieldCheck,
  Building2,
  SquarePen,
  Handshake,
  ChevronsUp,
  ChevronsDown,
  ChevronDown,
  Users,
  Search,
  Settings,
  BookText,
  Menu,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../Avatar';
import { AsakaLogo } from '../AsakaLogo';
import { AppSwitcher } from '../AppSwitcher';
import { cn } from '../../lib/utils';
import { useLayoutData } from './useLayoutData';
import { useAppearanceModals } from '../AppearanceModals';
import { FloatingChatWidget } from '../FloatingChatWidget';

function TopNav({ to, icon: Icon, label }: { to: string; icon: typeof Inbox; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-asaka-50 text-asaka-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <Icon size={16} />
      <span>{label}</span>
    </NavLink>
  );
}

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
            ? 'bg-asaka-600 text-white shadow-sm'
            : 'text-slate-300 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon size={18} />
      {!collapsed && <span className="flex-1">{label}</span>}
    </NavLink>
  );
}

function EdoNavGroup({
  icon: Icon,
  label,
  basePath,
  items,
  collapsed,
}: {
  icon: typeof Inbox;
  label: string;
  basePath: string;
  items: { to: string; icon: typeof Inbox; label: string }[];
  collapsed?: boolean;
}) {
  const location = useLocation();
  const childActive = location.pathname.startsWith(basePath);
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (collapsed) {
    return <EdoNav to={`${basePath}/overview`} icon={Icon} label={label} collapsed />;
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
          childActive ? 'text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
        )}
      >
        <Icon size={18} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-1 ml-3 pl-3 border-l border-white/10 flex flex-col gap-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-asaka-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <it.icon size={15} />
              <span className="flex-1">{it.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function NewDocButton({ collapsed, showIncoming }: { collapsed?: boolean; showIncoming?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const go = (type: 'outgoing' | 'internal' | 'incoming') => {
    setOpen(false);
    navigate(`/edo/compose?type=${type}`);
  };

  return (
    <div className="relative mb-3" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? t('edo.nav.compose') : undefined}
        className={cn(
          'w-full bg-asaka-600 hover:bg-asaka-700 text-white rounded-lg flex items-center justify-center font-medium shadow-sm transition-colors',
          collapsed ? 'p-2.5' : 'py-2.5 px-4 gap-2',
        )}
      >
        <FilePlus size={16} />
        {!collapsed && t('edo.nav.compose')}
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-30 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 overflow-hidden',
            collapsed ? 'left-0 w-56' : 'left-0 right-0',
          )}
        >
          {showIncoming && (
            <button
              onClick={() => go('incoming')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-asaka-50 hover:text-asaka-700 transition-colors"
            >
              <ChevronsDown size={18} className="text-asaka-600" />
              {t('edo.compose.type_incoming')}
            </button>
          )}
          <button
            onClick={() => go('outgoing')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-asaka-50 hover:text-asaka-700 transition-colors"
          >
            <ChevronsUp size={18} className="text-asaka-600" />
            {t('edo.compose.type_outgoing')}
          </button>
          <button
            onClick={() => go('internal')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-asaka-50 hover:text-asaka-700 transition-colors"
          >
            <FileText size={18} className="text-asaka-600" />
            {t('edo.compose.type_internal')}
          </button>
        </div>
      )}
    </div>
  );
}

export function LayoutEdo() {
  const { t } = useTranslation();
  const { user, notification, handleLogout } = useLayoutData();
  const isStaff = user.role === 'admin' || user.role === 'chancellery';
  const { openTheme, openDesign, openLanguage, modals } = useAppearanceModals();
  // Menu har doim ochiq turadi (compose sahifasida ham kichraymaydi)
  const collapsed = false;
  // Mobil: chap menyu drawer sifatida ochiladi/yopiladi
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  // Sahifa (oyna) ochilganda mobil menyu avtomatik yopilsin
  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname]);

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-2 md:gap-4 px-2 md:px-4">
        <button
          onClick={() => setMobileNav((v) => !v)}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
          aria-label="Menu"
        >
          {mobileNav ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link to="/edo" className="flex items-center gap-2.5 font-semibold text-xl text-slate-700 px-1 md:px-2 md:min-w-[220px]">
          <AsakaLogo size={34} />
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-base">{t('edo.app_name')}</span>
            <span className="text-xs font-normal text-slate-500">{t('edo.app_tagline')}</span>
          </div>
        </Link>
        <AppSwitcher className="ml-2 hidden md:inline-flex shrink-0" />
        {/* Kanselyariya/admin uchun yuqori tugmalar — AppSwitcher yoniga chapga surilgan */}
        {isStaff && (
          <nav className="hidden md:flex items-center gap-1 ml-3 shrink-0">
            <TopNav to="/edo/tasks" icon={Handshake} label={t('edo.topnav.assignments')} />
            <TopNav to="/edo/stats/overview" icon={LayoutGrid} label={t('edo.topnav.chancellery')} />
            <TopNav to="/edo/control" icon={ShieldCheck} label={t('edo.topnav.control')} />
          </nav>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {notification && (
            <div className="flex items-center gap-2 bg-asaka-50 text-asaka-700 px-3 py-1.5 rounded-full text-xs animate-pulse">
              <Bell size={14} />
              <span className="max-w-xs truncate">{notification}</span>
            </div>
          )}
          <Link to="/profile" className="rounded-full hover:ring-2 hover:ring-asaka-200" title={user.fullName}>
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

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobil backdrop */}
        {mobileNav && (
          <div
            className="md:hidden fixed inset-x-0 bottom-0 top-16 z-30 bg-black/40"
            onClick={() => setMobileNav(false)}
          />
        )}
        <aside
          className={cn(
            'bg-edonav-900 flex flex-col p-4 gap-1 overflow-y-auto transition-transform duration-200',
            // Mobil: chapdan chiquvchi drawer
            'fixed top-16 bottom-0 left-0 w-72 z-40 shadow-2xl',
            mobileNav ? 'translate-x-0' : '-translate-x-full',
            // Desktop: doimiy ochiq, oddiy ustun
            'md:static md:top-auto md:bottom-auto md:z-auto md:shadow-none md:translate-x-0',
            collapsed ? 'md:w-[68px]' : 'md:w-64',
          )}
        >
          <NewDocButton collapsed={collapsed} showIncoming={isStaff} />

          {/* ── Ichki hujjatlar ── */}
          {!collapsed ? (
            <div className="mt-2 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {t('edo.nav.section_internal')}
            </div>
          ) : (
            <div className="mt-1 border-t border-white/10" />
          )}
          <EdoNav to="/edo" end icon={Home} label={t('edo.nav.home')} collapsed={collapsed} />
          <EdoNav to="/edo/calendar" icon={CalendarDays} label={t('edo.nav.calendar')} collapsed={collapsed} />
          <EdoNav to="/edo/mine" icon={FileText} label={t('edo.nav.my_documents')} collapsed={collapsed} />
          <EdoNav to="/edo/chat" icon={MessagesSquare} label={t('edo.nav.chat')} collapsed={collapsed} />
          <EdoNav to="/edo/outgoing" icon={Send} label={t('edo.nav.outgoing')} collapsed={collapsed} />
          <EdoNav to="/edo/incoming" icon={Inbox} label={t('edo.nav.incoming')} collapsed={collapsed} />
          <EdoNav to="/edo/internal" icon={FolderInput} label={t('edo.nav.internal')} collapsed={collapsed} />
          {isStaff && (
            <EdoNav to="/edo/control" icon={ShieldCheck} label={t('edo.nav.control')} collapsed={collapsed} />
          )}
          {isStaff && (
            <EdoNav to="/edo/control/open-tasks" icon={ClipboardCheck} label={t('edo.nav.open_tasks')} collapsed={collapsed} />
          )}
          <EdoNav to="/edo/tasks" icon={Handshake} label={t('edo.nav.tasks_approval')} collapsed={collapsed} />
          <EdoNav to="/edo/signing" icon={FileSignature} label={t('edo.nav.to_sign')} collapsed={collapsed} />
          <EdoNav to="/edo/department" icon={Building2} label={t('edo.nav.department')} collapsed={collapsed} />
          <EdoNav to="/edo/drafts" icon={SquarePen} label={t('edo.nav.editor')} collapsed={collapsed} />

          {/* ── Statistika ── */}
          {!collapsed ? (
            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {t('edo.nav.statistika')}
            </div>
          ) : (
            <div className="mt-4 border-t border-white/10" />
          )}
          {isStaff && (
            <EdoNavGroup
              icon={PieChart}
              label={t('edo.nav.stats_panel')}
              basePath="/edo/stats"
              collapsed={collapsed}
              items={[
                { to: '/edo/stats/overview', icon: BarChart3, label: t('edo.stats.tab_overview') },
                { to: '/edo/stats/staff', icon: Users, label: t('edo.stats.tab_staff') },
                { to: '/edo/stats/departments', icon: Building2, label: t('edo.stats.tab_departments') },
                { to: '/edo/stats/signing', icon: FileSignature, label: t('edo.stats.tab_signing') },
                { to: '/edo/stats/approvals', icon: Handshake, label: t('edo.stats.tab_approvals') },
              ]}
            />
          )}
          <EdoNav to="/edo/reports" icon={BarChart3} label={t('edo.nav.statistika')} collapsed={collapsed} />
          <EdoNav to="/edo/hisobotlar" icon={FileSpreadsheet} label={t('edo.nav.hisobotlar')} collapsed={collapsed} />

          {/* ── Vositalar ── */}
          {!collapsed ? (
            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {t('edo.nav.tools')}
            </div>
          ) : (
            <div className="mt-4 border-t border-white/10" />
          )}
          <EdoNav to="/edo/search" icon={Search} label={t('edo.nav.search')} collapsed={collapsed} />
          {isStaff && (
            <EdoNav to="/edo/jurnal" icon={BookText} label={t('edo.nav.jurnal')} collapsed={collapsed} />
          )}
          <EdoNav to="/edo/templates" icon={Files} label={t('edo.nav.templates')} collapsed={collapsed} />
          <EdoNav to="/edo/approval" icon={CheckCircle2} label={t('edo.nav.approval_status')} collapsed={collapsed} />
          <EdoNav to="/edo/archive" icon={FileSearch} label={t('edo.nav.archive')} collapsed={collapsed} />

          {!collapsed ? (
            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {t('common.settings')}
            </div>
          ) : (
            <div className="mt-4 border-t border-white/10" />
          )}
          {user.role === 'admin' && (
            <EdoNav to="/edo/settings" icon={Settings} label={t('edo.nav.settings')} collapsed={collapsed} />
          )}
          <button
            onClick={openLanguage}
            title={collapsed ? t('common.language') : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors text-left',
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
              'flex items-center rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors text-left',
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
              'flex items-center rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors text-left',
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
