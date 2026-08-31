import React from 'react';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ErpNotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-purple/10 text-purple flex items-center justify-center mx-auto">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-black text-navy">Page Not Found</h1>
          <p className="text-xs text-slate-500">
            The ERP module or route you requested does not exist or has been moved.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1.5 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <button
            onClick={() => navigate('/admin/dashboard')}
            className="px-4 py-2.5 rounded-xl bg-navy text-white text-xs font-bold flex items-center space-x-1.5 hover:bg-navy-dark shadow-md"
          >
            <Home className="w-4 h-4 text-gold" />
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
