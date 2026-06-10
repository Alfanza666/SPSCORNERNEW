import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import SPSLogo from '../../components/SPSLogo';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  
  // Ambil token dari hash (#) karena Supabase kirimnya di hash
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const token = hashParams.get('access_token') || searchParams.get('token') || '';
  
  // Token diambil dari hash URL — tidak perlu di-log
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Token tidak valid. Silakan minta link baru dari halaman lupa password.');
      return;
    }
    
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
      // Langsung ke API endpoint
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: token,
          newPassword: password 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Gagal reset password');
      }

      setSuccess(true);

    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'Link mungkin sudah expired. Silakan minta link baru.');
    } finally {
      setLoading(false);
    }
  };

  // Kalau tidak ada token, tampilkan info
  if (!token) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="clay-card p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 mb-2">Link Tidak Valid</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Anda mengakses halaman ini tanpa token yang valid. Silakan minta link reset password baru.
            </p>
            <Link to="/forgot-password" className="btn-clay-primary w-full">
              Minta Link Baru
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="clay-card p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 mb-2">Password Berhasil Diubah!</h2>
            <p className="text-sm text-zinc-500 mb-6">
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

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <SPSLogo variant="stack" className="h-12 sm:h-16" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900">Buat Password Baru</h1>
          <p className="text-xs text-zinc-500 mt-2">Masukkan password baru untuk akun Anda</p>
        </div>

        <div className="clay-card p-5 sm:p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-black text-zinc-400 mb-2 uppercase tracking-widest">
                Password Baru
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-clay pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-400 mb-2 uppercase tracking-widest">
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
                'Simpan Password Baru'
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-zinc-500 hover:text-blue-600 text-sm font-bold flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}