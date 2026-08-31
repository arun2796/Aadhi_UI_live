import { apiClient } from './apiClient';
import { SystemSetting } from '../types';

export const settingsApi = {
  getSettings: async (group?: string) => {
    const params = group ? `?group=${group}` : '';
    const res = await apiClient.get<{ data: SystemSetting[] }>(`/settings${params}`);
    return res.data?.data || [];
  },

  updateSetting: async (key: string, value: string) => {
    const res = await apiClient.put<{ data: boolean }>(`/settings/${key}`, JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.data?.data;
  }
};
