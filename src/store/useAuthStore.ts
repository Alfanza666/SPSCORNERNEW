import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  role: 'superadmin' | 'admin' | 'seller' | 'buyer';
  name: string;
  email?: string;
  nik?: string;
  phone?: string;
  balance: number;
  loyalty_points?: number;
  profile?: {
    name: string;
    nik?: string;
  };
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
        .select('id, role, name, nik, phone, balance, loyalty_points')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile - details:', error);
        throw error;
      }

      if (!data) {
        console.warn('Profile not found for userId:', userId);
        set({ user: null, isLoading: false });
        return;
      }

      // Use session email as fallback (profiles table does not have email column)
      const isFakeEmail = sessionEmail?.endsWith('@sps.local');
      const resolvedEmail = !isFakeEmail ? sessionEmail : undefined;

      set({ user: { ...data, email: resolvedEmail } as UserProfile, isLoading: false });
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
