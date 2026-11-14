import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext.js';
import { ReportCategory, AlertItem } from '../types/index.js';
import {
  AlertTriangle,
  Car,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  Clock,
  Shield,
  X,
  ArrowRight,
  ArrowLeft,
  EyeOff,
  Siren,
  Phone,
  AlertCircle,
  HelpCircle,
  MapPin,
  Compass,
  Navigation,
  Layers,
  Radio,
  Volume2,
  VolumeX,
  PhoneOff,
  Send,
  Check,
  Sparkles,
  LifeBuoy,
  Mail,
} from 'lucide-react';
import {
  ProvincialPlate,
  detectProvinceFromPlate,
  InteractiveProvincialPlateInput,
  formatFullProvincialPlate,
  stripProvinceCodeFromInput,
} from '../components/ProvincialPlate.js';

export function HomeScreen() {
  const {
    user,
    setActiveTab,
    setReportCategoryPreset,
    alerts,
    takeAlertAction,
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

  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionType, setActionType] = useState<'resolve' | 'dispute' | 'flag_abuse' | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapProvinceFilter, setMapProvinceFilter] = useState<string>('ALL');
  const [pressedQuadrant, setPressedQuadrant] = useState<'vehicle' | 'driver' | 'road' | 'sos' | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<'vehicle' | 'driver' | 'road' | 'sos' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'vehicle' | 'driver' | 'road' | 'sos' | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const quadrantTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    };
  }, []);

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

  const handleReportButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus();
    if (isReportOpen) {
      setIsReportOpen(false);
      return;
    }
    setIsFlashing(true);
    setIsReportOpen(true);
    setTimeout(() => {
      setIsFlashing(false);
    }, 550);
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

  const handleAlertClick = (alert: AlertItem) => {
    setSelectedAlert(alert);
    setActionType(null);
    setActionNote('');
  };

  const submitAlertAction = async (type: 'resolve' | 'dismiss' | 'dispute' | 'flag_abuse') => {
    if (!selectedAlert) return;
    setIsSubmittingAction(true);
    await takeAlertAction(selectedAlert.id, type, actionNote);
    setIsSubmittingAction(false);
    setSelectedAlert(null);
  };

  // Format relative time helper
  const getRelativeTime = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} d ago`;
  };

  // Mask plate for recent alerts preview (e.g. "Vehicle ending • 482")
  const getMaskedPlate = (plateDisplay: string) => {
    const digitsMatch = plateDisplay.match(/\d{3}/g);
    if (digitsMatch && digitsMatch.length > 0) {
      const lastDigits = digitsMatch[digitsMatch.length - 1];
      return `Vehicle ending • ${lastDigits}`;
    }
    const clean = plateDisplay.replace(/[^A-Z0-9]/gi, '');
    const ending = clean.slice(-3);
    return `Vehicle ending • ${ending}`;
  };

  return (
    <div className="pb-28 pt-3 px-3 max-w-[420px] mx-auto text-white">
      {/* 1. PRIMARY FLOATING HERO CARD - Red Aurora Mesh Effect (matching user reference image) */}
      <div className="report-aurora-card rounded-[34px] px-4.5 pt-4 pb-3.5 text-white relative overflow-hidden text-center shadow-2xl">
        {/* Atmospheric Blurred Aurora Mesh Light Blooms (matching reference image fluid blur effect in red) */}
        <div className="absolute -top-14 -right-10 w-56 h-56 rounded-full bg-[#FB7185]/45 blur-[50px] pointer-events-none" />
        <div className="absolute top-1/4 -left-12 w-64 h-64 rounded-full bg-[#E11D48]/50 blur-[60px] pointer-events-none" />
        <div className="absolute -bottom-10 right-4 w-52 h-52 rounded-full bg-[#9F1239]/70 blur-[45px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full bg-[#BE123C]/35 blur-[45px] pointer-events-none" />

        {/* Top Header Row */}
        <div className="relative z-10 mb-2.5 px-1 text-center flex flex-col items-center justify-center">
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
        <div className="my-1 relative flex flex-col items-center justify-center z-10">
          <div className={`wrapper ${isReportOpen ? 'is-open' : ''}`} tabIndex={-1}>
            <div className="stage">
              <div className="go-wrap">
                <button
                    className={`btn group focus:outline-none select-none ${isFlashing ? 'is-flashing' : ''}`}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={handleReportButtonClick}
                    onDoubleClick={() => handleStartReport()}
                    aria-label="Report vehicle. Tap to open the reporting options"
                    title="Click to select issue, double click to report"
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
        <div className="flex items-center justify-center relative z-10 mt-2 pt-2 border-t border-white/15 px-1">
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

      {/* 2. RECENT ALERTS (Clean white rounded cards with crimson accents) */}
      <div className="mt-5">
        <div className="flex items-center justify-between px-2 mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-white/80">
            Recent alerts
          </span>
          <button
            onClick={() => setActiveTab('alerts')}
            className="text-[11px] font-semibold text-white/80 hover:text-white flex items-center gap-1"
          >
            <span>View all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(() => {
          // Display top 4 most recent alerts for driver's vehicles (unread prioritized first)
          const displayAlerts = [...alerts].sort((a, b) => {
            const isUnreadA = a.status === 'received' || a.status === 'needs_review' ? 1 : 0;
            const isUnreadB = b.status === 'received' || b.status === 'needs_review' ? 1 : 0;
            if (isUnreadA !== isUnreadB) return isUnreadB - isUnreadA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          if (displayAlerts.length === 0) {
            return (
              <div className={`rounded-[26px] p-5 text-center border transition-colors ${
                isDark ? 'bg-[#14161B] border-white/10 text-white' : 'glass-card text-gray-900 border-white/60'
              }`}>
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>All clear</p>
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                  No observations or alerts reported for your registered vehicles.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-2.5">
              {displayAlerts.slice(0, 4).map((alert) => {
                const getBadge = (cat: string) => {
                  switch (cat) {
                    case 'vehicle_condition':
                      return {
                        bg: isDark ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40' : 'bg-red-50 text-[#941329]',
                        icon: <Car className="w-4 h-4 stroke-[2.2]" />,
                      };
                    case 'driver_behaviour':
                      return {
                        bg: isDark ? 'bg-blue-950/40 text-blue-300 border border-blue-800/40' : 'bg-blue-50 text-[#1e40af]',
                        icon: (
                          <svg
                            className="w-4 h-4"
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
                        ),
                      };
                    case 'road_violation':
                      return {
                        bg: isDark ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40' : 'bg-amber-50 text-[#d97706]',
                        icon: (
                          <svg
                            className="w-4 h-4"
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
                        ),
                      };
                    case 'emergency':
                      return {
                        bg: isDark ? 'bg-red-950/50 text-red-300 border border-red-800/50' : 'bg-red-50 text-[#dc2626]',
                        icon: <Siren className="w-4 h-4 stroke-[2.2]" />,
                      };
                    default:
                      return {
                        bg: isDark ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40' : 'bg-red-50 text-[#941329]',
                        icon: <Car className="w-4 h-4 stroke-[2.2]" />,
                      };
                  }
                };
                const badge = getBadge(alert.category);

                return (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={`w-full p-3.5 rounded-2xl shadow-md border flex flex-col gap-2 text-left transition-all active:scale-[0.99] cursor-pointer group ${
                      isDark
                        ? 'bg-[#14161B] hover:bg-[#1C1E24] text-white border-white/10'
                        : 'glass-card hover:bg-gray-50/90 text-gray-950 border-gray-200/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full ${badge.bg} flex items-center justify-center shrink-0 shadow-xs border ${
                          isDark ? 'border-white/10' : 'border-gray-100'
                        }`}>
                          {badge.icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className={`text-xs font-black font-display truncate ${
                            isDark ? 'text-white group-hover:text-rose-400' : 'text-gray-950 group-hover:text-[#941329]'
                          }`}>
                            {alert.issueTitle}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-24 shrink-0 drop-shadow-xs">
                              <ProvincialPlate
                                provinceCode={detectProvinceFromPlate(alert.plateDisplay)}
                                plateText={alert.plateDisplay}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                              {getRelativeTime(alert.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {alert.status === 'received' && (
                          <span className="text-[9px] font-black text-white bg-[#941329] px-2.5 py-0.5 rounded-full shadow-xs border border-red-500/30">
                            New
                          </span>
                        )}
                        {alert.status === 'needs_review' && (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs border ${
                            isDark ? 'text-amber-300 bg-amber-950/60 border-amber-800/50' : 'text-amber-900 bg-amber-100 border-amber-300'
                          }`}>
                            Review
                          </span>
                        )}
                        {alert.status === 'resolved' && (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs border ${
                            isDark ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800/50' : 'text-emerald-800 bg-emerald-100 border-emerald-300'
                          }`}>
                            Resolved
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            takeAlertAction(alert.id, 'resolve', 'Dismissed');
                          }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer border ${
                            isDark
                              ? 'bg-[#22242B] hover:bg-rose-950/40 text-white/60 hover:text-rose-400 border-white/10'
                              : 'bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-[#941329] border-gray-200'
                          }`}
                          title="Dismiss alert"
                          aria-label="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {alert.customNote && (
                      <p className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl truncate italic border ${
                        isDark
                          ? 'bg-rose-950/30 text-rose-200 border-rose-900/40'
                          : 'bg-rose-50/60 text-gray-800 border-rose-100/90'
                      }`}>
                        "{alert.customNote}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Selected Alert Quick-Action Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in">
          <div className={`rounded-[32px] max-w-sm w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto border ${
            isDark ? 'bg-[#181A20] text-white border-white/15' : 'bg-white text-gray-950 border-gray-200'
          }`}>
            <button
              onClick={() => setSelectedAlert(null)}
              className={`absolute top-4 right-4 p-2 rounded-full cursor-pointer transition-colors ${
                isDark ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <div className="w-40 max-w-full drop-shadow-xs">
                  <ProvincialPlate
                    provinceCode={detectProvinceFromPlate(selectedAlert.plateDisplay)}
                    plateText={selectedAlert.plateDisplay}
                  />
                </div>
                <div className={`font-mono font-black text-xs mt-1 ${isDark ? 'text-white/90' : 'text-gray-900'}`}>
                  {selectedAlert.plateDisplay}
                </div>
              </div>
              <span className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-400'}`}>
                {getRelativeTime(selectedAlert.createdAt)}
              </span>
            </div>

            <h3 className={`text-xl font-black font-display mt-1 ${isDark ? 'text-white' : 'text-gray-950'}`}>
              {selectedAlert.issueTitle}
            </h3>

            {/* Mandatory Neutral Language Banner */}
            <div className={`mt-3 p-3 rounded-2xl text-xs font-medium leading-relaxed border ${
              isDark ? 'bg-amber-950/40 border-amber-900/50 text-amber-200' : 'bg-amber-50 border-amber-200/60 text-amber-900'
            }`}>
              "A road user reported a possible observation. Please check when safe."
            </div>

            {selectedAlert.customNote && (
              <div className={`mt-3 p-3 rounded-2xl text-xs border ${
                isDark ? 'bg-[#1F2128] border-white/10 text-white/90' : 'bg-gray-50 border-gray-200/80 text-gray-700'
              }`}>
                <span className={`font-semibold block mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Observation note:</span>
                "{selectedAlert.customNote}"
              </div>
            )}

            {/* Recorded Delivery Confirmation */}
            <div className={`mt-3 p-2.5 rounded-2xl flex items-center gap-2 text-xs border ${
              isDark ? 'bg-blue-950/40 border-blue-900/50 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-900'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>System confirmation: Recorded delivered to your app feed.</span>
            </div>

            {/* Action selector */}
            {!actionType ? (
              <div className="mt-5 space-y-2">
                <button
                  onClick={() => submitAlertAction('resolve')}
                  disabled={isSubmittingAction}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Read</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActionType('dispute')}
                    className={`py-2.5 px-3 border font-semibold text-xs rounded-2xl transition-colors cursor-pointer ${
                      isDark
                        ? 'border-white/15 text-white/80 hover:bg-[#282B34]'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Dispute Note
                  </button>
                  <button
                    onClick={() => setActionType('flag_abuse')}
                    className={`py-2.5 px-3 border font-semibold text-xs rounded-2xl transition-colors cursor-pointer ${
                      isDark
                        ? 'border-rose-900/50 text-rose-400 hover:bg-rose-950/40'
                        : 'border-red-200 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    Flag as Abuse
                  </button>
                </div>

                <button
                  onClick={() => submitAlertAction('dismiss')}
                  disabled={isSubmittingAction}
                  className={`w-full py-2 text-xs cursor-pointer transition-colors ${
                    isDark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  Dismiss / Acknowledge
                </button>
              </div>
            ) : (
              <div className={`mt-4 pt-2 border-t space-y-3 ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {actionType === 'dispute'
                    ? 'Why are you disputing this report?'
                    : 'Report this alert as harassment or abuse:'}
                </div>
                <textarea
                  rows={2}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Provide details..."
                  className={`w-full p-2.5 text-xs rounded-2xl focus:outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#121317] border-white/15 text-white placeholder:text-white/40 focus:border-white/40'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#941329]'
                  }`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setActionType(null)}
                    className={`w-1/3 py-2 text-xs border rounded-2xl cursor-pointer ${
                      isDark ? 'border-white/15 text-white/70 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submitAlertAction(actionType)}
                    disabled={isSubmittingAction || !actionNote.trim()}
                    className={`w-2/3 py-2 text-xs font-bold text-white rounded-2xl cursor-pointer ${
                      actionType === 'dispute' ? 'bg-[#941329] hover:bg-[#7a0f21]' : 'bg-red-600 hover:bg-red-700'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Submit {actionType === 'dispute' ? 'Dispute' : 'Abuse Report'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* 6. FULL PAGE RSA LIVE MAP VIEW */}
      {showMapModal && (
        <div className={`fixed inset-0 pt-14 z-30 flex flex-col h-full w-full overflow-y-auto overflow-x-hidden no-scrollbar font-sans transition-colors ${
          isDark ? 'bg-[#090A0C] text-white' : 'bg-[#FAF8F6] text-gray-900'
        }`}>
          {/* Floating Back Button */}
          <button
            type="button"
            onClick={() => setShowMapModal(false)}
            className={`absolute top-4 left-4 z-30 p-2.5 rounded-full shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center ${
              isDark
                ? 'bg-[#16181D]/90 hover:bg-[#22252C] text-white border border-white/20'
                : 'bg-white hover:bg-gray-100 text-gray-950 border border-gray-200/90 shadow-md'
            }`}
            aria-label="Back to Home"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Coming Soon Map Viewport Area */}
          <div className={`flex-1 w-full relative flex flex-col items-center justify-center p-6 text-center overflow-y-auto ${
            isDark ? 'bg-[#090A0C]' : 'bg-[#FAF8F6]'
          }`}>
            {/* Background Grid & Aurora Mesh Glows */}
            <div className={`absolute inset-0 [background-size:24px_24px] pointer-events-none ${
              isDark
                ? 'bg-[radial-gradient(#334155_1px,transparent_1px)] opacity-30'
                : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] opacity-50'
            }`} />
            <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[#941329]/30 blur-[90px] pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-rose-600/20 blur-[90px] pointer-events-none" />

            <div className="relative z-10 max-w-sm w-full mx-auto flex flex-col items-center my-auto py-4">
              {/* Animated Map Icon Badge */}
              <div className={`w-16 h-16 rounded-3xl shadow-2xl flex items-center justify-center mb-4 relative group ${
                isDark
                  ? 'bg-slate-900/90 border border-slate-700/80 text-rose-400'
                  : 'bg-white border border-gray-200 text-[#941329] shadow-md'
              }`}>
                <MapPin className="w-8 h-8 stroke-[2.2] animate-bounce" />
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 animate-pulse ${
                  isDark ? 'border-[#090A0C]' : 'border-white'
                }`} />
              </div>

              {/* Coming Soon Tag */}
              <span className={`px-4 py-1 rounded-full text-[11px] font-black uppercase tracking-widest mb-3 inline-flex items-center gap-2 shadow-xs border ${
                isDark
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-rose-50 border-rose-200 text-[#941329]'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                Coming Soon
              </span>

              {/* Title */}
              <h2 className={`text-2xl font-black font-display tracking-tight mb-2 ${
                isDark ? 'text-white' : 'text-gray-950'
              }`}>
                Live Interactive Map
              </h2>

              <p className={`text-xs leading-relaxed font-medium mb-5 ${
                isDark ? 'text-slate-300' : 'text-gray-600'
              }`}>
                With our upcoming live map feature, road users across South Africa can pin and report live road conditions in real-time:
              </p>

              {/* Feature Highlights Grid */}
              <div className="w-full space-y-2.5 text-left mb-6">
                {/* 1. Potholes */}
                <div className={`p-3.5 rounded-2xl flex items-start gap-3 border ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 text-white'
                    : 'bg-white border-gray-200/90 text-gray-900 shadow-sm'
                }`}>
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                    isDark
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-amber-50 border-amber-200 text-amber-600'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-950'}`}>Potholes & Road Damage</h4>
                    <p className={`text-[11px] leading-snug mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      Mark dangerous potholes, road surface damage, and unlit hazards.
                    </p>
                  </div>
                </div>

                {/* 2. Accidents */}
                <div className={`p-3.5 rounded-2xl flex items-start gap-3 border ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 text-white'
                    : 'bg-white border-gray-200/90 text-gray-900 shadow-sm'
                }`}>
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                    isDark
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : 'bg-red-50 border-red-200 text-[#941329]'
                  }`}>
                    <Siren className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-950'}`}>Accidents & Collisions</h4>
                    <p className={`text-[11px] leading-snug mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      Pin live vehicle collisions for emergency responder dispatch and alert nearby drivers.
                    </p>
                  </div>
                </div>

                {/* 3. Traffic Jams */}
                <div className={`p-3.5 rounded-2xl flex items-start gap-3 border ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 text-white'
                    : 'bg-white border-gray-200/90 text-gray-900 shadow-sm'
                }`}>
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                    isDark
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : 'bg-blue-50 border-blue-200 text-blue-600'
                  }`}>
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-950'}`}>Traffic Jams & Delays</h4>
                    <p className={`text-[11px] leading-snug mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      Track real-time traffic bottlenecks, highway delays, and lane closures.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => setShowMapModal(false)}
                  className="w-full py-3 bg-[#941329] hover:bg-[#7D0E20] text-white font-bold text-xs rounded-2xl transition-all shadow-md cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
