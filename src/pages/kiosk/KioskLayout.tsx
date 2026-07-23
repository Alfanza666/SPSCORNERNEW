import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Home, Check, Clock, HelpCircle, Bell, Store, User, Package, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore, isEmployeeNik } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { ErrorBoundary } from 'react-error-boundary';
import { supabase } from '../../lib/supabase';
import SPSLogo from '../../components/SPSLogo';

import { useNotifications } from '../../hooks/useNotifications';
import { motion, AnimatePresence } from 'motion/react';
import ErrorReporter from '../../components/ErrorReporter';

function KioskErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-3xl max-w-md w-full border border-red-100 dark:border-red-900/30">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-500 mb-2">Terjadi Kesalahan</h2>
        <p className="text-red-500 dark:text-red-400 mb-6 text-sm">{error.message}</p>
        <Button onClick={resetErrorBoundary} className="w-full bg-red-600 hover:bg-red-700 text-white">
          Coba Lagi
        </Button>
      </div>
      <ErrorReporter />
    </div>
  );
}

const STEPS = [
  { path: '/kiosk', label: 'Menu' },
  { path: '/kiosk/cart', label: 'Keranjang' },
  { path: '/kiosk/checkout', label: 'Bayar' },
  { path: '/kiosk/validate', label: 'Validasi' },
  { path: '/kiosk/success', label: 'Selesai' }
];

