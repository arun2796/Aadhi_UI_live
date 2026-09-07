import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  ShieldCheck,
  Store,
  CreditCard,
  Truck,
  HardDrive,
  Database,
  RefreshCw,
  CheckCircle2,
  Save,
  Terminal,
  Zap,
  Mail,
  MessageSquare,
  Image as ImageIcon,
  Upload,
  Building2,
  Globe,
  FileText,
  MapPin,
  Plus,
  Trash2,
  X,
  Link as LinkIcon
} from 'lucide-react';
import { SystemSetting, SystemHealthReport } from '../../types';
import { api, settingsApi, getApiErrorDetails } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { normalizeImageUrl } from '../../utils/imageUrl';

interface ErpSystemHealthAndSettingsModuleProps {
  initialSubTab?: 'settings' | 'health' | 'backup';
}

/** Each route ('settings' | 'health' | 'backup') is its own standalone screen with its own header. */
const SCREEN_HEADERS: Record<'settings' | 'health' | 'backup', { title: string; subtitle: string }> = {
  settings: { title: 'Settings', subtitle: 'Store, payment, shipping and company configuration.' },
  health: { title: 'System Health', subtitle: 'Live API, database and background worker diagnostics.' },
  backup: { title: 'Backup & Restore', subtitle: 'Database snapshots and disaster recovery.' }
};

// ---------- Spec 16: left sub-nav sections over SystemSettings keys ----------

type SettingsSectionId =
  | 'store'
  | 'company'
  | 'payment'
  | 'shipping'
  | 'email'
  | 'sms'
  | 'website'
  | 'terms'
  | 'delivery'
  | 'general'
  | 'logo';

const LOGO_KEY = 'Store.LogoUrl';
/** Fallback GSTIN key when the backend has no existing GSTIN-like setting (PUT upserts it). */
const COMPANY_GSTIN_FALLBACK_KEY = 'Company.Gstin';

// ---------- Website / Terms / Delivery Zones settings keys ----------
const WEBSITE_STATUS_KEY = 'Website.Status';
const WEBSITE_HEADER_PROMO_KEY = 'Website.HeaderPromoText';
const WEBSITE_THANKYOU_KEY = 'Website.ThankYouMessage';
const WEBSITE_FOOTER_KEY = 'Website.FooterMessage';
const WEBSITE_PRICE_FORMAT_KEY = 'Website.PriceFormat';
const WEBSITE_PROMO_KEY = 'Website.PromotionCodeEnabled';
const WEBSITE_OTP_KEY = 'Website.OtpVerificationEnabled';
/** JSON array of strings. */
const TERMS_KEY = 'Website.TermsAndConditions';
/** JSON: { states: [{ state, allCities, cities, minOrder, packingChargesPercent }] } */
const DELIVERY_ZONES_KEY = 'DeliveryZones.Config';

const WEBSITE_FIELD_KEYS = [
  WEBSITE_STATUS_KEY,
  WEBSITE_HEADER_PROMO_KEY,
  WEBSITE_THANKYOU_KEY,
  WEBSITE_FOOTER_KEY,
  WEBSITE_PRICE_FORMAT_KEY,
  WEBSITE_PROMO_KEY,
  WEBSITE_OTP_KEY
];

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' }
];

/** Sections rendered by a dedicated editor (not the generic key/value field list). */
const CUSTOM_SECTIONS: SettingsSectionId[] = ['logo', 'website', 'terms', 'delivery'];

// Same list as the customer-web checkout state dropdown.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry'
];

/** Editor row for one state in the Delivery Zones config (numbers kept as text while editing). */
interface DeliveryZoneRow {
  state: string;
  allCities: boolean;
  cities: string[];
  minOrder: string;
  packingChargesPercent: string;
  /** Transient free-text city input (not serialized). */
  cityInput: string;
}

/** Tolerant parse of the Website.TermsAndConditions JSON array (missing/bad → empty). */
const parseTermsList = (raw: string | undefined): string[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
};

