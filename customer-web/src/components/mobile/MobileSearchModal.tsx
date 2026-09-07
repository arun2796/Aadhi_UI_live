import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Product } from '../../types';
import { api } from '../../services/api';

interface MobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (slug: string) => void;
}

export const MobileSearchModal: React.FC<MobileSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct
}) => {
  const [searchTerm, setSearchTerm] = useState('gift box');
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);

  useEffect(() => {
    api.getProducts().then((all) => {
      setProducts(all);
    });
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFiltered([]);
      return;
    }
    const q = searchTerm.toLowerCase();
    const matches = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
    setFiltered(matches);
  }, [searchTerm, products]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col font-sans max-w-[425px] w-full mx-auto">
      {/* Top Search Input matching Screen 11 */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center space-x-3 bg-white shadow-xs">
        <div className="flex-1 relative flex items-center bg-slate-100/90 rounded-full px-3.5 py-2">
          <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for crackers, gift boxes..."
            autoFocus
            className="w-full bg-transparent text-xs text-slate-800 focus:outline-none font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-xs font-bold text-slate-600 hover:text-navy px-1 flex-shrink-0"
        >
          Cancel
        </button>
      </div>

      {/* Search Results List matching Screen 11 */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filtered.map((prod) => (
          <div
            key={prod.id}
            onClick={() => {
              onClose();
              onSelectProduct(prod.slug);
            }}
            className="p-3.5 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <img
                src={prod.primaryImageUrl || '/product-placeholder.svg'}
                alt={prod.name}
                className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-100 flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 truncate">{prod.name}</div>
                <div className="text-[10px] text-slate-400 font-medium">{prod.categoryName}</div>
              </div>
            </div>

            <div className="font-black text-xs text-navy pl-2 flex-shrink-0">
              ₹{prod.price.toLocaleString('en-IN')}
            </div>
          </div>
        ))}

        {filtered.length === 0 && searchTerm && (
          <div className="text-center py-16 text-slate-400 text-xs">
            No products found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
};