export default function KioskLayout() {
  const { items, clearCart, reservations, setReservations } = useCartStore();
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isCatalog = location.pathname === '/kiosk';
  const isSuccess = location.pathname === '/kiosk/success';

  const [showPhoneModal, setShowPhoneModal] = useState(false);
  useEffect(() => {
    if (user && isCatalog && !user.phone) {
      const t = setTimeout(() => setShowPhoneModal(true), 1500);
      return () => clearTimeout(t);
    }
  }, [user, isCatalog]);

  // ── Redirect paksa ke halaman bayar jika ada transaksi pending ──
  useEffect(() => {
    const skipPaths = ['/kiosk/checkout', '/kiosk/success', '/kiosk/history', '/kiosk/validate'];
    if (skipPaths.includes(location.pathname)) return;

    const pendingTxId = (() => {
      try { return sessionStorage.getItem('lastTransactionId'); } catch { return null; }
    })();
    if (!pendingTxId) return;

    fetch(`/api/transactions/${pendingTxId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.transaction?.status === 'pending') {
          navigate(`/kiosk/success?id=${pendingTxId}`, { replace: true });
        } else if (data?.transaction) {
          // Transaksi sudah dibayar/gagal → bersihkan sessionStorage
          try {
            sessionStorage.removeItem('lastTransactionId');
            sessionStorage.removeItem('paymentLocked');
          } catch {}
        }
      })
      .catch((err) => { console.warn('[KioskLayout] Pending tx check failed:', err?.message); });
  }, []);

  const { notifications, unreadCount, markAllAsRead, markOneAsRead } = useNotifications();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const currentStepIndex = STEPS.findIndex(step => step.path === location.pathname);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const getBerandaPath = () => {
    if (!user) return '/';
    if (user.role === 'seller') return '/dashboard/seller';
    if (user.role === 'admin' || user.role === 'superadmin') return '/dashboard/admin';
    return '/portal';
  };

  const handleHomeClick = () => {
    navigate(getBerandaPath());
  };

  const handleBack = async () => {
    if (location.pathname === '/kiosk/checkout' && reservations.length > 0) {
      try {
        for (const resId of reservations) {
          await supabase.rpc('release_stock', { p_reservation_id: resId });
        }
        setReservations([]);
      } catch (error) {
        console.error('Error releasing reservations on back:', error);
      }
    }
    
    if (currentStepIndex > 0) {
      navigate(STEPS[currentStepIndex - 1].path);
    } else {
      navigate(-1);
    }
  };

  useEffect(() => {
    if (isSuccess) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (reservations.length > 0) {
          try {
            for (const resId of reservations) {
              await supabase.rpc('release_stock', { p_reservation_id: resId });
            }
          } catch (error) {
            console.error('Error releasing reservations on timeout:', error);
          }
        }
        
        clearCart();
        sessionStorage.removeItem('buyerName');
        navigate('/kiosk');
      }, 2 * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimeout));
    resetTimeout();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimeout));
    };
  }, [navigate, clearCart, isSuccess, reservations, setReservations]);

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-300">
      {!isSuccess && (
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-100/50 dark:border-zinc-800 sticky top-0 z-50 shadow-sm dark:shadow-black/20 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {!isCatalog && (
                <button
                  onClick={handleBack}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
              <div className="flex items-center gap-2 cursor-pointer group" onClick={handleHomeClick}>
                <SPSLogo variant="wide" className="h-8 sm:h-14 transition-transform hover:scale-105" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 flex-1 justify-end">
              {isCatalog && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={() => window.dispatchEvent(new Event('start-tutorial'))}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group shadow-sm"
                    title="Bantuan / Tutorial"
                  >
                    <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
                  </button>
                  <button
                    onClick={() => navigate('/kiosk/history')}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group shadow-sm guide-history-btn"
                    title="Riwayat Pesanan"
                  >
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
                  </button>
                  
                  {user && (
                    <div className="relative">
                      <button
                        onClick={() => setShowNotifDropdown(v => !v)}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group relative guide-notif-btn shadow-sm"
                        title="Notifikasi"
                      >
                        <Bell className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold border-2 border-white dark:border-zinc-900 shadow-sm">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </button>
                      
                      <AnimatePresence>
                        {showNotifDropdown && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 top-12 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800 z-[100] overflow-hidden"
                          >
                            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
                              <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Notifikasi</p>
                              {unreadCount > 0 && (
                                <button 
                                  onClick={() => markAllAsRead()}
                                  className="text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                  Tandai Semua Dibaca
                                </button>
                              )}
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                              {notifications.filter(n => !n.isRead).length === 0 ? (
                                <div className="py-10 px-6 text-center">
                                  <Bell className="w-8 h-8 text-zinc-200 dark:text-zinc-800 mx-auto mb-2" />
                                  <p className="text-zinc-400 text-xs font-bold italic">Tidak ada notifikasi baru</p>
                                </div>
                              ) : (
                                notifications.filter(n => !n.isRead).slice(0, 10).map(n => (
                                  <button
                                    key={n.id}
                                    onClick={() => { markOneAsRead(n.id); navigate(n.path); setShowNotifDropdown(false); }}
                                    className={`w-full text-left p-4 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all border-l-4 ${
                                      n.type === 'transaction' ? 'bg-blue-50/30 dark:bg-blue-900/10 border-l-blue-500' :
                                      n.type === 'withdrawal' ? 'bg-amber-50/30 dark:bg-amber-900/10 border-l-amber-500' :
                                      'bg-zinc-50/50 dark:bg-zinc-800/50 border-l-zinc-300 dark:border-l-zinc-600'
                                    }`}
                                  >
                                    <p className="text-xs font-black text-zinc-900 dark:text-white leading-snug">{n.title}</p>
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 font-bold leading-relaxed">{n.message}</p>
                                  </button>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <button
                    onClick={() => navigate('/kiosk/cart')}
                    className="relative w-8 h-8 sm:w-auto sm:h-10 sm:px-4 rounded-xl flex items-center justify-center bg-amber-400 dark:bg-amber-500 text-amber-950 border border-amber-300 dark:border-amber-400 shadow-sm transition-all active:scale-95 group guide-cart-btn"
                  >
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-1.5 transition-transform group-hover:scale-110" />
                    <span className="hidden sm:inline text-xs font-bold">Keranjang</span>
                    {totalItems > 0 && (
                      <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shadow-lg border-2 border-white dark:border-zinc-900">
                        {totalItems}
                      </div>
                    )}
                  </button>
                </div>
              )}

              {user ? (
                <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-zinc-200 dark:border-zinc-800">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-0.5">Anggota</p>
                    <p className="text-xs font-black text-zinc-900 dark:text-white truncate max-w-[100px] leading-none">{user.name?.split(' ')[0]}</p>
                  </div>
                  {isEmployeeNik(user?.nik) && (
                    <button
                      onClick={() => navigate('/portal')}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group shadow-sm"
                      title="Kembali ke Portal"
                    >
                      <Home className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-blue-600 text-white text-[10px] sm:text-xs font-black rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all hover:bg-blue-700"
                >
                  LOGIN
                </button>
              )}
            </div>
          </div>
          
          {currentStepIndex >= 0 && currentStepIndex < STEPS.length - 1 && (
            <div className="bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 px-4 py-2 sm:py-3">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 sm:h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full -z-10"></div>
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 sm:h-1 bg-blue-500 dark:bg-blue-600 rounded-full -z-10 transition-all duration-500"
                    style={{ width: `${(currentStepIndex / (STEPS.length - 2)) * 100}%` }}
                  ></div>
                  
                  {STEPS.slice(0, -1).map((step, index) => {
                    const isActive = index === currentStepIndex;
                    const isPast = index < currentStepIndex;
                    
                    return (
                      <div key={step.path} className="flex flex-col items-center gap-1.5 sm:gap-1">
                        <div 
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-300 ${
                            isActive ? 'bg-blue-600 text-white shadow-sm scale-110' : 
                            isPast ? 'bg-blue-500 text-white' : 
                            'bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          {isPast ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : index + 1}
                        </div>
                        <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-blue-700 dark:text-blue-400' : isPast ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </header>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4 pb-20 sm:pb-4">
        <ErrorBoundary FallbackComponent={KioskErrorFallback} onReset={() => navigate('/kiosk')}>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Tab Navigation */}
      {!isSuccess && !['/kiosk/cart', '/kiosk/checkout', '/kiosk/validate', '/kiosk/success'].includes(location.pathname) && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-100 dark:border-zinc-800 safe-area-bottom">
          <div className="flex items-center justify-around h-14">
            {[
              { path: getBerandaPath(), icon: Home, label: 'Beranda' },
              { path: '/kiosk', icon: Store, label: 'Menu' },
              { path: '/kiosk/history', icon: Clock, label: 'Riwayat' },
              { path: '/kiosk/cart', icon: ShoppingCart, label: 'Keranjang', badge: items.length },
              { path: '/kiosk/profile', icon: User, label: 'Akun' },
            ].map(({ path, icon: Icon, label, badge }) => {
              const isActive = location.pathname === path;
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-0 px-2 py-1.5 rounded-xl transition-all relative ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {badge !== undefined && badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold border-2 border-white dark:border-zinc-900 shadow-sm">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
                  {isActive && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {!isSuccess && (
        <footer className="bg-transparent py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <div className="flex items-center justify-center gap-4 mb-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-bold">
              <button onClick={() => navigate('/terms')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Syarat &amp; Ketentuan</button>
              <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <button onClick={() => navigate('/privacy')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Kebijakan Privasi</button>
              <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <button onClick={() => navigate('/contact')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Hubungi Kami</button>
            </div>
          </div>
        </footer>
      )}

      <ErrorReporter />
    </div>
  );
}
