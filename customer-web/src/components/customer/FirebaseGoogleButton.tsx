import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { signInWithGooglePopup } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export interface FirebaseGoogleButtonProps {
  label?: string;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  className?: string;
  variant?: 'full' | 'icon';
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29A7.16 7.16 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
    />
  </svg>
);

export const FirebaseGoogleButton: React.FC<FirebaseGoogleButtonProps> = ({
  label = 'Continue with Google',
  onSuccess,
  onError,
  className = '',
  variant = 'full'
}) => {
  const { loginWithFirebase } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      // 1. Popup Firebase Google Sign-In
      const result = await signInWithGooglePopup();

      // 2. Authenticate with Aadhi Crackers backend using Firebase ID Token
      const ok = await loginWithFirebase({
        idToken: result.idToken,
        email: result.email,
        displayName: result.displayName,
        photoUrl: result.photoUrl,
        phoneNumber: result.phoneNumber
      });

      if (ok) {
        showToast('Signed in with Google successfully!', 'success');
        onSuccess?.();
      } else {
        const msg = 'Google authentication failed. Please try again.';
        showToast(msg, 'error');
        onError?.(new Error(msg));
      }
    } catch (error: any) {
      console.error('Firebase Google Sign-In error:', error);
      const msg = error?.message || 'Google sign-in was cancelled or failed.';
      showToast(msg, 'error');
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label={label}
        className={`h-14 rounded-2xl border border-slate-200 bg-white shadow-xs flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-60 ${className}`}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-purple" /> : <GoogleIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] text-navy font-bold text-sm shadow-xs transition-all flex items-center justify-center space-x-3 disabled:opacity-60 cursor-pointer ${className}`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-purple" /> : <GoogleIcon />}
      <span>{loading ? 'Connecting to Google…' : label}</span>
    </button>
  );
};
