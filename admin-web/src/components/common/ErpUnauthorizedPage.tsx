import React from 'react';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ErpUnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldX className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-black text-navy">Access Restricted</h1>
          <p className="text-xs text-slate-500">
            Your user role does not possess the required permissions to view this ERP section.
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
