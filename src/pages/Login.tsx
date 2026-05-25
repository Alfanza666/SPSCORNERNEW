import React, { useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { useAuthStore, isEmployeeNik } from '../store/useAuthStore';
import { AlertCircle } from 'lucide-react';
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
      let email: string;
      
      // 1. Cek dari input mentah, apakah ini email?
      if (rawInput.includes('@')) {
        email = rawInput.toLowerCase();
      } else {
        // 2. Jika bukan email (berarti NIK), baru bersihkan spasi, strip, dan titik
        const inputNik = rawInput.replace(/[\s-.]/g, '');
        
        const { data: profileByNik, error: nikError } = await supabase
          .from('profiles')
          .select('email, id')
          .ilike('nik', inputNik)
          .single();
        
        if (nikError || !profileByNik?.email) {
          email = `${inputNik.toLowerCase()}@sps.local`;
        } else {
          email = profileByNik.email;
        }
      }

      // 3. Eksekusi Login ke Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data?.user) {
        // Update state profile
        await fetchProfile(data.user.id);

        // ==========================================================
        // 4. LOGIKA SINKRONISASI KERANJANG (GUEST CART) SETELAH LOGIN
        // ==========================================================
        const guestCart = localStorage.getItem('sps_guest_cart');
        
        if (guestCart) {
          try {
            const parsedCart = JSON.parse(guestCart);
            
            if (parsedCart.length > 0) {
              for (const item of parsedCart) {
                await supabase.from('cart_items').upsert({
                  user_id: data.user.id,
                  product_id: item.id,
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                  image_url: item.image_url
                }, { onConflict: 'user_id,product_id' });
              }
              localStorage.removeItem('sps_guest_cart');
            }
          } catch (syncErr) {
            console.error('Gagal memindahkan keranjang guest:', syncErr);
          }
        }
        // ==========================================================

        // 5. Arahkan user ke halaman checkout atau tujuan awal
        const profile = useAuthStore.getState().user;
        const isEmployee = isEmployeeNik(profile?.nik) || profile?.role === 'admin' || profile?.role === 'superadmin';
        const defaultRoute = isEmployee ? '/portal' : '/kiosk';
        navigate(from || defaultRoute, { replace: true });
      }

    } catch (err: any) {
      setError(err.message || 'Login gagal. Periksa kembali NIK/Email dan Password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center cursor-pointer"
          onClick={() => navigate('/')}
        >
          <SPSLogo className="w-auto h-16" />
        </motion.div>
        <h2 className="mt-6 text-center text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          Masuk ke Akun Anda
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Belum punya akun?{' '}
          <Link to="/register" className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400">
            Daftar sekarang
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-xl shadow-zinc-200/20 dark:shadow-black/40 sm:rounded-[2rem] sm:px-10 border border-zinc-100 dark:border-zinc-800"
        >
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                NIK atau Email
              </label>
              <input
                type="text"
                required
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                className="appearance-none block w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-2xl shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-transparent text-zinc-900 dark:text-white transition-all"
                placeholder="Masukkan NIK atau Email Anda"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-2xl shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-transparent text-zinc-900 dark:text-white transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-zinc-900 dark:text-zinc-300">
                  Ingat saya
                </label>
              </div>

              <div className="text-sm">
                <Link to="/forgot-password" className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400">
                  Lupa sandi?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading ? 'Memproses...' : 'Masuk Sekarang'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-300 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-zinc-900 text-zinc-500 font-medium">Atau lanjutkan dengan</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full inline-flex justify-center py-3.5 px-4 border border-zinc-300 dark:border-zinc-700 rounded-2xl shadow-sm bg-white dark:bg-zinc-800 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all active:scale-[0.98]"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                  <path fill="none" d="M1 1h22v22H1z" />
                </svg>
                {googleLoading ? 'Memproses...' : 'Google'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
