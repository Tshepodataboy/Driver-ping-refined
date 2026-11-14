import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext.js';
import { Bell, FileText } from 'lucide-react';
import { DraftsModal } from './DraftsModal.js';
import { loadDrafts } from '../utils/reportDrafts.js';

export function Header() {
  const {
    activeTab,
    previousTab,
    unreadAlertsCount,
    setActiveTab,
  } = useApp();

  const [draftsOpen, setDraftsOpen] = useState(false);
  const [draftCount, setDraftCount] = useState<number>(() => loadDrafts().length);

  // Keep the drafts badge in sync with navigation and the drafts panel.
  useEffect(() => {
    setDraftCount(loadDrafts().length);
  }, [activeTab, draftsOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full shrink-0 bg-[#941329]/90 border-b border-white/10 text-white transition-colors">
        <div className="max-w-[420px] mx-auto px-4 h-14 flex items-center justify-between">
          {/* Brand Zone */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveTab('home');
            }}
            className="flex items-center gap-2 text-left group focus:outline-none cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-white border border-white/90 flex items-center justify-center shadow-md transition-transform group-hover:scale-105 p-1">
              <img
                src="https://res.cloudinary.com/dwd83begj/image/upload/v1792686945/logo_icon-removebg-preview_e6k6ne.png"
                alt="Driver Ping Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base tracking-tight font-display text-white uppercase leading-none">
                Driver Ping
              </span>
              <span className="text-[9px] text-white/60 tracking-wider font-semibold uppercase">
                South Africa · RSA
              </span>
            </div>
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Saved report drafts (icon only) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraftsOpen(true);
              }}
              className="relative p-2 rounded-full transition-all focus:outline-none border cursor-pointer bg-white/15 hover:bg-white/25 text-white border-white/15 flex items-center justify-center active:scale-95"
              title="Saved report drafts"
              aria-label={`Saved report drafts${draftCount > 0 ? ` (${draftCount})` : ''}`}
            >
              <FileText className="w-4 h-4" />
              {draftCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-white text-[#941329] rounded-full text-[9px] font-black flex items-center justify-center shadow-md border border-[#941329]">
                  {draftCount > 9 ? '9+' : draftCount}
                </span>
              )}
            </button>

            {/* Alerts Bell (Alerts on Header only) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (activeTab === 'alerts') {
                  setActiveTab(previousTab === 'alerts' ? 'home' : previousTab || 'home');
                } else {
                  setActiveTab('alerts');
                }
              }}
              className={`relative p-2 rounded-full transition-all focus:outline-none border cursor-pointer ${
                activeTab === 'alerts'
                  ? 'bg-white text-[#941329] border-white shadow-md'
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/15'
              }`}
              title={activeTab === 'alerts' ? 'Back' : 'Alerts - Notifications and reports'}
              aria-label={activeTab === 'alerts' ? 'Back' : 'View alerts'}
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-white text-[#941329] rounded-full text-[9px] font-black flex items-center justify-center shadow-md border border-[#941329] animate-pulse">
                  {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {draftsOpen &&
        createPortal(
          <DraftsModal
            open={draftsOpen}
            onClose={() => setDraftsOpen(false)}
            onChange={() => setDraftCount(loadDrafts().length)}
          />,
          document.body
        )}
    </>
  );
}
