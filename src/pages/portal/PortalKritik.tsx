import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import SPSLogo from '../../components/SPSLogo';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  MessageSquare, AlertTriangle, Shield, Send, Clock, CheckCircle, Loader2
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

export default function PortalKritik() {
  const { user } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'saran' as const,
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
        .in('type', ['saran', 'kritik'])
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

      toast.success('Terima kasih! Kritik/saran Anda telah dikirim');
      setFormData({ type: 'saran', title: '', description: '' });
      fetchMyFeedback();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Gagal mengirim kritik/saran');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'kritik': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'saran': return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'pengaduan': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'pembelaan': return <Shield className="w-5 h-5 text-green-500" />;
      default: return <MessageSquare className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'kritik': return 'Kritik';
      case 'saran': return 'Saran';
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
            <MessageSquare className="w-5 h-5 text-purple-600" />
            Kirim Kritik/Saran
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Jenis</label>
              <div className="grid grid-cols-2 gap-2">
                {(['saran', 'kritik'] as const).map((type) => (
                  <motion.button
                    key={type}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={`py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      formData.type === type
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {getTypeIcon(type)}
                    <span>{getTypeLabel(type)}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Judul</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Ringkasan kritik/saran Anda"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Detail</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none h-28 resize-none"
                placeholder="Jelaskan detail kritik/saran Anda secara lengkap..."
                required
              />
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 p-4 rounded-xl">
              <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
                <strong>Catatan:</strong> Kritik dan saran Anda akan diproses oleh manajemen untuk perbaikan di meeting bipartit berikutnya. Identitas Anda akan dirahasiakan.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Kirim Kritik/Saran
            </motion.button>
          </form>
        </div>

        {/* My Feedback History */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-zinc-500" />
            Riwayat Kritik/Saran
          </h3>
          
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-6 text-zinc-400 font-medium">
              Anda belum pernah mengirim kritik/saran
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(feedback.type)}
                      <span className="font-bold text-sm text-zinc-900 dark:text-white">
                        {getTypeLabel(feedback.type)}
                      </span>
                    </div>
                    {getStatusBadge(feedback.status)}
                  </div>
                  <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{feedback.title}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{feedback.description}</p>
                  
                  <div className="flex items-center mt-3 text-xs text-zinc-400">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {format(new Date(feedback.created_at), 'dd MMM yyyy')}
                  </div>

                  {feedback.response && (
                    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400">Respons:</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">{feedback.response}</p>
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