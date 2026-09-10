import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { api } from '../services/api';
import type { Category, Product } from '../types';
import { buildPageSeo } from './schema.js';
import { slugifySegment } from './routes.js';
import { applySeo, siteOrigin, STATIC_DEFAULTS, type SeoDescriptor } from './head';

interface SeoHeadProps {
  /** The page id currently being shown (the same id passed to onNavigate). */
  page: string;
  /** The navigation params for that page. */
  params: Record<string, any>;
  /** False when the URL is not part of the scheme — the page is then noindexed. */
  matched: boolean;
}

/**
 * Renders nothing; keeps <head> in sync with the current page on every navigation.
 *
 * Business identity (name / address / phone / email) is read from the settings
 * API at runtime, so correcting the placeholders in the admin Settings screen
 * corrects the structured data with no redeploy.
 */
export const SeoHead: FC<SeoHeadProps> = ({ page, params, matched }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    let live = true;
    api.getPublicSettings().then((values) => {
      if (live) setSettings(values || {});
    });
    api.getCategories().then((list) => {
      if (live) setCategories(list || []);
    });
    return () => {
      live = false;
    };
  }, []);

  const productSlug = page === 'product-detail' ? String(params?.slug || '') : '';

  useEffect(() => {
    if (!productSlug) {
      setProduct(null);
      return;
    }
    let live = true;
    setProduct(null);
    // Deduplicated with the product page's own request by the cache in services/api.ts.
    api.getProductBySlug(productSlug).then((found) => {
      if (live) setProduct(found);
    });
    return () => {
      live = false;
    };
  }, [productSlug]);

  const rawCategory = page === 'shop' || page === 'category' ? String(params?.category || '') : '';

  const category = useMemo(() => {
    if (!rawCategory) return null;
    const wanted = slugifySegment(rawCategory);
    const flat: Category[] = [];
    const walk = (list: any[]) => {
      (list || []).forEach((c) => {
        if (!c) return;
        flat.push(c);
        if (Array.isArray(c.subCategories)) walk(c.subCategories);
      });
    };
    walk(categories as any[]);
    return (
      flat.find((c) => slugifySegment(c.slug) === wanted || String(c.id) === rawCategory) ||
      flat.find((c) => slugifySegment(c.name) === wanted) ||
      null
    );
  }, [categories, rawCategory]);

  useEffect(() => {
    const seo = buildPageSeo({
      page,
      params: params || {},
      matched,
      origin: siteOrigin(),
      settings,
      product,
      category,
      categories,
      defaultImage: STATIC_DEFAULTS.image
    }) as SeoDescriptor;
    applySeo(seo);
  }, [page, params, matched, settings, product, category, categories]);

  return null;
};
