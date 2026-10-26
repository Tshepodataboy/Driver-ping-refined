import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
import { db, DbUser } from './db.js';

export const apiRouter = express.Router();


// Use an explicitly configured secret in production. Never fall back to a
// hardcoded production secret: doing so could allow token forgery across deployments.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        'Startup blocked: JWT_SECRET must be configured with at least 32 characters in production.'
      );
    }
    return secret.trim();
  }

  // Backwards-compatible local development only.
  if (secret && secret.trim().length >= 16) return secret.trim();
  return 'driver_ping_dev_only_jwt_secret_not_for_prod';
}

const JWT_SECRET = getJwtSecret();

// Extend Express Request to carry authenticated user
export interface AuthenticatedRequest extends Request {
  user?: DbUser;
}

// Token helper
export function generateToken(user: DbUser): string {
  return jwt.sign(
    {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): { sub: string; role: string; phone: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; role: string; phone: string };
  } catch {
    return null;
  }
}
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE

/**
 * Strict Authenticate Middleware:
 * Validates cryptographic Bearer token.
 * NEVER trusts spoofed `x-user-id` header!
 * Rejects unauthenticated requests with 401.
 */
export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Please sign in or provide a valid Bearer token.',
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload || !payload.sub) {
    res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
    return;
  }

  const user = await db.getUserById(payload.sub);
  if (process.env.NODE_ENV === 'production' && user && ['usr_alex_001', 'usr_jordan_002', 'usr_admin_003'].includes(user.id)) {
    res.status(401).json({ error: 'Demo sessions are disabled in production. Please sign in with your account.' });
    return;
  }
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }

  req.user = user;
  next();
}

