import React, { createContext, useContext, useMemo } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/api/types';

/**
 * Derives the station module's view of "who is signed in" from Member 1's
 * real AuthContext.
 *
 * Earlier this held a manual role switcher that stood in for authentication
 * before a real login existed - it set the role from a dropdown and sent it as
 * a debug header. That header is gone now that real JWT auth is enforced, so
 * the role must come from the authenticated user instead. The role still only
 * decides what the UI *offers*; the backend enforces every rule itself from
 * the token, so this can never grant access a real token would not.
 */
interface SessionValue {
  role: UserRole;
  userId: string;
  isBackoffice: boolean;
  isGridOperator: boolean;
  isProsumer: boolean;
  /** Either staff role: may see the management list. */
  isStaff: boolean;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

function roleFromAuthRole(role: 0 | 1 | 2 | undefined): UserRole {
  switch (role) {
    case 0:
      return 'Backoffice';
    case 1:
      return 'GridOperator';
    default:
      return 'Prosumer';
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const value = useMemo<SessionValue>(() => {
    const role = roleFromAuthRole(user?.role);
    return {
      role,
      userId: user?.id ?? user?.nic ?? '',
      isBackoffice: role === 'Backoffice',
      isGridOperator: role === 'GridOperator',
      isProsumer: role === 'Prosumer',
      isStaff: role === 'Backoffice' || role === 'GridOperator',
    };
  }, [user]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside a SessionProvider.');
  }
  return context;
}
