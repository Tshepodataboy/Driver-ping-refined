import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://bbuzczlmgvzyvnfxhgplx.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_im-ovdirSTH8NtGk7IQ66Q_beaLuT6g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
