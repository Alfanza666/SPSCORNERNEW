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
    <div className="min-h-screen bg-[#e8ebf2] dark:bg-zinc-950">
      <div className="p-4 space-y-4">
        {/* Submit Form */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Kirim Kritik/Saran</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Jenis</label>
              <div className="flex gap-2">
                {(['saran', 'kritik'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                      formData.type === type
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {getTypeIcon(type)}
                    <span className="ml-1">{getTypeLabel(type)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Judul</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-clay w-full"
                placeholder="Ringkasan kritik/saran Anda"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Detail</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-clay w-full h-24"
                placeholder="Jelaskan detail kritik/saran Anda secara lengkap..."
                required
              />
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
              <p className="text-xs text-purple-700 dark:text-purple-300">
                <strong>Catatan:</strong> Kritik dan saran Anda akan diproses oleh manajemen untuk perbaikan di meeting bipartit berikutnya. Identitas Anda akan dirahasiakan.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-clay-primary w-full"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 inline mr-2" />
              )}
              Kirim Kritik/Saran
            </button>
          </form>
        </div>

        {/* My Feedback History */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Riwayat Kritik/Saran</h3>
          
          {loading ? (
            <div className="text-center py-4 text-zinc-400">Memuat...</div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-4 text-zinc-400 text-sm">
              Anda belum pernah mengirim kritik/saran
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(feedback.type)}
                      <span className="font-bold text-sm text-zinc-900 dark:text-white">
                        {getTypeLabel(feedback.type)}
                      </span>
                    </div>
                    {getStatusBadge(feedback.status)}
                  </div>
                  <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{feedback.title}</h4>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{feedback.description}</p>
                  
                  <div className="flex items-center justify-between mt-2 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(feedback.created_at), 'dd MMM yyyy')}
                    </span>
                  </div>

                  {feedback.response && (
                    <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400">Respons:</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">{feedback.response}</p>
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