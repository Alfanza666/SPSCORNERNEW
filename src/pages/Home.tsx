import { Link } from 'react-router-dom';
import { Store, UserCircle, ArrowRight, ShieldCheck, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/FEDERASI RIKAT PEKERJ SUKSES.png';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-100/50 rounded-full blur-3xl -z-10" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-5xl w-full text-center"
      >
        <div className="mb-16">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs sm:text-sm font-medium mb-4 sm:mb-6"
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Kantin Digital Karyawan Sariroti
          </motion.div>
          
          <div className="flex justify-center mb-6">
            <img src={Logo} alt="SPS Corner Logo" className="h-24 sm:h-32 w-auto object-contain" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
            }} />
            <h1 className="hidden text-5xl sm:text-6xl md:text-7xl font-bold text-zinc-900 tracking-tight">
              SPS <span className="text-amber-600">Corner</span>
            </h1>
          </div>
          <p className="text-base sm:text-lg md:text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed px-4">
            Solusi cerdas untuk transaksi kantin yang lebih cepat, aman, dan transparan bagi seluruh karyawan Sariroti.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <motion.div
            whileHover={{ y: -8 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Link to="/kiosk" className="group block h-full">
              <div className="glass-card h-full p-8 text-left transition-all duration-300 group-hover:border-blue-500/50 group-hover:shadow-xl group-hover:shadow-blue-500/10">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
                  <ShoppingCart className="w-8 h-8 text-blue-700 group-hover:text-white" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 mb-3 flex items-center gap-2">
                  Mode Kiosk
                  <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </h3>
                <p className="text-zinc-500 leading-relaxed">
                  Pesan makanan dan minuman favoritmu secara mandiri dengan sistem pembayaran yang mudah.
                </p>
              </div>
            </Link>
          </motion.div>

          <motion.div
            whileHover={{ y: -8 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Link to="/login" className="group block h-full">
              <div className="glass-card h-full p-8 text-left transition-all duration-300 group-hover:border-amber-500/50 group-hover:shadow-xl group-hover:shadow-amber-500/10">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-6 group-hover:bg-amber-600 transition-colors duration-300">
                  <UserCircle className="w-8 h-8 text-amber-700 group-hover:text-white" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 mb-3 flex items-center gap-2">
                  Masuk Akun
                  <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </h3>
                <p className="text-zinc-500 leading-relaxed">
                  Akses dashboard untuk mengelola produk, melihat riwayat transaksi, atau melakukan penarikan saldo.
                </p>
              </div>
            </Link>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-20 pt-8 border-t border-zinc-200 flex flex-col items-center gap-6"
        >
          <div className="flex flex-wrap justify-center gap-8 text-zinc-400 font-medium text-sm uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Aman & Terpercaya
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Cepat & Efisien
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Transparan
            </div>
          </div>
          
          <div className="text-xs text-zinc-400/80 font-mono text-center max-w-md">
            <p className="font-bold text-zinc-500 mb-1">v2.1.0-blue-mobile</p>
            <p>Build: {new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
            <p className="mt-2 text-[10px]">Jika Anda melihat teks ini, berarti Anda sudah berada di versi terbaru yang saya buat.</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
