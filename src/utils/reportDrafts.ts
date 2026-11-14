import { ReportCategory } from '../types/index.js';

/**
 * Saved report drafts.
 *
 * Every report attempt is kept here until it is either sent or deleted, so an
 * abandoned report never blocks a new one: pressing Report always starts from
 * a blank step 1 and the previous attempt waits in the drafts list.
 */
export interface ReportDraft {
  id: string;
  step: 1 | 2 | 3;
  provinceCode: string;
  plateNumber: string;
  plate: string;
  category: ReportCategory;
  issueCode: string;
  customOtherText: string;
  customNote: string;
  incidentArea: string;
  photo: string | null;
  updatedAt: number;
}

const STORAGE_KEY = 'driver_ping_report_drafts_v1';
const MAX_DRAFTS = 20;

export const createDraftId = () =>
  `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function isValidDraft(value: unknown): value is ReportDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as ReportDraft;
  return typeof draft.id === 'string' && typeof draft.updatedAt === 'number';
}

function persist(drafts: ReportDraft[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Photo data urls can blow the storage quota: keep the drafts, drop the photos.
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(drafts.map((draft) => ({ ...draft, photo: null })))
      );
    } catch {
      // Storage unavailable: drafts simply stay in memory for this session.
    }
  }
}

export function loadDrafts(): ReportDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidDraft)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function upsertDraft(draft: ReportDraft): void {
  const others = loadDrafts().filter((item) => item.id !== draft.id);
  persist([draft, ...others].slice(0, MAX_DRAFTS));
}

export function deleteDraft(id: string): void {
  persist(loadDrafts().filter((draft) => draft.id !== id));
}

export function draftHasProgress(draft: ReportDraft): boolean {
  return Boolean(
    draft.plateNumber.trim() ||
      draft.plate.trim() ||
      draft.issueCode.trim() ||
      draft.customNote.trim() ||
      draft.incidentArea.trim() ||
      draft.customOtherText.trim() ||
      draft.photo
  );
}

// Draft queued from the drafts list; the report screen picks it up when it opens.
let pendingResumeDraft: ReportDraft | null = null;

export function queueDraftResume(draft: ReportDraft): void {
  pendingResumeDraft = draft;
}

export function takePendingResumeDraft(): ReportDraft | null {
  const draft = pendingResumeDraft;
  pendingResumeDraft = null;
  return draft;
}
