import { apiClient, wrapPagedResult } from './apiClient';

export type EnquirySource = 'Direct' | 'Website' | 'Phone' | 'WhatsApp';
export type EnquiryStatus = 'New' | 'Contacted' | 'Quoted' | 'Converted' | 'Closed';

export const ENQUIRY_SOURCES: EnquirySource[] = ['Direct', 'Website', 'Phone', 'WhatsApp'];
export const ENQUIRY_STATUSES: EnquiryStatus[] = ['New', 'Contacted', 'Quoted', 'Converted', 'Closed'];

/** One product line on an enquiry (quotedPrice is filled in by staff when preparing a quote). */
export interface EnquiryItem {
  id?: string;
  productId?: string;
  productName: string;
  quantity: number;
  expectedPrice?: number;
  quotedPrice?: number;
  note?: string;
}

export interface Enquiry {
  id: string;
  enquiryNumber: string; // e.g. ENQ-2026-000001
  customerName: string;
  phone: string;
  email?: string;
  address?: string;
  source: EnquirySource;
  status: EnquiryStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  itemCount?: number;
  items?: EnquiryItem[];
}

/** Aggregated enquiry-customer row — GET /enquiries/customers. */
export interface EnquiryCustomer {
  customerName: string;
  phone: string;
  email?: string;
  enquiryCount: number;
  lastEnquiryAt?: string;
}

/** Create / update body — POST /enquiries and PUT /enquiries/{id}. */
export interface EnquiryPayload {
  customerName: string;
  phone: string;
  email?: string;
  address?: string;
  source: EnquirySource;
  notes?: string;
  items: {
    productId?: string;
    productName: string;
    quantity: number;
    expectedPrice?: number;
    quotedPrice?: number;
    note?: string;
  }[];
}

/** Backend responses are wrapped in { data: ... }; tolerate an unwrapped body too. */
const unwrap = <T>(res: { data?: { data?: T } | T }): T =>
  ((res.data as { data?: T } | undefined)?.data ?? res.data) as T;

export const enquiryApi = {
  /** GET /enquiries — paged list with optional status / source / search filters. */
  getEnquiries: async (params?: {
    status?: EnquiryStatus;
    source?: EnquirySource;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Enquiry[]; totalCount: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.source) searchParams.append('source', params.source);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const res = await apiClient.get(`/enquiries?${searchParams.toString()}`);
    const paged = wrapPagedResult<Enquiry>(unwrap(res));
    return { items: [...paged], totalCount: paged.totalCount };
  },

  /** GET /enquiries/{id} — full enquiry including items. */
  getEnquiryById: async (id: string): Promise<Enquiry | undefined> => {
    const res = await apiClient.get(`/enquiries/${id}`);
    return unwrap<Enquiry | undefined>(res);
  },

  /** POST /enquiries — create a manual (walk-in / phone) enquiry. */
  createEnquiry: async (payload: EnquiryPayload): Promise<Enquiry | undefined> => {
    const res = await apiClient.post('/enquiries', payload);
    return unwrap<Enquiry | undefined>(res);
  },

  /** PUT /enquiries/{id} — full update (also used to save inline quoted prices). */
  updateEnquiry: async (id: string, payload: EnquiryPayload): Promise<Enquiry | undefined> => {
    const res = await apiClient.put(`/enquiries/${id}`, payload);
    return unwrap<Enquiry | undefined>(res);
  },

  /** PUT /enquiries/{id}/status — status transition with an optional note. */
  updateEnquiryStatus: async (
    id: string,
    status: EnquiryStatus,
    note?: string
  ): Promise<Enquiry | undefined> => {
    const res = await apiClient.put(`/enquiries/${id}/status`, { status, note });
    return unwrap<Enquiry | undefined>(res);
  },

  /** DELETE /enquiries/{id}. */
  deleteEnquiry: async (id: string): Promise<void> => {
    await apiClient.delete(`/enquiries/${id}`);
  },

  /** GET /enquiries/customers — aggregated customers who have enquired. */
  getEnquiryCustomers: async (): Promise<EnquiryCustomer[]> => {
    const res = await apiClient.get('/enquiries/customers');
    const data = unwrap<EnquiryCustomer[] | { items?: EnquiryCustomer[] } | undefined>(res);
    if (Array.isArray(data)) return data;
    return data?.items || [];
  }
};

export default enquiryApi;
