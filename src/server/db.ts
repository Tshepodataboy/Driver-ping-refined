/**
 * Driver Ping - Database Layer
 * Supabase PostgreSQL client with automatic schema bootstrap and demo seed data.
 * Falls back to an in-memory store if DATABASE_URL is not yet configured.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DbUser {
  id: string;
  phone: string;
  fullName: string;
  role: 'user' | 'admin';
  plan: 'free' | 'paid_owner';
  smsOptIn: boolean;
  smsMonthlyCapPence: number;
  smsCurrentSpendPence: number;
  defaultPlate?: string;
  defaultProvinceCode?: string;
  homeProvince?: string;
  homeCity?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbOtp {
  id: string;
  phone: string;
  code: string;
  expiresAt: string;
  verified: boolean;
  createdAt: string;
}

export interface DbVehicle {
  id: string;
  plateNormalized: string;
  plateDisplay: string;
  make: string;
  model: string;
  color: string;
  verifiedOwnerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbVehicleDriver {
  id: string;
  vehicleId: string;
  userId: string;
  role: 'driver' | 'owner';
  status: 'approved' | 'pending_owner_approval' | 'rejected';
  requestedAt: string;
  approvedAt: string | null;
}

export interface DbTrustedContact {
  id: string;
  vehicleId: string;
  name: string;
  phone: string;
  relationship: string;
  consentGiven: boolean;
  createdAt: string;
}

export interface DbOwnershipVerification {
  id: string;
  vehicleId: string;
  userId: string;
  documentName: string;
  documentType: string;
  documentUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedById: string | null;
}

export interface DbReport {
  id: string;
  idempotencyKey?: string;
  plateNormalized: string;
  category: 'vehicle_condition' | 'driver_behaviour' | 'road_violation';
  issueCode: string;
  issueTitle: string;
  customNote?: string;
  location?: string; // Area-level only (e.g. "Pretoria CBD"), never the street
  photoUrl?: string;
  reporterId: string; // Strictly confidential; never returned in vehicle alert feeds
  status: 'received' | 'needs_review' | 'resolved' | 'disputed' | 'flagged_abuse' | 'dismissed';
  disputeReason?: string;
  abuseReason?: string;
  recipientActionNote?: string;
  createdAt: string;
}

export interface DbDeliveryLog {
  id: string;
  reportId: string;
  channel: 'in_app' | 'sms';
  recipientUserId: string | null;
  status: 'delivered' | 'queued_unclaimed' | 'failed' | 'capped_limit';
  costPence: number;
  createdAt: string;
}

export interface DbAuditLog {
  id: string;
  actorId: string | null;
  actionType: string;
  targetId: string | null;
  targetType: string;
  detailsJson: Record<string, any>;
  createdAt: string;
}

export interface DbSystemConfig {
  keyName: string;
  keyValue: string;
  category: string;
  description: string;
  updatedAt: string;
}

export interface DbMapHazard {
  id: string;
  kind: 'pothole' | 'accident' | 'traffic' | 'alert';
  title: string;
  description: string;
  area: string;
  province: string;
  lat: number;
  lon: number;
  severity: 'low' | 'medium' | 'high';
  confirmations: number;
  falseReportCount: number;
  beingSolvedCount: number;
  isUserPinned?: boolean;
  createdAt: string;
}

const SEED_MAP_HAZARDS: DbMapHazard[] = [
  {
    id: 'hz_gp_n1_allandale',
    kind: 'traffic',
    title: 'N1 Northbound Bottleneck',
    description: 'Heavy lane merge congestion approaching Allandale offramp.',
    area: 'Midrand / Allandale, GP',
    province: 'GP',
    lat: -25.9992,
    lon: 28.1173,
    severity: 'high',
    confirmations: 14,
    falseReportCount: 1,
    beingSolvedCount: 3,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: 'hz_gp_m1_grayston',
    kind: 'pothole',
    title: 'Deep Shoulder Pothole',
    description: 'Left lane surface break near Grayston Drive offramp — stay right.',
    area: 'Sandton / M1, GP',
    province: 'GP',
    lat: -26.0987,
    lon: 28.0672,
    severity: 'medium',
    confirmations: 9,
    falseReportCount: 0,
    beingSolvedCount: 2,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 52 * 60000).toISOString(),
  },
  {
    id: 'hz_gp_n12_gilloolys',
    kind: 'accident',
    title: 'Multi-Vehicle Fender Bender',
    description: 'Two lanes obstructed on N12 Westbound approaching Gilloolys interchange.',
    area: 'Bedfordview, GP',
    province: 'GP',
    lat: -26.1705,
    lon: 28.1445,
    severity: 'high',
    confirmations: 21,
    falseReportCount: 1,
    beingSolvedCount: 6,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 9 * 60000).toISOString(),
  },
  {
    id: 'hz_wc_n1_century',
    kind: 'traffic',
    title: 'Inbound Cape Town Queue',
    description: 'Slow moving traffic past Sable Square towards CBD.',
    area: 'Century City / N1, WC',
    province: 'WC',
    lat: -33.8926,
    lon: 18.5084,
    severity: 'medium',
    confirmations: 11,
    falseReportCount: 1,
    beingSolvedCount: 2,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 27 * 60000).toISOString(),
  },
  {
    id: 'hz_wc_m3_hospital',
    kind: 'pothole',
    title: 'Road Surface Subsidence',
    description: 'Uneven tar patch near Hospital Bend merge.',
    area: 'Observatory / M3, WC',
    province: 'WC',
    lat: -33.9438,
    lon: 18.4648,
    severity: 'low',
    confirmations: 6,
    falseReportCount: 0,
    beingSolvedCount: 1,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 85 * 60000).toISOString(),
  },
  {
    id: 'hz_kzn_n3_spaghetti',
    kind: 'accident',
    title: 'Truck Breakdown & Lane Closure',
    description: 'Heavy freight stationary on N3 Eastbound near EB Cloete interchange.',
    area: 'Westville / N3, KZN',
    province: 'KZN',
    lat: -29.8321,
    lon: 30.9317,
    severity: 'high',
    confirmations: 16,
    falseReportCount: 0,
    beingSolvedCount: 5,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 14 * 60000).toISOString(),
  },
  {
    id: 'hz_kzn_m4_umhlanga',
    kind: 'pothole',
    title: 'Coastal Erosion Pothole',
    description: 'Outer left lane caution heading north past La Lucia.',
    area: 'Umhlanga / M4, KZN',
    province: 'KZN',
    lat: -29.7495,
    lon: 31.0695,
    severity: 'medium',
    confirmations: 5,
    falseReportCount: 1,
    beingSolvedCount: 1,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 110 * 60000).toISOString(),
  },
  {
    id: 'hz_ec_n2_gq',
    kind: 'traffic',
    title: 'Settlers Way Delays',
    description: 'Peak congestion between Mount Road and Walmer Boulevard.',
    area: 'Gqeberha / N2, EC',
    province: 'EC',
    lat: -33.9583,
    lon: 25.6054,
    severity: 'medium',
    confirmations: 7,
    falseReportCount: 0,
    beingSolvedCount: 2,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 40 * 60000).toISOString(),
  },
  {
    id: 'hz_fs_n1_bloem',
    kind: 'pothole',
    title: 'N1 Toll Approach Potholes',
    description: 'Series of potholes in slow lane 4 km south of Bloemfontein.',
    area: 'Bloemfontein / N1, FS',
    province: 'FS',
    lat: -29.1381,
    lon: 26.1852,
    severity: 'medium',
    confirmations: 4,
    falseReportCount: 0,
    beingSolvedCount: 1,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 95 * 60000).toISOString(),
  },
  {
    id: 'hz_mp_n4_mbombela',
    kind: 'traffic',
    title: 'Schoemanskloof Stop/Go',
    description: 'Scheduled roadwork convoy alternating single-lane passage.',
    area: 'Mbombela / N4, MP',
    province: 'MP',
    lat: -25.4393,
    lon: 30.6789,
    severity: 'medium',
    confirmations: 8,
    falseReportCount: 0,
    beingSolvedCount: 4,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 64 * 60000).toISOString(),
  },
  {
    id: 'hz_lp_n1_polokwane',
    kind: 'pothole',
    title: 'R101 / N1 Bypass Pothole',
    description: 'Sharp edge pothole near Polokwane southern bypass junction.',
    area: 'Polokwane, LP',
    province: 'LP',
    lat: -23.9242,
    lon: 29.4426,
    severity: 'medium',
    confirmations: 5,
    falseReportCount: 1,
    beingSolvedCount: 0,
    isUserPinned: false,
    createdAt: new Date(Date.now() - 75 * 60000).toISOString(),
  },
];

// Initial Seed Data for Demo & Supabase Bootstrapping
const SEED_USERS: DbUser[] = [
  {
    id: 'usr_alex_001',
    phone: '+27 82 555 0123',
    fullName: 'Alex Morgan',
    role: 'user',
    plan: 'paid_owner',
    smsOptIn: true,
    smsMonthlyCapPence: 500,
    smsCurrentSpendPence: 20,
    defaultPlate: 'CK 45 DF GP',
    defaultProvinceCode: 'GP',
    homeProvince: 'GP',
    homeCity: 'Johannesburg',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr_jordan_002',
    phone: '+27 83 555 0456',
    fullName: 'Jordan Lee',
    role: 'user',
    plan: 'free',
    smsOptIn: false,
    smsMonthlyCapPence: 500,
    smsCurrentSpendPence: 0,
    defaultPlate: 'ND 913-317 ZN',
    defaultProvinceCode: 'KZN',
    homeProvince: 'ZN',
    homeCity: 'Durban',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr_admin_003',
    phone: '+27 84 555 0999',
    fullName: 'Compliance Admin',
    role: 'admin',
    plan: 'paid_owner',
    smsOptIn: false,
    smsMonthlyCapPence: 1000,
    smsCurrentSpendPence: 0,
    defaultPlate: '',
    defaultProvinceCode: 'WC',
    homeProvince: 'WC',
    homeCity: 'Cape Town',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SEED_VEHICLES: DbVehicle[] = [
  {
    id: 'veh_ford_001',
    plateNormalized: 'CK45DFGP',
    plateDisplay: 'CK 45 DF GP',
    make: 'Ford',
    model: 'Puma EcoBoost',
    color: 'Solar Silver',
    verifiedOwnerId: 'usr_alex_001',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'veh_leaf_002',
    plateNormalized: 'ND913317ZN',
    plateDisplay: 'ND 913-317 ZN',
    make: 'Nissan',
    model: 'Leaf Electric',
    color: 'Pearl White',
    verifiedOwnerId: null,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'veh_golf_003',
    plateNormalized: 'CA812482WC',
    plateDisplay: 'CA 812-482 WC',
    make: 'Volkswagen',
    model: 'Golf TSI',
    color: 'Deep Blue',
    verifiedOwnerId: null,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SEED_VEHICLE_DRIVERS: DbVehicleDriver[] = [
  {
    id: 'vd_001',
    vehicleId: 'veh_ford_001',
    userId: 'usr_alex_001',
    role: 'owner',
    status: 'approved',
    requestedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'vd_002',
    vehicleId: 'veh_leaf_002',
    userId: 'usr_jordan_002',
    role: 'driver',
    status: 'approved',
    requestedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

const SEED_TRUSTED_CONTACTS: DbTrustedContact[] = [
  {
    id: 'tc_001',
    vehicleId: 'veh_ford_001',
    name: 'Sarah Morgan',
    phone: '+27 82 555 0321',
    relationship: 'Spouse / Secondary Driver',
    consentGiven: true,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

const SEED_OWNERSHIP_VERIFICATIONS: DbOwnershipVerification[] = [
  {
    id: 'verif_001',
    vehicleId: 'veh_leaf_002',
    userId: 'usr_jordan_002',
    documentName: 'V5C_Logbook_Scan_ND913317ZN.pdf',
    documentType: 'v5c_logbook',
    documentUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
    status: 'pending',
    adminNotes: null,
    submittedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    reviewedAt: null,
    reviewedById: null,
  },
];

const SEED_REPORTS: DbReport[] = [
  {
    id: 'rep_001',
    idempotencyKey: 'idemp_seed_001',
    plateNormalized: 'CK45DFGP',
    category: 'vehicle_condition',
    issueCode: 'brake_light_out',
    issueTitle: 'Brake light reported',
    customNote: 'Driver side rear brake light does not illuminate when braking at Sandton junction.',
    photoUrl: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80',
    reporterId: 'usr_jordan_002', // Stored strictly for security audit; scrubbed from alerts
    status: 'needs_review',
    createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: 'rep_002',
    idempotencyKey: 'idemp_seed_002',
    plateNormalized: 'CK45DFGP',
    category: 'driver_behaviour',
    issueCode: 'unsafe_lane_change',
    issueTitle: 'Unsafe lane change reported',
    customNote: 'Switched into middle lane without indicating on the N1 highway interchange near Midrand.',
    photoUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80',
    reporterId: 'usr_admin_003',
    status: 'received',
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
  },
  {
    id: 'rep_003',
    idempotencyKey: 'idemp_seed_003',
    plateNormalized: 'ND913317ZN',
    category: 'vehicle_condition',
    issueCode: 'tyre_low',
    issueTitle: 'Low tyre pressure noticed',
    customNote: 'Front left passenger tyre looked noticeably underinflated while parked at Umhlanga Rocks.',
    photoUrl: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=800&q=80',
    reporterId: 'usr_alex_001',
    status: 'resolved',
    recipientActionNote: 'Checked at local petrol station, re-inflated from 22 PSI to 34 PSI. Thank you!',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'rep_004',
    idempotencyKey: 'idemp_seed_004',
    plateNormalized: 'CK45DFGP',
    category: 'vehicle_condition',
    issueCode: 'fuel_cap_open',
    issueTitle: 'Fuel cap flap open',
    customNote: 'Fuel filler flap was flapping open while driving along William Nicol Drive in Bryanston.',
    photoUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&q=80',
    reporterId: 'usr_jordan_002',
    status: 'resolved',
    recipientActionNote: 'Pulled over safely at next petrol station and closed fuel flap securely.',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'rep_005',
    idempotencyKey: 'idemp_seed_005',
    plateNormalized: 'CA812482WC',
    category: 'road_violation',
    issueCode: 'red_light_run',
    issueTitle: 'Red robot violation',
    customNote: 'Vehicle drove through red traffic light at Sea Point junction during morning rush hour.',
    photoUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80',
    reporterId: 'usr_alex_001',
    status: 'received',
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: 'rep_006',
    idempotencyKey: 'idemp_seed_006',
    plateNormalized: 'ND913317ZN',
    category: 'driver_behaviour',
    issueCode: 'tailgating',
    issueTitle: 'Tailgating closely in rain',
    customNote: 'Following dangerously close behind heavy truck in heavy rain along N3 Durban inbound.',
    photoUrl: '',
    reporterId: 'usr_admin_003',
    status: 'needs_review',
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
  {
    id: 'rep_007',
    idempotencyKey: 'idemp_seed_007',
    plateNormalized: 'CK45DFGP',
    category: 'vehicle_condition',
    issueCode: 'headlight_out',
    issueTitle: 'Front headlight bulb blown',
    customNote: 'Left passenger front headlight bulb is completely blown, creating visibility hazard at night.',
    photoUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',
    reporterId: 'usr_jordan_002',
    status: 'received',
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
];

const SEED_DELIVERY_LOGS: DbDeliveryLog[] = [
  {
    id: 'del_001',
    reportId: 'rep_001',
    channel: 'in_app',
    recipientUserId: 'usr_alex_001',
    status: 'delivered',
    costPence: 0,
    createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: 'del_002',
    reportId: 'rep_001',
    channel: 'sms',
    recipientUserId: 'usr_alex_001',
    status: 'delivered',
    costPence: 10,
    createdAt: new Date(Date.now() - 8 * 60000 + 2000).toISOString(),
  },
  {
    id: 'del_003',
    reportId: 'rep_002',
    channel: 'in_app',
    recipientUserId: 'usr_alex_001',
    status: 'delivered',
    costPence: 0,
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
  },
  {
    id: 'del_004',
    reportId: 'rep_003',
    channel: 'in_app',
    recipientUserId: 'usr_jordan_002',
    status: 'delivered',
    costPence: 0,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'del_005',
    reportId: 'rep_004',
    channel: 'in_app',
    recipientUserId: 'usr_alex_001',
    status: 'delivered',
    costPence: 0,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'del_006',
    reportId: 'rep_004',
    channel: 'sms',
    recipientUserId: 'usr_alex_001',
    status: 'delivered',
    costPence: 10,
    createdAt: new Date(Date.now() - 1 * 86400000 + 2000).toISOString(),
  },
  {
    id: 'del_007',
    reportId: 'rep_005',
    channel: 'in_app',
    recipientUserId: null,
    status: 'queued_unclaimed',
    costPence: 0,
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: 'del_008',
    reportId: 'rep_006',
    channel: 'in_app',
    recipientUserId: 'usr_jordan_002',
    status: 'delivered',
    costPence: 0,
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
  {
    id: 'del_009',
    reportId: 'rep_007',
    channel: 'in_app',
    recipientUserId: 'usr_alex_001',
    status: 'delivered',
    costPence: 0,
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'del_010',
    reportId: 'rep_007',
    channel: 'sms',
    recipientUserId: 'usr_alex_001',
    status: 'delivered',
    costPence: 10,
    createdAt: new Date(Date.now() - 45 * 60000 + 1000).toISOString(),
  },
];

const SEED_AUDIT_LOGS: DbAuditLog[] = [
  {
    id: 'aud_001',
    actorId: 'usr_alex_001',
    actionType: 'VEHICLE_OWNERSHIP_REGISTERED',
    targetId: 'veh_ford_001',
    targetType: 'vehicle',
    detailsJson: { plate: 'CK 45 DF GP', method: 'admin_verified' },
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'aud_002',
    actorId: 'usr_jordan_002',
    actionType: 'DRIVER_SELF_REGISTERED',
    targetId: 'veh_leaf_002',
    targetType: 'vehicle',
    detailsJson: { plate: 'ND 913-317 ZN' },
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

const SEED_SYSTEM_CONFIGS: DbSystemConfig[] = [
  {
    keyName: 'google_cloud_project_id',
    keyValue: process.env.GOOGLE_CLOUD_PROJECT || 'dzer32gve6ghcxunsish2k',
    category: 'google_cloud',
    description: 'Google Cloud Platform Project ID hosting the AI Studio applet',
    updatedAt: new Date().toISOString(),
  },
  {
    keyName: 'google_cloud_project_number',
    keyValue: process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '69290944445',
    category: 'google_cloud',
    description: 'Google Cloud Platform Project Number hosting the AI Studio applet',
    updatedAt: new Date().toISOString(),
  },
  {
    keyName: 'google_cloud_project_name',
    keyValue: 'Driver Ping',
    category: 'google_cloud',
    description: 'Google Cloud Platform Project Name',
    updatedAt: new Date().toISOString(),
  },
  {
    keyName: 'gemini_active_models',
    keyValue: 'gemini-3.1-flash-lite,gemini-4-hydrogen',
    category: 'ai_models',
    description: 'Supported server-side multimodal Gemini models with automatic fallback',
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Normalizes and validates PostgreSQL connection strings.
 * Protects against truncated environment variables (e.g. missing protocol prefix),
 * non-encoded special characters, and dummy 'base' hostnames generated by pg-connection-string.
 */
