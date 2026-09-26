import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  CalendarClock,
  CalendarOff,
  Layers,
  LogOut,
  Zap,
  Menu,
  X,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function GridOperatorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
          <Link
            to="/operator/dashboard"
            className="flex items-center gap-2.5 font-bold tracking-tight text-white"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-slate-900 shadow-sm shadow-emerald-500/20">
              <Zap className="h-5 w-5 fill-slate-900" />
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-semibold tracking-wide">SmartSolar</span>
              <span className="block text-xs font-normal text-emerald-400">Grid Operations</span>
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
            Grid Dispatch &amp; Control
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
              <p className="truncate text-xs font-semibold text-white">
                {user?.fullName || 'Grid Operator'}
              </p>
              <p className="truncate text-[11px] text-slate-400 font-mono">
                {user?.nic || 'Operator'}
              </p>
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-700 bg-emerald-50 border border-emerald-200 py-1 px-3 rounded-full">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-semibold text-emerald-800">Grid Operations Console</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-800">{user?.fullName}</p>
              <p className="text-[11px] text-slate-500 font-mono">NIC: {user?.nic}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-rose-600 transition-colors"
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
