import { apiClient, wrapPagedResult } from './apiClient';
import { AuditLog, AuditLogDetail } from '../types';

export const auditApi = {
  getAuditLogs: async (params?: {
    entityType?: string;
    action?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
    fromDate?: string;
    toDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.entityType) searchParams.append('entityType', params.entityType);
    if (params?.action) searchParams.append('action', params.action);
    if (params?.userId) searchParams.append('userId', params.userId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());
    if (params?.fromDate) searchParams.append('fromDate', params.fromDate);
    if (params?.toDate) searchParams.append('toDate', params.toDate);

    const res = await apiClient.get(`/auditlogs?${searchParams.toString()}`);
    return wrapPagedResult<AuditLog>(res.data?.data);
  },

  getAuditLogById: async (id: string) => {
    const res = await apiClient.get<{ data: AuditLogDetail }>(`/auditlogs/${id}`);
    return res.data?.data;
  }
};
