import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';
import Tutorial from './components/Tutorial';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// ── Helper: Lazy load with automatic retry (fixes ChunkLoadError after new deploy) ──
// Retries up to 3x with 1s delay before giving up and showing error
function lazyWithRetry(importFn: () => Promise<any>) {
  return React.lazy(() =>
    importFn().catch(async (err) => {
      // Only retry on chunk load errors (not code errors)
      if (!err?.message?.includes('dynamically imported')) throw err;
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        try { return await importFn(); } catch (_) {}
      }
      throw err;
    })
  );
}

// Lazy load components (lazyWithRetry handles ChunkLoadError after new deployments)
const Home = lazyWithRetry(() => import('./pages/Home'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Register = lazyWithRetry(() => import('./pages/auth/Register'));

const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const AuthCallback = lazyWithRetry(() => import('./pages/AuthCallback'));
const KioskLayout = lazyWithRetry(() => import('./pages/kiosk/KioskLayout'));
const Catalog = lazyWithRetry(() => import('./pages/kiosk/Catalog'));
const Cart = lazyWithRetry(() => import('./pages/kiosk/Cart'));
const Checkout = lazyWithRetry(() => import('./pages/kiosk/Checkout'));
const Validate = lazyWithRetry(() => import('./pages/kiosk/Validate'));
const Success = lazyWithRetry(() => import('./pages/kiosk/Success'));
const History = lazyWithRetry(() => import('./pages/kiosk/History'));
const Profile = lazyWithRetry(() => import('./pages/kiosk/Profile'));
const DigitalProducts = lazyWithRetry(() => import('./pages/kiosk/DigitalProducts'));
const Terms = lazyWithRetry(() => import('./pages/Terms'));
const Contact = lazyWithRetry(() => import('./pages/Contact'));
const HelpCenter = lazyWithRetry(() => import('./pages/HelpCenter'));
const FAQ = lazyWithRetry(() => import('./pages/FAQ'));
const RefundPolicy = lazyWithRetry(() => import('./pages/RefundPolicy'));


const DashboardLayout = lazyWithRetry(() => import('./pages/dashboard/DashboardLayout'));
const AdminDashboard = lazyWithRetry(() => import('./pages/dashboard/admin/AdminDashboard'));
const AdminSellers = lazyWithRetry(() => import('./pages/dashboard/admin/AdminSellers'));
const AdminCategories = lazyWithRetry(() => import('./pages/dashboard/admin/AdminCategories'));
const AdminProducts = lazyWithRetry(() => import('./pages/dashboard/admin/AdminProducts'));
const AdminTransactions = lazyWithRetry(() => import('./pages/dashboard/admin/AdminTransactions'));
const AdminWithdrawals = lazyWithRetry(() => import('./pages/dashboard/admin/AdminWithdrawals'));
const AdminSettings = lazyWithRetry(() => import('./pages/dashboard/admin/AdminSettings'));
const AdminReturns = lazyWithRetry(() => import('./pages/dashboard/admin/AdminReturns'));
const AdminStockRequests = lazyWithRetry(() => import('./pages/dashboard/admin/AdminStockRequests'));
const AdminReports = lazyWithRetry(() => import('./pages/dashboard/admin/AdminReports'));
const AdminPickup = lazyWithRetry(() => import('./pages/dashboard/admin/AdminPickup'));
const AdminStockOpname = lazyWithRetry(() => import('./pages/dashboard/admin/AdminStockOpname'));
const AdminPayments = lazyWithRetry(() => import('./pages/dashboard/admin/AdminPayments'));
const AdminLoyalty = lazyWithRetry(() => import('./pages/dashboard/admin/AdminLoyalty'));
const AdminStandbySchedule = lazyWithRetry(() => import('./pages/dashboard/admin/AdminStandbySchedule'));
const AdminUnionPrograms = lazyWithRetry(() => import('./pages/dashboard/admin/AdminUnionPrograms'));
const AdminAnnouncements = lazyWithRetry(() => import('./pages/dashboard/admin/AdminAnnouncements'));
const AdminFeedbacks = lazyWithRetry(() => import('./pages/dashboard/admin/AdminFeedbacks'));

const SellerDashboard = lazyWithRetry(() => import('./pages/dashboard/seller/SellerDashboard'));
const SellerProducts = lazyWithRetry(() => import('./pages/dashboard/seller/SellerProducts'));
const SellerWithdrawals = lazyWithRetry(() => import('./pages/dashboard/seller/SellerWithdrawals'));
const SellerTransactions = lazyWithRetry(() => import('./pages/dashboard/seller/SellerTransactions'));
const SellerPreOrders = lazyWithRetry(() => import('./pages/dashboard/seller/SellerPreOrders'));

const PortalLayout = lazyWithRetry(() => import('./pages/portal/PortalLayout'));
const PortalDashboard = lazyWithRetry(() => import('./pages/portal/PortalDashboard'));
const PortalPengaduan = lazyWithRetry(() => import('./pages/portal/PortalPengaduan'));
const PortalPengumuman = lazyWithRetry(() => import('./pages/portal/PortalPengumuman'));
const PortalProgram = lazyWithRetry(() => import('./pages/portal/PortalProgram'));
const PortalKritik = lazyWithRetry(() => import('./pages/portal/PortalKritik'));

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  // Detect ChunkLoadError: happens when a new deploy invalidates old cached JS chunks
  const isChunkError = error?.message?.includes('dynamically imported') ||
    error?.message?.includes('Loading chunk') ||
    error?.name === 'ChunkLoadError';

  // Auto-reload once for chunk errors (prevent infinite loop with sessionStorage flag)
  React.useEffect(() => {
    if (isChunkError) {
      const alreadyReloaded = sessionStorage.getItem('chunk_reload_attempted');
      if (!alreadyReloaded) {
        sessionStorage.setItem('chunk_reload_attempted', '1');
        window.location.reload();
      } else {
        // Second attempt failed — clear flag so next visit can try again
        sessionStorage.removeItem('chunk_reload_attempted');
      }
    }
  }, [isChunkError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-zinc-800">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
          {isChunkError ? 'Versi Baru Tersedia' : 'Oops! Terjadi Kesalahan'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6 leading-relaxed">
          {isChunkError
            ? 'Aplikasi telah diperbarui. Halaman akan dimuat ulang otomatis untuk mendapatkan versi terbaru.'
            : 'Maaf, sistem mengalami gangguan sementara. Silakan muat ulang halaman atau kembali ke beranda.'}
        </p>
        {!isChunkError && (
          <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl mb-6 text-left overflow-auto max-h-32">
            <p className="text-xs font-mono text-red-600 dark:text-red-400 break-words">
              {error.message}
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => { sessionStorage.removeItem('chunk_reload_attempted'); window.location.href = '/'; }}
            className="flex-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-4 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-sm"
          >
            Ke Beranda
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('chunk_reload_attempted'); window.location.reload(); }}
            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm shadow-lg shadow-blue-600/20"
          >
            {isChunkError ? 'Muat Ulang' : 'Coba Lagi'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-slate-200 dark:border-zinc-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-sm font-bold text-slate-400 dark:text-zinc-500 animate-pulse tracking-widest uppercase">Memuat...</p>
    </div>
  );
}


export default function App() {
  const { fetchProfile, setUser } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      // Jangan set user null di awal - biarkan state existing tetap sampai yakin logout
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Hanya proses jika ada session baru, bukan saat session jadi null karena timeout/network
      if (session?.user) {
        fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // Baru set null kalau benar2/sign out explicit
        setUser(null);
      }
      // Abaikan event lain - mencegah auto logout karena token refresh
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, setUser]);

  // Dark mode: system preference > localStorage > time-based fallback
  useEffect(() => {
    const applyDarkMode = () => {
      const savedTheme = localStorage.getItem('theme');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (savedTheme === 'dark' || savedTheme === 'light') {
        // User has explicitly set a preference
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      } else if (systemPrefersDark) {
        // Respect OS/system preference
        document.documentElement.classList.add('dark');
      } else {
        // Time-based fallback: Night = 18:00–06:00
        const hour = new Date().getHours();
        const isNight = hour >= 18 || hour < 6;
        document.documentElement.classList.toggle('dark', isNight);
      }
    };

    applyDarkMode();

    // Listen for system preference changes in real-time
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (!localStorage.getItem('theme')) applyDarkMode();
    };
    mediaQuery.addEventListener('change', handleChange);

    // Check time every minute (for time-based fallback only)
    const interval = setInterval(() => {
      if (!localStorage.getItem('theme') && !window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyDarkMode();
      }
    }, 60000);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter>
        <Tutorial />
        <PWAInstallPrompt />
        <Toaster 
          toastOptions={{
            className: 'text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-3',
            style: {
              maxWidth: '90vw',
              borderRadius: '12px',
            }
          }}
        />

        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/terms" element={<Terms />} />

            <Route path="/contact" element={<Contact />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/refund" element={<RefundPolicy />} />
            <Route path="/privacy" element={<RefundPolicy />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Portal Routes */}
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalDashboard />} />
              <Route path="pengaduan" element={<PortalPengaduan />} />
              <Route path="pengumuman" element={<PortalPengumuman />} />
              <Route path="program" element={<PortalProgram />} />
              <Route path="kritik" element={<PortalKritik />} />
            </Route>

            {/* Kiosk Routes */}
            <Route path="/kiosk" element={<KioskLayout />}>
              <Route index element={<Catalog />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="validate" element={<Validate />} />
              <Route path="success" element={<Success />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
              <Route path="digital" element={<DigitalProducts />} />
            </Route>

            {/* Dashboard Routes */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/sellers" element={<AdminSellers />} />
              <Route path="admin/categories" element={<AdminCategories />} />
              <Route path="admin/products" element={<AdminProducts />} />
              <Route path="admin/transactions" element={<AdminTransactions />} />

              <Route path="admin/withdrawals" element={<AdminWithdrawals />} />
              <Route path="admin/stock-requests" element={<AdminStockRequests />} />
              <Route path="admin/returns" element={<AdminReturns />} />
              <Route path="admin/reports" element={<AdminReports />} />
              <Route path="admin/pickup" element={<AdminPickup />} />
              <Route path="admin/stock-opname" element={<AdminStockOpname />} />
              <Route path="admin/payments" element={<AdminPayments />} />
              <Route path="admin/loyalty" element={<AdminLoyalty />} />
              <Route path="admin/standby-schedule" element={<AdminStandbySchedule />} />
              <Route path="admin/union-programs" element={<AdminUnionPrograms />} />
              <Route path="admin/announcements" element={<AdminAnnouncements />} />
              <Route path="admin/feedbacks" element={<AdminFeedbacks />} />

              <Route path="seller" element={<SellerDashboard />} />
              <Route path="seller/products" element={<SellerProducts />} />
              <Route path="seller/withdrawals" element={<SellerWithdrawals />} />
              <Route path="seller/transactions" element={<SellerTransactions />} />
              <Route path="seller/pre-orders" element={<SellerPreOrders />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
