import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import { useEffect, lazy, Suspense } from 'react';

// Layouts
import PortalLayout from './pages/portal/PortalLayout';
import DashboardLayout from './pages/dashboard/DashboardLayout';

// Pages - Lazy Load untuk Performa
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalProgram = lazy(() => import('./pages/portal/PortalProgram'));
const PortalFlashsale = lazy(() => import('./pages/portal/PortalFlashsale')); // Route Baru
const PortalPengumuman = lazy(() => import('./pages/portal/PortalPengumuman'));
const PortalPengaduan = lazy(() => import('./pages/portal/PortalPengaduan'));
const AdminDashboard = lazy(() => import('./pages/dashboard/admin/AdminDashboard'));
const AdminScanner = lazy(() => import('./pages/dashboard/admin/AdminScanner')); // Route Baru untuk Scanner

export default function App() {
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (loading) return null;

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/portal" />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* PORTAL SPS ROUTES */}
          <Route path="/portal" element={user ? <PortalLayout /> : <Navigate to="/login" />}>
            <Route index element={<PortalDashboard />} />
            <Route path="program" element={<PortalProgram />} />
            <Route path="flashsale" element={<PortalFlashsale />} />
            <Route path="pengumuman" element={<PortalPengumuman />} />
            <Route path="pengaduan" element={<PortalPengaduan />} />
          </Route>

          {/* ADMIN DASHBOARD ROUTES */}
          <Route path="/dashboard/admin" element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="scanner" element={<AdminScanner />} />
            {/* ... route admin lainnya ... */}
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
      <Toaster position="top-center" />
    </BrowserRouter>
  );
}
