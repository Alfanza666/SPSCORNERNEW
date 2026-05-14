import React from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft, LogOut, Menu, X, Home, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import SPSLogo from '../../components/SPSLogo';
import { motion, AnimatePresence } from 'motion/react';

const PAGE_TITLES: Record<string, string> = {
  pengaduan: 'Pengaduan & Pembelaan',
  pengumuman: 'Pengumuman Serikat',
  program: 'Program Serikat',
  kritik: 'Kritik & Saran',
};

const PAGE_ICONS: Record<string, React.ReactNode> = {
  pengaduan: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  pengumuman: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-2.147a1.76 1.76 0 010-2.943L11 5.882z" />
    </svg>
  ),
  program: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  ),
  kritik: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
};

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, signOut } = useAuthStore();
  const [showMenu, setShowMenu] = React.useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/portal');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getPageTitle = (path: string) => {
    for (const [key, title] of Object.entries(PAGE_TITLES)) {
      if (path.includes(key)) return title;
    }
    return '';
  };

  const getPageIcon = (path: string) => {
    for (const [key, icon] of Object.entries(PAGE_ICONS)) {
      if (path.includes(key)) return icon;
    }
    return (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    );
  };

  const isDashboard = location.pathname === '/portal' || location.pathname === '/portal/';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-amber-200/50 dark:border-amber-800/30 shadow-lg shadow-amber-500/5">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleBack}
              className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-800/30 hover:from-amber-200 hover:to-amber-100 dark:hover:from-amber-900 dark:hover:to-amber-800 transition-all shadow-md"
            >
              <ChevronLeft className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </motion.button>

            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl blur-md opacity-50" />
                <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 p-2 rounded-2xl shadow-lg">
                  <SPSLogo className="h-7" variant="icon" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">SPS Corner</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">Portal Serikat</span>
              </div>
            </motion.div>

            {user ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowMenu(v => !v)}
                className="p-2.5 rounded-2xl bg-gradient-to-br from-zinc-100 to-white dark:from-zinc-800 dark:to-zinc-900 hover:from-zinc-200 dark:hover:from-zinc-700 transition-all shadow-md"
              >
                {showMenu ? (
                  <X className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                ) : (
                  <Menu className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                )}
              </motion.button>
            ) : (
              <div className="w-10" />
            )}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!isDashboard && getPageTitle(location.pathname) && (
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm border-b border-amber-200/50 dark:border-amber-800/30"
          >
            <div className="max-w-md mx-auto px-4 py-5">
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl blur-lg opacity-40" />
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/30">
                    <span className="text-white">{getPageIcon(location.pathname)}</span>
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                    {getPageTitle(location.pathname)}
                  </h1>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">Serikat Pekerja Sariroti Indonesia</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMenu && user && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute right-4 top-20 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-amber-200/50 dark:border-amber-800/30 z-50 overflow-hidden"
            >
              <div className="relative p-6 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <SPSLogo className="h-8" variant="icon" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-lg truncate">{user.name}</p>
                    <p className="text-xs text-white/80 truncate">{user.nik || 'NIK tidak tersedia'}</p>
                  </div>
                </div>
                <div className="relative mt-4 flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-xl text-xs font-bold text-white uppercase">
                    {user.role}
                  </span>
                </div>
              </div>
              
              <div className="p-3 space-y-1">
                <motion.button
                  whileHover={{ x: 4 }}
                  onClick={() => { setShowMenu(false); navigate('/portal'); }}
                  className="w-full p-3 text-left hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-2xl transition-all text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <Home className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  Dashboard Portal
                </motion.button>
                <motion.button
                  whileHover={{ x: 4 }}
                  onClick={() => { setShowMenu(false); }}
                  className="w-full p-3 text-left hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-2xl transition-all text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  Pengaturan Akun
                </motion.button>
              </div>
              
              <div className="p-3 border-t border-amber-100 dark:border-amber-900/30">
                <motion.button
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { handleSignOut(); setShowMenu(false); }}
                  className="w-full p-3 text-left hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl transition-all text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                    <LogOut className="w-4 h-4" />
                  </div>
                  Keluar dari Portal
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-md mx-auto w-full">
        <Outlet />
      </main>
      
      <footer className="py-6 text-center border-t border-amber-200/50 dark:border-amber-800/30 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3">
          <SPSLogo className="h-5" variant="icon" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">SPS Corner</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">© 2024 Serikat Pekerja Sariroti</span>
          </div>
        </div>
      </footer>
    </div>
  );
}