import React from 'react';
import { Star, StarHalf } from 'lucide-react';
import confetti from 'canvas-confetti';

export const RatingStars: React.FC<{ rating?: number; reviewCount?: number; size?: string }> = ({
  rating = 4.8,
  reviewCount,
  size = 'w-4 h-4'
}) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.4;

  return (
    <div className="flex items-center space-x-1">
      <div className="flex items-center text-amber-400">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) {
            return <Star key={i} className={`${size} fill-current`} />;
          }
          if (i === fullStars && hasHalf) {
            return <StarHalf key={i} className={`${size} fill-current`} />;
          }
          return <Star key={i} className={`${size} text-slate-300`} />;
        })}
      </div>
      {reviewCount !== undefined && (
        <span className="text-xs text-slate-500 font-medium">({reviewCount} reviews)</span>
      )}
    </div>
  );
};

export const StatusBadge: React.FC<{ status: string; type?: 'order' | 'payment' | 'stock' }> = ({
  status,
  type = 'order'
}) => {
  const s = status.toLowerCase();

  let bg = 'bg-slate-100 text-slate-700';

  if (s === 'paid' || s === 'delivered' || s === 'confirmed' || s === 'in stock') {
    bg = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  } else if (s === 'pending' || s === 'processing' || s === 'medium' || s === 'unfulfilled') {
    bg = 'bg-amber-50 text-amber-700 border border-amber-200';
  } else if (s === 'shipped' || s === 'outfordelivery' || s === 'packed') {
    bg = 'bg-blue-50 text-blue-700 border border-blue-200';
  } else if (s === 'cancelled' || s === 'failed' || s === 'critical' || s === 'low' || s === 'out of stock') {
    bg = 'bg-red-50 text-red-700 border border-red-200';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${bg}`}>
      {status}
    </span>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden transform transition-all`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-navy">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const Drawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}> = ({ isOpen, onClose, title, children, width = 'max-w-md' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 ${width} w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-navy">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

export const triggerFireworksConfetti = () => {
  const duration = 3.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      return clearInterval(interval);
    }
    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }
};
