import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  ArrowLeft,
  ChevronRight,
  SlidersHorizontal,
  Users,
  HelpCircle,
  Info,
  Shield,
  LogOut,
  X,
  Check,
  Star,
  Plus,
  Car,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Phone,
  User as UserIcon,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { ProvincialPlate, detectProvinceFromPlate } from '../components/ProvincialPlate.js';

export function ProfileScreen() {
  const {
    user,
    vehicles,
    setDefaultVehicle,
    updateUserPreferences,
    setActiveTab,
    switchAccount,
    signOut,
    isDemoAccount,
    setIsAuthModalOpen,
  } = useApp();

  // Modals
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showGeneralSettings, setShowGeneralSettings] = useState<boolean>(false);
  const [showContactsModal, setShowContactsModal] = useState<boolean>(false);
  const [showFaqModal, setShowFaqModal] = useState<boolean>(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);

  // Profile Edit State
  const [editName, setEditName] = useState(user?.fullName || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Contacts State
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string; relation: string }>>([
    { id: 'c1', name: 'Naledi Dlamini', phone: '+27 82 555 0192', relation: 'Spouse' },
    { id: 'c2', name: 'Jabu Khumalo', phone: '+27 83 444 9821', relation: 'Family Co-Driver' },
  ]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('Family');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    const res = await updateUserPreferences({
      fullName: editName,
      phone: editPhone,
    });
    setIsSavingProfile(false);
    if (res.success) {
      setProfileNotice('✓ Profile successfully updated');
      setTimeout(() => {
        setProfileNotice(null);
        setShowProfileModal(false);
      }, 1500);
    } else {
      setProfileNotice(res.error || 'Failed to update profile');
    }
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    setContacts([
      ...contacts,
      {
        id: `c_${Date.now()}`,
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
        relation: newContactRelation,
      },
    ]);
    setNewContactName('');
    setNewContactPhone('');
  };

  const handleRemoveContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id));
  };

  const faqs = [
    {
      q: 'How does Driver Ping delivery work?',
      a: 'When an alert is submitted for a vehicle plate, Driver Ping normalizes the plate according to South African provincial schemas and sends an instant SMS notification to the verified driver or owner.',
    },
    {
      q: 'Is my personal phone number kept private?',
      a: 'Yes, absolutely. Under Rule 8 Privacy by Design, reporters never see the recipient’s contact information, and recipients never see the reporter’s identity. All communication is routed securely.',
    },
    {
      q: 'How do I designate a default vehicle?',
      a: 'Tap General settings in this menu and choose your active primary vehicle. That license plate will be used for your incoming alerts and dashboard quick views.',
    },
    {
      q: 'What is the South African SMS spend cap?',
      a: 'To prevent runaway carrier costs, South African mobile alerts are capped at a monthly limit (defaulting to R25.00) which you can customize in General settings.',
    },
  ];

  // If user is not logged in
  if (!user) {
    return (
      <div className="pb-28 pt-2 px-3 max-w-[420px] mx-auto select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center border border-white/20 shadow-md backdrop-blur-md transition-all cursor-pointer"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <div className="text-center">
            <h1 className="font-black font-display text-base tracking-tight text-white uppercase drop-shadow-sm">
              Settings & Profile
            </h1>
          </div>
          <div className="w-10" />
        </div>

        {/* Guest Profile Card */}
        <div className="glass-card rounded-[32px] p-6 crimson-card-shadow text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-red-50 text-[#B81D39] mx-auto flex items-center justify-center shadow-inner">
            <UserIcon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black font-display text-gray-950">Guest Session</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Sign in with your South African mobile phone number or email to manage vehicle plates and alerts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full py-3.5 bg-gradient-to-r from-[#B81D39] via-[#941329] to-[#6B0C1D] hover:opacity-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg cursor-pointer"
          >
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-2 px-3 max-w-[420px] mx-auto select-none">
      {/* 1. TOP APP BAR */}
      <div className="flex items-center justify-between mb-3.5">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center border border-white/20 shadow-md backdrop-blur-md transition-all cursor-pointer"
          aria-label="Back to Home"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>
        <div className="text-center">
          <h1 className="font-black font-display text-base tracking-tight text-white uppercase drop-shadow-sm">
            Settings
          </h1>
        </div>
        <div className="w-10" />
      </div>

      <div className="space-y-3">
        {/* 2. USER PROFILE IDENTITY CARD */}
        <button
          type="button"
          onClick={() => setShowProfileModal(true)}
          className="w-full glass-card rounded-[28px] p-4 crimson-card-shadow flex items-center justify-between text-left transition-all hover:shadow-2xl active:scale-[0.99] cursor-pointer group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar matching app's crimson brand styling */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6B0C1D] via-[#941329] to-[#B81D39] p-0.5 shadow-md shrink-0 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-[#941329] flex items-center justify-center text-white font-black text-base font-display">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'D'}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-black font-display text-gray-950 group-hover:text-[#B81D39] transition-colors truncate">
                  {user.fullName || 'Registered Driver'}
                </h2>
                <span className="text-[9px] bg-red-100 text-[#941329] font-bold px-1.5 py-0.2 rounded shrink-0">
                  {user.role === 'admin' ? 'Admin' : user.plan === 'paid_owner' ? 'Owner' : 'Driver'}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {user.email || 'Verified Account'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#B81D39] group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* 3. PREFERENCES & CONTACTS */}
        <div className="glass-card rounded-[28px] p-2 crimson-card-shadow space-y-0.5">
          {/* General settings */}
          <button
            type="button"
            onClick={() => setShowGeneralSettings(true)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-gray-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#B81D39] flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="text-xs font-bold text-gray-900 group-hover:text-[#B81D39] transition-colors">
                General settings
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#B81D39] group-hover:translate-x-0.5 transition-all" />
          </button>

          <div className="h-px bg-gray-100 mx-3" />

          {/* My Contact */}
          <button
            type="button"
            onClick={() => setShowContactsModal(true)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-gray-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#B81D39] flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                <Users className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="text-xs font-bold text-gray-900 group-hover:text-[#B81D39] transition-colors">
                My Contact
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                {contacts.length} saved
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#B81D39] group-hover:translate-x-0.5 transition-all" />
            </div>
          </button>
        </div>

        {/* 5. SUPPORT & LEGAL POLICIES GROUP */}
        <div className="glass-card rounded-[28px] p-2 crimson-card-shadow space-y-0.5">
          {/* FAQ */}
          <button
            type="button"
            onClick={() => setShowFaqModal(true)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-gray-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#B81D39] flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                <HelpCircle className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="text-xs font-bold text-gray-900 group-hover:text-[#B81D39] transition-colors">
                FAQ
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#B81D39] group-hover:translate-x-0.5 transition-all" />
          </button>

          <div className="h-px bg-gray-100 mx-3" />

          {/* Terms of service */}
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-gray-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#B81D39] flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                <Info className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="text-xs font-bold text-gray-900 group-hover:text-[#B81D39] transition-colors">
                Terms of service
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#B81D39] group-hover:translate-x-0.5 transition-all" />
          </button>

          <div className="h-px bg-gray-100 mx-3" />

          {/* User policy */}
          <button
            type="button"
            onClick={() => setShowPolicyModal(true)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-gray-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#B81D39] flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                <Shield className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="text-xs font-bold text-gray-900 group-hover:text-[#B81D39] transition-colors">
                User policy
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#B81D39] group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>

        {/* 6. LOG OUT ACTION */}
        <div className="pt-2">
          <button
            type="button"
            onClick={signOut}
            className="w-full py-4 px-6 glass-card hover:bg-white active:scale-[0.98] text-[#B81D39] font-black text-xs uppercase tracking-wider rounded-full crimson-card-shadow flex items-center justify-center gap-2 transition-all cursor-pointer group shadow-xl"
          >
            <LogOut className="w-4 h-4 text-[#B81D39] group-hover:-translate-x-0.5 transition-transform" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: USER PROFILE DETAILS & EDIT */}
      {/* ========================================================================= */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-modal text-gray-950 rounded-[32px] w-full max-w-[390px] p-6 crimson-card-shadow space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#B81D39] bg-red-50 px-2 py-0.5 rounded-full">
                  Account Details
                </span>
                <h2 className="text-lg font-black font-display text-gray-950 mt-1">Profile & ID</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profileNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{profileNotice}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-900 font-semibold focus:outline-none focus:border-[#B81D39] focus:bg-white transition-all"
                  placeholder="e.g. Alex Morgan"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Call / Mobile Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-900 font-mono font-semibold focus:outline-none focus:border-[#B81D39] focus:bg-white transition-all"
                  placeholder="e.g. +27 82 123 4567"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between text-xs">
                <span className="font-bold text-gray-600">Plan Tier</span>
                <span className="font-black text-[#B81D39] bg-red-50 px-2.5 py-1 rounded-full uppercase text-[10px]">
                  {user.plan === 'paid_owner' ? 'Pro Owner' : 'Free Standard'}
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 py-3 rounded-2xl bg-[#B81D39] hover:bg-[#9E142C] text-white text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: GENERAL SETTINGS & DEFAULT VEHICLE */}
      {/* ========================================================================= */}
      {showGeneralSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-modal text-gray-950 rounded-[32px] w-full max-w-[390px] p-6 crimson-card-shadow space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  Preferences
                </span>
                <h2 className="text-lg font-black font-display text-gray-950 mt-1">General Settings</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneralSettings(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Default Vehicle Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-gray-950">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>Primary Number Plate</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Select your default vehicle. Other drivers’ observation alerts will prioritize this plate.
              </p>

              {vehicles.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                  <p className="text-xs text-gray-500">No vehicles registered yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGeneralSettings(false);
                      setActiveTab('vehicles');
                    }}
                    className="mt-2 text-xs font-black text-[#B81D39] hover:underline cursor-pointer"
                  >
                    + Register a vehicle in Fleet
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {vehicles.map((v) => {
                    const isDefault = v.isDefault || (!vehicles.some((x) => x.isDefault) && v.id === vehicles[0].id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={async () => {
                          await setDefaultVehicle(v.id);
                        }}
                        className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between text-xs transition-all cursor-pointer ${
                          isDefault
                            ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold shadow-xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-24 shrink-0 drop-shadow-xs">
                            <ProvincialPlate
                              provinceCode={detectProvinceFromPlate(v.plateDisplay)}
                              plateText={v.plateDisplay}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-xs text-gray-900 truncate">{v.plateDisplay}</div>
                            <div className="text-[10px] text-gray-500 truncate">{v.make} {v.model}</div>
                          </div>
                        </div>
                        {isDefault ? (
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full shrink-0">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#B81D39] font-bold hover:underline shrink-0">
                            Set Active ▶
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Compliance Console Access for Admins & Demo Testers */}
            {(user.role === 'admin' || isDemoAccount) && (
              <div className="pt-3 border-t border-gray-100">
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-purple-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-purple-950">Compliance Console</div>
                    <div className="text-[10px] text-gray-500">Document verifications & security audit</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (user.role !== 'admin' && isDemoAccount) {
                        await switchAccount('usr_admin_003');
                      }
                      setShowGeneralSettings(false);
                      setActiveTab('admin');
                    }}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
                  >
                    Open Console
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MY CONTACTS / TRUSTED CONTACTS */}
      {/* ========================================================================= */}
      {showContactsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-modal text-gray-950 rounded-[32px] w-full max-w-[390px] p-6 crimson-card-shadow space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Safety Circle
                </span>
                <h2 className="text-lg font-black font-display text-gray-950 mt-1">My Emergency Contacts</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Trusted family members or fleet co-drivers notified if urgent safety violations or road hazards occur.
            </p>

            <div className="space-y-2">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-black text-gray-950">{c.name}</div>
                    <div className="text-[11px] font-mono text-gray-500 mt-0.5">{c.phone} · {c.relation}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(c.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Contact Form */}
            <form onSubmit={handleAddContact} className="pt-3 border-t border-gray-100 space-y-2.5">
              <span className="text-xs font-black text-gray-900 block">Add Trusted Contact</span>
              <input
                type="text"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Contact Full Name"
                className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#B81D39]"
              />
              <input
                type="tel"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="Mobile number (e.g. +27 82 000 0000)"
                className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-900 font-mono focus:outline-none focus:border-[#B81D39]"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-[#B81D39] hover:bg-[#9E142C] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
              >
                + Save Emergency Contact
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: FAQ */}
      {/* ========================================================================= */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-modal text-gray-950 rounded-[32px] w-full max-w-[390px] p-6 crimson-card-shadow space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  Help & Guides
                </span>
                <h2 className="text-lg font-black font-display text-gray-950 mt-1">FAQ</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFaqModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {faqs.map((f, i) => (
                <div key={i} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                  <h3 className="text-xs font-black text-gray-950">{f.q}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: TERMS OF SERVICE */}
      {/* ========================================================================= */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-modal text-gray-950 rounded-[32px] w-full max-w-[390px] p-6 crimson-card-shadow space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                  Legal
                </span>
                <h2 className="text-lg font-black font-display text-gray-950 mt-1">Terms of Service</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
              <p>
                <strong className="text-gray-900">1. South African Road Safety Compliance:</strong> Driver Ping provides peer-to-peer notification to encourage civil road behavior and vehicle safety under RSA road traffic guidelines.
              </p>
              <p>
                <strong className="text-gray-900">2. Zero Abuse & Harassment:</strong> Driver Ping strictly forbids targeted harassment, abusive messaging, or false reporting. Repeated abuse results in immediate suspension and blacklisting.
              </p>
              <p>
                <strong className="text-gray-900">3. Rate Limiting:</strong> Submissions are rate-limited to avoid spam. Each plate observation undergoes verification against South African provincial formatting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: USER POLICY (PRIVACY BY DESIGN & POPIA) */}
      {/* ========================================================================= */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-modal text-gray-950 rounded-[32px] w-full max-w-[390px] p-6 crimson-card-shadow space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#B81D39] bg-red-50 px-2 py-0.5 rounded-full">
                  Privacy Guarantee
                </span>
                <h2 className="text-lg font-black font-display text-gray-950 mt-1">User Policy & Privacy</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
              <p>
                <strong className="text-gray-900">Protection of Personal Information Act (POPIA):</strong>
              </p>
              <ul className="list-disc pl-4 space-y-2 text-gray-600">
                <li><strong className="text-gray-900">No Public Plate Directory:</strong> We do not expose a searchable directory of registered owners or plate numbers.</li>
                <li><strong className="text-gray-900">Two-Sided Masking:</strong> Reporters never receive the recipient’s telephone number or identity, and recipients never receive the reporter’s details.</li>
                <li><strong className="text-gray-900">Minimal Data Retention:</strong> Incident observations are stored strictly for recipient notification and safety audit trails.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
