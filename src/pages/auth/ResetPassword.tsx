import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import SPSLogo from '../../components/SPSLogo';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Cek apakah ada valid token di URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    // Kalau tidak ada type=recovery di hash, berarti bukan dari link reset
    if (type !== 'recovery') {
      // Redirect ke forgot-password jika bukan dari link yang valid
      navigate('/forgot-password', { replace: true });
    } else {
      setLoading(false);
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Ambil hash dari URL dan parse
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (!accessToken) {
        throw new Error('Token tidak valid. Silakan minta link reset password baru.');
      }

      // Set session dengan token dari URL
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || ''
      });

      if (sessionError) throw sessionError;

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // Sign out setelah password berhasil diubah
      await supabase.auth.signOut();

      setSuccess(true);

    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'Gagal mengubah password. Link mungkin sudah expired.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="clay-card p-5 sm:p-8 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner mb-6">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mb-3">Password Berhasil Diubah!</h2>
            <p className="text-[10px] sm:text-xs text-zinc-500 font-bold mb-6">
              Silakan login dengan password baru Anda.
            </p>
            
            <Link to="/login" className="btn-clay-primary w-full">
              Login dengan Password Baru
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="clay-card p-5 sm:p-8 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner mb-6">
              <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mb-3">Link Expired!</h2>
            <p className="text-[10px] sm:text-xs text-zinc-500 font-bold mb-6">
              {error}
            </p>
            
            <Link to="/forgot-password" className="btn-clay-primary w-full">
              Minta Link Baru
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-4 sm:mb-6">
            <SPSLogo variant="stack" className="h-12 sm:h-16" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Buat Password Baru</h1>
          <p className="text-[10px] sm:text-xs text-zinc-500 mt-1.5 sm:mt-2 font-bold">Masukkan password baru untuk akun Anda</p>
        </div>

        <div className="clay-card p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-black text-zinc-400 mb-1.5 sm:mb-2 ml-1 uppercase tracking-widest">
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password baru"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="input-clay pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-black text-zinc-400 mb-1.5 sm:mb-2 ml-1 uppercase tracking-widest">
                  Konfirmasi Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan ulang password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-clay"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-clay-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                  Simpan Password Baru
                </span>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 sm:mt-8 text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-zinc-500 hover:text-blue-600 transition-colors font-black text-[10px] sm:text-xs gap-1.5 sm:gap-2 group"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}