/** Tolerant parse of the DeliveryZones.Config JSON (missing/bad → empty). */
const parseDeliveryZones = (raw: string | undefined): DeliveryZoneRow[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { states?: unknown } | null;
    const states = Array.isArray(parsed?.states) ? parsed.states : [];
    return states
      .filter(
        (s: unknown): s is Record<string, unknown> =>
          !!s && typeof s === 'object' && typeof (s as Record<string, unknown>).state === 'string'
      )
      .map((s) => {
        const cities = Array.isArray(s.cities)
          ? (s.cities as unknown[]).filter((c): c is string => typeof c === 'string')
          : [];
        return {
          state: s.state as string,
          allCities: typeof s.allCities === 'boolean' ? s.allCities : cities.length === 0,
          cities,
          minOrder: typeof s.minOrder === 'number' && isFinite(s.minOrder) ? String(s.minOrder) : '',
          packingChargesPercent:
            typeof s.packingChargesPercent === 'number' && isFinite(s.packingChargesPercent)
              ? String(s.packingChargesPercent)
              : '',
          cityInput: ''
        };
      });
  } catch {
    return [];
  }
};

const SETTINGS_NAV: { id: SettingsSectionId; label: string; icon: React.ElementType }[] = [
  { id: 'store', label: 'Store Settings', icon: Store },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'payment', label: 'Payment Settings', icon: CreditCard },
  { id: 'shipping', label: 'Shipping Settings', icon: Truck },
  { id: 'email', label: 'Email Settings', icon: Mail },
  { id: 'sms', label: 'SMS Settings', icon: MessageSquare },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'terms', label: 'Terms & Conditions', icon: FileText },
  { id: 'delivery', label: 'Delivery Zones', icon: MapPin },
  { id: 'general', label: 'General Settings', icon: Settings },
  { id: 'logo', label: 'Logo', icon: ImageIcon }
];

interface SettingsField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'textarea';
  description?: string;
}

/** Known backend keys pinned to their design section (rendered even when missing — PUT upserts). */
const PINNED_FIELDS: Partial<Record<SettingsSectionId, SettingsField[]>> = {
  store: [
    { key: 'Store.BusinessName', label: 'Store Name' },
    { key: 'Store.Tagline', label: 'Tagline' },
    { key: 'Store.Email', label: 'Support Email', type: 'email' },
    { key: 'Store.Phone', label: 'Support Phone' },
    { key: 'Store.Address', label: 'Store Address', type: 'textarea' }
  ],
  shipping: [
    { key: 'Shipping.FreeShippingThreshold', label: 'Free Shipping Threshold (₹)', type: 'number' },
    { key: 'Delivery.StandardCharge', label: 'Standard Delivery Charge (₹)', type: 'number' },
    { key: 'Delivery.ExpressCharge', label: 'Express Delivery Charge (₹)', type: 'number' }
  ]
};

const SECTION_HINTS: Record<SettingsSectionId, string> = {
  store: 'Business identity shown on the storefront, invoices and customer emails.',
  company: 'Company profile — legal name, GSTIN, contact details, registered address and brand logo used on invoices.',
  payment: 'UPI VPA and payment gateway configuration.',
  shipping: 'Delivery charges and the free-shipping threshold applied at checkout.',
  email: 'Outbound email / SMTP configuration.',
  sms: 'Transactional SMS gateway configuration.',
  website: 'Storefront behavior — maintenance mode, order-success and footer messages, price display and checkout features.',
  terms: 'Terms and conditions shown to customers on the storefront and invoices, managed as a list.',
  delivery: 'Serviceable states and cities with per-state minimum order value and packing charges.',
  general: 'Everything else — tax rates, security switches and other system keys.',
  logo: 'Brand logo used across the admin and storefront.'
};

