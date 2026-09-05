import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { api } from '../services/api';

/**
 * Wishlist state — persisted to localStorage ('aadhi_wishlist') so it works offline,
 * and, when a customer is signed in (localStorage 'aadhi_customer_token' present),
 * synced with the server wishlist:
 *   - on mount: api.getWishlist() is merged into local state (server data refreshes
 *     price / stock / image, unseen server items are appended, local-only items are
 *     pushed up to the server),
 *   - on change: fire-and-forget api.addToWishlist / api.removeFromWishlist.
 * All server calls are best-effort; failures never break the local wishlist.
 */

interface WishlistContextType {
  wishlist: Product[];
  toggleWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY = 'aadhi_wishlist';
const TOKEN_KEY = 'aadhi_customer_token';

const hasCustomerToken = () => {
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
};

const loadLocalWishlist = (): Product[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => p && p.id) : [];
  } catch {
    return [];
  }
};

/**
 * Maps a server wishlist entry (`{ id, productId, product: { id, name, slug, price,
 * mrp, discountPercent, imageUrl, inStock }, createdAt }` per API contract) to the
 * local Product shape, keeping enough info to render offline
 * (id, slug, name, price, imageUrl, in-stock).
 */
const mapServerItemToProduct = (item: any): Product | null => {
  const p = item?.product ?? item;
  if (!p || !p.id) return null;
  const inStock = p.inStock !== false;
  return {
    id: String(p.id),
    sku: p.sku ?? '',
    name: p.name ?? 'Product',
    slug: p.slug ?? '',
    categoryId: p.categoryId ?? '',
    categoryName: p.categoryName ?? 'Crackers',
    price: typeof p.price === 'number' ? p.price : 0,
    compareAtPrice: p.mrp ?? p.compareAtPrice,
    costPrice: typeof p.costPrice === 'number' ? p.costPrice : 0,
    taxRate: typeof p.taxRate === 'number' ? p.taxRate : 0,
    discountType: p.discountType ?? 'None',
    discountValue: typeof p.discountValue === 'number' ? p.discountValue : 0,
    discountPercentage: p.discountPercent ?? p.discountPercentage,
    stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : (inStock ? 99 : 0),
    availableQuantity: typeof p.availableQuantity === 'number' ? p.availableQuantity : (inStock ? 99 : 0),
    reorderLevel: typeof p.reorderLevel === 'number' ? p.reorderLevel : 0,
    unit: p.unit ?? 'Box',
    weightKg: typeof p.weightKg === 'number' ? p.weightKg : 0.5,
    isActive: p.isActive !== false,
    isFeatured: !!p.isFeatured,
    isBestSeller: !!p.isBestSeller,
    isNewArrival: !!p.isNewArrival,
    primaryImageUrl: p.imageUrl ?? p.primaryImageUrl
  };
};

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<Product[]>(loadLocalWishlist);
  const hasMergedServer = useRef(false);

  // Persist locally (offline fallback) exactly as before.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // Storage unavailable — in-memory wishlist still works.
    }
  }, [wishlist]);

  // Merge the server wishlist on mount when the customer is signed in.
  useEffect(() => {
    if (hasMergedServer.current || !hasCustomerToken()) return;
    hasMergedServer.current = true;
    let cancelled = false;

    api.getWishlist()
      .then((serverItems) => {
        if (cancelled || !Array.isArray(serverItems)) return;
        const serverProducts = serverItems
          .map(mapServerItemToProduct)
          .filter((p): p is Product => p !== null);
        if (serverProducts.length === 0) return; // [] can also mean the call failed — keep local as-is.

        const serverIds = new Set(serverProducts.map((p) => p.id));

        setWishlist((prev) => {
          // Push local-only items up to the server (fire-and-forget, idempotent POST).
          prev
            .filter((p) => !serverIds.has(p.id))
            .forEach((p) => {
              api.addToWishlist(p.id).catch(() => {});
            });

          // Refresh existing entries with server data, append unseen server items.
          const byId = new Map(prev.map((p) => [p.id, p] as const));
          const merged = prev.map((local) => {
            const fresh = serverProducts.find((sp) => sp.id === local.id);
            return fresh ? { ...local, ...fresh, primaryImageUrl: fresh.primaryImageUrl ?? local.primaryImageUrl } : local;
          });
          serverProducts.forEach((sp) => {
            if (!byId.has(sp.id)) merged.push(sp);
          });
          return merged;
        });
      })
      .catch(() => {
        // Offline / backend not ready — local wishlist remains the source of truth.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const syncAdd = (productId: string) => {
    if (hasCustomerToken()) api.addToWishlist(productId).catch(() => {});
  };

  const syncRemove = (productId: string) => {
    if (hasCustomerToken()) api.removeFromWishlist(productId).catch(() => {});
  };

  const toggleWishlist = (product: Product) => {
    setWishlist((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        syncRemove(product.id);
        return prev.filter((p) => p.id !== product.id);
      }
      syncAdd(product.id);
      return [...prev, product];
    });
  };

  const removeFromWishlist = (productId: string) => {
    setWishlist((prev) => {
      if (prev.some((p) => p.id === productId)) syncRemove(productId);
      return prev.filter((p) => p.id !== productId);
    });
  };

  const clearWishlist = () => {
    setWishlist((prev) => {
      prev.forEach((p) => syncRemove(p.id));
      return [];
    });
  };

  const isInWishlist = (productId: string) => wishlist.some((p) => p.id === productId);

  return (
    <WishlistContext.Provider value={{ wishlist, toggleWishlist, removeFromWishlist, clearWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
};
