import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  AlertTriangle, Shield, Send, Clock, Loader2, CheckCircle, FileText, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

interface Feedback {
  id: string;
  user_id: string;
  type: 'kritik' | 'saran' | 'pengaduan' | 'pembelaan';
  title: string;
  description: string;
  status: 'pending' | 'diproses' | 'selesai' | 'ditolak';
  response: string;
  created_at: string;
}

export default function PortalPengaduan() {
  const { user } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'pengaduan' as const,
    title: '',
    description: ''
  });

  useEffect(() => {
    if (!user) return;
    fetchMyFeedback();
  }, [user]);

  const fetchMyFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('user_id', user?.id)
        .in('type', ['pengaduan', 'pembelaan'])
        .order('created_at', { ascending: false });

      if (data) {
        setFeedbacks(data.map(f => ({ ...f, myFeedback: true })));
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || !formData.description) {
      toast.error('Mohon lengkapi semua kolom');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedbacks').insert({
        user_id: user.id,
        type: formData.type,
        title: formData.title,
        description: formData.description,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Pengaduan/Pembelaan Anda telah dikirim');
      setFormData({ type: 'pengaduan', title: '', description: '' });
      fetchMyFeedback();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Gagal mengirim pengaduan');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pengaduan': return <AlertTriangle className="w-5 h-5" />;
      case 'pembelaan': return <Shield className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'pengaduan': return 'Pengaduan';
      case 'pembelaan': return 'Pembelaan';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
      diproses: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
      selesai: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
      ditolak: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
    };
    return (
      <span className={`px-4 py-2 rounded-xl text-sm font-bold ${styles[status as keyof typeof styles]}`}>
        {status === 'pending' ? 'Menunggu' : 
         status === 'diproses' ? 'Diproses' : 
         status === 'selesai' ? 'Selesai' : 'Ditolak'}
      </span>
    );
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Pengaduan & Pembelaan</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sampaikan laporan dengan aman dan rahasia</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Submit Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-zinc-900 dark:text-white text-lg">Buat Laporan Baru</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Jenis Laporan</label>
              <div className="grid grid-cols-2 gap-4">
                {(['pengaduan', 'pembelaan'] as const).map((type) => (
                  <motion.button
                    key={type}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl text-sm font-bold transition-all ${
                      formData.type === type
                        ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30'
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${
                      formData.type === type ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-700'
                    }`}>
                      {getTypeIcon(type)}
                    </div>
                    <span>{getTypeLabel(type)}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Judul Laporan</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-4 rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-base focus:border-red-400 focus:ring-0 outline-none transition-all"
                placeholder="Ringkasan permasalahan Anda..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Detail Kronologi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-4 rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-base focus:border-red-400 focus:ring-0 outline-none h-40 resize-none transition-all"
                placeholder="Jelaskan secara rinci kronologi kejadian, termasuk tempat, waktu, dan pihak yang terlibat..."
                required
              />
            </div>

            <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
              <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                <strong>Rahasia Terjamin:</strong> Laporan pengaduan dan pembelaan Anda akan dienkripsi dan hanya dapat diakses oleh tim inti SP. Identitas Anda dapat dirahasiakan.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-2xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Kirim Laporan
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800 shadow-lg"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-900 dark:text-white text-lg flex items-center gap-3">
              <Clock className="w-5 h-5 text-zinc-400" />
              Riwayat Laporan Saya
            </h3>
            <span className="text-sm font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl">{feedbacks.length} Total</span>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full"
              />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
              <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10 text-zinc-400" />
              </div>
              <p className="text-zinc-500 font-bold text-lg mb-1">Belum ada riwayat laporan</p>
              <p className="text-xs text-zinc-400">Kirim laporan pertama Anda sekarang</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {feedbacks.map((feedback, idx) => (
                <motion.div
                  key={feedback.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-5 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        feedback.type === 'pengaduan' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {getTypeIcon(feedback.type)}
                      </div>
                      <div>
                        <span className="font-black text-zinc-900 dark:text-white block">{getTypeLabel(feedback.type)}</span>
                        <span className="text-xs text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(feedback.created_at), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(feedback.status)}
                  </div>
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 mb-3">{feedback.title}</h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-3 bg-white dark:bg-zinc-900 p-4 rounded-xl leading-relaxed">{feedback.description}</p>
                  
                  {feedback.response && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border border-green-100 dark:border-green-900/30 rounded-2xl"
                    >
                      <p className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5" /> Tanggapan Serikat:
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">{feedback.response}</p>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}