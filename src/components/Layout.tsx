import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Award,
  Bell,
  Building2,
  CalendarDays,
  CalendarPlus,
  FileSignature,
  Compass,
  Home,
  IdCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquareWarning,
  ScanLine,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { initials } from '../lib/format';
import type { Role } from '../lib/types';
import { cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  mobile?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: '/', label: 'Home', icon: Home, end: true, mobile: true },
    { to: '/explore', label: 'Explore', icon: Compass, mobile: true },
    { to: '/clubs', label: 'Clubs', icon: Building2 },
    { to: '/registrations', label: 'My Registrations', icon: Ticket, mobile: true },
    { to: '/certificates', label: 'Certificates', icon: Award, mobile: true },
  ],
  club_admin: [
    { to: '/club', label: 'Dashboard', icon: LayoutDashboard, end: true, mobile: true },
    { to: '/club/events', label: 'Events', icon: CalendarDays, mobile: true },
    { to: '/club/events/new', label: 'Create Event', icon: CalendarPlus },
    { to: '/club/scan', label: 'Check-in Scanner', icon: ScanLine, mobile: true },
    { to: '/club/od-template', label: 'OD Template', icon: FileSignature },
    { to: '/club/support', label: 'Support', icon: LifeBuoy },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, mobile: true },
    { to: '/admin/events', label: 'Events', icon: CalendarDays, mobile: true },
    { to: '/admin/clubs', label: 'Clubs', icon: Building2, mobile: true },
    { to: '/admin/verifications', label: 'Verifications', icon: IdCard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/complaints', label: 'Complaints', icon: MessageSquareWarning, mobile: true },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ],
};

const ROLE_LABEL: Record<Role, string> = { student: 'Student', club_admin: 'Club Admin', admin: 'Portal Admin' };

/* --------------------------------------------------- notification counter */

const UnreadContext = createContext<{ unread: number; refresh: () => void }>({ unread: 0, refresh: () => {} });
export const useUnread = () => useContext(UnreadContext);

function UnreadProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(() => {
    api<{ unread: number }>('/api/notifications')
      .then(r => setUnread(r.unread))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);
  return <UnreadContext.Provider value={{ unread, refresh }}>{children}</UnreadContext.Provider>;
}

/* ------------------------------------------------------------------ shell */

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[10px] bg-accent">
        <svg viewBox="0 0 32 32" className="size-5" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17h6l3-8 5 15 3-7h7" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">CampusPulse</span>
    </Link>
  );
}

function SideLink({ item, badge }: { item: NavItem; badge?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-raised text-ink' : 'text-muted hover:bg-surface hover:text-ink')
      }
    >
      <item.icon className="size-[18px]" />
      <span className="flex-1">{item.label}</span>
      {!!badge && <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold tabular-nums text-white">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  );
}

function Shell() {
  const { user, club, logout } = useAuth();
  const { unread, refresh } = useUnread();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    refresh();
  }, [location.pathname, refresh]);
  if (!user) return null;
  const items = NAV[user.role];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line/60 bg-canvas px-3 py-5 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <img src="/college-logo.png" alt="SRM Easwari Engineering College" className="mx-2 mt-5 h-auto w-[196px]" style={{ objectFit: 'contain' }} />
        {club && (
          <div className="mx-1 mt-5 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
            <span className="size-2 rounded-full" style={{ background: club.color }} />
            <span className="truncate text-xs font-medium text-ink">{club.name}</span>
          </div>
        )}
        <nav className="mt-5 flex flex-1 flex-col gap-0.5">
          {items.map(i => (
            <SideLink key={i.to} item={i} />
          ))}
          <div className="my-3 h-px bg-line/60" />
          <SideLink item={{ to: '/notifications', label: 'Notifications', icon: Bell }} badge={unread} />
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
          <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold text-ink">{initials(user.name)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-muted">{user.unique_code ?? ROLE_LABEL[user.role]}</span>
            </span>
          </Link>
          <button onClick={logout} className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line/60 bg-canvas/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <Link to="/notifications" className="relative grid size-10 place-items-center rounded-xl text-muted hover:text-ink" aria-label="Notifications">
            <Bell className="size-5" />
            {!!unread && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>}
          </Link>
          <Link to="/profile" className="grid size-9 place-items-center rounded-full bg-raised text-xs font-bold text-ink" aria-label="Profile">
            {initials(user.name)}
          </Link>
        </div>
      </header>

      <main className="lg:ml-60">
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line/60 bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {items
          .filter(i => i.mobile)
          .map(i => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium', isActive ? 'text-accent' : 'text-muted')}>
              <i.icon className="size-5" />
              {i.label.replace('My ', '').replace('Check-in ', '')}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}

export function AppLayout() {
  return (
    <UnreadProvider>
      <Shell />
    </UnreadProvider>
  );
}
