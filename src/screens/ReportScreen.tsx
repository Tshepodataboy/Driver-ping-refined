import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.js';
import { CATEGORIES } from '../constants/issues.js';
import { ReportCategory, IssueOption } from '../types/index.js';
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  Car,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  HelpCircle,
  Lock,
  Search,
  X,
  Upload,
  Siren,
  Sparkles,
  Loader2,
} from 'lucide-react';

import { SA_PROVINCES, searchProvinces } from '../constants/provinces.js';
import {
  ProvincialPlate,
  InteractiveProvincialPlateInput,
  PROVINCE_DEFAULT_PLATES,
  PROVINCE_NAMES,
  normalizeProvinceCode,
  formatFullProvincialPlate,
  stripProvinceCodeFromInput,
} from '../components/ProvincialPlate.js';

export function ReportScreen() {
  const {
    user,
    reportCategoryPreset,
    setReportCategoryPreset,
    setActiveTab,
    submitReport,
    setIsAuthModalOpen,
    theme,
  } = useApp();

  const isDark = theme === 'dark';

  // Wizard state initialized from sessionStorage draft if available
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_step');
      if (saved) {
        const num = parseInt(saved, 10);
        if (num >= 1 && num <= 4) return num as 1 | 2 | 3 | 4;
      }
    }
    return 1;
  });

  // Form state initialized from sessionStorage draft if available
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_prov');
      if (saved) return saved;
    }
    return user?.defaultProvinceCode || 'GP';
  });
  const [plateNumber, setPlateNumber] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_plate_num');
      if (saved !== null) return saved;
    }
    return '';
  });
  const [plate, setPlate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_plate');
      if (saved !== null) return saved;
    }
    return '';
  });
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>(() => {
    if (reportCategoryPreset) return reportCategoryPreset;
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_cat') as ReportCategory;
      if (saved) return saved;
    }
    return 'vehicle_condition';
  });
  const [selectedIssueCode, setSelectedIssueCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_issue');
      if (saved !== null) return saved;
    }
    return '';
  });
  const [customOtherText, setCustomOtherText] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_other');
      if (saved !== null) return saved;
    }
    return '';
  });
  const [customNote, setCustomNote] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_note');
      if (saved !== null) return saved;
    }
    return '';
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('driver_ping_draft_photo');
      if (saved) return saved;
    }
    return null;
  });

  // Automatically save report draft into sessionStorage whenever state updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('driver_ping_draft_step', String(step));
      sessionStorage.setItem('driver_ping_draft_prov', selectedProvinceCode);
      sessionStorage.setItem('driver_ping_draft_plate_num', plateNumber);
      sessionStorage.setItem('driver_ping_draft_plate', plate);
      sessionStorage.setItem('driver_ping_draft_cat', selectedCategory);
      sessionStorage.setItem('driver_ping_draft_issue', selectedIssueCode);
      sessionStorage.setItem('driver_ping_draft_other', customOtherText);
      sessionStorage.setItem('driver_ping_draft_note', customNote);
      if (photoPreview) {
        try {
          sessionStorage.setItem('driver_ping_draft_photo', photoPreview);
        } catch {
          // If storage quota exceeded for high-res photo, skip photo caching
        }
      } else {
        sessionStorage.removeItem('driver_ping_draft_photo');
      }
    }
  }, [step, selectedProvinceCode, plateNumber, plate, selectedCategory, selectedIssueCode, customOtherText, customNote, photoPreview]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanningPlate, setIsScanningPlate] = useState(false);
  const [scanResult, setScanResult] = useState<{
    provinceCode: string;
    provinceName: string;
    plateTypeLabel: string;
    registration: string;
    confidence: number | null;
  } | null>(null);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    deliveriesRecorded?: number;
    isQueuedUnclaimed?: boolean;
    isDuplicatePrevented?: boolean;
    statusMessage?: string;
  } | null>(null);

  // Idempotency key generated per session to prevent accidental double-submits
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `idemp_${Date.now()}_${Math.random()}`);

  // Two-step plate scanning: 1. Identify province code -> 2. Auto-input unique number
  const scanPlateWithAi = async (imageDataUrl: string) => {
    if (!imageDataUrl) return;
    setIsScanningPlate(true);
    setAiNotice('AI scanning vehicle photo: identifying province & plate number...');
    try {
      const res = await fetch('/api/ai/extract-plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoBase64: imageDataUrl }),
      });
      const data = await res.json();

      if (res.status === 503) {
        setScanResult(null);
        setAiNotice('AI scanning is not active yet — add a GEMINI_API_KEY to enable plate recognition.');
        return;
      }

      if (res.ok && data.data) {
        const {
          plateVisible,
          provinceCode,
          provinceName,
          plateTypeLabel,
          uniqueRegistrationNumber,
          fullPlate,
          rawOcrText,
          observedCondition,
          confidence,
        } = data.data;

        const rawNum = uniqueRegistrationNumber || fullPlate || rawOcrText;
        if (plateVisible === false || !rawNum) {
          setScanResult(null);
          setAiNotice(data.error || 'No legible plate in this photo — move closer and re-scan.');
          return;
        }

        // Step 1: province mark and plate type are resolved before any digits are read.
        let resolvedProv = selectedProvinceCode || 'GP';
        if (provinceCode) {
          resolvedProv = normalizeProvinceCode(provinceCode);
          setSelectedProvinceCode(resolvedProv);
        }
        const resolvedProvName = provinceName || PROVINCE_NAMES[resolvedProv] || resolvedProv;

        // Step 2: only the unique registration characters are written into the plate input.
        const cleanUniqueReg = stripProvinceCodeFromInput(rawNum, resolvedProv);
        setPlateNumber(cleanUniqueReg);
        setPlate(formatFullProvincialPlate(cleanUniqueReg, resolvedProv));

        if (observedCondition && !customNote) {
          setCustomNote(observedCondition);
        }

        setScanResult({
          provinceCode: resolvedProv,
          provinceName: resolvedProvName,
          plateTypeLabel: plateTypeLabel || 'Plate',
          registration: cleanUniqueReg,
          confidence: typeof confidence === 'number' ? confidence : null,
        });
        setAiNotice('✓ Gemini read the plate — province identified, registration auto-filled.');
      } else {
        setScanResult(null);
        setAiNotice(data.error || 'Gemini could not detect a plate clearly.');
      }
    } catch {
      setScanResult(null);
      setAiNotice('Failed to scan plate with Gemini.');
    } finally {
      setIsScanningPlate(false);
    }
  };

  const handleAiScanPlate = async () => {
    if (photoPreview) {
      await scanPlateWithAi(photoPreview);
    }
  };

  const handleAiSuggestNote = async () => {
    setIsGeneratingNote(true);
    setAiNotice(null);
    try {
      const res = await fetch('/api/ai/suggest-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueTitle: isOther ? customOtherText : currentIssue?.title,
          category: selectedCategory,
          rawNote: customNote,
        }),
      });
      const data = await res.json();
      if (res.ok && data.suggestedNote) {
        setCustomNote(data.suggestedNote);
        setAiNotice('✓ Gemini drafted a polite road safety note');
        setTimeout(() => setAiNotice(null), 3000);
      } else {
        setAiNotice(data.error || 'Failed to generate note.');
        setTimeout(() => setAiNotice(null), 3000);
      }
    } catch {
      setAiNotice('Failed to reach Gemini.');
      setTimeout(() => setAiNotice(null), 3000);
    } finally {
      setIsGeneratingNote(false);
    }
  };

  useEffect(() => {
    if (reportCategoryPreset) {
      setSelectedCategory(reportCategoryPreset);
    }
  }, [reportCategoryPreset]);

  // Auto-populate default number plate & province from user settings if available
  useEffect(() => {
    if (user?.defaultPlate && !plateNumber) {
      const defProv = user.defaultProvinceCode || 'WC';
      const cleanReg = stripProvinceCodeFromInput(user.defaultPlate, defProv);
      setPlateNumber(cleanReg);
      if (!selectedProvinceCode) {
        setSelectedProvinceCode(defProv);
      }
      setPlate(formatFullProvincialPlate(cleanReg, defProv));
    } else if (user?.defaultProvinceCode && !selectedProvinceCode) {
      setSelectedProvinceCode(user.defaultProvinceCode);
      setPlateNumber('');
      setPlate('');
    }
  }, [user]);

  const selectedProvince = useMemo(() => {
    return (
      SA_PROVINCES.find((p) => p.code === selectedProvinceCode) ||
      SA_PROVINCES.find((p) => p.code === 'GP') ||
      SA_PROVINCES[0]
    );
  }, [selectedProvinceCode]);

  // Helper to compute formatted plate with province
  const getCombinedPlate = (rawNumber: string, provCode: string) => {
    return formatFullProvincialPlate(rawNumber, provCode);
  };

  const handleProvinceSelect = (code: string) => {
    setSelectedProvinceCode(code);
    setPlate(getCombinedPlate(plateNumber, code));
  };

  const currentCategoryData = CATEGORIES.find((c) => c.id === selectedCategory)!;
  const currentIssue = currentCategoryData.issues.find((i) => i.code === selectedIssueCode);

  const isOther = selectedIssueCode.startsWith('other_');

  // Handle Photo selection with automatic client-side compression to prevent large payloads
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1280;
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setPhotoPreview(compressedDataUrl);
          // When image is captured, AI immediately scans plate: 1. Province code, 2. Auto-input unique number
          scanPlateWithAi(compressedDataUrl);
        } else {
          setPhotoPreview(result);
          scanPlateWithAi(result);
        }
      };
      img.onerror = () => {
        setPhotoPreview(result);
        scanPlateWithAi(result);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    // Reset file input value so re-taking with camera triggers change event again
    e.target.value = '';
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!plate.trim() || !selectedIssueCode) {
      setError('Please fill in the license plate and selected issue');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const issueTitle = isOther
      ? (customOtherText.trim() || currentIssue?.title || 'Other observed issue')
      : (currentIssue?.title || 'Observed vehicle issue');

    const res = await submitReport({
      plate: plate.trim(),
      category: selectedCategory,
      issueCode: selectedIssueCode,
      issueTitle,
      customNote: customNote.trim() || undefined,
      photoUrl: photoPreview || undefined,
      idempotencyKey,
    });

    setIsSubmitting(false);

    if (res.success) {
      clearDraftStorage();
      setSubmissionResult({
        deliveriesRecorded: res.deliveriesRecorded,
        isQueuedUnclaimed: res.isQueuedUnclaimed,
        isDuplicatePrevented: res.isDuplicatePrevented,
        statusMessage: res.statusMessage,
      });
      setStep(4); // Success step
    } else {
      setError(res.error || 'Failed to submit report. Please try again.');
    }
  };

  const clearDraftStorage = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('driver_ping_draft_step');
      sessionStorage.removeItem('driver_ping_draft_prov');
      sessionStorage.removeItem('driver_ping_draft_plate_num');
      sessionStorage.removeItem('driver_ping_draft_plate');
      sessionStorage.removeItem('driver_ping_draft_cat');
      sessionStorage.removeItem('driver_ping_draft_issue');
      sessionStorage.removeItem('driver_ping_draft_other');
      sessionStorage.removeItem('driver_ping_draft_note');
      sessionStorage.removeItem('driver_ping_draft_photo');
    }
  };

  const handleStartFresh = () => {
    clearDraftStorage();
    setStep(1);
    setPlateNumber('');
    setPlate('');
    setSelectedProvinceCode('GP');
    setSelectedIssueCode('');
    setCustomOtherText('');
    setCustomNote('');
    setPhotoPreview(null);
    setScanResult(null);
    setSubmissionResult(null);
    setError(null);
    setReportCategoryPreset(null);
    setIdempotencyKey(`idemp_${Date.now()}_${Math.random()}`);
  };

  // Dynamic pill header depending on chosen category
  const getPillData = () => {
    if (!reportCategoryPreset && step === 1 && !selectedCategory) {
      return {
        label: 'REPORT OBSERVED VEHICLE',
        icon: null,
      };
    }

    if (selectedCategory === 'vehicle_condition') {
      return {
        label: 'VEHICLE CONDITIONS',
        icon: <Car className="w-3.5 h-3.5 text-[#F87171]" />,
      };
    }
    if (selectedCategory === 'driver_behaviour') {
      return {
        label: 'DRIVER BEHAVIOR',
        icon: (
          <svg
            className="w-3.5 h-3.5 text-[#60A5FA]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="9" />
            <line x1="2" y1="12" x2="9" y2="12" />
            <line x1="15" y1="12" x2="22" y2="12" />
          </svg>
        ),
      };
    }
    if (selectedCategory === 'road_violation') {
      return {
        label: 'ROAD VIOLATION',
        icon: (
          <svg
            className="w-3.5 h-3.5 text-[#FBBF24]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="2" x2="4" y2="22" />
            <line x1="20" y1="2" x2="20" y2="22" />
            <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
          </svg>
        ),
      };
    }
    if (selectedCategory === 'emergency') {
      return {
        label: 'EMERGENCY SOS',
        icon: <Siren className="w-3.5 h-3.5 text-rose-500 animate-pulse" />,
      };
    }

    return {
      label: 'REPORT OBSERVED VEHICLE',
      icon: null,
    };
  };

  const getCategoryStyle = (catId: ReportCategory | string) => {
    switch (catId) {
      case 'driver_behaviour':
        return {
          title: 'Driver Behaviour',
          subtitle: 'Observe unsafe driving, speeding, tailgating, or illegal maneuvers',
          badgeBg: 'bg-blue-500/10 border-blue-500/30 text-blue-200',
          iconBg: 'bg-[#1e40af] text-white shadow-xs',
          textAccent: 'text-[#60A5FA]',
          pillBg: 'bg-blue-500/20 border-blue-400/40 text-blue-200',
          outlineColor: '#2563eb',
          outlineClass: 'ring-2 ring-[#2563eb] shadow-[0_0_28px_rgba(37,99,235,0.3)]',
          icon: (
            <svg className="w-5 h-5 text-[#60A5FA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="9" />
              <line x1="2" y1="12" x2="9" y2="12" />
              <line x1="15" y1="12" x2="22" y2="12" />
            </svg>
          ),
        };
      case 'road_violation':
        return {
          title: 'Road Violation',
          subtitle: 'Document traffic infractions, running red robots, or illegal parking',
          badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
          iconBg: 'bg-[#d97706] text-white shadow-xs',
          textAccent: 'text-[#FBBF24]',
          pillBg: 'bg-amber-500/20 border-amber-400/40 text-amber-200',
          outlineColor: '#d97706',
          outlineClass: 'ring-2 ring-[#d97706] shadow-[0_0_28px_rgba(217,119,6,0.3)]',
          icon: (
            <svg className="w-5 h-5 text-[#FBBF24]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="2" x2="4" y2="22" />
              <line x1="20" y1="2" x2="20" y2="22" />
              <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
            </svg>
          ),
        };
      case 'emergency':
        return {
          title: 'Emergency SOS',
          subtitle: 'Immediate danger, hijacking, violent road rage, or severe crash',
          badgeBg: 'bg-red-500/15 border-red-500/40 text-red-200',
          iconBg: 'bg-[#dc2626] text-white shadow-xs',
          textAccent: 'text-rose-400',
          pillBg: 'bg-red-500/20 border-red-400/40 text-red-200',
          outlineColor: '#dc2626',
          outlineClass: 'emergency-form-strobe',
          icon: <Siren className="w-5 h-5 text-rose-400 stroke-[2.2] animate-pulse" />,
        };
      case 'vehicle_condition':
      default:
        return {
          title: 'Vehicle Condition',
          subtitle: 'Broken lights, loose cargo, worn tyres, smoke, or physical defects',
          badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-200',
          iconBg: 'bg-[#941329] text-white shadow-xs',
          textAccent: 'text-rose-400',
          pillBg: 'bg-rose-500/20 border-rose-400/40 text-rose-200',
          outlineColor: '#b81d39',
          outlineClass: 'ring-2 ring-[#b81d39] shadow-[0_0_28px_rgba(184,29,57,0.3)]',
          icon: <Car className="w-5 h-5 text-rose-400 stroke-[2.2]" />,
        };
    }
  };

  const pillData = getPillData();
  const currentCatStyle = getCategoryStyle(selectedCategory);

  // Rule 1 Enforcement: If user is not signed in
  if (!user) {
    return (
      <div className="pb-28 pt-3 px-3 max-w-[420px] mx-auto text-center">
        <div className="pro-form-card rounded-[32px] p-7 shadow-[0_24px_64px_rgba(0,0,0,0.7)] text-center text-white">
          <div className="pro-squircle mx-auto mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight">
            Account required to report
          </h2>
          <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto leading-relaxed">
            To protect drivers against automated spam and harassment, there is no guest reporting. Sign up with a phone number in 10 seconds.
          </p>

          <div className="mt-5 p-3.5 bg-[#131417] rounded-2xl border border-white/10 text-left text-xs text-white/70 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Shield className="w-4 h-4 text-rose-400" />
              <span>Privacy Guarantee:</span>
            </div>
            <p className="leading-relaxed">
              The driver you report will <strong>never</strong> see your name, phone number, or account. Your identity is strictly hidden from the recipient.
            </p>
          </div>

          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="mt-6 w-full py-3.5 px-4 bg-white hover:bg-gray-100 text-gray-950 font-bold text-xs rounded-2xl shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Sign In / Register with Phone</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`pb-36 pt-2 px-3 max-w-[420px] mx-auto ${isDark ? 'text-white' : 'text-gray-900'}`}>
      {/* Professional Card matching Reference Image with Dynamic Category Outline */}
      <div
        className={`pro-form-card rounded-[32px] p-6 sm:p-7 relative overflow-hidden transition-all duration-300 shadow-[0_24px_64px_rgba(0,0,0,0.4)] ${currentCatStyle.outlineClass}`}
        style={
          currentCatStyle.outlineClass === 'emergency-form-strobe'
            ? undefined
            : {
                outline: `2.5px solid ${currentCatStyle.outlineColor}`,
                outlineOffset: '0px',
              }
        }
      >
        {/* Top Capsule Pill */}
        <div className="flex justify-center mb-4">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-inner ${
            isDark
              ? 'bg-[#131417] border border-white/10 text-white'
              : 'bg-gray-100 border border-gray-200/80 text-gray-900'
          }`}>
            {pillData.icon}
            <span>{pillData.label}</span>
          </div>
        </div>

        {/* Header / Progress */}
        {step < 4 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => {
                  if (step === 1) setActiveTab('home');
                  else setStep((s) => (s - 1) as any);
                }}
                className={`text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  isDark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <span className={`text-[11px] font-black uppercase tracking-wider ${
                isDark ? 'text-white/50' : 'text-gray-500'
              }`}>
                Step {step} of 3
              </span>
            </div>

            <div className={`w-full h-1.5 rounded-full overflow-hidden mb-3 ${
              isDark ? 'bg-white/10' : 'bg-gray-200'
            }`}>
              <div
                className={`h-full transition-all duration-300 ${
                  isDark ? 'bg-white' : 'bg-[#941329]'
                }`}
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 bg-rose-500/15 text-rose-700 dark:text-rose-200 rounded-2xl text-xs flex items-center gap-2 border border-rose-500/30">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

      {/* STEP 1: PROVINCE PICKER & NUMBER PLATE INPUT */}
      {step === 1 && (
        <div>
          <h1 className={`text-xl font-bold font-display tracking-tight ${
            isDark ? 'text-white' : 'text-gray-950'
          }`}>
            Which vehicle did you observe?
          </h1>
          <p className={`text-xs mt-0.5 ${
            isDark ? 'text-white/60' : 'text-gray-600'
          }`}>
            Attach an optional vehicle photo, or enter registration details below.
          </p>

          {/* ATTACH PHOTO CARD */}
          <div className={`mt-4 p-3.5 rounded-2xl border shadow-inner relative overflow-hidden ${
            isDark ? 'bg-[#131417] border-white/10' : 'bg-gray-50 border-gray-200/90'
          }`}>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-xs ${
                  isDark ? 'bg-[#26282E] border-white/10 text-white' : 'bg-gray-200/80 border-gray-300 text-gray-800'
                }`}>
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <span className={`text-xs font-bold font-display block leading-tight ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    Attach Vehicle Photo (Optional)
                  </span>
                  <span className={`text-[10px] block leading-tight mt-0.5 ${
                    isDark ? 'text-white/50' : 'text-gray-500'
                  }`}>
                    Add visual evidence of the vehicle condition or issue
                  </span>
                </div>
              </div>
              {photoPreview && (
                <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                  ✓ Photo Attached
                </span>
              )}
            </div>

            {photoPreview ? (
              <div className="space-y-2 relative z-10">
                <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/60 shadow-xs">
                  <img
                    src={photoPreview}
                    alt="Vehicle preview"
                    className="w-full h-44 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      setScanResult(null);
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-black/80 hover:bg-black text-white font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center gap-1 border border-white/10"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove Photo</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAiScanPlate}
                  disabled={isScanningPlate}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-rose-600 text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isScanningPlate ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isScanningPlate ? 'AI Scanning Plate (Province & Number)...' : 'Re-Scan Plate with AI'}</span>
                </button>

                {aiNotice && (
                  <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-800 dark:text-purple-200 text-xs flex items-center gap-2 animate-in fade-in">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-[11px] leading-tight">{aiNotice}</span>
                  </div>
                )}

                {scanResult && (
                  <div className={`rounded-xl border overflow-hidden text-[11px] ${
                    isDark ? 'bg-[#1A1C21] border-white/10' : 'bg-white border-gray-200 shadow-2xs'
                  }`}>
                    <div className={`flex items-center justify-between px-3 py-1.5 border-b ${
                      isDark ? 'border-white/10' : 'border-gray-200'
                    }`}>
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider ${isDark ? 'text-white/70' : 'text-gray-700'}`}>
                        Gemini plate read
                      </span>
                      {scanResult.confidence !== null && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                          {Math.round(scanResult.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 shrink-0 rounded-full bg-[#941329] text-white text-[9px] font-black flex items-center justify-center mt-0.5">1</span>
                        <div className="min-w-0">
                          <span className={`block text-[9px] uppercase tracking-wider font-bold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                            Province & plate type
                          </span>
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {scanResult.provinceName} ({scanResult.provinceCode === 'WC' ? 'CA' : scanResult.provinceCode})
                            <span className={isDark ? 'text-white/60' : 'text-gray-600'}> · {scanResult.plateTypeLabel}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 shrink-0 rounded-full bg-[#941329] text-white text-[9px] font-black flex items-center justify-center mt-0.5">2</span>
                        <div className="min-w-0">
                          <span className={`block text-[9px] uppercase tracking-wider font-bold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                            Unique registration number
                          </span>
                          <span className={`font-display font-black tracking-[0.08em] text-sm ${isDark ? 'text-white' : 'text-gray-950'}`}>
                            {scanResult.registration || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 relative z-10">
                {/* Take photo with camera */}
                <label className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${
                  isDark
                    ? 'bg-[#1C1E23] hover:bg-[#24262D] border-white/10'
                    : 'bg-white hover:bg-gray-100 border-gray-200/80 shadow-2xs'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 group-hover:scale-105 transition-transform border ${
                    isDark ? 'bg-[#2A2C34] text-white border-white/10' : 'bg-red-50 text-[#941329] border-red-100'
                  }`}>
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Take Photo</span>
                  <span className={`text-[10px] ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>

                {/* Upload from file/gallery */}
                <label className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${
                  isDark
                    ? 'bg-[#1C1E23] hover:bg-[#24262D] border-white/10'
                    : 'bg-white hover:bg-gray-100 border-gray-200/80 shadow-2xs'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 group-hover:scale-105 transition-transform border ${
                    isDark ? 'bg-[#2A2C34] text-white border-white/10' : 'bg-red-50 text-[#941329] border-red-100'
                  }`}>
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Import Photo</span>
                  <span className={`text-[10px] ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* CAPTURE VEHICLE PLATE CARD MATCHING SCREENSHOT */}
          <div className={`mt-5 p-4 rounded-2xl border transition-colors ${
            isDark ? 'bg-[#14161B] border-white/10' : 'bg-gray-50 border-gray-200 shadow-2xs'
          }`}>
            {/* Header: CAPTURE VEHICLE PLATE + Province: CA indicator */}
            <div className="flex items-center justify-between mb-3">
              <div className={`text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-2 ${
                isDark ? 'text-white/90' : 'text-gray-900'
              }`}>
                <Car className="w-4 h-4 text-[#B81D39]" />
                <span>CAPTURE VEHICLE PLATE</span>
              </div>
              <div className={`text-[11px] font-bold ${
                isDark ? 'text-white/70' : 'text-gray-600'
              }`}>
                Province: <span className="font-extrabold text-[#B81D39] dark:text-rose-400">{selectedProvince.code === 'WC' ? 'CA' : selectedProvince.code}</span>
              </div>
            </div>

            {/* Horizontal Scrollable/Flex Province Pill Buttons [ GP ] [ CA ] [ ZN ] [ FS ] [ NW ] [ EC ] [ MP ] [ LP ] */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none mb-3">
              {['GP', 'CA', 'ZN', 'FS', 'NW', 'EC', 'MP', 'LP', 'NC'].map((code) => {
                const actualCode = code === 'LP' ? 'L' : code === 'CA' ? 'WC' : code;
                const isSelected = selectedProvince.code === actualCode || (code === 'CA' && selectedProvince.code === 'WC');
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleProvinceSelect(actualCode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 uppercase border ${
                      isSelected
                        ? (isDark ? 'bg-[#2A2E39] text-white border-white/40 ring-1 ring-white/20' : 'bg-[#941329] text-white border-[#941329] shadow-2xs')
                        : (isDark ? 'bg-[#1E2027] hover:bg-[#282B34] text-white/70 border-white/10' : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-200')
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>

            {/* Provincial Plate Preview & Registration Number Input */}
            <div>
              <InteractiveProvincialPlateInput
                provinceCode={selectedProvince.code}
                value={plateNumber}
                onChange={(val) => {
                  setPlateNumber(val);
                  setPlate(getCombinedPlate(val, selectedProvince.code));
                }}
                placeholder={selectedProvince.plateExample}
                autoFocus
                dark={isDark}
              />

              {user?.defaultPlate && plateNumber === user.defaultPlate && (
                <div className="mt-1.5 flex items-center justify-between px-1 text-[10px]">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span>✓ Pre-filled from Settings default plate</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className={`font-semibold underline cursor-pointer ${
                      isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Settings
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Privacy reassurance callout */}
          <div className={`mt-5 p-3.5 rounded-2xl border flex items-start gap-3 ${
            isDark ? 'bg-[#131417] border-white/10' : 'bg-gray-50 border-gray-200'
          }`}>
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className={`text-xs leading-relaxed ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
              <strong className={`block font-semibold mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Anonymous to the recipient
              </strong>
              Your account identity is strictly protected. The vehicle owner will only receive the neutral observation.
            </div>
          </div>

          {/* High-contrast Continue Button */}
          <div className="mt-6">
            <button
              onClick={() => {
                const combined = getCombinedPlate(plateNumber, selectedProvince.code);
                if (plateNumber.trim().length >= 2) {
                  setPlate(combined);
                  setError(null);
                  setStep(2);
                } else {
                  setError('Please enter a valid registration number');
                }
              }}
              disabled={plateNumber.trim().length < 2}
              className={`w-full py-3.5 px-4 font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                plateNumber.trim().length >= 2
                  ? (isDark ? 'bg-white hover:bg-gray-100 text-gray-950 active:scale-[0.99]' : 'bg-[#941329] hover:bg-[#7a0f21] text-white active:scale-[0.99]')
                  : (isDark ? 'bg-[#222428] text-white/30 cursor-not-allowed shadow-none' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none')
              }`}
            >
              <span>Continue to select issue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CATEGORY & ISSUE SELECTION */}
      {step === 2 && (
        <div>
          <div className={`flex items-center gap-3 mb-3 p-2 border rounded-2xl ${
            isDark ? 'bg-[#131417] border-white/10' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="w-24 shrink-0">
              <ProvincialPlate provinceCode={selectedProvinceCode || 'WC'} plateText={plate} />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Selected vehicle</span>
          </div>

          {/* Top Squircle Badge */}
          <div className="pro-squircle mb-3.5">
            {currentCatStyle.icon}
          </div>

          <h2 className={`text-xl font-bold font-display tracking-tight ${
            isDark ? 'text-white' : 'text-gray-950'
          }`}>
            What did you observe?
          </h2>
          <p className={`text-xs mt-0.5 ${
            isDark ? 'text-white/60' : 'text-gray-600'
          }`}>
            Choose the category and specific issue.
          </p>

          {/* 3 Category Segmented Tabs */}
          {reportCategoryPreset ? (
            <div className={`mt-4 p-3.5 border rounded-2xl flex items-center justify-between shadow-inner ${
              isDark
                ? getCategoryStyle(selectedCategory).badgeBg
                : 'bg-rose-50/90 border-rose-200 text-gray-950'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${getCategoryStyle(selectedCategory).iconBg}`}>
                  {getCategoryStyle(selectedCategory).icon}
                </div>
                <div>
                  <span className={`text-xs font-bold block leading-tight ${
                    isDark ? 'text-white' : 'text-gray-950 font-black'
                  }`}>
                    {getCategoryStyle(selectedCategory).title}
                  </span>
                  <span className={`text-[11px] mt-0.5 block leading-snug ${
                    isDark ? 'text-white/60' : 'text-gray-800 font-semibold'
                  }`}>
                    {getCategoryStyle(selectedCategory).subtitle}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportCategoryPreset(null)}
                className={`text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isDark
                    ? 'text-white bg-[#222428] hover:bg-[#2A2C32] border-white/10'
                    : 'text-gray-900 bg-white hover:bg-gray-100 border-gray-300 shadow-xs'
                }`}
              >
                All categories
              </button>
            </div>
          ) : (
            <div className={`mt-4 p-1 rounded-2xl border grid grid-cols-3 gap-1 ${
              isDark ? 'bg-[#131417] border-white/[0.06]' : 'bg-gray-100 border-gray-200'
            }`}>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const catStyle = getCategoryStyle(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedIssueCode('');
                    }}
                    className={`py-2.5 px-1.5 text-xs font-bold rounded-xl transition-all text-center leading-tight flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? (isDark ? 'bg-[#2D3036] text-white shadow-xs border border-white/10' : 'bg-white text-gray-950 shadow-xs border border-gray-200')
                        : (isDark ? 'text-white/50 hover:text-white/80 bg-transparent' : 'text-gray-500 hover:text-gray-900 bg-transparent')
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? catStyle.iconBg : (isDark ? 'bg-white/30' : 'bg-gray-400')}`} />
                    <span className="truncate">{cat.title}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Issues List */}
          <div className="mt-4 space-y-2 max-h-[46vh] overflow-y-auto pr-1">
            {currentCategoryData.issues.map((issue) => {
              const isChecked = selectedIssueCode === issue.code;
              return (
                <label
                  key={issue.code}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                    isChecked
                      ? (isDark ? 'border-white/30 bg-[#242730] ring-1 ring-white/20' : 'border-[#941329] bg-red-50/60 ring-1 ring-[#941329]/20')
                      : (isDark ? 'border-white/[0.08] bg-[#141518] hover:bg-[#1D1F24]' : 'border-gray-200 bg-white hover:bg-gray-50')
                  }`}
                >
                  <input
                    type="radio"
                    name="issue"
                    checked={isChecked}
                    onChange={() => setSelectedIssueCode(issue.code)}
                    className="mt-1 accent-[#941329]"
                  />
                  <div>
                    <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {issue.title}
                    </span>
                    <span className={`text-[11px] leading-snug block mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                      {issue.description}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* If "Other" chosen */}
          {isOther && (
            <div className="mt-3">
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-white/70' : 'text-gray-700'}`}>
                Describe the specific issue:
              </label>
              <input
                type="text"
                value={customOtherText}
                onChange={(e) => setCustomOtherText(e.target.value)}
                placeholder="e.g. Passenger wing mirror folded in..."
                maxLength={80}
                className={`w-full px-3 py-2.5 text-xs border rounded-xl focus:outline-none transition-all ${
                  isDark
                    ? 'bg-[#131417] border-white/10 focus:bg-[#17181D] focus:border-white/30 text-white placeholder:text-white/30'
                    : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-[#941329] text-gray-900 placeholder:text-gray-400'
                }`}
              />
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setStep(1)}
              className={`w-1/3 py-3.5 border font-bold text-xs rounded-2xl transition-all cursor-pointer ${
                isDark ? 'bg-[#222428] hover:bg-[#2A2C32] border-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
              }`}
            >
              Back
            </button>
            <button
              onClick={() => {
                if (selectedIssueCode) {
                  setError(null);
                  setStep(3);
                } else {
                  setError('Please select an issue to continue');
                }
              }}
              disabled={!selectedIssueCode}
              className={`w-2/3 py-3.5 font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedIssueCode
                  ? (isDark ? 'bg-white hover:bg-gray-100 text-gray-950 active:scale-[0.99]' : 'bg-[#941329] hover:bg-[#7a0f21] text-white active:scale-[0.99]')
                  : (isDark ? 'bg-[#222428] text-white/30 cursor-not-allowed shadow-none' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none')
              }`}
            >
              <span>Next: Optional Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: OPTIONAL NOTE & PHOTO */}
      {step === 3 && (
        <div>
          <div className={`rounded-2xl p-3 border mb-4 ${
            isDark ? 'bg-[#131417] border-white/10' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="w-24 shrink-0">
                <ProvincialPlate provinceCode={selectedProvinceCode || 'WC'} plateText={plate} />
              </div>
              <span className={`font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {isOther ? customOtherText || 'Other issue' : currentIssue?.title}
              </span>
            </div>
          </div>

          <div className="pro-squircle mb-3.5">
            <Send className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
          </div>

          <h2 className={`text-xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-gray-950'}`}>
            Add context (Optional)
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
            Keep your note neutral and helpful. It will be delivered verbatim.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-[11px] font-semibold uppercase tracking-wider ${
                  isDark ? 'text-white/60' : 'text-gray-600'
                }`}>
                  Note for the driver (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleAiSuggestNote}
                  disabled={isGeneratingNote}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[11px] font-bold cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  title="Generate a polite, clear observation note with Gemini"
                >
                  {isGeneratingNote ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  )}
                  <span>{isGeneratingNote ? 'Drafting...' : 'AI Polish Note'}</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g. Noticed while waiting at the traffic light on Main Road..."
                maxLength={400}
                className={`w-full p-3.5 border rounded-2xl text-xs font-medium focus:outline-none transition-all shadow-inner ${
                  isDark
                    ? 'bg-[#131417] border-white/10 focus:bg-[#17181D] focus:border-white/30 text-white placeholder:text-white/35'
                    : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-[#941329] text-gray-900 placeholder:text-gray-400'
                }`}
              />
              <div className={`text-right text-[10px] mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                {customNote.length}/400
              </div>
            </div>

            {aiNotice && (
              <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-800 dark:text-purple-200 text-xs flex items-center gap-2 animate-in fade-in">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                <span>{aiNotice}</span>
              </div>
            )}

            {/* Mandatory Neutral Language Reminder */}
            <div className={`p-3.5 border rounded-2xl text-xs leading-relaxed ${
              isDark
                ? 'bg-[#131417] border-blue-500/20 text-blue-200'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <span className={`font-semibold block mb-0.5 ${isDark ? 'text-blue-100' : 'text-blue-950'}`}>How this appears to the driver:</span>
              "A road user reported a possible observation: <strong>{currentIssue?.title}</strong>. Please check when safe."
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setStep(2)}
              className={`w-1/3 py-3.5 border font-bold text-xs rounded-2xl transition-all cursor-pointer ${
                isDark ? 'bg-[#222428] hover:bg-[#2A2C32] border-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
              }`}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-2/3 py-3.5 font-bold text-xs rounded-2xl shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
                isDark ? 'bg-white hover:bg-gray-100 text-gray-950' : 'bg-[#941329] hover:bg-[#7a0f21] text-white'
              }`}
            >
              {isSubmitting ? (
                'Sending safely...'
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Anonymous Alert</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: RECORDED CONFIRMATION */}
      {step === 4 && submissionResult && (
        <div className="text-center pt-2 animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
          </div>

          <h2 className={`text-xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-gray-950'}`}>
            Observation Recorded
          </h2>

          <div className="my-4 max-w-[260px] mx-auto">
            <ProvincialPlate provinceCode={selectedProvinceCode || 'WC'} plateText={plate} />
          </div>

          {/* Delivery status verification */}
          <div className={`mt-2 p-4 border rounded-2xl text-left text-xs leading-relaxed space-y-2 ${
            isDark ? 'bg-[#131417] border-white/10' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className={`flex items-center gap-2 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Delivery Status Verification:</span>
            </div>
            <p className={`${isDark ? 'text-white/70' : 'text-gray-600'}`}>
              {submissionResult.statusMessage}
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full py-3.5 font-bold text-xs rounded-2xl transition-all shadow-lg cursor-pointer ${
                isDark ? 'bg-white hover:bg-gray-100 text-gray-950' : 'bg-[#941329] hover:bg-[#7a0f21] text-white'
              }`}
            >
              Return to Home
            </button>
            <button
              onClick={handleStartFresh}
              className={`w-full py-3 border font-bold text-xs rounded-2xl transition-all cursor-pointer ${
                isDark ? 'bg-[#222428] hover:bg-[#2A2C32] border-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
              }`}
            >
              Report Another Vehicle
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
