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
      // Langsung kirim ke API - biarkan server yang proses (NIK atau email)
      const response = await fetch('/api/auth/forgot-password-send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nikOrEmail: nik.trim() })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal mengirim email reset password.');
      }

      setSuccess(true);
      toast.success('Link reset password telah dikirim ke email Anda. Silakan cek inbox atau spam.');
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
                <h2 className="text-lg sm:text-xl font-black text-zinc-900">Email Terkirim!</h2>
                <p className="text-[10px] sm:text-xs text-zinc-500 font-bold leading-relaxed">
                  Kami telah mengirim link reset password ke email Anda. Silakan cek inbox atau folder spam. Link berlaku selama 1 jam.
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

        <div className="mt-6 sm:mt-8 flex flex-col items-center gap-4">
          <a
            href="https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20lupa%20password%20akun%20SPS%20Corner.%20Bisa%20bantu%20reset?"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all rounded-full text-[10px] sm:text-xs font-black border border-emerald-100 shadow-sm group"
          >
            <div className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </div>
            Hubungi Admin via WhatsApp
          </a>

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
