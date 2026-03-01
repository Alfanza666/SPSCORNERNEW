import { Link } from 'react-router-dom';
import { Store, UserCircle, ArrowRight, ShieldCheck, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/50 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-3xl -z-10" />

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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium mb-6"
          >
            <ShieldCheck className="w-4 h-4" />
            Kantin Digital Mandiri Terpercaya
          </motion.div>
          
          <h1 className="text-6xl md:text-7xl font-bold text-zinc-900 mb-6 tracking-tight">
            SPS <span className="text-emerald-600">Corner</span>
          </h1>
          <div className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em] mb-6">
            v2.1.0-emerald-mobile
          </div>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Solusi cerdas untuk transaksi kantin yang lebih cepat, aman, dan transparan bagi seluruh warga sekolah.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <motion.div
            whileHover={{ y: -8 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Link to="/kiosk" className="group block h-full">
              <div className="glass-card h-full p-8 text-left transition-all duration-300 group-hover:border-emerald-500/50 group-hover:shadow-xl group-hover:shadow-emerald-500/10">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6 group-hover:bg-emerald-600 transition-colors duration-300">
                  <ShoppingCart className="w-8 h-8 text-emerald-700 group-hover:text-white" />
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
              <div className="glass-card h-full p-8 text-left transition-all duration-300 group-hover:border-blue-500/50 group-hover:shadow-xl group-hover:shadow-blue-500/10">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
                  <UserCircle className="w-8 h-8 text-blue-700 group-hover:text-white" />
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
          className="mt-20 pt-8 border-t border-zinc-200 flex flex-wrap justify-center gap-8 text-zinc-400 font-medium text-sm uppercase tracking-widest"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Aman & Terpercaya
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Cepat & Efisien
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Transparan
          </div>
          <div className="w-full text-[8px] mt-4 opacity-30">
            Build: 2026-02-28 07:10:00
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
