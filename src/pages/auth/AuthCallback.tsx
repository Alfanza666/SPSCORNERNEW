import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { motion } from 'motion/react';
import SPSLogo from '../../components/SPSLogo';

/**
 * AuthCallback — Halaman handler setelah OAuth redirect (Google, dsb.)
 * 
 * Flow:
 * 1. Google redirect → Supabase callback → redirect ke /auth/callback
 * 2. Halaman ini mendeteksi session dari URL (hash/code)
 * 3. Fetch profile & redirect ke dashboard yang sesuai berdasarkan role
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { fetchProfile } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      try {
        // Supabase auto-detects session from URL hash or PKCE code
        // exchangeCodeForSession handles both cases
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!session?.user) {
          // Might need to exchange the code — wait briefly for Supabase to process URL
          await new Promise(res => setTimeout(res, 1500));
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          if (retryError) throw retryError;
          if (!retrySession?.user) {
            throw new Error('Sesi tidak ditemukan. Silakan coba login kembali.');
          }
          return handleUserRedirect(retrySession.user.id);
        }

        if (mounted) await handleUserRedirect(session.user.id);
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err.message || 'Terjadi kesalahan saat proses login Google.');
          setStatus('error');
        }
      }
    };

    const handleUserRedirect = async (userId: string) => {
      // Fetch profile for auth store
      await fetchProfile(userId);

      // Get role & is_active from profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Akun Anda telah dinonaktifkan. Silakan hubungi admin.');
      }

      // Redirect based on role
      if (profile?.role === 'admin') {
        navigate('/dashboard/admin', { replace: true });
      } else if (profile?.role === 'seller') {
        navigate('/dashboard/seller', { replace: true });
      } else {
        navigate('/kiosk', { replace: true });
      }
    };

    handleCallback();
    return () => { mounted = false; };
  }, [navigate, fetchProfile]);

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
