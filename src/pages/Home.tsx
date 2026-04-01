import { Link } from 'react-router-dom';
import { Store, UserCircle, ArrowRight, ShieldCheck, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/FEDERASI RIKAT PEKERJ SUKSES.png';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-[#050505] flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden relative transition-colors duration-500">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15)_0%,transparent_50%)] opacity-0 dark:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-0 dark:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-300/30 dark:bg-blue-600/20 rounded-full blur-[100px] sm:blur-[150px] -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-amber-300/30 dark:bg-amber-600/15 rounded-full blur-[100px] sm:blur-[150px] -z-10 animate-pulse" style={{ animationDuration: '10s' }} />

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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white dark:bg-zinc-900/50 text-blue-700 dark:text-blue-400 text-[8px] sm:text-[10px] font-bold mb-4 sm:mb-6 shadow-inner dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-zinc-50 dark:border-zinc-800/50 uppercase tracking-widest backdrop-blur-md transition-all hover:dark:bg-zinc-800/80"
          >
            <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 dark:text-blue-400" />
            Pusat Belanja Karyawan Sariroti
          </motion.div>
          
          <div className="flex justify-center mb-4 sm:mb-6 relative">
            <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/40 blur-3xl rounded-full scale-75 opacity-0 dark:opacity-100 transition-opacity duration-500" />
            <motion.img 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              src={Logo} 
              alt="SPS Corner Logo" 
              className="h-20 sm:h-32 w-auto object-contain drop-shadow-md dark:drop-shadow-[0_0_25px_rgba(255,255,255,0.15)] relative z-10" 
            />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-white mb-2 tracking-tighter leading-tight transition-colors">
            SPS <span className="text-blue-600 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-blue-400 dark:via-blue-500 dark:to-blue-600">Corner</span>
          </h1>
          <p className="text-xs sm:text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed px-4 font-medium tracking-tight transition-colors">
            Solusi cerdas untuk transaksi berbagai kebutuhan, mulai dari produk digital, produk Sariroti, hingga makanan & minuman bagi seluruh karyawan Sariroti.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 max-w-3xl mx-auto px-4">
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to="/kiosk" className="group block h-full">
              <div className="clay-card h-full p-4 sm:p-5 text-left transition-all duration-500 group-hover:bg-blue-50/50 dark:bg-zinc-900/30 dark:backdrop-blur-2xl dark:border-zinc-800/50 dark:group-hover:bg-zinc-800/60 dark:group-hover:border-blue-500/50 dark:group-hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 dark:group-hover:from-blue-500/10 transition-colors duration-500 pointer-events-none" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full opacity-0 dark:group-hover:opacity-100 transition-opacity duration-500" />
                <div className="clay-icon-blue w-8 h-8 sm:w-10 sm:h-10 mb-3 sm:mb-4 relative z-10 dark:shadow-[0_0_20px_rgba(59,130,246,0.4)] dark:border-blue-400/30">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mb-1.5 flex items-center gap-1.5 tracking-tighter transition-colors relative z-10">
                  Mode Kiosk
                  <ArrowRight className="w-3 h-3 text-blue-600 dark:text-blue-400 group-hover:translate-x-2 transition-transform" />
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-[10px] sm:text-xs leading-relaxed font-medium transition-colors relative z-10">
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
              <div className="clay-card h-full p-4 sm:p-5 text-left transition-all duration-500 group-hover:bg-amber-50/50 dark:bg-zinc-900/30 dark:backdrop-blur-2xl dark:border-zinc-800/50 dark:group-hover:bg-zinc-800/60 dark:group-hover:border-amber-500/50 dark:group-hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/0 dark:group-hover:from-amber-500/10 transition-colors duration-500 pointer-events-none" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full opacity-0 dark:group-hover:opacity-100 transition-opacity duration-500" />
                <div className="clay-icon-amber w-8 h-8 sm:w-10 sm:h-10 mb-3 sm:mb-4 relative z-10 dark:shadow-[0_0_20px_rgba(245,158,11,0.4)] dark:border-amber-400/30">
                  <UserCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mb-1.5 flex items-center gap-1.5 tracking-tighter transition-colors relative z-10">
                  Masuk Akun
                  <ArrowRight className="w-3 h-3 text-amber-500 dark:text-amber-400 group-hover:translate-x-2 transition-transform" />
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-[10px] sm:text-xs leading-relaxed font-medium transition-colors relative z-10">
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
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 text-zinc-400 dark:text-zinc-500 font-bold text-[8px] sm:text-[10px] uppercase tracking-widest transition-colors">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-600 dark:bg-blue-500 shadow-sm" />
              Aman & Terpercaya
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 shadow-sm" />
              Cepat & Efisien
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-sm" />
              Transparan
            </div>
          </div>
          
          <div className="text-zinc-400 dark:text-zinc-500 font-bold text-center transition-colors">
            <div className="flex items-center justify-center gap-4 mb-4 text-[10px] sm:text-xs">
              <Link to="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Syarat & Ketentuan</Link>
              <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <Link to="/contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Hubungi Kami</Link>
            </div>
            <div className="clay-card inline-block px-2 py-1 bg-white/50 dark:bg-zinc-900/30 dark:border-zinc-800/50 mb-2 backdrop-blur-md">
              <p className="font-bold tracking-widest text-[8px] dark:text-zinc-500">v3.0.0-clay-edition</p>
            </div>
            <p className="text-[6px] sm:text-[8px] uppercase tracking-widest opacity-50">Dikembangkan oleh SPS Corner Team</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
