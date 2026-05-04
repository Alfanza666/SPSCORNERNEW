import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, AlertCircle } from 'lucide-react';
import SPSLogo from '../components/SPSLogo';

/**
 * AuthCallback — Handles Google OAuth redirect after login.
 * Supabase redirects to /auth/callback with #access_token in URL hash.
 * This page exchanges the token, fetches the user profile, sets auth store,
 * then redirects to the correct dashboard/kiosk based on user role.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { fetchProfile, setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Memverifikasi akun Anda...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('Memproses login Google...');

        // Supabase automatically handles the token from URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session?.user) {
          // Sometimes the session is not immediately available, try exchanging code
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (exchangeError || !data?.session) {
            throw new Error('Gagal mendapatkan sesi login. Silakan coba lagi.');
          }
        }

        setStatus('Mengambil data profil...');

        // Get fresh session after potential exchange
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        if (!freshSession?.user) throw new Error('Sesi tidak valid.');

        // Fetch user profile
        await fetchProfile(freshSession.user.id);
        const profile = useAuthStore.getState().user;

        setStatus('Mengarahkan ke dashboard...');

        // Get return URL from sessionStorage (set before Google redirect)
        const returnUrl = sessionStorage.getItem('returnUrl');
        sessionStorage.removeItem('returnUrl');

        if (returnUrl && returnUrl !== '/' && returnUrl !== '/login') {
          navigate(returnUrl, { replace: true });
        } else if (profile?.role === 'admin' || profile?.role === 'superadmin') {
          navigate('/dashboard/admin', { replace: true });
        } else if (profile?.role === 'seller') {
          navigate('/dashboard/seller', { replace: true });
        } else {
          navigate('/kiosk', { replace: true });
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Terjadi kesalahan saat proses login.');
      }
    };

    handleCallback();
  }, [navigate, fetchProfile, setUser]);

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full border border-zinc-100">
        <div className="flex justify-center mb-6">
          <SPSLogo variant="stack" className="h-16" />
        </div>

        {error ? (
          <>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 mb-2">Login Gagal</h2>
            <p className="text-sm text-red-600 font-medium mb-6 leading-relaxed">{error}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
            >
              Kembali ke Login
            </button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 mb-2">Memproses Login</h2>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">{status}</p>
            <div className="mt-6 flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
