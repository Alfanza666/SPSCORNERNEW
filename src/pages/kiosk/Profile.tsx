import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  User, 
  Lock, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Eye, 
  EyeOff,
  KeyRound,
  Fingerprint,
  HelpCircle,
  ChevronRight,
  MessageSquare,
  FileText,
  ExternalLink
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: "Bagaimana cara melakukan pembayaran?",
    answer: "Anda dapat melakukan pembayaran menggunakan QRIS yang tersedia di kasir atau melalui saldo akun jika tersedia."
  },
  {
    question: "Apa yang harus dilakukan jika transaksi gagal?",
    answer: "Jika transaksi gagal namun saldo terpotong, silakan hubungi admin dengan menunjukkan bukti transaksi di riwayat pesanan."
  },
  {
    question: "Berapa lama waktu validasi struk?",
    answer: "Validasi struk dilakukan secara otomatis oleh sistem AI dalam hitungan detik. Jika terjadi kendala, admin akan memvalidasi secara manual."
  }
];

export default function Profile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (newPassword !== confirmPassword) {
      toast.error('Password konfirmasi tidak cocok');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      toast.success('Password berhasil diperbarui!', {
        duration: 4000,
        position: 'top-center',
        style: {
          borderRadius: '20px',
          background: '#333',
          color: '#fff',
          padding: '16px 24px',
          fontWeight: 'bold'
        },
      });
      
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Password update error:', err);
      toast.error(err.message || 'Gagal memperbarui password');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 sm:px-6">
        <div className="clay-card p-8 sm:p-12 max-w-md w-full">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl sm:rounded-[32px] flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)] overflow-hidden">
            <User className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white mb-3 sm:mb-4">Akses Terbatas</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 sm:mb-10 font-bold text-sm sm:text-base">Silakan masuk untuk mengelola profil Anda.</p>
          <button onClick={() => navigate('/login')} className="btn-clay-primary w-full py-3 sm:py-4 text-base sm:text-lg">
            Masuk Sekarang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-10 px-4 sm:px-6 pb-16 sm:pb-20">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-zinc-100 dark:border-zinc-800 border-dashed">
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex items-center gap-1.5 sm:gap-2 text-blue-600 dark:text-blue-400 mb-1 sm:mb-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Pengaturan Akun</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">Profil Saya</h1>
          <p className="text-zinc-400 dark:text-zinc-500 font-medium text-xs sm:text-base">Kelola informasi pribadi dan keamanan akun Anda</p>
        </div>
        
        <button
          onClick={() => navigate('/kiosk')}
          className="clay-card px-4 py-2 sm:px-5 sm:py-2.5 inline-flex items-center text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all font-bold text-xs sm:text-sm gap-1.5 sm:gap-2 group bg-white dark:bg-zinc-900"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-x-1.5 transition-transform" />
          Kembali ke Menu
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-5 sm:gap-8">
        {/* Left Column: User Info & Help */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          {/* User Info Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="clay-card p-5 sm:p-6 relative overflow-hidden bg-white dark:bg-zinc-900"
          >
            <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-blue-500/5 dark:bg-blue-500/10 rounded-full -mr-16 -mt-16 sm:-mr-20 sm:-mt-20 blur-[40px] sm:blur-[60px]" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 sm:gap-5 mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-inner shrink-0 overflow-hidden">
                  <User className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-white truncate leading-tight tracking-tighter">{user.name}</h2>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs mt-0.5 sm:mt-1">
                    <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>NIK: {user.nik || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg sm:rounded-xl border border-zinc-50 dark:border-zinc-800 shadow-inner">
                  <p className="text-[8px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5 sm:mb-1">Status</p>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-900 dark:text-white font-black text-xs sm:text-sm">
                    <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 dark:text-blue-400" />
                    Aktif
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg sm:rounded-xl border border-zinc-50 dark:border-zinc-800 shadow-inner">
                  <p className="text-[8px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5 sm:mb-1">Role</p>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-900 dark:text-white font-black text-xs sm:text-sm capitalize">
                    <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 dark:text-amber-400" />
                    {user.role}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Help Center Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="clay-card p-5 sm:p-6 bg-white dark:bg-zinc-900"
          >
            <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/30 rounded-lg sm:rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner border border-blue-100/50 dark:border-blue-800">
                <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tighter">Pusat Bantuan</h3>
                <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-medium">FAQ & Dukungan Pelanggan</p>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {FAQ_ITEMS.map((faq, index) => (
                <div key={index} className="group">
                  <details className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg sm:rounded-xl border border-zinc-50 dark:border-zinc-800 overflow-hidden transition-all shadow-inner">
                    <summary className="p-3 sm:p-4 cursor-pointer font-bold text-zinc-900 dark:text-white text-[10px] sm:text-xs flex items-center justify-between list-none tracking-tight">
                      {faq.question}
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-300 dark:text-zinc-600 group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                      {faq.answer}
                    </div>
                  </details>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-5 sm:mt-6 sm:pt-6 border-t border-zinc-50 dark:border-zinc-800 space-y-2 sm:space-y-3">
              <button className="w-full flex items-center justify-between p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg sm:rounded-xl text-blue-700 dark:text-blue-400 transition-all group shadow-inner border border-blue-100/50 dark:border-blue-800">
                <div className="flex items-center gap-2 sm:gap-3">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="font-bold text-[10px] sm:text-xs">Hubungi Admin (WhatsApp)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button className="w-full flex items-center justify-between p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg sm:rounded-xl text-zinc-600 dark:text-zinc-400 transition-all group shadow-inner border border-zinc-100 dark:border-zinc-700">
                <div className="flex items-center gap-2 sm:gap-3">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="font-bold text-[10px] sm:text-xs">Syarat & Ketentuan</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Change Password */}
        <div className="lg:col-span-7">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="clay-card p-5 sm:p-8 bg-white dark:bg-zinc-900 h-full"
          >
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 dark:bg-amber-900/30 rounded-lg sm:rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner border border-amber-100/50 dark:border-amber-800">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tighter">Keamanan Akun</h3>
                <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-medium">Perbarui password Anda secara berkala</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-5 sm:space-y-6">
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[8px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1.5 sm:mb-2 ml-3 sm:ml-4 uppercase tracking-widest">
                    Password Baru
                  </label>
                  <div className="relative group">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="input-clay pr-10 sm:pr-12 h-10 sm:h-12 text-xs sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 text-zinc-300 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1.5 sm:mb-2 ml-3 sm:ml-4 uppercase tracking-widest">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="input-clay h-10 sm:h-12 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 sm:pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-clay-primary w-full py-2.5 sm:py-3 text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-3"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                      Simpan Password Baru
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 sm:p-5 bg-amber-50 dark:bg-amber-900/20 rounded-xl sm:rounded-2xl border border-amber-50 dark:border-amber-900/30 shadow-inner">
                <div className="flex gap-3 sm:gap-4">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-[10px] sm:text-xs text-amber-900 dark:text-amber-400 font-black tracking-tight">Tips Keamanan</p>
                    <p className="text-[8px] sm:text-[10px] text-amber-800 dark:text-amber-500/80 leading-relaxed font-bold opacity-80">
                      Gunakan kombinasi huruf besar, kecil, angka, dan simbol untuk password yang lebih kuat. Jangan gunakan informasi pribadi seperti tanggal lahir.
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
