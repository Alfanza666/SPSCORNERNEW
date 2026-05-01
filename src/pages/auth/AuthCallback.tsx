import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { motion } from 'motion/react';
import SPSLogo from '../../components/SPSLogo';

/**
 * AuthCallback — Handler setelah OAuth redirect (Google, dsb.)
 * 
 * Menggunakan onAuthStateChange sebagai primary + getSession sebagai fallback.
 * Setelah session terdeteksi: fetch profile → set store → navigate by role.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let redirected = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleUserRedirect = async (userId: string, userEmail?: string) => {
      if (redirected) return;
      redirected = true;

      try {
        // Query hanya kolom inti yang pasti ada
        let { data: profile, error } = await supabase
          .from('profiles')
          .select('id, role, name, balance, is_active, nik, phone')
          .eq('id', userId)
          .single();

        // Jika profil belum ada (user Google baru pertama kali login)
        // → auto-buat profil dengan data dari Google OAuth metadata
        if (error?.code === 'PGRST116' || !profile) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const metadata = authUser?.user_metadata || {};
          const displayName =
            metadata.full_name ||
            metadata.name ||
            userEmail?.split('@')[0] ||
            'Pengguna Baru';

          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              role: 'buyer',
              name: displayName,
              balance: 0,
              is_active: true,
            }, { onConflict: 'id' })
            .select('id, role, name, balance, is_active, nik, phone')
            .single();

          if (createError || !newProfile) {
            throw new Error(`Gagal membuat profil otomatis. (${createError?.message || 'unknown'})`);
          }
          profile = newProfile;
        } else if (error) {
          throw new Error(`Error memuat profil: ${error.message}`);
        } else {
          // Profil sudah ada. Cek apakah namanya masih menggunakan prefix email atau 'User'
          // Jika login pakai Google, kita bisa perbarui namanya dengan nama asli.
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const metadata = authUser?.user_metadata || {};
          const googleName = metadata.full_name || metadata.name;
          const emailPrefix = userEmail?.split('@')[0];

          if (
            googleName && 
            profile.name !== googleName && 
            (profile.name === emailPrefix || profile.name === 'User' || profile.name === 'Pengguna Baru')
          ) {
            const { error: updateNameError } = await supabase
              .from('profiles')
              .update({ name: googleName })
              .eq('id', userId);
              
            if (!updateNameError) {
              profile.name = googleName;
            }
          }
        }

        if (profile!.is_active === false) {
          await supabase.auth.signOut();
          setErrorMsg('Akun Anda telah dinonaktifkan. Silakan hubungi admin.');
          setStatus('error');
          return;
        }

        // Set store langsung agar DashboardLayout tidak redirect balik ke login
        useAuthStore.getState().setUser({
          id: profile!.id,
          role: profile!.role,
          name: profile!.name,
          nik: profile!.nik,
          phone: profile!.phone,
          balance: profile!.balance ?? 0,
          email: userEmail,
        });

        const returnUrl = sessionStorage.getItem('returnUrl');
        if (returnUrl) {
          sessionStorage.removeItem('returnUrl');
          navigate(returnUrl, { replace: true });
        } else if (profile!.role === 'admin' || profile!.role === 'superadmin') {
          navigate('/dashboard/admin', { replace: true });
        } else if (profile!.role === 'seller') {
          navigate('/dashboard/seller', { replace: true });
        } else {
          navigate('/kiosk', { replace: true });
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Terjadi kesalahan saat proses login.');
        setStatus('error');
      }
    };

    // Primary: onAuthStateChange — paling reliable untuk OAuth callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        clearTimeout(timeoutId);
        handleUserRedirect(session.user.id, session.user.email);
      }
    });

    // Fallback: getSession untuk kasus hash fragment sudah diproses sebelum listener terpasang
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!redirected && session?.user) {
        clearTimeout(timeoutId);
        handleUserRedirect(session.user.id, session.user.email);
      }
    });

    // Timeout 12 detik — jika tidak ada session yang terdeteksi, tampilkan error
    timeoutId = setTimeout(() => {
      if (!redirected) {
        setErrorMsg('Sesi tidak ditemukan. Silakan coba login kembali.');
        setStatus('error');
      }
    }, 12000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center border border-zinc-100"
        >
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-black text-zinc-900 mb-2">Login Gagal</h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="btn-clay-primary w-full"
          >
            Kembali ke Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6"
      >
        <SPSLogo variant="stack" className="h-16" />
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-bold text-zinc-500 animate-pulse tracking-widest uppercase">
            Memverifikasi akun...
          </p>
        </div>
      </motion.div>
    </div>
  );
}
