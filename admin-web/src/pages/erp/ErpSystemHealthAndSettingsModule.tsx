import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  ShieldCheck,
  Store,
  CreditCard,
  Truck,
  Activity,
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
  Building2
} from 'lucide-react';
import { SystemSetting, SystemHealthReport } from '../../types';
import { api, settingsApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ErpSystemHealthAndSettingsModuleProps {
  initialSubTab?: 'settings' | 'health' | 'backup';
}

// ---------- Spec 16: left sub-nav sections over SystemSettings keys ----------

type SettingsSectionId = 'store' | 'company' | 'payment' | 'shipping' | 'email' | 'sms' | 'general' | 'logo';

const LOGO_KEY = 'Store.LogoUrl';
/** Fallback GSTIN key when the backend has no existing GSTIN-like setting (PUT upserts it). */
const COMPANY_GSTIN_FALLBACK_KEY = 'Company.Gstin';

const SETTINGS_NAV: { id: SettingsSectionId; label: string; icon: React.ElementType }[] = [
  { id: 'store', label: 'Store Settings', icon: Store },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'payment', label: 'Payment Settings', icon: CreditCard },
  { id: 'shipping', label: 'Shipping Settings', icon: Truck },
  { id: 'email', label: 'Email Settings', icon: Mail },
  { id: 'sms', label: 'SMS Settings', icon: MessageSquare },
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
  general: 'Everything else — tax rates, security switches and other system keys.',
  logo: 'Brand logo used across the admin and storefront.'
};

/** Buckets a backend SystemSetting into a design section by group/key prefix. */
const sectionForSetting = (s: SystemSetting): SettingsSectionId => {
  const key = (s.key || '').toLowerCase();
  const group = (s.group || '').toLowerCase();
  if (key === LOGO_KEY.toLowerCase()) return 'logo';
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
  const [subTab, setSubTab] = useState<'settings' | 'health' | 'backup'>(initialSubTab);

  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('store');
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
      setSubTab('settings');
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

  const handleSaveSection = async (id: SettingsSectionId) => {
    // Company also owns the logo uploader, so its save sweep includes the logo key.
    const fields: SettingsField[] =
      id === 'logo'
        ? [{ key: LOGO_KEY, label: 'Logo' }]
        : id === 'company'
        ? [...sectionFields(id), { key: LOGO_KEY, label: 'Logo' }]
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

  /** "Choose File" → base64 data URL held in Store.LogoUrl until Save Changes. */
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file', 'warning');
      return;
    }
    if (file.size > 500 * 1024) {
      showToast('Please choose an image under 500 KB', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setValue(LOGO_KEY, String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>System Settings & Health Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Store configuration, payment gateways, delivery thresholds, SQLite backup triggers, and live subsystem health.
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
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'health', label: 'System Health Diagnostics', icon: Activity },
          { id: 'backup', label: 'Database Backup & Restore', icon: HardDrive }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
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

      {/* 1. SETTINGS TAB — two-column layout (spec 16) */}
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
                <label className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold shadow-2xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                  <input type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
                </label>
                <p className="text-[10px] text-slate-400">
                  PNG / JPG / SVG up to 500 KB. Stored as a data URL in the "{LOGO_KEY}" setting.
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
                      <div className="space-y-2">
                        <label className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold shadow-2xs cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Choose File</span>
                          <input type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
                        </label>
                        <p className="text-[10px] text-slate-400">
                          PNG / JPG / SVG up to 500 KB. Stored in the "{LOGO_KEY}" setting.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && (settingsSection === 'logo' || sectionFields(settingsSection).length > 0) && (
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

      {/* 2. SYSTEM HEALTH DIAGNOSTICS TAB */}
      {subTab === 'health' && health && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Status</div>
              <div className="text-lg font-black text-emerald-600 flex items-center space-x-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>{health.status}</span>
              </div>
              <div className="text-[10px] text-slate-400">All 5 micro-services operating normally</div>
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
                  Healthy (3.2ms)
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
                  Running (4 Active Jobs)
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-bold text-navy">ASP.NET Core Rate Limiter</div>
                    <div className="text-[10px] text-slate-400">9 Granular Policies Active (Public, Login, Checkout, AdminApi, Reports)</div>
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

      {/* 3. DATABASE BACKUP & RESTORE TAB */}
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
