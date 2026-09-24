import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setIdentity } from '@/api/client';
import type { UserRole } from '@/api/types';

/**
 * Holds the role the session is acting as.
 *
 * Member 1 owns real authentication. Until their login exists, the role is
 * chosen from the header switcher and sent to the API as a debug header. That
 * makes the role-based rules demonstrable now, and the swap later is confined
 * to this file and `api/client.ts`.
 *
 * The role decides what the UI offers, but never what the API permits — the
 * backend enforces every rule itself, so switching to Backoffice here does not
 * grant any access that a real token would not.
 */
interface SessionValue {
  role: UserRole;
  userId: string;
  setRole: (role: UserRole) => void;
  isBackoffice: boolean;
  isGridOperator: boolean;
  isProsumer: boolean;
  /** Either staff role: may see the management list. */
  isStaff: boolean;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

const ROLE_STORAGE_KEY = 'smartsolar.devRole';

function readStoredRole(): UserRole {
  try {
    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
    if (stored === 'Backoffice' || stored === 'GridOperator' || stored === 'Prosumer') {
      return stored;
    }
  } catch {
    // Private browsing, or storage disabled. The default is fine.
  }
  return 'Backoffice';
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(readStoredRole);

  const userId = useMemo(() => {
    // A stable, readable id per role, so the audit fields in the station
    // documents show who did what during a demo.
    switch (role) {
      case 'Backoffice':
        return 'backoffice-001';
      case 'GridOperator':
        return 'operator-007';
      default:
        return 'prosumer-042';
    }
  }, [role]);

  // Keep the API client's identity in step with the context. Running this on
  // mount too means the first request already carries the stored role.
  useEffect(() => {
    setIdentity(role, userId);
  }, [role, userId]);

  const setRole = useCallback((next: UserRole) => {
    setRoleState(next);
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is not worth failing over.
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      role,
      userId,
      setRole,
      isBackoffice: role === 'Backoffice',
      isGridOperator: role === 'GridOperator',
      isProsumer: role === 'Prosumer',
      isStaff: role === 'Backoffice' || role === 'GridOperator',
    }),
    [role, userId, setRole],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside a SessionProvider.');
  }
  return context;
}
