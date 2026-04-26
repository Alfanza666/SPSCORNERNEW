import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { ArrowLeft, KeyRound, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import SPSLogo from '../components/SPSLogo';

export default function ForgotPassword() {
  const [nik, setNik] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nikOrEmail: nik })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengirim permintaan reset password.');
      }

      setSuccess(true);
      toast.success('Permintaan reset password telah dikirim ke admin.');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      toast.error(err.message || 'Gagal mengirim permintaan reset password.');
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
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-4 sm:mb-6">
            <SPSLogo variant="stack" className="h-12 sm:h-16" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Lupa Password?</h1>
          <p className="text-[10px] sm:text-xs text-zinc-500 mt-1.5 sm:mt-2 font-bold">Kirim permintaan reset password ke administrator</p>
        </div>

        <div className="clay-card p-5 sm:p-8">
          {success ? (
            <div className="text-center space-y-5 sm:space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-lg sm:text-xl font-black text-zinc-900">Permintaan Terkirim!</h2>
                <p className="text-[10px] sm:text-xs text-zinc-500 font-bold leading-relaxed">
                  Admin akan mereset password Anda menjadi <span className="text-blue-600">123456</span>. Silakan hubungi admin di kantor atau tunggu informasi selanjutnya.
                </p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="btn-clay-primary w-full"
              >
                Kembali ke Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-2 sm:gap-3">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[8px] sm:text-[10px] text-blue-900 leading-relaxed font-bold">
                  Masukkan NIK atau Email terdaftar Anda untuk memverifikasi identitas. Admin akan mereset password Anda menjadi default (123456).
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-black text-zinc-400 mb-1.5 sm:mb-2 ml-1 uppercase tracking-widest">
                    NIK / Email Anda
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 12345678 atau budi@gmail.com"
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    required
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
                  <>
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3 h-3 sm:w-4 sm:h-4" />
                    Kirim Permintaan
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 sm:mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center text-zinc-500 hover:text-blue-600 transition-colors font-black text-[10px] sm:text-xs gap-1.5 sm:gap-2 group"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
