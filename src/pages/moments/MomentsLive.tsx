import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, Minimize, ArrowLeft } from 'lucide-react';
import { useMomentsStore } from '../../store/useMomentsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
import SPSLogo from '../../components/SPSLogo';

export default function MomentsLive() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { photos, event, fetchPhotos } = useMomentsStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Require login
  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/moments/live' } });
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    await fetchPhotos(event?.id);
    setIsLoading(false);
  };

  // Auto-advance slideshow
  useEffect(() => {
    if (photos.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % photos.length);
    }, 5000); // 5 seconds per photo

    return () => clearInterval(interval);
  }, [photos.length]);

  // Realtime subscription for new photos
  useEffect(() => {
    if (!event?.id) return;

    const channel = supabase
      .channel('moments-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moments_photos',
          filter: `event_id=eq.${event.id}`
        },
        (payload) => {
          // Add new photo to beginning of array
          const newPhoto = payload.new as any;
          useMomentsStore.setState(state => ({
            photos: [newPhoto, ...state.photos]
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event?.id]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0C0A09] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#CA8A04] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#78716C] font-sans">Loading live gallery...</span>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 bg-[#0C0A09] flex items-center justify-center">
        <div className="text-center">
          <SPSLogo className="w-16 h-16 mx-auto mb-6 opacity-30" />
          <h2 className="text-2xl font-bold text-white mb-2 font-sans">Live Gallery</h2>
          <p className="text-sm text-[#78716C] font-sans">Waiting for photos...</p>
          <p className="text-xs text-[#57534E] mt-1 font-sans">Photos will appear here in real-time</p>
        </div>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="fixed inset-0 bg-[#0C0A09] overflow-hidden">
      {/* Background blur of current photo */}
      <div className="absolute inset-0">
        <img
          src={currentPhoto.photo_final}
          alt=""
          className="w-full h-full object-cover blur-[80px] opacity-30 scale-110"
        />
        <div className="absolute inset-0 bg-[#0C0A09]/70" />
      </div>

      {/* Main photo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhoto.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center justify-center p-8"
        >
          <img
            src={currentPhoto.photo_final}
            alt={`Moment ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.5)]"
          />
        </motion.div>
      </AnimatePresence>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20">
        <button
          onClick={() => navigate('/moments')}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer transition-colors hover:bg-black/60"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer transition-colors hover:bg-black/60"
        >
          {isFullscreen ? (
            <Minimize className="w-5 h-5 text-white" />
          ) : (
            <Maximize className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-white font-sans">
              {event?.name || 'Employee Gathering 2026'}
            </h2>
            <p className="text-xs text-[#A8A29E] font-sans">
              {event?.subtitle || 'FORWARD AS ONE'} • Live Gallery
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span className="text-xs text-[#16A34A] font-sans">LIVE</span>
            </div>
            <span className="text-xs text-[#78716C] font-sans">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-0.5 bg-[#1C1917] rounded-full overflow-hidden">
          <motion.div
            key={currentIndex}
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 5, ease: 'linear' }}
            className="h-full bg-[#CA8A04]"
          />
        </div>
      </div>

      {/* SPS Corner watermark */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-1.5 opacity-30">
          <SPSLogo className="w-4 h-4" />
          <span className="text-[10px] text-white tracking-wider font-sans">SPS Corner</span>
        </div>
      </div>
    </div>
  );
}
