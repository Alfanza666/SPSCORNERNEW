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
import { motion } from 'motion/react';

interface PortalStats {
  totalMembers: number;
  activePrograms: number;
  pendingFeedback: number;
}

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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const menuItems = [
    {
      id: 'pengaduan',
      title: 'Pengaduan & Pembelaan',
      description: 'Sampaikan masalah dengan aman',
      icon: Shield,
      color: 'bg-red-500',
      href: '/portal/pengaduan',
      available: true
    },
    {
      id: 'pengumuman',
      title: 'Pengumuman Serikat',
      description: 'Info terbaru dari manajemen',
      icon: Megaphone,
      color: 'bg-blue-500',
      href: '/portal/pengumuman',
      available: true
    },
    {
      id: 'program',
      title: 'Program Serikat',
      description: 'Kupon, Kurban, Gathering',
      icon: Gift,
      color: 'bg-amber-500',
      href: '/portal/program',
      available: true
    },
    {
      id: 'kritik',
      title: 'Kritik & Saran',
      description: 'Untuk meeting bipartit',
      icon: MessageSquare,
      color: 'bg-purple-500',
      href: '/portal/kritik',
      available: true
    }
  ];

  return (
    <div className="bg-[#e8ebf0] dark:bg-zinc-950 pb-8">
      {/* BANNER - Judul Page (PORTAL SERIKAT) + Bell + Profile */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between relative">

            {/* JUDUL PAGE MENGGANTIKAN POSISI LOGO */}
            <div className="flex items-center pointer-events-none">
              <h1 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-widest">
                PORTAL SERIKAT
              </h1>
            </div>

            {/* Kontrol Notifikasi & Profil */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={handleBellClick}
                  className="relative p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"
                >
                  <Bell className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

{/* Notification Dropdown - sama pattern dg KioskLayout */}
                {showNotifMenu && (
                  <div className="absolute right-0 top-12 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 z-[100] overflow-hidden">
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Notifikasi</p>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-[10px] font-black text-blue-600 hover:text-blue-700"
                        >
                          Tandai Semua Dibaca
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-center text-zinc-400 text-xs font-medium py-6">Tidak ada notifikasi baru</p>
                      ) : (
                        notifications.filter(n => !n.isRead).slice(0, 10).map(n => (
                          <button
                            key={n.id}
                            onClick={() => handleNotifClick(n.path)}
                            className="w-full text-left p-3 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-l-4 bg-zinc-50 dark:bg-zinc-800/50 border-l-zinc-300 dark:border-l-zinc-600"
                          >
                            <p className="text-xs font-black text-zinc-900 dark:text-white leading-snug">{n.title}</p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{n.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifMenu(false); }}
                className="flex items-center gap-2 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 top-[60px] bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-2 z-50 min-w-[200px]">
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-700">
                  <p className="font-bold text-zinc-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-zinc-500">{user.nik || '-'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-full capitalize">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={() => { handleSignOut(); setShowProfileMenu(false); }}
                  className="w-full p-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-bold text-red-600"
                >
                  <LogOut className="w-4 h-4 inline mr-2" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="p-4 space-y-4">
        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
          <h2 className="text-xl font-black mb-1">Selamat Datang, {user.name.split(' ')[0]}! 👋</h2>
          <p className="text-blue-100 text-sm">Pilih menu di bawah untuk memulai</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.totalMembers}</p>
            <p className="text-xs text-zinc-500 font-bold">Anggota</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.activePrograms}</p>
            <p className="text-xs text-zinc-500 font-bold">Program Aktif</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.pendingFeedback}</p>
            <p className="text-xs text-zinc-500 font-bold">Feedback Baru</p>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-4">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => navigate(item.href)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-5 text-left shadow-sm border border-zinc-100 dark:border-zinc-800 hover:shadow-md transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-black text-zinc-900 dark:text-white mb-1">{item.title}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{item.description}</p>
              {item.id === 'program' && stats.activePrograms > 0 && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                  {stats.activePrograms} Program Aktif
                </span>
              )}
              {item.id === 'kritik' && stats.pendingFeedback > 0 && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                  {stats.pendingFeedback} Belum Diproses
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Quick Actions */}
        {(user.role === 'superadmin' || user.role === 'admin') && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-zinc-500" />
              Akses Cepat Admin
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/dashboard/admin')}
                className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Dashboard Admin
              </button>
              <button
                onClick={() => navigate('/dashboard/admin/union-programs')}
                className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Program Serikat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}