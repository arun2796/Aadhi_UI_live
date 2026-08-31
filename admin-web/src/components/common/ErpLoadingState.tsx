import React from 'react';
import { Loader2 } from 'lucide-react';

interface ErpLoadingStateProps {
  message?: string;
  height?: string;
}

export const ErpLoadingState: React.FC<ErpLoadingStateProps> = ({
  message = 'Loading live enterprise records...',
  height = 'h-64'
}) => {
  return (
    <div className={`w-full ${height} flex flex-col items-center justify-center space-y-3 p-6 text-center animate-fade-in`}>
      <div className="relative">
        <div className="w-10 h-10 border-3 border-purple/20 border-t-purple rounded-full animate-spin" />
        <div className="w-6 h-6 border-2 border-orange/30 border-b-orange rounded-full animate-spin absolute inset-2" />
      </div>
      <p className="text-xs font-bold text-slate-500 tracking-wide">{message}</p>
    </div>
  );
};
