import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { 
  Ticket, Plus, Upload, Users, Loader2, Search, Filter, 
  Download, Trash2, CheckCircle, XCircle, RefreshCw, Send, X, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { appToast } from '../../../components/ui/AppToast';
import QRCode from 'react-qr-code';
import TicketQrFrame from '../../../components/portal/TicketQrFrame';

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
  const [manualForm, setManualForm] = useState({ nik: '', name: '', couponType: 'attendance' });
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
      .select('*, union_programs(name), profiles!program_coupons_user_id_fkey(name)')
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
      appToast.success('Kupon Dibuat!', `Berhasil menggenerate ${data} kupon!`);
      setShowBulkModal(false);
      setBulkText('');
      fetchCoupons();
    } catch (err: any) {
      appToast.error('Gagal Generate', err.message || 'Terjadi kesalahan saat menggenerate kupon.');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualGenerate = async () => {
    if (!selectedProgram || !manualForm.nik || !manualForm.name) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manual-coupon', {
        body: {
          programId: selectedProgram,
          nik: manualForm.nik,
          name: manualForm.name,
          couponType: manualForm.couponType
        }
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      appToast.success('Kupon Dibuat!', `Kupon ${manualForm.couponType} berhasil dibuat untuk ${manualForm.name}!`);
      setShowManualModal(false);
      setManualForm({ nik: '', name: '', couponType: 'attendance' });
      fetchCoupons();
    } catch (err: any) {
      appToast.error('Gagal Membuat', err.message || 'Terjadi kesalahan saat membuat kupon.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadTicket = async (coupon: any) => {
    try {
      // Gunakan layout TicketQrFrame yang sama dengan tampilan di portal
      const html2canvas = (await import('html2canvas')).default;

      // Buat container tersembunyi di luar viewport
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:480px;height:640px;z-index:-1;';
      document.body.appendChild(container);

      // Tentukan label gate_type yang sesuai
      const gateLabel = (coupon.gate_type || 'ATTENDANCE').toUpperCase();
      const ticketTitleMap: Record<string, string> = {
        attendance: 'TIKET MASUK',
        attendance_family: 'TIKET MASUK (KELUARGA)',
        meal: 'KUPON MAKAN',
        meal_family: 'KUPON MAKAN (KELUARGA)',
        doorprize: 'KUPON DOORPRIZE',
        sembako: 'KUPON SEMBAKO',
      };
      const ticketTitle = ticketTitleMap[coupon.gate_type] || gateLabel;
      const statusLabel = coupon.status === 'active' ? 'AKTIF' : 'SUDAH DIGUNAKAN';
      const beneficiaryLabel = coupon.beneficiary_type === 'family' ? 'Keluarga' : 'Karyawan';
      const qrValue = coupon.coupon_code || coupon.nik || '';
      const programName = coupon.union_programs?.name || '';
      const participantName = coupon.profiles?.name || coupon.name || '-';
      const nik = coupon.nik || '-';

      // Render TicketQrFrame ke dalam container
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(
          React.createElement(TicketQrFrame, {
            programName,
            ticketTitle,
            qrValue,
            name: participantName,
            nik,
            beneficiaryLabel,
            code: coupon.coupon_code,
            status: statusLabel,
            className: 'w-full h-full',
          })
        );
        // Tunggu satu frame agar gambar dan font selesai dimuat
        setTimeout(resolve, 800);
      });

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        width: 480,
        height: 640,
      });

      root.unmount();
      document.body.removeChild(container);

      const link = document.createElement('a');
      link.download = `tiket-${participantName}-${coupon.coupon_code || ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      appToast.success('Berhasil!', `Tiket ${participantName} berhasil didownload.`);
    } catch (err) {
      console.error('Download ticket error:', err);
      appToast.error('Gagal Download', 'Terjadi kesalahan saat mendownload tiket.');
    }
  };

  const handleDeleteCoupon = async (coupon: any) => {
    if (!confirm(`Yakin hapus kupon ${coupon.coupon_code || coupon.nik} (${coupon.name})?`)) return;
    try {
      const { error } = await supabase.from('program_coupons').delete().eq('id', coupon.id);
      if (error) throw error;
      appToast.success('Kupon Dihapus!', 'Kupon berhasil dihapus.');
      fetchCoupons();
    } catch (err: any) {
      appToast.error('Gagal Menghapus', err.message || 'Terjadi kesalahan saat menghapus kupon.');
    }
  };

  const handleBypass = async (nik: string) => {
    if (!confirm(`Buat kupon bypass (Doorprize) untuk NIK ${nik}?`)) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { appToast.error('Sesi Habis', 'Sesi habis, silakan login ulang.'); return; }

      const res = await fetch(`/api/admin/programs/${selectedProgram}/bypass-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nik })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal bypass');
      if (result.success) {
        appToast.success('Bypass Berhasil!', 'Kupon Bypass berhasil diterbitkan!');
        fetchCoupons();
      } else {
        appToast.error('Gagal Bypass', result.data?.error || 'Terjadi kesalahan saat bypass.');
      }
    } catch (err: any) {
      appToast.error('Gagal Bypass', err.message || 'Terjadi kesalahan.');
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
                    <td className="p-4 font-bold text-zinc-900 dark:text-white">{c.profiles?.name || c.name}</td>
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
               <h2 className="text-lg font-black mb-4">Tambah Kupon Manual</h2>
               <div className="space-y-3">
                 <div>
                   <label className="block text-xs font-bold text-zinc-500 mb-1">Tipe Kupon</label>
                   <select
                     value={manualForm.couponType}
                     onChange={e => setManualForm({...manualForm, couponType: e.target.value})}
                     className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-medium text-sm"
                   >
                     <option value="attendance">Attendance (Absensi)</option>
                     <option value="meal">Meal (Makan)</option>
                     <option value="doorprize">Doorprize (Undian)</option>
                     <option value="sembako">Sembako</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-zinc-500 mb-1">NIK</label>
                   <input type="text" value={manualForm.nik} onChange={e => setManualForm({...manualForm, nik: e.target.value})} className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" placeholder="Masukkan NIK karyawan" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-zinc-500 mb-1">Nama Lengkap</label>
                   <input type="text" value={manualForm.name} onChange={e => setManualForm({...manualForm, name: e.target.value})} className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" placeholder="Masukkan nama lengkap" />
                 </div>
               </div>
               <div className="flex gap-3 mt-4">
                 <button onClick={() => setShowManualModal(false)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 font-bold rounded-xl">Batal</button>
                 <button onClick={handleManualGenerate} disabled={processing || !manualForm.nik || !manualForm.name} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
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