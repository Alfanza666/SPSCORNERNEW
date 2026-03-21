import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const envUrl = import.meta.env?.VITE_SUPABASE_URL;
// @ts-ignore
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl = typeof envUrl === 'string' && envUrl.startsWith('http') ? envUrl : 'https://jofwebrbdlovwkgklwab.supabase.co';
export const supabaseAnonKey = typeof envKey === 'string' && envKey.trim() !== '' ? envKey : 'sb_publishable_n4yagUnGhlpqiEBDwtzhwg_Sfvy8F8v';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
