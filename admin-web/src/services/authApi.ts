import { apiClient, wrapPagedResult } from './apiClient';
import { User, LoginHistory, RateLimitLog, PagedResult } from '../types';

export const authApi = {
  login: async (email: string, password: string, rememberMe = false) => {
    const res = await apiClient.post('/auth/login', { email, password, rememberMe });
    return res.data;
  },

  getMe: async () => {
    const res = await apiClient.get<{ data: User }>('/auth/me');
    return res.data?.data;
  },

  getUsers: async () => {
    const res = await apiClient.get<{ data: User[] }>('/auth/users');
    return res.data?.data || [];
  },

  updateUserRole: async (userId: string, role: string) => {
    const res = await apiClient.put(`/auth/users/${userId}/role`, { role });
    return res.data?.data;
  },

  getLoginHistory: async (page = 1, pageSize = 20, userId?: string) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (userId) params.append('userId', userId);

    const res = await apiClient.get<{ data: PagedResult<LoginHistory> }>(`/auth/login-history?${params.toString()}`);
    return wrapPagedResult<LoginHistory>(res.data?.data);
  },

  getRateLimitLogs: async (page = 1, pageSize = 20, policy?: string, ipAddress?: string) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (policy) params.append('policy', policy);
    if (ipAddress) params.append('ipAddress', ipAddress);

    const res = await apiClient.get<{ data: PagedResult<RateLimitLog> }>(`/auth/rate-limit-logs?${params.toString()}`);
    return wrapPagedResult<RateLimitLog>(res.data?.data);
  }
};
