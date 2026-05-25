import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { 
  Ticket, Plus, Upload, Users, Loader2, Search, Filter, 
  Download, Trash2, CheckCircle, XCircle, RefreshCw, Send, X, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';

export default function AdminProgramCoupons() {
  const { user } = useAuthStore();
  const [programs, setPrograms] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [manualForm, setManualForm] = useState({ nik: '', name: '' });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgram) fetchCoupons();
  }, [selectedProgram, filterStatus, filterType]);

  const fetchPrograms = async () => {
    const { data } = await supabase.from('union_programs').select('id, name').order('created_at', { ascending: false });
    if (data) setPrograms(data);
    if (data && data.length > 0) setSelectedProgram(data[0].id);
    setLoading(false);
  };

  const fetchCoupons = async () => {
    setLoading(true);
    let query = supabase
      .from('program_coupons')
      .select('*, union_programs(name)')
      .eq('program_id', selectedProgram);

    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterType !== 'all') query = query.eq('gate_type', filterType);
    if (searchTerm) query = query.or(`name.ilike.%${searchTerm}%,nik.ilike.%${searchTerm}%,coupon_code.ilike.%${searchTerm}%`);

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setCoupons(data);
    setLoading(false);
  };

  const handleBulkGenerate = async () => {
    if (!selectedProgram || !bulkText) return;
    setProcessing(true);
    try {
      const niks = bulkText.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 3);
      const { data, error } = await supabase.rpc('generate_program_coupons', {
        p_program_id: selectedProgram,
        p_niks: niks
      });
      if (error) throw error;
      toast.success(`Berhasil menggenerate ${data} kupon!`);
      setShowBulkModal(false);
      setBulkText('');
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleManualGenerate = async () => {
    if (!selectedProgram || !manualForm.nik || !manualForm.name) return;
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('generate_manual_coupon', {
        p_program_id: selectedProgram,
        p_nik: manualForm.nik,
        p_name: manualForm.name
      });
      if (error) throw error;
      toast.success('Kupon manual berhasil dibuat!');
      setShowManualModal(false);
      setManualForm({ nik: '', name: '' });
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const downloadTicket = async (coupon: any) => {
    try {
      const canvas = document.createElement('canvas');
      const size = 500;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(0, 0, size, 80);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const loadImg = new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = '/logos/serikat-logo.png';
      });
      await loadImg;
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 12, 12, 56, 56);
      }
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px Arial';
      ctx.fillText((coupon.union_programs?.name || 'PROGRAM').toUpperCase(), size / 2, 35);
      ctx.font = '12px Arial';
      ctx.fillText('TANDA TERIMA', size / 2, 55);
      ctx.fillStyle = '#1e3a5f';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Nama:', 30, 120);
      ctx.font = '15px Arial';
      ctx.fillText(coupon.name || '-', 110, 120);
      ctx.font = 'bold 16px Arial';
      ctx.fillText('NIK:', 30, 150);
      ctx.font = '15px Arial';
      ctx.fillText(coupon.nik || '-', 110, 150);
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Gate:', 30, 180);
      ctx.font = '15px Arial';
      ctx.fillText((coupon.gate_type || '-').toUpperCase(), 110, 180);
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Kode:', 30, 210);
      ctx.font = 'bold 15px Courier New';
      ctx.fillText(coupon.coupon_code || '-', 110, 210);
      const qrValue = coupon.coupon_code || coupon.nik;
      const qrCanvas = document.createElement('canvas');
      const qrSize = 220;
      qrCanvas.width = qrSize;
      qrCanvas.height = qrSize;
      const QRlib = (await import('qr.js')).default;
      const qr = QRlib(qrValue, { typeNumber: -1, errorCorrectLevel: QRlib.ErrorCorrectLevel.H });
      const mods = qr.modules;
      const cellSize = qrSize / mods.length;
      const qrCtx = qrCanvas.getContext('2d');
      if (!qrCtx) return;
      qrCtx.fillStyle = '#ffffff';
      qrCtx.fillRect(0, 0, qrSize, qrSize);
      qrCtx.fillStyle = '#000000';
      for (let r = 0; r < mods.length; r++) {
        for (let c = 0; c < mods.length; c++) {
          if (mods[r][c]) {
            qrCtx.fillRect(c * cellSize, r * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
          }
        }
      }
      ctx.drawImage(qrCanvas, (size - qrSize) / 2, 240, qrSize, qrSize);
      ctx.fillStyle = '#888888';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Federasi Serikat Pekerja Sukses', size / 2, size - 15);
      const link = document.createElement('a');
      link.download = `tiket-${coupon.name || coupon.nik}-${coupon.coupon_code || ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download ticket error:', err);
      toast.error('Gagal mendownload tiket');
    }
  };

  const handleDeleteCoupon = async (coupon: any) => {
    if (!confirm(`Yakin hapus kupon ${coupon.coupon_code || coupon.nik} (${coupon.name})?`)) return;
    try {
      const { error } = await supabase.from('program_coupons').delete().eq('id', coupon.id);
      if (error) throw error;
      toast.success('Kupon berhasil dihapus');
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBypass = async (nik: string) => {
    if (!confirm(`Buat kupon bypass (Doorprize) untuk NIK ${nik}?`)) return;
    try {
      const { data, error } = await supabase.rpc('bypass_attendance_coupon', {
        p_program_id: selectedProgram,
        p_nik: nik
      });
      if (error) throw error;
      if (data.success) {
        toast.success('Kupon Bypass diterbitkan!');
        fetchCoupons();
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
            <Ticket className="w-8 h-8 text-blue-600" />
            Manajemen Kupon
          </h1>
          <p className="text-sm text-zinc-500">Generate & Kelola kupon peserta program</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20"
          >
            <Upload className="w-4 h-4" /> Bulk Generate
          </button>
          <button 
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            <Plus className="w-4 h-4" /> Manual Input
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Pilih Program</label>
            <select 
              value={selectedProgram} 
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold"
            >
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
             <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Filter Tipe</label>
             <select onChange={(e) => setFilterType(e.target.value)} className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm">
               <option value="all">Semua Tipe</option>
               <option value="attendance">Attendance (Presensi)</option>
               <option value="meal">Meal (Makan)</option>
               <option value="doorprize">Doorprize (Undian)</option>
             </select>
          </div>
          <div>
             <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Filter Status</label>
             <select onChange={(e) => setFilterStatus(e.target.value)} className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm">
               <option value="all">Semua Status</option>
               <option value="active">Active</option>
               <option value="claimed">Claimed</option>
             </select>
          </div>
          <div>
             <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Cari Nama/NIK/Kode</label>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
               <input 
                 type="text" 
                 placeholder="Cari..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
               />
             </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="p-4 text-xs font-black text-zinc-500 uppercase">Nama</th>
                <th className="p-4 text-xs font-black text-zinc-500 uppercase">NIK</th>
                <th className="p-4 text-xs font-black text-zinc-500 uppercase">Kode Kupon</th>
                <th className="p-4 text-xs font-black text-zinc-500 uppercase">Gate</th>
                <th className="p-4 text-xs font-black text-zinc-500 uppercase">Status</th>
                <th className="p-4 text-xs font-black text-zinc-500 uppercase text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-400">Belum ada kupon</td></tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="p-4 font-bold text-zinc-900 dark:text-white">{c.name}</td>
                    <td className="p-4 font-mono text-sm text-zinc-600 dark:text-zinc-400">{c.nik}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {/* Small QR Preview */}
                        <div className="w-8 h-8 bg-white border border-zinc-200 p-0.5 rounded">
                           <QRCode value={c.coupon_code} style={{ width: '100%', height: '100%' }} />
                        </div>
                        <span className="font-mono text-xs">{c.coupon_code}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        c.gate_type === 'attendance' ? 'bg-blue-100 text-blue-600' :
                        c.gate_type === 'meal' ? 'bg-orange-100 text-orange-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        {c.gate_type}
                      </span>
                    </td>
                    <td className="p-4">
                      {c.status === 'active' ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-green-600"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Active</span>
                      ) : (
                         <span className="flex items-center gap-1 text-xs font-bold text-zinc-400"><div className="w-2 h-2 bg-zinc-300 rounded-full"></div> Claimed</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => downloadTicket(c)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50"
                          title="Download Tiket"
                        >
                          <Download className="w-3 h-3 inline-block mr-0.5" />Tiket
                        </button>
                        {c.gate_type === 'attendance' && c.status === 'active' && (
                          <button 
                            onClick={() => handleBypass(c.nik)}
                            className="text-xs font-bold text-amber-600 hover:text-amber-700 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-50"
                            title="Bypass presensi"
                          >
                            Bypass
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteCoupon(c)}
                          className="text-xs font-bold text-red-600 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50"
                          title="Hapus kupon"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Bulk Generate */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
               <h2 className="text-lg font-black mb-4">Bulk Generate Kupon</h2>
               <p className="text-sm text-zinc-500 mb-2">Masukkan NIK satu per baris atau pisahkan dengan koma:</p>
               <textarea 
                 value={bulkText}
                 onChange={(e) => setBulkText(e.target.value)}
                 className="w-full h-40 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-sm"
                 placeholder="1234567890&#10;0987654321"
               />
               <div className="flex gap-3 mt-4">
                 <button onClick={() => setShowBulkModal(false)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 font-bold rounded-xl">Batal</button>
                 <button onClick={handleBulkGenerate} disabled={processing} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                   {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   Generate
                 </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: Manual Generate */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
               <h2 className="text-lg font-black mb-4">Tambah Kupon Manual (Afiliasi)</h2>
               <div className="space-y-3">
                 <div>
                   <label className="block text-xs font-bold text-zinc-500 mb-1">NIK</label>
                   <input type="text" value={manualForm.nik} onChange={e => setManualForm({...manualForm, nik: e.target.value})} className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-zinc-500 mb-1">Nama Lengkap</label>
                   <input type="text" value={manualForm.name} onChange={e => setManualForm({...manualForm, name: e.target.value})} className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                 </div>
               </div>
               <div className="flex gap-3 mt-4">
                 <button onClick={() => setShowManualModal(false)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 font-bold rounded-xl">Batal</button>
                 <button onClick={handleManualGenerate} disabled={processing} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                   {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   Buat Kupon
                 </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}