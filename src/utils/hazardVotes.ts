export type HazardAnalysisStatus = 'unsolved' | 'false_report' | 'being_solved';

export interface HazardVoteSelection {
  unsolved: boolean;
  false_report: boolean;
  being_solved: boolean;
}

export const EMPTY_HAZARD_VOTE: HazardVoteSelection = {
  unsolved: false,
  false_report: false,
  being_solved: false,
};

const VOTES_STORAGE_KEY = 'dp_hazard_votes_v2';
const LEGACY_VOTES_STORAGE_KEY = 'dp_hazard_votes_v1';
const VOTER_ID_STORAGE_KEY = 'dp_hazard_voter_id_v1';

export function getClientVoterId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let existing = window.localStorage.getItem(VOTER_ID_STORAGE_KEY);
    if (!existing) {
      existing = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(VOTER_ID_STORAGE_KEY, existing);
    }
    return existing;
  } catch {
    return 'browser_session';
  }
}

function normalizeSelection(val: any): HazardVoteSelection {
  if (typeof val === 'string') {
    return {
      unsolved: val === 'unsolved',
      false_report: val === 'false_report',
      being_solved: val === 'being_solved',
    };
  }
  if (val && typeof val === 'object') {
    return {
      unsolved: Boolean(val.unsolved),
      false_report: Boolean(val.false_report),
      being_solved: Boolean(val.being_solved),
    };
  }
  return { ...EMPTY_HAZARD_VOTE };
}

export function getStoredHazardVotes(): Record<string, HazardVoteSelection> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(VOTES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const result: Record<string, HazardVoteSelection> = {};
        for (const [k, v] of Object.entries(parsed)) {
          result[k] = normalizeSelection(v);
        }
        return result;
      }
    }
    const legacyRaw = window.localStorage.getItem(LEGACY_VOTES_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (legacyParsed && typeof legacyParsed === 'object') {
        const migrated: Record<string, HazardVoteSelection> = {};
        for (const [k, v] of Object.entries(legacyParsed)) {
          migrated[k] = normalizeSelection(v);
        }
        window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
}

export function saveStoredHazardVote(
  hazardId: string,
  selection: HazardVoteSelection
): Record<string, HazardVoteSelection> {
  const current = getStoredHazardVotes();
  const next = { ...current, [hazardId]: normalizeSelection(selection) };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function replaceAllStoredHazardVotes(
  votes: Record<string, HazardVoteSelection>
): Record<string, HazardVoteSelection> {
  const normalized: Record<string, HazardVoteSelection> = {};
  for (const [k, v] of Object.entries(votes || {})) {
    normalized[k] = normalizeSelection(v);
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota errors
    }
  }
  return normalized;
}
