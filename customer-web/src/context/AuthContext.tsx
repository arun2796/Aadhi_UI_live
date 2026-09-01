import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (data: { firstName: string; lastName: string; email: string; phone: string; password: string }) => Promise<boolean>;
  logout: () => void;
  toggleUserRole: () => void;
}

const DEFAULT_CUSTOMER_USER: User = {
  id: 'usr-cust-1',
  email: 'arun.kumar@gmail.com',
  firstName: 'Arun',
  lastName: 'Kumar',
  phone: '+91 98765 43210',
  role: 'Customer',
  permissions: ['Products.Read', 'Orders.Create', 'Orders.Read'],
  isActive: true
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aadhi_customer_user');
    return saved ? JSON.parse(saved) : DEFAULT_CUSTOMER_USER;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('aadhi_customer_token');
    if (token) {
      api.getCurrentUser()
        .then((profile) => {
          if (profile) {
            const mappedUser: User = {
              id: profile.id || profile.userId,
              email: profile.email,
              firstName: profile.firstName || profile.name?.split(' ')[0] || 'Customer',
              lastName: profile.lastName || '',
              phone: profile.phone || profile.phoneNumber || '+91 98765 43210',
              role: profile.role || 'Customer',
              permissions: profile.permissions || ['Products.Read', 'Orders.Create'],
              isActive: profile.isActive !== false
            };
            setUser(mappedUser);
            localStorage.setItem('aadhi_customer_user', JSON.stringify(mappedUser));
          }
        })
        .catch(() => {
          // Token expired or server unreachable - keep cached user
        });
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('aadhi_customer_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('aadhi_customer_user');
    }
  }, [user]);

  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  const login = async (email: string, password: string = 'Password@123'): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      if (res && res.user) {
        const u = res.user;
        const loggedUser: User = {
          id: u.id,
          email: u.email,
          firstName: u.firstName || email.split('@')[0],
          lastName: u.lastName || '',
          phone: u.phone || '+91 98765 43210',
          role: u.role || 'Customer',
          permissions: u.permissions || ['Products.Read', 'Orders.Create'],
          isActive: u.isActive !== false
        };
        setUser(loggedUser);
        return true;
      }
      return false;
    } catch {
      // Fallback local user if backend offline
      const fallbackUser: User = {
        id: 'usr-cust-' + Date.now(),
        email,
        firstName: email.split('@')[0],
        lastName: '',
        phone: '+91 98765 43210',
        role: 'Customer',
        permissions: ['Products.Read', 'Orders.Create'],
        isActive: true
      };
      setUser(fallbackUser);
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { firstName: string; lastName: string; email: string; phone: string; password: string }): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      if (res && res.user) {
        const u = res.user;
        const registeredUser: User = {
          id: u.id,
          email: u.email,
          firstName: u.firstName || data.firstName,
          lastName: u.lastName || data.lastName,
          phone: u.phone || data.phone,
          role: u.role || 'Customer',
          permissions: u.permissions || ['Products.Read', 'Orders.Create'],
          isActive: true
        };
        setUser(registeredUser);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  const toggleUserRole = () => {};

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, login, register, logout, toggleUserRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
