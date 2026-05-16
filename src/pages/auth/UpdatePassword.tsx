import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import SPSLogo from '../../components/SPSLogo';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

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

    try {
      // Update password using Supabase auth
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      // PENTING: Sign out agar user harus login dengan password baru
      await supabase.auth.signOut();
      
      setSuccess(true);

    } catch (err: any) {
      console.error('Update password error:', err);
      toast.error(err.message || 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-40">
          <div className="absolute top-[10%] left-[5%] w-48 h-48 sm:w-64 sm:h-64 bg-blue-200 rounded-full blur-3xl" />
          <div className="absolute bottom-[10%] right-[5%] w-64 h-64 sm:w-96 sm:h-96 bg-amber-200 rounded-full blur-3xl" />
        </div>

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

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-40">
        <div className="absolute top-[10%] left-[5%] w-48 h-48 sm:w-64 sm:h-64 bg-blue-200 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-64 h-64 sm:w-96 sm:h-96 bg-amber-200 rounded-full blur-3xl" />
      </div>

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
            <div className="p-3 sm:p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-2 sm:gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[8px] sm:text-[10px] text-amber-900 leading-relaxed font-bold">
                Password lama Anda telah direset. Silakan buat password baru yang kuat dan mudah diingat.
              </p>
            </div>

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
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menyimpan...
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