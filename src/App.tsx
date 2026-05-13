import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';
import Tutorial from './components/Tutorial';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// ── Helper: Lazy load with automatic retry ──
function lazyWithRetry(importFn: () => Promise<any>) {
  return React.lazy(() =>
    importFn().catch(async (err) => {
      if (!err?.message?.includes('dynamically imported')) throw err;
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        try { return await importFn(); } catch (_) { }
      }
      throw err;
    })
  );
}

// ==========================================
// KUMPULAN HALAMAN LAMA (ASLI)
// ==========================================
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
const PreOrder = lazyWithRetry(() => import('./pages/kiosk/PreOrder'));

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

const SellerDashboard = lazyWithRetry(() => import('./pages/dashboard/seller/SellerDashboard'));
const SellerProducts = lazyWithRetry(() => import('./pages/dashboard/seller/SellerProducts'));
const SellerWithdrawals = lazyWithRetry(() => import('./pages/dashboard/seller/SellerWithdrawals'));
const SellerTransactions = lazyWithRetry(() => import('./pages/dashboard/seller/SellerTransactions'));

// ==========================================
// TAMBAHAN HALAMAN PORTAL & ADMIN BARU
// ==========================================
const PortalLayout = lazyWithRetry(() => import('./pages/dashboard/PortalLayout'));
const PortalDashboard = lazyWithRetry(() => import('./pages/portal/PortalDashboard'));
const PortalProgram = lazyWithRetry(() => import('./pages/portal/PortalProgram'));
const PortalFlashsale = lazyWithRetry(() => import('./pages/portal/PortalFlashsale'));
const PortalPengumuman = lazyWithRetry(() => import('./pages/portal/PortalPengumuman'));
const PortalPengaduan = lazyWithRetry(() => import('./pages/portal/PortalPengaduan'));

const AdminScanner = lazyWithRetry(() => import('./pages/dashboard/admin/AdminScanner'));
const AdminFlashsale = lazyWithRetry(() => import('./pages/dashboard/admin/AdminFlashsale'));
const AdminGathering = lazyWithRetry(() => import('./pages/dashboard/admin/AdminGathering'));
const AdminUnionPrograms = lazyWithRetry(() => import('./pages/dashboard/admin/AdminUnionPrograms'));
const AdminDoorprize = lazyWithRetry(() => import('./pages/dashboard/admin/AdminDoorprize'));

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  const isChunkError = error?.message?.includes('dynamically imported') ||
    error?.message?.includes('Loading chunk') ||
    error?.name === 'ChunkLoadError';

  React.useEffect(() => {
    if (isChunkError) {
      const alreadyReloaded = sessionStorage.getItem('chunk_reload_attempted');
      if (!alreadyReloaded) {
        sessionStorage.setItem('chunk_reload_attempted', '1');
        window.location.reload();
      } else {
        sessionStorage.removeItem('chunk_reload_attempted');
      }
    }
  }, [isChunkError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4 text-center">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 dark:border-zinc-800">
        <h2 className="text-2xl font-black mb-2">{isChunkError ? 'Versi Baru Tersedia' : 'Oops!'}</h2>
        <p className="text-sm text-slate-500 mb-6">Silakan muat ulang halaman.</p>
        <button onClick={() => window.location.reload()} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Muat Ulang</button>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
    </div>
  );
}

export default function App() {
  const { fetchProfile, setUser } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id);
      else setUser(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfile(session.user.id);
      else setUser(null);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, setUser]);

  useEffect(() => {
    const applyDarkMode = () => {
      const savedTheme = localStorage.getItem('theme');
      const hour = new Date().getHours();
      const isNight = hour >= 18 || hour < 6;
      const shouldBeDark = savedTheme === 'dark' || (!savedTheme && isNight);
      document.documentElement.classList.toggle('dark', shouldBeDark);
    };
    applyDarkMode();
    const interval = setInterval(applyDarkMode, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter>
        <Tutorial />
        <PWAInstallPrompt />
        <Toaster position="top-center" />
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
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalDashboard />} />
              <Route path="program" element={<PortalProgram />} />
              <Route path="flashsale" element={<PortalFlashsale />} />
              <Route path="pengumuman" element={<PortalPengumuman />} />
              <Route path="pengaduan" element={<PortalPengaduan />} />
            </Route>

            <Route path="/kiosk" element={<KioskLayout />}>
              <Route index element={<Catalog />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="validate" element={<Validate />} />
              <Route path="success" element={<Success />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
              <Route path="digital" element={<DigitalProducts />} />
              <Route path="preorder" element={<PreOrder />} />
            </Route>

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

              <Route path="admin/scanner" element={<AdminScanner />} />
              <Route path="admin/flashsale" element={<AdminFlashsale />} />
              <Route path="admin/gathering" element={<AdminGathering />} />
              <Route path="admin/programs" element={<AdminUnionPrograms />} />
              <Route path="admin/doorprize" element={<AdminDoorprize />} />

              <Route path="seller" element={<SellerDashboard />} />
              <Route path="seller/products" element={<SellerProducts />} />
              <Route path="seller/withdrawals" element={<SellerWithdrawals />} />
              <Route path="seller/transactions" element={<SellerTransactions />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}