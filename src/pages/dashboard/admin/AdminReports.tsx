import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Bug, CheckCircle2, XCircle, Trash2, FileSpreadsheet, FileText, BarChart3, Users, Salad, Gift, TrendingUp, Download } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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

  // Program Reports state
  const [mainTab, setMainTab] = useState<'bugs' | 'programs'>('bugs');
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [programReport, setProgramReport] = useState<any>(null);
  const [programReportLoading, setProgramReportLoading] = useState(false);

  useEffect(() => { fetchReports(); fetchPrograms(); }, []);

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

  const fetchPrograms = async () => {
    try {
      const { data } = await supabase.from('union_programs').select('id, name, program_type, is_active').order('created_at', { ascending: false });
      if (data) setPrograms(data);
    } catch {}
  };

  const fetchProgramReport = async () => {
    if (!selectedProgramId) return;
    setProgramReportLoading(true);
    try {
      const response = await fetch(`/api/admin/programs/${selectedProgramId}/workflow-report`);
      const result = await response.json();
      if (result.success) setProgramReport(result.report);
      else toast.error('Gagal memuat laporan program');
    } catch (e: any) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setProgramReportLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProgramId && mainTab === 'programs') fetchProgramReport();
  }, [selectedProgramId, mainTab]);

  const exportProgramReport = async (format: 'xlsx' | 'pdf') => {
    if (!selectedProgramId) return;
    try {
      const url = `/api/admin/programs/${selectedProgramId}/workflow-report.${format}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `program-report-${selectedProgramId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Mengunduh laporan ${format.toUpperCase()}...`);
    } catch (e: any) {
      toast.error('Gagal: ' + e.message);
    }
  };

  const exportToExcel = () => {
    const data = filtered.map(r => ({
      ID: r.id?.slice(0, 8) || '',
      Tipe: r.type === 'crash' ? 'Crash/Otomatis' : 'Bug/Manual',
      Status: STATUS_MAP[r.status]?.label || r.status,
      Pesan: r.message,
      User: r.user_name || 'Anonymous',
      Halaman: r.metadata?.url || '',
      'User Agent': r.metadata?.userAgent || '',
      'Stack Trace': r.metadata?.stack || '',
      'Waktu Dibuat': format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: id }),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 10 }, { wch: 16 }, { wch: 12 },
      { wch: 60 }, { wch: 20 }, { wch: 50 },
      { wch: 40 }, { wch: 80 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan & Bug');
    XLSX.writeFile(wb, `laporan-bug-spscorner-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`);
    toast.success(`Berhasil mengekspor ${data.length} laporan ke Excel`);
  };

  const exportToMarkdown = () => {
    const lines: string[] = [];
    lines.push('# Laporan & Bug — SPS Corner');
    lines.push('');
    lines.push(`> **Diekspor pada:** ${format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: id })}`);
    lines.push(`> **Filter status:** ${filterStatus === 'all' ? 'Semua' : STATUS_MAP[filterStatus]?.label || filterStatus}`);
    lines.push(`> **Total laporan:** ${filtered.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    filtered.forEach((r, i) => {
      lines.push(`## ${i + 1}. ${r.message?.slice(0, 80)}`);
      lines.push('');
      lines.push(`| Field | Detail |`);
      lines.push(`|-------|--------|`);
      lines.push(`| **ID** | \`${r.id || '-'}\` |`);
      lines.push(`| **Tipe** | ${r.type === 'crash' ? 'Crash / Otomatis' : 'Bug / Manual'} |`);
      lines.push(`| **Status** | ${STATUS_MAP[r.status]?.label || r.status} |`);
      lines.push(`| **User** | ${r.user_name || 'Anonymous'} |`);
      lines.push(`| **Pesan** | ${r.message || '-'} |`);
      lines.push(`| **Halaman** | ${r.metadata?.url || '-'} |`);
      lines.push(`| **Browser / OS** | ${r.metadata?.userAgent || '-'} |`);
      lines.push(`| **Screen** | ${r.metadata?.screen || '-'} |`);
      lines.push(`| **Language** | ${r.metadata?.language || '-'} |`);
      lines.push(`| **Connection** | ${r.metadata?.connection || '-'} |`);
      lines.push(`| **Waktu** | ${format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: id })} |`);
      lines.push('');
      if (r.metadata?.stack) {
        lines.push('### Stack Trace');
        lines.push('');
        lines.push('```');
        lines.push(r.metadata.stack);
        lines.push('```');
        lines.push('');
      }
      if (r.metadata?.breadcrumbs?.length > 0) {
        lines.push('### Riwayat Aksi (Breadcrumbs)');
        lines.push('');
        lines.push('| Waktu | Tipe | Detail |');
        lines.push('|-------|------|--------|');
        r.metadata.breadcrumbs.forEach((b: any) => {
          lines.push(`| ${format(new Date(b.time), 'HH:mm:ss')} | ${b.type} | ${b.value} |`);
        });
        lines.push('');
      }
      if (r.metadata?.timestamp) {
        lines.push(`> *Auto-capture timestamp: ${r.metadata.timestamp}*`);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });
    lines.push('---');
    lines.push('');
    lines.push(`*Dibuat secara otomatis oleh SPS Corner — ${format(new Date(), 'yyyy-MM-dd HH:mm')}*`);
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-bug-spscorner-${format(new Date(), 'yyyyMMdd-HHmm')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Berhasil mengekspor ${filtered.length} laporan ke Markdown`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Laporan</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Pantau laporan bug dan laporan program</p>
        </div>
        {mainTab === 'bugs' && (
          <div className="flex gap-2">
            <button onClick={exportToMarkdown} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors shadow-sm">
              <FileText className="w-4 h-4" /> Export .md
            </button>
            <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm">
              <FileSpreadsheet className="w-4 h-4" /> Export .xlsx
            </button>
          </div>
        )}
        {mainTab === 'programs' && selectedProgramId && (
          <div className="flex gap-2">
            <button onClick={() => exportProgramReport('xlsx')} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => exportProgramReport('pdf')} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm">
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Switcher */}
      <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
        <button onClick={() => setMainTab('bugs')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${mainTab === 'bugs' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
          <Bug className="w-3.5 h-3.5 inline mr-1.5" /> Laporan Bug
        </button>
        <button onClick={() => setMainTab('programs')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${mainTab === 'programs' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
          <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" /> Laporan Program
        </button>
      </div>

      {/* === BUG REPORTS TAB === */}
      {mainTab === 'bugs' && (<>
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
              <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_MAP[selectedReport.status]?.color}`}>
                    {STATUS_MAP[selectedReport.status]?.label || selectedReport.status}
                  </span>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{selectedReport.type === 'crash' ? 'Otonom / Crash' : 'Manual / Bug'}</span>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-bold leading-relaxed">{selectedReport.message}</p>
                </div>

                {/* Metadata Details */}
                {selectedReport.metadata && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">
                        <p className="text-[9px] font-black text-zinc-400 uppercase mb-1">Halaman</p>
                        <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 truncate">{selectedReport.metadata.url || '-'}</p>
                      </div>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">
                        <p className="text-[9px] font-black text-zinc-400 uppercase mb-1">Browser / OS</p>
                        <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 truncate">{selectedReport.metadata.userAgent || '-'}</p>
                      </div>
                    </div>

                    {selectedReport.metadata.breadcrumbs && selectedReport.metadata.breadcrumbs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Riwayat Aksi (Breadcrumbs)</p>
                        <div className="bg-zinc-900 rounded-xl p-3 space-y-1.5 max-h-32 overflow-y-auto">
                          {selectedReport.metadata.breadcrumbs.map((b: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[9px] font-mono">
                              <span className="text-zinc-600">[{format(new Date(b.time), 'HH:mm:ss')}]</span>
                              <span className="text-blue-400 uppercase">{b.type}</span>
                              <span className="text-zinc-400">{b.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedReport.metadata.stack && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Stack Trace</p>
                        <div className="bg-zinc-900 rounded-xl p-3 overflow-x-auto">
                          <pre className="text-[9px] font-mono text-red-400/80 leading-tight">
                            {selectedReport.metadata.stack}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm pt-2">
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
              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 bg-zinc-50/50 dark:bg-zinc-800/20">
                {selectedReport.status !== 'resolved' && (
                  <button onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
                    <CheckCircle2 className="w-4 h-4" /> Tandai Selesai
                  </button>
                )}
                <button onClick={() => handleDelete(selectedReport.id)}
                  className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-red-100 transition-all active:scale-95">
                  <Trash2 className="w-4 h-4" /> Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>)}

      {/* === PROGRAM REPORTS TAB === */}
      {mainTab === 'programs' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedProgramId}
              onChange={e => setSelectedProgramId(e.target.value)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih program...</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.program_type})</option>
              ))}
            </select>
          </div>

          {!selectedProgramId ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
              <BarChart3 className="w-12 h-12 text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-1">Pilih Program</h3>
              <p className="text-sm text-zinc-400">Pilih program untuk melihat laporan workflow</p>
            </div>
          ) : programReportLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-6 h-32 animate-pulse border border-zinc-100 dark:border-zinc-800" />)}
            </div>
          ) : programReport ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <Users className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{programReport.total_registrations || 0}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Total Registrasi</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{programReport.attending_count || 0}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Hadir</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <Salad className="w-5 h-5 text-orange-500 mb-2" />
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{programReport.shirt_count || 0}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Kaos</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <Gift className="w-5 h-5 text-purple-500 mb-2" />
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{programReport.total_family_members || 0}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Keluarga</p>
                </div>
              </div>

              {/* Payment & RSVP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-xs font-black text-zinc-400 uppercase mb-4">RSVP</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-zinc-600 dark:text-zinc-400">Hadir</span><span className="text-sm font-bold text-emerald-600">{programReport.attending_count || 0}</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm text-zinc-600 dark:text-zinc-400">Menolak</span><span className="text-sm font-bold text-red-600">{programReport.declined_count || 0}</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm text-zinc-600 dark:text-zinc-400">Belum Jawab</span><span className="text-sm font-bold text-zinc-600">{programReport.unanswered_count || 0}</span></div>
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-xs font-black text-zinc-400 uppercase mb-4">Pembayaran</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-zinc-600 dark:text-zinc-400">Lunas</span><span className="text-sm font-bold text-emerald-600">{programReport.paid_count || 0}</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm text-zinc-600 dark:text-zinc-400">Pending</span><span className="text-sm font-bold text-amber-600">{programReport.pending_payment_count || 0}</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm text-zinc-600 dark:text-zinc-400">Gagal</span><span className="text-sm font-bold text-red-600">{programReport.failed_payment_count || 0}</span></div>
                    <div className="border-t border-zinc-100 dark:border-zinc-700 pt-3 mt-3 flex justify-between items-center">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Total Tagihan</span>
                      <span className="text-sm font-black text-zinc-900 dark:text-white">Rp {(programReport.total_billed || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Total Dibayar</span>
                      <span className="text-sm font-black text-emerald-600">Rp {(programReport.total_paid || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Config Info */}
              {programReport.config_version && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 flex items-center gap-4 text-xs text-zinc-400">
                  <span>Config Version: <strong className="text-zinc-700 dark:text-zinc-300">v{programReport.config_version}</strong></span>
                  {programReport.published_at && <span>Diterbitkan: <strong className="text-zinc-700 dark:text-zinc-300">{format(new Date(programReport.published_at), 'dd MMM yyyy, HH:mm', { locale: id })}</strong></span>}
                  {programReport.rsvp_deadline && <span>Deadline RSVP: <strong className="text-zinc-700 dark:text-zinc-300">{format(new Date(programReport.rsvp_deadline), 'dd MMM yyyy', { locale: id })}</strong></span>}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
              <TrendingUp className="w-12 h-12 text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-1">Tidak ada data</h3>
              <p className="text-sm text-zinc-400">Program ini belum dipublikasikan (V2)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
