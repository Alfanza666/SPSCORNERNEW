import React from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Shield,
  Users,
  Sparkles,
  MessageSquare,
  ArrowRight,
  AlertCircle,
  Gift,
  Megaphone,
  FileText
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
    shadow: 'shadow-red-500/20',
    color: 'red'
  },
  {
    id: 'pengumuman',
    title: 'Pengumuman Serikat',
    description: 'Info terbaru dari manajemen SP',
    icon: Megaphone,
    gradient: 'from-blue-500 to-blue-600',
    shadow: 'shadow-blue-500/20',
    color: 'blue'
  },
  {
    id: 'program',
    title: 'Program Serikat',
    description: 'Kupon, Kurban, Gathering & lainnya',
    icon: Gift,
    gradient: 'from-amber-500 to-amber-600',
    shadow: 'shadow-amber-500/20',
    color: 'amber'
  },
  {
    id: 'kritik',
    title: 'Kritik & Saran',
    description: 'Untuk meeting bipartit',
    icon: MessageSquare,
    gradient: 'from-purple-500 to-purple-600',
    shadow: 'shadow-purple-500/20',
    color: 'purple'
  }
];

export default function PortalDashboard() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const { isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8ebf0] dark:bg-zinc-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Portal Serikat Pekerja
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Selamat datang, {user.name}</p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-3">
          <SPSLogo variant="wide" className="h-12" />
        </div>
      </div>

      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-3xl p-8 shadow-xl shadow-amber-500/20"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-white mb-2">Selamat Datang!</h2>
            <p className="text-white/90 text-lg max-w-xl leading-relaxed">
              Portal resmi Serikat Pekerja Sariroti Indonesia. Akses layanan pengaduan, pengumuman, program, dan kritik saran untuk kesejahteraan bersama.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STATS.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                stat.color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                stat.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-3xl font-black text-zinc-900 dark:text-white">{stat.value}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Menu Grid */}
      <div>
        <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-6">Menu Utama</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {MENU_ITEMS.map((item, idx) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/portal/${item.id}`)}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 text-left border border-zinc-100 dark:border-zinc-800 shadow-lg hover:shadow-xl transition-all group relative overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className="relative">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 ${item.shadow}`}>
                  <item.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-black text-zinc-900 dark:text-white text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">{item.description}</p>
                <div className="flex items-center gap-2 text-amber-600 font-bold text-sm group-hover:gap-3 transition-all">
                  Akses Sekarang
                  <ArrowRight className="w-4 h-4" />
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
          className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-lg"
        >
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Akses Cepat Admin
          </h3>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Dashboard Admin', href: '/dashboard/admin' },
              { label: 'Program Serikat', href: '/dashboard/admin/union-programs' },
              { label: 'Feedback Management', href: '/dashboard/admin/feedbacks' }
            ].map(action => (
              <motion.button
                key={action.href}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(action.href)}
                className="px-5 py-3 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:from-amber-100 hover:to-orange-50 dark:hover:from-amber-900/30 dark:hover:to-orange-900/20 transition-all border border-zinc-200 dark:border-zinc-700 shadow-md"
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