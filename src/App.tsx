import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';
import Tutorial from './components/Tutorial';
import FloatingReportButton from './components/FloatingReportButton';

// Lazy load components
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/auth/Register'));
const AuthCallback = React.lazy(() => import('./pages/auth/AuthCallback'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const KioskLayout = React.lazy(() => import('./pages/kiosk/KioskLayout'));
const Catalog = React.lazy(() => import('./pages/kiosk/Catalog'));
const Cart = React.lazy(() => import('./pages/kiosk/Cart'));
const Checkout = React.lazy(() => import('./pages/kiosk/Checkout'));
const Validate = React.lazy(() => import('./pages/kiosk/Validate'));
const Success = React.lazy(() => import('./pages/kiosk/Success'));
const History = React.lazy(() => import('./pages/kiosk/History'));
const Profile = React.lazy(() => import('./pages/kiosk/Profile'));
const DigitalProducts = React.lazy(() => import('./pages/kiosk/DigitalProducts'));
const Terms = React.lazy(() => import('./pages/Terms'));
const Contact = React.lazy(() => import('./pages/Contact'));
const HelpCenter = React.lazy(() => import('./pages/HelpCenter'));
const FAQ = React.lazy(() => import('./pages/FAQ'));
const RefundPolicy = React.lazy(() => import('./pages/RefundPolicy'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));

const DashboardLayout = React.lazy(() => import('./pages/dashboard/DashboardLayout'));
const AdminDashboard = React.lazy(() => import('./pages/dashboard/admin/AdminDashboard'));
const AdminSellers = React.lazy(() => import('./pages/dashboard/admin/AdminSellers'));
const AdminCategories = React.lazy(() => import('./pages/dashboard/admin/AdminCategories'));
const AdminProducts = React.lazy(() => import('./pages/dashboard/admin/AdminProducts'));
const AdminTransactions = React.lazy(() => import('./pages/dashboard/admin/AdminTransactions'));
const AdminWithdrawals = React.lazy(() => import('./pages/dashboard/admin/AdminWithdrawals'));
const AdminSettings = React.lazy(() => import('./pages/dashboard/admin/AdminSettings'));
const AdminReturns = React.lazy(() => import('./pages/dashboard/admin/AdminReturns'));
const AdminStockRequests = React.lazy(() => import('./pages/dashboard/admin/AdminStockRequests'));
const AdminStockOpname = React.lazy(() => import('./pages/dashboard/admin/AdminStockOpname'));
const AdminStandbySchedule = React.lazy(() => import('./pages/dashboard/admin/AdminStandbySchedule'));

const SellerDashboard = React.lazy(() => import('./pages/dashboard/seller/SellerDashboard'));
const SellerProducts = React.lazy(() => import('./pages/dashboard/seller/SellerProducts'));
const SellerWithdrawals = React.lazy(() => import('./pages/dashboard/seller/SellerWithdrawals'));
const SellerTransactions = React.lazy(() => import('./pages/dashboard/seller/SellerTransactions'));

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-zinc-800">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Oops! Terjadi Kesalahan</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6 leading-relaxed">
          Maaf, sistem mengalami gangguan sementara. Silakan muat ulang halaman atau kembali ke beranda.
        </p>
        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl mb-6 text-left overflow-auto max-h-32">
          <p className="text-xs font-mono text-red-600 dark:text-red-400 break-words">
            {error.message}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-4 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-sm"
          >
            Ke Beranda
          </button>
          <button
            onClick={resetErrorBoundary}
            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm shadow-lg shadow-blue-600/20"
          >
            Coba Lagi
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

import AdminPickup from './pages/dashboard/admin/AdminPickup';

export default function App() {
  const { fetchProfile, setUser } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
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
        <Toaster 
          toastOptions={{
            className: 'text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-3',
            style: {
              maxWidth: '90vw',
              borderRadius: '12px',
            }
          }}
        />
        <FloatingReportButton />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/refund" element={<RefundPolicy />} />
            
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
              <Route path="admin/pickup" element={<AdminPickup />} />
              <Route path="admin/withdrawals" element={<AdminWithdrawals />} />
              <Route path="admin/stock-requests" element={<AdminStockRequests />} />
              <Route path="admin/returns" element={<AdminReturns />} />
              <Route path="admin/stock-opname" element={<AdminStockOpname />} />
              <Route path="admin/standby-schedule" element={<AdminStandbySchedule />} />
              <Route path="admin/settings" element={<AdminSettings />} />
              
              <Route path="seller" element={<SellerDashboard />} />
              <Route path="seller/products" element={<SellerProducts />} />
              <Route path="seller/withdrawals" element={<SellerWithdrawals />} />
              <Route path="seller/transactions" element={<SellerTransactions />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
