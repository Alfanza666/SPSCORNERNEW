import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
import {
  Shield,
  Users,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Gift,
  Megaphone,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';

export default function PortalDashboard() {
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    { id: 'members', label: 'Anggota', subLabel: 'Terverifikasi', value: 0, icon: Users, color: 'blue' },
    { id: 'programs', label: 'Program', subLabel: 'Aktif Saat Ini', value: 0, icon: Sparkles, color: 'amber' },
    { id: 'announcements', label: 'Informasi', subLabel: 'Pengumuman', value: 0, icon: Megaphone, color: 'purple' }
  ]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      // 1. Fetch Members Count (with NIK)
      const { count: membersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('nik', 'is', null);

      // 2. Fetch Active Programs Count
      const { count: programsCount } = await supabase
        .from('union_programs')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // 3. Fetch Announcements Count
      const { count: announcementsCount } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true });

      setStats(prev => prev.map(stat => {
        if (stat.id === 'members') return { ...stat, value: membersCount || 0 };
        if (stat.id === 'programs') return { ...stat, value: programsCount || 0 };
        if (stat.id === 'announcements') return { ...stat, value: announcementsCount || 0 };
        return stat;
      }));
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (isAuthLoading) {
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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
          Portal Serikat Pekerja
        </h1>
      </div>

      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-black rounded-2xl md:rounded-[2rem] border border-white/5 shadow-2xl"
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" />
        <div className="relative p-5 md:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-8">
          <div className="w-16 h-16 md:w-28 md:h-28 flex items-center justify-center shrink-0">
            <img 
              src="/src/components/ui/FEDERASI RIKAT PEKERJ SUKSES.png" 
              alt="Federasi Logo"
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            />
          </div>
          
          <div className="flex-1 text-center sm:text-left">
            <div className="space-y-1 md:space-y-2">
              <h2 className="text-xl md:text-3xl font-black text-white tracking-tight">
                Selamat Datang, <span className="text-amber-400">{user.name.split(' ')[0]}</span>
              </h2>
              <p className="text-zinc-400 text-[10px] md:text-base font-medium leading-relaxed max-w-2xl">
                Ini adalah portal untuk anggota <span className="text-white font-bold">F-SPS plant banjarmasin</span>. 
                Akses informasi serikat dan program kesejahteraan dalam satu aplikasi.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards - Updated with Real Data & Clearer Labels */}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-[2rem] p-3 md:p-6 border border-zinc-100 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/20 flex flex-col items-center text-center group"
          >
            <div className={`w-10 h-10 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center mb-2 md:mb-4 transition-transform group-hover:scale-110 duration-500 ${
              stat.color === 'blue' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
              stat.color === 'amber' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
              'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
            }`}>
              <stat.icon className="w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div className="space-y-1">
              {loadingStats ? (
                <Loader2 className="w-5 h-5 md:w-8 md:h-8 animate-spin mx-auto text-zinc-300" />
              ) : (
                <p className="text-xl md:text-4xl font-black text-zinc-900 dark:text-white leading-none tracking-tighter">
                  {stat.value}
                </p>
              )}
              <div className="space-y-0.5">
                <p className="text-[10px] md:text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-[7px] md:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">
                  {stat.subLabel}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Menu Grid */}
      <div>
        <h3 className="text-base md:text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-4 md:mb-5">Menu Utama</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
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