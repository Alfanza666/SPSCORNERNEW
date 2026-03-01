import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const envUrl = import.meta.env?.VITE_SUPABASE_URL;
// @ts-ignore
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = typeof envUrl === 'string' && envUrl.startsWith('http') ? envUrl : 'https://jofwebrbdlovwkgklwab.supabase.co';
const supabaseAnonKey = typeof envKey === 'string' && envKey.trim() !== '' ? envKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvZndlYnJiZGxvdndrZ2tsd2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTE5MDcsImV4cCI6MjA4NjM2NzkwN30.IrE35WW20exM7xRInNitRKqVqgrqsLurRFC2c09C0GY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
