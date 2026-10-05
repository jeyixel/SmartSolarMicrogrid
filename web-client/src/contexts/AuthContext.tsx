import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type AuthUser = {
  id: string;
  fullName: string;
  nic: string;
  role: 0 | 1 | 2;       // Backoffice, Grid Operator, Prosumer
  status: 0 | 1 | 2;     // Pending, Active, Deactivated
};

export type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5127';

function parseRole(role: unknown): 0 | 1 | 2 {
  if (role === 0 || role === '0' || role === 'Backoffice') return 0;
  if (role === 1 || role === '1' || role === 'GridOperator') return 1;
  if (role === 2 || role === '2' || role === 'Prosumer') return 2;
  return 2;
}

function parseStatus(status: unknown): 0 | 1 | 2 {
  if (status === 0 || status === '0' || status === 'Pending') return 0;
  if (status === 1 || status === '1' || status === 'Active') return 1;
  if (status === 2 || status === '2' || status === 'Deactivated') return 2;
  return 0;
}

function mapToAuthUser(rawUser: any): AuthUser {
  return {
    id: rawUser?.id || rawUser?.Id || '',
    fullName: rawUser?.fullName || rawUser?.FullName || '',
    nic: rawUser?.nic || rawUser?.NIC || '',
    role: parseRole(rawUser?.role ?? rawUser?.Role),
    status: parseStatus(rawUser?.status ?? rawUser?.Status),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function restoreSession() {
      const storedToken = sessionStorage.getItem('auth_token');
      const storedExpiresAt = sessionStorage.getItem('auth_expires_at');

      if (!storedToken || !storedExpiresAt) {
        setIsLoading(false);
        return;
      }

      const expiresAtDate = new Date(storedExpiresAt);
      if (isNaN(expiresAtDate.getTime()) || expiresAtDate <= new Date()) {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_expires_at');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          const profile = await response.json();
          setUser(mapToAuthUser(profile));
          setToken(storedToken);
        } else {
          sessionStorage.removeItem('auth_token');
          sessionStorage.removeItem('auth_expires_at');
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.error('Failed to restore authentication session:', err);
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_expires_at');
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (identifier: string, password: string): Promise<AuthUser> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, password }),
    });

    if (!response.ok) {
      let errorMessage = 'Login failed.';
      try {
        const errorData = await response.json();
        errorMessage = errorData?.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const authUser = mapToAuthUser(data.user);

    sessionStorage.setItem('auth_token', data.token);
    sessionStorage.setItem('auth_expires_at', data.expiresAt);

    setToken(data.token);
    setUser(authUser);

    return authUser;
  };

  const logout = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_expires_at');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
