import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { signInWithGoogle, isSignInCancelled } from '../../services/firebase';

export interface AuthNavProps {
  onNavigate: (page: string, params?: any) => void;
}

const IS_DEV: boolean = Boolean((import.meta as any).env?.DEV);

const getErrorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

/* ─── Shared field building blocks ─── */

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-semibold text-slate-500 mb-1.5">{children}</label>
);

const inputClass =
  'w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm text-navy font-medium placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors';

const PasswordInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}> = ({ value, onChange, placeholder = '••••••••', autoComplete = 'current-password' }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${inputClass} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
      >
        {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
      </button>
    </div>
  );
};

const PrimaryButton: React.FC<{
  label: string;
  loading?: boolean;
  onClick: () => void;
}> = ({ label, loading, onClick }) => (
  <button
    type="submit"
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    disabled={loading}
    className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-sm shadow-md shadow-purple/25 transition-colors disabled:opacity-60 flex items-center justify-center space-x-2"
  >
    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
    <span>{label}</span>
  </button>
);

/* ─── Social brand icons (inline SVG for fidelity) ─── */

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29A7.16 7.16 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path
      fill="#fff"
      d="M16.67 15.47l.53-3.47h-3.33V9.75c0-.95.46-1.88 1.96-1.88h1.51V4.92s-1.37-.23-2.68-.23c-2.74 0-4.53 1.66-4.53 4.66V12H7.08v3.47h3.05V24a12.09 12.09 0 0 0 3.74 0v-8.53h2.8z"
    />
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#000" aria-hidden="true">
    <path d="M17.05 12.54c-.03-2.55 2.08-3.77 2.17-3.83-1.18-1.73-3.02-1.97-3.68-2-1.56-.16-3.05.92-3.85.92-.79 0-2.02-.9-3.32-.87-1.71.03-3.29.99-4.17 2.52-1.78 3.08-.45 7.64 1.28 10.14.85 1.22 1.86 2.6 3.18 2.55 1.28-.05 1.76-.83 3.3-.83s1.98.83 3.33.8c1.38-.02 2.24-1.25 3.08-2.48.97-1.43 1.37-2.81 1.39-2.88-.03-.02-2.67-1.02-2.71-4.04zM14.51 4.66c.7-.85 1.18-2.03 1.05-3.21-1.01.04-2.24.67-2.97 1.52-.65.75-1.22 1.96-1.07 3.11 1.13.09 2.28-.57 2.99-1.42z" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────
   Design 16: Login / Register page with tabs.
   ───────────────────────────────────────────────────────────── */
