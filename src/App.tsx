import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';

// Lazy load components
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/auth/Register'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const KioskLayout = React.lazy(() => import('./pages/kiosk/KioskLayout'));
const Catalog = React.lazy(() => import('./pages/kiosk/Catalog'));
const Cart = React.lazy(() => import('./pages/kiosk/Cart'));
const Checkout = React.lazy(() => import('./pages/kiosk/Checkout'));
const Validate = React.lazy(() => import('./pages/kiosk/Validate'));
const Success = React.lazy(() => import('./pages/kiosk/Success'));
const History = React.lazy(() => import('./pages/kiosk/History'));
const Profile = React.lazy(() => import('./pages/kiosk/Profile'));
const Terms = React.lazy(() => import('./pages/Terms'));
const Contact = React.lazy(() => import('./pages/Contact'));

const DashboardLayout = React.lazy(() => import('./pages/dashboard/DashboardLayout'));
const AdminDashboard = React.lazy(() => import('./pages/dashboard/admin/AdminDashboard'));
const AdminSellers = React.lazy(() => import('./pages/dashboard/admin/AdminSellers'));
const AdminCategories = React.lazy(() => import('./pages/dashboard/admin/AdminCategories'));
const AdminProducts = React.lazy(() => import('./pages/dashboard/admin/AdminProducts'));
const AdminTransactions = React.lazy(() => import('./pages/dashboard/admin/AdminTransactions'));
const AdminWithdrawals = React.lazy(() => import('./pages/dashboard/admin/AdminWithdrawals'));

const SellerDashboard = React.lazy(() => import('./pages/dashboard/seller/SellerDashboard'));
const SellerProducts = React.lazy(() => import('./pages/dashboard/seller/SellerProducts'));
const SellerWithdrawals = React.lazy(() => import('./pages/dashboard/seller/SellerWithdrawals'));

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Oops! Terjadi Kesalahan</h2>
        <p className="text-slate-600 mb-6">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="bg-amber-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-800 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div>
    </div>
  );
}

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

  // Automatic dark mode based on time
  useEffect(() => {
    const checkDarkMode = () => {
      const hour = new Date().getHours();
      // Night time is between 18:00 and 06:00
      const isNight = hour >= 18 || hour < 6;
      if (isNight) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    checkDarkMode();
    // Check every minute
    const interval = setInterval(checkDarkMode, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter>
        <Toaster />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            
            {/* Kiosk Routes */}
            <Route path="/kiosk" element={<KioskLayout />}>
              <Route index element={<Catalog />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="validate" element={<Validate />} />
              <Route path="success" element={<Success />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Dashboard Routes */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/sellers" element={<AdminSellers />} />
              <Route path="admin/categories" element={<AdminCategories />} />
              <Route path="admin/products" element={<AdminProducts />} />
              <Route path="admin/transactions" element={<AdminTransactions />} />
              <Route path="admin/withdrawals" element={<AdminWithdrawals />} />
              
              <Route path="seller" element={<SellerDashboard />} />
              <Route path="seller/products" element={<SellerProducts />} />
              <Route path="seller/withdrawals" element={<SellerWithdrawals />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
