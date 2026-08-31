import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (email: string, role?: string) => void;
  logout: () => void;
  toggleUserRole: () => void;
}

const DEFAULT_ADMIN_USER: User = {
  id: 'usr-admin-1',
  email: 'admin@aadhicrackers.com',
  firstName: 'Arun',
  lastName: 'Kumar (Admin)',
  phone: '+91 98765 43210',
  role: 'SuperAdmin',
  permissions: ['*'],
  isActive: true
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aadhi_admin_user');
    return saved ? JSON.parse(saved) : DEFAULT_ADMIN_USER;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('aadhi_admin_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('aadhi_admin_user');
    }
  }, [user]);

  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  const login = (email: string, role: string = 'SuperAdmin') => {
    const newUser: User = {
      id: 'usr-admin-' + Date.now(),
      email,
      firstName: 'Arun',
      lastName: 'Kumar',
      phone: '+91 98765 43210',
      role: (role as any) || 'SuperAdmin',
      permissions: ['*'],
      isActive: true
    };
    setUser(newUser);
  };

  const logout = () => {
    setUser(null);
  };

  const toggleUserRole = () => {};

  return (
    <AuthContext.Provider value={{ user, isAdmin, login, logout, toggleUserRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
