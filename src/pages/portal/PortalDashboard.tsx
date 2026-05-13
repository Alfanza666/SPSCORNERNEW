import React from 'react';
import { Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotifications } from '../../hooks/useNotifications';
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
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface PortalStats {
  totalMembers: number;
  activePrograms: number;
  pendingFeedback: number;
}

const MENU_ITEMS = [
  {
    id: 'pengaduan',
    title: 'Pengaduan & Pembelaan',
    description: 'Sampaikan masalah dengan aman',
    icon: Shield,
    color: 'from-red-500 to-red-600',
    href: '/portal/pengaduan',
    available: true
  },
  {
    id: 'pengumuman',
    title: 'Pengumuman Serikat',
    description: 'Info terbaru dari manajemen',
    icon: Megaphone,
    color: 'from-blue-500 to-blue-600',
    href: '/portal/pengumuman',
    available: true
  },
  {
    id: 'program',
    title: 'Program Serikat',
    description: 'Kupon, Kurban, Gathering',
    icon: Gift,
    color: 'from-amber-500 to-amber-600',
    href: '/portal/program',
    available: true
  },
  {
    id: 'kritik',
    title: 'Kritik & Saran',
    description: 'Untuk meeting bipartit',
    icon: MessageSquare,
    color: 'from-purple-500 to-purple-600',
    href: '/portal/kritik',
    available: true
  }
];

export default function PortalDashboard() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showNotifMenu, setShowNotifMenu] = React.useState(false);
  const [stats, setStats] = React.useState<PortalStats>({
    totalMembers: 0,
    activePrograms: 0,
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 pb-8">
      {/* HEADER */}
      <div className="bg-zinc-900 dark:bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between relative">
            <h1 className="text-lg font-black text-white uppercase tracking-widest">
              Portal Serikat
            </h1>

            <div className="flex items-center gap-2">
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBellClick}
                  className="relative p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <Bell className="w-5 h-5 text-zinc-400" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
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
                      className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 z-[100] overflow-hidden"
                    >
                      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <p className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Notifikasi</p>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700"
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
                              className="w-full text-left p-4 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-l-4 bg-zinc-50/50 dark:bg-zinc-800/30 border-l-blue-400"
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
                className="flex items-center gap-2 p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
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
                  className="absolute right-0 top-[60px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 z-50 min-w-[220px] overflow-hidden"
                >
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="font-bold text-zinc-900 dark:text-white">{user.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{user.nik || '-'}</p>
                    <span className="inline-block mt-2 px-2.5 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-xl capitalize">
                      {user.role}
                    </span>
                  </div>
                  <button
                    onClick={() => { handleSignOut(); setShowProfileMenu(false); }}
                    className="w-full p-4 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-bold text-red-600 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Welcome Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4"
          >
            <Shield className="w-7 h-7 text-white" />
          </motion.div>
          <h2 className="text-2xl font-black mb-2">Selamat Datang, {user.name.split(' ')[0]}!</h2>
          <p className="text-blue-100 text-sm">Pilih menu di bawah untuk mengakses layanan Serikat</p>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Anggota', value: stats.totalMembers, color: 'from-blue-500 to-blue-600' },
            { label: 'Program Aktif', value: stats.activePrograms, color: 'from-amber-500 to-amber-600' },
            { label: 'Feedback Baru', value: stats.pendingFeedback, color: 'from-purple-500 to-purple-600' }
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-4 text-center shadow-sm border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{stat.value}</p>
              <p className="text-xs text-zinc-500 font-semibold mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-4">
          {MENU_ITEMS.map((item, idx) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(item.href)}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-5 text-left shadow-sm border border-zinc-100 dark:border-zinc-800 hover:shadow-xl hover:shadow-blue-500/10 transition-all group relative overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-black text-zinc-900 dark:text-white mb-1 text-sm">{item.title}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{item.description}</p>
            </motion.button>
          ))}
        </div>

        {/* Quick Actions */}
        {(user.role === 'superadmin' || user.role === 'admin') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800"
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
                  className="px-4 py-2.5 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:from-blue-100 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/20 transition-all border border-zinc-200 dark:border-zinc-700"
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