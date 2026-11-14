import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { AlertItem } from '../types/index.js';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Car,
  Clock,
  Shield,
  HelpCircle,
  Flag,
  FileQuestion,
  X,
  ChevronRight,
  Check,
  EyeOff,
  Siren,
  Camera,
  Image as ImageIcon,
  MapPin,
} from 'lucide-react';

import { ProvincialPlate, detectProvinceFromPlate } from '../components/ProvincialPlate.js';

export function AlertsScreen() {
  const { alerts, takeAlertAction, refreshAlerts, theme } = useApp();

  const isDark = theme === 'dark';

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [actionType, setActionType] = useState<'resolve' | 'dispute' | 'flag_abuse' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'unread') return a.status === 'received' || a.status === 'needs_review';
    if (filter === 'read') return a.status === 'resolved' || a.status === 'dismissed';
    return true;
  });

  const getRelativeTime = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} d ago`;
  };

  const handleAction = async (type: 'resolve' | 'dismiss' | 'dispute' | 'flag_abuse') => {
    if (!selectedAlert) return;
    setIsSubmitting(true);
    await takeAlertAction(selectedAlert.id, type, actionNote);
    setIsSubmitting(false);
    setSelectedAlert(null);
    setActionType(null);
    setActionNote('');
  };

  return (
    <div className={`pb-28 pt-3 px-3 max-w-[420px] mx-auto ${isDark ? 'text-white' : 'text-gray-900'}`}>
      {/* Floating Main Alerts Card */}
      <div className={`glass-card rounded-[34px] p-6 crimson-card-shadow relative overflow-hidden transition-colors ${
        isDark ? 'bg-[#181A20] text-white border-white/10' : ''
      }`}>
        {/* Top Dark Capsule Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0D1829] text-white rounded-full text-[9px] font-black uppercase tracking-widest mb-4 shadow-sm border border-white/10">
          <span>VEHICLE OBSERVATIONS · ALERTS</span>
        </div>

        {/* Header */}
        <div className="mb-4">
          <h1 className={`text-2xl font-black font-display ${isDark ? 'text-white' : 'text-gray-950'}`}>
            Alerts & Observations
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            Observations reported by road users for your registered vehicles.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className={`flex items-center gap-1 p-1 rounded-2xl mb-4 border ${
          isDark ? 'bg-[#121317] border-white/10' : 'bg-gray-100 border-gray-200/60'
        }`}>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filter === 'all'
                ? (isDark ? 'bg-[#282B34] text-white shadow-xs border border-white/15' : 'bg-white text-gray-950 shadow-xs')
                : (isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900')
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filter === 'unread'
                ? (isDark ? 'bg-[#282B34] text-white shadow-xs border border-white/15' : 'bg-white text-gray-950 shadow-xs')
                : (isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900')
            }`}
          >
            Unread ({alerts.filter((a) => a.status === 'received' || a.status === 'needs_review').length})
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filter === 'read'
                ? (isDark ? 'bg-[#282B34] text-white shadow-xs border border-white/15' : 'bg-white text-gray-950 shadow-xs')
                : (isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900')
            }`}
          >
            Read ({alerts.filter((a) => a.status === 'resolved' || a.status === 'dismissed').length})
          </button>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className={`rounded-2xl p-8 text-center border shadow-xs mt-2 ${
            isDark ? 'bg-[#14161B] border-white/10 text-white' : 'bg-gray-50/80 border-gray-200/80 text-gray-950'
          }`}>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className={`text-base font-bold font-display ${isDark ? 'text-white' : 'text-gray-950'}`}>
              No alerts found
            </h2>
            <p className={`text-xs font-medium mt-1 max-w-xs mx-auto ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
              Everything is clear. When road users submit observations for your vehicles, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const photo = alert.photoUrl || (alert as any).photo_url;
              const getBadge = (cat: string) => {
                switch (cat) {
                  case 'vehicle_condition':
                    return {
                      bg: isDark ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40' : 'bg-red-100 text-[#941329] border border-red-200',
                      icon: <Car className="w-5 h-5 stroke-[2.2]" />,
                    };
                  case 'driver_behaviour':
                    return {
                      bg: isDark ? 'bg-blue-950/40 text-blue-300 border border-blue-800/40' : 'bg-blue-100 text-[#1e40af] border border-blue-200',
                      icon: (
                        <svg
                          className="w-5 h-5"
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
                      bg: isDark ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40' : 'bg-amber-100 text-[#b45309] border border-amber-200',
                      icon: (
                        <svg
                          className="w-5 h-5"
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
                      bg: isDark ? 'bg-red-950/50 text-red-300 border border-red-800/50' : 'bg-red-100 text-[#dc2626] border border-red-200',
                      icon: <Siren className="w-5 h-5 stroke-[2.2]" />,
                    };
                  default:
                    return {
                      bg: isDark ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40' : 'bg-red-100 text-[#941329] border border-red-200',
                      icon: <Car className="w-5 h-5 stroke-[2.2]" />,
                    };
                }
              };
              const badge = getBadge(alert.category);

              return (
                <div
                  key={alert.id}
                  onClick={() => {
                    setSelectedAlert(alert);
                    setActionType(null);
                    setActionNote('');
                  }}
                  className={`w-full p-4 rounded-2xl shadow-md border flex flex-col gap-3 text-left transition-all active:scale-[0.99] cursor-pointer group ${
                    isDark
                      ? 'bg-[#14161B] hover:bg-[#1B1D24] text-white border-white/10'
                      : 'bg-white hover:bg-gray-50/90 text-gray-950 border-gray-200/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full ${badge.bg} flex items-center justify-center shrink-0 shadow-xs`}>
                        {badge.icon}
                      </div>

                      <div className="min-w-0">
                        <h2 className={`text-sm font-black font-display truncate leading-tight ${
                          isDark ? 'text-white group-hover:text-rose-400' : 'text-gray-950 group-hover:text-[#941329]'
                        }`}>
                          {alert.issueTitle}
                        </h2>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="w-24 shrink-0 drop-shadow-xs">
                            <ProvincialPlate
                              provinceCode={detectProvinceFromPlate(alert.plateDisplay)}
                              plateText={alert.plateDisplay}
                            />
                          </div>
                          <span className={`text-[11px] font-bold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                            {getRelativeTime(alert.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.status === 'needs_review' && (
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs border ${
                          isDark ? 'text-amber-300 bg-amber-950/60 border-amber-800/50' : 'text-amber-900 bg-amber-100 border-amber-300'
                        }`}>
                          Review
                        </span>
                      )}
                      {alert.status === 'received' && (
                        <span className="text-[10px] font-black text-white bg-[#941329] px-2.5 py-0.5 rounded-full shadow-xs border border-red-500/30">
                          Unread
                        </span>
                      )}
                      {alert.status === 'resolved' && (
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs border ${
                          isDark ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800/50' : 'text-emerald-800 bg-emerald-100 border-emerald-300'
                        }`}>
                          Resolved
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlert(alert);
                          setActionType('resolve');
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer border ${
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

                  {alert.location && (
                    <span className={`inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      isDark
                        ? 'bg-[#1F2128] border-white/10 text-white/75'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}>
                      <MapPin className="w-3 h-3 text-[#941329] shrink-0" />
                      Incident area: {alert.location}
                    </span>
                  )}

                  {alert.customNote && (
                    <p className={`text-xs font-semibold px-3 py-2 rounded-xl italic border ${
                      isDark
                        ? 'bg-rose-950/30 text-rose-200 border-rose-900/40'
                        : 'bg-rose-50/60 text-gray-800 border-rose-100/90'
                    }`}>
                      "{alert.customNote}"
                    </p>
                  )}

                  {photo && (
                    <div className={`relative rounded-xl overflow-hidden border group/photo w-full mt-1 ${
                      isDark ? 'border-white/10 bg-black/40' : 'border-gray-200/90 bg-gray-900/5'
                    }`}>
                      <img
                        src={photo}
                        alt="Observation attachment preview"
                        className="w-full h-36 object-cover transition-transform duration-300 group-hover/photo:scale-[1.02]"
                      />
                      <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/80 rounded-lg text-[10px] font-extrabold text-white flex items-center gap-1.5 shadow-sm border border-white/20">
                        <Camera className="w-3.5 h-3.5 text-rose-400" /> Photo Attached
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FULL ALERT DETAIL MODAL */}
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
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between gap-2 mb-3">
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

            <h3 className={`text-xl font-black font-display ${isDark ? 'text-white' : 'text-gray-950'}`}>
              {selectedAlert.issueTitle}
            </h3>

            {/* Neutral Language Banner */}
            <div className={`mt-3 p-3 rounded-2xl text-xs leading-relaxed border ${
              isDark ? 'bg-amber-950/40 border-amber-900/50 text-amber-200' : 'bg-amber-50 border-amber-200/70 text-amber-900'
            }`}>
              <strong className="block mb-0.5 font-bold">Observation notice:</strong>
              "A road user reported a possible observation. Please check when safe."
            </div>

            {selectedAlert.location && (
              <div className={`mt-3 p-3 rounded-2xl text-xs border flex items-start gap-2 ${
                isDark ? 'bg-[#1F2128] border-white/10 text-white/90' : 'bg-gray-50 border-gray-200/80 text-gray-700'
              }`}>
                <MapPin className="w-4 h-4 text-[#941329] shrink-0 mt-0.5" />
                <span>
                  <span className={`font-semibold block mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Incident area:</span>
                  {selectedAlert.location}
                  <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                    Area level only — exact street detail is not shared.
                  </span>
                </span>
              </div>
            )}

            {selectedAlert.customNote && (
              <div className={`mt-3 p-3 rounded-2xl text-xs border ${
                isDark ? 'bg-[#1F2128] border-white/10 text-white/90' : 'bg-gray-50 border-gray-200/80 text-gray-700'
              }`}>
                <span className={`font-semibold block mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Note:</span>
                "{selectedAlert.customNote}"
              </div>
            )}

            {(() => {
              const modalPhoto = selectedAlert.photoUrl || (selectedAlert as any).photo_url;
              if (!modalPhoto) return null;
              return (
                <div className={`mt-3 rounded-2xl overflow-hidden border shadow-xs ${
                  isDark ? 'border-white/10 bg-black/40' : 'border-gray-200/90 bg-gray-900/5'
                }`}>
                  <div className="px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold tracking-wider uppercase flex items-center justify-between border-b border-white/10">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-rose-400" /> Reporter Attached Photo
                    </span>
                    <span className="text-gray-400 font-normal text-[9px]">Observation Media</span>
                  </div>
                  <div className="relative">
                    <img
                      src={modalPhoto}
                      alt="Observation attachment"
                      className="w-full max-h-64 object-cover"
                    />
                    <a
                      href={modalPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/75 hover:bg-black text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ImageIcon className="w-3 h-3" /> View Full
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* Recorded Delivery Status */}
            <div className={`mt-3 p-3 rounded-2xl text-xs flex items-start gap-2 border ${
              isDark ? 'bg-blue-950/40 border-blue-900/50 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-900'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Delivery recorded:</span>
                Delivered in-app to registered vehicle drivers.
              </div>
            </div>

            {/* Privacy rule notice */}
            <div className={`mt-2 p-3 rounded-2xl text-[11px] flex items-start gap-2 border ${
              isDark ? 'bg-[#1F2128] border-white/10 text-white/60' : 'bg-gray-50 border-gray-200/80 text-gray-500'
            }`}>
              <EyeOff className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
              <span>
                Reporter identity is hidden from you. Restricted security records are kept by Driver Ping to protect against abuse.
              </span>
            </div>

            {/* Existing status notes if resolved/disputed */}
            {selectedAlert.recipientActionNote && (
              <div className={`mt-3 p-2.5 rounded-2xl text-xs border ${
                isDark ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-200' : 'bg-emerald-50 border-emerald-100 text-emerald-900'
              }`}>
                <span className="font-bold">Your note: </span>
                {selectedAlert.recipientActionNote}
              </div>
            )}
            {selectedAlert.disputeReason && (
              <div className={`mt-3 p-2.5 rounded-2xl text-xs border ${
                isDark ? 'bg-purple-950/40 border-purple-900/50 text-purple-200' : 'bg-purple-50 border-purple-100 text-purple-900'
              }`}>
                <span className="font-bold">Dispute filed: </span>
                {selectedAlert.disputeReason}
              </div>
            )}

            {/* Action buttons */}
            {!actionType ? (
              <div className="mt-5 space-y-2">
                <button
                  onClick={() => handleAction('resolve')}
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Mark as Read</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActionType('dispute')}
                    className={`py-2.5 px-3 border font-semibold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isDark
                        ? 'border-white/15 text-white/80 hover:bg-[#282B34]'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <FileQuestion className="w-3.5 h-3.5" />
                    <span>Dispute</span>
                  </button>
                  <button
                    onClick={() => setActionType('flag_abuse')}
                    className={`py-2.5 px-3 border font-semibold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isDark
                        ? 'border-rose-900/50 text-rose-400 hover:bg-rose-950/40'
                        : 'border-red-200 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Flag Abuse</span>
                  </button>
                </div>

                <button
                  onClick={() => handleAction('dismiss')}
                  disabled={isSubmitting}
                  className={`w-full py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                    isDark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  Dismiss / Acknowledge
                </button>
              </div>
            ) : (
              <div className={`mt-4 pt-3 border-t space-y-3 ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {actionType === 'dispute'
                    ? 'Reason for disputing this observation:'
                    : 'Explain why you are flagging this report as abuse/harassment:'}
                </div>
                <textarea
                  rows={2}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={
                    actionType === 'dispute'
                      ? 'e.g. Observation is factually incorrect...'
                      : 'e.g. Repeated targeting or malicious falsehood...'
                  }
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
                    onClick={() => handleAction(actionType)}
                    disabled={isSubmitting || !actionNote.trim()}
                    className={`w-2/3 py-2 text-xs font-semibold text-white rounded-2xl cursor-pointer ${
                      actionType === 'dispute' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-red-600 hover:bg-red-700'
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
    </div>
  );
}
