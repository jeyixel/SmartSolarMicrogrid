import React, { createContext, useState, useContext, ReactNode } from 'react';

export type UserRole = 'GridOperator' | 'Backoffice';

export interface MockUser {
  id: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: MockUser;
  /** Shorthand for user.role */
  role: UserRole;
  /** Shorthand for user.id — used to populate audit fields (CreatedByUserId, UpdatedByUserId) in API calls */
  userId: string;
  setRole: (role: UserRole) => void;
}

/**
 * Hardcoded mock users for each role.
 * Replace with real user data once the User Management module is complete.
 */
const MOCK_USERS: Record<UserRole, MockUser> = {
  GridOperator: {
    id: 'mock-operator-001',
    name: 'Ravi Perera',
    role: 'GridOperator',
  },
  Backoffice: {
    id: 'mock-backoffice-001',
    name: 'Amali Silva',
    role: 'Backoffice',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>('GridOperator');
  const user = MOCK_USERS[role];

  return (
    <AuthContext.Provider value={{ user, role, userId: user.id, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
