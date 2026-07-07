import React, { useState, useEffect, Fragment } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, isEmployeeNik } from '../../store/useAuthStore';
import { useNotifications } from '../../hooks/useNotifications';
import { supabase } from '../../lib/supabase';
import { ErrorBoundary } from 'react-error-boundary';
import { Dialog, Transition, Menu } from '@headlessui/react';
import {
  LogOut,
  LayoutDashboard,
  Shield,
  Bell,
  Search,
  User as UserIcon,
  Settings,
  Megaphone,
  Gift,
  MessageSquare,
  AlertTriangle,
  Menu as MenuIcon,
  X,
  Home,
  ClipboardList
} from 'lucide-react';
import LogoSidebar from '../../components/ui/logo-landscape.webp';
import { ChangePasswordModal } from '../../components/ui/ChangePasswordModal';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import ErrorReporter from '../../components/ErrorReporter';

const NAV_ITEMS = [
  { path: '/portal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/portal/pengaduan', label: 'Pengaduan & Pembelaan', icon: AlertTriangle, color: 'red' },
  { path: '/portal/pengumuman', label: 'Pengumuman Serikat', icon: Megaphone, color: 'blue' },
  { path: '/portal/program', label: 'Program Serikat', icon: Gift, color: 'amber' },
  { path: '/portal/forms', label: 'Daftar Formulir', icon: ClipboardList, color: 'blue' },
  { path: '/portal/kritik', label: 'Kritik & Saran', icon: MessageSquare, color: 'purple' },
  { path: '/portal/profile', label: 'Profil Saya', icon: UserIcon, color: 'default' },
];

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  isActive: boolean;
  onClick: () => void;
  color?: string;
  key?: string | number;
}

const NavItem = ({ to, icon: Icon, label, isActive, onClick, color }: NavItemProps) => {
  const colorClasses: Record<string, string> = {
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    purple: 'text-purple-600 dark:text-purple-400',
    default: 'text-zinc-600 dark:text-zinc-400'
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 group ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-[inset_2px_2px_4px_rgba(59,130,246,0.1)] dark:shadow-[inset_2px_2px_4px_rgba(59,130,246,0.2)]'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 overflow-hidden ${
        isActive ? 'clay-icon-blue' : 'bg-white dark:bg-zinc-800 clay-icon group-hover:scale-110'
      }`}>
        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : colorClasses[color || 'default']}`} />
      </div>
      <span className="flex-1 text-left">{label}</span>
      {isActive && (
        <motion.div layoutId="active-nav-portal" className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
      )}
    </button>
  );
};

function PortalErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />
      <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Terjadi Kesalahan</h2>
      <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md">{error.message}</p>
      <button onClick={resetErrorBoundary} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
        Coba Lagi
      </button>
    </div>
  );
}

