import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Package,
  ShoppingBag,
  Users,
  Receipt,
  ArrowRight,
  Sparkles,
  Command
} from 'lucide-react';
import { api } from '../../services/api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string, params?: any) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    products: Array<{ id: string; name: string; sku: string; price: number }>;
    orders: Array<{ id: string; orderNumber: string; customerName: string; grandTotal: number; status: string }>;
    customers: Array<{ id: string; name: string; phone: string; email: string }>;
    invoices: Array<{ id: string; invoiceNumber: string; customerName: string; grandTotal: number }>;
  }>({
    products: [],
    orders: [],
    customers: [],
    invoices: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ products: [], orders: [], customers: [], invoices: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ products: [], orders: [], customers: [], invoices: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.searchGlobal(query);
        setResults(res);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalMatches =
    results.products.length +
    results.orders.length +
    results.customers.length +
    results.invoices.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-navy/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center space-x-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search products, SKUs, orders, customers, invoices... (e.g. GB-DLX, 98765, ORD-2026)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-semibold text-navy placeholder-slate-400 outline-none"
          />
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          ) : query ? (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-200 text-[10px] font-bold text-slate-600">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          )}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!query.trim() ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <Sparkles className="w-8 h-8 text-orange mx-auto opacity-60" />
              <p className="text-xs font-semibold">Type to search across the entire Aadhi Crackers ERP system</p>
              <p className="text-[11px] text-slate-400">Quickly find live orders, products, customer accounts, and invoices.</p>
            </div>
          ) : totalMatches === 0 && !isLoading ? (
            <div className="py-8 text-center text-slate-400">
              <p className="text-xs font-bold text-slate-600">No matching records found for "{query}"</p>
              <p className="text-[11px] text-slate-400 mt-1">Try searching by product SKU, customer phone number, or Order ID.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Products Section */}
              {results.products.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                    <Package className="w-3 h-3 text-orange" />
                    <span>Products ({results.products.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.products.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          onNavigateTab('products', { search: p.sku });
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-orange/5 border border-transparent hover:border-orange/20 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-bold text-xs text-navy">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-navy">₹{p.price.toLocaleString('en-IN')}</div>
                          <span className="text-[9px] text-orange font-bold">View in Catalog &rarr;</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Section */}
              {results.orders.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                    <ShoppingBag className="w-3 h-3 text-purple" />
                    <span>Orders ({results.orders.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.orders.slice(0, 5).map((o) => (
                      <div
                        key={o.id}
                        onClick={() => {
                          onNavigateTab('orders', { search: o.orderNumber });
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-purple/5 border border-transparent hover:border-purple/20 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-bold text-xs text-navy flex items-center space-x-2">
                            <span>{o.orderNumber}</span>
                            <span className="text-[10px] font-bold text-purple bg-purple/10 px-1.5 py-0.5 rounded">
                              {o.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">{o.customerName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-navy">₹{o.grandTotal.toLocaleString('en-IN')}</div>
                          <span className="text-[9px] text-purple font-bold">Open Order &rarr;</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers Section */}
              {results.customers.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                    <Users className="w-3 h-3 text-emerald-600" />
                    <span>Customers ({results.customers.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.customers.slice(0, 4).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onNavigateTab('customers', { search: c.phone });
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-emerald-50 border border-transparent hover:border-emerald-200 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-bold text-xs text-navy">{c.name}</div>
                          <div className="text-[10px] text-slate-500">{c.phone} • {c.email}</div>
                        </div>
                        <span className="text-[9px] text-emerald-600 font-bold">View CRM &rarr;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices Section */}
              {results.invoices.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                    <Receipt className="w-3 h-3 text-gold" />
                    <span>Invoices ({results.invoices.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.invoices.slice(0, 3).map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => {
                          onNavigateTab('invoices', { search: inv.invoiceNumber });
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-amber-50 border border-transparent hover:border-amber-200 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-bold text-xs text-navy">{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-500">{inv.customerName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-navy">₹{inv.grandTotal.toLocaleString('en-IN')}</div>
                          <span className="text-[9px] text-amber-600 font-bold">View Invoice &rarr;</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-2">
            <span>Navigation:</span>
            <span className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[10px]">↑</span>
            <span className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[10px]">↓</span>
            <span>to navigate</span>
            <span className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[10px]">ESC</span>
            <span>to close</span>
          </div>
          <button onClick={onClose} className="font-bold text-navy hover:underline">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
