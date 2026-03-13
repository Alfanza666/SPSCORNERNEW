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
  Settings
} from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { motion, AnimatePresence } from 'framer-motion';
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 group ${
        isActive 
          ? 'text-blue-700 bg-blue-50 shadow-sm shadow-blue-200/50' 
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-blue-600' : 'text-zinc-400 group-hover:text-zinc-900'}`} />
      <span className="flex-1 text-left">{label}</span>
      {isActive && (
        <motion.div layoutId="active-nav" className="w-1.5 h-1.5 rounded-full bg-blue-600" />
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
          <NavItem 
            to="/dashboard/seller" 
            icon={LayoutDashboard} 
            label="Overview" 
            isActive={location.pathname === "/dashboard/seller"}
            onClick={() => { navigate("/dashboard/seller"); setIsSidebarOpen(false); }}
          />
          <NavItem 
            to="/dashboard/seller/products" 
            icon={Package} 
            label="Produk Saya" 
            isActive={location.pathname === "/dashboard/seller/products"}
            onClick={() => { navigate("/dashboard/seller/products"); setIsSidebarOpen(false); }}
          />
          <NavItem 
            to="/dashboard/seller/withdrawals" 
            icon={CreditCard} 
            label="Penarikan" 
            isActive={location.pathname === "/dashboard/seller/withdrawals"}
            onClick={() => { navigate("/dashboard/seller/withdrawals"); setIsSidebarOpen(false); }}
          />
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="w-72 bg-white border-r border-zinc-200 flex flex-col hidden lg:flex relative z-30">
        <div className="h-24 flex items-center px-8">
          <div className="flex items-center gap-3">
            <img src={Logo} alt="SPS Corner Logo" className="h-10 w-auto object-contain" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
            }} />
            <div className="hidden w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
              SPS <span className="text-amber-600">Corner</span>
            </h1>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-6 space-y-8 overflow-y-auto">
          <div>
            <div className="px-4 py-2 mb-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              Menu Utama
            </div>
            <div className="space-y-1.5">
              {renderNavItems()}
            </div>
          </div>

          <div>
            <div className="px-4 py-2 mb-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              Akses Cepat
            </div>
            <div className="space-y-1.5">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all"
                onClick={() => navigate('/kiosk')}
              >
                <Store className="w-5 h-5 text-zinc-400" />
                Lihat Kiosk
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-100">
          <div className="flex items-center gap-4 p-4 mb-2 bg-zinc-50 rounded-2xl border border-zinc-200/50">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl shadow-inner">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900 truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          
          <div className="px-4 py-2 mb-2 text-[8px] font-black text-zinc-300 uppercase tracking-[0.3em] text-center">
            v2.1.0-blue-mobile
          </div>
          
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-500 hover:bg-red-50 transition-all"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5" />
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
              className="fixed top-0 left-0 bottom-0 w-80 bg-white z-50 lg:hidden flex flex-col"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <img src={Logo} alt="SPS Corner Logo" className="h-8 w-auto object-contain" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                  }} />
                  <div className="hidden w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-white">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="font-black text-xl text-zinc-900">SPS Corner</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-1.5">
                  {renderNavItems()}
                </div>
              </div>
              <div className="p-6 border-t border-zinc-100">
                <div className="mb-4 text-[8px] font-black text-zinc-300 uppercase tracking-[0.3em] text-center">
                  v2.1.0-blue-mobile
                </div>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-500 bg-red-50 transition-all"
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
        <header className="h-20 bg-white border-b border-zinc-200 flex items-center justify-between px-6 md:px-10 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-3 bg-zinc-100 px-4 py-2 rounded-xl border border-zinc-200/50 group focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <Search className="w-4 h-4 text-zinc-400 group-focus-within:text-blue-500" />
              <input 
                type="text" 
                placeholder="Cari data..." 
                className="bg-transparent border-none outline-none text-sm font-medium text-zinc-900 w-48 lg:w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="relative" ref={notificationDropdownRef}>
              <button 
                onClick={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                className="relative p-2 text-zinc-400 hover:bg-zinc-100 rounded-xl transition-colors"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              </button>
              
              <AnimatePresence>
                {isNotificationDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                      <h3 className="font-bold text-zinc-900">Notifikasi</h3>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-full">1 Baru</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <div 
                        className="p-4 hover:bg-zinc-50 transition-colors border-b border-zinc-50 cursor-pointer"
                        onClick={() => {
                          setIsNotificationDropdownOpen(false);
                          navigate(isAdmin ? '/dashboard/admin/transactions' : '/dashboard/seller/products');
                        }}
                      >
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">Selamat datang di SPS Corner</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Mulai kelola produk dan transaksi Anda dengan mudah.</p>
                            <p className="text-[10px] text-zinc-400 font-medium mt-2">Baru saja</p>
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div 
                          className="p-4 hover:bg-zinc-50 transition-colors border-b border-zinc-50 cursor-pointer"
                          onClick={() => {
                            setIsNotificationDropdownOpen(false);
                            navigate('/dashboard/admin/withdrawals');
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                              <Bell className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-zinc-900">Permintaan Penarikan Baru</p>
                              <p className="text-xs text-zinc-500 mt-0.5">Ada permintaan penarikan dana baru yang perlu diproses.</p>
                              <p className="text-[10px] text-zinc-400 font-medium mt-2">2 jam yang lalu</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-zinc-100 text-center">
                      <button 
                        onClick={() => setIsNotificationDropdownOpen(false)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700"
                      >
                        Tandai semua dibaca
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-px bg-zinc-200 hidden md:block" />
            
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-3 hover:bg-zinc-50 p-1.5 rounded-2xl transition-colors text-left"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-zinc-900 leading-none mb-1">{user.name}</p>
                  <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">{user.role}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 font-black text-lg">
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
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-zinc-100 sm:hidden">
                      <p className="text-sm font-bold text-zinc-900 truncate">{user.name}</p>
                      <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">{user.role}</p>
                    </div>
                    <div className="p-2">
                      <button 
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setIsChangePasswordModalOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                      >
                        <KeyRound className="w-4 h-4" />
                        Ganti Password
                      </button>
                      <div className="h-px bg-zinc-100 my-1 mx-2" />
                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
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
        <div className="flex-1 overflow-auto bg-zinc-50/50">
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
