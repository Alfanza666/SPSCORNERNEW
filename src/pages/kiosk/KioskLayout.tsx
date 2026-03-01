import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Home, LogOut, User } from 'lucide-react';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorBoundary } from 'react-error-boundary';
import { supabase } from '../../lib/supabase';

function KioskErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="bg-red-50 p-6 rounded-3xl max-w-md w-full border border-red-100">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Terjadi Kesalahan</h2>
        <p className="text-red-500 mb-6 text-sm">{error.message}</p>
        <Button onClick={resetErrorBoundary} className="w-full bg-red-600 hover:bg-red-700 text-white">
          Coba Lagi
        </Button>
      </div>
    </div>
  );
}

export default function KioskLayout() {
  const { items, clearCart, reservations, setReservations } = useCartStore();
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isCatalog = location.pathname === '/kiosk';
  const isSuccess = location.pathname === '/kiosk/success';

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleHomeClick = () => {
    if (user && user.role !== 'buyer') {
      navigate(`/dashboard/${user.role}`);
    } else {
      navigate('/');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    clearCart();
    sessionStorage.removeItem('buyerName');
    navigate('/');
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      {!isSuccess && (
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isCatalog && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="rounded-full bg-slate-100 hover:bg-slate-200"
                >
                  <ArrowLeft className="w-6 h-6 text-slate-700" />
                </Button>
              )}
              <div className="flex items-center gap-3 cursor-pointer" onClick={handleHomeClick}>
                <div className="bg-blue-900 text-white p-2 rounded-xl hover:bg-blue-800 transition-colors">
                  <Home className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-blue-900 tracking-tight leading-none hover:text-blue-800 transition-colors">
                    SPS Corner
                  </h1>
                  <p className="text-sm text-slate-500 font-medium">Kantin Digital</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isCatalog && (
                <Button
                  onClick={() => navigate('/kiosk/cart')}
                  className="relative h-14 px-6 rounded-2xl bg-blue-900 hover:bg-blue-800 shadow-md transition-transform active:scale-95"
                >
                  <ShoppingCart className="w-6 h-6 mr-3" />
                  <span className="text-lg font-semibold">Keranjang</span>
                  <AnimatePresence>
                    {totalItems > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm border-2 border-white"
                      >
                        {totalItems}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              )}

              {user ? (
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900 leading-none">{user.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{user.nik || user.role}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    className="rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600"
                    title="Keluar"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <User className="w-4 h-4 mr-2" />
                  Masuk
                </Button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <ErrorBoundary FallbackComponent={KioskErrorFallback} onReset={() => navigate('/kiosk')}>
          <Outlet />
        </ErrorBoundary>
        <div className="mt-20 pb-10 text-center">
          <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em]">v2.1.0-emerald-mobile</p>
        </div>
      </main>
    </div>
  );
}
