import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, RefreshCw, Trash2, XCircle, Percent, Ticket } from 'lucide-react';
import { api, apiClient, getApiErrorDetails } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../../components/common/Pagination';

const PAGE_SIZE = 10;

type OfferTab = 'all' | 'Active' | 'Scheduled' | 'Expired';
type OfferStatus = 'Active' | 'Scheduled' | 'Expired';

/** Inner split (?tab=discounts|codes): same /promotions data, two presentations. */
type MarketingViewTab = 'discounts' | 'codes';

/** Normalized view over the backend PromotionDto (/promotions). */
interface OfferRow {
  id: string;
  code: string;
  name: string;
  discountType: 'Percentage' | 'FixedAmount';
  discountValue: number;
  validFrom?: string;
  validTo?: string;
  isActive: boolean;
  usageCount?: number;
  usageLimit?: number;
}

/** Spec 13 derivation: Scheduled = validFrom in future; Expired = validTo past (or switched off);
 *  Active = now within validity window and isActive. */
const deriveOfferStatus = (offer: OfferRow): OfferStatus => {
  const now = Date.now();
  if (offer.validFrom && new Date(offer.validFrom).getTime() > now) return 'Scheduled';
  if (offer.validTo && new Date(offer.validTo).getTime() < now) return 'Expired';
  return offer.isActive ? 'Active' : 'Expired';
};

