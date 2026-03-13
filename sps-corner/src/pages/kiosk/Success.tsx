import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Printer, ArrowRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function Success() {
  const navigate = useNavigate();

  useEffect(() => {
    const duration = 4 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    const timer = setTimeout(() => {
      navigate('/kiosk');
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [navigate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-30">
        <div className="absolute top-0 left-0 w-64 h-64 sm:w-96 sm:h-96 bg-blue-200 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-amber-200 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.8 }}
        className="text-center max-w-lg w-full glass-card p-8 sm:p-12 md:p-16 shadow-2xl shadow-blue-200/50 border-zinc-200/60 relative"
      >
        {/* Floating Stars */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
          className="absolute -top-4 -left-4 sm:-top-6 sm:-left-6 text-amber-400"
        >
          <Star className="w-8 h-8 sm:w-12 sm:h-12 fill-current" />
        </motion.div>
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 text-amber-400"
        >
          <Star className="w-6 h-6 sm:w-10 sm:h-10 fill-current" />
        </motion.div>

        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 sm:w-40 sm:h-40 bg-blue-500 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 sm:mb-10 shadow-xl shadow-blue-200"
        >
          <CheckCircle2 className="w-12 h-12 sm:w-24 sm:h-24 text-white stroke-[1.5]" />
        </motion.div>

        <h1 className="text-3xl sm:text-5xl font-black text-zinc-900 mb-3 sm:mb-6 tracking-tight">
          Yuhuu! Berhasil.
        </h1>
        <p className="text-base sm:text-xl text-zinc-500 mb-8 sm:mb-12 leading-relaxed px-2">
          Terima kasih telah berbelanja di <span className="text-blue-600 font-bold">SPS Corner</span>. Pesananmu sudah tercatat dan siap untuk dinikmati!
        </p>

        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={handlePrint}
            className="btn-secondary h-12 sm:h-16 text-sm sm:text-lg flex items-center justify-center gap-2 sm:gap-3 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900"
          >
            <Printer className="w-4 h-4 sm:w-6 sm:h-6" />
            Cetak Struk
          </button>
          <button
            onClick={() => navigate('/kiosk')}
            className="btn-primary h-12 sm:h-16 text-sm sm:text-lg flex items-center justify-center gap-2 sm:gap-3 shadow-blue-600/20 group"
          >
            <ShoppingBag className="w-4 h-4 sm:w-6 sm:h-6" />
            Pesan Lagi
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-zinc-100">
          <p className="text-zinc-400 text-xs sm:text-sm font-medium">
            Halaman ini akan kembali otomatis dalam beberapa saat...
          </p>
        </div>
      </motion.div>
    </div>
  );
}
