import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Layouts Utama
import PortalLayout from './pages/dashboard/PortalLayout';
import DashboardLayout from './pages/dashboard/DashboardLayout';

// Pages Dasar
import Home from './pages/Home';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

// ==========================================
// IMPORT KIOSK (Sesuai Gambar Struktur Folder)
// ==========================================
import KioskLayout from './pages/kiosk/KioskLayout';
import Catalog from './pages/kiosk/Catalog';
import Cart from './pages/kiosk/Cart';
import Checkout from './pages/kiosk/Checkout';
import History from './pages/kiosk/History';
import Profile from './pages/kiosk/Profile';
import PreOrder from './pages/kiosk/PreOrder';
import DigitalProducts from './pages/kiosk/DigitalProducts';

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
  const authState = useAuthStore();
  const user = authState.user;
  const loading = authState.loading;

  useEffect(() => {
    // 1. Inisialisasi Auth secara aman
    if (typeof authState.initialize === 'function') {
      authState.initialize();
    }

    // 2. Fitur Auto Dark Mode (Jam 18:00 - 05:59)
    const applyTheme = () => {
      const currentHour = new Date().getHours();
      const isNightTime = currentHour >= 18 || currentHour < 6;

      if (isNightTime) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(); // Terapkan saat web dibuka
    const themeInterval = setInterval(applyTheme, 3600000); // Cek tiap 1 jam

    return () => clearInterval(themeInterval);
  }, []);

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

        {/* DASHBOARD UMUM */}
        <Route path="/dashboard" element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="kiosk" />} />

          {/* EKOSISTEM KIOSK LENGKAP */}
          <Route path="kiosk" element={<KioskLayout />}>
            <Route index element={<Catalog />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="history" element={<History />} />
            <Route path="profile" element={<Profile />} />
            <Route path="preorder" element={<PreOrder />} />
            <Route path="digital" element={<DigitalProducts />} />
          </Route>

          {/* ADMIN ROUTES */}
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/scanner" element={<AdminScanner />} />
          <Route path="admin/flashsale" element={<AdminFlashsale />} />
          <Route path="admin/gathering" element={<AdminGathering />} />
        </Route>

        {/* FALLBACK ROUTE */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <Toaster position="top-center" />
    </BrowserRouter>
  );
}