import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion } from 'motion/react';
import { UserPlus, ArrowLeft, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import SPSLogo from '../../components/SPSLogo';

export default function Register() {
  const [nik, setNik] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanNik = nik.trim().replace(/[\s-.]/g, '');
    if (cleanNik.length < 3) {
      setError('NIK tidak valid');
      setLoading(false);
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Email tidak valid');
      setLoading(false);
      return;
    }

    if (!phone || phone.length < 10) {
      setError('Nomor handphone tidak valid');
      setLoading(false);
      return;
    }

    try {
      // Check if NIK already exists
      const { data: nikExists, error: checkError } = await supabase
        .rpc('check_nik_exists', { p_nik: cleanNik });

      if (checkError) {
        console.error('check_nik_exists RPC failed:', checkError);
        setError('Gagal mendaftar. Terjadi kesalahan pada database. Pastikan schema database Supabase sudah diperbarui.');
        setLoading(false);
        return;
      } else if (nikExists) {
        setError('Gagal mendaftar. NIK ini sudah terdaftar di sistem.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nik: cleanNik,
            name: name.trim(),
            phone: phone.trim(),
            role: 'buyer'
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const errorMessage = err.message?.toLowerCase() || '';
      if (errorMessage.includes('database error saving new user')) {
        setError('Gagal mendaftar. Terjadi kesalahan pada database trigger. Pastikan Anda sudah menjalankan script supabase-schema.sql terbaru di SQL Editor Supabase.');
      } else if (errorMessage.includes('user already registered')) {
        setError('Gagal mendaftar. NIK atau Email ini sudah terdaftar di sistem.');
      } else {
        setError(err.message || 'Gagal mendaftar. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full clay-card p-8 text-center"
        >
          <div className="w-20 h-20 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 mb-3">Pendaftaran Berhasil!</h2>
          <p className="text-sm text-zinc-500 mb-8 leading-relaxed font-bold">
            Akunmu telah berhasil dibuat. Kamu akan diarahkan ke halaman login dalam beberapa saat...
          </p>
          <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3 }}
              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-40">
        <div className="absolute top-[5%] right-[5%] w-48 h-48 sm:w-80 sm:h-80 bg-blue-200 rounded-full blur-3xl" />
        <div className="absolute bottom-[5%] left-[5%] w-64 h-64 sm:w-96 sm:h-96 bg-amber-200 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-4 sm:mb-6">
            <motion.div
              whileHover={{ rotate: -5, scale: 1.1 }}
            >
              <SPSLogo variant="stack" className="h-16 sm:h-20" />
            </motion.div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Daftar Akun Baru</h1>
          <p className="text-[10px] sm:text-xs text-zinc-500 mt-1.5 sm:mt-2 font-bold">Lengkapi data diri Anda untuk mulai berbelanja di SPS Corner</p>
        </div>

        <div className="clay-card p-5 sm:p-8">
          <form onSubmit={handleRegister} className="space-y-5 sm:space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 text-red-600 p-3 sm:p-4 rounded-xl text-[10px] sm:text-xs flex items-start gap-2 sm:gap-3 shadow-inner border border-red-100"
              >
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="font-black">{error}</span>
              </motion.div>
            )}
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 mb-1.5 sm:mb-2 ml-1 uppercase tracking-widest">
                  NIK (Nomor Induk Karyawan)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan NIK Anda"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  required
                  className="input-clay"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 mb-1.5 sm:mb-2 ml-1 uppercase tracking-widest">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Sesuai KTP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="input-clay"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 mb-1.5 sm:mb-2 ml-1 uppercase tracking-widest">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Alamat Email Aktif"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-clay"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 mb-1.5 sm:mb-2 ml-1 uppercase tracking-widest">
                  Nomor Handphone
                </label>
                <input
                  type="tel"
                  placeholder="Contoh: 08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="input-clay"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-zinc-500 mb-1.5 sm:mb-2 ml-1 uppercase tracking-widest">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-clay"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-amber-50 rounded-xl shadow-inner border border-amber-100">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[8px] sm:text-[10px] text-amber-900 leading-relaxed font-bold">
                Data Anda akan digunakan untuk verifikasi transaksi dan keamanan bersama di lingkungan perusahaan. Kami menjamin kerahasiaan data Anda.
              </p>
            </div>

            <button
              type="submit"
              className="btn-clay-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mendaftarkan...
                </span>
              ) : 'Daftar Sekarang'}
            </button>

            <div className="text-center pt-2 sm:pt-4">
              <p className="text-zinc-500 text-[10px] sm:text-xs font-bold">
                Sudah punya akun?{' '}
                <Link to="/login" className="text-blue-600 font-black hover:underline">
                  Masuk di sini
                </Link>
              </p>
            </div>
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