export default function PortalLayout() {
  const { user, isLoading, signOut } = useAuthStore();
  const { notifications, unreadCount, markAllAsRead, markOneAsRead, subscribeToWebPush, unsubscribeFromWebPush, pushSubscribed } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isEmployeeNik(user?.nik) && user.role !== 'admin' && user.role !== 'superadmin') {
    return <Navigate to="/kiosk" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActivePath = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isSeller = user.role === 'seller';

  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 flex overflow-hidden transition-colors duration-300">
      {/* Sidebar Desktop */}
      <aside className="w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col hidden lg:flex relative z-30 shadow-[4px_0_24px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-colors duration-300">
        <div className="h-32 flex flex-col items-center justify-center px-6 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-zinc-800/50 dark:to-zinc-900/50">
          <div className="cursor-pointer group mb-2" onClick={() => navigate('/')}>
            <img src={LogoSidebar} alt="SPS Corner" className="h-12 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" />
          </div>
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Portal Serikat Pekerja</p>
        </div>

        <div className="flex-1 py-6 px-6 space-y-8 overflow-y-auto custom-scrollbar">
          <div>
            <div className="px-4 py-2 mb-4 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em]">
              Portal Serikat
            </div>
            <div className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.path}
                  to={item.path}
                  icon={item.icon}
                  label={item.label}
                  isActive={isActivePath(item.path, item.exact)}
                  onClick={() => navigate(item.path)}
                  color={item.color}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="px-4 py-2 mb-4 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em]">
              Akses Cepat
            </div>
            <div className="space-y-2">
              {isAdmin && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                  onClick={() => navigate('/dashboard/admin')}
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                    <Settings className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                  </div>
                  Dashboard Admin
                </button>
              )}
              {isSeller && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                  onClick={() => navigate('/dashboard/seller')}
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                    <LayoutDashboard className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                  </div>
                  Dashboard Seller
                </button>
              )}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                onClick={() => navigate('/kiosk')}
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                  <Home className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                </div>
                Kembali ke Kiosk
              </button>
              {(isAdmin) && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                  onClick={() => navigate('/portal/flashsale')}
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                    <Shield className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                  </div>
                  Flashsale Aset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-4 p-4 mb-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2rem] border-2 border-white dark:border-zinc-700 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]">
            <div className="w-12 h-12 rounded-2xl clay-icon-blue font-black text-xl flex items-center justify-center overflow-hidden">
              <UserIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-zinc-900 dark:text-white truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-wider">{user.role}</p>
            </div>
          </div>

          <button
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-black text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group mb-2"
            onClick={() => setIsChangePasswordModalOpen(true)}
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all overflow-hidden">
              <Settings className="w-5 h-5 opacity-70 group-hover:opacity-100" />
            </div>
            Ganti Password
          </button>

          <button
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-black text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group"
            onClick={handleSignOut}
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all overflow-hidden">
              <LogOut className="w-5 h-5 opacity-70 group-hover:opacity-100" />
            </div>
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Transition.Root show={isSidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setIsSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-zinc-900/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-[320px] flex-1">
                <div className="flex h-full w-full flex-col bg-white dark:bg-zinc-900 shadow-2xl dark:shadow-black">
                  <div className="flex h-24 shrink-0 items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-zinc-800/50 dark:to-zinc-900/50">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => { navigate('/'); setIsSidebarOpen(false); }}>
                      <img src={LogoSidebar} alt="SPS Corner" className="h-10 w-auto object-contain" />
                    </div>
                    <button type="button" onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors focus:outline-none">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 space-y-6 custom-scrollbar">
                    <div>
                      <div className="px-4 py-2 mb-2 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em]">
                        Portal Serikat
                      </div>
                      <div className="space-y-1.5 focus:outline-none">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                          onClick={() => { navigate('/kiosk'); setIsSidebarOpen(false); }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                            <Home className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                          </div>
                          Kembali ke Kiosk
                        </button>
                        {NAV_ITEMS.map((item) => (
                          <NavItem
                            key={item.path}
                            to={item.path}
                            icon={item.icon}
                            label={item.label}
                            isActive={isActivePath(item.path, item.exact)}
                            onClick={() => { navigate(item.path); setIsSidebarOpen(false); }}
                            color={item.color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-4 p-4 mb-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-[1.5rem] border-2 border-white dark:border-zinc-700">
                      <div className="w-10 h-10 rounded-xl clay-icon-blue font-black flex items-center justify-center overflow-hidden">
                        <UserIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-zinc-900 dark:text-white truncate">
                          {user.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-wider">{user.role}</p>
                      </div>
                    </div>
                    <div className="mb-4 text-[8px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.3em] text-center">
                      v5.3.0
                    </div>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all focus:outline-none"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-5 h-5" />
                      Keluar Akun
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-24 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 lg:px-12 sticky top-0 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-colors duration-300">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden clay-icon w-12 h-12 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/50 px-6 py-3 rounded-2xl border-2 border-white dark:border-zinc-700 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] group focus-within:bg-white dark:focus-within:bg-zinc-800 focus-within:ring-4 focus-within:ring-blue-500/10 dark:focus-within:ring-blue-500/20 transition-all">
              <Search className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400" />
              <input
                type="text"
                placeholder="Cari di portal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-bold text-zinc-900 dark:text-white w-48 xl:w-80 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <Menu as="div" className="relative">
              <Menu.Button className="relative clay-icon w-12 h-12 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none">
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm" />
                )}
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95 y-2"
                enterTo="transform opacity-100 scale-100 y-0"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100 y-0"
                leaveTo="transform opacity-0 scale-95 y-2"
              >
                <Menu.Items className="absolute right-[-60px] sm:right-0 mt-4 w-[320px] sm:w-96 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl dark:shadow-black border border-zinc-100 dark:border-zinc-800 overflow-hidden z-50 focus:outline-none">
                  <div className="p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                    <h3 className="font-black text-zinc-900 dark:text-white">Notifikasi</h3>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full shadow-sm">
                        {unreadCount} Baru
                      </span>
                    )}
                  </div>
                  {'Notification' in window && Notification.permission === 'default' && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between gap-3">
                      <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Nyalakan push notifikasi untuk update</p>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          subscribeToWebPush && subscribeToWebPush(true).then(() => {
                            if (Notification.permission === 'granted') window.location.reload();
                          });
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 shadow-sm"
                      >
                        Aktifkan
                      </button>
                    </div>
                  )}
                  {'Notification' in window && Notification.permission === 'granted' && pushSubscribed && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 flex items-center justify-between gap-3">
                      <p className="text-xs text-red-700 dark:text-red-400 font-medium">Push notifikasi aktif</p>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          unsubscribeFromWebPush && unsubscribeFromWebPush();
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 shadow-sm"
                      >
                        Nonaktifkan
                      </button>
                    </div>
                  )}
                  {'Notification' in window && Notification.permission === 'granted' && !pushSubscribed && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between gap-3">
                      <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Izinkan push notifikasi untuk update</p>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          subscribeToWebPush && subscribeToWebPush(true);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 shadow-sm"
                      >
                        Aktifkan
                      </button>
                    </div>
                  )}
                  <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
                    {notifications.filter(n => !n.isRead).length === 0 ? (
                      <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                        <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">Belum ada notifikasi baru</p>
                      </div>
                    ) : (
                      notifications.filter(n => !n.isRead).map((notif) => (
                        <Menu.Item key={notif.id}>
                          {({ active }) => (
                            <div
                              className={`m-3 p-4 sm:p-5 rounded-2xl cursor-pointer group transition-all shadow-sm ${
                                active ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''
                              } bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700`}
                              onClick={() => {
                                markOneAsRead(notif.id);
                                navigate(notif.path);
                              }}
                            >
                              <div className="flex gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:scale-105 transition-transform shadow-sm">
                                  <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-black text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                      {notif.title}
                                    </p>
                                    {!notif.isRead && (
                                      <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0 mt-1.5 shadow-sm" />
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-1 sm:mt-1.5 leading-relaxed font-medium">{notif.message}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </Menu.Item>
                      ))
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 text-center bg-zinc-50/30 dark:bg-zinc-800/30">
                      <Menu.Item>
                        <button
                          onClick={markAllAsRead}
                          className="text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-widest outline-none w-full text-center"
                        >
                          Tandai semua dibaca
                        </button>
                      </Menu.Item>
                    </div>
                  )}
                </Menu.Items>
              </Transition>
            </Menu>

            <div className="h-10 w-1 bg-zinc-100 dark:bg-zinc-800 rounded-full hidden md:block" />

            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-2 rounded-[1.5rem] transition-all text-left group focus:outline-none">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-black text-zinc-900 dark:text-white leading-none mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user.name}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">{user.role}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl clay-icon-blue font-black text-xl group-hover:scale-105 transition-transform flex items-center justify-center overflow-hidden">
                  <UserIcon className="w-6 h-6 text-white" />
                </div>
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95 y-2"
                enterTo="transform opacity-100 scale-100 y-0"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100 y-0"
                leaveTo="transform opacity-0 scale-95 y-2"
              >
                <Menu.Items className="absolute right-0 mt-4 w-64 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl dark:shadow-black border border-zinc-100 dark:border-zinc-800 overflow-hidden z-50 focus:outline-none">
                  <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 sm:hidden bg-zinc-50/50 dark:bg-zinc-800/50">
                    <p className="text-sm font-black text-zinc-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">{user.role}</p>
                  </div>
                  <div className="p-3">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => navigate('/portal/profile')}
                          className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group outline-none ${
                            active ? 'bg-zinc-50 dark:bg-zinc-800/50 text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all overflow-hidden">
                            <UserIcon className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                          </div>
                          Profil Saya
                        </button>
                      )}
                    </Menu.Item>
                    <div className="h-1 bg-zinc-50 dark:bg-zinc-800 my-2 mx-4 rounded-full" />
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleSignOut}
                          className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group outline-none ${
                            active ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' : 'text-red-600 dark:text-red-500'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all overflow-hidden">
                            <LogOut className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                          </div>
                          Keluar Akun
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-auto bg-transparent">
          <div className="max-w-7xl mx-auto p-4 md:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <ErrorBoundary FallbackComponent={PortalErrorFallback} onReset={() => window.location.reload()}>
                  <Outlet />
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />

      <ErrorReporter />
    </div>
  );
}