/**
 * Optional Authentication:
 * Attaches user if valid Bearer token is provided, without failing if absent.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    if (payload?.sub) {
      const user = await db.getUserById(payload.sub);
      if (user) req.user = user;
    }
  }
  next();
}

/**
 * Admin Role Guard:
 * Strictly verifies authenticated user has role === 'admin'.
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      error: 'Admin privileges required. Access denied.',
      verifications: [],
      items: [],
      logs: [],
    });
    return;
  }
  next();
}

// License Plate Normalization Helpers
export function normalizePlate(plate: string): string {
  return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatDisplayPlate(plate: string): string {
  const trimmed = plate.trim().toUpperCase();
  if (trimmed.includes(' ')) {
    return trimmed;
  }
  const norm = normalizePlate(plate);
  if (norm.length > 5) {
    return `${norm.slice(0, norm.length - 2)} ${norm.slice(norm.length - 2)}`;
  }
  return norm;
}

// 0. DATABASE & HEALTH STATUS
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

apiRouter.get('/db-status', (_req: Request, res: Response) => {
  const status = db.getStatus();
  res.json({
    status: 'ok',
    database: status,
    instructions: status.connectedToPostgres
      ? 'Connected directly to Supabase PostgreSQL.'
      : 'To connect to your Supabase project, set DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" in your .env file.',
  });
});

// 1. AUTHENTICATION & DEMO OTP


// Predefined Hackathon Demo Accounts (prevents arbitrary ID spoofing or admin privilege escalation)
export const ALLOWED_DEMO_ACCOUNT_IDS = new Set([
  'usr_alex_001',   // Verified Vehicle Owner (Alex Morgan)
  'usr_jordan_002', // Driver (Jordan Lee)
  'usr_admin_003',  // Compliance Admin (Admin Role)
]);

// Request 6-digit OTP (Treated as simulated prototype demo; never leaks code in public API)
apiRouter.post('/auth/request-otp', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string' || phone.trim().length < 6) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }

  const cleanPhone = phone.trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 min

  await db.createOtp(cleanPhone, code, expiresAt);

  // Security: Do NOT leak generated OTP through public API responses
  return res.json({
    success: true,
    message: process.env.NODE_ENV === 'production'
      ? 'If the number is eligible, a verification code will be sent.'
      : `Demo verification code simulated for ${cleanPhone}. In this local demo, enter code: 123456`,
  });
});

// Verify OTP & Sign In / Register (Clearly demo-only prototype flow)
apiRouter.post('/auth/verify-otp', async (req: Request, res: Response) => {
  const { phone, code, fullName } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code are required' });
  }

  const cleanPhone = phone.trim();
  const otpRecord = await db.getLatestUnverifiedOtp(cleanPhone);

  // The fixed code is for local demos only. Production must use a generated OTP.
  const isLocalDemoCode = process.env.NODE_ENV !== 'production' && code.trim() === '123456';
  const isValid = isLocalDemoCode || Boolean(otpRecord && otpRecord.code === code.trim());

  if (!isValid) {
    return res.status(401).json({
      error: 'Invalid or expired verification code.',
    });
  }

  if (otpRecord) {
    await db.markOtpVerified(otpRecord.id);
  }

  let user = await db.getUserByPhone(cleanPhone);
  let isNew = false;

  if (!user) {
    user = await db.createUser({
      phone: cleanPhone,
      fullName: fullName?.trim() || `Driver ${cleanPhone.slice(-4)}`,
      role: 'user', // New self-registered users are ALWAYS 'user' role, never 'admin'
      plan: 'free',
      smsOptIn: false,
      smsMonthlyCapPence: 500,
    });
    isNew = true;

    await db.createAuditLog({
      actorId: user.id,
      actionType: 'USER_REGISTERED_PHONE',
      targetId: user.id,
      targetType: 'user',
      detailsJson: { phone: cleanPhone, note: 'Demo phone registration' },
    });
  }

  // Issue real cryptographically signed JWT token
  const token = generateToken(user);

  return res.json({
    success: true,
    token,
    user,
    isNew,
  });
});

// Email/password authentication delegated to Supabase Auth.
// Supabase's email-confirmation setting must be enabled in the dashboard.
async function supabaseAuthRequest(path: string, body: Record<string, unknown>) {
  const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim().replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();
  if (!baseUrl || !anonKey) {
    throw new Error('Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in the deployment environment.');
  }
  const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({} as any));
  return { response, data };
}

apiRouter.post('/auth/email-login', async (req: Request, res: Response) => {
  const { email, password, fullName, mode } = req.body;
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (mode !== 'signup' && mode !== 'signin') return res.status(400).json({ error: 'Invalid authentication mode.' });

  const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim().replace(/\/$/, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();
  const displayName = typeof fullName === 'string' && fullName.trim() ? fullName.trim() : cleanEmail.split('@')[0];

  try {
    if (mode === 'signup') {
      // 1. Check if user already exists in database
      const existingUser = await db.getUserByPhone(cleanEmail);
      if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
      }

      let supabaseUserId: string | undefined;

      // 2. Register confirmed user in Supabase Auth via Admin API (bypasses email rate limits & confirms instantly)
      if (baseUrl && serviceKey) {
        try {
          const adminRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: cleanEmail,
              password,
              email_confirm: true,
              user_metadata: { full_name: displayName },
            }),
          });
          const adminData = await adminRes.json().catch(() => ({} as any));
          if (adminRes.ok && adminData?.id) {
            supabaseUserId = adminData.id;
          } else {
            const msg = String(adminData?.msg || adminData?.message || adminData?.error || '').toLowerCase();
            if (msg.includes('already') || msg.includes('registered') || msg.includes('exists') || adminRes.status === 422) {
              return res.status(409).json({ error: 'An account with this email already exists in Supabase. Try signing in.' });
            }
            console.warn('[Auth] Supabase admin create notice:', adminRes.status, adminData);
          }
        } catch (adminErr) {
          console.warn('[Auth] Supabase admin endpoint notice:', adminErr);
        }
      }

      // If Admin API was not used or failed, try public signup
      if (!supabaseUserId && baseUrl && anonKey) {
        try {
          const { response, data } = await supabaseAuthRequest('signup', {
            email: cleanEmail,
            password,
            data: { full_name: displayName },
          });
          if (response.ok && data?.user?.id) {
            supabaseUserId = data.user.id;
          } else {
            const detail = String(data?.msg || data?.message || data?.error_description || data?.error || '').toLowerCase();
            if (detail.includes('already') || detail.includes('registered') || detail.includes('exists')) {
              return res.status(409).json({ error: 'An account with this email already exists in Supabase. Try signing in.' });
            }
          }
        } catch (pubErr) {
          console.warn('[Auth] Supabase public signup notice:', pubErr);
        }
      }

      // 3. Store user record in Supabase PostgreSQL (users table)
      let user = await db.getUserByPhone(cleanEmail);
      if (!user) {
        user = await db.createUser({
          id: supabaseUserId || undefined,
          phone: cleanEmail,
          fullName: displayName,
          role: 'user',
          plan: 'free',
        });
        await db.setPasswordHash(user.id, password);
        await db.createAuditLog({
          actorId: user.id,
          actionType: 'USER_REGISTERED_EMAIL',
          targetId: user.id,
          targetType: 'user',
          detailsJson: { email: cleanEmail, provider: 'supabase' },
        });
      }

      // 4. Log the user in immediately!
      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user,
        isNew: true,
        message: 'Account created and signed in successfully.',
      });
    }

    // SIGNIN MODE:
    // 1. Check if user profile exists in database
    let user = await db.getUserByPhone(cleanEmail);
    let userExistsInSupabase = false;

    // Check if user exists in Supabase Auth via Admin API if available
    if (!user && baseUrl && serviceKey) {
      try {
        const adminCheckRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
          method: 'GET',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        });
        const adminCheckData = await adminCheckRes.json().catch(() => ({} as any));
        if (Array.isArray(adminCheckData?.users)) {
          userExistsInSupabase = adminCheckData.users.some(
            (u: any) => u.email?.toLowerCase() === cleanEmail
          );
        }
      } catch (checkErr) {
        console.warn('[Auth] Supabase user exist check notice:', checkErr);
      }
    }

    // 2. Try Supabase Auth password grant
    let supabaseSuccess = false;
    let supabaseUserData: any = null;

    if (baseUrl && anonKey) {
      try {
        const { response, data } = await supabaseAuthRequest('token?grant_type=password', {
          email: cleanEmail,
          password,
        });
        if (response.ok && data?.access_token && data?.user) {
          supabaseSuccess = true;
          supabaseUserData = data.user;
        }
      } catch (authErr) {
        console.warn('[Auth] Supabase password grant check notice:', authErr);
      }
    }

    // 3. Handle successful Supabase Auth sign in
    if (supabaseSuccess && supabaseUserData) {
      if (!user) {
        const dName = typeof supabaseUserData.user_metadata?.full_name === 'string'
          ? supabaseUserData.user_metadata.full_name
          : displayName;
        user = await db.createUser({
          id: supabaseUserData.id || undefined,
          phone: cleanEmail,
          fullName: dName,
          role: 'user',
          plan: 'free',
        });
        await db.setPasswordHash(user.id, password);
      }
      const token = generateToken(user);
      return res.json({ success: true, token, user, isNew: false });
    }

    // 4. Fallback: Check password stored in database
    if (user) {
      const storedHash = await db.getPasswordHash(cleanEmail);
      if (storedHash && storedHash === password) {
        const token = generateToken(user);
        return res.json({ success: true, token, user, isNew: false });
      }
    }

    // 5. If authentication failed, inform user specifically whether email doesn't exist or password was incorrect
    const accountExists = Boolean(user || userExistsInSupabase);
    if (!accountExists) {
      return res.status(404).json({
        error: 'No account exists with this email address. Please check your email or sign up for a new account.',
      });
    }

    return res.status(401).json({
      error: 'Incorrect password. Please verify your password and try again.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Auth] Email authentication error:', message);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

// Demo Account Login (Allows demo persona access)
apiRouter.post('/auth/demo-login', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  // If the user is currently authenticated with a real (non-demo) account, block switching
  if (req.user && !ALLOWED_DEMO_ACCOUNT_IDS.has(req.user.id)) {
    return res.status(403).json({
      error: 'Account switching is only available for demo accounts. Please sign out first to change accounts.',
    });
  }

  const { userId } = req.body;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Demo userId required' });
  }

  const cleanUserId = userId.trim();
  if (!ALLOWED_DEMO_ACCOUNT_IDS.has(cleanUserId)) {
    return res.status(403).json({
      error: 'Access denied: Only predefined demo accounts are permitted for demo sign-in.',
    });
  }

  const user = await db.getUserById(cleanUserId);
  if (!user) {
    return res.status(404).json({ error: 'Predefined demo user not found' });
  }

  const token = generateToken(user);
  return res.json({
    success: true,
    token,
    user,
  });
});

// Get current user profile (Requires valid Bearer token)
apiRouter.get('/auth/me', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

// Get demo accounts for switcher (Only provided to guests or active demo accounts)
apiRouter.get('/auth/demo-accounts', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user && !ALLOWED_DEMO_ACCOUNT_IDS.has(req.user.id)) {
    return res.json({ accounts: [] });
  }

  const accounts = await db.getDemoAccounts();
  return res.json({
    accounts: accounts.map((u) => ({
      id: u.id,
      phone: u.phone,
      fullName: u.fullName,
      role: u.role,
      plan: u.plan,
    })),
  });
});

// Update user preferences (SMS, Plan, Default Plate, Phone / Call Number, Name)
apiRouter.patch('/user/preferences', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { smsOptIn, smsMonthlyCapPence, plan, fullName, phone, defaultPlate, defaultProvinceCode } = req.body;

  const updated = await db.updateUserPreferences(user.id, {
    smsOptIn: typeof smsOptIn === 'boolean' ? smsOptIn : undefined,
    smsMonthlyCapPence: typeof smsMonthlyCapPence === 'number' && smsMonthlyCapPence >= 100 ? smsMonthlyCapPence : undefined,
    plan: plan === 'free' || plan === 'paid_owner' ? plan : undefined,
    fullName: typeof fullName === 'string' && fullName.trim() ? fullName.trim() : undefined,
    phone: typeof phone === 'string' && phone.trim() ? phone.trim() : undefined,
    defaultPlate: typeof defaultPlate === 'string' ? defaultPlate.trim().toUpperCase() : undefined,
    defaultProvinceCode: typeof defaultProvinceCode === 'string' ? defaultProvinceCode.trim().toUpperCase() : undefined,
  });

  if (!updated) {
    return res.status(500).json({ error: 'Failed to update user preferences' });
  }

  return res.json({ success: true, user: updated });
});

// ============================================================================
// 2. VEHICLE MANAGEMENT
// ============================================================================

// List current authenticated user's registered vehicles
apiRouter.get('/vehicles', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const vehicles = await db.getVehiclesForUser(user.id);
  return res.json({ vehicles });
});

// Register as a driver of a vehicle
apiRouter.post('/vehicles/register', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { plate, make, model, color } = req.body;

  if (!plate || typeof plate !== 'string') {
    return res.status(400).json({ error: 'Number plate is required' });
  }

  const norm = normalizePlate(plate);
  if (norm.length < 2 || norm.length > 14) {
    return res.status(400).json({ error: 'Invalid number plate format' });
  }

  let vehicle = await db.getVehicleByPlate(norm);

  // If vehicle doesn't exist, create it
  if (!vehicle) {
    vehicle = await db.createVehicle({
      plateNormalized: norm,
      plateDisplay: formatDisplayPlate(plate),
      make: make?.trim() || 'Vehicle',
      model: model?.trim() || '',
      color: color?.trim() || 'Standard',
    });
  }

  // Check if user is already registered for this vehicle
  const existingDriver = await db.getVehicleDriver(vehicle.id, user.id);
  if (existingDriver) {
    return res.status(400).json({
      error: `You are already registered for ${vehicle.plateDisplay} (${existingDriver.status})`,
    });
  }

  // Rule 5: If vehicle already has a verified owner, new driver must wait for owner's approval
  const hasVerifiedOwner = vehicle.verifiedOwnerId !== null;
  const status: 'approved' | 'pending_owner_approval' = hasVerifiedOwner
    ? 'pending_owner_approval'
    : 'approved';

  const newDriverRecord = await db.addDriverToVehicle({
    vehicleId: vehicle.id,
    userId: user.id,
    role: 'driver',
    status,
  });

  // Audit log
  await db.createAuditLog({
    actorId: user.id,
    actionType: hasVerifiedOwner ? 'DRIVER_REQUESTED_APPROVAL' : 'DRIVER_REGISTERED_VEHICLE',
    targetId: vehicle.id,
    targetType: 'vehicle',
    detailsJson: { plate: vehicle.plateDisplay, status },
  });

  return res.json({
    success: true,
    vehicle,
    driverRecord: newDriverRecord,
    message: hasVerifiedOwner
      ? `Registration submitted. Since this vehicle has a verified owner, your request is awaiting their approval.`
      : `Successfully registered as driver for ${vehicle.plateDisplay}!`,
  });
});

// Submit Proof of Ownership (Rule 4: Paid plan check + Admin review)
apiRouter.post('/vehicles/:id/submit-ownership', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  // Server-side plan check: Paying user only
  if (user.plan !== 'paid_owner') {
    return res.status(403).json({
      error: 'A Paid Owner Plan (R49/mo) is required to submit ownership verification documents.',
      requiresUpgrade: true,
    });
  }

  const { id } = req.params;
  const vehicle = await db.getVehicleById(id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const { documentName, documentType, documentUrl } = req.body;
  if (!documentName) {
    return res.status(400).json({ error: 'Document name and file are required' });
  }

  // Check if there's already a pending verification
  const existingPending = await db.getPendingVerification(vehicle.id, user.id);
  if (existingPending) {
    return res.status(400).json({ error: 'You already have a document submission pending review.' });
  }

  const verification = await db.createOwnershipVerification({
    vehicleId: vehicle.id,
    userId: user.id,
    documentName: documentName.trim(),
    documentType: documentType || 'v5c_logbook',
    documentUrl: documentUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
  });

  await db.createAuditLog({
    actorId: user.id,
    actionType: 'OWNERSHIP_DOC_SUBMITTED',
    targetId: vehicle.id,
    targetType: 'vehicle',
    detailsJson: { documentName: verification.documentName },
  });

  return res.json({
    success: true,
    verification,
    message: 'Ownership documentation submitted. Our compliance team will review your logbook shortly.',
  });
});

// Owner approves/rejects/removes a driver
apiRouter.post('/vehicles/:id/drivers/:driverId/:action', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id, driverId, action } = req.params;

  const vehicle = await db.getVehicleById(id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  // Access control: Only verified owner can manage drivers
  if (vehicle.verifiedOwnerId !== user.id) {
    return res.status(403).json({ error: 'Only the verified vehicle owner can manage driver access.' });
  }

  if (action !== 'approve' && action !== 'remove' && action !== 'reject') {
    return res.status(400).json({ error: 'Invalid action. Supported: approve, remove, reject' });
  }

  const success = await db.updateDriverStatus(driverId, action as any);
  if (!success) {
    return res.status(404).json({ error: 'Driver record not found or update failed' });
  }

  await db.createAuditLog({
    actorId: user.id,
    actionType: `DRIVER_${action.toUpperCase()}`,
    targetId: driverId,
    targetType: 'vehicle_driver',
    detailsJson: { vehicleId: vehicle.id, plate: vehicle.plateDisplay },
  });

  return res.json({ success: true, message: `Driver access updated (${action})` });
});

// Owner adds trusted contact (Rule 5: with consent)
apiRouter.post('/vehicles/:id/trusted-contacts', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const vehicle = await db.getVehicleById(id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  if (vehicle.verifiedOwnerId !== user.id) {
    return res.status(403).json({ error: 'Only the verified owner can add trusted contacts' });
  }

  const { name, phone, relationship, consentGiven } = req.body;
  if (!name || !phone || !consentGiven) {
    return res.status(400).json({ error: 'Name, phone, and contact consent are required' });
  }

  const tc = await db.createTrustedContact({
    vehicleId: vehicle.id,
    name: name.trim(),
    phone: phone.trim(),
    relationship: relationship?.trim() || 'Emergency Contact',
    consentGiven: true,
  });

  return res.json({ success: true, trustedContact: tc });
});

// Remove trusted contact
apiRouter.delete('/vehicles/:id/trusted-contacts/:tcId', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id, tcId } = req.params;

  const vehicle = await db.getVehicleById(id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  if (vehicle.verifiedOwnerId !== user.id) {
    return res.status(403).json({ error: 'Only the verified owner can remove trusted contacts' });
  }

  await db.deleteTrustedContact(tcId, id);
  return res.json({ success: true });
});

// ============================================================================
// 3. REPORTING (RULE 1, 2, 3, 8, 10)
// ============================================================================

// Create an anonymous report
apiRouter.post('/reports', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  const { plate, category, issueCode, issueTitle, customNote, photoUrl, idempotencyKey } =
    req.body;

  if (!plate || !category || !issueCode || !issueTitle) {
    return res.status(400).json({ error: 'Plate, category, and issue selection are required' });
  }

  const validCategories = ['vehicle_condition', 'driver_behaviour', 'road_violation'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const norm = normalizePlate(plate);
  if (norm.length < 2 || norm.length > 14) {
    return res.status(400).json({ error: 'Invalid plate number' });
  }

  // Idempotency check: if client sent an idempotencyKey that already exists
  if (idempotencyKey) {
    const existing = await db.getReportByIdempotencyKey(idempotencyKey);
    if (existing) {
      return res.json({
        success: true,
        reportId: existing.id,
        isDuplicatePrevented: true,
        message: 'Report already received (idempotency match).',
      });
    }
  }

  // Anti-Spam Rule: max 8 reports per user per hour
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const recentUserReports = await db.getRecentReportsByUser(user.id, oneHourAgo);
  if (recentUserReports.length >= 8) {
    return res.status(429).json({
      error: 'Hourly report limit reached. Please wait before submitting another report.',
    });
  }

  // Duplicate submission protection: prevent identical issue on same plate submitted within 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60000).toISOString();
  const duplicateRecent = await db.getRecentDuplicateReport(norm, issueCode, fifteenMinutesAgo);
  if (duplicateRecent) {
    return res.status(409).json({
      error: 'An identical alert for this vehicle was already received a few minutes ago.',
      isDuplicatePrevented: true,
    });
  }

  // Create report in database (Strict privacy: reporterId stored in protected table only)
  const report = await db.createReport({
    plateNormalized: norm,
    category,
    issueCode,
    issueTitle: issueTitle.trim(),
    customNote: customNote ? customNote.trim().slice(0, 500) : '',
    photoUrl: photoUrl || '',
    reporterId: user.id,
    idempotencyKey,
  });

  // Delivery handling: Find all users whose registered plate or vehicle matches this report's number plate
  const targetUsers = await db.getUsersForPlate(norm);

  let deliveryCount = 0;
  let queuedUnclaimed = false;

  if (targetUsers.length > 0) {
    for (const recipientUser of targetUsers) {
      // In-app delivery log for each user whose registered plate matches
      await db.createDeliveryLog({
        reportId: report.id,
        channel: 'in_app',
        recipientUserId: recipientUser.id,
        status: 'delivered',
        costPence: 0,
      });
      deliveryCount++;

      // SMS Delivery if recipient opted in and within spending limit (Rule 7)
      if (recipientUser.smsOptIn) {
        const smsCost = 15; // 15p per SMS (R1.50)
        if (recipientUser.smsCurrentSpendPence + smsCost <= recipientUser.smsMonthlyCapPence) {
          await db.updateUserPreferences(recipientUser.id, {
            smsCurrentSpendPence: recipientUser.smsCurrentSpendPence + smsCost,
          });
          await db.createDeliveryLog({
            reportId: report.id,
            channel: 'sms',
            recipientUserId: recipientUser.id,
            status: 'delivered',
            costPence: smsCost,
          });
        } else {
          // Monthly SMS cap reached
          await db.createDeliveryLog({
            reportId: report.id,
            channel: 'sms',
            recipientUserId: recipientUser.id,
            status: 'capped_limit',
            costPence: 0,
          });
        }
      }
    }
  } else {
    // Vehicle is not registered on Driver Ping yet
    queuedUnclaimed = true;
    await db.createDeliveryLog({
      reportId: report.id,
      channel: 'in_app',
      recipientUserId: null,
      status: 'queued_unclaimed',
      costPence: 0,
    });
  }

  // Audit log
  await db.createAuditLog({
    actorId: user.id,
    actionType: 'REPORT_SUBMITTED',
    targetId: report.id,
    targetType: 'report',
    detailsJson: {
      plateNormalized: norm,
      category,
      issueCode,
      deliveriesRecorded: deliveryCount,
      queuedUnclaimed,
    },
  });

  return res.json({
    success: true,
    reportId: report.id,
    plateDisplay: formatDisplayPlate(plate),
    deliveriesRecorded: deliveryCount,
    isQueuedUnclaimed: queuedUnclaimed,
    statusMessage: queuedUnclaimed
      ? `Recorded securely. ${formatDisplayPlate(plate)} is not yet registered by an active driver on Driver Ping — the alert has been safely queued and will be delivered once registered.`
      : `Delivered safely to ${deliveryCount} registered driver(s) in-app.`,
  });
});

// 4. ALERTS FEED & ACTIONS (RULE 6, 8, 10)

// Get alerts for the authenticated user's vehicles (STRICT REPORTER PRIVACY PROTECTED)
apiRouter.get('/alerts', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const sanitizedAlerts = await db.getSanitizedAlertsForUser(user.id);
  return res.json({ alerts: sanitizedAlerts });
});

// Update alert status (dismiss, resolve, dispute, flag abuse) (Rule 6)
apiRouter.post('/alerts/:id/action', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { action, note, reason } = req.body;

  const report = await db.getReportById(id);
  if (!report) return res.status(404).json({ error: 'Alert not found' });

  // Access control: Verify recipient owns or drives this vehicle, has registered plate, or is admin
  const targetUsers = await db.getUsersForPlate(report.plateNormalized);
  const isRecipient = targetUsers.some((u) => u.id === user.id);
  const isAuthorized = isRecipient || user.role === 'admin';

  if (!isAuthorized) {
    return res.status(403).json({ error: 'You are not authorized to update this vehicle alert' });
  }

  let statusToSet: 'resolved' | 'dismissed' | 'disputed' | 'flagged_abuse' = 'resolved';
  let recipientActionNote: string | undefined;
  let disputeReason: string | undefined;
  let abuseReason: string | undefined;

  if (action === 'resolve') {
    statusToSet = 'resolved';
    recipientActionNote = note || 'Checked and read by driver.';
  } else if (action === 'dismiss') {
    statusToSet = 'dismissed';
    recipientActionNote = 'Acknowledged and dismissed.';
  } else if (action === 'dispute') {
    statusToSet = 'disputed';
    disputeReason = reason || 'Driver states observation is incorrect or invalid.';
  } else if (action === 'flag_abuse') {
    statusToSet = 'flagged_abuse';
    abuseReason = reason || 'Marked as malicious harassment or false report.';
  } else {
    return res.status(400).json({ error: 'Invalid alert action' });
  }

  await db.updateReportStatus(report.id, statusToSet, {
    recipientActionNote,
    disputeReason,
    abuseReason,
  });

  await db.createAuditLog({
    actorId: user.id,
    actionType: `ALERT_${action.toUpperCase()}`,
    targetId: report.id,
    targetType: 'report',
    detailsJson: { action, reason: reason || note },
  });

  const updatedReport = await db.getReportById(id);
  return res.json({ success: true, status: statusToSet, report: updatedReport });
});
// 5. ADMIN AREA (RULE 9)

// Get pending ownership verifications
apiRouter.get('/admin/verifications', authenticateUser, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const list = await db.getOwnershipVerificationsWithDetails();
  return res.json({ verifications: list });
});

// Admin review action (approve/reject)
apiRouter.post('/admin/verifications/:id/review', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const admin = req.user!;
  const { id } = req.params;
  const { decision, notes } = req.body; // 'approved' or 'rejected'

  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).json({ error: 'Decision must be approved or rejected' });
  }

  const success = await db.reviewOwnershipVerification(id, admin.id, decision, notes);
  if (!success) {
    return res.status(404).json({ error: 'Verification submission not found' });
  }

  await db.createAuditLog({
    actorId: admin.id,
    actionType: `OWNERSHIP_DOC_${decision.toUpperCase()}`,
    targetId: id,
    targetType: 'ownership_verification',
    detailsJson: { notes },
  });

  return res.json({ success: true, message: `Verification ${decision}` });
});

// Get disputes & abuse reports
apiRouter.get('/admin/disputes-abuse', authenticateUser, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const items = await db.getFlaggedReportsForAdmin();
  return res.json({ items });
});

// Admin takes action on dispute/abuse report
apiRouter.post('/admin/disputes-abuse/:id/action', authenticateUser, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const admin = req.user!;
  const { id } = req.params;
  const { decision, notes } = req.body; // 'dismiss_flag', 'uphold_abuse', 'delete_report'

  const report = await db.getReportById(id);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  let newStatus: 'received' | 'dismissed' = 'received';
  if (decision === 'dismiss_flag') {
    newStatus = 'received';
  } else if (decision === 'delete_report' || decision === 'uphold_abuse') {
    newStatus = 'dismissed';
  }

  await db.updateReportStatus(report.id, newStatus);

  await db.createAuditLog({
    actorId: admin.id,
    actionType: `ADMIN_DISPUTE_${decision.toUpperCase()}`,
    targetId: report.id,
    targetType: 'report',
    detailsJson: { decision, notes },
  });

  return res.json({ success: true, message: 'Dispute action recorded' });
});

// Get audit logs
apiRouter.get('/admin/audit-logs', authenticateUser, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const logs = await db.getAuditLogs();
  return res.json({ logs });
});

