import React from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotifications } from '../../hooks/useNotifications';
import SPSLogo from '../../components/SPSLogo';
import {
  ShoppingBag,
  Megaphone,
  Gift,
  MessageSquare,
  LogOut,
  Bell,
  User as UserIcon,
  ChevronRight,
  AlertCircle,
  Shield,
  Users,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface PortalStats {
  totalMembers: number;
  activePrograms: number;
  pendingFeedback: number;
}

const MENU_ITEMS = [
  {
    id: 'pengaduan',
    title: 'Pengaduan',
    subtitle: '& Pembelaan',
    description: 'Sampaikan masalah dengan aman dan rahasia',
    icon: Shield,
    gradient: 'from-red-500 via-rose-600 to-red-600',
    shadow: 'shadow-red-500/20',
    bgHover: 'hover:bg-red-50 dark:hover:bg-red-950/30'
  },
  {
    id: 'pengumuman',
    title: 'Pengumuman',
    subtitle: 'Serikat',
    description: 'Info terbaru dari manajemen SP',
    icon: Megaphone,
    gradient: 'from-blue-500 via-indigo-600 to-blue-600',
    shadow: 'shadow-blue-500/20',
    bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-950/30'
  },
  {
    id: 'program',
    title: 'Program',
    subtitle: 'Serikat',
    description: 'Kupon, Kurban, Gathering & lainnya',
    icon: Gift,
    gradient: 'from-amber-500 via-orange-600 to-amber-500',
    shadow: 'shadow-amber-500/20',
    bgHover: 'hover:bg-amber-50 dark:hover:bg-amber-950/30'
  },
  {
    id: 'kritik',
    title: 'Kritik',
    subtitle: '& Saran',
    description: 'Untuk meeting bipartit',
    icon: MessageSquare,
    gradient: 'from-purple-500 via-violet-600 to-purple-500',
    shadow: 'shadow-purple-500/20',
    bgHover: 'hover:bg-purple-50 dark:hover:bg-purple-950/30'
  }
];

export default function PortalDashboard() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showNotifMenu, setShowNotifMenu] = React.useState(false);
  const [stats] = React.useState<PortalStats>({
    totalMembers: 247,
    activePrograms: 3,
    pendingFeedback: 0
  });

  const handleSignOut = async () => {
    window.location.href = '/login';
  };

  const handleBellClick = async () => {
    if (unreadCount > 0) {
      await markAllAsRead();
    }
    setShowNotifMenu(!showNotifMenu);
    setShowProfileMenu(false);
  };

  const handleNotifClick = (path: string) => {
    setShowNotifMenu(false);
    navigate(path);
  };

  const { isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="pb-8">
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border-b border-zinc-800">
        <div className="max-w-md mx-auto px-4 pt-4">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl blur-md opacity-50" />
                <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 p-2 rounded-2xl shadow-lg">
                  <SPSLogo className="h-6" variant="icon" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-amber-400">Serikat Pekerja Sariroti</p>
                <h1 className="text-lg font-black text-white tracking-tight">SPS Corner</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBellClick}
                  className="relative p-2.5 rounded-2xl bg-zinc-800/50 hover:bg-zinc-700/50 backdrop-blur-sm transition-colors"
                >
                  <Bell className="w-5 h-5 text-zinc-400" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
                      {unreadCount}
                    </span>
                  )}
                </motion.button>

                <AnimatePresence>
                  {showNotifMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="absolute right-0 top-14 w-80 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/50 dark:border-zinc-700/50 z-[100] overflow-hidden"
                    >
                      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <p className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Notifikasi</p>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs font-bold text-amber-600 hover:text-amber-700"
                          >
                            Tandai Semua Dibaca
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-center text-zinc-400 text-xs font-medium py-8">Tidak ada notifikasi</p>
                        ) : (
                          notifications.filter(n => !n.isRead).slice(0, 10).map(n => (
                            <motion.button
                              key={n.id}
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              onClick={() => handleNotifClick(n.path)}
                              className="w-full text-left p-4 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-colors border-l-4 bg-zinc-50/50 dark:bg-zinc-800/30 border-l-amber-400"
                            >
                              <p className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">{n.title}</p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-zinc-400 mt-1">{n.created_at ? format(new Date(n.created_at), 'dd MMM, HH:mm') : ''}</p>
                            </motion.button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifMenu(false); }}
                className="flex items-center gap-2 p-2 rounded-2xl bg-zinc-800/50 hover:bg-zinc-700/50 backdrop-blur-sm transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
              </motion.button>
            </div>

            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="absolute right-4 top-[72px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/50 dark:border-zinc-700/50 z-50 min-w-[220px] overflow-hidden"
                >
                  <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                        <span className="text-xl">👤</span>
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">{user.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{user.nik || '-'}</p>
                      </div>
                    </div>
                    <span className="inline-block px-3 py-1.5 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl capitalize">
                      {user.role}
                    </span>
                  </div>
                  <button
                    onClick={() => { handleSignOut(); setShowProfileMenu(false); }}
                    className="w-full p-4 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-3xl p-6 shadow-xl shadow-amber-500/30"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
          <div className="relative">
            <div className="flex items-center gap-4 mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg"
              >
                <Shield className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-black text-white">Selamat Datang!</h2>
                <p className="text-white/80 font-medium">{user.name.split(' ')[0]}</p>
              </div>
            </div>
            <p className="text-white/90 text-sm leading-relaxed">Pilih menu di bawah untuk mengakses layanan Serikat Pekerja Sariroti Indonesia</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: 'Anggota', value: stats.totalMembers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'Program Aktif', value: stats.activePrograms, icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Feedback Baru', value: stats.pendingFeedback, icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' }
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
              className={`${stat.bg} rounded-2xl p-4 text-center`}
            >
              <div className={`w-8 h-8 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-black text-zinc-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-zinc-500 font-semibold mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Menu Utama</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {MENU_ITEMS.map((item, idx) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.05 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/portal/${item.id}`)}
                className={`bg-white dark:bg-zinc-900 rounded-3xl p-5 text-left shadow-lg border border-zinc-100/50 dark:border-zinc-800/50 hover:shadow-xl transition-all group relative overflow-hidden ${item.bgHover}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 ${item.shadow}`}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-black text-zinc-900 dark:text-white mb-0.5 text-sm leading-tight">
                  {item.title}<span className="text-amber-600">{item.subtitle}</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{item.description}</p>
                <div className="mt-3 flex items-center gap-1">
                  <span className="text-xs font-semibold text-amber-600">Akses</span>
                  <ArrowRight className="w-3 h-3 text-amber-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {(user.role === 'superadmin' || user.role === 'admin') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-lg"
          >
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Akses Cepat Admin
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Dashboard Admin', href: '/dashboard/admin' },
                { label: 'Program Serikat', href: '/dashboard/admin/union-programs' }
              ].map(action => (
                <motion.button
                  key={action.href}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(action.href)}
                  className="px-4 py-2.5 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:from-amber-100 hover:to-orange-50 dark:hover:from-amber-900/30 dark:hover:to-orange-900/20 transition-all border border-zinc-200 dark:border-zinc-700 shadow-md"
                >
                  {action.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}