const OFFER_STATUS_STYLES: Record<OfferStatus, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Scheduled: 'bg-amber-100 text-amber-700',
  Expired: 'bg-red-100 text-red-700'
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const ErpMarketingModule: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [offerTab, setOfferTab] = useState<OfferTab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Inner split driven by ?tab=discounts|codes (sidebar deep links) — default Discounts
  const viewTab: MarketingViewTab = searchParams.get('tab') === 'codes' ? 'codes' : 'discounts';
  const setViewTab = (tab: MarketingViewTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  // Create Offer modal state
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  // "Show as" is a presentation hint only — the offer is always saved to /promotions unchanged.
  const [offerShowAs, setOfferShowAs] = useState<MarketingViewTab>('discounts');
  const [offerForm, setOfferForm] = useState({
    name: '',
    code: '',
    discountType: 'Percentage' as 'Percentage' | 'FixedAmount',
    discountValue: 10,
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const raw = await api.getCoupons({ pageSize: 100 });
      const rows: OfferRow[] = (raw as unknown as any[]).map((p) => ({
        id: p.id,
        code: p.code || '',
        name: p.name || p.code || 'Untitled Offer',
        discountType:
          p.discountType === 'FixedAmount' || p.type === 'Flat' ? 'FixedAmount' : 'Percentage',
        discountValue: Number(p.discountValue ?? p.value ?? 0),
        validFrom: p.startDateUtc,
        validTo: p.endDateUtc,
        isActive: p.isActive !== false,
        usageCount: typeof p.usageCount === 'number' ? p.usageCount : undefined,
        usageLimit: typeof p.usageLimit === 'number' ? p.usageLimit : undefined
      }));
      setOffers(rows);
    } catch {
      showToast('Failed to load offers & discounts', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveOffer = async () => {
    const { name, code, discountType, discountValue, validFrom, validTo } = offerForm;
    if (!name.trim() || !code.trim() || !discountValue || !validFrom || !validTo) {
      showToast('Offer name, code, discount value and validity dates are required', 'warning');
      return;
    }
    if (new Date(validTo) < new Date(validFrom)) {
      showToast('Valid To must be after Valid From', 'warning');
      return;
    }
    setIsSavingOffer(true);
    try {
      // Backend CreatePromotionRequest: { code, name, discountType, discountValue, startDateUtc, endDateUtc, isActive }
      await apiClient.post('/promotions', {
        code: code.toUpperCase().trim(),
        name: name.trim(),
        discountType,
        discountValue,
        startDateUtc: `${validFrom}T00:00:00Z`,
        endDateUtc: `${validTo}T23:59:59Z`,
        isActive: true
      });
      showToast(`Offer "${name.trim()}" created!`, 'success');
      setIsOfferModalOpen(false);
      setOfferForm({
        name: '',
        code: '',
        discountType: 'Percentage',
        discountValue: 10,
        validFrom: new Date().toISOString().slice(0, 10),
        validTo: new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
      });
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to create offer', 'error');
    } finally {
      setIsSavingOffer(false);
    }
  };

  const handleDeleteOffer = async (offer: OfferRow) => {
    if (window.confirm(`Delete offer "${offer.name}"?`)) {
      try {
        await api.deleteCoupon(offer.id);
        showToast(`Offer "${offer.name}" removed`, 'info');
        loadData();
      } catch {
        showToast('Failed to delete offer', 'error');
      }
    }
  };

  const filteredOffers = offers.filter((o) => {
    const matchesTab = offerTab === 'all' || deriveOfferStatus(o) === offerTab;
    const q = search.toLowerCase();
    const matchesSearch = !q || o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });
  const pagedOffers = filteredOffers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const offerTabs: { id: OfferTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Offers', count: offers.length },
    { id: 'Active', label: 'Active', count: offers.filter((o) => deriveOfferStatus(o) === 'Active').length },
    { id: 'Scheduled', label: 'Scheduled', count: offers.filter((o) => deriveOfferStatus(o) === 'Scheduled').length },
    { id: 'Expired', label: 'Expired', count: offers.filter((o) => deriveOfferStatus(o) === 'Expired').length }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>{viewTab === 'codes' ? 'Promotion Codes' : 'Offers / Discounts'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {viewTab === 'codes'
              ? 'Customer-entered promotion codes — track redemptions, validity windows and live status.'
              : 'Create percentage or flat discount offers with validity windows and monitor their live status.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setOfferShowAs(viewTab);
              setIsOfferModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Offer</span>
          </button>
        </div>
      </div>

      {/* Discounts | Promotion Codes split (?tab=discounts|codes) */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'discounts' as MarketingViewTab, label: 'Discounts', icon: Percent },
          { id: 'codes' as MarketingViewTab, label: 'Promotion Codes', icon: Ticket }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = viewTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setViewTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status tab bar (spec 13: All Offers | Active | Scheduled | Expired) */}
      <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
        {offerTabs.map((t) => {
          const isActive = offerTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setOfferTab(t.id);
                setPage(1);
              }}
              className={`pb-2.5 pt-1 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive ? 'border-purple text-purple' : 'border-transparent text-slate-500 hover:text-navy'
              }`}
            >
              {t.label}{' '}
              {t.count > 0 && <span className={isActive ? 'text-purple' : 'text-slate-400'}>({t.count})</span>}
            </button>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-96 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search offer name or code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
          />
        </div>
        <button className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs shrink-0">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
        </button>
      </div>

      {/* Offers table (spec 13) — Discounts view (name-first) or Promotion Codes view (code-first) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {viewTab === 'discounts' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Offer Name</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Discount</th>
                  <th className="py-3 px-3">Valid From</th>
                  <th className="py-3 px-3">Valid To</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pagedOffers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                      {isLoading ? 'Loading offers...' : 'No offers match your filters.'}
                    </td>
                  </tr>
                )}
                {pagedOffers.map((o) => {
                  const status = deriveOfferStatus(o);
                  return (
                    <tr key={o.id} className="hover:bg-purple/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy">{o.name}</div>
                        {o.code && <div className="text-[10px] text-slate-400 font-mono">{o.code}</div>}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {o.discountType === 'Percentage' ? '% Discount' : 'Flat Discount'}
                      </td>
                      <td className="py-3 px-3 font-black text-navy">
                        {o.discountType === 'Percentage'
                          ? `${o.discountValue}%`
                          : `₹${Math.round(o.discountValue).toLocaleString('en-IN')}`}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(o.validFrom)}</td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(o.validTo)}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${OFFER_STATUS_STYLES[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteOffer(o)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-2xs transition-all"
                          title="Delete offer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-3">Offer Name</th>
                  <th className="py-3 px-3">Discount</th>
                  <th className="py-3 px-3">Validity</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Usage</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pagedOffers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                      {isLoading ? 'Loading promotion codes...' : 'No promotion codes match your filters.'}
                    </td>
                  </tr>
                )}
                {pagedOffers.map((o) => {
                  const status = deriveOfferStatus(o);
                  return (
                    <tr key={o.id} className="hover:bg-purple/5 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-black text-purple">{o.code || '—'}</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-navy">{o.name}</td>
                      <td className="py-3 px-3 font-black text-navy">
                        {o.discountType === 'Percentage'
                          ? `${o.discountValue}% OFF`
                          : `₹${Math.round(o.discountValue).toLocaleString('en-IN')} OFF`}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {formatDate(o.validFrom)} — {formatDate(o.validTo)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${OFFER_STATUS_STYLES[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {o.usageCount !== undefined ? (
                          <span className="font-bold text-slate-600">
                            {o.usageCount}
                            {o.usageLimit ? ` / ${o.usageLimit}` : ' used'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteOffer(o)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-2xs transition-all"
                          title="Delete promotion code"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 pb-4">
          <Pagination page={page} pageSize={PAGE_SIZE} total={filteredOffers.length} onPageChange={setPage} />
        </div>
      </div>

      {/* CREATE OFFER MODAL */}
      {isOfferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">Create Offer</h3>
              <button onClick={() => setIsOfferModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Offer Name *</label>
                <input
                  type="text"
                  value={offerForm.name}
                  onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })}
                  placeholder="e.g. Diwali Special"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Offer Code *</label>
                <input
                  type="text"
                  value={offerForm.code}
                  onChange={(e) => setOfferForm({ ...offerForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. DIWALI20"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-purple outline-none focus:border-purple uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Show as</label>
                <select
                  value={offerShowAs}
                  onChange={(e) => setOfferShowAs(e.target.value as MarketingViewTab)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none font-bold text-navy"
                >
                  <option value="discounts">Discount offer</option>
                  <option value="codes">Promotion code</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Display hint only — every offer stays redeemable by its code and appears in both views.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Type *</label>
                  <select
                    value={offerForm.discountType}
                    onChange={(e) =>
                      setOfferForm({ ...offerForm, discountType: e.target.value as 'Percentage' | 'FixedAmount' })
                    }
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none font-bold text-navy"
                  >
                    <option value="Percentage">% Discount</option>
                    <option value="FixedAmount">Flat Discount</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-navy">
                    Discount {offerForm.discountType === 'Percentage' ? '(%)' : '(₹)'} *
                  </label>
                  <input
                    type="number"
                    value={offerForm.discountValue}
                    onChange={(e) => setOfferForm({ ...offerForm, discountValue: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none font-bold text-navy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Valid From *</label>
                  <input
                    type="date"
                    value={offerForm.validFrom}
                    onChange={(e) => setOfferForm({ ...offerForm, validFrom: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none text-navy"
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">Valid To *</label>
                  <input
                    type="date"
                    value={offerForm.validTo}
                    onChange={(e) => setOfferForm({ ...offerForm, validTo: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none text-navy"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsOfferModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOffer}
                disabled={isSavingOffer}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 disabled:opacity-50"
              >
                {isSavingOffer ? 'Saving...' : 'Save Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
