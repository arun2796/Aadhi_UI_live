import React, { useState } from 'react';
import { ChevronLeft, Check } from 'lucide-react';

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Gift Boxes']);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  if (!isOpen) return null;

  const categoryOptions = [
    'Gift Boxes',
    'Combo Offers',
    'Sparklers',
    'Rockets',
    'Ground Chakkar',
    'Flower Pots',
    'Aerial Shots'
  ];

  const brandOptions = ['Aadhi', 'Standard', 'Vanitha', 'Suryakala'];

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
        <h2 className="font-bold text-sm text-navy">Filters</h2>
        <button
          onClick={handleClearAll}
          className="text-xs font-semibold text-purple hover:underline"
        >
          Clear All
        </button>
      </div>

      {/* Main Filter Options matching Screen 12 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Price Range Slider */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
            Price Range
          </h3>
          <div className="pt-2">
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-orange cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-semibold mt-1">
              <span>₹0</span>
              <span className="text-orange font-bold">₹{maxPrice.toLocaleString('en-IN')}{maxPrice === 5000 ? '+' : ''}</span>
              <span>₹5000+</span>
            </div>
          </div>
        </div>

        {/* Category Checkboxes */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
            Category
          </h3>
          <div className="space-y-2.5">
            {categoryOptions.map((cat) => {
              const isChecked = selectedCategories.includes(cat);
              return (
                <div
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className="flex items-center justify-between cursor-pointer py-1"
                >
                  <span className="text-xs font-medium text-slate-700">{cat}</span>
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-purple text-white'
                        : 'border-2 border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Brand Checkboxes */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
            Brand
          </h3>
          <div className="space-y-2.5">
            {brandOptions.map((b) => {
              const isChecked = selectedBrands.includes(b);
              return (
                <div
                  key={b}
                  onClick={() => toggleBrand(b)}
                  className="flex items-center justify-between cursor-pointer py-1"
                >
                  <span className="text-xs font-medium text-slate-700">{b}</span>
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-purple text-white'
                        : 'border-2 border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom CTA button */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <button
          onClick={handleApply}
          className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow active:scale-[0.98] transition-all"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};
