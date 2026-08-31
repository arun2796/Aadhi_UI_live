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
    return [];
  });

  const [couponCode, setCouponCode] = useState<string>('');
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('aadhi_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product: Product, quantity: number = 1) => {
    const maxStock = typeof product.availableQuantity === 'number' ? product.availableQuantity : 99;
    if (maxStock <= 0) {
      alert('This product is currently out of stock.');
      return;
    }

    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, maxStock);
        return prev.map(i => i.productId === product.id ? { ...i, quantity: newQty, lineTotal: newQty * i.unitPrice } : i);
      }
      const clampedQty = Math.max(1, Math.min(quantity, maxStock));
      const newItem: CartItem = {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        imageUrl: product.primaryImageUrl,
        unitPrice: product.price,
        compareAtPrice: product.compareAtPrice,
        quantity: clampedQty,
        maxStock: maxStock,
        lineTotal: product.price * clampedQty
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
  const subtotal = items.reduce((acc, i) => acc + (i.lineTotal || (i.unitPrice * i.quantity)), 0);

  let discount = 0;
  if (couponCode === 'DIWALI2026') {
    discount = Math.round(subtotal * 0.05);
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
