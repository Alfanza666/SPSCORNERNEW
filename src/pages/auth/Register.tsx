import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion } from 'motion/react';
import { UserPlus, ArrowLeft, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const [nik, setNik] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (nik.length < 16) {
      setError('NIK harus 16 digit angka');
      setLoading(false);
      return;
    }

    try {
      const email = `${nik}@sps.local`;
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nik,
            name,
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
      setError(err.message || 'Gagal mendaftar. NIK mungkin sudah terdaftar.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-card p-12 text-center shadow-2xl shadow-emerald-200/50"
        >
          <div className="w-24 h-24 bg-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-200">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-4">Pendaftaran Berhasil!</h2>
          <p className="text-zinc-500 mb-8 leading-relaxed">
            Akunmu telah berhasil dibuat. Kamu akan diarahkan ke halaman login dalam beberapa saat...
          </p>
          <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3 }}
              className="h-full bg-emerald-500"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-40">
        <div className="absolute top-[5%] right-[5%] w-80 h-80 bg-emerald-200 rounded-full blur-3xl" />
        <div className="absolute bottom-[5%] left-[5%] w-96 h-96 bg-blue-200 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 mb-6">
            <UserPlus className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Daftar Akun Baru</h1>
          <p className="text-zinc-500 mt-2">Lengkapi data diri Anda untuk mulai berbelanja di SPS Corner</p>
        </div>

        <div className="glass-card p-8 md:p-10 shadow-xl shadow-zinc-200/50 border-zinc-200/60">
          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">
                  NIK (Nomor Induk Kependudukan)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan 16 digit NIK"
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                  required
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Sesuai KTP / Kartu Pelajar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <ShieldCheck className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed font-medium">
                Data Anda akan digunakan untuk verifikasi transaksi dan keamanan bersama di lingkungan sekolah. Kami menjamin kerahasiaan data Anda.
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-4 text-lg shadow-emerald-600/20"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mendaftarkan...
                </span>
              ) : 'Daftar Sekarang'}
            </button>

            <div className="text-center pt-4">
              <p className="text-zinc-500 text-sm font-medium">
                Sudah punya akun?{' '}
                <Link to="/login" className="text-emerald-600 font-bold hover:underline">
                  Masuk di sini
                </Link>
              </p>
            </div>
          </form>
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center text-zinc-400 hover:text-emerald-600 transition-colors font-medium text-sm gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </button>
        </div>
      </motion.div>
    </div>
  );
}
