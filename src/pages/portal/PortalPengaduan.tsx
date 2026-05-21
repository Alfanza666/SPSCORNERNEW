import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  AlertTriangle, Shield, Send, Clock, Loader2, CheckCircle, FileText, ChevronRight, ChevronLeft, X, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

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
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

      
      // notifyAdmins
      try {
        const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin']);
        if (admins) {
            const notifications = admins.map(admin => ({
                user_id: admin.id,
                title: 'Pengaduan Baru',
                message: `Terdapat pengaduan baru dari ${user.name}`,
                type: 'system',
                path: '/dashboard/admin/pengaduan'
            }));
            await supabase.from('notifications').insert(notifications);
        }
      } catch (e) { console.error('Gagal mengirim notif admin', e); }
      // end notifyAdmins

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
      case 'pengaduan': return <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />;
      case 'pembelaan': return <Shield className="w-4 h-4 md:w-5 md:h-5" />;
      default: return <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />;
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
      <span className={`px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold ${styles[status as keyof typeof styles]}`}>
        {status === 'pending' ? 'Menunggu' : 
         status === 'diproses' ? 'Diproses' : 
         status === 'selesai' ? 'Selesai' : 'Ditolak'}
      </span>
    );
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={() => navigate('/portal')}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Pengaduan & Pembelaan
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">Sampaikan laporan dengan aman dan rahasia</p>
          </div>
        </div>
        <div className="hidden md:block">
          {/* Logo stack removed for professional look */}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl p-5 md:p-8 border border-zinc-100 dark:border-zinc-800 shadow-lg md:shadow-xl"
        >
          <div className="flex items-center gap-3 mb-5 md:mb-6">
            <FileText className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-zinc-900 dark:text-white text-base md:text-lg">Buat Laporan Baru</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            <div>
              <label className="block text-xs md:text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Jenis Laporan</label>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {(['pengaduan', 'pembelaan'] as const).map((type) => (
                  <motion.button
                    key={type}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={`flex flex-col items-center justify-center p-4 md:p-5 rounded-xl md:rounded-2xl text-sm font-bold transition-all ${
                      formData.type === type
                        ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30'
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 ${
                      formData.type === type ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-700'
                    }`}>
                      {getTypeIcon(type)}
                    </div>
                    <span className="text-sm md:text-base">{getTypeLabel(type)}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Judul Laporan</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-sm md:text-base focus:border-red-400 focus:ring-0 outline-none transition-all"
                placeholder="Ringkasan permasalahan Anda..."
                required
              />
            </div>

            <div>
              <label className="block text-xs md:text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Detail Kronologi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-sm md:text-base focus:border-red-400 focus:ring-0 outline-none h-32 md:h-40 resize-none transition-all"
                placeholder="Jelaskan secara rinci kronologi kejadian..."
                required
              />
            </div>

            <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 p-3 md:p-4 rounded-xl md:rounded-2xl border border-red-100 dark:border-red-900/30">
              <p className="text-xs md:text-sm text-red-700 dark:text-red-300 leading-relaxed">
                <strong>Rahasia Terjamin:</strong> Laporan Anda dienkripsi dan hanya tim inti SP yang bisa mengakses. Identitas Anda dapat dirahasiakan.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="w-full py-3 md:py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl md:rounded-2xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 text-sm md:text-base"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 md:w-5 md:h-5" />
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
          className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl p-5 md:p-8 border border-zinc-100 dark:border-zinc-800 shadow-lg md:shadow-xl"
        >
          <div className="flex items-center justify-between mb-5 md:mb-6">
            <h3 className="font-bold text-zinc-900 dark:text-white text-base md:text-lg flex items-center gap-2 md:gap-3">
              <Clock className="w-5 h-5 text-zinc-400" />
              Riwayat Laporan
            </h3>
            <span className="text-xs md:text-sm font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl">{feedbacks.length} Total</span>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8 md:py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 md:w-10 md:h-10 border-3 md:border-4 border-red-500 border-t-transparent rounded-full"
              />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-8 md:py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl md:rounded-2xl">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3 md:mb-4">
                <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-zinc-400" />
              </div>
              <p className="text-zinc-500 font-bold text-base md:text-lg mb-1">Belum ada riwayat laporan</p>
              <p className="text-xs md:text-sm text-zinc-400">Kirim laporan pertama Anda sekarang</p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4 max-h-[500px] md:max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {feedbacks.map((feedback, idx) => (
                <motion.div
                  key={feedback.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="p-4 md:p-5 bg-zinc-50 dark:bg-zinc-800 rounded-xl md:rounded-2xl border border-zinc-100 dark:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-3 md:gap-4 mb-3 md:mb-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center ${
                        feedback.type === 'pengaduan' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {getTypeIcon(feedback.type)}
                      </div>
                      <div>
                        <span className="font-bold text-sm md:text-base text-zinc-900 dark:text-white block">{getTypeLabel(feedback.type)}</span>
                        <span className="text-[10px] md:text-xs text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(feedback.created_at), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(feedback.status)}
                      <button
                        onClick={() => setExpandedId(expandedId === feedback.id ? null : feedback.id)}
                        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
                      >
                        {expandedId === feedback.id ? 'Sembunyikan' : 'Detail'}
                        <ChevronRight className={`w-3 h-3 transition-transform ${expandedId === feedback.id ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-sm md:text-base text-zinc-800 dark:text-zinc-200 mb-2">{feedback.title}</h4>
                  
                  <AnimatePresence>
                    {expandedId === feedback.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl md:rounded-2xl leading-relaxed">{feedback.description}</p>
                        
                        {feedback.response && (
                          <div className="mt-3 md:mt-4 p-3 md:p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border border-green-100 dark:border-green-900/30 rounded-xl md:rounded-2xl">
                            <p className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center gap-2 mb-2">
                              <CheckCircle className="w-4 h-4 md:w-5 md:h-5" /> Tanggapan Serikat:
                            </p>
                            <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">{feedback.response}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}