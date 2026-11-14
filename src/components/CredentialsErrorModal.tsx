import React from 'react';
import { AlertCircle, X, ArrowRight, UserPlus, Lock } from 'lucide-react';

interface CredentialsErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailEntered?: string;
  errorMessage?: string | null;
  onSwitchToSignUp?: () => void;
}

export function CredentialsErrorModal({
  isOpen,
  onClose,
  emailEntered,
  errorMessage,
  onSwitchToSignUp,
}: CredentialsErrorModalProps) {
  if (!isOpen) return null;

  const isNotFound = errorMessage?.toLowerCase().includes('no account') || errorMessage?.toLowerCase().includes('not found');
  const isWrongPassword = errorMessage?.toLowerCase().includes('password');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in">
      <div className="glass-modal text-gray-950 rounded-[32px] max-w-sm w-full p-6 shadow-2xl relative border border-red-300/80 space-y-4 animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 rounded-full transition-colors cursor-pointer"
          aria-label="Close error notice"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#941329] flex items-center justify-center shrink-0 border border-red-200/80 shadow-xs">
            {isWrongPassword ? (
              <Lock className="w-6 h-6 text-[#941329]" />
            ) : (
              <AlertCircle className="w-6 h-6 text-[#941329]" />
            )}
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-gray-950 font-display leading-tight">
              {isNotFound ? 'Account Not Found' : isWrongPassword ? 'Incorrect Password' : 'Login Credentials Error'}
            </h3>
            <p className="text-[11px] text-red-600 font-bold uppercase tracking-wider mt-0.5">
              Authentication Notice
            </p>
          </div>
        </div>

        {/* Dynamic Detail Box */}
        <div className="p-3.5 bg-red-50/80 border border-red-200/70 rounded-2xl text-xs text-red-950 font-medium leading-relaxed">
          {errorMessage || 'The credentials you entered do not match any registered account in Driver Ping.'}
        </div>

        {emailEntered && (
          <div className="p-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-[11px] text-gray-600 font-mono text-center truncate">
            Target email: <span className="font-bold text-gray-900">{emailEntered}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-950 hover:bg-black text-white font-bold text-xs rounded-2xl transition-all shadow-sm cursor-pointer"
          >
            Try Again
          </button>

          {onSwitchToSignUp && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToSignUp();
              }}
              className="w-full py-3 px-4 bg-[#941329] hover:bg-[#7a0f21] text-white font-bold text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
