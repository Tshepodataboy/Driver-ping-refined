/**
 * Driver Ping - South African plate scan normalization
 * Turns raw Gemini ALPR output into a stable two-stage result:
 *   1. province mark + plate type
 *   2. unique registration number (province mark removed)
 */

export interface RawPlateScan {
  plateVisible?: boolean;
  rawOcrText?: string;
  provinceCode?: string;
  plateType?: string;
  uniqueRegistrationNumber?: string;
  fullPlate?: string;
  observedCondition?: string;
  confidence?: number;
}

export interface NormalizedPlateScan {
  plateVisible: boolean;
  provinceCode: string | null;
  provinceName: string | null;
  provinceMark: string | null;
  plateType: string;
  plateTypeLabel: string;
  uniqueRegistrationNumber: string;
  fullPlate: string;
  rawOcrText: string;
  observedCondition: string;
  confidence: number | null;
}

export const SA_PLATE_PROVINCES: Record<
  string,
  { name: string; mark: string; position: 'prefix' | 'suffix'; ocrMarks: string[] }
> = {
  GP: { name: 'Gauteng', mark: 'GP', position: 'suffix', ocrMarks: ['GP'] },
  WC: { name: 'Western Cape', mark: 'CA', position: 'prefix', ocrMarks: ['CA', 'CAA', 'CAB', 'CAC', 'CAD', 'CY', 'WC'] },
  KZN: { name: 'KwaZulu-Natal', mark: 'ND', position: 'prefix', ocrMarks: ['ND', 'NP', 'NU', 'NT', 'NUR', 'ZN', 'KZN'] },
  EC: { name: 'Eastern Cape', mark: 'EC', position: 'suffix', ocrMarks: ['EC', 'CB', 'CBB'] },
  FS: { name: 'Free State', mark: 'FS', position: 'suffix', ocrMarks: ['FS'] },
  MP: { name: 'Mpumalanga', mark: 'MP', position: 'suffix', ocrMarks: ['MP'] },
  LP: { name: 'Limpopo', mark: 'L', position: 'suffix', ocrMarks: ['L', 'LP'] },
  NW: { name: 'North West', mark: 'NW', position: 'suffix', ocrMarks: ['NW'] },
  NC: { name: 'Northern Cape', mark: 'NC', position: 'suffix', ocrMarks: ['NC'] },
};

export const PLATE_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard private plate',
  personalised: 'Personalised plate',
  government: 'Government plate',
  diplomatic: 'Diplomatic plate',
  dealer: 'Dealer / trade plate',
  unknown: 'Unclassified plate',
};

export function normalizeScanProvince(rawProvince?: string): string | null {
  const compact = (rawProvince || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!compact) return null;
  if (compact === 'KZN' || compact === 'ZN') return 'KZN';
  if (compact === 'CA' || compact === 'WC') return 'WC';
  if (compact === 'LP' || compact === 'L') return 'LP';

  const direct = Object.keys(SA_PLATE_PROVINCES).find((code) => code === compact);
  if (direct) return direct;

  const byName = Object.entries(SA_PLATE_PROVINCES).find(
    ([, meta]) => meta.name.toUpperCase().replace(/[^A-Z]/g, '') === compact
  );
  if (byName) return byName[0];

  const byOcrMark = Object.entries(SA_PLATE_PROVINCES).find(([, meta]) => meta.ocrMarks.includes(compact));
  return byOcrMark ? byOcrMark[0] : null;
}

export function cleanPlateText(raw?: string): string {
  return (raw || '')
    .toUpperCase()
    .replace(/\|/g, 'I')
    .replace(/[^A-Z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripProvinceMark(registration: string, provinceCode: string | null): string {
  if (!provinceCode || !registration) return registration;
  const meta = SA_PLATE_PROVINCES[provinceCode];
  if (!meta) return registration;

  const tokens = registration.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return registration;

  const isMark = (token: string) => meta.ocrMarks.includes(token) || token === meta.mark;

  if (meta.position === 'prefix') {
    // Western Cape / KwaZulu-Natal print the mark first (CA 812-482, ND 913-317).
    if (isMark(tokens[0])) tokens.shift();
    const tail = tokens[tokens.length - 1];
    if (tokens.length > 1 && (tail === 'WC' || tail === 'ZN' || tail === 'KZN')) tokens.pop();
  } else if (isMark(tokens[tokens.length - 1])) {
    // GP, EC, FS, MP, LP, NW and NC append the mark (CF 10 VD GP, BKS 214 L).
    tokens.pop();
  }

  return tokens.join(' ');
}

export function normalizePlateScanResult(result: RawPlateScan): NormalizedPlateScan {
  // Stage 1 - province mark and plate type.
  const provinceCode = normalizeScanProvince(result.provinceCode);
  const provinceMeta = provinceCode ? SA_PLATE_PROVINCES[provinceCode] : null;
  const rawPlateType = String(result.plateType || '').toLowerCase().trim();
  const plateType = PLATE_TYPE_LABELS[rawPlateType] ? rawPlateType : 'unknown';

  // Stage 2 - unique registration characters only.
  const rawOcrText = cleanPlateText(result.rawOcrText);
  const fullPlate = cleanPlateText(result.fullPlate) || rawOcrText;
  const uniqueRegistrationNumber = stripProvinceMark(
    cleanPlateText(result.uniqueRegistrationNumber) || fullPlate,
    provinceCode
  );

  return {
    plateVisible: result.plateVisible !== false,
    provinceCode,
    provinceName: provinceMeta?.name || null,
    provinceMark: provinceMeta?.mark || null,
    plateType,
    plateTypeLabel: PLATE_TYPE_LABELS[plateType],
    uniqueRegistrationNumber,
    fullPlate: fullPlate || uniqueRegistrationNumber,
    rawOcrText,
    observedCondition: String(result.observedCondition || '').trim(),
    confidence: typeof result.confidence === 'number' ? result.confidence : null,
  };
}
