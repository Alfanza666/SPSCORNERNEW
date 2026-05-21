import React, { useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { LogIn, ArrowLeft, UserPlus, ShieldCheck, AlertCircle } from 'lucide-react';
import SPSLogo from '../components/SPSLogo';

export default function Login() {
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Membaca parameter URL jika user dialihkan dari keranjang
  const [searchParams] = useSearchParams();
  const cartRedirect = searchParams.get('redirect');

  const fromPath = (location.state as any)?.from?.pathname;
  const from = cartRedirect || (fromPath && fromPath !== 'undefined' ? fromPath + ((location.state as any)?.from?.search || '') : null);
  
  const { fetchProfile } = useAuthStore();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      if (from) {
        sessionStorage.setItem('returnUrl', from);
      }
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Gagal login dengan Google.');
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const rawInput = nik.trim();
      const input = rawInput.replace(/[\s-.]/g, '');

      let email: string;
      
      if (input.includes('@')) {
        email = input.toLowerCase();
      } else {
        const { data: profileByNik, error: nikError } = await supabase
          .from('profiles')
          .select('email, id')
          .ilike('nik', input)
          .single();
        
        if (nikError || !profileByNik?.email) {
          email = `${input.toLowerCase()}@sps.local`;
        } else {
          email = profileByNik.email;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, name, balance, is_active')
          .eq('id', data.user.id)
          .single();

        let resolvedProfile = profile;
        if (profileError || !profile) {
          const { data: basicProfile, error: basicError } = await supabase
            .from('profiles')
            .select('id, role, name, balance')
            .eq('id', data.user.id)
            .single();

          if (basicError || !basicProfile) {
            throw new Error(
              `Profil tidak ditemukan. (${basicError?.message || profileError?.message || 'unknown'})`
            );
          }
          resolvedProfile = basicProfile as any;
        }

        if (resolvedProfile!.is_active === false) {
          await supabase.auth.signOut();
          throw new Error('Akun Anda telah dinonaktifkan. Silakan hubungi admin.');
        }

        useAuthStore.getState().setUser({
          id: resolvedProfile!.id,
          role: resolvedProfile!.role,
          name: resolvedProfile!.name,
          balance: resolvedProfile!.balance ?? 0,
          email: data.user.email,
        });

        // Redirect dinamis (termasuk kembali ke checkout jika dari keranjang)
        if (from) {
          navigate(from);
        } else if (resolvedProfile!.role === 'admin' || resolvedProfile!.role === 'superadmin') {
          navigate('/dashboard/admin');
        } else if (resolvedProfile!.role === 'seller') {
          navigate('/dashboard/seller');
        } else {
          navigate('/portal');
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
            <motion.div whileHover={{ rotate: 5, scale: 1.1 }}>
              <SPSLogo variant="stack" className="h-16 sm:h-20" />
            </motion.div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">Selamat Datang</h1>
          <p className="text-zinc-500 mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium">Masuk ke akun SPS Corner Anda</p>
        </div>

        <div className="clay-card p-5 sm:p-8">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 sm:py-3 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-700 text-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-95 shadow-sm disabled:opacity-60 disabled:pointer-events-none mb-5 sm:mb-6"
          >
            {googleLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                <span>Menghubungkan ke Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-xs sm:text-sm">Masuk dengan Google</span>
              </>
            )}
          </button>

          <div className="relative mb-5 sm:mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[10px] text-zinc-400 font-bold tracking-widest uppercase">Atau masuk dengan NIK</span>
            </div>
          </div>

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
              disabled={loading || googleLoading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : 'Login ke Akun Anda'}
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
