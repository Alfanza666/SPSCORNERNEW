import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  AlertTriangle, Shield, CheckCircle, Clock, Loader2, Search, XCircle, FileText, ChevronRight, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface Profile {
  name: string;
  nik: string;
  phone: string;
}

interface Feedback {
  id: string;
  user_id: string;
  type: 'kritik' | 'saran' | 'pengaduan' | 'pembelaan';
  title: string;
  description: string;
  status: 'pending' | 'diproses' | 'selesai' | 'ditolak';
  response: string;
  created_at: string;
  profiles: Profile | null;
}

export default function AdminPengaduan() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Response modal states
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [responseMsg, setResponseMsg] = useState('');
  const [newStatus, setNewStatus] = useState<'diproses' | 'selesai' | 'ditolak'>('diproses');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select(`
          *,
          profiles:user_id(name, nik, phone)
        `)
        .in('type', ['pengaduan', 'pembelaan'])
        .order('created_at', { ascending: false });

      if (error) {
        // Retry with explicit fkey if ambiguous
        if (error.message.includes('relationship was found')) {
            const fallbackRes = await supabase
                .from('feedbacks')
                .select(`
                  *,
                  profiles!feedbacks_user_id_fkey(name, nik, phone)
                `)
                .in('type', ['pengaduan', 'pembelaan'])
                .order('created_at', { ascending: false });
            
            if (fallbackRes.data) {
                // @ts-ignore
                setFeedbacks(fallbackRes.data);
            }
        } else {
            throw error;
        }
      } else if (data) {
        // @ts-ignore
        setFeedbacks(data);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      toast.error('Gagal memuat daftar pengaduan');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResponse = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setResponseMsg(feedback.response || '');
    setNewStatus(feedback.status === 'pending' ? 'diproses' : (feedback.status as any));
    setIsResponseModalOpen(true);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('feedbacks')
        .update({ 
          response: responseMsg,
          status: newStatus 
        })
        .eq('id', selectedFeedback.id);

      if (error) throw error;
      
      toast.success('Tanggapan berhasil disimpan');
      
      // Update local state
      setFeedbacks(feedbacks.map(f => 
        f.id === selectedFeedback.id ? { ...f, response: responseMsg, status: newStatus } : f
      ));
      
      // Send notification to user
      try {
          await supabase.from('notifications').insert({
              user_id: selectedFeedback.user_id,
              title: `Update Laporan ${selectedFeedback.type === 'pengaduan' ? 'Pengaduan' : 'Pembelaan'}`,
              message: `Laporan Anda "${selectedFeedback.title}" kini berstatus: ${newStatus.toUpperCase()}`,
              type: 'system',
              path: '/portal/pengaduan'
          });
      } catch (e) {
          console.error("Failed sending notification", e);
      }
      
      setIsResponseModalOpen(false);
    } catch (error) {
      console.error('Error saving response:', error);
      toast.error('Gagal menyimpan tanggapan');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFeedbacks = feedbacks.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.profiles?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.profiles?.nik.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || f.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      diproses: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      selesai: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800',
      ditolak: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800'
    };
    return (
      <span className={`px-3 py-1 md:py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${styles[status as keyof typeof styles]}`}>
        {status === 'pending' ? 'Menunggu' : 
         status === 'diproses' ? 'Diproses' : 
         status === 'selesai' ? 'Selesai' : 'Ditolak'}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            Laporan Pengaduan
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Kelola dan tanggapi pengaduan karyawan</p>
        </div>
        
        <div className="flex w-full md:w-auto items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari laporan atau NIK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 px-4 text-sm font-bold outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="diproses">Diproses</option>
            <option value="selesai">Selesai</option>
            <option value="ditolak">Ditolak</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-10 h-10 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Tidak Ada Laporan</h3>
          <p className="text-zinc-500">Belum ada laporan pengaduan yang sesuai dengan filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredFeedbacks.map((f, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={f.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div 
                className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    f.type === 'pengaduan' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  }`}>
                    {f.type === 'pengaduan' ? <AlertTriangle className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-lg">{f.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm font-medium text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {format(new Date(f.created_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                      <span>•</span>
                      <span className="capitalize text-zinc-900 dark:text-white font-bold">{f.profiles?.name || 'Anonim'}</span>
                      <span className="text-xs text-zinc-400">({f.profiles?.nik || '-'})</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  {getStatusBadge(f.status)}
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800 group-hover:bg-zinc-100 transition-colors">
                    <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${expandedId === f.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === f.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30"
                  >
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Detail Kejadian / Laporan</p>
                          <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {f.description}
                          </p>
                        </div>
                        
                        {f.response && (
                          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
                            <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-2">
                              <MessageSquare className="w-3 h-3" /> Tanggapan Admin
                            </p>
                            <p className="text-zinc-900 dark:text-zinc-100 font-medium">
                              {f.response}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">Tindakan</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenResponse(f);
                            }}
                            className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <MessageSquare className="w-4 h-4" />
                            {f.response ? 'Edit Tanggapan' : 'Beri Tanggapan'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Response Modal */}
      {isResponseModalOpen && selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h2 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Tanggapi Laporan
              </h2>
              <button 
                onClick={() => setIsResponseModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <XCircle className="w-5 h-5 text-zinc-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitResponse} className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 mb-2">Update Status Laporan</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['diproses', 'selesai', 'ditolak'] as const).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setNewStatus(status)}
                      className={`py-2 rounded-xl font-bold text-sm transition-all border-2 ${
                        newStatus === status 
                          ? (status === 'selesai' ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30' : 
                             status === 'ditolak' ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30' : 
                             'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30')
                          : 'bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
                      }`}
                    >
                      {status === 'diproses' ? 'Diproses' : status === 'selesai' ? 'Selesai' : 'Ditolak'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 mb-2">Isi Tanggapan (Response)</label>
                <textarea
                  required
                  rows={4}
                  value={responseMsg}
                  onChange={(e) => setResponseMsg(e.target.value)}
                  placeholder="Ketik tanggapan atau penjelasan untuk pengirim..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                ></textarea>
              </div>
              
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsResponseModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Simpan & Kirim Notif
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
