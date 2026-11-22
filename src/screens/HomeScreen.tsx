import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext.js';
import { ReportCategory } from '../types/index.js';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  X,
  Siren,
  Phone,
  AlertCircle,
  HelpCircle,
  MapPin,
  SlidersHorizontal,
  LocateFixed,
  Loader2,
  Volume2,
  VolumeX,
  PhoneOff,
  Send,
  Check,
  LifeBuoy,
  Mail,
  ThumbsUp,
  ArrowLeft,
  ArrowRight,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  InteractiveProvincialPlateInput,
  formatFullProvincialPlate,
  stripProvinceCodeFromInput,
} from '../components/ProvincialPlate.js';
import { LiveRouteMap, MapHazardPin } from '../components/LiveRouteMap.js';
import { SA_PROVINCES } from '../constants/provinces.js';
import {
  getClientVoterId,
  getStoredHazardVotes,
  saveStoredHazardVote,
  replaceAllStoredHazardVotes,
  EMPTY_HAZARD_VOTE,
  HazardAnalysisStatus,
  HazardVoteSelection,
} from '../utils/hazardVotes.js';

const METRO_SUBURBS: Record<string, string[]> = {
  johannesburg: ['sandton', 'midrand', 'bedfordview', 'randburg', 'roodepoort', 'soweto', 'allandale', 'grayston', 'gilloolys'],
  'cape town': ['century city', 'observatory', 'hospital bend', 'sable square', 'sea point', 'claremont', 'bellville'],
  durban: ['westville', 'umhlanga', 'pinetown', 'la lucia', 'spaghetti'],
};

function matchesCommunityProvince(hazardProvince: string, selectedProvince: string): boolean {
  if (!selectedProvince || selectedProvince === 'ALL') return true;
  const h = hazardProvince.trim().toUpperCase();
  const s = selectedProvince.trim().toUpperCase();
  if (h === s) return true;
  if ((s === 'ZN' || s === 'KZN') && (h === 'ZN' || h === 'KZN')) return true;
  if ((s === 'L' || s === 'LP') && (h === 'L' || h === 'LP')) return true;
  return false;
}

function matchesCommunityCity(hazard: MapHazardPin, selectedCity: string): boolean {
  if (!selectedCity || selectedCity === 'ALL') return true;
  const needle = selectedCity.trim().toLowerCase();
  const haystack = `${hazard.area} ${hazard.title} ${hazard.description}`.toLowerCase();
  if (haystack.includes(needle)) return true;
  const suburbs = METRO_SUBURBS[needle];
  if (suburbs && suburbs.some((sub) => haystack.includes(sub))) return true;
  return false;
}

const SA_METRO_ALIASES: Record<string, string> = {
  'city of johannesburg': 'Johannesburg',
  'johannesburg metropolitan': 'Johannesburg',
  'city of tshwane': 'Pretoria',
  'tshwane': 'Pretoria',
  'ekurhuleni': 'Benoni',
  'city of cape town': 'Cape Town',
  'ethekwini': 'Durban',
  'nelson mandela bay': 'Gqeberha',
  'buffalo city': 'East London',
  'mangaung': 'Bloemfontein',
  'msunduzi': 'Pietermaritzburg',
  'polokwane local': 'Polokwane',
  'mbombela local': 'Mbombela',
  'emalahleni local': 'Emalahleni',
  'rustenburg local': 'Rustenburg',
  'sol plaatje': 'Kimberley',
};

function resolveSAProvinceCode(provinceText?: string, fullText?: string): string | null {
  const combined = `${provinceText || ''} ${fullText || ''}`.toLowerCase();
  for (const prov of SA_PROVINCES) {
    if (provinceText) {
      const pt = provinceText.toLowerCase();
      if (pt.includes(prov.name.toLowerCase())) return prov.code;
      if (prov.code === 'ZN' && (pt.includes('kwazulu') || pt.includes('natal'))) return 'ZN';
      if (prov.code === 'L' && pt.includes('limpopo')) return 'L';
    }
  }
  for (const prov of SA_PROVINCES) {
    if (combined.includes(prov.name.toLowerCase())) return prov.code;
    if (prov.code === 'ZN' && (combined.includes('kwazulu') || combined.includes('kzn'))) return 'ZN';
  }
  for (const prov of SA_PROVINCES) {
    if (prov.cities.some((c) => combined.includes(c.toLowerCase()))) {
      return prov.code;
    }
  }
  return null;
}

function normalizeDetectedCity(rawCity: string, provinceCode: string, availableOptions: string[]): string {
  const cleaned = rawCity.replace(/\s+(local|metropolitan)\s+municipality$/i, '').trim();
  const lower = cleaned.toLowerCase();
  const aliasMatch = Object.entries(SA_METRO_ALIASES).find(([key]) => lower.includes(key));
  const candidate = aliasMatch ? aliasMatch[1] : cleaned;
  const exact = availableOptions.find((opt) => opt.toLowerCase() === candidate.toLowerCase());
  if (exact) return exact;
  const partial = availableOptions.find(
    (opt) => candidate.toLowerCase().includes(opt.toLowerCase()) || opt.toLowerCase().includes(candidate.toLowerCase())
  );
  if (partial) return partial;
  const provCities = SA_PROVINCES.find((p) => p.code === provinceCode)?.cities || [];
  const provExact = provCities.find((c) => c.toLowerCase() === candidate.toLowerCase());
  return provExact || candidate;
}

