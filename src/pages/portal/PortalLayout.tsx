import React from 'react';
import { useNavigate, Outlet, useLocation, Navigate } from 'react-router-dom';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import SPSLogo from '../../components/SPSLogo';

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, signOut } = useAuthStore();

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
    if (path.includes('pengaduan')) return 'PENGADUAN & PEMBELAAN';
    if (path.includes('pengumuman')) return 'PENGUMUMAN SERIKAT';
    if (path.includes('program')) return 'PROGRAM SERIKAT';
    if (path.includes('kritik')) return 'KRITIK & SARAN';
    if (path.includes('kantin') || path.includes('kiosk')) return 'KIOSK';
    return '';
  };

  const isDashboard = location.pathname === '/portal' || location.pathname === '/portal/';

  // Jangan redirect saat loading - tunggu直到 auth ready
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 flex flex-col">
      {/* HEADER UTAMA - Logo Landscape Pindah Ke Tengah Sini */}
      <header className="sticky top-0 z-50 bg-zinc-900 border-b border-zinc-800 shadow-sm">
        <div className="max-w-md mx-auto px-3 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-400" />
            </button>

            {/* LOGO LANDSCAPE DI TENGAH HEADER */}
            <div className="pointer-events-none flex items-center justify-center">
              <SPSLogo className="h-6 sm:h-7" />
            </div>

            {user ? (
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/40 transition-colors"
              >
                <LogOut className="w-5 h-5 text-zinc-400 hover:text-red-500" />
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>
        </div>
      </header>

      {/* BANNER JUDUL KHUSUS CHILD PAGES */}
      {!isDashboard && getPageTitle(location.pathname) && (
        <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <h1 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-wider">
            {getPageTitle(location.pathname)}
          </h1>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-md mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}