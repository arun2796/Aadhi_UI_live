import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { apiClient, TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isInitializing: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const USER_STORAGE_KEY = 'aadhi_admin_user';

const ERP_ROLES = ['SuperAdmin', 'Admin', 'Manager', 'SalesExecutive', 'InventoryManager', 'PurchaseManager', 'Accountant', 'SupportAgent'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(): User | null {
  try {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as User) : null;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY) ? readStoredUser() : null
  );
  const [isInitializing, setIsInitializing] = useState<boolean>(() => !!localStorage.getItem(TOKEN_STORAGE_KEY));

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  // Validate the stored token against the server on boot
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) return;
    let cancelled = false;
    apiClient
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return;
        const me = res.data?.data as User | undefined;
        if (me) {
          setUser(me);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
        }
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // Global 401 handler: any API call rejected as unauthenticated forces re-login
  useEffect(() => {
    const onUnauthorized = () => clearSession();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false): Promise<{ success: boolean; message?: string }> => {
      try {
        const res = await apiClient.post('/auth/login', { email, password, rememberMe });
        const auth = res.data?.data;
        if (!auth?.token || !auth?.user) {
          return { success: false, message: res.data?.message || 'Login failed' };
        }
        if (!ERP_ROLES.includes(auth.user.role)) {
          return { success: false, message: 'This account does not have access to the ERP.' };
        }
        localStorage.setItem(TOKEN_STORAGE_KEY, auth.token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(auth.user));
        setUser(auth.user);
        return { success: true };
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          (error?.response?.status === 429
            ? 'Too many login attempts. Please wait a minute and try again.'
            : 'Unable to sign in. Check your connection and try again.');
        return { success: false, message };
      }
    },
    []
  );

  const logout = useCallback(() => {
    apiClient.post('/auth/logout').catch(() => {});
    clearSession();
  }, [clearSession]);

  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isAdmin, isInitializing, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
