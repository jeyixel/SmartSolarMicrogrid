import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import {
  CalendarClock,
  CalendarOff,
  LayoutDashboard,
  Layers,
  ListChecks,
  LogOut,
  Menu,
  Radio,
  Sun,
  X,
} from 'lucide-react';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';

/**
 * Grid Operator shell: the same fixed dark sidebar, mobile drawer and sticky
 * header pattern as BackofficeLayout, so the two staff portals read as one
 * system rather than two different apps. Only the nav items and the portal
 * badge differ - a Grid Operator's nav is station-scoped, not user-scoped.
 */
export default function OperatorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { preference, setPreference } = useTheme('operator-theme');

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const navItems = [
    {
      to: '/operator/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      end: true,
    },
    {
      to: '/stations',
      label: 'All Stations',
      icon: <ListChecks className="h-5 w-5" />,
    },
    {
      to: '/operator/reservations',
      label: 'Reservations',
      icon: <CalendarClock className="h-5 w-5" />,
    },
    {
      to: '/operator/stations',
      label: 'Station Schedules',
      icon: <CalendarOff className="h-5 w-5" />,
    },
    {
      to: '/operator/slots',
      label: 'Slot Management',
      icon: <Layers className="h-5 w-5" />,
    },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-white transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
          <Link
            to="/operator/dashboard"
            className="flex items-center gap-2 font-bold tracking-tight text-white"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-900">
              <Sun className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-semibold">SmartSolar</span>
              <span className="block text-xs font-normal text-emerald-400">Grid Operator</span>
            </div>
          </Link>
          <button
            type="button"
            className="text-slate-400 hover:text-white lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
          <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Microgrid Nodes
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Card at bottom of sidebar */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-800/80 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-sm">
              {user?.fullName?.charAt(0) || 'G'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user?.fullName || 'Grid Operator'}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.nic || 'Staff'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-rose-950/40 hover:border-rose-800 hover:text-rose-300 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Layout */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted py-1 px-2.5 rounded-full">
              <Radio className="h-4 w-4 text-emerald-600" />
              <span>Grid Operator Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle value={preference} onChange={setPreference} />
            <div className="text-right">
              <p className="text-xs font-semibold text-foreground">{user?.fullName}</p>
              <p className="text-[11px] text-muted-foreground">NIC: {user?.nic}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:text-rose-600 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
