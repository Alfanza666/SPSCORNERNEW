import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { LogIn, ArrowLeft, UserPlus, ShieldCheck, AlertCircle } from 'lucide-react';
import Logo from '../components/ui/FEDERASI RIKAT PEKERJ SUKSES.png';

export default function Login() {
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { fetchProfile } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let cleanNik = nik.trim().toLowerCase();
      if (!cleanNik.includes('@')) {
        cleanNik = cleanNik.replace(/[\s-.]/g, '');
      }
      const email = cleanNik.includes('@') ? cleanNik : `${cleanNik}@sps.local`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await fetchProfile(data.user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', data.user.id)
          .single();

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          throw new Error('Akun Anda telah dinonaktifkan. Silakan hubungi admin.');
        }

        if (profile?.role === 'admin') {
          navigate('/dashboard/admin');
        } else if (profile?.role === 'seller') {
          navigate('/dashboard/seller');
        } else {
          navigate('/kiosk');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message === 'Invalid login credentials') {
        setError('NIK atau password salah.');
      } else {
        setError(err.message || 'Gagal login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-40">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-blue-200 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-amber-200 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <img src={Logo} alt="SPS Corner Logo" className="h-20 w-auto object-contain" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
            }} />
            <div className="hidden inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <LogIn className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Selamat Datang Kembali</h1>
          <p className="text-zinc-500 mt-2">Masuk ke akun SPS Corner Anda</p>
        </div>

        <div className="glass-card p-8 shadow-xl shadow-zinc-200/50">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">
                  NIK / Email
                </label>
                <input
                  type="text"
                  placeholder="Masukkan NIK Anda"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-4 text-lg shadow-blue-600/20"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : 'Masuk'}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-zinc-400 font-medium tracking-widest">Atau</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary w-full py-4 flex items-center justify-center gap-2"
              onClick={() => navigate('/register')}
            >
              <UserPlus className="w-5 h-5" />
              Daftar Akun Baru
            </button>
          </form>
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center text-zinc-400 hover:text-blue-600 transition-colors font-medium text-sm gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </button>
        </div>
      </motion.div>
    </div>
  );
}
