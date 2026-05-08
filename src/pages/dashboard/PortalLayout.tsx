import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotifications } from '../../hooks/useNotifications';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Megaphone, 
  Gift, 
  MessageSquare,
  LogOut,
  Bell,
  User as UserIcon,
  ChevronRight,
  Loader2,
  Store,
  Calendar,
  AlertCircle,
  QrCode,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface PortalStats {
  totalMembers: number;
  activePrograms: number;
  pendingFeedback: number;
}

export default function PortalLayout() {
  const { user, signOut, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, unreadCount } = useNotifications();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [stats, setStats] = useState<PortalStats>({
    totalMembers: 0,
    activePrograms: 0,
    pendingFeedback: 0
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      fetchStats();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Mengalihkan ke login...</p>
        </div>
      </div>
    );
  }

  const fetchStats = async () => {
    try {
      const [membersRes, programsRes, feedbackRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('union_programs').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('feedbacks').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);
      
      setStats({
        totalMembers: membersRes.count || 0,
        activePrograms: programsRes.count || 0,
        pendingFeedback: feedbackRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

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
    available: stats.activePrograms > 0
  },
  {
    id: 'kritik',
    title: 'Kritik & Saran',
    description: 'Untuk meeting bipartit',
    icon: MessageSquare,
    color: 'bg-purple-500',
    href: '/portal/kritik',
    available: stats.pendingFeedback > 0 || true
  }
];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <span className="text-white font-black text-lg">SPS</span>
              </div>
              <div>
                <h1 className="text-lg font-black text-zinc-900 dark:text-white">SPS Corner</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Portal Serikat Pekerja</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/portal/notifications')}
                className="relative p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"
              >
                <Bell className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Dropdown */}
      <AnimatePresence>
        {showProfileMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-4 top-16 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-2 z-50 min-w-[200px]"
          >
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-700">
              <p className="font-bold text-zinc-900 dark:text-white">{user.name}</p>
              <p className="text-xs text-zinc-500">{user.nik || '-'}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-full capitalize">
                {user.role}
              </span>
            </div>
            <button
              onClick={() => { navigate('/portal/profile'); setShowProfileMenu(false); }}
              className="w-full p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-sm font-bold text-zinc-700 dark:text-zinc-300"
            >
              Profil Saya
            </button>
            <button
              onClick={handleSignOut}
              className="w-full p-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-bold text-red-600"
            >
              <LogOut className="w-4 h-4 inline mr-2" />
              Keluar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

       {/* Main Content - Conditional Rendering */}
       <div className="max-w-4xl mx-auto p-4 space-y-4">
         {location.pathname === '/portal' ? (
           <>
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
                   <button
                     onClick={() => navigate('/portal/admin/scanner')}
                     className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                   >
                     Scan QR Member
                   </button>
                 </div>
               </div>
             )}

             {/* Recent Notifications */}
             {notifications.slice(0, 3).length > 0 && (
               <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700">
                 <h3 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                   <Bell className="w-4 h-4 text-zinc-500" />
                   Notifikasi Terbaru
                 </h3>
                 <div className="space-y-2">
                   {notifications.slice(0, 3).map((notif) => (
                     <div
                       key={notif.id}
                       onClick={() => navigate(notif.path)}
                       className={`p-3 rounded-xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                         !notif.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                       }`}
                     >
                       <p className="font-bold text-sm text-zinc-900 dark:text-white">{notif.title}</p>
                       <p className="text-xs text-zinc-500 line-clamp-1">{notif.message}</p>
                       <p className="text-xs text-zinc-400 mt-1">{format(new Date(notif.time), 'dd MMM HH:mm')}</p>
                     </div>
                   ))}
                 </div>
               </div>
             )}
           </>
         ) : (
           <Outlet />
         )}
       </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-zinc-400">
        <p>SPS Corner v4.6.0 • Portal Serikat Pekerja</p>
        <p className="mt-1">© 2026 SPS Corner • Banjarmasin</p>
      </div>
    </div>
  );
}