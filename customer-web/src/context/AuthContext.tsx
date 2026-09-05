import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  /** Reward points from /auth/me (undefined when the backend doesn't provide them). */
  rewardPoints?: number;
  /** `identifier` accepts a mobile number OR an email address. */
  login: (identifier: string, password: string) => Promise<boolean>;
  loginWithFirebase: (firebaseData: { idToken: string; email?: string; displayName?: string; photoUrl?: string; phoneNumber?: string }) => Promise<boolean>;
  register: (data: { firstName: string; lastName: string; email: string; phone: string; password: string }) => Promise<boolean>;
  /** Updates the profile (first/last name, phone) on the server; returns true on success. */
  updateProfile: (data: { firstName: string; lastName?: string; phone?: string }) => Promise<boolean>;
  logout: () => void;
  toggleUserRole: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aadhi_customer_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [rewardPoints, setRewardPoints] = useState<number | undefined>(undefined);

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
              phone: profile.phone || profile.phoneNumber || '',
              role: profile.role || 'Customer',
              permissions: profile.permissions || ['Products.Read', 'Orders.Create'],
              isActive: profile.isActive !== false
            };
            setUser(mappedUser);
            if (typeof profile.rewardPoints === 'number') setRewardPoints(profile.rewardPoints);
            localStorage.setItem('aadhi_customer_user', JSON.stringify(mappedUser));
          } else {
            api.logout();
            setUser(null);
          }
        })
        .catch(() => {
          // Token expired or invalid - clear authentication
          api.logout();
          setUser(null);
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

  const login = async (identifier: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // `identifier` may be a mobile number or an email address.
      const res = await api.loginWithIdentifier(identifier, password);
      if (res && res.user) {
        const u = res.user;
        const loggedUser: User = {
          id: u.id,
          email: u.email || (identifier.includes('@') ? identifier : ''),
          firstName: u.firstName || u.name?.split(' ')[0] || 'Customer',
          lastName: u.lastName || '',
          phone: u.phone || u.phoneNumber || (identifier.includes('@') ? '' : identifier),
          role: u.role || 'Customer',
          permissions: u.permissions || ['Products.Read', 'Orders.Create'],
          isActive: u.isActive !== false
        };
        setUser(loggedUser);
        if (typeof u.rewardPoints === 'number') setRewardPoints(u.rewardPoints);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Customer login failed:', error);
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithFirebase = async (firebaseData: { idToken: string; email?: string; displayName?: string; photoUrl?: string; phoneNumber?: string }): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await api.loginWithFirebase(firebaseData);
      if (res && res.user) {
        const u = res.user;
        const loggedUser: User = {
          id: u.id,
          email: u.email || firebaseData.email || '',
          firstName: u.firstName || firebaseData.displayName?.split(' ')[0] || 'Customer',
          lastName: u.lastName || '',
          phone: u.phone || firebaseData.phoneNumber || '',
          role: u.role || 'Customer',
          permissions: u.permissions || ['Products.Read', 'Orders.Create'],
          isActive: u.isActive !== false
        };
        setUser(loggedUser);
        if (typeof u.rewardPoints === 'number') setRewardPoints(u.rewardPoints);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Customer Firebase login failed:', error);
      setUser(null);
      throw error;
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
    } catch (error) {
      console.error('Customer registration failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: { firstName: string; lastName?: string; phone?: string }): Promise<boolean> => {
    try {
      const profile = await api.updateProfile(data);
      if (profile) {
        const updatedUser: User = {
          id: profile.id || user?.id || '',
          email: profile.email || user?.email || '',
          firstName: profile.firstName || data.firstName,
          lastName: profile.lastName ?? data.lastName ?? '',
          phone: profile.phone || data.phone || '',
          role: profile.role || user?.role || 'Customer',
          permissions: profile.permissions || user?.permissions || ['Products.Read', 'Orders.Create'],
          isActive: profile.isActive !== false
        };
        setUser(updatedUser);
        if (typeof profile.rewardPoints === 'number') setRewardPoints(profile.rewardPoints);
        localStorage.setItem('aadhi_customer_user', JSON.stringify(updatedUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  const toggleUserRole = () => {};

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, rewardPoints, login, loginWithFirebase, register, updateProfile, logout, toggleUserRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
