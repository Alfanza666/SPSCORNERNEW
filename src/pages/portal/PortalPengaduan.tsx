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
    <div className="min-h-screen bg-[#e8ebf2] dark:bg-zinc-950">
      <div className="p-4 space-y-4">
        {/* Submit Form */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Buat Laporan</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Jenis Laporan</label>
              <div className="flex gap-2">
                {(['pengaduan', 'pembelaan'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={`flex flex-col items-center justify-center p-3 flex-1 rounded-xl text-xs font-bold transition-colors ${
                      formData.type === type
                        ? 'bg-red-50 border-2 border-red-500 text-red-700'
                        : 'bg-zinc-50 border-2 border-transparent text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {getTypeIcon(type)}
                    <span className="mt-1">{getTypeLabel(type)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Judul Laporan</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-clay w-full"
                placeholder="Ringkasan permasalahan..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Detail Kronologi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-clay w-full h-32"
                placeholder="Jelaskan secara rinci kronologi kejadian, tempat, dan waktu..."
                required
              />
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg flex items-start gap-2">
              <Shield className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">
                <strong>Rahasia Terjamin:</strong> Laporan pengaduan dan pembelaan Anda akan dienkripsi dan hanya dapat diakses oleh tim inti SP. Identitas Anda dapat dirahasiakan jika diperlukan.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Kirim Laporan
                </>
              )}
            </button>
          </form>
        </div>

        {/* My Feedback History */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center justify-between">
            <span>Riwayat Laporan Saya</span>
            <span className="text-xs font-normal text-zinc-500">{feedbacks.length} Total</span>
          </h3>
          
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Belum ada riwayat laporan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-sm">
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
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-3 bg-white dark:bg-zinc-900 p-2 rounded-lg">{feedback.description}</p>
                  
                  {feedback.response && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-lg">
                      <p className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-1 mb-1">
                        <CheckCircle className="w-3 h-3" /> Tanggapan Serikat:
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
