import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Home, LogOut, User, Check, Clock, HelpCircle, Bell } from 'lucide-react';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
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
      </div>      {/* Global error reporter - auto captures crashes + manual report button */}
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

  // Show phone modal if user is logged in via Google but has no phone
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if (user && isCatalog && !user.phone) {
      // Small delay to avoid jarring the user immediately
      const t = setTimeout(() => setShowPhoneModal(true), 1500);
      return () => clearTimeout(t);
    }
  }, [user, isCatalog]);

  // Notification bell for logged-in buyers
  const { notifications, unreadCount, markAllAsRead, markOneAsRead } = useNotifications();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const currentStepIndex = STEPS.findIndex(step => step.path === location.pathname);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleHomeClick = () => {
    if (user && user.role !== 'buyer') {
      navigate(`/dashboard/${user.role}`);
    } else {
      navigate('/portal');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    clearCart();
    sessionStorage.removeItem('buyerName');
    navigate('/');
  };

  const handleBack = async () => {
    // If we are on checkout and going back to cart, we should release reservations
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
    
    // Custom back navigation based on current step
    if (currentStepIndex > 0) {
      navigate(STEPS[currentStepIndex - 1].path);
    } else {
      navigate(-1);
    }
  };

  // Idle timeout (2 minutes)
  useEffect(() => {
    if (isSuccess) return; // Don't timeout on success page

    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        // Release any active reservations
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
      }, 2 * 60 * 1000); // 2 minutes
    };

    // Events to listen for activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });

    // Initial setup
    resetTimeout();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, [navigate, clearCart, isSuccess, reservations, setReservations]);

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      {!isSuccess && (
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-100/50 dark:border-zinc-800 sticky top-0 z-50 shadow-sm dark:shadow-black/20 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              {!isCatalog && (
                <button
                  onClick={handleBack}
                  className="clay-icon w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
              <div className="flex items-center gap-2 cursor-pointer group" onClick={handleHomeClick}>
                <div className="relative">
                  <SPSLogo variant="wide" className="h-10 sm:h-14 transition-transform hover:scale-110 hover:rotate-3" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {isCatalog && (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => window.dispatchEvent(new Event('start-tutorial'))}
                    className="clay-icon w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Bantuan / Tutorial"
                  >
                    <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={() => navigate('/kiosk/history')}
                    className="clay-icon w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 overflow-hidden guide-history-btn"
                    title="Riwayat Pesanan"
                  >
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  {user && (
                    <>
                      {/* Notification Bell */}
                      <div className="relative">
<button
                            onClick={() => { setShowNotifDropdown(v => !v); }}
                            className="clay-icon w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 relative guide-notif-btn"
                            title="Notifikasi"
                          >
                          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                          {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold border border-white dark:border-zinc-800">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                        </button>
                        {showNotifDropdown && (
                          <div className="absolute right-0 top-12 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 z-[100] overflow-hidden">
                            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                              <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Notifikasi</p>
                              {unreadCount > 0 && (
                                <button 
                                  onClick={() => markAllAsRead()}
                                  className="text-[10px] font-black text-blue-600 hover:text-blue-700"
                                >
                                  Tandai Semua Dibaca
                                </button>
                              )}
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                              <AnimatePresence>
                                {notifications.filter(n => !n.isRead).length === 0 ? (
                                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-zinc-400 text-xs font-medium py-6">Tidak ada notifikasi baru</motion.p>
                                ) : (
                                  notifications.filter(n => !n.isRead).slice(0, 10).map(n => (
                                    <motion.button
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      transition={{ duration: 0.2 }}
                                      key={n.id}
                                      role="alert"
                                      onClick={() => { markOneAsRead(n.id); navigate(n.path); setShowNotifDropdown(false); }}
                                      className={`w-full text-left p-3 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-l-4 ${
                                        n.type === 'transaction' ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-blue-500' :
                                        n.type === 'withdrawal' ? 'bg-amber-50/50 dark:bg-amber-900/10 border-l-amber-500' :
                                        'bg-zinc-50 dark:bg-zinc-800/50 border-l-zinc-300 dark:border-l-zinc-600'
                                      }`}
                                    >
                                      <p className="text-xs font-black text-zinc-900 dark:text-white leading-snug">{n.title}</p>
                                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 font-medium">{n.message}</p>
                                    </motion.button>
                                  ))
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Profile button */}
                      <button
                        onClick={() => navigate('/kiosk/profile')}
                        className="clay-icon w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 guide-profile-btn"
                        title="Profil & Keamanan"
                      >
                        <User className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate('/kiosk/cart')}
                    className="relative clay-icon-amber h-7 w-7 sm:h-8 sm:w-auto sm:px-3 group guide-cart-btn"
                  >
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-1.5" />
                    <span className="hidden sm:inline text-[10px] font-bold">Keranjang</span>
                    {totalItems > 0 && (
                        <div
                          className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 bg-red-500 text-white w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[6px] sm:text-[8px] font-bold shadow-sm border border-white dark:border-zinc-800"
                        >
                          {totalItems}
                        </div>
                      )}
                  </button>
                </div>
              )}

              {user ? (
                <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-zinc-200 dark:border-zinc-800">
                  <div 
                    className="text-right hidden lg:block cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => navigate('/kiosk/profile')}
                  >
                    <p className="text-[10px] sm:text-xs font-bold text-zinc-900 dark:text-white leading-none">{user.name}</p>
                    <p className="text-[6px] sm:text-[8px] text-zinc-400 dark:text-zinc-500 font-bold mt-0.5 uppercase tracking-wider">{user.nik || user.role}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="clay-icon w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                    title="Keluar"
                  >
                    <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="clay-icon w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Stepper Indicator */}
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

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4">
        <ErrorBoundary FallbackComponent={KioskErrorFallback} onReset={() => navigate('/kiosk')}>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Footer */}
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

      {/* Global error reporter: auto-captures crashes + manual bug report button */}
      <ErrorReporter />

    </div>
  );
}
