import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import SPSLogo from '../../components/SPSLogo';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  AlertTriangle, Shield, Send, Clock, Loader2, CheckCircle
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
  myFeedback: boolean;
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
      case 'pengaduan': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'pembelaan': return <Shield className="w-5 h-5 text-green-500" />;
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
      pending: 'bg-amber-100 text-amber-700',
      diproses: 'bg-blue-100 text-blue-700',
      selesai: 'bg-green-100 text-green-700',
      ditolak: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[status as keyof typeof styles]}`}>
        {status === 'pending' ? 'Menunggu' : 
         status === 'diproses' ? 'Diproses' : 
         status === 'selesai' ? 'Selesai' : 'Ditolak'}
      </span>
    );
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md mx-auto p-4 pb-8 space-y-4">
        {/* Submit Form */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            Buat Laporan
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Jenis Laporan</label>
              <div className="grid grid-cols-2 gap-2">
                {(['pengaduan', 'pembelaan'] as const).map((type) => (
                  <motion.button
                    key={type}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl text-sm font-bold transition-all ${
                      formData.type === type
                        ? 'bg-gradient-to-r from-red-100 to-red-50 border-2 border-red-500 text-red-700 dark:from-red-900/30 dark:to-red-800/20 dark:border-red-400 dark:text-red-300'
                        : 'bg-zinc-100 border-2 border-transparent text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {getTypeIcon(type)}
                    <span className="mt-2">{getTypeLabel(type)}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Judul Laporan</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Ringkasan permasalahan..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Detail Kronologi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-red-500 outline-none h-32 resize-none"
                placeholder="Jelaskan secara rinci kronologi kejadian, tempat, dan waktu..."
                required
              />
            </div>

            <div className="bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 p-4 rounded-xl flex items-start gap-3">
              <Shield className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                <strong>Rahasia Terjamin:</strong> Laporan pengaduan dan pembelaan Anda akan dienkripsi dan hanya dapat diakses oleh tim inti SP. Identitas Anda dapat dirahasiakan jika diperlukan.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Kirim Laporan
                </>
              )}
            </motion.button>
          </form>
        </div>

        {/* My Feedback History */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center justify-between">
            <span>Riwayat Laporan Saya</span>
            <span className="text-xs font-medium text-zinc-500">{feedbacks.length} Total</span>
          </h3>
          
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
              </div>
              <p className="text-zinc-500 font-medium">Belum ada riwayat laporan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl shadow-sm">
                        {getTypeIcon(feedback.type)}
                      </div>
                      <div>
                        <span className="font-black text-sm text-zinc-900 dark:text-white block">
                          {getTypeLabel(feedback.type)}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {format(new Date(feedback.created_at), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(feedback.status)}
                  </div>
                  <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{feedback.title}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-3 bg-white dark:bg-zinc-900 p-3 rounded-xl">{feedback.description}</p>
                  
                  {feedback.response && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-100 dark:border-green-900/30 rounded-xl">
                      <p className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5 mb-1.5">
                        <CheckCircle className="w-4 h-4" /> Tanggapan Serikat:
                      </p>
                      <p className="text-xs text-green-800 dark:text-green-300">{feedback.response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
