import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  LogOut, 
  LayoutDashboard, 
  Store, 
  Users, 
  Package, 
  Receipt, 
  CreditCard,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Bell,
  Search,
  User as UserIcon,
  KeyRound,
  Settings,
  Tag
} from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { motion, AnimatePresence } from 'motion/react';
import Logo from '../../components/ui/FEDERASI RIKAT PEKERJ SUKSES.png';
import { ChangePasswordModal } from '../../components/ui/ChangePasswordModal';

function DashboardErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-red-50 p-8 rounded-[2.5rem] max-w-md w-full border border-red-100 shadow-xl shadow-red-200/20"
      >
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <X className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-red-900 mb-2">Terjadi Kesalahan</h2>
        <p className="text-red-600 mb-8 text-sm font-medium leading-relaxed">{error.message}</p>
        <button 
          onClick={resetErrorBoundary} 
          className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-600/20"
        >
          Coba Lagi
        </button>
      </motion.div>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const NavItem = ({ to, icon: Icon, label, isActive, onClick }: NavItemProps) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 group ${
        isActive 
          ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-[inset_2px_2px_4px_rgba(59,130,246,0.1)] dark:shadow-[inset_2px_2px_4px_rgba(59,130,246,0.2)]' 
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
        isActive ? 'clay-icon-blue' : 'bg-white dark:bg-zinc-800 clay-icon group-hover:scale-110'
      }`}>
        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white'}`} />
      </div>
      <span className="flex-1 text-left">{label}</span>
      {isActive && (
        <motion.div layoutId="active-nav" className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
      )}
    </button>
  );
};

