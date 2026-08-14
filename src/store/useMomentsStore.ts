import { create } from 'zustand';

interface MomentsEvent {
  id: string;
  name: string;
  subtitle: string;
  is_active: boolean;
}

interface MomentsFrame {
  id: string;
  event_id: string;
  name: string;
  image_url: string;
  source: string;
  is_active: boolean;
  sort_order: number;
}

interface MomentsPhoto {
  id: string;
  event_id: string;
  frame_id: string | null;
  user_id: string | null;
  photo_raw: string;
  photo_final: string;
  likes: number;
  is_featured: boolean;
  is_hidden: boolean;
  created_at: string;
}

interface MomentsStore {
  event: MomentsEvent | null;
  frames: MomentsFrame[];
  selectedFrame: MomentsFrame | null;
  photos: MomentsPhoto[];
  isLoading: boolean;
  error: string | null;

  fetchEvent: () => Promise<void>;
  fetchFrames: () => Promise<void>;
  setSelectedFrame: (frame: MomentsFrame | null) => void;
  fetchPhotos: (eventId?: string) => Promise<void>;
  savePhoto: (photoData: {
    event_id?: string;
    frame_id?: string;
    photo_raw_base64: string;
    photo_final_base64: string;
    device_info?: Record<string, unknown>;
  }) => Promise<MomentsPhoto | null>;
  likePhoto: (photoId: string) => Promise<void>;
  clearError: () => void;
}

export const useMomentsStore = create<MomentsStore>((set, get) => ({
  event: null,
  frames: [],
  selectedFrame: null,
  photos: [],
  isLoading: false,
  error: null,

  fetchEvent: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await fetch('/api/moments/event');
      const data = await res.json();
      if (data.success) {
        set({ event: data.event });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch event';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchFrames: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await fetch('/api/moments/frames');
      const data = await res.json();
      if (data.success) {
        set({ frames: data.frames });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch frames';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedFrame: (frame) => set({ selectedFrame: frame }),

  fetchPhotos: async (eventId?: string) => {
    try {
      set({ isLoading: true, error: null });
      const { data: { session } } = await (await import('../lib/supabase')).supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const params = new URLSearchParams();
      if (eventId) params.set('event_id', eventId);

      const res = await fetch(`/api/moments/photos?${params}`, { headers });
      const data = await res.json();
      if (data.success) {
        set({ photos: data.photos });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch photos';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  savePhoto: async (photoData) => {
    try {
      set({ isLoading: true, error: null });
      const res = await fetch('/api/moments/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photoData)
      });
      const data = await res.json();
      if (data.success) {
        set((state) => ({ photos: [data.photo, ...state.photos] }));
        return data.photo;
      }
      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save photo';
      set({ error: message });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  likePhoto: async (photoId: string) => {
    try {
      await fetch(`/api/moments/photo/${photoId}/like`, { method: 'POST' });
      set((state) => ({
        photos: state.photos.map(p =>
          p.id === photoId ? { ...p, likes: p.likes + 1 } : p
        )
      }));
    } catch (error: unknown) {
      console.error('Failed to like photo:', error);
    }
  },

  clearError: () => set({ error: null })
}));