function getHazardTilePreview(lat: number, lon: number, zoom = 14) {
  const n = Math.pow(2, zoom);
  const xExact = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yExact =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(xExact);
  const y = Math.floor(yExact);
  const leftPct = Math.min(78, Math.max(22, Math.round((xExact - x) * 100)));
  const topPct = Math.min(76, Math.max(24, Math.round((yExact - y) * 100)));
  return {
    tileUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${y}/${x}`,
    leftPct,
    topPct,
  };
}

export function HomeScreen() {
  const {
    user,
    authToken,
    setActiveTab,
    homeNavigationTick,
    setReportCategoryPreset,
    submitReport,
    setIsAuthModalOpen,
    theme,
  } = useApp();

  const isDark = theme === 'dark';

  // Emergency In-Call State
  const [isInEmergencyCall, setIsInEmergencyCall] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isLoudspeakerOn, setIsLoudspeakerOn] = useState(true);
  const [callPlateNumber, setCallPlateNumber] = useState('');
  const [callProvinceCode, setCallProvinceCode] = useState('GP');
  const [callIncidentType, setCallIncidentType] = useState<'crash' | 'hit_and_run' | 'injury' | 'overturned'>('crash');
  const [callNote, setCallNote] = useState('');
  const [isDispatchingCallReport, setIsDispatchingCallReport] = useState(false);
  const [callReportSuccess, setCallReportSuccess] = useState(false);
  const [callReportFeedback, setCallReportFeedback] = useState<string | null>(null);

  // Community Hub State (live public map alerts: traffic, accidents, potholes)
  const [communityHazards, setCommunityHazards] = useState<MapHazardPin[]>([]);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(true);
  const [communityFilter, setCommunityFilter] = useState<'all' | 'traffic' | 'accident' | 'pothole' | 'alert'>('all');
  const [communityProvince, setCommunityProvince] = useState<string>('ALL');
  const [communityCity, setCommunityCity] = useState<string>('ALL');
  const [showCommunityFilterModal, setShowCommunityFilterModal] = useState(false);
  const [draftProvince, setDraftProvince] = useState<string>('ALL');
  const [draftCity, setDraftCity] = useState<string>('ALL');
  const [draftCustomCity, setDraftCustomCity] = useState<string>('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationDetectStatus, setLocationDetectStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmingHazardId, setConfirmingHazardId] = useState<string | null>(null);
  const [hazardVotes, setHazardVotes] = useState<Record<string, HazardVoteSelection>>(() =>
    getStoredHazardVotes()
  );
  const [focusedMapHazard, setFocusedMapHazard] = useState<MapHazardPin | null>(null);
  const [confirmDeleteHazardId, setConfirmDeleteHazardId] = useState<string | null>(null);
  const [deletingHazardId, setDeletingHazardId] = useState<string | null>(null);
  const [communityDeleteError, setCommunityDeleteError] = useState<string | null>(null);

  // Community Hub Photo Lightbox State
  const [expandedCommunityPhoto, setExpandedCommunityPhoto] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapProvinceFilter, setMapProvinceFilter] = useState<string>('ALL');
  const [pressedQuadrant, setPressedQuadrant] = useState<'vehicle' | 'driver' | 'road' | 'sos' | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<'vehicle' | 'driver' | 'road' | 'sos' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'vehicle' | 'driver' | 'road' | 'sos' | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isHoldingReport, setIsHoldingReport] = useState(false);
  const [isPoliceStrobe, setIsPoliceStrobe] = useState(false);
  const [strobeCountdown, setStrobeCountdown] = useState(4);
  const [strobeRect, setStrobeRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const quadrantTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const policeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const policeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdTriggeredRef = useRef(false);
  const wasHoldAttemptRef = useRef(false);
  const pressStartRef = useRef<number | null>(null);
  const reportBtnRef = useRef<HTMLButtonElement | null>(null);

  const activeCategory = pressedQuadrant || hoveredCategory || selectedCategory;

  const getPillLabel = () => {
    switch (activeCategory) {
      case 'vehicle':
        return 'Vehicle Conditions';
      case 'driver':
        return 'Driver Behavior';
      case 'road':
        return 'Road Violation';
      case 'sos':
        return 'Emergency SOS';
      default:
        return '';
    }
  };

  useEffect(() => {
    return () => {
      if (quadrantTimerRef.current) {
        clearTimeout(quadrantTimerRef.current);
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
      if (policeTimerRef.current) {
        clearTimeout(policeTimerRef.current);
      }
      if (policeIntervalRef.current) {
        clearInterval(policeIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPoliceStrobe) return;
    const syncRect = () => {
      const rect = reportBtnRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        setStrobeRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    };
    syncRect();
    window.addEventListener('resize', syncRect);
    window.addEventListener('scroll', syncRect, true);
    return () => {
      window.removeEventListener('resize', syncRect);
      window.removeEventListener('scroll', syncRect, true);
    };
  }, [isPoliceStrobe]);

  useEffect(() => {
    if (!isPoliceStrobe) return;
    const handleUnhold = () => {
      cancelPoliceStrobe();
    };
    window.addEventListener('pointerup', handleUnhold);
    window.addEventListener('pointercancel', handleUnhold);
    window.addEventListener('blur', handleUnhold);
    return () => {
      window.removeEventListener('pointerup', handleUnhold);
      window.removeEventListener('pointercancel', handleUnhold);
      window.removeEventListener('blur', handleUnhold);
    };
  }, [isPoliceStrobe]);

  // Emergency in-call timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isInEmergencyCall) {
      timer = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    } else {
      setCallSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isInEmergencyCall]);

  const playSpeakerChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // AudioContext unavailable
    }
  };

  const handleStartEmergencyCall = () => {
    // 1. Immediately trigger the phone call to 112 (South Africa national emergency)
    try {
      window.location.href = 'tel:112';
    } catch (e) {
      console.warn('Call intent notice:', e);
    }

    // 2. Audible speakerphone confirmation chime
    playSpeakerChime();

    // 3. Immediately activate in-call console with loudspeaker enabled
    setIsInEmergencyCall(true);
    setIsLoudspeakerOn(true);
    setCallReportSuccess(false);
    setCallReportFeedback(null);
  };

  const handleEndEmergencyCall = () => {
    setIsInEmergencyCall(false);
    setCallReportSuccess(false);
    setCallReportFeedback(null);
    setShowEmergencyModal(false);
  };

  const handleDispatchInCallReport = async () => {
    if (!callPlateNumber.trim()) {
      setCallReportFeedback('Please enter the registration plate number of the vehicle');
      return;
    }
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsDispatchingCallReport(true);
    setCallReportFeedback(null);

    const fullPlate = formatFullProvincialPlate(callPlateNumber.trim(), callProvinceCode);
    const incidentDescriptions: Record<string, string> = {
      crash: 'Accident Crash / Collision',
      hit_and_run: 'Hit and Run Crash',
      injury: 'Severe Accident with Medical Injury',
      overturned: 'Vehicle Overturned / Road Obstructed',
    };
    const title = incidentDescriptions[callIncidentType] || 'Road Accident / Collision';

    const res = await submitReport({
      plate: fullPlate,
      category: 'driver_behaviour',
      issueCode: 'other_driver_behaviour',
      issueTitle: `[112 EMERGENCY CALL] ${title}`,
      customNote: callNote.trim()
        ? `Live 112 In-Call Note (Hands-Free Loudspeaker): ${callNote.trim()}`
        : 'Reported live during 112 emergency call on loudspeaker hands-free mode',
      idempotencyKey: `emergency_call_${Date.now()}_${Math.random()}`,
    });

    setIsDispatchingCallReport(false);
    if (res.success) {
      setCallReportSuccess(true);
      setCallReportFeedback(`✓ Plate ${fullPlate} recorded & dispatched to emergency feed!`);
    } else {
      setCallReportFeedback(res.error || 'Failed to dispatch alert. Call remains active.');
    }
  };

  const handleStartReport = (category?: ReportCategory) => {
    if (category) {
      setReportCategoryPreset(category);
    } else {
      setReportCategoryPreset(null);
    }
    setActiveTab('report');
  };

  const cancelPoliceStrobe = () => {
    if (policeIntervalRef.current) {
      clearInterval(policeIntervalRef.current);
      policeIntervalRef.current = null;
    }
    if (policeTimerRef.current) {
      clearTimeout(policeTimerRef.current);
      policeTimerRef.current = null;
    }
    pressStartRef.current = null;
    wasHoldAttemptRef.current = true;
    holdTriggeredRef.current = true;
    setIsPoliceStrobe(false);
    setIsReportOpen(false);
    setStrobeCountdown(4);
    setStrobeRect(null);
    reportBtnRef.current?.blur();
    setTimeout(() => {
      holdTriggeredRef.current = false;
      wasHoldAttemptRef.current = false;
    }, 150);
  };

  const handleReportPointerDown = () => {
    if (isPoliceStrobe) return;
    pressStartRef.current = Date.now();
    holdTriggeredRef.current = false;
    wasHoldAttemptRef.current = false;
    setIsHoldingReport(true);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      holdTriggeredRef.current = true;
      wasHoldAttemptRef.current = true;
      const rect = reportBtnRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        setStrobeRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
      setIsHoldingReport(false);
      setIsReportOpen(false);
      setStrobeCountdown(4);
      setIsPoliceStrobe(true);

      if (policeIntervalRef.current) {
        clearInterval(policeIntervalRef.current);
      }
      if (policeTimerRef.current) {
        clearTimeout(policeTimerRef.current);
        policeTimerRef.current = null;
      }

      let remaining = 4;
      policeIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (policeIntervalRef.current) {
            clearInterval(policeIntervalRef.current);
            policeIntervalRef.current = null;
          }
          pressStartRef.current = null;
          setStrobeCountdown(0);
          setIsPoliceStrobe(false);
          setIsReportOpen(false);
          setStrobeRect(null);
          reportBtnRef.current?.blur();
          setTimeout(() => {
            holdTriggeredRef.current = false;
            wasHoldAttemptRef.current = false;
          }, 150);
          setShowEmergencyModal(true);
          handleStartEmergencyCall();
        } else {
          setStrobeCountdown(remaining);
        }
      }, 1000);
    }, 2000);
  };

  const cancelReportHold = (shouldBlur = false) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const elapsed = pressStartRef.current !== null ? Date.now() - pressStartRef.current : 0;
    pressStartRef.current = null;
    if (elapsed >= 250) {
      wasHoldAttemptRef.current = true;
    }
    setIsHoldingReport(false);
    if (shouldBlur || elapsed >= 250) {
      setIsReportOpen(false);
      reportBtnRef.current?.blur();
    }
  };

  const handleReportButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const elapsed = pressStartRef.current !== null ? Date.now() - pressStartRef.current : 0;
    pressStartRef.current = null;

    if (holdTriggeredRef.current || wasHoldAttemptRef.current || elapsed >= 250) {
      holdTriggeredRef.current = false;
      wasHoldAttemptRef.current = false;
      setIsReportOpen(false);
      e.currentTarget.blur();
      return;
    }
    if (isPoliceStrobe) {
      e.currentTarget.blur();
      return;
    }
    if (isReportOpen) {
      setIsReportOpen(false);
      return;
    }
    setIsReportOpen(true);
  };

  const handleQuadrantClick = (target: 'vehicle' | 'driver' | 'road' | 'sos') => {
    setSelectedCategory(target);
    if (pressedQuadrant) return;
    setPressedQuadrant(target);
    if (quadrantTimerRef.current) {
      clearTimeout(quadrantTimerRef.current);
    }
    quadrantTimerRef.current = setTimeout(() => {
      setPressedQuadrant(null);
      setIsReportOpen(false);
      if (target === 'vehicle') {
        handleStartReport('vehicle_condition');
      } else if (target === 'driver') {
        handleStartReport('driver_behaviour');
      } else if (target === 'road') {
        handleStartReport('road_violation');
      } else if (target === 'sos') {
        setIsInEmergencyCall(false);
        setCallReportSuccess(false);
        setCallReportFeedback(null);
        setShowEmergencyModal(true);
      }
    }, 500);
  };

  const fetchCommunityHazards = async () => {
    try {
      const voterId = encodeURIComponent(getClientVoterId());
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/map/hazards?province=ALL&kind=all&voterId=${voterId}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        const rows: MapHazardPin[] = Array.isArray(data?.hazards) ? data.hazards : [];
        setCommunityHazards(rows);
        if (data?.userVotes && typeof data.userVotes === 'object') {
          setHazardVotes(replaceAllStoredHazardVotes(data.userVotes));
        } else {
          setHazardVotes(getStoredHazardVotes());
        }
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setIsLoadingCommunity(false);
    }
  };

  useEffect(() => {
    setConfirmDeleteHazardId(null);
    setCommunityDeleteError(null);
    void fetchCommunityHazards();
  }, [user?.id, authToken]);

  // Every time the user presses the Home button (or Driver Ping header logo),
  // exit the Map view and any open Home modals so they always land on Home.
  useEffect(() => {
    if (homeNavigationTick === 0) return;
    if (showMapModal) {
      setShowMapModal(false);
      setFocusedMapHazard(null);
      void fetchCommunityHazards();
    }
    setShowCommunityFilterModal(false);
    setExpandedCommunityPhoto(null);
    if (!isInEmergencyCall) {
      setShowEmergencyModal(false);
    }
    setShowSupportModal(false);
    setShowGuideModal(false);
    setIsReportOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [homeNavigationTick]);

  const handleVoteHazardAnalysis = async (
    e: React.MouseEvent,
    id: string,
    status: HazardAnalysisStatus
  ) => {
    e.stopPropagation();
    setConfirmingHazardId(id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/map/hazards/${id}/analysis`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status, voterId: getClientVoterId() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.hazard) {
        setCommunityHazards((prev) => prev.map((h) => (h.id === id ? data.hazard : h)));
        if (data?.userVote) {
          setHazardVotes(saveStoredHazardVote(id, data.userVote));
        }
      }
    } finally {
      setConfirmingHazardId(null);
    }
  };

  const handleDeleteCommunityHazard = async (e: React.MouseEvent, hazardId: string) => {
    e.stopPropagation();
    if (!authToken) {
      setCommunityDeleteError('Please sign in as the main reporter to delete this report.');
      return;
    }
    setDeletingHazardId(hazardId);
    setCommunityDeleteError(null);
    try {
      const res = await fetch(`/api/map/hazards/${encodeURIComponent(hazardId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCommunityDeleteError(
          data?.error || 'Only the main reporter is allowed to delete this report.'
        );
        return;
      }
      setCommunityHazards((prev) => prev.filter((h) => h.id !== hazardId));
      setConfirmDeleteHazardId((prev) => (prev === hazardId ? null : prev));
      setFocusedMapHazard((prev) => (prev?.id === hazardId ? null : prev));
    } catch {
      setCommunityDeleteError('Could not delete report. Please try again.');
    } finally {
      setDeletingHazardId(null);
    }
  };

  const handleOpenCommunityHazardOnMap = (hazard: MapHazardPin) => {
    setFocusedMapHazard(hazard);
    setShowMapModal(true);
  };

  const openCommunityFilterModal = () => {
    setDraftProvince(communityProvince);
    const provCities = getProvinceCityOptions(communityProvince);
    if (communityCity !== 'ALL' && !provCities.includes(communityCity)) {
      setDraftCity('__other__');
      setDraftCustomCity(communityCity);
    } else {
      setDraftCity(communityCity);
      setDraftCustomCity('');
    }
    setLocationDetectStatus(null);
    setShowCommunityFilterModal(true);
  };

  const getProvinceCityOptions = (provinceCode: string): string[] => {
    if (!provinceCode || provinceCode === 'ALL') return [];
    const base = SA_PROVINCES.find((p) => p.code === provinceCode)?.cities || [];
    const fromHazards = communityHazards
      .filter((h) => matchesCommunityProvince(h.province, provinceCode))
      .map((h) => h.area.split(',')[0].split('/')[0].trim())
      .filter(Boolean);
    return Array.from(new Set([...base, ...fromHazards]));
  };

  const handleDetectLocationForFilter = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationDetectStatus({
        type: 'error',
        text: 'Location services are not supported by this browser. Pick province and city below.',
      });
      return;
    }

    setIsDetectingLocation(true);
    setLocationDetectStatus(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch(`/api/map/reverse?lat=${lat}&lon=${lon}`);
          const data = res.ok ? await res.json() : null;
          const place = data?.place;

          const matchedProvCode = resolveSAProvinceCode(
            place?.provinceName,
            `${place?.label || ''} ${place?.shortLabel || ''}`
          );

          if (!matchedProvCode) {
            setLocationDetectStatus({
              type: 'error',
              text: place?.shortLabel
                ? `Detected "${place.shortLabel}", which is outside South Africa's 9 provinces. Please select manually.`
                : 'Could not match your coordinates to a South African province. Please select manually.',
            });
            setIsDetectingLocation(false);
            return;
          }

          const options = getProvinceCityOptions(matchedProvCode);
          const rawCity =
            place?.cityName ||
            (typeof place?.shortLabel === 'string' ? place.shortLabel.split(',')[0].trim() : '');

          setDraftProvince(matchedProvCode);

          if (rawCity) {
            const normalizedCity = normalizeDetectedCity(rawCity, matchedProvCode, options);
            if (options.includes(normalizedCity)) {
              setDraftCity(normalizedCity);
              setDraftCustomCity('');
            } else {
              setDraftCity('__other__');
              setDraftCustomCity(normalizedCity);
            }
            const provName = SA_PROVINCES.find((p) => p.code === matchedProvCode)?.name || matchedProvCode;
            setLocationDetectStatus({
              type: 'success',
              text: `Detected ${normalizedCity}, ${provName} (${matchedProvCode}).`,
            });
          } else {
            setDraftCity('ALL');
            setDraftCustomCity('');
            const provName = SA_PROVINCES.find((p) => p.code === matchedProvCode)?.name || matchedProvCode;
            setLocationDetectStatus({
              type: 'success',
              text: `Detected ${provName} (${matchedProvCode}).`,
            });
          }
        } catch {
          setLocationDetectStatus({
            type: 'error',
            text: 'Unable to look up your city from GPS right now. Please select manually.',
          });
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        const denied = err.code === 1;
        setLocationDetectStatus({
          type: 'error',
          text: denied
            ? 'Location access denied. Allow location permission or choose province & city below.'
            : 'Could not read your GPS position. Please pick province & city below.',
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleApplyCommunityFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedCity =
      draftProvince === 'ALL'
        ? 'ALL'
        : draftCity === '__other__'
          ? draftCustomCity.trim() || 'ALL'
          : draftCity || 'ALL';
    setCommunityProvince(draftProvince);
    setCommunityCity(resolvedCity);
    setShowCommunityFilterModal(false);
  };

  const handleResetCommunityFilter = () => {
    setCommunityProvince('ALL');
    setCommunityCity('ALL');
    setDraftProvince('ALL');
    setDraftCity('ALL');
    setDraftCustomCity('');
    setLocationDetectStatus(null);
    setShowCommunityFilterModal(false);
  };

  // Format relative time helper
  const getRelativeTime = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.max(1, Math.floor(diff / 60000));
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="pb-28 pt-3 px-3 max-w-[420px] mx-auto text-white">
      {/* 1. PRIMARY FLOATING HERO CARD - Clean Red Aurora Mesh */}
      <div className={`report-aurora-card rounded-[34px] px-4.5 pt-4 pb-3 text-white relative overflow-hidden text-center shadow-2xl ${isPoliceStrobe ? 'is-police-strobe' : ''}`}>
        {/* Top Header Row */}
        <div className="relative z-10 mb-1.5 px-1 text-center flex flex-col items-center justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-200/80 block leading-tight">
            LICENSE PLATE MESSAGING
          </span>
          <h1 className="text-sm font-black font-display text-white tracking-tight leading-tight">
            Smart Vehicle Pings
          </h1>

          {/* Frosted Glass Category Indicator Pill (active category only) */}
          {activeCategory && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 hover:bg-black/35 border border-white/20 text-[11px] font-bold text-white transition-all shadow-xs cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{getPillLabel()}</span>
            </div>
          )}
        </div>

        {/* Center Circular GO / Social Button */}
        <div className="relative flex flex-col items-center justify-center z-10">
          <div
            className={`wrapper ${isReportOpen ? 'is-open' : ''} ${isHoldingReport ? 'is-holding' : ''} ${isPoliceStrobe ? 'is-police-strobe' : ''}`}
            tabIndex={-1}
          >
            <div className="stage">
              <div className="go-wrap">
                <button
                    ref={reportBtnRef}
                    className={`btn group focus:outline-none select-none touch-none ${isHoldingReport ? 'is-holding' : ''} ${isPoliceStrobe ? 'is-police-strobe' : ''}`}
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={handleReportPointerDown}
                    onPointerUp={() => {
                      cancelReportHold(holdTriggeredRef.current);
                      if (isPoliceStrobe) {
                        cancelPoliceStrobe();
                      }
                    }}
                    onPointerLeave={() => cancelReportHold(!isPoliceStrobe)}
                    onPointerCancel={() => {
                      cancelReportHold(true);
                      if (isPoliceStrobe) {
                        cancelPoliceStrobe();
                      }
                    }}
                    onClick={handleReportButtonClick}
                    onDoubleClick={() => {
                      if (!isPoliceStrobe && !holdTriggeredRef.current && !wasHoldAttemptRef.current) {
                        handleStartReport();
                      }
                    }}
                    aria-label="Report vehicle. Tap to open reporting options or press and hold 2 seconds for police light effect"
                    title="Tap to select issue, or press and hold 2s for police car light effect"
                  >
                    REPORT
                  </button>
              </div>

              <div className="main socials">
                <div className="up">
                  {/* Category 1: Vehicle condition */}
                  <button
                    className={`card1 group/c1 relative ${pressedQuadrant === 'vehicle' ? 'active-hover' : ''}`}
                    aria-label="Report Vehicle Condition"
                    title="Vehicle Condition: Lights, tyres, hazards"
                    onClick={() => handleQuadrantClick('vehicle')}
                    onMouseEnter={() => setHoveredCategory('vehicle')}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <Car className="w-8 h-8 icon-quadrant-vehicle stroke-[2.2]" />
                  </button>

                  {/* Category 2: Driver behaviour */}
                  <button
                    className={`card2 group/c2 relative ${pressedQuadrant === 'driver' ? 'active-hover' : ''}`}
                    aria-label="Report Driver Behaviour"
                    title="Driver Behaviour: Tailgating, reckless driving, distraction"
                    onClick={() => handleQuadrantClick('driver')}
                    onMouseEnter={() => setHoveredCategory('driver')}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <svg
                      className="w-8 h-8 icon-quadrant-driver"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="12" y1="2" x2="12" y2="9" />
                      <line x1="2" y1="12" x2="9" y2="12" />
                      <line x1="15" y1="12" x2="22" y2="12" />
                    </svg>
                  </button>
                </div>
                <div className="down">
                  {/* Category 3: Road violation */}
                  <button
                    className={`card3 group/c3 relative ${pressedQuadrant === 'road' ? 'active-hover' : ''}`}
                    aria-label="Report Road Violation"
                    title="Road Violation: Red robot, lane straddling, illegal overtaking"
                    onClick={() => handleQuadrantClick('road')}
                    onMouseEnter={() => setHoveredCategory('road')}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <svg
                      className="w-8 h-8 icon-quadrant-road"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="4" y1="2" x2="4" y2="22" />
                      <line x1="20" y1="2" x2="20" y2="22" />
                      <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
                    </svg>
                  </button>

                  {/* 4th button: Emergency SOS */}
                  <button
                    className={`card4 group/c4 relative ${pressedQuadrant === 'sos' ? 'active-hover' : ''}`}
                    aria-label="Emergency SOS button"
                    title="Emergency SOS: 112 emergency services"
                    onClick={() => handleQuadrantClick('sos')}
                    onMouseEnter={() => setHoveredCategory('sos')}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <div className="flex flex-col items-center justify-center icon-quadrant-sos">
                      <Siren className="w-7 h-7 stroke-[2.2]" />
                      <span className="text-[8px] font-black tracking-tighter uppercase leading-none mt-0.5">SOS</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar - MAP Icon Button */}
        <div className="flex items-center justify-center relative z-10 pt-0.5 px-1">
          <button
            type="button"
            onClick={() => setShowMapModal(true)}
            className={`w-10 h-10 rounded-full active:scale-95 border flex items-center justify-center transition-all shadow-md cursor-pointer group relative ${
              theme === 'dark'
                ? 'bg-[#14161a] hover:bg-[#1f2228] border-white/20 text-rose-400 shadow-black/70 ring-1 ring-white/10'
                : 'bg-white hover:bg-white/95 border-white text-[#941329] shadow-md'
            }`}
            title="Open Full Screen RSA Live Map"
            aria-label="Open Full Screen Live Map"
          >
            <MapPin className={`w-5 h-5 group-hover:scale-110 transition-transform ${theme === 'dark' ? 'text-rose-400' : 'text-[#941329]'}`} />
            <span className={`absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-2 ${theme === 'dark' ? 'ring-[#14161a]' : 'ring-white'}`} />
          </button>
        </div>
      </div>

      {/* Guide button explaining how the 4 reporting buttons work - placed under the hero card */}
      <div className="flex justify-center mt-3">
        <button
          onClick={() => setShowGuideModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 hover:bg-white/15 active:scale-[0.98] border border-white/15 rounded-full text-xs font-semibold text-white/90 hover:text-white transition-all shadow-xs cursor-pointer group"
          title="Guide: Learn how the 4 reporting buttons work"
        >
          <HelpCircle className="w-3.5 h-3.5 text-rose-300 group-hover:scale-110 transition-transform shrink-0" />
          <span>How the 4 reporting buttons work</span>
          <span className="text-rose-300 text-[10px]">▶</span>
        </button>
      </div>

      {/* 2. COMMUNITY HUB (Publicly shared map road alerts: traffic, accidents, potholes) */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-2 px-1 mb-2.5">
          <div className="min-w-0">
            <h2 className="text-lg font-black font-display tracking-tight text-white leading-tight">
              Community Hub
            </h2>
            <p className="text-[11px] text-white/75 font-medium truncate">
              Public road updates, alerts &amp; photos
            </p>
          </div>
          <button
            type="button"
            onClick={openCommunityFilterModal}
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 border ${
              communityProvince !== 'ALL' || communityCity !== 'ALL'
                ? 'bg-white text-gray-950 border-white shadow-sm'
                : 'text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border-white/15'
            }`}
            title="Filter community alerts by province and city"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>
              {communityCity !== 'ALL'
                ? `${communityCity}, ${communityProvince}`
                : communityProvince !== 'ALL'
                  ? `Filter · ${communityProvince}`
                  : 'Filter'}
            </span>
          </button>
        </div>

        {/* Filter Chips for Community Road Alerts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 px-1 no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'traffic', label: 'Traffic' },
            { id: 'accident', label: 'Accidents' },
            { id: 'pothole', label: 'Potholes' },
            { id: 'alert', label: 'Other' },
          ].map((tab) => {
            const active = communityFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setCommunityFilter(tab.id as 'all' | 'traffic' | 'accident' | 'pothole' | 'alert')
                }
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
                  active
                    ? 'bg-white text-gray-950 border-white shadow-sm'
                    : 'bg-white/10 text-white/85 border-white/15 hover:bg-white/20'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          {(communityProvince !== 'ALL' || communityCity !== 'ALL') && (
            <button
              type="button"
              onClick={handleResetCommunityFilter}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 cursor-pointer shrink-0 transition-colors"
              title="Clear province and city filter"
            >
              <span>Clear location</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {(() => {
          const filteredHazards = communityHazards.filter((h) => {
            if (communityFilter !== 'all' && h.kind !== communityFilter) return false;
            if (!matchesCommunityProvince(h.province, communityProvince)) return false;
            if (!matchesCommunityCity(h, communityCity)) return false;
            return true;
          });

          if (isLoadingCommunity) {
            return (
              <div className="bg-white rounded-[24px] p-5 text-center text-gray-900 shadow-lg border border-white/80">
                <p className="text-xs font-bold text-gray-600">Loading community road alerts...</p>
              </div>
            );
          }

          if (filteredHazards.length === 0) {
            const hasLocationFilter = communityProvince !== 'ALL' || communityCity !== 'ALL';
            return (
              <div className="bg-white rounded-[24px] p-5 text-center text-gray-900 shadow-lg border border-white/80">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-gray-950">
                  {hasLocationFilter
                    ? `No road alerts in ${
                        communityCity !== 'ALL'
                          ? `${communityCity}, ${communityProvince}`
                          : SA_PROVINCES.find((p) => p.code === communityProvince)?.name || communityProvince
                      } yet`
                    : 'No public road alerts here yet'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {hasLocationFilter
                    ? 'Try choosing another city, clearing the location filter, or pin an update on the map.'
                    : 'Open the map to share a traffic, accident, or pothole update with drivers.'}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  {hasLocationFilter && (
                    <button
                      type="button"
                      onClick={handleResetCommunityFilter}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear Filter</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFocusedMapHazard(null);
                      setShowMapModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#941329] text-white text-xs font-bold cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Open Map</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {filteredHazards.slice(0, 6).map((hazard) => {
                const preview = getHazardTilePreview(hazard.lat, hazard.lon, 14);
                const kindMeta =
                  hazard.kind === 'accident'
                    ? {
                        label: 'Accident',
                        icon: <Siren className="w-3 h-3 text-[#941329]" />,
                        pinIcon: <Siren className="w-3.5 h-3.5 text-[#F87171] rotate-45" />,
                      }
                    : hazard.kind === 'pothole'
                      ? {
                          label: 'Pothole',
                          icon: <AlertTriangle className="w-3 h-3 text-amber-600" />,
                          pinIcon: <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24] rotate-45" />,
                        }
                      : hazard.kind === 'alert'
                        ? {
                            label: 'Other',
                            icon: <AlertCircle className="w-3 h-3 text-purple-600" />,
                            pinIcon: <AlertCircle className="w-3.5 h-3.5 text-[#C084FC] rotate-45" />,
                          }
                        : {
                            label: 'Traffic',
                            icon: <Car className="w-3 h-3 text-blue-600" />,
                            pinIcon: <Car className="w-3.5 h-3.5 text-[#60A5FA] rotate-45" />,
                          };

                const unsolvedCount = hazard.confirmations ?? 0;
                const beingSolvedCount = hazard.beingSolvedCount ?? 0;
                const falseReportCount = hazard.falseReportCount ?? 0;
                const totalAnalysis = unsolvedCount + beingSolvedCount + falseReportCount;
                const safeTotal = Math.max(1, totalAnalysis);
                const myVote = hazardVotes[hazard.id] || EMPTY_HAZARD_VOTE;
                const activeVoteLabels = [
                  myVote.unsolved ? 'True & Unsolved' : null,
                  myVote.false_report ? 'False Report' : null,
                  myVote.being_solved ? 'True & Solved' : null,
                ].filter(Boolean);

                return (
                  <div
                    key={hazard.id}
                    className="w-full bg-white rounded-[24px] p-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.22)] border border-white/90 text-gray-950 transition-all"
                  >
                    {/* Top Incident Summary + Map Preview (click to inspect on full map) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenCommunityHazardOnMap(hazard)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenCommunityHazardOnMap(hazard);
                        }
                      }}
                      className="flex items-stretch gap-3 cursor-pointer group"
                    >
                      {/* Left Metadata & Copy Column */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                                {hazard.province} · {getRelativeTime(hazard.createdAt)}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px] font-semibold">
                                {kindMeta.icon}
                                <span>{kindMeta.label}</span>
                              </span>
                            </div>
                            {hazard.canDelete && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommunityDeleteError(null);
                                  setConfirmDeleteHazardId((prev) =>
                                    prev === hazard.id ? null : hazard.id
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-rose-700 hover:bg-rose-50 border border-rose-200/80 transition-colors cursor-pointer shrink-0"
                                title="Delete your report"
                                aria-label={`Delete report ${hazard.title}`}
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>

                          <h3 className="text-[13px] font-black font-display text-gray-950 leading-snug mt-1.5 line-clamp-2 group-hover:text-[#941329] transition-colors">
                            {hazard.title}
                          </h3>

                          <p className="text-[11px] font-semibold text-gray-700 mt-1 flex items-start gap-1 leading-snug">
                            <MapPin className="w-3 h-3 text-[#941329] shrink-0 mt-0.5" />
                            <span className="break-words">{hazard.area}</span>
                          </p>

                          {hazard.description &&
                            hazard.description !== `Reported near ${hazard.area}` && (
                              <p className="text-[11px] text-gray-500 italic line-clamp-2 mt-0.5 leading-snug">
                                {hazard.description}
                              </p>
                            )}
                        </div>
                      </div>

                      {/* Right Square Map Tile Thumbnail */}
                      <div className="w-[84px] h-[84px] sm:w-[92px] sm:h-[92px] rounded-2xl overflow-hidden shrink-0 relative bg-[#E8EEF0] border border-gray-200/80 shadow-xs self-center">
                        <img
                          src={preview.tileUrl}
                          alt={`${hazard.area} map location`}
                          loading="lazy"
                          className="w-full h-full object-cover scale-125 pointer-events-none select-none"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                        <div
                          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
                          style={{ left: `${preview.leftPct}%`, top: `${preview.topPct}%` }}
                        >
                          <div className="w-7 h-7 rounded-full rounded-bl-[3px] -rotate-45 bg-[#1C241E] border-2 border-white shadow-md flex items-center justify-center">
                            {kindMeta.pinIcon}
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1 pointer-events-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                          <span className="w-1 h-1 rounded-full bg-white/70" />
                          <span className="w-1 h-1 rounded-full bg-white/70" />
                        </div>
                      </div>
                    </div>

                    {/* Reporter-Only Delete Confirmation Bar */}
                    {hazard.canDelete && confirmDeleteHazardId === hazard.id && (
                      <div
                        className="mt-2.5 p-2.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] font-bold text-rose-900">
                          Delete your report permanently?
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteHazardId(null);
                              setCommunityDeleteError(null);
                            }}
                            disabled={deletingHazardId === hazard.id}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-[11px] font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void handleDeleteCommunityHazard(e, hazard.id)}
                            disabled={deletingHazardId === hazard.id}
                            className="px-2.5 py-1 rounded-lg bg-[#941329] hover:bg-[#7A0F21] disabled:opacity-60 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {deletingHazardId === hazard.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Deleting...</span>
                              </>
                            ) : (
                              <span>Confirm</span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {hazard.canDelete && confirmDeleteHazardId === hazard.id && communityDeleteError && (
                      <p className="mt-1.5 text-[11px] font-semibold text-[#941329]">
                        {communityDeleteError}
                      </p>
                    )}

                    {/* Shared Community Photo */}
                    {hazard.imageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCommunityPhoto({
                            url: hazard.imageUrl!,
                            title: hazard.title,
                          })
                        }
                        className="mt-2.5 block w-full rounded-2xl overflow-hidden border border-gray-200/80 bg-gray-100 cursor-pointer group/photo"
                      >
                        <img
                          src={hazard.imageUrl}
                          alt={hazard.title}
                          loading="lazy"
                          className="w-full h-44 object-cover group-hover/photo:scale-[1.02] transition-transform duration-300"
                        />
                      </button>
                    )}

                    {/* Incident Report Analysis */}
                    <div className="mt-3 pt-2.5 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 shrink-0">
                          Report Analysis
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 tabular-nums truncate">
                          {activeVoteLabels.length > 0
                            ? `Voted: ${activeVoteLabels.join(' + ')}`
                            : `${totalAnalysis} ${totalAnalysis === 1 ? 'response' : 'responses'}`}
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden flex mb-2">
                        <div
                          className="bg-rose-500 h-full transition-all"
                          style={{ width: `${(unsolvedCount / safeTotal) * 100}%` }}
                        />
                        <div
                          className="bg-slate-400 h-full transition-all"
                          style={{ width: `${(falseReportCount / safeTotal) * 100}%` }}
                        />
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${(beingSolvedCount / safeTotal) * 100}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          disabled={confirmingHazardId === hazard.id}
                          onClick={(e) => void handleVoteHazardAnalysis(e, hazard.id, 'unsolved')}
                          className={`py-1.5 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                            myVote.unsolved
                              ? 'bg-rose-100 border-rose-500 ring-1 ring-rose-300'
                              : 'bg-rose-50/90 hover:bg-rose-100/80 border-rose-200/80'
                          }`}
                          title={myVote.unsolved ? 'Tap again to remove your vote' : 'Saw it — true and unsolved'}
                        >
                          <span className="block text-sm font-black text-rose-700 tabular-nums leading-none">
                            {unsolvedCount}
                          </span>
                          <span className="block text-[9.5px] font-bold text-rose-800 mt-1 leading-tight">
                            {myVote.unsolved ? '✓ ' : ''}True &amp; Unsolved
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={confirmingHazardId === hazard.id}
                          onClick={(e) => void handleVoteHazardAnalysis(e, hazard.id, 'false_report')}
                          className={`py-1.5 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                            myVote.false_report
                              ? 'bg-slate-200 border-slate-500 ring-1 ring-slate-300'
                              : 'bg-slate-100/90 hover:bg-slate-200/80 border-slate-200'
                          }`}
                          title={myVote.false_report ? 'Tap again to remove your vote' : 'Not there — false report'}
                        >
                          <span className="block text-sm font-black text-slate-700 tabular-nums leading-none">
                            {falseReportCount}
                          </span>
                          <span className="block text-[9.5px] font-bold text-slate-600 mt-1 leading-tight">
                            {myVote.false_report ? '✓ ' : ''}False Report
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={confirmingHazardId === hazard.id}
                          onClick={(e) => void handleVoteHazardAnalysis(e, hazard.id, 'being_solved')}
                          className={`py-1.5 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                            myVote.being_solved
                              ? 'bg-emerald-100 border-emerald-500 ring-1 ring-emerald-300'
                              : 'bg-emerald-50/90 hover:bg-emerald-100/80 border-emerald-200/80'
                          }`}
                          title={myVote.being_solved ? 'Tap again to remove your vote' : 'True & solved / cleared'}
                        >
                          <span className="block text-sm font-black text-emerald-700 tabular-nums leading-none">
                            {beingSolvedCount}
                          </span>
                          <span className="block text-[9.5px] font-bold text-emerald-800 mt-1 leading-tight">
                            {myVote.being_solved ? '✓ ' : ''}True &amp; Solved
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
                })}
            </div>
          );
        })()}
      </div>

      {/* 5. EMERGENCY CONTACTS MODAL */}
      {showEmergencyModal && (
        <div className="fixed top-14 inset-x-0 bottom-0 z-50 flex items-start justify-center p-3 pt-3 pb-32 bg-black/80 overflow-y-auto animate-fade-in">
          <div className="pro-form-card text-white rounded-[32px] max-w-sm w-full p-5 sm:p-6 shadow-[0_24px_64px_rgba(0,0,0,0.8)] relative border border-white/10 emergency-form-strobe mb-8">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handleEndEmergencyCall}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 text-white/85 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                aria-label={isInEmergencyCall ? 'Back and end emergency call' : 'Back'}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleEndEmergencyCall}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Siren className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white font-display leading-tight">
                    {isInEmergencyCall ? 'Emergency Call In Progress' : 'Emergency Road SOS'}
                  </h3>
                  <p className="text-[11px] text-rose-400 font-bold mt-0.5">
                    {isInEmergencyCall ? 'Loudspeaker Active • Capture Plate Below' : 'South Africa Emergency Services (112 / 10111)'}
                  </p>
                </div>
              </div>
            </div>

            {/* CONDITIONAL: IN-CALL INTERFACE VS INITIAL DIALER */}
            {isInEmergencyCall ? (
              <div className="space-y-3">
                {/* LOUDSPEAKER STATUS & CONTROL (HANDS-FREE) */}
                <div className="p-3.5 rounded-2xl bg-[#131417] border border-emerald-500/40 shadow-inner text-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isLoudspeakerOn ? 'bg-emerald-500 text-gray-950 font-bold shadow-emerald-500/40 shadow-sm animate-pulse' : 'bg-[#222428] text-white/50'}`}>
                        {isLoudspeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 truncate">
                            {isLoudspeakerOn ? 'Loudspeaker: Active' : 'Ear Speaker (Loudspeaker Off)'}
                          </span>
                          {isLoudspeakerOn && (
                            <span className="px-1.5 py-0.2 bg-emerald-400 text-gray-950 font-black text-[9px] rounded-md uppercase">
                              Hands-Free
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-white/60 block leading-tight mt-0.5">
                          {isLoudspeakerOn
                            ? 'Speak hands-free with dispatch while capturing the plate below.'
                            : 'Tap to switch back to hands-free loudspeaker.'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playSpeakerChime();
                        setIsLoudspeakerOn((v) => !v);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                        isLoudspeakerOn
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-[#222428] border-white/10 text-white/70 hover:bg-[#2A2C32]'
                      }`}
                    >
                      {isLoudspeakerOn ? '🔊 Speaker ON' : '🔈 Turn ON'}
                    </button>
                  </div>
                </div>

                {/* 3. CAPTURE VEHICLE PLATE WHILE IN CALL */}
                <div className="p-3.5 bg-[#131417] border border-white/10 rounded-2xl shadow-inner text-left">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-rose-400" />
                      <span>Capture Vehicle Plate (In-Call)</span>
                    </label>
                    <span className="text-[10px] text-white/50">
                      Province: <strong className="text-white">{callProvinceCode === 'WC' ? 'CA' : callProvinceCode}</strong>
                    </span>
                  </div>

                  {/* Province Quick Selection Chips */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2.5 scrollbar-none">
                    {['GP', 'CA', 'ZN', 'FS', 'NW', 'EC', 'MP', 'LP', 'NC'].map((code) => {
                      const actualCode = code === 'CA' ? 'WC' : code === 'LP' ? 'L' : code;
                      const isSelected = callProvinceCode === actualCode || (code === 'CA' && callProvinceCode === 'WC');
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setCallProvinceCode(actualCode)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer shrink-0 border ${
                            isSelected
                              ? 'bg-[#2D3036] text-white border-white/20 shadow-xs'
                              : 'bg-[#1C1E23] text-white/50 border-white/10 hover:text-white hover:bg-[#24262D]'
                          }`}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>

                  {/* Authentic Live Provincial Plate Input */}
                  <InteractiveProvincialPlateInput
                    provinceCode={callProvinceCode}
                    value={callPlateNumber}
                    onChange={(val) => {
                      const stripped = stripProvinceCodeFromInput(val, callProvinceCode);
                      setCallPlateNumber(stripped);
                    }}
                    placeholder="e.g. CK 45 DF GP"
                    autoFocus
                    dark={true}
                  />

                  {/* Quick Incident Type Selector */}
                  <div className="mt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50 block mb-1.5">
                      Incident Type:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'crash', label: '💥 Crash / Collision' },
                        { id: 'hit_and_run', label: '🛑 Hit & Run' },
                        { id: 'injury', label: '🚑 Medical Injury' },
                        { id: 'overturned', label: '⚠️ Overturned / Hazard' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCallIncidentType(item.id as any)}
                          className={`p-2 rounded-xl text-left text-[11px] font-bold border transition-all cursor-pointer ${
                            callIncidentType === item.id
                              ? 'bg-[#242730] border-white/30 text-white ring-1 ring-white/20'
                              : 'bg-[#141518] border-white/[0.08] text-white/60 hover:text-white hover:bg-[#1D1F24]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Location / Note Input */}
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={callNote}
                      onChange={(e) => setCallNote(e.target.value)}
                      placeholder="Scene notes e.g. N1 Southbound near split..."
                      maxLength={140}
                      className="w-full px-3 py-2.5 text-xs bg-[#17181D] border border-white/10 rounded-xl focus:outline-none focus:border-white/30 text-white placeholder:text-white/30"
                    />
                  </div>

                  {/* Dispatch message feedback */}
                  {callReportFeedback && (
                    <div className={`mt-2.5 p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                      callReportSuccess ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
                    }`}>
                      {callReportSuccess ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
                      <span>{callReportFeedback}</span>
                    </div>
                  )}

                  {/* Action button: Save & Dispatch Plate */}
                  <button
                    type="button"
                    onClick={handleDispatchInCallReport}
                    disabled={isDispatchingCallReport || !callPlateNumber.trim()}
                    className={`mt-3 w-full py-3 px-4 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      callPlateNumber.trim().length >= 2
                        ? 'bg-white hover:bg-gray-100 text-gray-950 active:scale-[0.99]'
                        : 'bg-[#222428] text-white/30 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isDispatchingCallReport ? 'Recording & Dispatching...' : 'Record Plate & Send Emergency Ping'}
                    </span>
                  </button>
                </div>

                {/* Redial & Alternative Emergency Lines */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <a
                    href="tel:112"
                    onClick={playSpeakerChime}
                    className="py-2.5 px-3 rounded-xl bg-[#1C1E23] hover:bg-[#24262D] text-white border border-white/10 font-bold flex items-center justify-center gap-1.5 text-center transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>Redial 112</span>
                  </a>
                  <a
                    href="tel:10111"
                    onClick={playSpeakerChime}
                    className="py-2.5 px-3 rounded-xl bg-[#1C1E23] hover:bg-[#24262D] text-white border border-white/10 font-bold flex items-center justify-center gap-1.5 text-center transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-rose-400" />
                    <span>Dial Police 10111</span>
                  </a>
                </div>
              </div>
            ) : (
              <div>
                {/* 1. PRIORITIZED ACCIDENT & EMERGENCY REPORT BUTTON */}
                <button
                  type="button"
                  onClick={handleStartEmergencyCall}
                  className="w-full p-4 mb-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl shadow-lg shadow-red-950/40 flex items-center justify-between transition-all transform active:scale-[0.98] border border-red-400/40 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Siren className="w-5 h-5 animate-pulse text-amber-300" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-white leading-tight flex items-center gap-1.5">
                        <span>REPORT ACCIDENT / EMERGENCY</span>
                        <span className="px-1.5 py-0.5 bg-amber-400 text-red-950 font-black text-[9px] rounded-md">112 CALL</span>
                      </div>
                      <div className="text-[10px] text-rose-100 font-medium mt-0.5 leading-tight">
                        Calls 112 on loudspeaker & opens live plate capture
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/90 group-hover:translate-x-1 transition-transform shrink-0 ml-1" />
                </button>

                {/* Direct Hotlines Section Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-[9px] font-bold uppercase tracking-widest text-white/40">
                    <span className="bg-[#1A1C20] px-2.5">OR DIAL EMERGENCY HOTLINES</span>
                  </div>
                </div>

                <div className="space-y-2 mb-2">
                  <a
                    href="tel:10111"
                    onClick={playSpeakerChime}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#141518] hover:bg-[#1D1F24] border border-white/[0.08] text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-red-600/30 text-rose-400 flex items-center justify-center font-black border border-rose-500/30">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">10111</div>
                        <div className="text-[10px] text-white/50">SAPS Police Emergency (Nationwide)</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white bg-[#222428] border border-white/10 px-3 py-1 rounded-xl shadow-xs">
                      Call
                    </span>
                  </a>

                  <a
                    href="tel:112"
                    onClick={playSpeakerChime}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#141518] hover:bg-[#1D1F24] border border-white/[0.08] text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-600/30 text-amber-300 flex items-center justify-center font-black border border-amber-500/30">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">112</div>
                        <div className="text-[10px] text-white/50">Mobile Emergency (Free from any cellphone)</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white bg-[#222428] border border-white/10 px-3 py-1 rounded-xl shadow-xs">
                      Call
                    </span>
                  </a>

                  <a
                    href="tel:10177"
                    onClick={playSpeakerChime}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#141518] hover:bg-[#1D1F24] border border-white/[0.08] text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-300 flex items-center justify-center font-black border border-blue-500/30">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">10177</div>
                        <div className="text-[10px] text-white/50">Ambulance & Medical Rescue</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white bg-[#222428] border border-white/10 px-3 py-1 rounded-xl shadow-xs">
                      Call
                    </span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TECHNICAL SUPPORT MODAL */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in">
          <div className="glass-modal text-gray-950 rounded-[32px] max-w-sm w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowSupportModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close technical support"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 pr-8">
              <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-200 text-[#6d28d9] flex items-center justify-center shrink-0">
                <LifeBuoy className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-lg font-black font-display text-gray-950 leading-tight">Technical Support</h2>
                <p className="text-[11px] text-violet-700 font-bold mt-0.5">App, camera, alerts or account</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-xs font-black text-gray-950">Plate scan comes back empty</h3>
                <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5">
                  Retake the photo straight-on in good light, then tap the glowing AI orb to scan again.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-xs font-black text-gray-950">Camera or gallery will not open</h3>
                <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5">
                  Allow camera and photo access for this site in your browser settings, then reload the app.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-xs font-black text-gray-950">Alerts or reports look stale</h3>
                <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5">
                  Check your connection and reopen the tab. Anything you have not sent is kept as a draft.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="text-xs font-black text-gray-950">Cannot sign in</h3>
                <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5">
                  Use the email you registered with and reset the password from the sign-in screen.
                </p>
              </div>
            </div>

            <a
              href="mailto:support@driverping.co.za?subject=DriverPing%20technical%20support"
              className="mt-4 w-full py-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Email the support team
            </a>

            <button
              type="button"
              onClick={() => setShowSupportModal(false)}
              className="mt-2 w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-2xl transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 4 Reporting Buttons Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in">
          <div className="glass-modal text-gray-950 rounded-[32px] max-w-sm w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label="Close guide"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-2xl bg-red-100 text-[#941329] flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 stroke-[2.3]" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-950 font-display leading-tight">
                  Reporting Buttons Guide
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">How the 4 reporting buttons work</p>
              </div>
            </div>

            {/* Visual 2x2 Dial Preview */}
            <div className="my-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/70 border border-gray-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="grid grid-cols-2 gap-1 p-1 bg-gray-200/70 rounded-full shadow-inner shrink-0">
                {/* 1. Vehicle Condition Mini */}
                <div
                  className="w-7 h-7 bg-white rounded-tl-[14px] rounded-tr-[3px] rounded-br-[3px] rounded-bl-[3px] shadow-xs flex items-center justify-center text-[#941329]"
                  title="Vehicle Condition: Lights, tyres, hazards"
                >
                  <Car className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
                {/* 2. Driver Behaviour Mini */}
                <div
                  className="w-7 h-7 bg-white rounded-tl-[3px] rounded-tr-[14px] rounded-br-[3px] rounded-bl-[3px] shadow-xs flex items-center justify-center text-[#1e40af]"
                  title="Driver Behaviour: Tailgating, reckless driving"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="2" x2="12" y2="9" />
                    <line x1="2" y1="12" x2="9" y2="12" />
                    <line x1="15" y1="12" x2="22" y2="12" />
                  </svg>
                </div>
                {/* 3. Road Violation Mini */}
                <div
                  className="w-7 h-7 bg-white rounded-tl-[3px] rounded-tr-[3px] rounded-br-[3px] rounded-bl-[14px] shadow-xs flex items-center justify-center text-[#d97706]"
                  title="Road Violation: Red robot, lane straddling"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="2" x2="4" y2="22" />
                    <line x1="20" y1="2" x2="20" y2="22" />
                    <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
                  </svg>
                </div>
                {/* 4. Emergency SOS Mini */}
                <div
                  className="w-7 h-7 bg-white rounded-tl-[3px] rounded-tr-[3px] rounded-br-[14px] rounded-bl-[3px] shadow-xs flex flex-col items-center justify-center text-[#dc2626]"
                  title="Emergency SOS: 112 emergency services"
                >
                  <Siren className="w-2.5 h-2.5 stroke-[2.2]" />
                  <span className="text-[5px] font-black tracking-tighter leading-none">SOS</span>
                </div>
              </div>
              <div className="text-[11px] text-gray-700 leading-snug">
                Tap the center <strong>REPORT</strong> dial to expand the 4 quadrant buttons shown on the left.
              </div>
            </div>

            {/* The 4 Buttons Detailed - Exact Original Icons & Colors */}
            <div className="space-y-2.5">
              {/* Button 1: Vehicle Condition */}
              <div className="p-3 bg-red-50/40 border border-[#941329]/20 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-tl-[16px] rounded-tr-[3px] rounded-br-[3px] rounded-bl-[3px] bg-white border border-[#941329]/20 shadow-xs flex items-center justify-center text-[#941329] shrink-0">
                      <Car className="w-4.5 h-4.5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-950">1. Vehicle Condition</h4>
                      <span className="text-[10px] text-gray-400 font-medium">Top-Left Button · Crimson</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-[#941329] bg-[#941329]/10 border border-[#941329]/20 px-2 py-0.5 rounded-full">
                    Faults
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed mt-1">
                  Warns drivers about safety defects they cannot see from inside: broken brake lights, flat or soft tyres, doors/boot unlatched, fuel flap open, loose roof cargo, or heavy exhaust smoke.
                </p>
              </div>

              {/* Button 2: Driver Behaviour */}
              <div className="p-3 bg-blue-50/40 border border-[#1e40af]/20 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-tl-[3px] rounded-tr-[16px] rounded-br-[3px] rounded-bl-[3px] bg-white border border-[#1e40af]/20 shadow-xs flex items-center justify-center text-[#1e40af] shrink-0">
                      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="2" x2="12" y2="9" />
                        <line x1="2" y1="12" x2="9" y2="12" />
                        <line x1="15" y1="12" x2="22" y2="12" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-950">2. Driver Behaviour</h4>
                      <span className="text-[10px] text-gray-400 font-medium">Top-Right Button · Deep Blue</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-[#1e40af] bg-[#1e40af]/10 border border-[#1e40af]/20 px-2 py-0.5 rounded-full">
                    Safety
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed mt-1">
                  Sends calm, anonymous reminders for hazardous driving: tailgating, swerving between lanes, texting or handling phones while driving, or speeding through residential areas.
                </p>
              </div>

              {/* Button 3: Road Violation */}
              <div className="p-3 bg-amber-50/40 border border-[#d97706]/20 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-tl-[3px] rounded-tr-[3px] rounded-br-[3px] rounded-bl-[16px] bg-white border border-[#d97706]/20 shadow-xs flex items-center justify-center text-[#d97706] shrink-0">
                      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="2" x2="4" y2="22" />
                        <line x1="20" y1="2" x2="20" y2="22" />
                        <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-950">3. Road Violation</h4>
                      <span className="text-[10px] text-gray-400 font-medium">Bottom-Left Button · Amber</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-[#d97706] bg-[#d97706]/10 border border-[#d97706]/20 px-2 py-0.5 rounded-full">
                    Traffic
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed mt-1">
                  Documents public traffic and parking infractions: running red robots (traffic lights), blocking driveways or kerb ramps, stopping in cycle/bus lanes, and double parking.
                </p>
              </div>

              {/* Button 4: Emergency SOS */}
              <div className="p-3 bg-red-50/60 border border-[#dc2626]/20 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-tl-[3px] rounded-tr-[3px] rounded-br-[16px] rounded-bl-[3px] bg-white border border-[#dc2626]/20 shadow-xs flex flex-col items-center justify-center text-[#dc2626] shrink-0">
                      <Siren className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span className="text-[6px] font-black tracking-tighter uppercase leading-none mt-0.5">SOS</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-950">4. Emergency SOS</h4>
                      <span className="text-[10px] text-red-600 font-medium">Bottom-Right Button · Red</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-white bg-[#dc2626] px-2 py-0.5 rounded-full shadow-2xs">
                    SOS
                  </span>
                </div>
                <p className="text-[11px] text-gray-700 leading-relaxed mt-1">
                  For real emergencies. Opens the SOS panel to call 112 on loudspeaker, dial the police on 10111, and capture the plates involved while the call is live.
                </p>
              </div>
            </div>

            {/* Privacy Protection Callout */}
            <div className="mt-3.5 p-3 bg-emerald-50/80 border border-emerald-100 rounded-2xl flex items-center gap-2.5 text-[11px] text-emerald-950">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="leading-snug">
                <strong>100% Anonymous:</strong> The reported driver never sees your identity, name, or phone number.
              </span>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-3 bg-[#941329] hover:bg-[#7D0E20] text-white font-bold text-xs rounded-2xl transition-all shadow-md cursor-pointer"
            >
              Got it, close guide
            </button>
          </div>
        </div>
      )}

      {/* 5b. COMMUNITY HUB PROVINCE & CITY FILTER MODAL */}
      {showCommunityFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass-modal text-gray-950 rounded-[32px] w-full max-w-[390px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-red-50 text-[#941329] flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-950 font-display leading-tight">
                    Filter Community Hub
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Choose province and city for road alerts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCommunityFilterModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                aria-label="Close filter modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyCommunityFilter} className="space-y-3">
              {/* Auto-detect User Location Button */}
              <button
                type="button"
                onClick={handleDetectLocationForFilter}
                disabled={isDetectingLocation}
                className="w-full py-2.5 px-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {isDetectingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                ) : (
                  <LocateFixed className="w-4 h-4 text-emerald-700" />
                )}
                <span>
                  {isDetectingLocation
                    ? 'Detecting province & city...'
                    : 'Use My Location (Auto-Set Province & City)'}
                </span>
              </button>

              {locationDetectStatus && (
                <div
                  className={`p-2.5 rounded-2xl text-[11px] font-semibold flex items-start gap-2 ${
                    locationDetectStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border border-amber-200'
                  }`}
                >
                  {locationDetectStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  )}
                  <span className="leading-snug">{locationDetectStatus.text}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Province
                </label>
                <select
                  value={draftProvince}
                  onChange={(e) => {
                    setDraftProvince(e.target.value);
                    setDraftCity('ALL');
                    setDraftCustomCity('');
                    setLocationDetectStatus(null);
                  }}
                  className="w-full px-3 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:border-[#B81D39]"
                >
                  <option value="ALL">All Provinces (Nationwide)</option>
                  {SA_PROVINCES.map((prov) => (
                    <option key={prov.code} value={prov.code}>
                      {prov.name} ({prov.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  City / Town
                </label>
                <select
                  disabled={draftProvince === 'ALL'}
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:border-[#B81D39]"
                >
                  <option value="ALL">
                    {draftProvince === 'ALL' ? 'Select a province first' : 'All cities in province'}
                  </option>
                  {getProvinceCityOptions(draftProvince).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                  {draftProvince !== 'ALL' && <option value="__other__">Other city / town...</option>}
                </select>
              </div>

              {draftProvince !== 'ALL' && draftCity === '__other__' && (
                <input
                  type="text"
                  value={draftCustomCity}
                  onChange={(e) => setDraftCustomCity(e.target.value)}
                  placeholder="Enter city or suburb name..."
                  className="w-full px-3 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:border-[#B81D39]"
                />
              )}

              <div className="p-2.5 rounded-2xl bg-gray-50 border border-gray-100 text-[11px] text-gray-600 flex items-center justify-between">
                <span>Matching alerts:</span>
                <strong className="text-gray-950">
                  {
                    communityHazards.filter((h) => {
                      const resolvedDraftCity =
                        draftProvince === 'ALL'
                          ? 'ALL'
                          : draftCity === '__other__'
                            ? draftCustomCity.trim() || 'ALL'
                            : draftCity || 'ALL';
                      return (
                        matchesCommunityProvince(h.province, draftProvince) &&
                        matchesCommunityCity(h, resolvedDraftCity)
                      );
                    }).length
                  }
                </strong>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={handleResetCommunityFilter}
                  className="flex-1 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Reset All
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-[#941329] hover:bg-[#7D0E20] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Apply Filter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5d. FULL-SCREEN PHOTO LIGHTBOX FOR COMMUNITY HUB IMAGES */}
      {expandedCommunityPhoto && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setExpandedCommunityPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setExpandedCommunityPhoto(null)}
            aria-label="Close photo preview"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/20 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-lg w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={expandedCommunityPhoto.url}
              alt={expandedCommunityPhoto.title}
              className="w-full max-h-[78vh] object-contain rounded-2xl shadow-2xl"
            />
            <p className="text-xs font-bold text-white/90 text-center px-3">
              {expandedCommunityPhoto.title}
            </p>
          </div>
        </div>
      )}

      {/* 6. FULL PAGE RSA LIVE MAP VIEW (Powered by FreeRoute) */}
      {showMapModal && (
        <LiveRouteMap
          onClose={() => {
            setShowMapModal(false);
            setFocusedMapHazard(null);
            void fetchCommunityHazards();
          }}
          provinceFilter={mapProvinceFilter}
          onProvinceFilterChange={setMapProvinceFilter}
          initialHazard={focusedMapHazard}
          onHazardsChanged={() => void fetchCommunityHazards()}
        />
      )}

      {/* 7. FULL-SCREEN BLUR + CUT-OUT POLICE STROBE REPORT BUTTON */}
      {isPoliceStrobe &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998] backdrop-blur-lg bg-black/55 pointer-events-auto touch-none select-none"
              onContextMenu={(e) => e.preventDefault()}
              onPointerUp={cancelPoliceStrobe}
              onPointerCancel={cancelPoliceStrobe}
              aria-hidden="true"
            />
            <div
              className="fixed z-[9999] flex items-center justify-center pointer-events-auto"
              style={{
                top: strobeRect ? `${strobeRect.top}px` : '50%',
                left: strobeRect ? `${strobeRect.left}px` : '50%',
                width: strobeRect ? `${strobeRect.width}px` : '8rem',
                height: strobeRect ? `${strobeRect.height}px` : '8rem',
                transform: strobeRect ? undefined : 'translate(-50%, -50%)',
                isolation: 'isolate',
              }}
            >
              <button
                type="button"
                className="btn is-police-strobe focus:outline-none select-none touch-none"
                style={{ width: '100%', height: '100%' }}
                onContextMenu={(e) => e.preventDefault()}
                onPointerUp={cancelPoliceStrobe}
                onPointerCancel={cancelPoliceStrobe}
                aria-label={`Keep holding for emergency call: ${strobeCountdown} seconds remaining`}
              >
                <span className="text-5xl font-black tabular-nums leading-none tracking-normal">
                  {strobeCountdown}
                </span>
              </button>
            </div>
            <div
              className="fixed bottom-8 inset-x-0 z-[9999] flex justify-center pointer-events-none px-4 select-none"
              aria-live="assertive"
            >
              <p className="text-xl font-black tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                Keep Holding
              </p>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
