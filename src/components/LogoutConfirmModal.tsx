import React from 'react';
import { useApp } from '../context/AppContext.js';
import { LogOut, X, AlertTriangle } from 'lucide-react';

export function LogoutConfirmModal() {
  const { isLogoutConfirmOpen, cancelSignOut, confirmSignOut, user } = useApp();

  if (!isLogoutConfirmOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      <div className="glass-modal text-gray-950 rounded-[32px] w-full max-w-[360px] p-6 shadow-2xl relative border border-white/80 animate-in zoom-in-95 duration-200 text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={cancelSignOut}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-[#941329] border border-rose-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <LogOut className="w-7 h-7 stroke-[2.2]" />
        </div>

        {/* Title & Body */}
        <h3 id="logout-title" className="text-lg font-black font-display text-gray-950 tracking-tight">
          Log Out of Driver Ping?
        </h3>
        <p className="text-xs text-gray-600 mt-2 leading-relaxed px-2">
          Are you sure you want to end your session
          {user?.fullName ? (
            <>
              {' '}for <strong className="text-gray-900 font-bold">{user.fullName}</strong>
            </>
          ) : null}
          ? You will need your credentials to log back in.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={cancelSignOut}
            className="py-3 px-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-colors cursor-pointer active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmSignOut}
            className="py-3 px-4 rounded-2xl bg-[#941329] hover:bg-[#7a0f21] text-white font-bold text-xs transition-all shadow-md shadow-red-950/20 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Yes, Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
