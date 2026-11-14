import React, { useEffect, useState } from 'react';
import { FileText, Trash2, ArrowRight, X } from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import {
  ReportDraft,
  deleteDraft,
  loadDrafts,
  queueDraftResume,
} from '../utils/reportDrafts.js';

interface DraftsModalProps {
  open: boolean;
  onClose: () => void;
  onChange?: () => void;
}

export function DraftsModal({ open, onClose, onChange }: DraftsModalProps) {
  const { setActiveTab } = useApp();
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);

  useEffect(() => {
    if (open) setDrafts(loadDrafts());
  }, [open]);

  if (!open) return null;

  const refresh = () => {
    setDrafts(loadDrafts());
    onChange?.();
  };

  const handleResume = (draft: ReportDraft) => {
    queueDraftResume(draft);
    setActiveTab('report');
    onClose();
  };

  const handleDelete = (draftId: string) => {
    deleteDraft(draftId);
    refresh();
  };

  const relativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} d ago`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drafts-title"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/70 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white text-gray-950 rounded-[28px] border border-gray-200 shadow-2xl max-h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#941329] flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <h2 id="drafts-title" className="text-sm font-black font-display leading-tight">
                Saved drafts
              </h2>
              <p className="text-[10px] text-gray-500 font-medium">
                {drafts.length === 0
                  ? 'Reports you leave unfinished appear here'
                  : `${drafts.length} unfinished report${drafts.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drafts"
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-3 py-3 space-y-2">
          {drafts.length === 0 && (
            <div className="text-center px-4 py-8">
              <FileText className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700">No saved drafts</p>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                Start a report and leave it at any step — it is kept here so you can pick it up later.
              </p>
            </div>
          )}

          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="w-full p-3 rounded-2xl border border-gray-200 bg-gray-50/70 flex items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#941329] bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full shrink-0">
                    Step {draft.step}/3
                  </span>
                  <span className="text-[10px] font-semibold text-gray-400 truncate">
                    {relativeTime(draft.updatedAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-black font-mono tracking-wider uppercase text-gray-900 truncate">
                  {draft.plate || draft.plateNumber || 'No plate yet'}
                </p>
                {draft.incidentArea && (
                  <p className="text-[10px] font-semibold text-gray-500 truncate">
                    Area: {draft.incidentArea}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleResume(draft)}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-[#941329] hover:bg-[#7a0f21] text-white text-[11px] font-bold transition-colors cursor-pointer"
                  aria-label={`Resume draft ${draft.plate || 'without a plate'}`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(draft.id)}
                  className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                  aria-label="Delete draft"
                  title="Delete draft"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
