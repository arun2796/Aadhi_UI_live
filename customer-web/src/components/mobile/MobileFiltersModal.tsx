import React, { useState, useEffect } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { api } from '../../services/api';

interface MobileFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: {
    maxPrice: number;
    categories: string[];
    brands: string[];
  }) => void;
}

export const MobileFiltersModal: React.FC<MobileFiltersModalProps> = ({
  isOpen,
  onClose,
  onApplyFilters
}) => {
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      api.getCategories().then(cats => {
        if (cats.length > 0) {
          setCategoryOptions(cats.map(c => c.name));
        } else {
          setCategoryOptions(['Gift Boxes', 'Sparklers', 'Aerial Shots', 'Ground Chakkar', 'Flower Pots']);
        }
      });
      api.getBrands().then(brs => {
        if (brs.length > 0) {
          setBrandOptions(brs.map(b => b.name));
        } else {
          setBrandOptions(['Aadhi Crackers', 'Standard Fireworks', 'Vanitha Crackers']);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleBrand = (b: string) => {
    setSelectedBrands((prev) =>
      prev.includes(b) ? prev.filter((item) => item !== b) : [...prev, b]
    );
  };

  const handleClearAll = () => {
    setMaxPrice(5000);
    setSelectedCategories([]);
    setSelectedBrands([]);
  };

  const handleApply = () => {
    onApplyFilters({
      maxPrice,
      categories: selectedCategories,
      brands: selectedBrands
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col font-sans max-w-[425px] w-full mx-auto">
      {/* Top Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shadow-xs">
        <button onClick={onClose} className="p-1 -ml-1 text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-black text-navy uppercase tracking-wider">Filters</h2>
        <button
          onClick={handleClearAll}
          className="text-xs font-bold text-orange hover:underline"
        >
          Reset
        </button>
      </div>

      {/* Filter Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 1. Price Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-navy uppercase tracking-wider">Max Price</span>
            <span className="font-black text-navy text-sm">₹{maxPrice.toLocaleString('en-IN')}</span>
          </div>
          <input
            type="range"
            min={500}
            max={15000}
            step={250}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>₹500</span>
            <span>₹7,500</span>
            <span>₹15,000</span>
          </div>
        </div>

        {/* 2. Categories Selection */}
        <div className="space-y-3">
          <div className="font-bold text-xs text-navy uppercase tracking-wider">
            Categories ({categoryOptions.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {categoryOptions.map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-orange/10 border-orange text-orange'
                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <span className="truncate">{cat}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Brands Selection */}
        <div className="space-y-3">
          <div className="font-bold text-xs text-navy uppercase tracking-wider">
            Brands ({brandOptions.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {brandOptions.map((brand) => {
              const isSelected = selectedBrands.includes(brand);
              return (
                <button
                  key={brand}
                  onClick={() => toggleBrand(brand)}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-purple/10 border-purple text-purple'
                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <span className="truncate">{brand}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Apply Action */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <button
          onClick={handleApply}
          className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold uppercase tracking-wider shadow-glow active:scale-98 transition-all"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};
