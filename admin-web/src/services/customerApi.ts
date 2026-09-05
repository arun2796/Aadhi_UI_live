import { apiClient, wrapPagedResult } from './apiClient';
import { Customer, Order } from '../types';

/** Address shape returned by the API for a customer (staff view / self-service both covered). */
export interface CustomerAddress {
  id?: string;
  label?: string;
  addressType?: string | number;
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  pincode?: string;
  country?: string;
  isDefault?: boolean;
}

/** Customer profile as used by the admin ERP detail panel. */
export type CustomerDetail = Customer & {
  customerCode?: string;
  firstName?: string;
  lastName?: string;
  rewardPoints?: number;
  addresses?: CustomerAddress[];
};

type PagedCustomers = Customer[] & {
  items: Customer[];
  totalCount: number;
  page: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

/** Maps the backend CustomerDto (firstName/lastName/totalSpent/isActive) onto the UI Customer shape. */
const normalizeCustomer = (raw: any): CustomerDetail => {
  if (!raw) return raw;
  return {
    ...raw,
    name: raw.name || raw.fullName || `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || 'Customer',
    totalOrders: raw.totalOrders ?? 0,
    lifetimeValue: raw.lifetimeValue ?? raw.totalSpent ?? 0,
    outstandingBalance: raw.outstandingBalance ?? 0,
    status: raw.status ?? (raw.isActive === false ? 'Suspended' : 'Active'),
    addresses: raw.addresses || []
  };
};

export const customerApi = {
  getCustomers: async (params?: { search?: string; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const res = await apiClient.get(`/customers?${searchParams.toString()}`);
    const paged = wrapPagedResult<any>(res.data?.data);
    for (let i = 0; i < paged.length; i++) {
      paged[i] = normalizeCustomer(paged[i]);
    }
    return paged as unknown as PagedCustomers;
  },

  getCustomerById: async (id: string): Promise<CustomerDetail> => {
    const res = await apiClient.get<{ data: any }>(`/customers/${id}`);
    return normalizeCustomer(res.data?.data);
  },

  /** Order history for one customer — GET /customers/{id}/orders (unpaged list). */
  getCustomerOrders: async (id: string): Promise<Order[]> => {
    const res = await apiClient.get<{ data: Order[] }>(`/customers/${id}/orders`);
    return res.data?.data || [];
  },

  /** POST /customers — Add Customer (design 08). Backend contract: { firstName, lastName, phone, email }. */
  createCustomer: async (data: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  }): Promise<CustomerDetail> => {
    const res = await apiClient.post<{ data: any }>('/customers', data);
    return normalizeCustomer(res.data?.data);
  }
};