export const ScreenAuth: React.FC<AuthNavProps & { initialTab?: 'login' | 'register'; redirectTo?: string; redirectParams?: any }> = ({
  onNavigate,
  initialTab = 'login',
  redirectTo,
  redirectParams
}) => {
  const { login, register, loginWithFirebase } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // Login fields
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const goAfterAuth = () => {
    if (redirectTo) onNavigate(redirectTo, redirectParams);
    else onNavigate('account');
  };

  const fail = (message: string) => {
    setShakeKey((k) => k + 1);
    showToast(message, 'error');
  };

  const handleLogin = async () => {
    const identifier = loginMobile.trim();
    if (!identifier) return fail('Please enter your mobile number or email');
    if (!loginPassword) return fail('Please enter your password');
    setLoading(true);
    try {
      const ok = await login(identifier, loginPassword);
      if (ok) {
        showToast('Logged in successfully', 'success');
        goAfterAuth();
      } else {
        fail('Invalid mobile number / email or password');
      }
    } catch (error: any) {
      fail(getErrorMessage(error, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!firstName.trim()) return fail('Please enter your first name');
    if (!regMobile.trim()) return fail('Please enter your mobile number');
    if (!/^\d{10}$/.test(regMobile.trim())) return fail('Mobile number must be 10 digits');
    if (!regEmail.trim() || !/^\S+@\S+\.\S+$/.test(regEmail.trim())) return fail('Please enter a valid email address');
    if (regPassword.length < 8) return fail('Password must be at least 8 characters');
    if (regPassword !== regConfirm) return fail('Passwords do not match');
    setLoading(true);
    try {
      const ok = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: regEmail.trim(),
        phone: regMobile.trim(),
        password: regPassword
      });
      if (ok) {
        showToast('Account created successfully', 'success');
        goAfterAuth();
      } else {
        fail('Registration failed. Please try again.');
      }
    } catch (error: any) {
      fail(getErrorMessage(error, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const socialClick = () => showToast('Social login coming soon', 'info');

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const googleUser = await signInWithGoogle();
      const ok = await loginWithFirebase(googleUser);
      if (ok) {
        showToast('Logged in successfully', 'success');
        goAfterAuth();
      } else {
        fail('Google sign-in failed. Please try again.');
      }
    } catch (error: any) {
      if (isSignInCancelled(error)) {
        showToast('Sign-in was cancelled', 'info');
      } else {
        fail(getErrorMessage(error, 'Google sign-in failed. Please try again.'));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="p-4 pb-8 font-sans bg-[#fbfbfb] animate-fade-in">
      <div key={shakeKey} className={`rounded-3xl bg-white border border-slate-100 shadow-card overflow-hidden ${shakeKey ? 'animate-shake' : ''}`}>
        {/* Login | Register tabs */}
        <div className="grid grid-cols-2 border-b border-slate-100">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3.5 text-sm font-bold capitalize transition-colors ${
                tab === t
                  ? 'text-purple border-b-2 border-purple bg-purple-soft/40'
                  : 'text-slate-400 border-b-2 border-transparent hover:text-slate-600'
              }`}
            >
              {t === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'login' ? (
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <FieldLabel>Mobile Number</FieldLabel>
                <input
                  type="tel"
                  inputMode="tel"
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value)}
                  placeholder="9876543210"
                  autoComplete="username"
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Password</FieldLabel>
                <PasswordInput value={loginPassword} onChange={setLoginPassword} />
              </div>

              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-xs font-bold text-purple hover:text-purple-dark"
                >
                  Forgot Password?
                </button>
              </div>

              <PrimaryButton label="Login" loading={loading} onClick={handleLogin} />

              {/* Or login with */}
              <div className="flex items-center space-x-3 pt-1">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[11px] font-semibold text-slate-400">Or login with</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  aria-label="Login with Google"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="h-14 rounded-2xl border border-slate-100 bg-white shadow-xs flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-60"
                >
                  {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-purple" /> : <GoogleIcon />}
                </button>
                <button
                  type="button"
                  aria-label="Login with Facebook"
                  onClick={socialClick}
                  className="h-14 rounded-2xl border border-slate-100 bg-white shadow-xs flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <FacebookIcon />
                </button>
                <button
                  type="button"
                  aria-label="Login with Apple"
                  onClick={socialClick}
                  className="h-14 rounded-2xl border border-slate-100 bg-white shadow-xs flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <AppleIcon />
                </button>
              </div>

              <p className="text-center text-xs text-slate-500 pt-3 border-t border-slate-50">
                Don't have an account?{' '}
                <button type="button" onClick={() => setTab('register')} className="font-bold text-purple hover:text-purple-dark">
                  Register
                </button>
              </p>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>First Name</FieldLabel>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Arun"
                    autoComplete="given-name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel>Last Name</FieldLabel>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Kumar"
                    autoComplete="family-name"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Mobile Number</FieldLabel>
                <input
                  type="tel"
                  inputMode="tel"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  placeholder="9876543210"
                  autoComplete="tel"
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="arun.kumar@email.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Password</FieldLabel>
                <PasswordInput value={regPassword} onChange={setRegPassword} autoComplete="new-password" />
              </div>

              <div>
                <FieldLabel>Confirm Password</FieldLabel>
                <PasswordInput value={regConfirm} onChange={setRegConfirm} autoComplete="new-password" />
                {regConfirm.length > 0 && regPassword !== regConfirm && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1.5">Passwords do not match</p>
                )}
              </div>

              <PrimaryButton label="Register" loading={loading} onClick={handleRegister} />

              <div className="flex items-center space-x-3 pt-1">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[11px] font-semibold text-slate-400">Or register with</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] text-navy font-bold text-sm shadow-xs transition-all flex items-center justify-center space-x-3 disabled:opacity-60"
              >
                {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-purple" /> : <GoogleIcon />}
                <span>{googleLoading ? 'Connecting to Google…' : 'Register with Google'}</span>
              </button>

              <p className="text-center text-xs text-slate-500 pt-3 border-t border-slate-50">
                Already have an account?{' '}
                <button type="button" onClick={() => setTab('login')} className="font-bold text-purple hover:text-purple-dark">
                  Login
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Design 17: Forgot Password — enter mobile number, send OTP.
   ───────────────────────────────────────────────────────────── */
export const ScreenForgotPassword: React.FC<AuthNavProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const identifier = mobile.trim();
    if (!identifier) {
      showToast('Please enter your mobile number', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword(identifier);
      showToast(res?.message || 'OTP sent successfully', 'success');
      onNavigate('otp-verification', { identifier, devOtp: res?.devOtp });
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Could not send OTP. Please try again.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-8 font-sans bg-[#fbfbfb] animate-fade-in">
      <div className="rounded-3xl bg-white border border-slate-100 shadow-card p-5 pt-7 space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-black text-navy">Forgot Password</h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-60 mx-auto">
            Enter your mobile number associated with your account
          </p>
        </div>

        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <div>
            <FieldLabel>Mobile Number</FieldLabel>
            <input
              type="tel"
              inputMode="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="9876543210"
              autoComplete="tel"
              className={inputClass}
            />
          </div>

          <PrimaryButton label="Send OTP" loading={loading} onClick={handleSendOtp} />
        </form>

        <div className="text-center pb-1">
          <button onClick={() => onNavigate('auth')} className="text-xs font-bold text-purple hover:text-purple-dark">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Design 18: OTP Verification — 6-digit boxes + resend countdown.
   ───────────────────────────────────────────────────────────── */
const RESEND_SECONDS = 45;

export const ScreenOtpVerification: React.FC<AuthNavProps & { identifier?: string; devOtp?: string }> = ({
  onNavigate,
  identifier,
  devOtp
}) => {
  const { showToast } = useToast();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [hint, setHint] = useState<string | undefined>(devOtp);
  const [shakeKey, setShakeKey] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '');
    setDigits((prev) => {
      const next = [...prev];
      next[index] = v.slice(-1);
      return next;
    });
    if (v && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((d, i) => (next[i] = d));
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  const otp = digits.join('');

  const handleVerify = async () => {
    if (!identifier) {
      showToast('Session expired. Please request a new OTP.', 'error');
      onNavigate('forgot-password');
      return;
    }
    if (otp.length !== 6) {
      setShakeKey((k) => k + 1);
      showToast('Please enter the 6 digit OTP', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyOtp(identifier, otp);
      showToast('OTP verified', 'success');
      onNavigate('reset-password', { resetToken: res.resetToken });
    } catch (error: any) {
      setShakeKey((k) => k + 1);
      setDigits(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
      showToast(getErrorMessage(error, 'Invalid or expired OTP'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!identifier || resending) return;
    setResending(true);
    try {
      const res = await api.resendOtp(identifier);
      if (res?.devOtp) setHint(res.devOtp);
      setSecondsLeft(RESEND_SECONDS);
      setDigits(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
      showToast(res?.message || 'OTP resent successfully', 'success');
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Could not resend OTP'), 'error');
    } finally {
      setResending(false);
    }
  };

  const timerLabel = `00:${String(secondsLeft).padStart(2, '0')}`;

  return (
    <div className="p-4 pb-8 font-sans bg-[#fbfbfb] animate-fade-in">
      <div className="rounded-3xl bg-white border border-slate-100 shadow-card p-5 pt-7 space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-black text-navy">Verify OTP</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Enter the 6 digit OTP sent to
            <br />
            <span className="font-bold text-navy">{identifier || 'your mobile number'}</span>
          </p>
        </div>

        {IS_DEV && hint && (
          <div className="flex justify-center">
            <span className="text-[10px] font-bold text-purple bg-purple-soft px-2.5 py-1 rounded-full">
              DEV OTP: {hint}
            </span>
          </div>
        )}

        {/* 6 digit boxes */}
        <div key={shakeKey} className={`flex justify-center gap-2 ${shakeKey ? 'animate-shake' : ''}`}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              aria-label={`OTP digit ${i + 1}`}
              className="w-11 h-13 rounded-xl border border-slate-200 bg-white text-center text-lg font-black text-navy focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors"
            />
          ))}
        </div>

        {/* Resend countdown / link */}
        <p className="text-center text-xs text-slate-400 font-medium">
          {secondsLeft > 0 ? (
            <>
              Resend OTP in <span className="font-bold text-slate-600">{timerLabel}</span>
            </>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="font-bold text-purple hover:text-purple-dark disabled:opacity-60"
            >
              {resending ? 'Resending…' : 'Resend OTP'}
            </button>
          )}
        </p>

        <PrimaryButton label="Verify" loading={loading} onClick={handleVerify} />

        <div className="text-center pb-1">
          <button onClick={() => onNavigate('auth')} className="text-xs font-bold text-purple hover:text-purple-dark">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Design 19: Reset Password — new + confirm password.
   ───────────────────────────────────────────────────────────── */
export const ScreenResetPassword: React.FC<AuthNavProps & { resetToken?: string }> = ({ onNavigate, resetToken }) => {
  const { showToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const fail = (message: string) => {
    setShakeKey((k) => k + 1);
    showToast(message, 'error');
  };

  const handleReset = async () => {
    if (!resetToken) {
      showToast('Session expired. Please request a new OTP.', 'error');
      onNavigate('forgot-password');
      return;
    }
    if (newPassword.length < 8) return fail('Password must be at least 8 characters');
    if (newPassword !== confirmPassword) return fail('Passwords do not match');
    setLoading(true);
    try {
      await api.resetPassword(resetToken, newPassword, confirmPassword);
      showToast('Password reset successfully. Please login.', 'success');
      onNavigate('auth');
    } catch (error: any) {
      fail(getErrorMessage(error, 'Could not reset password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-8 font-sans bg-[#fbfbfb] animate-fade-in">
      <div key={shakeKey} className={`rounded-3xl bg-white border border-slate-100 shadow-card p-5 pt-7 space-y-5 ${shakeKey ? 'animate-shake' : ''}`}>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-black text-navy">Reset Password</h2>
          <p className="text-xs text-slate-500">Enter your new password</p>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <FieldLabel>New Password</FieldLabel>
            <PasswordInput value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          </div>

          <div>
            <FieldLabel>Confirm Password</FieldLabel>
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-[11px] font-semibold text-red-500 mt-1.5">Passwords do not match</p>
            )}
          </div>

          <div className="pt-1">
            <PrimaryButton label="Reset Password" loading={loading} onClick={handleReset} />
          </div>
        </form>
      </div>
    </div>
  );
};
