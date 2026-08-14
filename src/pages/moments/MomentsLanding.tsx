import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Camera, LogIn, UserCircle } from 'lucide-react';
import { useMomentsStore } from '../../store/useMomentsStore';
import { useAuthStore } from '../../store/useAuthStore';
import SPSLogo from '../../components/SPSLogo';

export default function MomentsLanding() {
  const navigate = useNavigate();
  const { event, fetchEvent } = useMomentsStore();
  const { user } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [showChoice, setShowChoice] = useState(false);

  useEffect(() => {
    fetchEvent();
    const timer = setTimeout(() => setIsReady(true), 800);
    return () => clearTimeout(timer);
  }, [fetchEvent]);

  const handleStartCamera = () => {
    navigate('/moments/camera');
  };

  const handleLogin = () => {
    navigate('/login', { state: { from: '/moments' } });
  };

  const handleMainButton = () => {
    if (user) {
      // Sudah login, langsung ke kamera
      handleStartCamera();
    } else {
      // Belum login, tampilkan pilihan
      setShowChoice(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0C0A09] flex flex-col items-center justify-center overflow-hidden">
      {/* Background decorative elements - Liquid Glass effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#CA8A04]/8 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-[#1C1917]/60 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#CA8A04]/5 to-transparent rounded-full blur-[80px]" />
      </div>

      {/* Glass overlay effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0C0A09]/50 to-[#0C0A09]" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: isReady ? 1 : 0, y: isReady ? 0 : 30 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg"
      >
        {/* Event Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-[#CA8A04]/20 bg-[#CA8A04]/5 backdrop-blur-xl">
            <div className="w-1.5 h-1.5 rounded-full bg-[#CA8A04] animate-pulse" />
            <span className="text-[#CA8A04] text-xs font-medium tracking-[0.2em] uppercase font-sans">
              {event?.name || 'Employee Gathering 2026'}
            </span>
          </div>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-6xl md:text-8xl font-bold text-white mb-5 tracking-tight font-sans leading-[0.9]"
        >
          {event?.subtitle || 'FORWARD AS ONE'}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-base md:text-lg text-[#A8A29E] mb-14 font-light tracking-wide font-sans"
        >
          Capture Your Moment
        </motion.p>

        {/* Main Button or Choice */}
        {!showChoice ? (
          <motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleMainButton}
            className="group relative inline-flex items-center gap-3 px-10 py-5 bg-[#CA8A04] text-[#0C0A09] font-semibold rounded-2xl shadow-[0_8px_32px_rgba(202,138,4,0.25)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(202,138,4,0.35)] cursor-pointer"
          >
            <Camera className="w-5 h-5" />
            <span className="text-base tracking-wide font-sans">
              {user ? 'START CAMERA' : 'MULAI FOTO'}
            </span>
            <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3 w-full max-w-xs"
          >
            {/* Login Button */}
            <button
              onClick={handleLogin}
              className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#CA8A04] text-[#0C0A09] font-semibold rounded-2xl shadow-[0_8px_32px_rgba(202,138,4,0.25)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(202,138,4,0.35)] cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              <span className="text-sm tracking-wide font-sans">Login (Tanpa Watermark)</span>
            </button>

            {/* Guest Button */}
            <button
              onClick={handleStartCamera}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#1C1917] text-white font-medium rounded-2xl border border-[#44403C] transition-all duration-300 hover:bg-[#292524] cursor-pointer"
            >
              <UserCircle className="w-5 h-5" />
              <span className="text-sm tracking-wide font-sans">Lanjut sebagai Guest</span>
            </button>

            {/* Info */}
            <p className="text-[10px] text-[#57534E] font-sans mt-2">
              Login untuk download HD tanpa watermark & foto tersimpan ke akun
            </p>

            {/* Back button */}
            <button
              onClick={() => setShowChoice(false)}
              className="text-xs text-[#78716C] font-sans hover:text-white cursor-pointer mt-2"
            >
              Kembali
            </button>
          </motion.div>
        )}

        {/* SPS Corner Logo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="mt-20 flex flex-col items-center gap-3"
        >
          <SPSLogo className="w-7 h-7 opacity-40" />
          <span className="text-[10px] text-[#57534E] tracking-[0.3em] uppercase font-sans">SPS Corner</span>
        </motion.div>
      </motion.div>

      {/* Loading overlay */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: isReady ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-[#0C0A09] flex items-center justify-center pointer-events-none z-50"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-[#CA8A04] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#CA8A04] text-xs tracking-widest uppercase font-sans">Loading</span>
        </div>
      </motion.div>
    </div>
  );
}
