import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut, Sun } from 'lucide-react';

import { API_BASE_URL } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/context/SessionContext';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { role, userId, isStaff } = useSession();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <Link to="/stations" className="flex items-center gap-2 font-semibold">
            <span className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Sun className="h-5 w-5" aria-hidden="true" />
            </span>
            Smart Solar Microgrid
          </Link>

          <nav className="flex items-center gap-1" aria-label="Main">
            {isStaff && (
              <NavLink
                to="/stations"
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                Stations
              </NavLink>
            )}
            {role === 'Backoffice' && (
              <NavLink
                to="/backoffice/dashboard"
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                Backoffice Portal
              </NavLink>
            )}
            {role === 'GridOperator' && (
              <NavLink
                to="/operator/dashboard"
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                Operator Portal
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Signed in as <strong>{user?.fullName ?? userId}</strong> ({role})
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>

        {/* API target shown for local debugging during the demo. */}
        <div className="border-t bg-slate-50 px-6 py-1 text-center text-xs text-slate-500">
          API: {API_BASE_URL}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