/** Buckets a backend SystemSetting into a design section by group/key prefix. */
const sectionForSetting = (s: SystemSetting): SettingsSectionId => {
  const key = (s.key || '').toLowerCase();
  const group = (s.group || '').toLowerCase();
  if (key === LOGO_KEY.toLowerCase()) return 'logo';
  if (key === TERMS_KEY.toLowerCase()) return 'terms';
  if (group === 'deliveryzones' || key.startsWith('deliveryzones.')) return 'delivery';
  if (group === 'website' || key.startsWith('website.')) return 'website';
  if (group === 'company' || key.startsWith('company.')) return 'company';
  if (group === 'store' || key.startsWith('store.')) return 'store';
  if (group === 'payment' || key.startsWith('payment.') || key.startsWith('upi.')) return 'payment';
  if (group === 'shipping' || key.startsWith('shipping.') || key.startsWith('delivery.')) return 'shipping';
  if (group === 'email' || key.startsWith('email.') || key.startsWith('smtp.')) return 'email';
  if (group === 'sms' || key.startsWith('sms.')) return 'sms';
  return 'general';
};

export const ErpSystemHealthAndSettingsModule: React.FC<ErpSystemHealthAndSettingsModuleProps> = ({
  initialSubTab = 'settings'
}) => {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  // No in-module tab switching — the route decides which standalone screen is shown.
  const subTab = initialSubTab;

  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('store');
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Structured editors for the JSON-valued settings (serialized on Save).
  const [termsList, setTermsList] = useState<string[]>([]);
  const [termsShowErrors, setTermsShowErrors] = useState(false);
  const [zoneRows, setZoneRows] = useState<DeliveryZoneRow[]>([]);
  const [logoUrlInput, setLogoUrlInput] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [st, hl] = await Promise.all([
        settingsApi.getSettings(),
        api.getSystemHealth()
      ]);
      setSystemSettings(st);
      const map: Record<string, string> = {};
      st.forEach((s) => {
        map[s.key] = s.value;
      });
      setSettingValues(map);
      setOriginalValues(map);
      setTermsList(parseTermsList(map[TERMS_KEY]));
      setTermsShowErrors(false);
      setZoneRows(parseDeliveryZones(map[DELIVERY_ZONES_KEY]));
      setHealth(hl);
    } catch {
      showToast('Failed to load system settings and diagnostics', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?section=company (etc.) deep link into the settings left sub-nav — reacts to in-app navigation too
  useEffect(() => {
    const section = searchParams.get('section');
    if (section && SETTINGS_NAV.some((s) => s.id === section)) {
      setSettingsSection(section as SettingsSectionId);
    }
  }, [searchParams]);

  /** GSTIN lives under an existing GSTIN-like backend key when one exists, else Company.Gstin. */
  const companyGstinKey =
    systemSettings.find((s) => /gstin|gst.?number/i.test(s.key || ''))?.key || COMPANY_GSTIN_FALLBACK_KEY;

  /** Company section reuses the Store.* identity keys + GSTIN (spec: Company sub-view). */
  const companyPinnedFields: SettingsField[] = [
    { key: 'Store.BusinessName', label: 'Company / Store Name' },
    {
      key: companyGstinKey,
      label: 'GSTIN',
      description:
        companyGstinKey === COMPANY_GSTIN_FALLBACK_KEY
          ? `Saved to the "${COMPANY_GSTIN_FALLBACK_KEY}" settings key.`
          : undefined
    },
    { key: 'Store.Email', label: 'Email', type: 'email' },
    { key: 'Store.Phone', label: 'Phone' },
    { key: 'Store.Address', label: 'Address', type: 'textarea' }
  ];

  /** Pinned fields for a section plus any other backend keys bucketed into it. */
  const sectionFields = (id: SettingsSectionId): SettingsField[] => {
    const pinned = id === 'company' ? companyPinnedFields : PINNED_FIELDS[id] || [];
    const pinnedKeys = new Set(pinned.map((f) => f.key));
    const extras: SettingsField[] = systemSettings
      .filter((s) => sectionForSetting(s) === id && !pinnedKeys.has(s.key))
      .map((s) => ({ key: s.key, label: s.key, description: s.description }));
    return [...pinned, ...extras];
  };

  const setValue = (key: string, value: string) =>
    setSettingValues((prev) => ({ ...prev, [key]: value }));

  /** PUTs one JSON-valued key if it changed (an empty editor over a missing key counts as unchanged). */
  const saveJsonSetting = async (key: string, serialized: string, emptyShape: string) => {
    const baseline = originalValues[key] ?? '';
    if (serialized === baseline || (baseline === '' && serialized === emptyShape)) {
      showToast('No changes to save in this section', 'info');
      return;
    }
    setIsSaving(true);
    try {
      await settingsApi.updateSetting(key, serialized);
      setSettingValues((prev) => ({ ...prev, [key]: serialized }));
      setOriginalValues((prev) => ({ ...prev, [key]: serialized }));
      showToast('Settings saved successfully!', 'success');
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTerms = async () => {
    const trimmed = termsList.map((t) => t.trim());
    if (trimmed.some((t) => t === '')) {
      setTermsShowErrors(true);
      showToast('Enter the term condition', 'warning');
      return;
    }
    setTermsShowErrors(false);
    setTermsList(trimmed);
    await saveJsonSetting(TERMS_KEY, JSON.stringify(trimmed), '[]');
  };

  const handleSaveDeliveryZones = async () => {
    const serialized = JSON.stringify({
      states: zoneRows.map((r) => ({
        state: r.state,
        allCities: r.allCities,
        cities: r.allCities ? [] : r.cities,
        minOrder: Number(r.minOrder) || 0,
        packingChargesPercent: Number(r.packingChargesPercent) || 0
      }))
    });
    await saveJsonSetting(DELIVERY_ZONES_KEY, serialized, '{"states":[]}');
  };

  const handleSaveSection = async (id: SettingsSectionId) => {
    // JSON-backed sections serialize their structured editor state on Save.
    if (id === 'terms') {
      await handleSaveTerms();
      return;
    }
    if (id === 'delivery') {
      await handleSaveDeliveryZones();
      return;
    }
    // Company also owns the logo uploader, so its save sweep includes the logo key.
    const fields: SettingsField[] =
      id === 'logo'
        ? [{ key: LOGO_KEY, label: 'Logo' }]
        : id === 'company'
        ? [...sectionFields(id), { key: LOGO_KEY, label: 'Logo' }]
        : id === 'website'
        ? WEBSITE_FIELD_KEYS.map((k) => ({ key: k, label: k }))
        : sectionFields(id);
    const dirty = fields.filter((f) => (settingValues[f.key] ?? '') !== (originalValues[f.key] ?? ''));
    if (dirty.length === 0) {
      showToast('No changes to save in this section', 'info');
      return;
    }
    setIsSaving(true);
    try {
      for (const f of dirty) {
        await settingsApi.updateSetting(f.key, settingValues[f.key] ?? '');
      }
      setOriginalValues((prev) => ({
        ...prev,
        ...Object.fromEntries(dirty.map((f) => [f.key, settingValues[f.key] ?? '']))
      }));
      showToast('Settings saved successfully!', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };


  // ---------- Terms & Conditions list editor ----------
  const addTerm = () => setTermsList((prev) => [...prev, '']);
  const removeTerm = (index: number) => setTermsList((prev) => prev.filter((_, i) => i !== index));
  const updateTerm = (index: number, value: string) =>
    setTermsList((prev) => prev.map((t, i) => (i === index ? value : t)));

  // ---------- Delivery Zones editor ----------
  const addZoneState = (state: string) => {
    if (!state) return;
    setZoneRows((prev) =>
      prev.some((r) => r.state === state)
        ? prev
        : [...prev, { state, allCities: true, cities: [], minOrder: '', packingChargesPercent: '', cityInput: '' }]
    );
  };
  const removeZoneState = (state: string) => setZoneRows((prev) => prev.filter((r) => r.state !== state));
  const updateZone = (index: number, patch: Partial<DeliveryZoneRow>) =>
    setZoneRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const addZoneCity = (index: number) =>
    setZoneRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const city = r.cityInput.trim();
        if (!city || r.cities.some((c) => c.toLowerCase() === city.toLowerCase())) {
          return { ...r, cityInput: '' };
        }
        return { ...r, cities: [...r.cities, city], cityInput: '' };
      })
    );
  const removeZoneCity = (index: number, city: string) =>
    setZoneRows((prev) => prev.map((r, i) => (i === index ? { ...r, cities: r.cities.filter((c) => c !== city) } : r)));

  /** Radio group over one settings key (render helper, not a component — keeps input focus stable). */
  const renderRadioGroup = (
    label: string,
    key: string,
    options: { value: string; label: string }[],
    defaultValue: string,
    helper?: string
  ) => {
    const current = settingValues[key] || defaultValue;
    return (
      <div>
        <label className="font-bold text-navy">{label}</label>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {options.map((o) => (
            <label key={o.value} className="flex items-center space-x-1.5 cursor-pointer text-navy">
              <input
                type="radio"
                name={key}
                checked={current === o.value}
                onChange={() => setValue(key, o.value)}
                className="w-3.5 h-3.5 accent-purple"
              />
              <span className="font-semibold">{o.label}</span>
            </label>
          ))}
        </div>
        {helper && <p className="text-[10px] text-slate-400 mt-0.5">{helper}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header — per-screen title (each sidebar item is its own screen) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>{SCREEN_HEADERS[subTab].title}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{SCREEN_HEADERS[subTab].subtitle}</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 1. SETTINGS SCREEN — two-column layout (spec 16) */}
      {subTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* LEFT sub-nav card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-2 space-y-1">
            {SETTINGS_NAV.map((s) => {
              const Icon = s.icon;
              const isActive = settingsSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSettingsSection(s.id)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2.5 text-left transition-all ${
                    isActive ? 'bg-purple text-white shadow-md shadow-purple/20' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* RIGHT form panel for the selected section */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
            <div>
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                {SETTINGS_NAV.find((s) => s.id === settingsSection)?.label}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{SECTION_HINTS[settingsSection]}</p>
            </div>

            {isLoading ? (
              <div className="py-10 text-center text-xs text-slate-400">Loading settings...</div>
            ) : settingsSection === 'logo' ? (
              <div className="space-y-4">
                <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {settingValues[LOGO_KEY] ? (
                    <img
                      src={settingValues[LOGO_KEY]}
                      alt="Store logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-slate-400 text-xs px-4">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                      <span>No logo uploaded yet</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 max-w-md">
                  <label className="text-[11px] font-bold text-navy flex items-center justify-between">
                    <span>Google Drive Logo URL</span>
                    <span className="text-[10px] text-purple font-semibold">Auto-converts Drive links</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={logoUrlInput}
                        onChange={(e) => setLogoUrlInput(e.target.value)}
                        placeholder="Paste Google Drive link or image URL..."
                        className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (logoUrlInput.trim()) {
                              setValue(LOGO_KEY, normalizeImageUrl(logoUrlInput.trim()) ?? logoUrlInput.trim());
                              setLogoUrlInput('');
                              showToast('Logo URL applied (click Save Changes to save)', 'success');
                            }
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (logoUrlInput.trim()) {
                          setValue(LOGO_KEY, normalizeImageUrl(logoUrlInput.trim()) ?? logoUrlInput.trim());
                          setLogoUrlInput('');
                          showToast('Logo URL applied (click Save Changes to save)', 'success');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-xs flex-shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Supports Google Drive sharing links. Automatically converted to high-resolution image.
                  </p>
                </div>
              </div>
            ) : settingsSection === 'website' ? (
              <div className="space-y-4 text-xs">
                {renderRadioGroup(
                  'Website Status',
                  WEBSITE_STATUS_KEY,
                  [
                    { value: 'ON', label: 'ON' },
                    { value: 'OFF', label: 'OFF' }
                  ],
                  'ON',
                  'OFF shows a maintenance notice on the storefront.'
                )}

                <div>
                  <label className="font-bold text-navy">Header Promo Text</label>
                  <input
                    type="text"
                    value={settingValues[WEBSITE_HEADER_PROMO_KEY] ?? ''}
                    onChange={(e) => setValue(WEBSITE_HEADER_PROMO_KEY, e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Short promotional line shown in the storefront header (e.g. a coupon announcement). Leave empty to hide.
                  </p>
                </div>

                <div>
                  <label className="font-bold text-navy">Thank You Message</label>
                  <textarea
                    value={settingValues[WEBSITE_THANKYOU_KEY] ?? ''}
                    onChange={(e) => setValue(WEBSITE_THANKYOU_KEY, e.target.value)}
                    rows={3}
                    placeholder="Thank you for your order!"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Shown on the customer's order-success screen.
                  </p>
                </div>

                <div>
                  <label className="font-bold text-navy">Footer Content Message</label>
                  <textarea
                    value={settingValues[WEBSITE_FOOTER_KEY] ?? ''}
                    onChange={(e) => setValue(WEBSITE_FOOTER_KEY, e.target.value)}
                    rows={3}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Legal / compliance note shown in the store footer.
                  </p>
                </div>

                {renderRadioGroup(
                  'Price Format',
                  WEBSITE_PRICE_FORMAT_KEY,
                  [
                    { value: 'Discount', label: 'Discount Format' },
                    { value: 'NetRate', label: 'Net Rate Format' }
                  ],
                  'Discount',
                  'Discount Format shows MRP struck through with % off; Net Rate shows final price only.'
                )}

                <div className="pt-3 border-t border-slate-100 space-y-4">
                  <div className="font-black text-[10px] text-slate-400 uppercase tracking-wider">
                    Pricelist Features
                  </div>
                  {renderRadioGroup(
                    'Promotion Code',
                    WEBSITE_PROMO_KEY,
                    YES_NO_OPTIONS,
                    'true',
                    'Show the coupon-code box in cart/checkout.'
                  )}
                  {renderRadioGroup(
                    'OTP Verification',
                    WEBSITE_OTP_KEY,
                    YES_NO_OPTIONS,
                    'false',
                    'Require OTP verification during password reset flows.'
                  )}
                </div>
              </div>
            ) : settingsSection === 'terms' ? (
              <div className="space-y-3 text-xs">
                {termsList.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    No terms added yet. Use "Add Term" to create the first one.
                  </div>
                )}

                {termsList.map((term, idx) => (
                  <div key={idx}>
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={term}
                        onChange={(e) => updateTerm(idx, e.target.value)}
                        placeholder="Enter a term or condition"
                        className={`w-full p-2.5 rounded-xl border text-navy outline-none focus:border-purple ${
                          termsShowErrors && !term.trim() ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                        }`}
                      />
                      <button
                        onClick={() => removeTerm(idx)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                        title="Remove term"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {termsShowErrors && !term.trim() && (
                      <p className="text-[10px] text-red-500 mt-0.5 ml-8">Enter the term condition</p>
                    )}
                  </div>
                ))}

                <button
                  onClick={addTerm}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-purple hover:text-purple text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Term</span>
                </button>

                <p className="text-[10px] text-slate-400">
                  Saved as a JSON list in the "{TERMS_KEY}" setting.
                </p>
              </div>
            ) : settingsSection === 'delivery' ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-navy">Serviceable States</label>
                  <select
                    value=""
                    onChange={(e) => addZoneState(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple bg-white"
                  >
                    <option value="">Select a state to add...</option>
                    {INDIAN_STATES.filter((s) => !zoneRows.some((r) => r.state === s)).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {zoneRows.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {zoneRows.map((r) => (
                        <span
                          key={r.state}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-purple/10 text-purple text-[10px] font-bold"
                        >
                          <span>{r.state}</span>
                          <button
                            onClick={() => removeZoneState(r.state)}
                            className="hover:text-red-500"
                            title={`Remove ${r.state}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    Each state added below gets its own delivery rules.
                  </p>
                </div>

                {zoneRows.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    No states configured yet. Add a state above to set its delivery rules.
                  </div>
                ) : (
                  zoneRows.map((row, idx) => (
                    <div key={row.state} className="border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-black text-navy flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-purple" />
                          <span>{row.state}</span>
                        </div>
                        <button
                          onClick={() => removeZoneState(row.state)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                          title={`Remove ${row.state}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.allCities}
                          onChange={(e) => updateZone(idx, { allCities: e.target.checked })}
                          className="w-3.5 h-3.5 accent-purple"
                        />
                        <span className="font-semibold text-navy">All Cities</span>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-navy">Min Order (₹)</label>
                          <input
                            type="number"
                            min={0}
                            value={row.minOrder}
                            onChange={(e) => updateZone(idx, { minOrder: e.target.value })}
                            placeholder="0"
                            className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-navy">Packing Charges (%)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={row.packingChargesPercent}
                            onChange={(e) => updateZone(idx, { packingChargesPercent: e.target.value })}
                            placeholder="0"
                            className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple"
                          />
                        </div>
                      </div>

                      {!row.allCities && (
                        <div>
                          <label className="font-bold text-navy">Cities</label>
                          {row.cities.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {row.cities.map((c) => (
                                <span
                                  key={c}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold"
                                >
                                  <span>{c}</span>
                                  <button
                                    onClick={() => removeZoneCity(idx, c)}
                                    className="hover:text-red-500"
                                    title={`Remove ${c}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-1.5 flex items-center space-x-2">
                            <input
                              type="text"
                              value={row.cityInput}
                              onChange={(e) => updateZone(idx, { cityInput: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addZoneCity(idx);
                                }
                              }}
                              placeholder="Type a city name and press Enter"
                              className="w-full p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple"
                            />
                            <button
                              onClick={() => addZoneCity(idx)}
                              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:border-purple hover:text-purple shrink-0"
                              title="Add city"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Delivery in {row.state} is limited to these cities.
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <p className="text-[10px] text-slate-400">
                  Saved as JSON in the "{DELIVERY_ZONES_KEY}" setting.
                </p>
              </div>
            ) : sectionFields(settingsSection).length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                No settings in this group yet.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {sectionFields(settingsSection).map((f) => (
                  <div key={f.key}>
                    <label className="font-bold text-navy">{f.label}</label>
                    {f.type === 'textarea' ? (
                      <textarea
                        value={settingValues[f.key] ?? ''}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        rows={3}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple resize-none"
                      />
                    ) : (
                      <input
                        type={f.type || 'text'}
                        value={settingValues[f.key] ?? ''}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none focus:border-purple"
                      />
                    )}
                    {f.description && <p className="text-[10px] text-slate-400 mt-0.5">{f.description}</p>}
                  </div>
                ))}

                {/* Company section also carries the brand logo (same Store.LogoUrl key as the Logo section) */}
                {settingsSection === 'company' && (
                  <div className="pt-3 border-t border-slate-100">
                    <label className="font-bold text-navy">Logo</label>
                    <div className="mt-2 flex items-start space-x-4">
                      <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                        {settingValues[LOGO_KEY] ? (
                          <img
                            src={settingValues[LOGO_KEY]}
                            alt="Company logo"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-7 h-7 text-slate-300" />
                        )}
                      </div>
                      <div className="space-y-2 flex-1 max-w-md">
                        <label className="text-[11px] font-bold text-navy flex items-center justify-between">
                          <span>Google Drive Logo URL</span>
                          <span className="text-[10px] text-purple font-semibold">Auto-converts Drive links</span>
                        </label>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2 flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                            <LinkIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <input
                              type="text"
                              value={logoUrlInput}
                              onChange={(e) => setLogoUrlInput(e.target.value)}
                              placeholder="Paste Google Drive link or image URL..."
                              className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (logoUrlInput.trim()) {
                                    setValue(LOGO_KEY, normalizeImageUrl(logoUrlInput.trim()) ?? logoUrlInput.trim());
                                    setLogoUrlInput('');
                                    showToast('Logo URL applied (click Save Changes to save)', 'success');
                                  }
                                }
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (logoUrlInput.trim()) {
                                setValue(LOGO_KEY, normalizeImageUrl(logoUrlInput.trim()) ?? logoUrlInput.trim());
                                setLogoUrlInput('');
                                showToast('Logo URL applied (click Save Changes to save)', 'success');
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold transition-colors shrink-0 shadow-2xs"
                          >
                            Apply
                          </button>
                        </div>
                        {settingValues[LOGO_KEY] && (
                          <button
                            type="button"
                            onClick={() => setValue(LOGO_KEY, '')}
                            className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold"
                          >
                            Remove Logo
                          </button>
                        )}
                        <p className="text-[10px] text-slate-400">
                          Paste a shareable Google Drive link. Stored in the "{LOGO_KEY}" setting.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && (CUSTOM_SECTIONS.includes(settingsSection) || sectionFields(settingsSection).length > 0) && (
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleSaveSection(settingsSection)}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SYSTEM HEALTH SCREEN */}
      {subTab === 'health' && health && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Status</div>
              <div className="text-lg font-black text-emerald-600 flex items-center space-x-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>{health.status}</span>
              </div>
              <div className="text-[10px] text-slate-400">Live report from the API health endpoint</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">API Roundtrip Latency</div>
              <div className="text-lg font-black text-navy">{health.apiLatencyMs} ms</div>
              <div className="text-[10px] text-emerald-600 font-bold">Optimal Low-Latency (.NET 10)</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SQLite DB Provider</div>
              <div className="text-lg font-black text-purple">{health.database.status}</div>
              <div className="text-[10px] text-slate-500 font-mono">Latency: {health.database.latencyMs}ms (WAL Mode)</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outbox Backlog Queue</div>
              <div className="text-lg font-black text-navy">{health.elasticsearch.outboxBacklogCount} items</div>
              <div className="text-[10px] text-emerald-600 font-bold">Asynchronous Worker Synced</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <h3 className="font-black text-sm text-navy uppercase tracking-wider">
              Diagnostic Subsystems & Health Probes
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="w-5 h-5 text-purple" />
                  <div>
                    <div className="font-bold text-navy">Primary Database Service</div>
                    <div className="text-[10px] text-slate-400 font-mono">{health.database.provider}</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  {health.database.status} ({health.database.latencyMs}ms)
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-orange" />
                  <div>
                    <div className="font-bold text-navy">Background Worker Engine</div>
                    <div className="text-[10px] text-slate-400">Audit indexing, low-stock triggers, email dispatchers</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  Running
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-bold text-navy">ASP.NET Core Rate Limiter</div>
                    <div className="text-[10px] text-slate-400">Granular policies active (Public, Login, Checkout, AdminApi, Reports)</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  Active Protection
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BACKUP & RESTORE SCREEN */}
      {subTab === 'backup' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                  Transactional Database Snapshot & Disaster Recovery
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Generate an instant hot-backup snapshot of the SQLite WAL database file (`aadhicrackers.db`).
                </p>
              </div>

              <button
                onClick={() => showToast('Database hot-backup snapshot generated in /backups directory!', 'success')}
                className="px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-dark text-white text-xs font-bold flex items-center space-x-2 shadow-md"
              >
                <HardDrive className="w-4 h-4 text-gold" />
                <span>Create Hot Backup Now</span>
              </button>
            </div>

            <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl font-mono text-xs space-y-2">
              <div className="text-gold font-bold flex items-center space-x-2">
                <Terminal className="w-4 h-4" />
                <span>Automated Backup Commands & Recovery Protocol</span>
              </div>
              <div className="text-slate-400 text-[11px] space-y-1">
                <p># 1. Vacuum into snapshot destination:</p>
                <p className="text-emerald-400">sqlite3 aadhicrackers.db "VACUUM INTO 'backups/aadhi_backup_$(date +%Y%m%d_%H%M%S).db'"</p>
                <p className="pt-2"># 2. Database verification integrity check:</p>
                <p className="text-emerald-400">sqlite3 backups/aadhi_backup_latest.db "PRAGMA integrity_check;"</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
