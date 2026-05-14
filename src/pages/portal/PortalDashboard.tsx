import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Shield,
  Users,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Gift,
  Megaphone,
  FileText,
  ChevronRight
} from 'lucide-react';
import SPSLogo from '../../components/SPSLogo';
import { motion } from 'motion/react';

const STATS = [
  { label: 'Total Anggota', value: 247, icon: Users, color: 'blue' },
  { label: 'Program Aktif', value: 3, icon: Sparkles, color: 'amber' },
  { label: 'Feedback Baru', value: 0, icon: MessageSquare, color: 'purple' }
];

const MENU_ITEMS = [
  {
    id: 'pengaduan',
    title: 'Pengaduan & Pembelaan',
    description: 'Sampaikan masalah dengan aman dan rahasia',
    icon: Shield,
    gradient: 'from-red-500 to-red-600',
    bgGradient: 'bg-gradient-to-br from-red-500 to-red-600'
  },
  {
    id: 'pengumuman',
    title: 'Pengumuman Serikat',
    description: 'Info terbaru dari manajemen SP',
    icon: Megaphone,
    gradient: 'from-blue-500 to-blue-600',
    bgGradient: 'bg-gradient-to-br from-blue-500 to-blue-600'
  },
  {
    id: 'program',
    title: 'Program Serikat',
    description: 'Kupon, Kurban, Gathering & lainnya',
    icon: Gift,
    gradient: 'from-amber-500 to-amber-600',
    bgGradient: 'bg-gradient-to-br from-amber-500 to-amber-600'
  },
  {
    id: 'kritik',
    title: 'Kritik & Saran',
    description: 'Untuk meeting bipartit',
    icon: MessageSquare,
    gradient: 'from-purple-500 to-purple-600',
    bgGradient: 'bg-gradient-to-br from-purple-500 to-purple-600'
  }
];

export default function PortalDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8ebf0] dark:bg-zinc-950">
        <div className="relative">
          <div className="w-12 h-12 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 overflow-hidden">
            <SPSLogo variant="icon" className="w-7 h-7 md:w-10 md:h-10" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              Portal Serikat Pekerja
              <span className="text-[10px] md:text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 md:px-2 py-0.5 rounded-full">SPS Corner</span>
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400">Selamat datang, {user.name}</p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-3">
          <SPSLogo variant="stack" className="h-14" />
        </div>
      </div>

      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-xl shadow-amber-500/20"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg shrink-0">
            <Shield className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-white mb-1">Selamat Datang!</h2>
            <p className="text-white/90 text-sm md:text-base line-clamp-2 md:line-clamp-none">
              Portal resmi Serikat Pekerja Sariroti Indonesia
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards - Balanced Grid */}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        {STATS.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-zinc-900 rounded-xl md:rounded-2xl p-3 md:p-5 border border-zinc-100 dark:border-zinc-800 shadow-md md:shadow-lg"
          >
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center mb-2 md:mb-3 ${
              stat.color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
              stat.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
              'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
            }`}>
              <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <p className="text-xl md:text-2xl lg:text-3xl font-black text-zinc-900 dark:text-white">{stat.value}</p>
            <p className="text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Menu Grid - Balanced */}
      <div>
        <h3 className="text-base md:text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-4 md:mb-5">Menu Utama</h3>
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {MENU_ITEMS.map((item, idx) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/portal/${item.id}`)}
              className="bg-white dark:bg-zinc-900 rounded-xl md:rounded-2xl p-4 md:p-5 text-left border border-zinc-100 dark:border-zinc-800 shadow-md md:shadow-lg hover:shadow-xl transition-all group relative overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className="relative">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl ${item.bgGradient} flex items-center justify-center mb-3 md:mb-4 shadow-md group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500`}>
                  <item.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-white text-sm md:text-base mb-1 leading-tight">{item.title}</h3>
                <p className="text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-3">{item.description}</p>
                <div className="flex items-center gap-1 text-amber-600 font-bold text-xs group-hover:gap-2 transition-all">
                  <span className="hidden sm:inline">Akses Sekarang</span>
                  <span className="sm:hidden">Buka</span>
                  <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      {(user.role === 'superadmin' || user.role === 'admin') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-zinc-900 rounded-xl md:rounded-2xl p-4 md:p-5 border border-zinc-100 dark:border-zinc-800 shadow-md md:shadow-lg"
        >
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
            <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
            Akses Cepat Admin
          </h3>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {[
              { label: 'Dashboard Admin', href: '/dashboard/admin' },
              { label: 'Program Serikat', href: '/dashboard/admin/union-programs' },
              { label: 'Feedback', href: '/dashboard/admin/feedbacks' }
            ].map(action => (
              <motion.button
                key={action.href}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(action.href)}
                className="px-3 md:px-4 py-2 md:py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all border border-zinc-200 dark:border-zinc-700"
              >
                {action.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}