export function normalizePostgresConnectionString(raw?: string): { url?: string; reason?: string } {
  if (!raw || typeof raw !== 'string') return {};
  let str = raw.trim();

  // Strip surrounding quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  if (!str) return {};

  // If protocol prefix is missing, inspect structure
  if (!str.startsWith('postgresql://') && !str.startsWith('postgres://')) {
    if (str.includes('@')) {
      const atIdx = str.indexOf('@');
      const userPart = str.slice(0, atIdx);
      if (userPart.includes(':')) {
        str = `postgresql://${str}`;
      } else {
        str = `postgresql://postgres:${str}`;
      }
    } else {
      return { reason: 'Invalid connection string format: missing protocol prefix and @ delimiter' };
    }
  }

  // Safely URL-encode special characters in password before parsing URL
  try {
    const protoMatch = str.match(/^(postgres(?:ql)?:\/\/)(.*)$/);
    if (protoMatch) {
      const proto = protoMatch[1];
      const rest = protoMatch[2];
      const lastAt = rest.lastIndexOf('@');
      if (lastAt !== -1) {
        const authPart = rest.slice(0, lastAt);
        const hostDbPart = rest.slice(lastAt + 1);
        const firstColon = authPart.indexOf(':');
        if (firstColon !== -1) {
          const user = authPart.slice(0, firstColon);
          const rawPass = authPart.slice(firstColon + 1);
          const encodedPass = rawPass.includes('%') ? rawPass : encodeURIComponent(rawPass);
          str = `${proto}${user}:${encodedPass}@${hostDbPart}`;
        }
      }
    }
  } catch {}

  try {
    const parsed = new URL(str);
    const host = parsed.hostname?.trim().toLowerCase();

    // pg-connection-string resolves missing host to dummy 'base'
    if (!host || host === 'base') {
      return { reason: `Invalid connection string: resolved to placeholder host '${host}'` };
    }

    // Supabase pooler requires tenant identifier in username: postgres.[project-ref]
    if (host.includes('.pooler.supabase.com') && (parsed.username === 'postgres' || !parsed.username.includes('.'))) {
      const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const match = rawSupabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/i);
      const projectRef = match ? match[1] : 'bbuzczlmgyzynfxhgplx';
      if (projectRef) {
        parsed.username = `postgres.${projectRef}`;
        str = parsed.toString();
      }
    }

    return { url: str };
  } catch (err: any) {
    return { reason: `Invalid database connection URL: ${err.message}` };
  }
}

class DatabaseService {
  private pool: pg.Pool | null = null;
  private isConnected = false;
  private initPromise: Promise<void> | null = null;
  private connectionError: string | null = null;

  // In-memory fallback structures
  public memory = {
    users: [...SEED_USERS],
    passwordHashes: {} as Record<string, string>,
    otps: [] as DbOtp[],
    vehicles: [...SEED_VEHICLES],
    vehicleDrivers: [...SEED_VEHICLE_DRIVERS],
    trustedContacts: [...SEED_TRUSTED_CONTACTS],
    ownershipVerifications: [...SEED_OWNERSHIP_VERIFICATIONS],
    reports: [...SEED_REPORTS],
    deliveryLogs: [...SEED_DELIVERY_LOGS],
    auditLogs: [...SEED_AUDIT_LOGS],
    systemConfigs: [...SEED_SYSTEM_CONFIGS],
    mapHazards: [...SEED_MAP_HAZARDS],
    mapHazardVotes: {} as Record<string, { unsolved: boolean; false_report: boolean; being_solved: boolean }>,
  };

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const rawConnectionString =
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.POSTGRES_URL;

    if (!rawConnectionString) {
      const message = 'DATABASE_URL (or SUPABASE_DB_URL / POSTGRES_URL) is not configured.';
      console.log(`ℹ️ [Driver Ping DB] ${message}`);
      console.log('ℹ️ [Driver Ping DB] Running with resilient in-memory persistence and demo datasets.');
      return;
    }

    const { url: connectionString, reason } = normalizePostgresConnectionString(rawConnectionString);

    if (!connectionString) {
      this.isConnected = false;
      this.connectionError = reason || 'Malformed PostgreSQL connection string';
      console.warn(`⚠️ [Driver Ping DB] Connection configuration notice: ${this.connectionError}`);
      console.log('ℹ️ [Driver Ping DB] Running with resilient in-memory persistence and demo datasets.');
      return;
    }

