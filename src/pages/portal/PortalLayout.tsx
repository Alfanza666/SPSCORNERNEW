import React from 'react';
import { useNavigate, Outlet, useLocation, Navigate } from 'react-router-dom';
import { ChevronLeft, LogOut, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import SPSLogo from '../../components/SPSLogo';
import { motion, AnimatePresence } from 'motion/react';

const PAGE_TITLES: Record<string, string> = {
  pengaduan: 'Pengaduan & Pembelaan',
  pengumuman: 'Pengumuman Serikat',
  program: 'Program Serikat',
  kritik: 'Kritik & Saran',
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

  const isDashboard = location.pathname === '/portal' || location.pathname === '/portal/';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* HEADER - Consistent with main app */}
      <header className="sticky top-0 z-50 bg-zinc-900 border-b border-zinc-800 shadow-lg">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleBack}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-400" />
            </motion.button>

            {/* LOGO */}
            <div className="pointer-events-none">
              <SPSLogo className="h-6 sm:h-7" />
            </div>

            {user ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowMenu(v => !v)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors relative"
              >
                <Menu className="w-5 h-5 text-zinc-400" />
              </motion.button>
            ) : (
              <div className="w-9" />
            )}
          </div>
        </div>
      </header>

      {/* BANNER JUDUL - only show on child pages */}
      <AnimatePresence mode="wait">
        {!isDashboard && getPageTitle(location.pathname) && (
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 overflow-hidden"
          >
            <div className="max-w-md mx-auto px-4 py-3">
              <h1 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                {getPageTitle(location.pathname)}
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Dropdown */}
      <AnimatePresence>
        {showMenu && user && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-4 top-16 w-56 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-white text-sm">{user.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{user.nik || '-'}</p>
              </div>
              <button
                onClick={() => { handleSignOut(); setShowMenu(false); }}
                className="w-full p-4 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-bold text-red-600 flex items-center gap-3"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 max-w-md mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}