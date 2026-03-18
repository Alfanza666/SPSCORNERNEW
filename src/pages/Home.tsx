import { Link } from 'react-router-dom';
import { Store, UserCircle, ArrowRight, ShieldCheck, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/FEDERASI RIKAT PEKERJ SUKSES.png';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#e8ebf0] flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-200/30 rounded-full blur-[80px] sm:blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-200/30 rounded-full blur-[80px] sm:blur-[120px] -z-10 animate-pulse" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-4xl w-full text-center z-10"
      >
        <div className="mb-6 sm:mb-10">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white text-blue-700 text-[8px] sm:text-[10px] font-bold mb-4 sm:mb-6 shadow-inner border border-zinc-50 uppercase tracking-widest"
          >
            <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            Kantin Digital Karyawan Sariroti
          </motion.div>
          
          <div className="flex justify-center mb-4 sm:mb-6">
            <motion.img 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              src={Logo} 
              alt="SPS Corner Logo" 
              className="h-12 sm:h-20 w-auto object-contain drop-shadow-md" 
            />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 mb-2 tracking-tighter leading-tight">
            SPS <span className="text-blue-600">Corner</span>
          </h1>
          <p className="text-xs sm:text-base text-zinc-500 max-w-xl mx-auto leading-relaxed px-4 font-medium tracking-tight">
            Solusi cerdas untuk transaksi kantin yang lebih cepat, aman, dan transparan bagi seluruh karyawan Sariroti.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 max-w-3xl mx-auto px-4">
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to="/kiosk" className="group block h-full">
              <div className="clay-card h-full p-4 sm:p-5 text-left transition-all duration-500 group-hover:bg-blue-50/50">
                <div className="clay-icon-blue w-8 h-8 sm:w-10 sm:h-10 mb-3 sm:mb-4">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 mb-1.5 flex items-center gap-1.5 tracking-tighter">
                  Mode Kiosk
                  <ArrowRight className="w-3 h-3 text-blue-600 group-hover:translate-x-2 transition-transform" />
                </h3>
                <p className="text-zinc-500 text-[10px] sm:text-xs leading-relaxed font-medium">
                  Pesan makanan dan minuman favoritmu secara mandiri dengan sistem pembayaran yang mudah.
                </p>
              </div>
            </Link>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to="/login" className="group block h-full">
              <div className="clay-card h-full p-4 sm:p-5 text-left transition-all duration-500 group-hover:bg-amber-50/50">
                <div className="clay-icon-amber w-8 h-8 sm:w-10 sm:h-10 mb-3 sm:mb-4">
                  <UserCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 mb-1.5 flex items-center gap-1.5 tracking-tighter">
                  Masuk Akun
                  <ArrowRight className="w-3 h-3 text-amber-500 group-hover:translate-x-2 transition-transform" />
                </h3>
                <p className="text-zinc-500 text-[10px] sm:text-xs leading-relaxed font-medium">
                  Akses dashboard untuk mengelola produk, melihat riwayat transaksi, atau melakukan penarikan saldo.
                </p>
              </div>
            </Link>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 sm:mt-12 pt-4 flex flex-col items-center gap-3 sm:gap-5"
        >
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 text-zinc-400 font-bold text-[8px] sm:text-[10px] uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-600 shadow-sm" />
              Aman & Terpercaya
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-amber-400 shadow-sm" />
              Cepat & Efisien
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 shadow-sm" />
              Transparan
            </div>
          </div>
          
          <div className="text-zinc-400 font-bold text-center">
            <div className="flex items-center justify-center gap-4 mb-4 text-[10px] sm:text-xs">
              <Link to="/terms" className="hover:text-blue-600 transition-colors">Syarat & Ketentuan</Link>
              <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
              <Link to="/contact" className="hover:text-blue-600 transition-colors">Hubungi Kami</Link>
            </div>
            <div className="clay-card inline-block px-2 py-1 bg-white/50 mb-2">
              <p className="font-bold tracking-widest text-[8px]">v3.0.0-clay-edition</p>
            </div>
            <p className="text-[6px] sm:text-[8px] uppercase tracking-widest opacity-50">Dikembangkan oleh SPS Corner Team</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