    try {
      console.log('🔄 [Driver Ping DB] Connecting to Supabase PostgreSQL...');
      this.pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false,
        },
        max: 10,
        idleTimeoutMillis: 30000,
        keepAlive: true,
        connectionTimeoutMillis: 8000,
        query_timeout: 8000,
        statement_timeout: 8000,
      });

      // Handle unexpected pool client errors gracefully
      this.pool.on('error', (poolErr) => {
        console.warn('⚠️ [Driver Ping DB] Background pool connection notice:', poolErr?.message || poolErr);
      });

      // Test connection with 8000ms timeout for cross-region Supabase pooler handshake
      const connectTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PostgreSQL connection attempt timed out after 8000ms')), 8000)
      );

      const client = await Promise.race([this.pool.connect(), connectTimeout]);
      const testRes = await client.query('SELECT NOW() as current_time');
      client.release();

      this.isConnected = true;
      this.connectionError = null;
      console.log(`✅ [Driver Ping DB] Connected to Supabase PostgreSQL successfully at ${testRes.rows[0].current_time}`);

      // Run schema migrations and seeds with 10000ms timeout
      const schemaTimeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Schema bootstrap timed out')), 10000)
      );
      await Promise.race([this.bootstrapSchema(), schemaTimeout]).catch((schemaErr) => {
        console.warn('⚠️ [Driver Ping DB] Schema bootstrap notice:', schemaErr?.message || schemaErr);
      });
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message || String(err);
      console.warn('⚠️ [Driver Ping DB] Notice: Supabase PostgreSQL is unreachable or credentials need review:', this.connectionError);
      console.log('ℹ️ [Driver Ping DB] Gracefully falling back to in-memory store with demo datasets.');
      if (this.pool) {
        await this.pool.end().catch(() => {});
        this.pool = null;
      }
    }
  }

  public async waitForInit(): Promise<void> {
    if (this.initPromise) {
      try {
        const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 6000));
        await Promise.race([this.initPromise, timeoutPromise]);
      } catch {
        // Non-fatal: in-memory store fallback remains active if PostgreSQL is unreachable
      }
    }
  }

  public isUsingPostgres(): boolean {
    return this.isConnected && this.pool !== null;
  }

  public getStatus() {
    return {
      connectedToPostgres: this.isUsingPostgres(),
      error: this.connectionError,
      hasConnectionString: Boolean(
        process.env.DATABASE_URL ||
        process.env.SUPABASE_DB_URL ||
        process.env.POSTGRES_URL
      ),
      driver: this.isUsingPostgres() ? 'Supabase PostgreSQL' : 'In-Memory Fallback',
    };
  }

  private async bootstrapSchema(): Promise<void> {
    if (!this.pool) return;
    try {
      // Fast-path check: avoid redundant DDL + 30 sequential seed queries if Supabase is already initialized
      const checkRes = await this.pool.query(`
        SELECT
          to_regclass('public.users') IS NOT NULL AS has_users,
          to_regclass('public.system_config') IS NOT NULL AS has_config,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'location'
          ) AS has_report_location,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
          ) AS has_password_hash
      `);

      const row = checkRes.rows[0] || {};
      const alreadyInitialized = Boolean(
        row.has_users && row.has_config && row.has_report_location && row.has_password_hash
      );

      if (alreadyInitialized) {
        const seededRes = await this.pool.query(
          `SELECT EXISTS(SELECT 1 FROM users WHERE id = 'usr_alex_001') AS has_seed`
        );
        if (seededRes.rows[0]?.has_seed) {
          await this.pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS home_province VARCHAR(20);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS home_city VARCHAR(100);
          `).catch(() => {});
          await this.ensureSystemConfigs();
          await this.ensureMapHazardsTable();
          console.log('✅ [Driver Ping DB] Supabase schema & seed data verified (fast path).');
          return;
        }
      }

      const schemaPath = path.resolve(__dirname, '../db/schema.sql');
      let schemaSql = '';
      if (fs.existsSync(schemaPath)) {
        schemaSql = fs.readFileSync(schemaPath, 'utf8');
      }

      if (schemaSql) {
        console.log('🔄 [Driver Ping DB] Applying schema.sql to Supabase database...');
        await this.pool.query(schemaSql);

        await this.pool.query(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS home_province VARCHAR(20);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS home_city VARCHAR(100);
        `);

        // Ensure column size migrations for email/phone support & demo alert photo backfill
        await this.pool.query(`
          ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(255);
          ALTER TABLE otps ALTER COLUMN phone TYPE VARCHAR(255);
          ALTER TABLE trusted_contacts ALTER COLUMN phone TYPE VARCHAR(255);

          UPDATE reports 
          SET photo_url = 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80'
          WHERE id = 'rep_001' AND (photo_url IS NULL OR photo_url = '');

          UPDATE reports 
          SET photo_url = 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80'
          WHERE id = 'rep_002' AND (photo_url IS NULL OR photo_url = '');
        `).catch(() => {});

        console.log('✅ [Driver Ping DB] Database tables & migrations verified & ready.');
        await this.ensureSystemConfigs();
      }

      // Ensure predefined demo users and vehicles exist in Supabase DB with ON CONFLICT DO NOTHING
      console.log('🌱 [Driver Ping DB] Ensuring predefined demo users and vehicles are present in Supabase...');
      await this.seedSupabaseData();
      await this.ensureMapHazardsTable();
      console.log('✅ [Driver Ping DB] Supabase database seed verification complete.');
    } catch (err: any) {
      console.warn('⚠️ [Driver Ping DB] Non-fatal notice during Supabase schema setup:', err.message);
    }
  }

  private async seedSupabaseData(): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Users
      for (const u of SEED_USERS) {
        await client.query(
          `INSERT INTO users (id, phone, full_name, role, plan, sms_opt_in, sms_monthly_cap_pence, sms_current_spend_pence, default_plate, default_province_code, home_province, home_city, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO NOTHING`,
          [
            u.id,
            u.phone,
            u.fullName,
            u.role,
            u.plan,
            u.smsOptIn,
            u.smsMonthlyCapPence,
            u.smsCurrentSpendPence,
            u.defaultPlate || '',
            u.defaultProvinceCode || '',
            u.homeProvince || '',
            u.homeCity || '',
            u.createdAt,
            u.updatedAt,
          ]
        );
      }

      // 2. Vehicles
      for (const v of SEED_VEHICLES) {
        await client.query(
          `INSERT INTO vehicles (id, plate_normalized, plate_display, make, model, color, verified_owner_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [v.id, v.plateNormalized, v.plateDisplay, v.make, v.model, v.color, v.verifiedOwnerId, v.createdAt, v.updatedAt]
        );
      }

      // 3. Drivers
      for (const vd of SEED_VEHICLE_DRIVERS) {
        await client.query(
          `INSERT INTO vehicle_drivers (id, vehicle_id, user_id, role, status, requested_at, approved_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [vd.id, vd.vehicleId, vd.userId, vd.role, vd.status, vd.requestedAt, vd.approvedAt]
        );
      }

      // 4. Trusted contacts
      for (const tc of SEED_TRUSTED_CONTACTS) {
        await client.query(
          `INSERT INTO trusted_contacts (id, vehicle_id, name, phone, relationship, consent_given, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [tc.id, tc.vehicleId, tc.name, tc.phone, tc.relationship, tc.consentGiven, tc.createdAt]
        );
      }

      // 5. Ownership verifications
      for (const ov of SEED_OWNERSHIP_VERIFICATIONS) {
        await client.query(
          `INSERT INTO ownership_verifications (id, vehicle_id, user_id, document_name, document_type, document_url, status, admin_notes, submitted_at, reviewed_at, reviewed_by_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [ov.id, ov.vehicleId, ov.userId, ov.documentName, ov.documentType, ov.documentUrl, ov.status, ov.adminNotes, ov.submittedAt, ov.reviewedAt, ov.reviewedById]
        );
      }

      // 6. Reports
      for (const r of SEED_REPORTS) {
        await client.query(
          `INSERT INTO reports (id, idempotency_key, plate_normalized, category, issue_code, issue_title, custom_note, photo_url, reporter_id, status, recipient_action_note, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [r.id, r.idempotencyKey, r.plateNormalized, r.category, r.issueCode, r.issueTitle, r.customNote || '', r.photoUrl || '', r.reporterId, r.status, r.recipientActionNote || null, r.createdAt]
        );
      }

      // 7. Delivery logs
      for (const dl of SEED_DELIVERY_LOGS) {
        await client.query(
          `INSERT INTO delivery_logs (id, report_id, channel, recipient_user_id, status, cost_pence, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [dl.id, dl.reportId, dl.channel, dl.recipientUserId, dl.status, dl.costPence, dl.createdAt]
        );
      }

      // 8. Audit logs
      for (const al of SEED_AUDIT_LOGS) {
        await client.query(
          `INSERT INTO audit_logs (id, actor_id, action_type, target_id, target_type, details_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [al.id, al.actorId, al.actionType, al.targetId, al.targetType, JSON.stringify(al.detailsJson), al.createdAt]
        );
      }

      // 9. System Configs (Gemini Keys & Google Cloud Settings)
      for (const sc of SEED_SYSTEM_CONFIGS) {
        await client.query(
          `INSERT INTO system_config (key_name, key_value, category, description, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (key_name) DO UPDATE 
           SET key_value = EXCLUDED.key_value, updated_at = NOW()`,
          [sc.keyName, sc.keyValue, sc.category, sc.description, sc.updatedAt]
        );
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async ensureSystemConfigs(): Promise<void> {
    await this.waitForInit();
    if (!this.pool) return;
    try {
      for (const sc of SEED_SYSTEM_CONFIGS) {
        await this.pool.query(
          `INSERT INTO system_config (key_name, key_value, category, description, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (key_name) DO UPDATE 
           SET key_value = EXCLUDED.key_value, updated_at = NOW()`,
          [sc.keyName, sc.keyValue, sc.category, sc.description, sc.updatedAt]
        );
      }
      console.log('✅ [Driver Ping DB] Gemini API keys & Google Cloud project settings synchronized to Supabase system_config table.');
    } catch (err: any) {
      console.warn('⚠️ [Driver Ping DB] Notice during system_config setup:', err.message);
    }
  }

  public async getSystemConfigs(): Promise<DbSystemConfig[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT key_name, key_value, category, description, updated_at FROM system_config ORDER BY category, key_name`
      );
      return res.rows.map((r) => ({
        keyName: r.key_name,
        keyValue: r.key_value,
        category: r.category,
        description: r.description,
        updatedAt: r.updated_at,
      }));
    }
    return this.memory.systemConfigs;
  }

  public async getSystemConfig(keyName: string): Promise<string | null> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT key_value FROM system_config WHERE key_name = $1`,
        [keyName]
      );
      return res.rows[0]?.key_value || null;
    }
    const match = this.memory.systemConfigs.find((sc) => sc.keyName === keyName);
    return match ? match.keyValue : null;
  }

  public async setSystemConfig(
    keyName: string,
    keyValue: string,
    category: string = 'general',
    description: string = ''
  ): Promise<void> {
    await this.waitForInit();
    const now = new Date().toISOString();
    if (this.isUsingPostgres()) {
      await this.pool!.query(
        `INSERT INTO system_config (key_name, key_value, category, description, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key_name) DO UPDATE
         SET key_value = EXCLUDED.key_value, category = EXCLUDED.category, description = EXCLUDED.description, updated_at = NOW()`,
        [keyName, keyValue, category, description, now]
      );
    } else {
      const existing = this.memory.systemConfigs.find((sc) => sc.keyName === keyName);
      if (existing) {
        existing.keyValue = keyValue;
        existing.category = category;
        existing.description = description;
        existing.updatedAt = now;
      } else {
        this.memory.systemConfigs.push({ keyName, keyValue, category, description, updatedAt: now });
      }
    }
  }

  // USERS & AUTHENTICATION

  public async getUserById(id: string): Promise<DbUser | null> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, phone, full_name, role, plan, sms_opt_in, sms_monthly_cap_pence, sms_current_spend_pence, default_plate, default_province_code, home_province, home_city, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return this.memory.users.find((u) => u.id === id) || null;
  }

  public async getUserByPhone(phone: string): Promise<DbUser | null> {
    await this.waitForInit();
    const cleanPhone = phone.trim();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, phone, full_name, role, plan, sms_opt_in, sms_monthly_cap_pence, sms_current_spend_pence, default_plate, default_province_code, home_province, home_city, created_at, updated_at
         FROM users WHERE LOWER(phone) = LOWER($1)`,
        [cleanPhone]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return this.memory.users.find((u) => u.phone.toLowerCase() === cleanPhone.toLowerCase()) || null;
  }

  public async getPasswordHash(email: string): Promise<string | null> {
    await this.waitForInit();
    const cleanEmail = email.trim().toLowerCase();
    if (!this.isUsingPostgres()) {
      return this.memory.passwordHashes[cleanEmail] || null;
    }
    const result = await this.pool!.query('SELECT password_hash FROM users WHERE LOWER(phone) = LOWER($1)', [cleanEmail]);
    return result.rows[0]?.password_hash || null;
  }

  public async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.waitForInit();
    if (!this.isUsingPostgres()) {
      const user = this.memory.users.find((u) => u.id === userId);
      if (user) {
        this.memory.passwordHashes[user.phone.trim().toLowerCase()] = passwordHash;
      }
      return;
    }
    await this.pool!.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, passwordHash]);
  }

  public async createUser(data: {
    id?: string;
    phone: string;
    fullName?: string;
    role?: 'user' | 'admin';
    plan?: 'free' | 'paid_owner';
    smsOptIn?: boolean;
    smsMonthlyCapPence?: number;
    defaultPlate?: string;
    defaultProvinceCode?: string;
    homeProvince?: string;
    homeCity?: string;
  }): Promise<DbUser> {
    await this.waitForInit();
    const id = data.id || `usr_${Date.now()}`;
    const cleanPhone = data.phone.trim();
    const fullName = data.fullName?.trim() || `Driver ${cleanPhone.slice(-4)}`;
    const role = data.role || 'user';
    const plan = data.plan || 'free';
    const smsOptIn = data.smsOptIn || false;
    const smsMonthlyCapPence = data.smsMonthlyCapPence || 500;
    const defaultPlate = data.defaultPlate ? data.defaultPlate.trim().toUpperCase() : '';
    const defaultProvinceCode = data.defaultProvinceCode ? data.defaultProvinceCode.trim().toUpperCase() : '';
    const homeProvince = data.homeProvince ? data.homeProvince.trim().toUpperCase() : '';
    const homeCity = data.homeCity ? data.homeCity.trim() : '';
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO users (id, phone, full_name, role, plan, sms_opt_in, sms_monthly_cap_pence, sms_current_spend_pence, default_plate, default_province_code, home_province, home_city, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, $12, $13)
         RETURNING id, phone, full_name, role, plan, sms_opt_in, sms_monthly_cap_pence, sms_current_spend_pence, default_plate, default_province_code, home_province, home_city, created_at, updated_at`,
        [id, cleanPhone, fullName, role, plan, smsOptIn, smsMonthlyCapPence, defaultPlate, defaultProvinceCode, homeProvince, homeCity, now, now]
      );
      return this.mapUserRow(res.rows[0]);
    }

    const newUser: DbUser = {
      id,
      phone: cleanPhone,
      fullName,
      role,
      plan,
      smsOptIn,
      smsMonthlyCapPence,
      smsCurrentSpendPence: 0,
      defaultPlate: defaultPlate || undefined,
      defaultProvinceCode: defaultProvinceCode || undefined,
      homeProvince: homeProvince || undefined,
      homeCity: homeCity || undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.memory.users.push(newUser);
    return newUser;
  }

  public async updateUserPreferences(
    userId: string,
    prefs: {
      smsOptIn?: boolean;
      smsMonthlyCapPence?: number;
      smsCurrentSpendPence?: number;
      plan?: 'free' | 'paid_owner';
      fullName?: string;
      phone?: string;
      defaultPlate?: string;
      defaultProvinceCode?: string;
      homeProvince?: string;
      homeCity?: string;
    }
  ): Promise<DbUser | null> {
    await this.waitForInit();
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const user = await this.getUserById(userId);
      if (!user) return null;

      const newSmsOptIn = prefs.smsOptIn !== undefined ? prefs.smsOptIn : user.smsOptIn;
      const newCap = prefs.smsMonthlyCapPence !== undefined ? prefs.smsMonthlyCapPence : user.smsMonthlyCapPence;
      const newSpend = prefs.smsCurrentSpendPence !== undefined ? prefs.smsCurrentSpendPence : user.smsCurrentSpendPence;
      const newPlan = prefs.plan !== undefined ? prefs.plan : user.plan;
      const newName = prefs.fullName !== undefined ? prefs.fullName.trim() : user.fullName;
      const newPhone = prefs.phone !== undefined && prefs.phone.trim() ? prefs.phone.trim() : user.phone;
      const newPlate = prefs.defaultPlate !== undefined ? prefs.defaultPlate.trim().toUpperCase() : user.defaultPlate;
      const newProv = prefs.defaultProvinceCode !== undefined ? prefs.defaultProvinceCode.trim().toUpperCase() : user.defaultProvinceCode;
      const newHomeProv = prefs.homeProvince !== undefined ? prefs.homeProvince.trim().toUpperCase() : user.homeProvince;
      const newHomeCity = prefs.homeCity !== undefined ? prefs.homeCity.trim() : user.homeCity;

      const res = await this.pool!.query(
        `UPDATE users
         SET sms_opt_in = $1, sms_monthly_cap_pence = $2, sms_current_spend_pence = $3, plan = $4, full_name = $5, phone = $6, default_plate = $7, default_province_code = $8, home_province = $9, home_city = $10, updated_at = $11
         WHERE id = $12
         RETURNING id, phone, full_name, role, plan, sms_opt_in, sms_monthly_cap_pence, sms_current_spend_pence, default_plate, default_province_code, home_province, home_city, created_at, updated_at`,
        [newSmsOptIn, newCap, newSpend, newPlan, newName, newPhone, newPlate || '', newProv || '', newHomeProv || '', newHomeCity || '', now, userId]
      );
      return this.mapUserRow(res.rows[0]);
    }

    const user = this.memory.users.find((u) => u.id === userId);
    if (!user) return null;
    if (prefs.smsOptIn !== undefined) user.smsOptIn = prefs.smsOptIn;
    if (prefs.smsMonthlyCapPence !== undefined) user.smsMonthlyCapPence = prefs.smsMonthlyCapPence;
    if (prefs.smsCurrentSpendPence !== undefined) user.smsCurrentSpendPence = prefs.smsCurrentSpendPence;
    if (prefs.plan !== undefined) user.plan = prefs.plan;
    if (prefs.fullName !== undefined) user.fullName = prefs.fullName.trim();
    if (prefs.phone !== undefined && prefs.phone.trim()) user.phone = prefs.phone.trim();
    if (prefs.defaultPlate !== undefined) user.defaultPlate = prefs.defaultPlate.trim().toUpperCase();
    if (prefs.defaultProvinceCode !== undefined) user.defaultProvinceCode = prefs.defaultProvinceCode.trim().toUpperCase();
    if (prefs.homeProvince !== undefined) user.homeProvince = prefs.homeProvince.trim().toUpperCase() || undefined;
    if (prefs.homeCity !== undefined) user.homeCity = prefs.homeCity.trim() || undefined;
    user.updatedAt = now;
    return user;
  }

  public async getDemoAccounts(): Promise<DbUser[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, phone, full_name, role, plan, sms_opt_in, sms_monthly_cap_pence, sms_current_spend_pence, default_plate, default_province_code, home_province, home_city, created_at, updated_at
         FROM users
         WHERE id IN ('usr_alex_001', 'usr_jordan_002', 'usr_admin_003')
         ORDER BY (CASE role WHEN 'admin' THEN 2 ELSE 1 END), id ASC`
      );
      return res.rows.map(this.mapUserRow);
    }
    return this.memory.users.filter((u) =>
      ['usr_alex_001', 'usr_jordan_002', 'usr_admin_003'].includes(u.id)
    );
  }

  // OTPS

  public async createOtp(phone: string, code: string, expiresAt: string): Promise<DbOtp> {
    await this.waitForInit();
    const id = `otp_${Date.now()}`;
    const cleanPhone = phone.trim();
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO otps (id, phone, code, expires_at, verified, created_at)
         VALUES ($1, $2, $3, $4, false, $5)
         RETURNING id, phone, code, expires_at, verified, created_at`,
        [id, cleanPhone, code, expiresAt, now]
      );
      return {
        id: res.rows[0].id,
        phone: res.rows[0].phone,
        code: res.rows[0].code,
        expiresAt: res.rows[0].expires_at,
        verified: res.rows[0].verified,
        createdAt: res.rows[0].created_at,
      };
    }

    const otp: DbOtp = { id, phone: cleanPhone, code, expiresAt, verified: false, createdAt: now };
    this.memory.otps.push(otp);
    return otp;
  }

  public async getLatestUnverifiedOtp(phone: string): Promise<DbOtp | null> {
    await this.waitForInit();
    const cleanPhone = phone.trim();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, phone, code, expires_at, verified, created_at
         FROM otps
         WHERE phone = $1 AND verified = false
         ORDER BY created_at DESC
         LIMIT 1`,
        [cleanPhone]
      );
      if (res.rows.length === 0) return null;
      return {
        id: res.rows[0].id,
        phone: res.rows[0].phone,
        code: res.rows[0].code,
        expiresAt: res.rows[0].expires_at,
        verified: res.rows[0].verified,
        createdAt: res.rows[0].created_at,
      };
    }

    const matching = this.memory.otps
      .filter((o) => o.phone === cleanPhone && !o.verified)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return matching[0] || null;
  }

  public async markOtpVerified(otpId: string): Promise<void> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      await this.pool!.query(`UPDATE otps SET verified = true WHERE id = $1`, [otpId]);
      return;
    }
    const record = this.memory.otps.find((o) => o.id === otpId);
    if (record) record.verified = true;
  }

  // VEHICLES & DRIVERS

  public async getVehiclesForUser(userId: string): Promise<any[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      // Find all vehicles where user is a driver or verified owner
      const res = await this.pool!.query(
        `SELECT v.id, v.plate_normalized, v.plate_display, v.make, v.model, v.color, v.verified_owner_id, v.created_at, v.updated_at,
                vd.role as driver_role, vd.status as driver_status, vd.requested_at, vd.approved_at
         FROM vehicles v
         JOIN vehicle_drivers vd ON vd.vehicle_id = v.id
         WHERE vd.user_id = $1
         ORDER BY v.created_at DESC`,
        [userId]
      );

      const vehicles = [];
      for (const row of res.rows) {
        const vehicleId = row.id;
        const isOwner = row.verified_owner_id === userId;

        // Fetch all drivers for this vehicle
        const driversRes = await this.pool!.query(
          `SELECT vd.id, vd.user_id, vd.role, vd.status, vd.requested_at, vd.approved_at,
                  u.full_name, u.phone
           FROM vehicle_drivers vd
           LEFT JOIN users u ON u.id = vd.user_id
           WHERE vd.vehicle_id = $1`,
          [vehicleId]
        );

        const allDrivers = driversRes.rows.map((d) => ({
          id: d.id,
          userId: d.user_id,
          fullName: d.full_name || 'Driver',
          phone: d.phone ? d.phone.slice(0, 7) + '***' : '',
          role: d.role,
          status: d.status,
          requestedAt: d.requested_at,
          approvedAt: d.approved_at,
        }));

        // Trusted contacts
        const tcRes = await this.pool!.query(
          `SELECT id, vehicle_id, name, phone, relationship, consent_given, created_at
           FROM trusted_contacts WHERE vehicle_id = $1`,
          [vehicleId]
        );

        // Pending verification
        const ovRes = await this.pool!.query(
          `SELECT id FROM ownership_verifications
           WHERE vehicle_id = $1 AND user_id = $2 AND status = 'pending'`,
          [vehicleId, userId]
        );

        vehicles.push({
          id: row.id,
          plateNormalized: row.plate_normalized,
          plateDisplay: row.plate_display,
          make: row.make,
          model: row.model,
          color: row.color,
          verifiedOwnerId: row.verified_owner_id,
          userRole: isOwner ? 'owner' : row.driver_role || 'driver',
          driverStatus: row.driver_status || 'approved',
          isVerifiedOwner: isOwner,
          allDrivers,
          trustedContacts: tcRes.rows.map((tc) => ({
            id: tc.id,
            vehicleId: tc.vehicle_id,
            name: tc.name,
            phone: tc.phone,
            relationship: tc.relationship,
            consentGiven: tc.consent_given,
            createdAt: tc.created_at,
          })),
          pendingOwnershipVerification: ovRes.rows.length > 0,
          createdAt: row.created_at,
        });
      }
      return vehicles;
    }

    // In-memory fallback
    const userDrivers = this.memory.vehicleDrivers.filter((vd) => vd.userId === userId);
    const userVehicleIds = new Set(userDrivers.map((vd) => vd.vehicleId));

    return this.memory.vehicles
      .filter((v) => userVehicleIds.has(v.id))
      .map((v) => {
        const driverRecord = userDrivers.find((vd) => vd.vehicleId === v.id);
        const isOwner = v.verifiedOwnerId === userId;
        const allDrivers = this.memory.vehicleDrivers
          .filter((vd) => vd.vehicleId === v.id)
          .map((vd) => {
            const u = this.memory.users.find((u2) => u2.id === vd.userId);
            return {
              id: vd.id,
              userId: vd.userId,
              fullName: u?.fullName || 'Driver',
              phone: u ? u.phone.slice(0, 7) + '***' : '',
              role: vd.role,
              status: vd.status,
              requestedAt: vd.requestedAt,
              approvedAt: vd.approvedAt,
            };
          });

        const trusted = this.memory.trustedContacts.filter((tc) => tc.vehicleId === v.id);
        const pendingVerification = this.memory.ownershipVerifications.find(
          (ov) => ov.vehicleId === v.id && ov.userId === userId && ov.status === 'pending'
        );

        return {
          ...v,
          userRole: isOwner ? 'owner' : driverRecord?.role || 'driver',
          driverStatus: driverRecord?.status || 'approved',
          isVerifiedOwner: isOwner,
          allDrivers,
          trustedContacts: trusted,
          pendingOwnershipVerification: !!pendingVerification,
        };
      });
  }

  public async getUsersForPlate(plateNormalized: string): Promise<DbUser[]> {
    await this.waitForInit();
    const norm = plateNormalized.trim().toUpperCase().replace(/[\s-]/g, '');
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT DISTINCT u.id, u.phone, u.full_name, u.role, u.plan, u.sms_opt_in, u.sms_monthly_cap_pence, u.sms_current_spend_pence, u.default_plate, u.default_province_code, u.home_province, u.home_city, u.created_at, u.updated_at
         FROM users u
         LEFT JOIN vehicle_drivers vd ON vd.user_id = u.id AND vd.status = 'approved'
         LEFT JOIN vehicles v ON v.id = vd.vehicle_id OR v.verified_owner_id = u.id
         WHERE REPLACE(REPLACE(UPPER(u.default_plate), ' ', ''), '-', '') = $1
            OR REPLACE(REPLACE(UPPER(v.plate_normalized), ' ', ''), '-', '') = $1`,
        [norm]
      );
      return res.rows.map((r) => this.mapUserRow(r));
    }

    // In-memory fallback
    const matchedUsers: DbUser[] = [];
    const seenIds = new Set<string>();

    for (const u of this.memory.users) {
      if (u.defaultPlate) {
        const userPlateNorm = u.defaultPlate.trim().toUpperCase().replace(/[\s-]/g, '');
        if (userPlateNorm === norm && !seenIds.has(u.id)) {
          seenIds.add(u.id);
          matchedUsers.push(u);
        }
      }
    }

    const matchedVehicles = this.memory.vehicles.filter(
      (v) => v.plateNormalized.trim().toUpperCase().replace(/[\s-]/g, '') === norm
    );
    for (const veh of matchedVehicles) {
      if (veh.verifiedOwnerId && !seenIds.has(veh.verifiedOwnerId)) {
        const owner = this.memory.users.find((u) => u.id === veh.verifiedOwnerId);
        if (owner) {
          seenIds.add(owner.id);
          matchedUsers.push(owner);
        }
      }
      const approvedDrivers = this.memory.vehicleDrivers.filter(
        (vd) => vd.vehicleId === veh.id && vd.status === 'approved'
      );
      for (const vd of approvedDrivers) {
        if (!seenIds.has(vd.userId)) {
          const drvUser = this.memory.users.find((u) => u.id === vd.userId);
          if (drvUser) {
            seenIds.add(drvUser.id);
            matchedUsers.push(drvUser);
          }
        }
      }
    }

    return matchedUsers;
  }

  public async getVehicleByPlate(plateNormalized: string): Promise<DbVehicle | null> {
    await this.waitForInit();
    const norm = plateNormalized.trim().toUpperCase();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, plate_normalized, plate_display, make, model, color, verified_owner_id, created_at, updated_at
         FROM vehicles WHERE plate_normalized = $1`,
        [norm]
      );
      if (res.rows.length === 0) return null;
      return this.mapVehicleRow(res.rows[0]);
    }
    return this.memory.vehicles.find((v) => v.plateNormalized === norm) || null;
  }

  public async getVehicleById(id: string): Promise<DbVehicle | null> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, plate_normalized, plate_display, make, model, color, verified_owner_id, created_at, updated_at
         FROM vehicles WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) return null;
      return this.mapVehicleRow(res.rows[0]);
    }
    return this.memory.vehicles.find((v) => v.id === id) || null;
  }

  public async createVehicle(data: {
    plateNormalized: string;
    plateDisplay: string;
    make?: string;
    model?: string;
    color?: string;
  }): Promise<DbVehicle> {
    await this.waitForInit();
    const id = `veh_${Date.now()}`;
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO vehicles (id, plate_normalized, plate_display, make, model, color, verified_owner_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, null, $7, $8)
         RETURNING id, plate_normalized, plate_display, make, model, color, verified_owner_id, created_at, updated_at`,
        [id, data.plateNormalized, data.plateDisplay, data.make || 'Vehicle', data.model || '', data.color || 'Standard', now, now]
      );
      return this.mapVehicleRow(res.rows[0]);
    }

    const veh: DbVehicle = {
      id,
      plateNormalized: data.plateNormalized,
      plateDisplay: data.plateDisplay,
      make: data.make || 'Vehicle',
      model: data.model || '',
      color: data.color || 'Standard',
      verifiedOwnerId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.memory.vehicles.push(veh);
    return veh;
  }

  public async getVehicleDriver(vehicleId: string, userId: string): Promise<DbVehicleDriver | null> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, vehicle_id, user_id, role, status, requested_at, approved_at
         FROM vehicle_drivers WHERE vehicle_id = $1 AND user_id = $2`,
        [vehicleId, userId]
      );
      if (res.rows.length === 0) return null;
      return {
        id: res.rows[0].id,
        vehicleId: res.rows[0].vehicle_id,
        userId: res.rows[0].user_id,
        role: res.rows[0].role,
        status: res.rows[0].status,
        requestedAt: res.rows[0].requested_at,
        approvedAt: res.rows[0].approved_at,
      };
    }
    return (
      this.memory.vehicleDrivers.find(
        (vd) => vd.vehicleId === vehicleId && vd.userId === userId
      ) || null
    );
  }

  public async addDriverToVehicle(data: {
    vehicleId: string;
    userId: string;
    role: 'driver' | 'owner';
    status: 'approved' | 'pending_owner_approval' | 'rejected';
  }): Promise<DbVehicleDriver> {
    await this.waitForInit();
    const id = `vd_${Date.now()}`;
    const now = new Date().toISOString();
    const approvedAt = data.status === 'approved' ? now : null;

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO vehicle_drivers (id, vehicle_id, user_id, role, status, requested_at, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, vehicle_id, user_id, role, status, requested_at, approved_at`,
        [id, data.vehicleId, data.userId, data.role, data.status, now, approvedAt]
      );
      return {
        id: res.rows[0].id,
        vehicleId: res.rows[0].vehicle_id,
        userId: res.rows[0].user_id,
        role: res.rows[0].role,
        status: res.rows[0].status,
        requestedAt: res.rows[0].requested_at,
        approvedAt: res.rows[0].approved_at,
      };
    }

    const rec: DbVehicleDriver = {
      id,
      vehicleId: data.vehicleId,
      userId: data.userId,
      role: data.role,
      status: data.status,
      requestedAt: now,
      approvedAt,
    };
    this.memory.vehicleDrivers.push(rec);
    return rec;
  }

  public async getApprovedDriversForVehicle(vehicleId: string): Promise<DbVehicleDriver[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, vehicle_id, user_id, role, status, requested_at, approved_at
         FROM vehicle_drivers WHERE vehicle_id = $1 AND status = 'approved'`,
        [vehicleId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        vehicleId: r.vehicle_id,
        userId: r.user_id,
        role: r.role,
        status: r.status,
        requestedAt: r.requested_at,
        approvedAt: r.approved_at,
      }));
    }
    return this.memory.vehicleDrivers.filter(
      (vd) => vd.vehicleId === vehicleId && vd.status === 'approved'
    );
  }

  public async updateDriverStatus(
    driverRecordId: string,
    action: 'approve' | 'reject' | 'remove'
  ): Promise<boolean> {
    await this.waitForInit();
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      if (action === 'approve') {
        const res = await this.pool!.query(
          `UPDATE vehicle_drivers SET status = 'approved', approved_at = $1 WHERE id = $2`,
          [now, driverRecordId]
        );
        return (res.rowCount ?? 0) > 0;
      }
      const res = await this.pool!.query(`DELETE FROM vehicle_drivers WHERE id = $1`, [driverRecordId]);
      return (res.rowCount ?? 0) > 0;
    }

    const driverRecord = this.memory.vehicleDrivers.find((vd) => vd.id === driverRecordId);
    if (!driverRecord) return false;

    if (action === 'approve') {
      driverRecord.status = 'approved';
      driverRecord.approvedAt = now;
      return true;
    }
    this.memory.vehicleDrivers = this.memory.vehicleDrivers.filter((vd) => vd.id !== driverRecordId);
    return true;
  }

  // TRUSTED CONTACTS

  public async createTrustedContact(data: {
    vehicleId: string;
    name: string;
    phone: string;
    relationship: string;
    consentGiven: boolean;
  }): Promise<DbTrustedContact> {
    await this.waitForInit();
    const id = `tc_${Date.now()}`;
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO trusted_contacts (id, vehicle_id, name, phone, relationship, consent_given, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, vehicle_id, name, phone, relationship, consent_given, created_at`,
        [id, data.vehicleId, data.name.trim(), data.phone.trim(), data.relationship.trim(), data.consentGiven, now]
      );
      return {
        id: res.rows[0].id,
        vehicleId: res.rows[0].vehicle_id,
        name: res.rows[0].name,
        phone: res.rows[0].phone,
        relationship: res.rows[0].relationship,
        consentGiven: res.rows[0].consent_given,
        createdAt: res.rows[0].created_at,
      };
    }

    const tc: DbTrustedContact = {
      id,
      vehicleId: data.vehicleId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      relationship: data.relationship.trim(),
      consentGiven: data.consentGiven,
      createdAt: now,
    };
    this.memory.trustedContacts.push(tc);
    return tc;
  }

  public async deleteTrustedContact(id: string, vehicleId: string): Promise<boolean> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `DELETE FROM trusted_contacts WHERE id = $1 AND vehicle_id = $2`,
        [id, vehicleId]
      );
      return (res.rowCount ?? 0) > 0;
    }
    const lenBefore = this.memory.trustedContacts.length;
    this.memory.trustedContacts = this.memory.trustedContacts.filter(
      (tc) => !(tc.id === id && tc.vehicleId === vehicleId)
    );
    return this.memory.trustedContacts.length < lenBefore;
  }

  // OWNERSHIP VERIFICATION (RULE 4)

  public async createOwnershipVerification(data: {
    vehicleId: string;
    userId: string;
    documentName: string;
    documentType: string;
    documentUrl: string;
  }): Promise<DbOwnershipVerification> {
    await this.waitForInit();
    const id = `verif_${Date.now()}`;
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO ownership_verifications (id, vehicle_id, user_id, document_name, document_type, document_url, status, admin_notes, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', null, $7)
         RETURNING id, vehicle_id, user_id, document_name, document_type, document_url, status, admin_notes, submitted_at, reviewed_at, reviewed_by_id`,
        [id, data.vehicleId, data.userId, data.documentName.trim(), data.documentType, data.documentUrl, now]
      );
      return this.mapVerificationRow(res.rows[0]);
    }

    const ov: DbOwnershipVerification = {
      id,
      vehicleId: data.vehicleId,
      userId: data.userId,
      documentName: data.documentName.trim(),
      documentType: data.documentType,
      documentUrl: data.documentUrl,
      status: 'pending',
      adminNotes: null,
      submittedAt: now,
      reviewedAt: null,
      reviewedById: null,
    };
    this.memory.ownershipVerifications.push(ov);
    return ov;
  }

  public async getPendingVerification(vehicleId: string, userId: string): Promise<DbOwnershipVerification | null> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, vehicle_id, user_id, document_name, document_type, document_url, status, admin_notes, submitted_at, reviewed_at, reviewed_by_id
         FROM ownership_verifications WHERE vehicle_id = $1 AND user_id = $2 AND status = 'pending'`,
        [vehicleId, userId]
      );
      if (res.rows.length === 0) return null;
      return this.mapVerificationRow(res.rows[0]);
    }
    return (
      this.memory.ownershipVerifications.find(
        (ov) => ov.vehicleId === vehicleId && ov.userId === userId && ov.status === 'pending'
      ) || null
    );
  }

  public async getOwnershipVerificationsWithDetails(): Promise<any[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT ov.id, ov.vehicle_id, ov.user_id, ov.document_name, ov.document_type, ov.document_url, ov.status, ov.admin_notes, ov.submitted_at, ov.reviewed_at, ov.reviewed_by_id,
                u.phone as user_phone, u.full_name as user_name,
                v.plate_display, v.make, v.model, v.color
         FROM ownership_verifications ov
         LEFT JOIN users u ON u.id = ov.user_id
         LEFT JOIN vehicles v ON v.id = ov.vehicle_id
         ORDER BY ov.submitted_at DESC`
      );
      return res.rows.map((r) => ({
        id: r.id,
        vehicleId: r.vehicle_id,
        userId: r.user_id,
        documentName: r.document_name,
        documentType: r.document_type,
        documentUrl: r.document_url,
        status: r.status,
        adminNotes: r.admin_notes,
        submittedAt: r.submitted_at,
        reviewedAt: r.reviewed_at,
        reviewedById: r.reviewed_by_id,
        userPhone: r.user_phone,
        userName: r.user_name,
        plateDisplay: r.plate_display,
        vehicleDetails: r.make ? `${r.make} ${r.model} (${r.color})` : '',
      }));
    }

    return this.memory.ownershipVerifications.map((ov) => {
      const user = this.memory.users.find((u) => u.id === ov.userId);
      const vehicle = this.memory.vehicles.find((v) => v.id === ov.vehicleId);
      return {
        ...ov,
        userPhone: user?.phone,
        userName: user?.fullName,
        plateDisplay: vehicle?.plateDisplay,
        vehicleDetails: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.color})` : '',
      };
    });
  }

  public async reviewOwnershipVerification(
    verificationId: string,
    adminId: string,
    decision: 'approved' | 'rejected',
    notes?: string
  ): Promise<boolean> {
    await this.waitForInit();
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const client = await this.pool!.connect();
      try {
        await client.query('BEGIN');
        const verifRes = await client.query(
          `SELECT vehicle_id, user_id FROM ownership_verifications WHERE id = $1`,
          [verificationId]
        );
        if (verifRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }
        const { vehicle_id, user_id } = verifRes.rows[0];

        await client.query(
          `UPDATE ownership_verifications
           SET status = $1, admin_notes = $2, reviewed_at = $3, reviewed_by_id = $4
           WHERE id = $5`,
          [decision, notes || null, now, adminId, verificationId]
        );

        if (decision === 'approved') {
          // Set vehicle verified_owner_id
          await client.query(
            `UPDATE vehicles SET verified_owner_id = $1, updated_at = $2 WHERE id = $3`,
            [user_id, now, vehicle_id]
          );
          // Upgrade or insert driver record to owner
          await client.query(
            `INSERT INTO vehicle_drivers (id, vehicle_id, user_id, role, status, requested_at, approved_at)
             VALUES ($1, $2, $3, 'owner', 'approved', $4, $4)
             ON CONFLICT (vehicle_id, user_id)
             DO UPDATE SET role = 'owner', status = 'approved', approved_at = $4`,
            [`vd_${Date.now()}`, vehicle_id, user_id, now]
          );
        }

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const verif = this.memory.ownershipVerifications.find((v) => v.id === verificationId);
    if (!verif) return false;
    verif.status = decision;
    verif.adminNotes = notes || null;
    verif.reviewedAt = now;
    verif.reviewedById = adminId;

    if (decision === 'approved') {
      const vehicle = this.memory.vehicles.find((v) => v.id === verif.vehicleId);
      if (vehicle) {
        vehicle.verifiedOwnerId = verif.userId;
        const driverRec = this.memory.vehicleDrivers.find(
          (vd) => vd.vehicleId === vehicle.id && vd.userId === verif.userId
        );
        if (driverRec) {
          driverRec.role = 'owner';
          driverRec.status = 'approved';
        }
      }
    }
    return true;
  }

  // REPORTS & PRIVACY PROTECTION

  public async getRecentReportsByUser(userId: string, sinceIso: string): Promise<DbReport[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, idempotency_key, plate_normalized, category, issue_code, issue_title, custom_note, photo_url, reporter_id, status, created_at
         FROM reports WHERE reporter_id = $1 AND created_at > $2`,
        [userId, sinceIso]
      );
      return res.rows.map(this.mapReportRow);
    }
    return this.memory.reports.filter(
      (r) => r.reporterId === userId && new Date(r.createdAt) > new Date(sinceIso)
    );
  }

  public async getRecentDuplicateReport(
    plateNormalized: string,
    issueCode: string,
    sinceIso: string
  ): Promise<DbReport | null> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, idempotency_key, plate_normalized, category, issue_code, issue_title, custom_note, photo_url, reporter_id, status, created_at
         FROM reports WHERE plate_normalized = $1 AND issue_code = $2 AND created_at > $3
         LIMIT 1`,
        [plateNormalized, issueCode, sinceIso]
      );
      if (res.rows.length === 0) return null;
      return this.mapReportRow(res.rows[0]);
    }
    return (
      this.memory.reports.find(
        (r) =>
          r.plateNormalized === plateNormalized &&
          r.issueCode === issueCode &&
          new Date(r.createdAt) > new Date(sinceIso)
      ) || null
    );
  }

  public async getReportByIdempotencyKey(key: string): Promise<DbReport | null> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, idempotency_key, plate_normalized, category, issue_code, issue_title, custom_note, photo_url, reporter_id, status, created_at
         FROM reports WHERE idempotency_key = $1`,
        [key]
      );
      if (res.rows.length === 0) return null;
      return this.mapReportRow(res.rows[0]);
    }
    return this.memory.reports.find((r) => r.idempotencyKey === key) || null;
  }

  public async getReportById(id: string): Promise<DbReport | null> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, idempotency_key, plate_normalized, category, issue_code, issue_title, custom_note, photo_url, reporter_id, status, dispute_reason, abuse_reason, recipient_action_note, created_at
         FROM reports WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) return null;
      return this.mapReportRow(res.rows[0]);
    }
    return this.memory.reports.find((r) => r.id === id) || null;
  }

  public async createReport(data: {
    plateNormalized: string;
    category: 'vehicle_condition' | 'driver_behaviour' | 'road_violation';
    issueCode: string;
    issueTitle: string;
    customNote?: string;
    location?: string;
    photoUrl?: string;
    reporterId: string;
    idempotencyKey?: string;
  }): Promise<DbReport> {
    await this.waitForInit();
    const id = `rep_${Date.now()}`;
    const now = new Date().toISOString();
    const idemp = data.idempotencyKey || `auto_${Date.now()}`;

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO reports (id, idempotency_key, plate_normalized, category, issue_code, issue_title, custom_note, location, photo_url, reporter_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'received', $11)
         RETURNING id, idempotency_key, plate_normalized, category, issue_code, issue_title, custom_note, location, photo_url, reporter_id, status, created_at`,
        [id, idemp, data.plateNormalized, data.category, data.issueCode, data.issueTitle.trim(), data.customNote?.trim() || '', data.location || '', data.photoUrl || '', data.reporterId, now]
      );
      return this.mapReportRow(res.rows[0]);
    }

    const report: DbReport = {
      id,
      idempotencyKey: idemp,
      plateNormalized: data.plateNormalized,
      category: data.category,
      issueCode: data.issueCode,
      issueTitle: data.issueTitle.trim(),
      customNote: data.customNote?.trim() || '',
      location: data.location || '',
      photoUrl: data.photoUrl || '',
      reporterId: data.reporterId,
      status: 'received',
      createdAt: now,
    };
    this.memory.reports.unshift(report);
    return report;
  }

  /**
   * CRITICAL PRIVACY RULE:
   * Returns sanitized alert items for vehicles the user is approved to drive.
   * STRICTLY SCRUBS reporter_id, reporter phone, or any reporter identity!
   */
  public async getSanitizedAlertsForUser(userId: string): Promise<any[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      // Find all reports matching vehicles where user is driver/owner OR matching user's default_plate OR delivered via delivery_logs
      const res = await this.pool!.query(
        `SELECT DISTINCT
            r.id,
            r.plate_normalized,
            r.category,
            r.issue_code,
            r.issue_title,
            r.custom_note,
            r.location,
            r.photo_url,
            r.status,
            r.recipient_action_note,
            r.dispute_reason,
            r.abuse_reason,
            r.created_at,
            COALESCE(v.plate_display, u.default_plate, r.plate_normalized) as plate_display,
            COALESCE(CONCAT(v.make, ' ', v.model), 'Registered Vehicle') as vehicle_make_model,
            EXISTS(
              SELECT 1 FROM delivery_logs dl 
              WHERE dl.report_id = r.id AND dl.recipient_user_id = $1 AND dl.status = 'delivered'
            ) as is_recorded_delivered,
            (
              SELECT MIN(dl.created_at) FROM delivery_logs dl 
              WHERE dl.report_id = r.id AND dl.recipient_user_id = $1 AND dl.status = 'delivered'
            ) as delivered_at
         FROM reports r
         LEFT JOIN vehicles v ON REPLACE(REPLACE(UPPER(v.plate_normalized), ' ', ''), '-', '') = REPLACE(REPLACE(UPPER(r.plate_normalized), ' ', ''), '-', '')
         LEFT JOIN users u ON u.id = $1
         WHERE (
           EXISTS (
             SELECT 1 FROM vehicle_drivers vd 
             WHERE vd.vehicle_id = v.id AND vd.user_id = $1 AND vd.status = 'approved'
           )
           OR v.verified_owner_id = $1
           OR (u.default_plate IS NOT NULL AND u.default_plate != '' AND REPLACE(REPLACE(UPPER(u.default_plate), ' ', ''), '-', '') = REPLACE(REPLACE(UPPER(r.plate_normalized), ' ', ''), '-', ''))
           OR EXISTS (
             SELECT 1 FROM delivery_logs dl
             WHERE dl.report_id = r.id AND dl.recipient_user_id = $1
           )
         )
         ORDER BY r.created_at DESC`,
        [userId]
      );

      // NOTICE: reporter_id is explicitly NOT included in the projection
      return res.rows.map((r) => ({
        id: r.id,
        plateDisplay: r.plate_display,
        vehicleMakeModel: r.vehicle_make_model?.trim() || 'Vehicle',
        category: r.category,
        issueCode: r.issue_code,
        issueTitle: r.issue_title,
        customNote: r.custom_note || null,
        location: r.location || null,
        photoUrl: r.photo_url || null,
        status: r.status,
        recipientActionNote: r.recipient_action_note || null,
        disputeReason: r.dispute_reason || null,
        abuseReason: r.abuse_reason || null,
        createdAt: r.created_at,
        isRecordedDelivered: Boolean(r.is_recorded_delivered),
        deliveredAt: r.delivered_at || r.created_at,
        neutralNotice: 'A road user reported a possible observation. Please check when safe.',
        privacyNotice: 'Reporter identity is hidden from you. Restricted security logs are retained to protect against abuse.',
      }));
    }

    // In-memory fallback
    const currentUser = this.memory.users.find((u) => u.id === userId);
    const userDriverRecords = this.memory.vehicleDrivers.filter(
      (vd) => vd.userId === userId && vd.status === 'approved'
    );
    const vehicleIds = userDriverRecords.map((vd) => vd.vehicleId);
    const userVehicles = this.memory.vehicles.filter(
      (v) => vehicleIds.includes(v.id) || v.verifiedOwnerId === userId
    );

    const userPlates = new Set<string>();
    for (const v of userVehicles) {
      userPlates.add(v.plateNormalized.trim().toUpperCase().replace(/[\s-]/g, ''));
    }
    if (currentUser?.defaultPlate) {
      userPlates.add(currentUser.defaultPlate.trim().toUpperCase().replace(/[\s-]/g, ''));
    }

    const userDeliveredReportIds = new Set(
      this.memory.deliveryLogs
        .filter((dl) => dl.recipientUserId === userId)
        .map((dl) => dl.reportId)
    );

    const matchedReports = this.memory.reports.filter(
      (r) =>
        userPlates.has(r.plateNormalized.trim().toUpperCase().replace(/[\s-]/g, '')) ||
        userDeliveredReportIds.has(r.id)
    );

    return matchedReports.map((r) => {
      const veh = userVehicles.find(
        (v) => v.plateNormalized.trim().toUpperCase().replace(/[\s-]/g, '') === r.plateNormalized.trim().toUpperCase().replace(/[\s-]/g, '')
      );
      const delLogs = this.memory.deliveryLogs.filter((dl) => dl.reportId === r.id);
      const userDel = delLogs.find((dl) => dl.recipientUserId === userId && dl.status === 'delivered');

      return {
        id: r.id,
        plateDisplay: veh ? veh.plateDisplay : (currentUser?.defaultPlate || r.plateNormalized),
        vehicleMakeModel: veh ? `${veh.make} ${veh.model}` : 'Vehicle',
        category: r.category,
        issueCode: r.issueCode,
        issueTitle: r.issueTitle,
        customNote: r.customNote || null,
        location: r.location || null,
        photoUrl: r.photoUrl || null,
        status: r.status,
        recipientActionNote: r.recipientActionNote || null,
        disputeReason: r.disputeReason || null,
        abuseReason: r.abuseReason || null,
        createdAt: r.createdAt,
        isRecordedDelivered: !!userDel,
        deliveredAt: userDel?.createdAt || r.createdAt,
        neutralNotice: 'A road user reported a possible observation. Please check when safe.',
        privacyNotice: 'Reporter identity is hidden from you. Restricted security logs are retained to protect against abuse.',
      };
    });
  }

  public async updateReportStatus(
    id: string,
    status: 'received' | 'needs_review' | 'resolved' | 'disputed' | 'flagged_abuse' | 'dismissed',
    notes?: { recipientActionNote?: string; disputeReason?: string; abuseReason?: string }
  ): Promise<boolean> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `UPDATE reports
         SET status = $1,
             recipient_action_note = COALESCE($2, recipient_action_note),
             dispute_reason = COALESCE($3, dispute_reason),
             abuse_reason = COALESCE($4, abuse_reason)
         WHERE id = $5`,
        [status, notes?.recipientActionNote || null, notes?.disputeReason || null, notes?.abuseReason || null, id]
      );
      return (res.rowCount ?? 0) > 0;
    }

    const report = this.memory.reports.find((r) => r.id === id);
    if (!report) return false;
    report.status = status;
    if (notes?.recipientActionNote !== undefined) report.recipientActionNote = notes.recipientActionNote;
    if (notes?.disputeReason !== undefined) report.disputeReason = notes.disputeReason;
    if (notes?.abuseReason !== undefined) report.abuseReason = notes.abuseReason;
    return true;
  }

  // ==========================================================================
  // DISPUTES & ABUSE (ADMIN ACCESS)
  // ==========================================================================

  public async getFlaggedReportsForAdmin(): Promise<any[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT r.id, r.plate_normalized, r.category, r.issue_code, r.issue_title, r.custom_note, r.photo_url, r.status, r.dispute_reason, r.abuse_reason, r.created_at,
                v.plate_display,
                u.phone as reporter_phone
         FROM reports r
         LEFT JOIN vehicles v ON v.plate_normalized = r.plate_normalized
         LEFT JOIN users u ON u.id = r.reporter_id
         WHERE r.status IN ('disputed', 'flagged_abuse')
         ORDER BY r.created_at DESC`
      );
      return res.rows.map((r) => ({
        id: r.id,
        plateNormalized: r.plate_normalized,
        category: r.category,
        issueCode: r.issue_code,
        issueTitle: r.issue_title,
        customNote: r.custom_note,
        photoUrl: r.photo_url,
        status: r.status,
        disputeReason: r.dispute_reason,
        abuseReason: r.abuse_reason,
        createdAt: r.created_at,
        plateDisplay: r.plate_display || r.plate_normalized,
        reporterPhoneMasked: r.reporter_phone ? r.reporter_phone.slice(0, 7) + '***' : 'Unknown',
      }));
    }

    const flagged = this.memory.reports.filter(
      (r) => r.status === 'disputed' || r.status === 'flagged_abuse'
    );
    return flagged.map((r) => {
      const vehicle = this.memory.vehicles.find((v) => v.plateNormalized === r.plateNormalized);
      const reporter = this.memory.users.find((u) => u.id === r.reporterId);
      return {
        ...r,
        plateDisplay: vehicle?.plateDisplay || r.plateNormalized,
        reporterPhoneMasked: reporter ? reporter.phone.slice(0, 7) + '***' : 'Unknown',
      };
    });
  }

  // ==========================================================================
  // DELIVERY & AUDIT LOGS
  // ==========================================================================

  public async createDeliveryLog(data: {
    reportId: string;
    channel: 'in_app' | 'sms';
    recipientUserId: string | null;
    status: 'delivered' | 'queued_unclaimed' | 'failed' | 'capped_limit';
    costPence: number;
  }): Promise<DbDeliveryLog> {
    await this.waitForInit();
    const id = `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO delivery_logs (id, report_id, channel, recipient_user_id, status, cost_pence, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, report_id, channel, recipient_user_id, status, cost_pence, created_at`,
        [id, data.reportId, data.channel, data.recipientUserId, data.status, data.costPence, now]
      );
      return {
        id: res.rows[0].id,
        reportId: res.rows[0].report_id,
        channel: res.rows[0].channel,
        recipientUserId: res.rows[0].recipient_user_id,
        status: res.rows[0].status,
        costPence: res.rows[0].cost_pence,
        createdAt: res.rows[0].created_at,
      };
    }

    const log: DbDeliveryLog = {
      id,
      reportId: data.reportId,
      channel: data.channel,
      recipientUserId: data.recipientUserId,
      status: data.status,
      costPence: data.costPence,
      createdAt: now,
    };
    this.memory.deliveryLogs.push(log);
    return log;
  }

  public async createAuditLog(data: {
    actorId: string | null;
    actionType: string;
    targetId: string | null;
    targetType: string;
    detailsJson: Record<string, any>;
  }): Promise<DbAuditLog> {
    await this.waitForInit();
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO audit_logs (id, actor_id, action_type, target_id, target_type, details_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, actor_id, action_type, target_id, target_type, details_json, created_at`,
        [id, data.actorId, data.actionType, data.targetId, data.targetType, JSON.stringify(data.detailsJson), now]
      );
      return {
        id: res.rows[0].id,
        actorId: res.rows[0].actor_id,
        actionType: res.rows[0].action_type,
        targetId: res.rows[0].target_id,
        targetType: res.rows[0].target_type,
        detailsJson: typeof res.rows[0].details_json === 'string' ? JSON.parse(res.rows[0].details_json) : res.rows[0].details_json,
        createdAt: res.rows[0].created_at,
      };
    }

    const log: DbAuditLog = {
      id,
      actorId: data.actorId,
      actionType: data.actionType,
      targetId: data.targetId,
      targetType: data.targetType,
      detailsJson: data.detailsJson,
      createdAt: now,
    };
    this.memory.auditLogs.unshift(log);
    return log;
  }

  public async getAuditLogs(): Promise<DbAuditLog[]> {
    await this.waitForInit();
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT id, actor_id, action_type, target_id, target_type, details_json, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 100`
      );
      return res.rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actionType: r.action_type,
        targetId: r.target_id,
        targetType: r.target_type,
        detailsJson: typeof r.details_json === 'string' ? JSON.parse(r.details_json) : r.details_json,
        createdAt: r.created_at,
      }));
    }

    return [...this.memory.auditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // ==========================================================================
  // LIVE MAP HAZARDS (PERSISTED IN SUPABASE POSTGRESQL + IN-MEMORY FALLBACK)
  // ==========================================================================

  private async ensureMapHazardsTable(): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS map_hazards (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          kind VARCHAR(20) NOT NULL CHECK (kind IN ('pothole', 'accident', 'traffic', 'alert')),
          title VARCHAR(100) NOT NULL,
          description TEXT,
          area VARCHAR(120) NOT NULL,
          province VARCHAR(10) NOT NULL DEFAULT 'GP',
          lat DOUBLE PRECISION NOT NULL,
          lon DOUBLE PRECISION NOT NULL,
          severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
          confirmations INTEGER NOT NULL DEFAULT 1,
          false_report_count INTEGER NOT NULL DEFAULT 0,
          being_solved_count INTEGER NOT NULL DEFAULT 0,
          reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          is_user_pinned BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_map_hazards_province_kind ON map_hazards(province, kind);
        CREATE INDEX IF NOT EXISTS idx_map_hazards_created ON map_hazards(created_at DESC);
        CREATE TABLE IF NOT EXISTS map_hazard_votes (
          hazard_id TEXT NOT NULL REFERENCES map_hazards(id) ON DELETE CASCADE,
          voter_key TEXT NOT NULL,
          unsolved BOOLEAN NOT NULL DEFAULT false,
          false_report BOOLEAN NOT NULL DEFAULT false,
          being_solved BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          PRIMARY KEY (hazard_id, voter_key)
        );
      `);

      await this.pool.query(`
        ALTER TABLE map_hazard_votes ADD COLUMN IF NOT EXISTS unsolved BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE map_hazard_votes ADD COLUMN IF NOT EXISTS false_report BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE map_hazard_votes ADD COLUMN IF NOT EXISTS being_solved BOOLEAN NOT NULL DEFAULT false;
      `);

      await this.pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'map_hazard_votes' AND column_name = 'status'
          ) THEN
            ALTER TABLE map_hazard_votes ALTER COLUMN status DROP NOT NULL;
            UPDATE map_hazard_votes
            SET
              unsolved = (status = 'unsolved'),
              false_report = (status = 'false_report'),
              being_solved = (status = 'being_solved')
            WHERE status IS NOT NULL AND NOT (unsolved OR false_report OR being_solved);
          END IF;
        END $$;
      `).catch(() => {});

      const colCheck = await this.pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'map_hazards' AND column_name = 'false_report_count'`
      );
      const needsAnalysisBackfill = colCheck.rows.length === 0;
      await this.pool.query(`
        ALTER TABLE map_hazards ADD COLUMN IF NOT EXISTS false_report_count INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE map_hazards ADD COLUMN IF NOT EXISTS being_solved_count INTEGER NOT NULL DEFAULT 0;
      `);

      const countRes = await this.pool.query('SELECT COUNT(*)::int AS cnt FROM map_hazards');
      if (Number(countRes.rows[0]?.cnt || 0) === 0) {
        for (const h of SEED_MAP_HAZARDS) {
          await this.pool.query(
            `INSERT INTO map_hazards (id, kind, title, description, area, province, lat, lon, severity, confirmations, false_report_count, being_solved_count, is_user_pinned, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (id) DO NOTHING`,
            [
              h.id,
              h.kind,
              h.title,
              h.description,
              h.area,
              h.province,
              h.lat,
              h.lon,
              h.severity,
              h.confirmations,
              h.falseReportCount,
              h.beingSolvedCount,
              Boolean(h.isUserPinned),
              h.createdAt,
            ]
          );
        }
      } else if (needsAnalysisBackfill) {
        for (const h of SEED_MAP_HAZARDS) {
          await this.pool.query(
            `UPDATE map_hazards SET false_report_count = $2, being_solved_count = $3 WHERE id = $1`,
            [h.id, h.falseReportCount, h.beingSolvedCount]
          );
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Driver Ping DB] Notice during map_hazards setup:', err?.message || err);
    }
  }

  private mapHazardRow(row: any): DbMapHazard {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description || '',
      area: row.area,
      province: row.province,
      lat: Number(row.lat),
      lon: Number(row.lon),
      severity: row.severity,
      confirmations: Number(row.confirmations || 1),
      falseReportCount: Number(row.false_report_count || 0),
      beingSolvedCount: Number(row.being_solved_count || 0),
      isUserPinned: Boolean(row.is_user_pinned),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  public async listMapHazards(filters?: { province?: string; kind?: string }): Promise<DbMapHazard[]> {
    await this.waitForInit();
    const prov = filters?.province && filters.province !== 'ALL' ? filters.province.toUpperCase() : null;
    const kind = filters?.kind && filters.kind !== 'all' ? filters.kind.toLowerCase() : null;

    if (this.isUsingPostgres()) {
      const clauses: string[] = [];
      const params: any[] = [];
      if (prov) {
        params.push(prov);
        clauses.push(`UPPER(province) = $${params.length}`);
      }
      if (kind) {
        params.push(kind);
        clauses.push(`LOWER(kind) = $${params.length}`);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const res = await this.pool!.query(
        `SELECT id, kind, title, description, area, province, lat, lon, severity, confirmations, false_report_count, being_solved_count, is_user_pinned, created_at
         FROM map_hazards
         ${where}
         ORDER BY created_at DESC
         LIMIT 200`,
        params
      );
      return res.rows.map((r) => this.mapHazardRow(r));
    }

    return this.memory.mapHazards.filter((h) => {
      if (prov && h.province.toUpperCase() !== prov) return false;
      if (kind && h.kind !== kind) return false;
      return true;
    });
  }

  public async createMapHazard(data: {
    kind: 'pothole' | 'accident' | 'traffic' | 'alert';
    title: string;
    description?: string;
    area?: string;
    province?: string;
    lat: number;
    lon: number;
    severity?: 'low' | 'medium' | 'high';
    reporterId?: string | null;
  }): Promise<DbMapHazard> {
    await this.waitForInit();
    const id = `hz_user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const title = data.title.trim().slice(0, 100);
    const description = (data.description || 'Reported live by a South African road user.').trim().slice(0, 240);
    const area = (data.area || 'South Africa').trim().slice(0, 120);
    const province = (data.province || 'GP').toUpperCase().slice(0, 10);
    const severity = data.severity || (data.kind === 'accident' ? 'high' : 'medium');

    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `INSERT INTO map_hazards (id, kind, title, description, area, province, lat, lon, severity, confirmations, false_report_count, being_solved_count, reporter_id, is_user_pinned, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 0, 0, $10, true, $11)
         RETURNING id, kind, title, description, area, province, lat, lon, severity, confirmations, false_report_count, being_solved_count, is_user_pinned, created_at`,
        [id, data.kind, title, description, area, province, Number(data.lat), Number(data.lon), severity, data.reporterId || null, now]
      );
      return this.mapHazardRow(res.rows[0]);
    }

    const pin: DbMapHazard = {
      id,
      kind: data.kind,
      title,
      description,
      area,
      province,
      lat: Number(data.lat),
      lon: Number(data.lon),
      severity,
      confirmations: 1,
      falseReportCount: 0,
      beingSolvedCount: 0,
      isUserPinned: true,
      createdAt: now,
    };
    this.memory.mapHazards.unshift(pin);
    return pin;
  }

  public async getUserHazardVotes(
    voterKey: string
  ): Promise<Record<string, { unsolved: boolean; false_report: boolean; being_solved: boolean }>> {
    await this.waitForInit();
    if (!voterKey) return {};
    if (this.isUsingPostgres()) {
      const res = await this.pool!.query(
        `SELECT hazard_id, unsolved, false_report, being_solved
         FROM map_hazard_votes
         WHERE voter_key = $1`,
        [voterKey]
      );
      const out: Record<string, { unsolved: boolean; false_report: boolean; being_solved: boolean }> = {};
      for (const r of res.rows) {
        out[r.hazard_id] = {
          unsolved: Boolean(r.unsolved),
          false_report: Boolean(r.false_report),
          being_solved: Boolean(r.being_solved),
        };
      }
      return out;
    }

    const out: Record<string, { unsolved: boolean; false_report: boolean; being_solved: boolean }> = {};
    const suffix = `::${voterKey}`;
    for (const [k, v] of Object.entries(this.memory.mapHazardVotes)) {
      if (k.endsWith(suffix)) {
        const hazardId = k.slice(0, -suffix.length);
        out[hazardId] = { ...v };
      }
    }
    return out;
  }

  private computeNextVoteState(
    curr: { unsolved: boolean; false_report: boolean; being_solved: boolean },
    clicked: 'unsolved' | 'being_solved' | 'false_report'
  ) {
    let next: { unsolved: boolean; false_report: boolean; being_solved: boolean };
    if (curr[clicked]) {
      // Pressing the same active button again removes its vote point
      next = { ...curr, [clicked]: false };
    } else if (clicked === 'false_report') {
      // Switching to False Report transfers any active True vote(s) to False Report
      next = { unsolved: false, false_report: true, being_solved: false };
    } else if (clicked === 'unsolved') {
      // Picking True & Unsolved transfers from False Report if active, while keeping True & Solved if active
      next = { unsolved: true, false_report: false, being_solved: curr.being_solved };
    } else {
      // Picking True & Solved transfers from False Report if active, while keeping True & Unsolved if active
      next = { unsolved: curr.unsolved, false_report: false, being_solved: true };
    }

    const dUnsolved = (next.unsolved ? 1 : 0) - (curr.unsolved ? 1 : 0);
    const dFalse = (next.false_report ? 1 : 0) - (curr.false_report ? 1 : 0);
    const dSolved = (next.being_solved ? 1 : 0) - (curr.being_solved ? 1 : 0);
    return { next, dUnsolved, dFalse, dSolved };
  }

  public async voteMapHazardAnalysis(
    id: string,
    status: 'unsolved' | 'being_solved' | 'false_report',
    voterKey?: string
  ): Promise<{
    hazard: DbMapHazard;
    userVote: { unsolved: boolean; false_report: boolean; being_solved: boolean };
  } | null> {
    await this.waitForInit();

    if (this.isUsingPostgres()) {
      if (!voterKey) {
        const col =
          status === 'false_report'
            ? 'false_report_count'
            : status === 'being_solved'
              ? 'being_solved_count'
              : 'confirmations';
        const res = await this.pool!.query(
          `UPDATE map_hazards
           SET ${col} = ${col} + 1
           WHERE id = $1
           RETURNING id, kind, title, description, area, province, lat, lon, severity, confirmations, false_report_count, being_solved_count, is_user_pinned, created_at`,
          [id]
        );
        if (res.rows.length === 0) return null;
        return {
          hazard: this.mapHazardRow(res.rows[0]),
          userVote: {
            unsolved: status === 'unsolved',
            false_report: status === 'false_report',
            being_solved: status === 'being_solved',
          },
        };
      }

      const client = await this.pool!.connect();
      try {
        await client.query('BEGIN');
        const existsRes = await client.query(`SELECT id FROM map_hazards WHERE id = $1 FOR UPDATE`, [id]);
        if (existsRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return null;
        }

        const voteRes = await client.query(
          `SELECT unsolved, false_report, being_solved
           FROM map_hazard_votes
           WHERE hazard_id = $1 AND voter_key = $2
           FOR UPDATE`,
          [id, voterKey]
        );
        const curr = voteRes.rows[0]
          ? {
              unsolved: Boolean(voteRes.rows[0].unsolved),
              false_report: Boolean(voteRes.rows[0].false_report),
              being_solved: Boolean(voteRes.rows[0].being_solved),
            }
          : { unsolved: false, false_report: false, being_solved: false };

        const { next, dUnsolved, dFalse, dSolved } = this.computeNextVoteState(curr, status);

        await client.query(
          `INSERT INTO map_hazard_votes (hazard_id, voter_key, unsolved, false_report, being_solved)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (hazard_id, voter_key)
           DO UPDATE SET
             unsolved = EXCLUDED.unsolved,
             false_report = EXCLUDED.false_report,
             being_solved = EXCLUDED.being_solved`,
          [id, voterKey, next.unsolved, next.false_report, next.being_solved]
        );

        const updatedRes = await client.query(
          `UPDATE map_hazards
           SET
             confirmations = GREATEST(0, confirmations + $2),
             false_report_count = GREATEST(0, false_report_count + $3),
             being_solved_count = GREATEST(0, being_solved_count + $4)
           WHERE id = $1
           RETURNING id, kind, title, description, area, province, lat, lon, severity, confirmations, false_report_count, being_solved_count, is_user_pinned, created_at`,
          [id, dUnsolved, dFalse, dSolved]
        );

        await client.query('COMMIT');
        return {
          hazard: this.mapHazardRow(updatedRes.rows[0]),
          userVote: next,
        };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    const found = this.memory.mapHazards.find((h) => h.id === id);
    if (!found) return null;

    if (!voterKey) {
      if (status === 'false_report') {
        found.falseReportCount = (found.falseReportCount || 0) + 1;
      } else if (status === 'being_solved') {
        found.beingSolvedCount = (found.beingSolvedCount || 0) + 1;
      } else {
        found.confirmations += 1;
      }
      return {
        hazard: found,
        userVote: {
          unsolved: status === 'unsolved',
          false_report: status === 'false_report',
          being_solved: status === 'being_solved',
        },
      };
    }

    const key = `${id}::${voterKey}`;
    const curr = this.memory.mapHazardVotes[key] || {
      unsolved: false,
      false_report: false,
      being_solved: false,
    };
    const { next, dUnsolved, dFalse, dSolved } = this.computeNextVoteState(curr, status);
    this.memory.mapHazardVotes[key] = next;

    found.confirmations = Math.max(0, (found.confirmations || 0) + dUnsolved);
    found.falseReportCount = Math.max(0, (found.falseReportCount || 0) + dFalse);
    found.beingSolvedCount = Math.max(0, (found.beingSolvedCount || 0) + dSolved);

    return { hazard: found, userVote: next };
  }

  public async confirmMapHazard(id: string): Promise<DbMapHazard | null> {
    const res = await this.voteMapHazardAnalysis(id, 'unsolved');
    return res ? res.hazard : null;
  }
  // HELPERS

  private mapUserRow(row: any): DbUser {
    return {
      id: row.id,
      phone: row.phone,
      fullName: row.full_name || '',
      role: row.role,
      plan: row.plan,
      smsOptIn: row.sms_opt_in,
      smsMonthlyCapPence: row.sms_monthly_cap_pence,
      smsCurrentSpendPence: row.sms_current_spend_pence,
      defaultPlate: row.default_plate || undefined,
      defaultProvinceCode: row.default_province_code || undefined,
      homeProvince: row.home_province || undefined,
      homeCity: row.home_city || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapVehicleRow(row: any): DbVehicle {
    return {
      id: row.id,
      plateNormalized: row.plate_normalized,
      plateDisplay: row.plate_display,
      make: row.make,
      model: row.model,
      color: row.color,
      verifiedOwnerId: row.verified_owner_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapVerificationRow(row: any): DbOwnershipVerification {
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      userId: row.user_id,
      documentName: row.document_name,
      documentType: row.document_type,
      documentUrl: row.document_url,
      status: row.status,
      adminNotes: row.admin_notes,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewedById: row.reviewed_by_id,
    };
  }

  private mapReportRow(row: any): DbReport {
    return {
      id: row.id,
      idempotencyKey: row.idempotency_key,
      plateNormalized: row.plate_normalized,
      category: row.category,
      issueCode: row.issue_code,
      issueTitle: row.issue_title,
      customNote: row.custom_note,
      location: row.location || '',
      photoUrl: row.photo_url,
      reporterId: row.reporter_id,
      status: row.status,
      disputeReason: row.dispute_reason,
      abuseReason: row.abuse_reason,
      recipientActionNote: row.recipient_action_note,
      createdAt: row.created_at,
    };
  }
}

export const db = new DatabaseService();
