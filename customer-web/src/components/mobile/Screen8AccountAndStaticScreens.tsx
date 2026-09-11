import React, { useState } from 'react';
import {
  User,
  Heart,
  MapPin,
  LogOut,
  ChevronRight,
  ChevronDown,
  Phone,
  Mail,
  Clock,
  Award,
  ShieldCheck,
  Truck,
  Sparkles,
  Flame,
  ChevronLeft,
  CalendarDays,
  KeyRound,
  Camera,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

interface Screen8AccountProps {
  onNavigate: (page: string, params?: any) => void;
  onOpenNotifications: () => void;
}

/** Small labelled password input with show/hide toggle (Change Password modal). */
const ModalPasswordField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete="off"
          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-white text-sm text-navy font-medium placeholder:text-slate-300 focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

/** Design 15: Profile / Account page — navy header + menu list. */
export const Screen8Account: React.FC<Screen8AccountProps> = ({ onNavigate }) => {
  const { user, logout, updateProfile } = useAuth();
  const { showToast } = useToast();

  const [profileOpen, setProfileOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Editable profile form state
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const toggleProfileOpen = () => {
    setProfileOpen((open) => {
      if (!open && user) {
        // Seed the form from the current user each time the section opens.
        setProfileFirstName(user.firstName || '');
        setProfileLastName(user.lastName || '');
        setProfilePhone(user.phone || '');
      }
      return !open;
    });
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
      showToast(
        error?.response?.data?.message || error?.message || 'Could not update profile. Please try again.',
        'error'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // Change-password modal state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  const closeChangePassword = () => {
    setShowChangePassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async () => {
    if (!currentPassword) return showToast('Please enter your current password', 'error');
    if (newPassword.length < 8) return showToast('New password must be at least 8 characters', 'error');
    if (newPassword !== confirmPassword) return showToast('Passwords do not match', 'error');
    setChanging(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      showToast('Password changed successfully', 'success');
      closeChangePassword();
    } catch (error: any) {
      showToast(
        error?.response?.data?.message || error?.message || 'Could not change password. Please try again.',
        'error'
      );
    } finally {
      setChanging(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    showToast('Logged out successfully', 'info');
    onNavigate('home');
  };

  const requireAuth = (action: () => void) => () => {
    if (!user) {
      showToast('Please login to continue', 'info');
      onNavigate('auth');
      return;
    }
    action();
  };

  const menuItems: Array<{
    label: string;
    icon: React.ElementType;
    action: () => void;
    danger?: boolean;
    expandable?: boolean;
  }> = [
    { label: 'My Profile', icon: User, expandable: true, action: requireAuth(toggleProfileOpen) },
    { label: 'My Orders', icon: CalendarDays, action: () => onNavigate('my-orders') },
    { label: 'Wishlist', icon: Heart, action: () => onNavigate('wishlist') },
    { label: 'Addresses', icon: MapPin, action: () => onNavigate('addresses') },
    { label: 'Change Password', icon: KeyRound, action: requireAuth(() => setShowChangePassword(true)) },
    { label: 'Logout', icon: LogOut, danger: true, action: requireAuth(() => setShowLogoutConfirm(true)) }
  ];

  return (
    <div className="pb-8 font-sans bg-[#fbfbfb] animate-fade-in">
      {/* ── Navy profile header (design 15) ── */}
      <div className="bg-navy rounded-b-3xl px-4 pt-3 pb-6 text-center relative">
        <button
          onClick={() => onNavigate('home')}
          aria-label="Back"
          className="absolute left-3 top-3 p-1 text-white/80 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Avatar with camera badge */}
        <div className="relative inline-block mt-2">
          <div className="w-24 h-24 rounded-full bg-slate-200/90 border-4 border-white/10 flex items-center justify-center overflow-hidden">
            <User className="w-12 h-12 text-navy/70" strokeWidth={1.75} />
          </div>
          <button
            onClick={() => showToast('Photo upload coming soon', 'info')}
            aria-label="Change photo"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-white shadow-md flex items-center justify-center text-navy active:scale-95 transition-transform"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {user ? (
          <>
            <h2 className="mt-3 text-lg font-black text-white">
              {`${user.firstName} ${user.lastName}`.trim()}
            </h2>
            <p className="mt-1 text-xs text-white/70 font-medium">
              {[user.phone, user.email].filter(Boolean).join(' | ')}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-lg font-black text-white">Welcome, Guest</h2>
            <p className="mt-1 text-xs text-white/70 font-medium">Sign in to view your orders and wishlist</p>
            <button
              onClick={() => onNavigate('auth')}
              className="mt-3 px-6 py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-md transition-colors"
            >
              Login / Register
            </button>
          </>
        )}
      </div>

      {/* ── Menu list ── */}
      <div className="p-4">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isProfile = item.expandable;
            return (
              <React.Fragment key={item.label}>
                <button
                  onClick={item.action}
                  className={`w-full p-4 flex items-center justify-between text-sm font-semibold transition-colors text-left ${
                    item.danger ? 'text-red-500 hover:bg-red-50' : 'text-navy hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <Icon className={`w-4.5 h-4.5 ${item.danger ? 'text-red-500' : 'text-navy/70'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isProfile && profileOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-300" />
                  ) : (
                    <ChevronRight className={`w-4 h-4 ${item.danger ? 'text-red-300' : 'text-slate-300'}`} />
                  )}
                </button>

                {/* Inline expandable My Profile — editable form */}
                {isProfile && profileOpen && user && (
                  <div className="px-4 py-3.5 bg-slate-50/70 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">First Name</label>
                        <input
                          type="text"
                          value={profileFirstName}
                          onChange={(e) => setProfileFirstName(e.target.value)}
                          placeholder="First name"
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-navy font-semibold placeholder:text-slate-300 focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={profileLastName}
                          onChange={(e) => setProfileLastName(e.target.value)}
                          placeholder="Last name"
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-navy font-semibold placeholder:text-slate-300 focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile number"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-navy font-semibold placeholder:text-slate-300 focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors"
                      />
                      {profilePhone.length > 0 && profilePhone.length !== 10 && (
                        <p className="mt-1 text-[10px] font-semibold text-red-500">Phone number must be exactly 10 digits</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email</label>
                      <div className="relative">
                        <input
                          type="email"
                          value={user.email || ''}
                          readOnly
                          disabled
                          className="w-full px-3 py-2.5 pr-9 rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-500 font-semibold cursor-not-allowed"
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400 font-medium">Email cannot be changed</p>
                    </div>

                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="w-full py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/25 transition-colors disabled:opacity-60 flex items-center justify-center space-x-2"
                    >
                      {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Change Password modal ── */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4 animate-scale-up shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-navy">Change Password</h3>
              <button onClick={closeChangePassword} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <ModalPasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} />
            <ModalPasswordField label="New Password" value={newPassword} onChange={setNewPassword} />
            <ModalPasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-[11px] font-semibold text-red-500 -mt-2">Passwords do not match</p>
            )}

            <div className="flex space-x-3 pt-1">
              <button
                onClick={closeChangePassword}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changing}
                className="flex-1 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white text-sm font-bold shadow-md shadow-purple/25 transition-colors disabled:opacity-60 flex items-center justify-center space-x-2"
              >
                {changing && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Update</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logout confirmation modal ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4 animate-scale-up shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-black text-navy">Logout?</h3>
              <p className="text-xs text-slate-500 mt-1">Are you sure you want to logout of your account?</p>
            </div>
            <div className="flex space-x-3 pt-1">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-md transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Screen9AboutUs: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="space-y-4 p-4 pb-8 font-sans bg-[#fbfbfb]">
      {/* Title Header */}
      <div className="flex items-center space-x-2">
        <button onClick={onBack} className="p-1 -ml-1 text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-black text-navy">About Aadhi Crackers</h2>
      </div>

      {/* Storefront Photo Card matching Screen 9 */}
      <div className="rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-lg relative aspect-16/10">
        <img
          src="/product-placeholder.svg"
          alt="Aadhi Crackers Store"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent flex items-end p-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-orange flex items-center justify-center shadow-md">
              <Flame className="w-5 h-5 text-white fill-current" />
            </div>
            <div>
              <div className="font-black text-sm text-white">AADHI CRACKERS</div>
              <div className="text-[9px] text-gold font-bold uppercase">Sivakasi Original</div>
            </div>
          </div>
        </div>
      </div>

      {/* Description Text */}
      <p className="text-xs text-slate-600 leading-relaxed">
        Aadhi Crackers is your one-stop destination for premium quality crackers for all your celebrations. We are committed to providing 100% original products, safe packaging and reliable transport dispatch.
      </p>

      {/* 4 Feature Badges in 2x2 Grid matching Screen 9 */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-2.5">
          <Award className="w-5 h-5 text-orange flex-shrink-0" />
          <div>
            <div className="font-bold text-xs text-navy">Best Quality</div>
            <div className="text-[9px] text-slate-400">100% Original</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-2.5">
          <Sparkles className="w-5 h-5 text-purple flex-shrink-0" />
          <div>
            <div className="font-bold text-xs text-navy">Wide Range</div>
            <div className="text-[9px] text-slate-400">500+ Products</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-2.5">
          <Truck className="w-5 h-5 text-gold flex-shrink-0" />
          <div>
            <div className="font-bold text-xs text-navy">Transport Delivery</div>
            <div className="text-[9px] text-slate-400">Arrives in 1–2 weeks</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <div className="font-bold text-xs text-navy">Safe & Trusted</div>
            <div className="text-[9px] text-slate-400">Secure Packaging</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Screen10ContactUs: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="space-y-4 p-4 pb-8 font-sans bg-[#fbfbfb]">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <button onClick={onBack} className="p-1 -ml-1 text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-black text-navy">Contact Us</h2>
      </div>

      {/* Info Card matching Screen 10 */}
      <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-card space-y-4 text-xs">
        <div className="flex items-start space-x-3 text-slate-600">
          <MapPin className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
          <span>123, West Street, Shivanandapuram, Coimbatore - 641012</span>
        </div>

        <div className="flex items-center space-x-3 text-slate-600">
          <Phone className="w-4 h-4 text-gold flex-shrink-0" />
          <span className="font-bold text-navy">+91 98765 43210</span>
        </div>

        <div className="flex items-center space-x-3 text-slate-600">
          <Mail className="w-4 h-4 text-purple flex-shrink-0" />
          <span>support@aadhicracker.in</span>
        </div>

        <div className="flex items-start space-x-3 text-slate-600 pt-2 border-t border-slate-100">
          <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-navy">Mon - Sat: 8:00 AM - 8:00 PM</div>
            <div className="text-slate-400">Sunday: 10:00 AM - 6:00 PM</div>
          </div>
        </div>
      </div>

      {/* Follow Us social buttons matching Screen 10 */}
      <div className="space-y-2 pt-2">
        <h3 className="font-bold text-xs text-navy uppercase tracking-wider">Follow Us</h3>
        <div className="flex items-center space-x-3">
          <a
            href="#"
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs"
          >
            f
          </a>
          <a
            href="#"
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs"
          >
            📸
          </a>
          <a
            href="#"
            className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow-xs"
          >
            ▶
          </a>
        </div>
      </div>
    </div>
  );
};

export const Screen14CategoryMenu: React.FC<{
  onNavigate: (page: string, params?: any) => void;
}> = ({ onNavigate }) => {
  const [categories, setCategories] = React.useState<any[]>([]);

  React.useEffect(() => {
    api.getCategories().then(setCategories);
  }, []);

  return (
    <div className="space-y-3 p-4 pb-8 font-sans bg-[#fbfbfb]">
      <h2 className="text-base font-black text-navy">All Categories ({categories.length})</h2>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {categories.map((c) => (
          <button
            key={c.id || c.slug}
            onClick={() => onNavigate('category', { category: c.slug })}
            className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <span className="text-base">🎆</span>
              <div>
                <span className="font-bold text-navy">{c.name}</span>
                {c.description && <p className="text-[10px] text-slate-400 font-normal">{c.description}</p>}
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-bold text-purple bg-purple/10 px-2 py-0.5 rounded-full">
                {c.productCount || 0} Items
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
