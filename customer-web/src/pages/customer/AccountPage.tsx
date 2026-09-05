import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Heart,
  MapPin,
  User as UserIcon,
  KeyRound,
  LogOut,
  ChevronRight,
  Award,
  Eye,
  EyeOff,
  Loader2,
  Lock
} from 'lucide-react';
import { Order } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { StatusBadge } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

interface AccountPageProps {
  onNavigate: (page: string, params?: any) => void;
}

type Panel = 'dashboard' | 'profile' | 'password';

const getErrorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/* ─── Shared field building blocks ─── */

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-semibold text-slate-500 mb-1.5">{children}</label>
);

const inputClass =
  'w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm text-navy font-medium placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors';

const readOnlyInputClass =
  'w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-navy font-medium cursor-default focus:outline-none';

const PasswordInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}> = ({ value, onChange, autoComplete = 'new-password' }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
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

/* ─────────────────────────────────────────────────────────────
   Desktop design 13: MY ACCOUNT DASHBOARD
   Left sidebar card + main panel (dashboard / profile / password).
   ───────────────────────────────────────────────────────────── */
export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const { user, logout, rewardPoints, updateProfile } = useAuth();
  const { wishlist } = useWishlist();
  const { showToast } = useToast();

  const [panel, setPanel] = useState<Panel>('dashboard');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [addressCount, setAddressCount] = useState<number | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Change-password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  // Editable profile fields
  const [profileFirstName, setProfileFirstName] = useState(user?.firstName || '');
  const [profileLastName, setProfileLastName] = useState(user?.lastName || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Re-seed the profile form whenever the Profile panel is opened.
  useEffect(() => {
    if (panel === 'profile' && user) {
      setProfileFirstName(user.firstName || '');
      setProfileLastName(user.lastName || '');
      setProfilePhone(user.phone || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.getMyOrders()
      .then((data) => {
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    api.getAddresses()
      .then((data) => {
        if (!cancelled) setAddressCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {
        if (!cancelled) setAddressCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /* ── Logged-out gate: send the visitor to Login preserving intent ── */
  if (!user) {
    return (
      <div className="px-4 py-16 animate-fade-in">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-soft flex items-center justify-center">
            <UserIcon className="w-7 h-7 text-purple" />
          </div>
          <div>
            <h1 className="text-xl font-black text-navy">My Account</h1>
            <p className="text-sm text-slate-500 mt-1">Please login to view your account dashboard</p>
          </div>
          <button
            onClick={() => onNavigate('auth', { initialTab: 'login', redirectTo: 'account' })}
            className="w-full py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-sm shadow-md shadow-purple/25 transition-colors"
          >
            Login
          </button>
          <p className="text-xs text-slate-500">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('auth', { initialTab: 'register', redirectTo: 'account' })}
              className="font-bold text-purple hover:text-purple-dark"
            >
              Register
            </button>
          </p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    showToast('Logged out successfully', 'success');
    onNavigate('home');
  };

  const handleChangePassword = async () => {
    if (!currentPassword) return showToast('Please enter your current password', 'error');
    if (newPassword.length < 8) return showToast('New password must be at least 8 characters', 'error');
    if (newPassword !== confirmPassword) return showToast('Passwords do not match', 'error');
    if (newPassword === currentPassword) return showToast('New password must be different from the current password', 'error');
    setChanging(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      showToast('Password changed successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPanel('dashboard');
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Could not change password. Please try again.'), 'error');
    } finally {
      setChanging(false);
    }
  };

  const handleSaveProfile = async () => {
    const firstName = profileFirstName.trim();
    const lastName = profileLastName.trim();
    const phone = profilePhone.trim();
    if (!firstName) return showToast('First name is required', 'error');
    if (phone && !/^\d{10}$/.test(phone)) return showToast('Phone number must be exactly 10 digits', 'error');

    setSavingProfile(true);
    try {
      const ok = await updateProfile({ firstName, lastName, phone });
      if (ok) {
        showToast('Profile updated successfully', 'success');
      } else {
        showToast('Could not update profile. Please try again.', 'error');
      }
    } catch (error: any) {
      showToast(getErrorMessage(error, 'Could not update profile. Please try again.'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const recentOrders = (orders ?? [])
    .slice()
    .sort((a, b) => new Date(b.placedAtUtc).getTime() - new Date(a.placedAtUtc).getTime())
    .slice(0, 4);

  const statTiles: Array<{
    label: string;
    value: number | null;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    target?: string;
  }> = [
    {
      label: 'My Orders',
      value: orders === null ? null : orders.length,
      icon: ShoppingBag,
      iconBg: 'bg-purple-soft',
      iconColor: 'text-purple',
      target: 'my-orders'
    },
    {
      label: 'Wishlist',
      value: wishlist.length,
      icon: Heart,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      target: 'wishlist'
    },
    {
      label: 'Addresses',
      value: addressCount,
      icon: MapPin,
      iconBg: 'bg-orange-soft',
      iconColor: 'text-orange',
      target: 'addresses'
    },
    {
      label: 'Reward Points',
      value: rewardPoints ?? 0,
      icon: Award,
      iconBg: 'bg-gold-soft',
      iconColor: 'text-gold-dark'
    }
  ];

  const sidebarItems: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
    panel?: Panel;
    navigateTo?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, panel: 'dashboard' },
    { id: 'my-orders', label: 'My Orders', icon: ShoppingBag, navigateTo: 'my-orders' },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, navigateTo: 'wishlist' },
    { id: 'addresses', label: 'Addresses', icon: MapPin, navigateTo: 'addresses' },
    { id: 'profile', label: 'Profile', icon: UserIcon, panel: 'profile' },
    { id: 'password', label: 'Change Password', icon: KeyRound, panel: 'password' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left sidebar card ── */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-card p-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.panel !== undefined && panel === item.panel;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setConfirmLogout(false);
                  if (item.panel) setPanel(item.panel);
                  else if (item.navigateTo) onNavigate(item.navigateTo);
                }}
                className={`w-full px-3.5 py-3 rounded-xl text-sm font-bold flex items-center justify-between transition-colors ${
                  isActive ? 'bg-purple text-white shadow-md shadow-purple/25' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center space-x-2.5">
                  <Icon className="w-4.5 h-4.5" />
                  <span>{item.label}</span>
                </span>
                {!isActive && <ChevronRight className="w-4 h-4 text-slate-300" />}
              </button>
            );
          })}

          <div className="pt-1 mt-1 border-t border-slate-100">
            {confirmLogout ? (
              <div className="px-3.5 py-3 space-y-2.5">
                <p className="text-xs font-semibold text-slate-600">Are you sure you want to logout?</p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
                  >
                    Logout
                  </button>
                  <button
                    onClick={() => setConfirmLogout(false)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmLogout(true)}
                className="w-full px-3.5 py-3 rounded-xl text-sm font-bold flex items-center space-x-2.5 text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4.5 h-4.5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </aside>

        {/* ── Main panel ── */}
        <main className="lg:col-span-9 space-y-6">
          {panel === 'dashboard' && (
            <>
              {/* Greeting */}
              <div>
                <h1 className="text-2xl font-black text-navy">Hello, {user.firstName} 👋</h1>
                <p className="text-sm text-slate-500 mt-1">Welcome to your account dashboard</p>
              </div>

              {/* 4 stat tiles */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {statTiles.map((tile) => {
                  const Icon = tile.icon;
                  const inner = (
                    <>
                      <div className={`w-11 h-11 rounded-xl ${tile.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5.5 h-5.5 ${tile.iconColor}`} />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-2xl font-black text-navy leading-tight">
                          {tile.value === null ? (
                            <span className="inline-block w-8 h-6 rounded bg-slate-100 animate-pulse align-middle" />
                          ) : (
                            tile.value
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 truncate">{tile.label}</div>
                      </div>
                    </>
                  );
                  return tile.target ? (
                    <button
                      key={tile.label}
                      onClick={() => onNavigate(tile.target!)}
                      className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 flex items-center space-x-3.5 hover:border-purple/40 hover:shadow-card-hover transition-all"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div
                      key={tile.label}
                      className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 flex items-center space-x-3.5"
                    >
                      {inner}
                    </div>
                  );
                })}
              </div>

              {/* Recent orders */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-base font-black text-navy">Recent Orders</h2>
                  <button
                    onClick={() => onNavigate('my-orders')}
                    className="text-xs font-bold text-purple hover:text-purple-dark"
                  >
                    View All Orders
                  </button>
                </div>

                {orders === null ? (
                  <div className="px-5 py-10 flex items-center justify-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="px-5 py-10 text-center space-y-3">
                    <p className="text-sm text-slate-400">You haven't placed any orders yet.</p>
                    <button
                      onClick={() => onNavigate('shop')}
                      className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold transition-colors"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentOrders.map((ord) => (
                      <button
                        key={ord.id}
                        onClick={() => onNavigate('order-details', { orderId: ord.id, orderNumber: ord.orderNumber })}
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-navy truncate">{ord.orderNumber}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{formatDate(ord.placedAtUtc)}</div>
                        </div>
                        <div className="flex items-center space-x-3 shrink-0">
                          <span className="font-black text-sm text-navy">
                            ₹{ord.grandTotal.toLocaleString('en-IN')}
                          </span>
                          <StatusBadge status={ord.orderStatus} />
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {panel === 'profile' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
              <h1 className="text-xl font-black text-navy">Profile</h1>
              <p className="text-sm text-slate-500 mt-1">Update your personal details</p>

              <form
                className="mt-6 max-w-2xl"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveProfile();
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>First Name</FieldLabel>
                    <input
                      type="text"
                      value={profileFirstName}
                      onChange={(e) => setProfileFirstName(e.target.value)}
                      placeholder="First name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <FieldLabel>Last Name</FieldLabel>
                    <input
                      type="text"
                      value={profileLastName}
                      onChange={(e) => setProfileLastName(e.target.value)}
                      placeholder="Last name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <FieldLabel>Email Address</FieldLabel>
                    <div className="relative">
                      <input
                        type="email"
                        value={user.email || ''}
                        readOnly
                        disabled
                        className={`${readOnlyInputClass} pr-11 bg-slate-100 text-slate-500 cursor-not-allowed`}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">Email cannot be changed</p>
                  </div>
                  <div>
                    <FieldLabel>Phone Number</FieldLabel>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit mobile number"
                      className={inputClass}
                    />
                    {profilePhone.length > 0 && profilePhone.length !== 10 && (
                      <p className="text-[11px] font-semibold text-red-500 mt-1.5">
                        Phone number must be exactly 10 digits
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="mt-6 px-6 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-sm shadow-md shadow-purple/25 transition-colors disabled:opacity-60 flex items-center space-x-2"
                >
                  {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </form>
            </div>
          )}

          {panel === 'password' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
              <h1 className="text-xl font-black text-navy">Change Password</h1>
              <p className="text-sm text-slate-500 mt-1">Choose a strong password of at least 8 characters</p>

              <form className="space-y-4 mt-6 max-w-md" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <FieldLabel>Current Password</FieldLabel>
                  <PasswordInput
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <FieldLabel>New Password</FieldLabel>
                  <PasswordInput value={newPassword} onChange={setNewPassword} />
                </div>
                <div>
                  <FieldLabel>Confirm New Password</FieldLabel>
                  <PasswordInput value={confirmPassword} onChange={setConfirmPassword} />
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1.5">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    handleChangePassword();
                  }}
                  disabled={changing}
                  className="px-6 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-sm shadow-md shadow-purple/25 transition-colors disabled:opacity-60 flex items-center space-x-2"
                >
                  {changing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Update Password</span>
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
