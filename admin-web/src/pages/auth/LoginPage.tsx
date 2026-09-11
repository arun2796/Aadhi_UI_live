import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface LoginPageProps {
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await login(email, password, rememberMe);
      if (res.success) {
        showToast('Welcome to Aadhi Crackers ERP Platform', 'success');
        onSuccess?.();
      } else {
        setErrorMsg(res.message || 'Invalid email or password.');
      }
    } catch {
      setErrorMsg('Network error. Failed to reach the API server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-dark text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glow Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gold/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple to-purple-light border border-gold/40 shadow-lg shadow-purple/25 mb-2">
            <span className="text-2xl font-black tracking-tight text-gold">AC</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gold flex items-center justify-center space-x-2">
            <span>AADHI CRACKERS</span>
            <span className="px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/40 text-[10px] font-bold">
              ERP 2.0
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Enterprise Operations, Inventory & Financial Accounting Suite
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0f1033] border border-[#212356] rounded-3xl p-8 shadow-2xl space-y-5">
          <div className="border-b border-[#1d1f4b] pb-4">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Staff & Admin Sign In</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Enter your credentials to access the ERP management dashboard.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-300">Staff Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@aadhicracker.in"
                  className="w-full bg-[#161845] border border-[#262968] rounded-xl pl-10 pr-3.5 py-3 text-white placeholder-slate-500 font-medium outline-none focus:border-purple transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#161845] border border-[#262968] rounded-xl pl-10 pr-3.5 py-3 text-white placeholder-slate-500 font-medium outline-none focus:border-purple transition-colors"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer text-slate-400 text-[11px]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-purple w-3.5 h-3.5 rounded"
                />
                <span>Remember this workstation</span>
              </label>

              <button
                type="button"
                onClick={() => showToast('Please contact SuperAdmin to reset credentials.', 'info')}
                className="text-[11px] text-purple hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-black tracking-wide text-xs flex items-center justify-center space-x-2 shadow-lg shadow-purple/30 transition-all disabled:opacity-50"
            >
              <span>{isLoading ? 'Authenticating...' : 'Sign In to ERP Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Security Footer Note */}
        <div className="text-center text-[10px] text-slate-500">
          Protected by ASP.NET Core Rate Limiting & HMAC-SHA256 Token Signature
        </div>
      </div>
    </div>
  );
};
