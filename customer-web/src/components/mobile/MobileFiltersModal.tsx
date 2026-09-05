import React, { useState, useEffect } from 'react';
import { ChevronLeft, Check, Star } from 'lucide-react';
import { Category, Brand } from '../../types';
import { api } from '../../services/api';

/**
 * Full-screen filter sheet matching the Filters panel on design 02_category.png:
 * Categories, Price Range (₹0 → ₹5,000+), Brand and Rating (& above).
 * Emits { maxPrice, categories, brands, minRating? } — applied client-side
 * by Screen2Category.
 */

/** Slider ceiling — at this value the filter means "₹5,000+" i.e. no price cap. */
const PRICE_CAP = 5000;
const UNCAPPED = Number.MAX_SAFE_INTEGER;

const RATING_OPTIONS = [4.5, 4, 3.5, 3];

interface MobileFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: {
    maxPrice: number;
    categories: string[];
    brands: string[];
    minRating?: number;
  }) => void;
}

export const MobileFiltersModal: React.FC<MobileFiltersModalProps> = ({
  isOpen,
  onClose,
  onApplyFilters
}) => {
  const [maxPrice, setMaxPrice] = useState<number>(PRICE_CAP);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [categoryOptions, setCategoryOptions] = useState<{ name: string; count?: number }[]>([]);
  const [brandOptions, setBrandOptions] = useState<{ name: string; count?: number }[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    api
      .getCategories()
      .then((cats: Category[]) => {
        if (cats.length > 0) {
          setCategoryOptions(cats.map((c) => ({ name: c.name, count: c.productCount })));
        } else {
          setCategoryOptions(
            ['Sparklers', 'Rockets', 'Aerial Shots', 'Flower Pots', 'Gift Boxes', 'Combo Offers'].map(
              (name) => ({ name })
            )
          );
        }
      })
      .catch(() => {
        setCategoryOptions(
          ['Sparklers', 'Rockets', 'Aerial Shots', 'Flower Pots', 'Gift Boxes', 'Combo Offers'].map(
            (name) => ({ name })
          )
        );
      });

    api
      .getBrands()
      .then((brs: Brand[]) => {
        if (Array.isArray(brs) && brs.length > 0) {
          setBrandOptions(brs.map((b) => ({ name: b.name, count: b.productCount })));
        } else {
          setBrandOptions(
            ['Aadhi Crackers', 'Standard Fireworks', 'Vinayaga Crackers'].map((name) => ({ name }))
          );
        }
      })
      .catch(() => {
        setBrandOptions(
          ['Aadhi Crackers', 'Standard Fireworks', 'Vinayaga Crackers'].map((name) => ({ name }))
        );
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const toggleBrand = (b: string) =>
    setSelectedBrands((prev) =>
      prev.includes(b) ? prev.filter((item) => item !== b) : [...prev, b]
    );

  const handleClearAll = () => {
    setMaxPrice(PRICE_CAP);
    setSelectedCategories([]);
    setSelectedBrands([]);
    setMinRating(undefined);
  };

  const handleApply = () => {
    onApplyFilters({
      // At the slider's right edge the label reads "₹5,000+" — pass it as uncapped.
      maxPrice: maxPrice >= PRICE_CAP ? UNCAPPED : maxPrice,
      categories: selectedCategories,
      brands: selectedBrands,
      minRating
    });
    onClose();
  };

  const activeCount =
    (maxPrice < PRICE_CAP ? 1 : 0) +
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedBrands.length > 0 ? 1 : 0) +
    (minRating ? 1 : 0);

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col font-sans max-w-[425px] w-full mx-auto">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shadow-xs">
        <button onClick={onClose} className="p-1 -ml-1 text-slate-700" aria-label="Close filters">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-black text-navy uppercase tracking-wider">Filters</h2>
        <button onClick={handleClearAll} className="text-xs font-bold text-orange active:opacity-70">
          Reset
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 1. Price range */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-navy uppercase tracking-wider">Price Range</span>
            <span className="font-black text-navy text-sm">
              {maxPrice >= PRICE_CAP ? '₹5,000+' : `Up to ₹${maxPrice.toLocaleString('en-IN')}`}
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={PRICE_CAP}
            step={100}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>₹0</span>
            <span>₹2,500</span>
            <span>₹5,000+</span>
          </div>
        </div>

        {/* 2. Categories */}
        <div className="space-y-3">
          <div className="font-bold text-xs text-navy uppercase tracking-wider">
            Categories ({categoryOptions.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {categoryOptions.map((cat) => {
              const isSelected = selectedCategories.includes(cat.name);
              return (
                <button
                  key={cat.name}
                  onClick={() => toggleCategory(cat.name)}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-orange/10 border-orange text-orange'
                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <span className="truncate">
                    {cat.name}
                    {typeof cat.count === 'number' && cat.count > 0 && (
                      <span className={`ml-1 font-semibold ${isSelected ? 'text-orange/70' : 'text-slate-400'}`}>
                        ({cat.count})
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Brands */}
        <div className="space-y-3">
          <div className="font-bold text-xs text-navy uppercase tracking-wider">
            Brand ({brandOptions.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {brandOptions.map((brand) => {
              const isSelected = selectedBrands.includes(brand.name);
              return (
                <button
                  key={brand.name}
                  onClick={() => toggleBrand(brand.name)}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-purple/10 border-purple text-purple'
                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <span className="truncate">
                    {brand.name}
                    {typeof brand.count === 'number' && brand.count > 0 && (
                      <span className={`ml-1 font-semibold ${isSelected ? 'text-purple/70' : 'text-slate-400'}`}>
                        ({brand.count})
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Rating */}
        <div className="space-y-3">
          <div className="font-bold text-xs text-navy uppercase tracking-wider">Rating</div>
          <div className="space-y-2">
            {RATING_OPTIONS.map((value) => {
              const isSelected = minRating === value;
              return (
                <button
                  key={value}
                  onClick={() => setMinRating(isSelected ? undefined : value)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-gold/10 border-gold text-navy'
                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i <= Math.floor(value) ? 'text-gold fill-gold' : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </span>
                    <span className="text-xs font-bold">{value} &amp; above</span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0 text-gold-dark" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Apply */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <button
          onClick={handleApply}
          className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold uppercase tracking-wider shadow-glow active:scale-98 transition-all"
        >
          Apply Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>
    </div>
  );
};
