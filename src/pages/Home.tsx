import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Store, UserCircle, ArrowRight, ShieldCheck, ShoppingCart, Sparkles, LayoutDashboard, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/logo-utama.png';
import { useAuthStore } from '../store/useAuthStore';

function FeatureCard({
  to,
  title,
  description,
  icon,
  color,
  ariaLabel,
}: {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
  color: 'blue' | 'green' | 'amber';
  ariaLabel?: string;
}) {
  const colorMap = {
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-200/60 dark:border-blue-500/30',
    green: 'from-emerald-500/15 to-emerald-500/5 border-emerald-200/60 dark:border-emerald-500/30',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-200/60 dark:border-amber-500/30',
  };

  return (
    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }} className="h-full">
      <Link to={to} className="group block h-full" aria-label={ariaLabel || title}>
        <article className={`h-full rounded-2xl sm:rounded-3xl border bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-5 sm:p-6 md:p-7 transition-all duration-300 hover:shadow-lg ${colorMap[color]}`}>
          <div className="mb-4 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-100">
            {icon}
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            {title}
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
        </article>
      </Link>
    </motion.div>
  );
}

export default function Home() {
  const { user } = useAuthStore();

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-zinc-50 via-white to-zinc-100 dark:from-[#06070a] dark:via-[#090b10] dark:to-zinc-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,84,166,0.12),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(255,204,0,0.14),transparent_40%)]" />

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="sr-only">SPS Corner — Platform Kantin Digital dan Koperasi Internal Karyawan Sariroti Banjarmasin</h1>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-950/50 px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-blue-700 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            Pusat Belanja Karyawan Sariroti
          </div>

          <motion.img
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            src={Logo}
            alt="SPS Corner Logo"
            className="mx-auto mt-5 h-20 sm:h-24 md:h-28 w-auto object-contain"
          />

          <p className="mt-5 text-sm sm:text-base md:text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Solusi transaksi kebutuhan karyawan: produk digital, roti Sariroti, hingga makanan kantin.
            Pembayaran QRIS dan digital dibuat cepat, aman, dan terintegrasi.
          </p>
        </div>

        <div className={`mt-8 sm:mt-10 grid grid-cols-1 gap-4 sm:gap-5 ${(!user || user.role !== 'buyer') ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2 max-w-3xl mx-auto'}`}>
          <FeatureCard
            to="/kiosk"
            ariaLabel="Kiosk Kejujuran"
            title="Kantin Kejujuran"
            description="Pesan makanan dan minuman favorit secara mandiri dengan alur checkout yang ringkas."
            color="blue"
            icon={<ShoppingCart className="h-6 w-6" strokeWidth={2.2} />}
          />

          <FeatureCard
            to="/portal"
            ariaLabel="Portal Karyawan"
            title="Portal Karyawan"
            description="Akses pengumuman, program serikat, kritik-saran, dan informasi internal lainnya."
            color="green"
            icon={<Users className="h-6 w-6" strokeWidth={2.2} />}
          />

          {(!user || user.role !== 'buyer') && (
            <FeatureCard
              to={user ? (user.role === 'admin' || user.role === 'superadmin' ? '/dashboard/admin' : '/dashboard/seller') : '/login'}
              title={user ? 'Dashboard' : 'Masuk Akun'}
              description={
                user
                  ? 'Kelola produk, transaksi, dan laporan melalui dashboard yang terstruktur.'
                  : 'Masuk untuk mengelola produk, riwayat transaksi, dan penarikan dana.'
              }
              color="amber"
              icon={user ? <LayoutDashboard className="h-6 w-6" strokeWidth={2.2} /> : <UserCircle className="h-6 w-6" strokeWidth={2.2} />}
            />
          )}
        </div>

        <footer className="mt-10 sm:mt-12 border-t border-zinc-200/70 dark:border-zinc-800 pt-6 sm:pt-8">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-blue-600" />Aman & Terpercaya</span>
            <span className="inline-flex items-center gap-1.5"><Store className="h-4 w-4 text-amber-500" />Cepat & Efisien</span>
          </div>

          <div className="mt-5 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <Link to="/terms" className="hover:text-blue-600 dark:hover:text-blue-400">Syarat & Ketentuan</Link>
              <Link to="/refund" className="hover:text-blue-600 dark:hover:text-blue-400">Kebijakan Pengembalian</Link>
              <Link to="/faq" className="hover:text-blue-600 dark:hover:text-blue-400">FAQ</Link>
              <Link to="/contact" className="hover:text-blue-600 dark:hover:text-blue-400">Hubungi Kami</Link>
            </div>
            <p className="mt-3 text-[11px]">Ide & Dikembangkan oleh <span className="font-semibold text-zinc-700 dark:text-zinc-200">Alif Irfansyah</span></p>
          </div>
        </footer>
      </section>
    </main>
  );
}
