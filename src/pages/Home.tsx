import { Link } from 'react-router-dom';
import { Store, UserCircle, ArrowRight, ShieldCheck, ShoppingCart, Sparkles, LayoutDashboard, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/logo-utama.webp';
import { useAuthStore } from '../store/useAuthStore';

export default function Home() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden relative transition-colors duration-500 font-sans">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15)_0%,transparent_50%)] transition-opacity duration-500 pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTUwLDE1MCwxNTAsMC4wNSkiLz48L3N2Zz4=')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] transition-opacity duration-500 pointer-events-none" />

      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-[120px] sm:blur-[150px] -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-400/20 dark:bg-amber-600/15 rounded-full blur-[120px] sm:blur-[150px] -z-10 animate-pulse" style={{ animationDuration: '10s' }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-5xl w-full text-center z-10"
      >
        <div className="mb-10 sm:mb-16">
          {/* H1 ─ SEO: visually hidden but present for crawlers */}
          <h1 className="sr-only">SPS Corner — Portal Digital Anggota FSPS Banjarmasin</h1>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-zinc-900/80 text-blue-700 dark:text-blue-400 text-[10px] sm:text-xs font-bold mb-6 sm:mb-8 shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-zinc-200/50 dark:border-zinc-800/50 uppercase tracking-widest backdrop-blur-xl transition-all"
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
            Portal Anggota & Ekosistem Karyawan
          </motion.div>

          <div className="flex justify-center mb-6 sm:mb-8 relative">
            <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/30 blur-3xl rounded-full scale-75 transition-opacity duration-500" />
            <motion.img
              initial={{ scale: 0.8, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
              src={Logo}
              alt="SPS Corner Logo"
              className="h-32 sm:h-48 w-auto object-contain drop-shadow-xl dark:drop-shadow-[0_0_30px_rgba(255,255,255,0.15)] relative z-10"
            />
          </div>

          <p className="text-sm sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed px-4 font-medium tracking-tight transition-colors mt-6">
            Ekosistem digital serikat pekerja. Menggabungkan portal layanan anggota dengan pusat transaksi harian dalam satu platform pintar, didukung kemudahan pembayaran digital dan QRIS modern.
          </p>
        </div>

        <div className={`grid grid-cols-1 ${(!user || user.role !== 'buyer') ? 'md:grid-cols-2 max-w-4xl' : 'max-w-xl'} mx-auto px-4 gap-4 sm:gap-6`}>
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="h-full"
          >
            <Link to="/kiosk" className="group block h-full" aria-label="Kiosk Kejujuran">
              <div className="bg-white dark:bg-zinc-900/40 rounded-3xl h-full p-6 sm:p-8 text-left transition-all duration-500 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-blue-500/30 dark:hover:border-blue-500/50 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.2)] relative overflow-hidden backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-50/50 dark:group-hover:from-blue-500/10 transition-colors duration-500 pointer-events-none" />
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/10 dark:bg-blue-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-5 sm:mb-6 relative z-10 shadow-[0_8px_20px_rgba(59,130,246,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] border border-blue-300/50 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.3)_0%,transparent_60%)]" />
                  <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-md relative z-10" strokeWidth={2.5} />
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2 tracking-tight transition-colors relative z-10">
                  Kantin Kejujuran
                  <ArrowRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-2 transition-transform duration-300" />
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base leading-relaxed font-medium transition-colors relative z-10">
                  Pengalaman self-service yang seamless. Pesan makanan dan minuman lebih cepat dengan sistem pembayaran digital instan dan aman.
                </p>
              </div>
            </Link>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="h-full"
          >
            <Link to="/portal" className="group block h-full" aria-label="Portal Karyawan">
              <div className="bg-white dark:bg-zinc-900/40 rounded-3xl h-full p-6 sm:p-8 text-left transition-all duration-500 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-green-500/30 dark:hover:border-green-500/50 hover:shadow-[0_20px_40px_-15px_rgba(34,197,94,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(34,197,94,0.2)] relative overflow-hidden backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-500/0 group-hover:from-green-50/50 dark:group-hover:from-green-500/10 transition-colors duration-500 pointer-events-none" />
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-green-500/10 dark:bg-green-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-5 sm:mb-6 relative z-10 shadow-[0_8px_20px_rgba(34,197,94,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] border border-green-300/50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.3)_0%,transparent_60%)]" />
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-md relative z-10" strokeWidth={2.5} />
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2 tracking-tight transition-colors relative z-10">
                  Portal Karyawan
                  <ArrowRight className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:translate-x-2 transition-transform duration-300" />
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base leading-relaxed font-medium transition-colors relative z-10">
                  Pengumuman, program serikat, kritik &amp; saran, dan info lainnya untuk karyawan.
                </p>
              </div>
            </Link>
          </motion.div>

          {(!user || user.role !== 'buyer') && (
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="h-full"
            >
              <Link to={user ? (user.role === 'admin' || user.role === 'superadmin' ? '/dashboard/admin' : '/dashboard/seller') : '/login'} className="group block h-full">
                <div className="bg-white dark:bg-zinc-900/40 rounded-3xl h-full p-6 sm:p-8 text-left transition-all duration-500 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-amber-500/30 dark:hover:border-amber-500/50 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.15)] relative overflow-hidden backdrop-blur-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/0 group-hover:from-amber-50/50 dark:group-hover:from-amber-500/10 transition-colors duration-500 pointer-events-none" />
                  <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 dark:bg-amber-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-5 sm:mb-6 relative z-10 shadow-[0_8px_20px_rgba(245,158,11,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] border border-amber-300/50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.4)_0%,transparent_60%)]" />
                    {user ? <LayoutDashboard className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-md relative z-10" strokeWidth={2.5} /> : <UserCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-md relative z-10" strokeWidth={2.5} />}
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2 tracking-tight transition-colors relative z-10">
                    {user ? 'Dashboard' : 'Masuk Akun'}
                    <ArrowRight className="w-5 h-5 text-amber-500 dark:text-amber-400 group-hover:translate-x-2 transition-transform duration-300" />
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base leading-relaxed font-medium transition-colors relative z-10">
                    {user
                      ? 'Kelola sistem, produk, dan pantau transaksi Anda melalui dashboard.'
                      : 'Akses dashboard untuk mengelola produk, riwayat transaksi, dan penarikan.'}
                  </p>
                </div>
              </Link>
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-12 sm:mt-16 pt-8 flex flex-col items-center gap-6"
        >
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-zinc-500 dark:text-zinc-400 font-bold text-[10px] sm:text-xs uppercase tracking-widest transition-colors">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              Aman & Terpercaya
            </div>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-500" />
              Cepat & Efisien
            </div>
          </div>

          <div className="text-zinc-400 dark:text-zinc-500 font-medium text-center transition-colors flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
              <Link to="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Syarat & Ketentuan</Link>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 hidden sm:block"></span>
              <Link to="/refund" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Kebijakan Pengembalian</Link>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 hidden sm:block"></span>
              <Link to="/faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</Link>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 hidden sm:block"></span>
              <Link to="/contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Hubungi Kami</Link>
            </div>

            <div className="flex flex-col items-center gap-1 mt-2">
              <div className="px-3 py-1 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 border border-zinc-300/50 dark:border-zinc-700/50 backdrop-blur-sm">
                <p className="font-bold tracking-widest text-[10px] text-zinc-600 dark:text-zinc-400">v5.8.0</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                &copy; 2026 SPS Corner. Designed &amp; Engineered by <span className="font-bold text-zinc-700 dark:text-zinc-300">Alif Irfansyah</span>
              </p>
              {/* Outgoing link ─ SEO: fixes 'page has no outgoing links' */}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
