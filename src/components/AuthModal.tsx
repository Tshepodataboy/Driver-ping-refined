import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  X,
  ShieldCheck,
  ArrowRight,
  Mail,
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Car,
} from 'lucide-react';
import { ProvincialPlate } from './ProvincialPlate.js';

const PROVINCES = [
  { code: 'GP', name: 'Gauteng', plateSuffix: 'GP' },
  { code: 'WC', name: 'Western Cape', plateSuffix: 'WP / CA' },
  { code: 'KZN', name: 'KwaZulu-Natal', plateSuffix: 'ZN' },
  { code: 'EC', name: 'Eastern Cape', plateSuffix: 'EC' },
  { code: 'FS', name: 'Free State', plateSuffix: 'FS' },
  { code: 'MP', name: 'Mpumalanga', plateSuffix: 'MP' },
  { code: 'LP', name: 'Limpopo', plateSuffix: 'L' },
  { code: 'NW', name: 'North West', plateSuffix: 'NW' },
  { code: 'NC', name: 'Northern Cape', plateSuffix: 'NC' },
];

export function AuthModal() {
  const { isAuthModalOpen, setIsAuthModalOpen, loginWithEmail, loginAsDemo, updateUserPreferences, registerVehicle } = useApp();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  // Sign In / Registration Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 Profile Onboarding
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('GP');
  const [initialPlate, setInitialPlate] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleClose = () => {
    setIsAuthModalOpen(false);
    setError(null);
    setSuccess(null);
    setSignupStep(1);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    const res = await loginWithEmail(email.trim(), undefined, 'signin', password);
    setIsLoading(false);

    if (res.success) {
      handleClose();
    } else {
      setError(res.error || 'Could not sign in. Please verify your credentials.');
    }
  };

  const handleSignUpEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    const fullDriverName = firstName.trim()
      ? (surname.trim() ? `${firstName.trim()} ${surname.trim()}` : firstName.trim())
      : undefined;

    setIsLoading(true);
    const res = await loginWithEmail(email.trim(), fullDriverName, 'signup', password);
    setIsLoading(false);

    if (res.success) {
      setSuccess('Account created and logged in!');
      handleClose();
    } else {
      setError(res.error || 'Registration failed');
    }
  };

  const handleProfileOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }
    if (!surname.trim()) {
      setError('Please enter your surname.');
      return;
    }
    if (!callNumber.trim() || callNumber.trim().length < 7) {
      setError('Please enter a valid call number (e.g. 082 123 4567).');
      return;
    }

    setIsLoading(true);
    const combinedFullName = `${firstName.trim()} ${surname.trim()}`;
    const cleanPlate = initialPlate.trim().toUpperCase();

    const updateRes = await updateUserPreferences({
      fullName: combinedFullName,
      defaultProvinceCode: selectedProvince,
      defaultPlate: cleanPlate || undefined,
    });

    if (cleanPlate) {
      try {
        await registerVehicle({ plate: cleanPlate });
      } catch (err) {
        console.warn('Vehicle registration error:', err);
      }
    }

    setIsLoading(false);

    if (updateRes.success) {
      handleClose();
    } else {
      setError(updateRes.error || 'Failed to update profile.');
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal text-gray-950 rounded-[34px] max-w-sm w-full p-6 shadow-2xl relative border border-gray-100 max-h-[92vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          {/* Header Icon */}
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#B81D39] flex items-center justify-center mb-3">
            <Mail className="w-6 h-6 stroke-[2.2]" />
          </div>

          {/* Mode Switcher Tabs */}
          {signupStep === 1 && (
            <div className="flex bg-gray-100 p-1 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-white text-[#B81D39] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-white text-[#B81D39] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {error && (
            <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-3 p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* SIGN IN VIEW */}
          {/* ============================================================ */}
          {authMode === 'signin' && (
            <div>
              <h2 className="text-xl font-black font-display text-gray-900">
                Sign In
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Enter your registered Email address and password.
              </p>

              <div className="mt-4 space-y-3">
                <form onSubmit={handleSignInSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@gmail.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                      />
                    </div>
                  </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password</label>
                  <input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]" />
                </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-[#B81D39] hover:bg-[#9E142C] text-white font-bold text-xs rounded-2xl shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Signing in...' : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SIGN UP VIEW - REGISTRATION */}
          {/* ============================================================ */}
          {authMode === 'signup' && (
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-100 text-[#941329] rounded-full text-[9px] font-black uppercase tracking-wider mb-1.5">
                New Account Registration
              </div>
              <h2 className="text-xl font-black font-display text-gray-900">
                Create Account
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Enter your details to create an account and sign in immediately.
              </p>

              <div className="mt-4 space-y-3">
                <form onSubmit={handleSignUpEmailSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Alex"
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Surname
                      </label>
                      <input
                        type="text"
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        placeholder="Morgan"
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password *</label>
                    <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]" />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-[#B81D39] hover:bg-[#9E142C] text-white font-bold text-xs rounded-2xl shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Creating Account & Signing In...' : (
                      <>
                        <span>Create Account & Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SIGN UP VIEW - STEP 2: Name, Surname, Call Number */}
          {/* ============================================================ */}
          {authMode === 'signup' && signupStep === 2 && (
            <div className="animate-in fade-in duration-200">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black uppercase tracking-wider mb-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Step 2 of 2 · Driver Profile
              </div>
              <h2 className="text-xl font-black font-display text-gray-900">
                Driver Information
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Enter your name, surname, and call number to complete registration.
              </p>

              <form onSubmit={handleProfileOnboardingSubmit} className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      First Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Alex"
                        className="w-full pl-9 pr-2.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Surname *
                    </label>
                    <input
                      type="text"
                      required
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      placeholder="Morgan"
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Call / Mobile Number *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Phone className="w-4 h-4 text-emerald-600" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={callNumber}
                      onChange={(e) => setCallNumber(e.target.value)}
                      placeholder="082 123 4567 or +27 82 123 4567"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    For road safety call and SMS alerts.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Province
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <select
                      value={selectedProvince}
                      onChange={(e) => setSelectedProvince(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                    >
                      {PROVINCES.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name} ({p.plateSuffix})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    License Plate (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Car className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={initialPlate}
                      onChange={(e) => setInitialPlate(e.target.value)}
                      placeholder="e.g. CA 882 GP"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B81D39]/20 focus:border-[#B81D39]"
                    />
                  </div>
                  {initialPlate.trim() && (
                    <div className="mt-2 w-32 mx-auto drop-shadow-xs">
                      <ProvincialPlate
                        provinceCode={selectedProvince}
                        plateText={initialPlate.trim().toUpperCase()}
                      />
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-gray-50 rounded-2xl flex items-start gap-2 text-xs text-gray-600">
                  <ShieldCheck className="w-4 h-4 text-[#B81D39] shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-tight">
                    Strict privacy: Your call number and details are never exposed to other drivers.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-[#B81D39] hover:bg-[#9E142C] text-white font-bold text-xs rounded-2xl shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Saving Profile...' : (
                    <>
                      <span>Complete & Enter Driver Ping</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Instant Demo Access Section */}
          {signupStep === 1 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 text-center mb-2">
                Instant Demo Access
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={async () => {
                  setIsLoading(true);
                  await loginAsDemo('usr_alex_001');
                  setIsLoading(false);
                  handleClose();
                }}
                className="w-full py-2.5 px-3 bg-[#B81D39] hover:bg-[#9E142C] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Login as Demo Driver (Alex Morgan)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
