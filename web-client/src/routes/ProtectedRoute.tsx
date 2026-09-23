import React, { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Future: restrict access by role. Currently a no-op passthrough. */
  allowedRoles?: string[];
}

/**
 * Dummy ProtectedRoute — passes children through without any auth checks.
 *
 * This is intentionally a passthrough while the User Management module is pending.
 * When the real auth system is integrated, replace this with:
 *   1. Check useAuth().user is authenticated
 *   2. Check user.role is in allowedRoles (if specified)
 *   3. Redirect to /login if not authenticated
 *   4. Return <Forbidden /> if role not permitted
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  return <>{children}</>;
};
