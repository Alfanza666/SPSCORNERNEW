import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  role: 'superadmin' | 'admin' | 'seller' | 'buyer';
  name: string;
  email?: string;
  nik?: string;
  phone?: string;
  avatar_url?: string;
  balance: number;
  loyalty_points?: number;
  isEmployee?: boolean;
  profile?: {
    name: string;
    nik?: string;
  };
}

export function isEmployeeNik(nik?: string): boolean {
  if (!nik) return false;
  return /^[0-9Mm]/.test(nik.trim());
}

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  fetchProfile: async (userId: string) => {
    try {
      set({ isLoading: true });
      
      // Get session email (may be fake NIK@sps.local for non-Google users)
      const { data: { session } } = await supabase.auth.getSession();
      const sessionEmail = session?.user?.email;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, name, nik, phone, avatar_url, balance, loyalty_points')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile - details:', error);
        
        // For OAuth users without a profile yet, provide a default profile to avoid redirect loops
        const defaultUser: UserProfile = {
          id: userId,
          role: 'buyer',
          name: session?.user?.user_metadata?.full_name || 'User',
          email: sessionEmail?.endsWith('@sps.local') ? undefined : sessionEmail,
          balance: 0,
          loyalty_points: 0,
          isEmployee: false
        };
        set({ user: defaultUser, isLoading: false });
        return;
      }

      // Use session email as fallback (profiles table does not have email column)
      const isFakeEmail = sessionEmail?.endsWith('@sps.local');
      const resolvedEmail = !isFakeEmail ? sessionEmail : undefined;

      set({ user: { ...data, email: resolvedEmail, isEmployee: isEmployeeNik(data?.nik) } as UserProfile, isLoading: false });
    } catch (error: any) {
      console.error('Error fetching profile:', error?.message || error);
      // Don't set user to null on error - keep trying or let user retry
      set({ isLoading: false });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
