import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { MessageSquare, AlertTriangle, Shield, CheckCircle, XCircle, Send, Loader2 } from 'lucide-react';
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
  profiles?: { name: string; nik: string };
  created_at: string;
}

export default function AdminFeedbacks() {
  const { user } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'semua' | 'pending' | 'diproses' | 'selesai'>('semua');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [responding, setResponding] = useState(false);
  const [response, setResponse] = useState('');

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      fetchFeedbacks();
    }
  }, [user]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*, profiles(name, nik)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (feedbackId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('feedbacks')
        .update({ status: newStatus })
        .eq('id', feedbackId);
      
      if (error) throw error;
      toast.success('Status diperbarui');
      fetchFeedbacks();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal update status');
    }
  };

  const handleResponse = async () => {
    if (!selectedFeedback || !response.trim()) {
      toast.error('Mohon isi respons');
      return;
    }

    setResponding(true);
    try {
      const { error } = await supabase
        .from('feedbacks')
        .update({ 
          response, 
          status: 'selesai',
          responded_by: user?.id,
          responded_at: new Date().toISOString()
        })
        .eq('id', selectedFeedback.id);

      if (error) throw error;
      toast.success('Respons dikirim');
      setSelectedFeedback(null);
      setResponse('');
      fetchFeedbacks();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Gagal mengirim');
    } finally {
      setResponding(false);
    }
  };

  const filteredFeedbacks = feedbacks.filter(f => 
    filter === 'semua' || f.status === filter
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'kritik': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'saran': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'pengaduan': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'pembelaan': return <Shield className="w-4 h-4 text-green-500" />;
      default: return <MessageSquare className="w-4 h-4" />;
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
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      diproses: 'bg-blue-100 text-blue-700',
      selesai: 'bg-green-100 text-green-700',
      ditolak: 'bg-red-100 text-red-700'
    };
    const label: Record<string, string> = {
      pending: 'Menunggu',
      diproses: 'Diproses',
      selesai: 'Selesai',
      ditolak: 'Ditolak'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[status]}`}>
        {label[status]}
      </span>
    );
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-4 text-center">Akses ditolak</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Kritik & Saran</h1>
          <p className="text-sm text-zinc-500">Kelola kritik dan saran dari karyawan</p>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['semua', 'pending', 'diproses', 'selesai'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                filter === f
                  ? 'bg-purple-500 text-white'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {f === 'semua' ? 'Semua' : f === 'pending' ? 'Menunggu' : f === 'diproses' ? 'Diproses' : 'Selesai'}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl text-center">
            <div className="text-xl font-black text-zinc-900 dark:text-white">{feedbacks.length}</div>
            <div className="text-xs text-zinc-500">Total</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl text-center">
            <div className="text-xl font-black text-amber-600">{feedbacks.filter(f => f.status === 'pending').length}</div>
            <div className="text-xs text-zinc-500">Menunggu</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl text-center">
            <div className="text-xl font-black text-blue-600">{feedbacks.filter(f => f.status === 'diproses').length}</div>
            <div className="text-xs text-zinc-500">Diproses</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl text-center">
            <div className="text-xl font-black text-green-600">{feedbacks.filter(f => f.status === 'selesai').length}</div>
            <div className="text-xs text-zinc-500">Selesai</div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-8 text-zinc-400">Memuat...</div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-xl">
            <MessageSquare className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500">Belum ada kritik/saran</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFeedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(feedback.type)}
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">
                      {getTypeLabel(feedback.type)}
                    </span>
                  </div>
                  {getStatusBadge(feedback.status)}
                </div>
                
                <h3 className="font-bold text-zinc-900 dark:text-white">{feedback.title}</h3>
                <p className="text-sm text-zinc-500 mt-1">{feedback.description}</p>
                
                <div className="flex items-center justify-between mt-3 text-xs text-zinc-400">
                  <span>{feedback.profiles?.name || 'Anonymous'} • {feedback.profiles?.nik || '-'}</span>
                  <span>{format(new Date(feedback.created_at), 'dd MMM yyyy')}</span>
                </div>

                {feedback.response && (
                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-bold text-green-600">Respons:</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{feedback.response}</p>
                  </div>
                )}

                {feedback.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleStatusUpdate(feedback.id, 'diproses')}
                      className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold"
                    >
                      Proses
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(feedback.id, 'ditolak')}
                      className="py-2 px-3 bg-red-500 text-white rounded-lg text-xs font-bold"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedFeedback(feedback); setResponse(feedback.response || ''); }}
                      className="flex-1 py-2 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Send className="w-4 h-4" />
                      Respons
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Response Modal */}
        {selectedFeedback && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedFeedback(null)}
          >
            <div 
              className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="font-black">Respons Kritik/Saran</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
                  <p className="text-sm font-bold">{selectedFeedback.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">{selectedFeedback.description}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Respons</label>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    className="input-clay w-full h-32"
                    placeholder="Tulis respons..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedFeedback(null)}
                    className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleResponse}
                    disabled={responding}
                    className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold"
                  >
                    {responding ? <Loader2 className="w-4 h-4 inline animate-spin" /> : 'Kirim'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}