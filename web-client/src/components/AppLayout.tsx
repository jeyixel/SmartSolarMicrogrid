import { Link, NavLink, Outlet } from 'react-router-dom';
import { Sun, UserCog } from 'lucide-react';

import { API_BASE_URL } from '@/api/client';
import { USER_ROLES, type UserRole } from '@/api/types';
import { useSession } from '@/context/SessionContext';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { role, userId, setRole, isStaff } = useSession();

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
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="role-switcher" className="sr-only">
              Acting as role
            </label>
            <UserCog className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <select
              id="role-switcher"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {USER_ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/*
          Visible reminder that this is a stand-in. Member 1 owns real
          authentication; until then the role travels as a debug header, and the
          backend accepts it only in its Development environment.
        */}
        <div className="border-t bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-900">
          Development mode — acting as <strong>{role}</strong> ({userId}). Real sign-in
          arrives with the identity module. API: {API_BASE_URL}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
