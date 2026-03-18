import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Printer, ArrowRight, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function Success() {
  const navigate = useNavigate();
  const [currentTime] = useState(new Date());

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
        <div className="absolute top-0 left-0 w-40 h-40 sm:w-64 sm:h-64 bg-blue-200 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-40 h-40 sm:w-64 sm:h-64 bg-amber-200 rounded-full blur-2xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.8 }}
        className="text-center max-w-md w-full clay-card p-6 sm:p-8 relative"
      >
        {/* Floating Stars */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
          className="absolute -top-3 -left-3 sm:-top-5 sm:-left-5 text-amber-400 drop-shadow-lg"
        >
          <Star className="w-6 h-6 sm:w-10 sm:h-10 fill-current" />
        </motion.div>
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          className="absolute -bottom-3 -right-3 sm:-bottom-5 sm:-right-5 text-amber-400 drop-shadow-lg"
        >
          <Star className="w-5 h-5 sm:w-8 sm:h-8 fill-current" />
        </motion.div>

        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-md"
        >
          <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-white stroke-[1.5]" />
        </motion.div>

        <h1 className="text-xl sm:text-3xl font-black text-zinc-900 mb-2 sm:mb-3 tracking-tight">
          Yuhuu! Berhasil.
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mb-4 sm:mb-6 leading-relaxed px-2 font-medium">
          Terima kasih telah berbelanja di <span className="text-blue-600 font-black">SPS Corner</span>. Pesananmu sudah tercatat dan siap untuk dinikmati!
        </p>

        <div className="bg-zinc-50 rounded-xl p-3 sm:p-4 mb-6 sm:mb-8 border border-zinc-100 flex flex-col items-center justify-center gap-1.5 shadow-inner">
          <p className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest">Waktu Transaksi</p>
          <div className="flex items-center gap-2 text-zinc-800 font-mono font-bold text-sm sm:text-base">
            <Clock className="w-4 h-4 text-blue-500" />
            {format(currentTime, 'dd MMM yyyy, HH:mm:ss', { locale: id })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
          <button
            onClick={handlePrint}
            className="btn-clay-secondary h-10 sm:h-12 text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
            Cetak Struk
          </button>
          <button
            onClick={() => navigate('/kiosk')}
            className="btn-clay-primary h-10 sm:h-12 text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 group"
          >
            <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4" />
            Pesan Lagi
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-zinc-100 border-dashed">
          <p className="text-zinc-400 text-[8px] sm:text-[10px] font-bold tracking-wide">
            Halaman ini akan kembali otomatis dalam beberapa saat...
          </p>
        </div>
      </motion.div>
    </div>
  );
}
