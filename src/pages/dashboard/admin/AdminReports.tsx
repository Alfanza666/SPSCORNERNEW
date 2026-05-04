import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Bug, CheckCircle2, Clock, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  in_progress: { label: 'Diproses', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  resolved: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  closed: { label: 'Ditutup', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

export default function AdminReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', reportId);
      if (error) throw error;
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
      if (selectedReport?.id === reportId) setSelectedReport((p: any) => p ? { ...p, status: newStatus } : null);
      toast.success('Status diperbarui');
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Hapus laporan ini?')) return;
    try {
      const { error } = await supabase.from('reports').delete().eq('id', reportId);
      if (error) throw error;
      setReports(prev => prev.filter(r => r.id !== reportId));
      if (selectedReport?.id === reportId) setSelectedReport(null);
      toast.success('Laporan dihapus');
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    }
  };

  const filtered = filterStatus === 'all' ? reports : reports.filter(r => r.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Laporan & Bug</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Pantau laporan bug dan saran dari pengguna</p>
        </div>
        <button onClick={fetchReports} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors shadow-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ value: 'all', label: 'Semua' }, { value: 'pending', label: 'Menunggu' }, { value: 'in_progress', label: 'Diproses' }, { value: 'resolved', label: 'Selesai' }].map(opt => (
          <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterStatus === opt.value ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-6 h-24 animate-pulse border border-zinc-100 dark:border-zinc-800" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
          <Bug className="w-12 h-12 text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-1">Tidak ada laporan</h3>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Belum ada laporan yang masuk dari pengguna.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(report => (
              <motion.div key={report.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedReport(report)}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                      <Bug className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{report.type || 'Bug Report'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_MAP[report.status]?.color || 'bg-zinc-100 text-zinc-600'}`}>
                          {STATUS_MAP[report.status]?.label || report.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-2">{report.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-zinc-400 font-bold">{report.user_name || 'Anonymous'}</span>
                        <span className="text-[10px] text-zinc-300 dark:text-zinc-600">•</span>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {format(new Date(report.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <select value={report.status} onChange={e => handleUpdateStatus(report.id, e.target.value)}
                      className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="pending">Menunggu</option>
                      <option value="in_progress">Diproses</option>
                      <option value="resolved">Selesai</option>
                      <option value="closed">Ditutup</option>
                    </select>
                    <button onClick={() => handleDelete(report.id)} className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {selectedReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedReport(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-zinc-900 dark:text-white text-lg">Detail Laporan</h3>
                <button onClick={() => setSelectedReport(null)} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <XCircle className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_MAP[selectedReport.status]?.color}`}>
                  {STATUS_MAP[selectedReport.status]?.label || selectedReport.status}
                </span>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">{selectedReport.message}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Dilaporkan oleh</p>
                    <p className="font-bold text-zinc-900 dark:text-white">{selectedReport.user_name || 'Anonymous'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Waktu</p>
                    <p className="font-bold text-zinc-900 dark:text-white">{format(new Date(selectedReport.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                {selectedReport.status !== 'resolved' && (
                  <button onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Tandai Selesai
                  </button>
                )}
                <button onClick={() => handleDelete(selectedReport.id)}
                  className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-red-100 transition-colors">
                  <Trash2 className="w-4 h-4" /> Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
