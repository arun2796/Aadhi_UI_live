import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const TOKEN_STORAGE_KEY = 'aadhi_admin_jwt_token';
export const UNAUTHORIZED_EVENT = 'aadhi:unauthorized';

// Dynamic API Base URL from Vite environment with safe fallback
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5050/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  timeout: 30000
});

// Request Interceptor: Attach JWT and correlation ID
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!config.headers['X-Correlation-ID']) {
      config.headers['X-Correlation-ID'] = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Capture correlation ID and handle 401s
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

export function getApiErrorDetails(error: unknown): { message: string; correlationId?: string; status?: number } {
  if (axios.isAxiosError(error)) {
    const errData = error.response?.data as { message?: string; correlationId?: string; errors?: string[] } | undefined;
    const correlationId = (error.response?.headers['x-correlation-id'] as string) || errData?.correlationId;
    const message = errData?.message || (errData?.errors && errData.errors.join(', ')) || error.message || 'API request failed';
    return {
      message,
      correlationId,
      status: error.response?.status
    };
  }

  return {
    message: error instanceof Error ? error.message : 'Unknown error occurred'
  };
}

export function wrapPagedResult<T>(data?: { items?: T[]; totalCount?: number; page?: number; pageSize?: number; totalPages?: number; hasPreviousPage?: boolean; hasNextPage?: boolean }): T[] & { items: T[]; totalCount: number; page: number; pageSize: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } {
  const items = (data?.items || []) as T[] & { items: T[]; totalCount: number; page: number; pageSize: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
  items.items = items;
  items.totalCount = data?.totalCount ?? items.length;
  items.page = data?.page ?? 1;
  items.pageSize = data?.pageSize ?? 20;
  items.totalPages = data?.totalPages ?? 1;
  items.hasPreviousPage = data?.hasPreviousPage ?? false;
  items.hasNextPage = data?.hasNextPage ?? false;
  return items;
}
