import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Store, UserCircle, ArrowRight, ShieldCheck, ShoppingCart, Sparkles, LayoutDashboard, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/logo-utama.png';
import { useAuthStore } from '../store/useAuthStore';

function FeatureCard({ to, title, description, icon, tint }: { to: string; title: string; description: string; icon: ReactNode; tint: string }) {
  return (
    <motion.div whileHover={{ y: -6 }} whileTap={{ scale: 0.99 }} className="h-full">
      <Link to={to} className="group block h-full">
        <article className={`relative h-full overflow-hidden rounded-3xl border border-white/60 dark:border-zinc-700/70 bg-white/80 dark:bg-zinc-900/80 p-6 sm:p-7 shadow-[0_8px_30px_rgba(2,8,20,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-300 ${tint}`}>
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-100">
            {icon}
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            {title}
            <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-1.5 transition-transform" />
          </h3>
          <p className="mt-2.5 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
        </article>
      </Link>
    </motion.div>
  );
}

export default function Home() {
  const { user } = useAuthStore();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(160deg,#f8fafc_0%,#eef4ff_45%,#fffdf2_100%)] dark:bg-[linear-gradient(160deg,#05070b_0%,#081124_45%,#120f04_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(0,84,166,0.16),transparent_35%),radial-gradient(circle_at_90%_80%,rgba(255,204,0,0.2),transparent_35%)]" />

      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="sr-only">SPS Corner — Platform Kantin Digital dan Koperasi Internal Karyawan Sariroti Banjarmasin</h1>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 dark:border-blue-700/60 bg-white/70 dark:bg-zinc-900/60 px-4 py-2 text-xs font-medium text-blue-700 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            Ekosistem Belanja Karyawan Sariroti
          </div>

          <motion.img initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} src={Logo} alt="SPS Corner Logo" className="mx-auto mt-6 h-24 sm:h-28 md:h-32 w-auto object-contain" />

          <p className="mt-6 text-sm sm:text-base md:text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Platform terpadu untuk kebutuhan harian karyawan: kantin, produk digital, dan layanan portal internal.
            Pengalaman belanja dibuat cepat, nyaman, dan aman dalam satu tempat.
          </p>
        </div>

        <div className={`mt-10 grid grid-cols-1 gap-5 sm:gap-6 ${(!user || user.role !== 'buyer') ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2 max-w-4xl mx-auto'}`}>
          <FeatureCard to="/kiosk" title="Kantin Kejujuran" description="Belanja makanan/minuman dengan alur checkout yang ringkas, cepat, dan ramah mobile." icon={<ShoppingCart className="h-6 w-6" />} tint="bg-gradient-to-br from-blue-50/70 to-white dark:from-blue-950/20 dark:to-zinc-900" />
          <FeatureCard to="/portal" title="Portal Karyawan" description="Akses pengumuman, program serikat, serta kanal kritik & saran dengan tampilan terstruktur." icon={<Users className="h-6 w-6" />} tint="bg-gradient-to-br from-emerald-50/70 to-white dark:from-emerald-950/20 dark:to-zinc-900" />
          {(!user || user.role !== 'buyer') && (
            <FeatureCard
              to={user ? (user.role === 'admin' || user.role === 'superadmin' ? '/dashboard/admin' : '/dashboard/seller') : '/login'}
              title={user ? 'Dashboard' : 'Masuk Akun'}
              description={user ? 'Kelola transaksi, produk, dan laporan dengan panel kontrol yang profesional.' : 'Masuk untuk mengelola transaksi, produk, dan akses fitur manajemen.'}
              icon={user ? <LayoutDashboard className="h-6 w-6" /> : <UserCircle className="h-6 w-6" />}
              tint="bg-gradient-to-br from-amber-50/75 to-white dark:from-amber-950/20 dark:to-zinc-900"
            />
          )}
        </div>

        <footer className="mt-12 rounded-2xl border border-white/60 dark:border-zinc-800 bg-white/65 dark:bg-zinc-900/65 backdrop-blur px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-blue-600" />Aman & Terpercaya</span>
            <span className="inline-flex items-center gap-1.5"><Store className="h-4 w-4 text-amber-500" />Cepat & Efisien</span>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <Link to="/terms" className="hover:text-blue-600">Syarat & Ketentuan</Link>
            <Link to="/refund" className="hover:text-blue-600">Kebijakan Pengembalian</Link>
            <Link to="/faq" className="hover:text-blue-600">FAQ</Link>
            <Link to="/contact" className="hover:text-blue-600">Hubungi Kami</Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
