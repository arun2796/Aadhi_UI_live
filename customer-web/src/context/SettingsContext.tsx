import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

/* ─────────────────────────────────────────────────────────────
   Storefront-controlled settings (GET /api/v1/settings/public)
   Loaded once on mount; every value falls back to a sensible
   default when the endpoint is missing or a key is absent.
   ───────────────────────────────────────────────────────────── */

export interface DeliveryZone {
  state: string;
  allCities: boolean;
  cities: string[];
  minOrder: number;
  packingChargesPercent: number;
}

export interface StorefrontSettings {
  websiteStatus: 'ON' | 'OFF';
  thankYouMessage: string;
  footerMessage: string;
  priceFormat: 'Discount' | 'NetRate';
  promotionCodeEnabled: boolean;
  deliveryZones: DeliveryZone[];
  /** True once the settings request has resolved (successfully or not). */
  isLoaded: boolean;
}

const DEFAULT_SETTINGS: StorefrontSettings = {
  websiteStatus: 'ON',
  thankYouMessage: '',
  footerMessage: '',
  priceFormat: 'Discount',
  promotionCodeEnabled: true,
  deliveryZones: [],
  isLoaded: false
};

/** Parse the DeliveryZones.Config JSON string into typed zone entries (tolerant). */
const parseDeliveryZones = (raw?: string): DeliveryZone[] => {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    const states = Array.isArray(parsed?.states) ? parsed.states : Array.isArray(parsed) ? parsed : [];
    return states
      .map((z: any): DeliveryZone => ({
        state: String(z?.state ?? '').trim(),
        allCities: z?.allCities !== false && String(z?.allCities ?? 'true').toLowerCase() !== 'false',
        cities: Array.isArray(z?.cities) ? z.cities.map((c: any) => String(c)).filter(Boolean) : [],
        minOrder: Number(z?.minOrder) > 0 ? Number(z.minOrder) : 0,
        packingChargesPercent: Number(z?.packingChargesPercent) > 0 ? Number(z.packingChargesPercent) : 0
      }))
      .filter((z: DeliveryZone) => z.state.length > 0);
  } catch {
    return [];
  }
};

/** Case-insensitive lookup of the zone configured for a state (null = no zone → behave as today). */
export const findDeliveryZone = (zones: DeliveryZone[], state?: string | null): DeliveryZone | null => {
  const target = (state || '').trim().toLowerCase();
  if (!target) return null;
  return zones.find(z => z.state.trim().toLowerCase() === target) || null;
};

const mapSettings = (values: Record<string, string>): StorefrontSettings => ({
  websiteStatus: (values['Website.Status'] || 'ON').trim().toUpperCase() === 'OFF' ? 'OFF' : 'ON',
  thankYouMessage: (values['Website.ThankYouMessage'] || '').trim(),
  footerMessage: (values['Website.FooterMessage'] || '').trim(),
  priceFormat: (values['Website.PriceFormat'] || '').trim() === 'NetRate' ? 'NetRate' : 'Discount',
  promotionCodeEnabled: (values['Website.PromotionCodeEnabled'] || 'true').trim().toLowerCase() !== 'false',
  deliveryZones: parseDeliveryZones(values['DeliveryZones.Config']),
  isLoaded: true
});

const SettingsContext = createContext<StorefrontSettings>(DEFAULT_SETTINGS);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StorefrontSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let mounted = true;
    api.getPublicSettings()
      .then(values => {
        if (mounted) setSettings(mapSettings(values || {}));
      })
      .catch(() => {
        if (mounted) setSettings({ ...DEFAULT_SETTINGS, isLoaded: true });
      });
    return () => { mounted = false; };
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): StorefrontSettings => useContext(SettingsContext);
