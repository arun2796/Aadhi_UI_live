import { apiClient, wrapPagedResult } from './apiClient';
import { Expense, ExpenseCategory, ProfitLoss } from '../types';

export const financeApi = {
  getExpenses: async (page = 1, pageSize = 20, category?: ExpenseCategory) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (category) params.append('category', category);

    const res = await apiClient.get(`/finance/expenses?${params.toString()}`);
    return wrapPagedResult<Expense>(res.data?.data);
  },

  createExpense: async (data: {
    title?: string;
    description?: string;
    amount?: number;
    category?: ExpenseCategory;
    expenseDate?: string;
    receiptUrl?: string;
    date?: string;
    expenseNumber?: string;
    tax?: number;
    paidVia?: string;
    paymentMethod?: string;
    reference?: string;
    [key: string]: any;
  }) => {
    const payload = {
      title: data.title || data.description || 'Operating Expense',
      description: data.description || data.title,
      amount: data.amount || 0,
      category: data.category || 'Other',
      expenseDate: data.expenseDate || data.date || new Date().toISOString().split('T')[0],
      receiptUrl: data.receiptUrl
    };
    const res = await apiClient.post<{ data: Expense }>('/finance/expenses', payload);
    return res.data?.data;
  },

  getProfitLoss: async (fromDate?: string, toDate?: string) => {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);

    const res = await apiClient.get<{ data: ProfitLoss }>(`/reports/profit-loss?${params.toString()}`);
    return res.data?.data;
  }
};
