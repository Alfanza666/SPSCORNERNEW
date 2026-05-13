import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import { useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Layouts - Path disesuaikan dengan struktur folder asli Anda
import PortalLayout from './pages/dashboard/PortalLayout'; 
import DashboardLayout from './pages/dashboard/DashboardLayout';

// Pages - Lazy Load untuk Performa
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
// Menggunakan AuthCallback yang ada di root pages
const AuthCallback = lazy(() => import('./pages/AuthCallback')); 

// Portal Pages
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalProgram = lazy(() => import('./pages/portal/PortalProgram'));
const PortalFlashsale = lazy(() => import('./pages/portal/PortalFlashsale')); // Route Flashsale
const PortalPengumuman = lazy(() => import('./pages/portal/PortalPengumuman'));
const PortalPengaduan = lazy(() => import('./pages/portal/PortalPengaduan'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/dashboard/admin/AdminDashboard'));
const AdminScanner = lazy(() => import('./pages/dashboard/admin/AdminScanner')); // Route Scanner

// (Tambahkan lazy load untuk halaman admin/seller lainnya di sini jika diperlukan, 
//  tapi biarkan yang ini dulu untuk memastikan routing utama berjalan)

// Loading Screen Component saat Pindah Halaman
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#e8ebf2] dark:bg-zinc-950">
    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
  </div>
);

export default function App() {
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) return <PageLoader />;

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* PUBLIC ROUTES */}
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
            {/* Jika Anda punya route admin lain, pastikan ditambahkan di bawah sini */}
          </Route>

          {/* FALLBACK ROUTE (Jika URL tidak ditemukan) */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
      <Toaster position="top-center" />
    </BrowserRouter>
  );
}
