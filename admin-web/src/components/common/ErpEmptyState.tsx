import React from 'react';
import { LucideIcon, PackageOpen } from 'lucide-react';

interface ErpEmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const ErpEmptyState: React.FC<ErpEmptyStateProps> = ({
  icon: Icon = PackageOpen,
  title = 'No Records Found',
  description = 'There are no active records matching your current filter criteria.',
  actionText,
  onAction
}) => {
  return (
    <div className="p-10 rounded-3xl bg-white border border-slate-200 shadow-2xs text-center space-y-4 max-w-md mx-auto my-8 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
        <Icon className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-black text-navy">{title}</h3>
        <p className="text-xs text-slate-500 font-medium">{description}</p>
      </div>

      {actionText && onAction && (
        <div className="pt-2">
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-md shadow-orange/20 transition-all"
          >
            {actionText}
          </button>
        </div>
      )}
    </div>
  );
};
