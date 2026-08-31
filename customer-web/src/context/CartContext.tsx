import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, Product } from '../types';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  discount: number;
  couponCode: string;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  shippingCharge: number;
  grandTotal: number;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('aadhi_cart');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    // Default initial cart items matching screenshots
    return [
      {
        productId: 'prod-2',
        sku: 'GB-MGA-002',
        name: 'Mega Celebration Box',
        imageUrl: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=600&auto=format&fit=crop&q=80',
        unitPrice: 4499,
        compareAtPrice: 5999,
        quantity: 1,
        maxStock: 80,
        lineTotal: 4499
      },
      {
        productId: 'prod-10',
        sku: 'POT-BIG-001',
        name: 'Flower Pots (Big)',
        imageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&auto=format&fit=crop&q=80',
        unitPrice: 120,
        compareAtPrice: 150,
        quantity: 2,
        maxStock: 120,
        lineTotal: 240
      },
      {
        productId: 'prod-9',
        sku: 'SPK-10P-001',
        name: 'Sparklers (10 Pcs)',
        imageUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
        unitPrice: 45,
        compareAtPrice: 60,
        quantity: 1,
        maxStock: 320,
        lineTotal: 45
      }
    ];
  });

  const [couponCode, setCouponCode] = useState<string>('DIWALI2026');
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('aadhi_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product: Product, quantity: number = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, product.availableQuantity || 99);
        return prev.map(i => i.productId === product.id ? { ...i, quantity: newQty, lineTotal: newQty * i.unitPrice } : i);
      }
      const newItem: CartItem = {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        imageUrl: product.primaryImageUrl,
        unitPrice: product.price,
        compareAtPrice: product.compareAtPrice,
        quantity: Math.min(quantity, product.availableQuantity || 99),
        maxStock: product.availableQuantity || 99,
        lineTotal: product.price * quantity
      };
      return [...prev, newItem];
    });
    setIsCartDrawerOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prev => prev.map(i => {
      if (i.productId === productId) {
        const qty = Math.min(quantity, i.maxStock);
        return { ...i, quantity: qty, lineTotal: qty * i.unitPrice };
      }
      return i;
    }));
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setCouponCode('');
  };

  const applyCoupon = (code: string): boolean => {
    const clean = code.trim().toUpperCase();
    if (clean === 'DIWALI2026' || clean === 'WELCOME10' || clean === 'AADHI20') {
      setCouponCode(clean);
      return true;
    }
    return false;
  };

  const removeCoupon = () => {
    setCouponCode('');
  };

  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = items.reduce((acc, i) => acc + i.lineTotal, 0);

  let discount = 0;
  if (couponCode === 'DIWALI2026') {
    discount = Math.round(subtotal * 0.05); // e.g. ₹240 for ₹4,784 subtotal
  } else if (couponCode === 'WELCOME10') {
    discount = Math.round(subtotal * 0.10);
  } else if (couponCode === 'AADHI20') {
    discount = Math.round(subtotal * 0.20);
  }

  const shippingCharge = subtotal >= 3000 || subtotal === 0 ? 0 : 150;
  const grandTotal = Math.max(0, subtotal - discount + shippingCharge);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      totalItems,
      subtotal,
      discount,
      couponCode,
      applyCoupon,
      removeCoupon,
      shippingCharge,
      grandTotal,
      isCartDrawerOpen,
      setIsCartDrawerOpen
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
