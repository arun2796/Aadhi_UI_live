import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (email: string, role?: string) => void;
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

  useEffect(() => {
    if (user) {
      localStorage.setItem('aadhi_customer_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('aadhi_customer_user');
    }
  }, [user]);

  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  const login = (email: string, role: string = 'Customer') => {
    const newUser: User = {
      id: 'usr-cust-' + Date.now(),
      email,
      firstName: email.split('@')[0],
      lastName: '',
      phone: '+91 98765 43210',
      role: 'Customer',
      permissions: ['Products.Read', 'Orders.Create'],
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