export default function DashboardLayout() {
  const { user, isLoading, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target as Node)) {
        setIsNotificationDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isAdmin = user.role === 'admin';
  const isSeller = user.role === 'seller';

  const renderNavItems = () => (
    <>
      {isAdmin && (
        <>
          <NavItem 
            to="/dashboard/admin" 
            icon={LayoutDashboard} 
            label="Overview" 
            isActive={location.pathname === "/dashboard/admin"}
            onClick={() => { navigate("/dashboard/admin"); setIsSidebarOpen(false); }}
          />
          <NavItem 
            to="/dashboard/admin/sellers" 
            icon={Users} 
            label="Data Penjual" 
            isActive={location.pathname === "/dashboard/admin/sellers"}
            onClick={() => { navigate("/dashboard/admin/sellers"); setIsSidebarOpen(false); }}
          />
          <NavItem 
            to="/dashboard/admin/categories" 
            icon={Tag} 
            label="Kategori Produk" 
            isActive={location.pathname === "/dashboard/admin/categories"}
            onClick={() => { navigate("/dashboard/admin/categories"); setIsSidebarOpen(false); }}
          />
          <NavItem 
            to="/dashboard/admin/products" 
            icon={Package} 
            label="Semua Produk" 
            isActive={location.pathname === "/dashboard/admin/products"}
            onClick={() => { navigate("/dashboard/admin/products"); setIsSidebarOpen(false); }}
          />
          <NavItem 
            to="/dashboard/admin/transactions" 
            icon={Receipt} 
            label="Riwayat Transaksi" 
            isActive={location.pathname === "/dashboard/admin/transactions"}
            onClick={() => { navigate("/dashboard/admin/transactions"); setIsSidebarOpen(false); }}
          />
          <NavItem 
            to="/dashboard/admin/withdrawals" 
            icon={CreditCard} 
            label="Penarikan Saldo" 
            isActive={location.pathname === "/dashboard/admin/withdrawals"}
            onClick={() => { navigate("/dashboard/admin/withdrawals"); setIsSidebarOpen(false); }}
          />
        </>
      )}

      {isSeller && (
        <>
          <div className="tour-seller-sidebar-overview">
            <NavItem 
              to="/dashboard/seller" 
              icon={LayoutDashboard} 
              label="Overview" 
              isActive={location.pathname === "/dashboard/seller"}
              onClick={() => { navigate("/dashboard/seller"); setIsSidebarOpen(false); }}
            />
          </div>
          <div className="tour-seller-sidebar-products">
            <NavItem 
              to="/dashboard/seller/products" 
              icon={Package} 
              label="Produk Saya" 
              isActive={location.pathname === "/dashboard/seller/products"}
              onClick={() => { navigate("/dashboard/seller/products"); setIsSidebarOpen(false); }}
            />
          </div>
          <div className="tour-seller-sidebar-withdrawals">
            <NavItem 
              to="/dashboard/seller/withdrawals" 
              icon={CreditCard} 
              label="Penarikan" 
              isActive={location.pathname === "/dashboard/seller/withdrawals"}
              onClick={() => { navigate("/dashboard/seller/withdrawals"); setIsSidebarOpen(false); }}
            />
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 flex overflow-hidden transition-colors duration-300">
      {/* Sidebar Desktop */}
      <aside className="w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col hidden lg:flex relative z-30 shadow-[4px_0_24px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-colors duration-300">
        <div className="h-28 flex items-center px-10 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="relative">
              <motion.img 
                whileHover={{ scale: 1.1, rotate: 5 }}
                src={Logo} 
                alt="SPS Corner Logo" 
                className="h-12 w-auto object-contain drop-shadow-md" 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                }} 
              />
              <div className="hidden clay-icon-amber w-12 h-12">
                <ShieldCheck className="w-8 h-8" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">
                SPS <span className="text-blue-600 dark:text-blue-400">Corner</span>
              </h1>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">Dashboard</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-6 space-y-8 overflow-y-auto custom-scrollbar">
          <div>
            <div className="px-4 py-2 mb-4 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em]">
              Menu Utama
            </div>
            <div className="space-y-2">
              {renderNavItems()}
            </div>
          </div>

          <div>
            <div className="px-4 py-2 mb-4 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em]">
              Akses Cepat
            </div>
            <div className="space-y-2 tour-seller-sidebar-kiosk">
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                onClick={() => navigate('/kiosk')}
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                  <Store className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                </div>
                Lihat Kiosk
              </button>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-4 p-4 mb-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2rem] border-2 border-white dark:border-zinc-700 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]">
            <div className="w-12 h-12 rounded-2xl clay-icon-blue font-black text-xl">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-zinc-900 dark:text-white truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          
          <button
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-black text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group"
            onClick={handleSignOut}
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
              <LogOut className="w-5 h-5" />
            </div>
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-white dark:bg-zinc-900 z-50 lg:hidden flex flex-col shadow-2xl dark:shadow-black"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <img src={Logo} alt="SPS Corner Logo" className="h-8 w-auto object-contain" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                  }} />
                  <div className="hidden w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-white">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="font-black text-xl text-zinc-900 dark:text-white">SPS Corner</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-1.5">
                  {renderNavItems()}
                </div>
              </div>
              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800">
                <div className="mb-4 text-[8px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.3em] text-center">
                  v2.1.0-blue-mobile
                </div>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-5 h-5" />
                  Keluar Akun
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-24 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 md:px-12 sticky top-0 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-colors duration-300">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden clay-icon w-12 h-12 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/50 px-6 py-3 rounded-2xl border-2 border-white dark:border-zinc-700 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] group focus-within:bg-white dark:focus-within:bg-zinc-800 focus-within:ring-4 focus-within:ring-blue-500/10 dark:focus-within:ring-blue-500/20 transition-all">
              <Search className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400" />
              <input 
                type="text" 
                placeholder="Cari data..." 
                className="bg-transparent border-none outline-none text-sm font-bold text-zinc-900 dark:text-white w-48 lg:w-80 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="relative" ref={notificationDropdownRef}>
              <button 
                onClick={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                className="relative clay-icon w-12 h-12 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Bell className="w-6 h-6" />
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm" />
              </button>
              
              <AnimatePresence>
                {isNotificationDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-4 w-96 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl dark:shadow-black border border-zinc-100 dark:border-zinc-800 overflow-hidden z-50"
                  >
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                      <h3 className="font-black text-zinc-900 dark:text-white">Notifikasi</h3>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full shadow-sm">1 Baru</span>
                    </div>
                    <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
                      <div 
                        className="p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-zinc-50 dark:border-zinc-800 cursor-pointer group"
                        onClick={() => {
                          setIsNotificationDropdownOpen(false);
                          navigate(isAdmin ? '/dashboard/admin/transactions' : '/dashboard/seller/products');
                        }}
                      >
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 clay-icon group-hover:scale-110 transition-transform">
                            <Receipt className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900 dark:text-white">Transaksi Baru</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">Ada pesanan baru yang masuk ke sistem. Segera proses pesanan tersebut.</p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest mt-3">Baru saja</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 text-center bg-zinc-50/30 dark:bg-zinc-800/30">
                      <button 
                        onClick={() => setIsNotificationDropdownOpen(false)}
                        className="text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-widest"
                      >
                        Tandai semua dibaca
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-10 w-1 bg-zinc-100 dark:bg-zinc-800 rounded-full hidden md:block" />
            
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-2 rounded-[1.5rem] transition-all text-left group"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-black text-zinc-900 dark:text-white leading-none mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user.name}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">{user.role}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl clay-icon-blue font-black text-xl group-hover:scale-105 transition-transform">
                  {user.name.charAt(0)}
                </div>
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-4 w-64 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl dark:shadow-black border border-zinc-100 dark:border-zinc-800 overflow-hidden z-50"
                  >
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 sm:hidden bg-zinc-50/50 dark:bg-zinc-800/50">
                      <p className="text-sm font-black text-zinc-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">{user.role}</p>
                    </div>
                    <div className="p-3">
                      <button 
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setIsChangePasswordModalOpen(true);
                        }}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        Ganti Password
                      </button>
                      <div className="h-1 bg-zinc-50 dark:bg-zinc-800 my-2 mx-4 rounded-full" />
                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                          <LogOut className="w-5 h-5" />
                        </div>
                        Keluar Akun
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-auto bg-transparent">
          <div className="max-w-7xl mx-auto p-4 md:p-10">
            <ErrorBoundary FallbackComponent={DashboardErrorFallback} onReset={() => window.location.reload()}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </div>
        </div>
      </main>

      <ChangePasswordModal 
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
}
