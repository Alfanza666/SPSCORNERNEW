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
      
      // Get session to get email
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, name, nik, phone, balance, loyalty_points')
        .eq('id', userId)
        .single();

      if (error) throw error;
      set({ user: { ...data, email } as UserProfile, isLoading: false });
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
