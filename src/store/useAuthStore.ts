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
  fetchProfile: async (userId) => {
    try {
      set({ isLoading: true });
      
      // Get session email (may be fake NIK@sps.local for non-Google users)
      const { data: { session } } = await supabase.auth.getSession();
      const sessionEmail = session?.user?.email;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, name, nik, phone, email, balance, loyalty_points')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Prioritize email stored in profiles table (real email),
      // fall back to session email only if profiles.email is empty or fake
      const profileEmail = data?.email;
      const isFakeEmail = sessionEmail?.endsWith('@sps.local');
      const resolvedEmail = profileEmail || (!isFakeEmail ? sessionEmail : undefined);

      set({ user: { ...data, email: resolvedEmail } as UserProfile, isLoading: false });
    } catch (error) {
      console.error('Error fetching profile:', error);
      set({ user: null, isLoading: false });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
