import { createClient } from '@supabase/supabase-js';

const getEnvVar = (viteKey: string, nodeKey: string): string | undefined => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  if (metaEnv && metaEnv[viteKey]) return String(metaEnv[viteKey]).trim();
  if (typeof process !== 'undefined' && process.env && process.env[nodeKey]) {
    return String(process.env[nodeKey]).trim();
  }
  return undefined;
};

const supabaseUrl =
  getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL') || 'https://bbuzczlmgyzynfxhgplx.supabase.co';
const supabaseAnonKey =
  getEnvVar('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY') ||
  'sb_publishable_im-ovdirSTH8NtGk7IQ66Q_beaLuT6g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
