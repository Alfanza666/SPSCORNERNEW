import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { LogIn, ArrowLeft, UserPlus, ShieldCheck, AlertCircle } from 'lucide-react';
import SPSLogo from '../components/SPSLogo';

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
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-40">
        <div className="absolute top-[10%] left-[5%] w-48 h-48 sm:w-64 sm:h-64 bg-blue-200 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-64 h-64 sm:w-96 sm:h-96 bg-amber-200 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-4 sm:mb-6">
            <motion.div
              whileHover={{ rotate: 5, scale: 1.1 }}
            >
              <SPSLogo variant="stack" className="h-16 sm:h-20" />
            </motion.div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">Selamat Datang</h1>
          <p className="text-zinc-500 mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium">Masuk ke akun SPS Corner Anda</p>
        </div>

        <div className="clay-card p-5 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 text-red-600 p-3 sm:p-4 rounded-xl text-[10px] sm:text-xs flex items-start gap-2 sm:gap-3 shadow-inner"
              >
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="font-bold">{error}</span>
              </motion.div>
            )}

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-zinc-700 mb-1.5 sm:mb-2 ml-1">
                  NIK / Email
                </label>
                <input
                  type="text"
                  placeholder="Masukkan NIK atau Email"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  required
                  className="input-clay"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5 sm:mb-2 ml-1">
                  <label className="block text-[10px] sm:text-xs font-bold text-zinc-700">
                    Password
                  </label>
                  <Link 
                    to="/forgot-password" 
                    className="text-[8px] sm:text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Lupa Password?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-clay"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-clay-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : 'Masuk'}
            </button>

            <div className="relative py-2 sm:py-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-100"></div>
              </div>
              <div className="relative flex justify-center text-[8px] sm:text-[10px] uppercase">
                <span className="bg-white px-2 sm:px-3 text-zinc-400 font-bold tracking-widest">Atau</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-clay-secondary w-full text-[10px] sm:text-xs"
              onClick={() => navigate('/register')}
            >
              <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
              Daftar Akun Baru
            </button>
          </form>
        </div>

        <div className="mt-6 sm:mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center text-zinc-500 hover:text-blue-600 transition-colors font-bold text-[10px] sm:text-xs gap-1.5 sm:gap-2 group"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Beranda
          </button>
        </div>
      </motion.div>
    </div>
  );
}
