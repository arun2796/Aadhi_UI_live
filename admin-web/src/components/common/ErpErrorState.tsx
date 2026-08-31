import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErpErrorStateProps {
  title?: string;
  message?: string;
  correlationId?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ErpErrorState: React.FC<ErpErrorStateProps> = ({
  title = 'Unable to Load ERP Data',
  message = 'An unexpected error occurred while communicating with the API service.',
  correlationId,
  onRetry,
  isRetrying = false
}) => {
  return (
    <div className="p-8 rounded-3xl bg-white border border-red-200/80 shadow-2xs text-center space-y-4 max-w-lg mx-auto my-8 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
        <AlertTriangle className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-black text-navy">{title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">{message}</p>
      </div>

      {correlationId && (
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">
          <span className="text-slate-400 font-bold">Ref ID:</span>
          <span className="font-bold text-navy">{correlationId}</span>
        </div>
      )}

      {onRetry && (
        <div className="pt-2">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-dark text-white text-xs font-black inline-flex items-center space-x-2 shadow-md shadow-navy/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying Connection...' : 'Retry Request'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
