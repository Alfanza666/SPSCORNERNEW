import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Layouts
import PortalLayout from './pages/dashboard/PortalLayout';
import DashboardLayout from './pages/dashboard/DashboardLayout';

// Pages Dasar
import Home from './pages/Home';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

// Portal Pages
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalProgram from './pages/portal/PortalProgram';
import PortalFlashsale from './pages/portal/PortalFlashsale';
import PortalPengumuman from './pages/portal/PortalPengumuman';
import PortalPengaduan from './pages/portal/PortalPengaduan';

// Admin Pages
import AdminDashboard from './pages/dashboard/admin/AdminDashboard';
import AdminScanner from './pages/dashboard/admin/AdminScanner';
import AdminFlashsale from './pages/dashboard/admin/AdminFlashsale';
import AdminGathering from './pages/dashboard/admin/AdminGathering';

export default function App() {
  // Ambil state auth dengan cara yang lebih aman
  const authState = useAuthStore();
  const user = authState.user;
  const loading = authState.loading;

  useEffect(() => {
    // PROTEKSI UTAMA: Cek apakah fungsi initialize benar-benar ada sebelum dipanggil
    if (typeof authState.initialize === 'function') {
      authState.initialize();
    }
  }, []); // Hapus array dependency agar tidak re-render berlebihan

  // Tampilkan loading screen dengan pengecekan aman
  if (loading === true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8ebf2] dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
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
          <Route path="flashsale" element={<AdminFlashsale />} />
          <Route path="gathering" element={<AdminGathering />} />
        </Route>

        {/* FALLBACK ROUTE */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <Toaster position="top-center" />
    </BrowserRouter>
  );
}