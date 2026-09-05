import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { FirebaseGoogleButton } from '../../components/customer/FirebaseGoogleButton';

export interface DesktopNavProps {
  onNavigate: (page: string, params?: any) => void;
}

const IS_DEV: boolean = Boolean((import.meta as any).env?.DEV);

const getErrorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

/* ─── Shared building blocks (desktop centered auth cards) ─── */

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

/** Centered white card used by every desktop auth page. */
const AuthCard: React.FC<{
  title: string;
  subtitle?: string;
  shake?: number;
  children: React.ReactNode;
}> = ({ title, subtitle, shake = 0, children }) => (
  <div className="px-4 py-12 md:py-16 animate-fade-in">
    <div
      key={shake}
      className={`max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-card p-6 sm:p-8 space-y-5 ${
        shake ? 'animate-shake' : ''
      }`}
    >
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-black text-navy">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Desktop design 11: LOGIN — centered "Welcome Back!" card.
   ───────────────────────────────────────────────────────────── */
export const LoginPage: React.FC<DesktopNavProps & { redirectTo?: string; redirectParams?: any }> = ({
  onNavigate,
  redirectTo,
  redirectParams
}) => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const fail = (message: string) => {
    setShakeKey((k) => k + 1);
    showToast(message, 'error');
  };

  const goAfterAuth = () => {
    if (redirectTo) onNavigate(redirectTo, redirectParams);
    else onNavigate('account');
  };

  const handleLogin = async () => {
    const id = identifier.trim();
    if (!id) return fail('Please enter your email or mobile number');
    if (!password) return fail('Please enter your password');
    setLoading(true);
    try {
      const ok = await login(id, password);
      if (ok) {
        showToast('Logged in successfully', 'success');
        goAfterAuth();
      } else {
        fail('Invalid email / mobile number or password');
      }
    } catch (error: any) {
      fail(getErrorMessage(error, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Welcome Back!" subtitle="Login to your account" shake={shakeKey}>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <FieldLabel>Email or Mobile Number</FieldLabel>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="arun.kumar@email.com or 9876543210"
            autoComplete="username"
            className={inputClass}
          />
        </div>

        <div>
          <FieldLabel>Password</FieldLabel>
          <PasswordInput value={password} onChange={setPassword} />
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

        <div className="flex items-center space-x-3 pt-2">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] font-semibold text-slate-400">Or continue with</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <FirebaseGoogleButton onSuccess={goAfterAuth} />

        <p className="text-center text-xs text-slate-500 pt-4 border-t border-slate-100">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('auth', { initialTab: 'register', redirectTo, redirectParams })}
            className="font-bold text-purple hover:text-purple-dark"
          >
            Register
          </button>
        </p>
      </form>
    </AuthCard>
  );
};

/* ─────────────────────────────────────────────────────────────
   Desktop design 12: REGISTER — centered "Create Account" card.
   ───────────────────────────────────────────────────────────── */
export const RegisterPage: React.FC<DesktopNavProps & { redirectTo?: string; redirectParams?: any }> = ({
  onNavigate,
  redirectTo,
  redirectParams
}) => {
  const { register } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const fail = (message: string) => {
    setShakeKey((k) => k + 1);
    showToast(message, 'error');
  };

  const goAfterAuth = () => {
    if (redirectTo) onNavigate(redirectTo, redirectParams);
    else onNavigate('account');
  };

  const handleRegister = async () => {
    const name = fullName.trim().replace(/\s+/g, ' ');
    if (!name) return fail('Please enter your full name');
    if (!mobile.trim()) return fail('Please enter your mobile number');
    if (!/^\d{10}$/.test(mobile.trim())) return fail('Mobile number must be 10 digits');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return fail('Please enter a valid email address');
    if (password.length < 8) return fail('Password must be at least 8 characters');
    if (password !== confirm) return fail('Passwords do not match');
    if (!agreed) return fail('Please agree to the Terms & Conditions');

    // The API expects first/last name — split the full name on the first space.
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ');

    setLoading(true);
    try {
      const ok = await register({
        firstName,
        lastName,
        email: email.trim(),
        phone: mobile.trim(),
        password
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

  return (
    <AuthCard title="Create Account" subtitle="Join Aadhi Crackers" shake={shakeKey}>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <FieldLabel>Full Name</FieldLabel>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Arun Kumar"
            autoComplete="name"
            className={inputClass}
          />
        </div>

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

        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="arun.kumar@email.com"
            autoComplete="email"
            className={inputClass}
          />
        </div>

        <div>
          <FieldLabel>Password</FieldLabel>
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        </div>

        <div>
          <FieldLabel>Confirm Password</FieldLabel>
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {confirm.length > 0 && password !== confirm && (
            <p className="text-[11px] font-semibold text-red-500 mt-1.5">Passwords do not match</p>
          )}
        </div>

        <label className="flex items-start space-x-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-purple"
          />
          <span className="text-xs text-slate-600">
            I agree to the{' '}
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="font-bold text-purple hover:text-purple-dark"
            >
              Terms &amp; Conditions
            </button>
          </span>
        </label>

        <PrimaryButton label="Register" loading={loading} onClick={handleRegister} />

        <div className="flex items-center space-x-3 pt-2">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] font-semibold text-slate-400">Or continue with</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <FirebaseGoogleButton onSuccess={goAfterAuth} label="Register with Google" />

        <p className="text-center text-xs text-slate-500 pt-4 border-t border-slate-100">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('auth', { initialTab: 'login', redirectTo, redirectParams })}
            className="font-bold text-purple hover:text-purple-dark"
          >
            Login
          </button>
        </p>
      </form>
    </AuthCard>
  );
};

/* ─────────────────────────────────────────────────────────────
   Desktop forgot password (mobile design 17 as a centered card).
   ───────────────────────────────────────────────────────────── */
export const ForgotPasswordPage: React.FC<DesktopNavProps> = ({ onNavigate }) => {
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
    <AuthCard title="Forgot Password" subtitle="Enter your mobile number associated with your account">
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

      <div className="text-center">
        <button
          onClick={() => onNavigate('auth')}
          className="text-xs font-bold text-purple hover:text-purple-dark"
        >
          Back to Login
        </button>
      </div>
    </AuthCard>
  );
};

/* ─────────────────────────────────────────────────────────────
   Desktop OTP verification (mobile design 18 as a centered card).
   ───────────────────────────────────────────────────────────── */
const RESEND_SECONDS = 45;

export const OtpVerificationPage: React.FC<DesktopNavProps & { identifier?: string; devOtp?: string }> = ({
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
    <AuthCard title="Verify OTP">
      <p className="text-xs text-slate-500 leading-relaxed text-center -mt-3">
        Enter the 6 digit OTP sent to
        <br />
        <span className="font-bold text-navy">{identifier || 'your mobile number'}</span>
      </p>

      {IS_DEV && hint && (
        <div className="flex justify-center">
          <span className="text-[10px] font-bold text-purple bg-purple-soft px-2.5 py-1 rounded-full">
            DEV OTP: {hint}
          </span>
        </div>
      )}

      {/* 6 digit boxes */}
      <div key={shakeKey} className={`flex justify-center gap-2.5 ${shakeKey ? 'animate-shake' : ''}`}>
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
            className="w-12 h-14 rounded-xl border border-slate-200 bg-white text-center text-lg font-black text-navy focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors"
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

      <div className="text-center">
        <button
          onClick={() => onNavigate('auth')}
          className="text-xs font-bold text-purple hover:text-purple-dark"
        >
          Back to Login
        </button>
      </div>
    </AuthCard>
  );
};

/* ─────────────────────────────────────────────────────────────
   Desktop reset password (mobile design 19 as a centered card).
   ───────────────────────────────────────────────────────────── */
export const ResetPasswordPage: React.FC<DesktopNavProps & { resetToken?: string }> = ({
  onNavigate,
  resetToken
}) => {
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
    <AuthCard title="Reset Password" subtitle="Enter your new password" shake={shakeKey}>
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
    </AuthCard>
  );
};
