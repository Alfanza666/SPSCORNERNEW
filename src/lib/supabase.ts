import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env?.VITE_SUPABASE_URL;
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!envUrl || !envKey) {
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
}

export const supabaseUrl = envUrl;
export const supabaseAnonKey = envKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
