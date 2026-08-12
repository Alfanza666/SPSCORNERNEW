import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { 
  Ticket, Plus, Upload, Users, Loader2, Search,
  Download, Trash2, Send, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { appToast } from '../../../components/ui/AppToast';
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
      // Gunakan REST endpoint server (bukan Supabase Edge Function yang tidak ada)
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Sesi habis, silakan login ulang.');

      const res = await fetch(`/api/admin/programs/${selectedProgram}/manual-coupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nik: manualForm.nik,
          name: manualForm.name,
          couponType: manualForm.couponType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan saat membuat kupon.');
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
      const W = 960;
      const H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // Helper: load image by src → HTMLImageElement
      const loadImage = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(img); // lanjut meski gagal
          img.src = src;
        });

      // Load semua aset secara paralel
      const [frameImg, sariRotiImg, federasiImg, spsLogoImg] = await Promise.all([
        loadImage('/src/components/ui/Frame QR New.png'),
        loadImage('/src/components/ui/logo_sariroti_group.png'),
        loadImage('/src/components/ui/federasi-logo.png'),
        loadImage('/src/components/ui/logo-landscape.webp'),
      ]);

      // --- Background putih ---
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // --- Frame background ---
      if (frameImg.complete && frameImg.naturalWidth > 0) {
        ctx.drawImage(frameImg, 0, 0, W, H);
      }

      // --- Logo kiri (Sari Roti) ---
      if (sariRotiImg.complete && sariRotiImg.naturalWidth > 0) {
        ctx.drawImage(sariRotiImg, Math.round(W * 0.06), Math.round(H * 0.045), Math.round(W * 0.145), Math.round(H * 0.06));
      }

      // --- Logo kanan (Federasi) ---
      if (federasiImg.complete && federasiImg.naturalWidth > 0) {
        ctx.drawImage(federasiImg, Math.round(W * 0.835), Math.round(H * 0.045), Math.round(W * 0.105), Math.round(H * 0.062));
      }

      // --- Label tipe peserta ---
      const beneficiaryLabel = (coupon.beneficiary_type === 'family' ? 'Keluarga' : 'Karyawan').toUpperCase();
      const centerX = W / 2;
      const labelY = Math.round(H * 0.095);
      ctx.fillStyle = '#1e3a8a'; // blue-900
      const badgeW = 160; const badgeH = 28; const badgeR = 14;
      const bx = centerX - badgeW / 2;
      ctx.beginPath();
      ctx.moveTo(bx + badgeR, labelY - badgeH / 2);
      ctx.arcTo(bx + badgeW, labelY - badgeH / 2, bx + badgeW, labelY + badgeH / 2, badgeR);
      ctx.arcTo(bx + badgeW, labelY + badgeH / 2, bx, labelY + badgeH / 2, badgeR);
      ctx.arcTo(bx, labelY + badgeH / 2, bx, labelY - badgeH / 2, badgeR);
      ctx.arcTo(bx, labelY - badgeH / 2, bx + badgeW, labelY - badgeH / 2, badgeR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(beneficiaryLabel, centerX, labelY);

      // --- Nama program ---
      const programName = (coupon.union_programs?.name || 'PROGRAM SERIKAT').toUpperCase();
      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 52px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      // Word wrap jika terlalu panjang
      const maxProgramW = W * 0.62;
      let programFontSize = 52;
      ctx.font = `bold ${programFontSize}px Arial`;
      while (ctx.measureText(programName).width > maxProgramW && programFontSize > 20) {
        programFontSize -= 2;
        ctx.font = `bold ${programFontSize}px Arial`;
      }
      ctx.fillText(programName, centerX, Math.round(H * 0.135));

      // --- Tipe tiket ---
      const ticketTitleMap: Record<string, string> = {
        attendance: 'TIKET MASUK', attendance_family: 'TIKET MASUK (KELUARGA)',
        meal: 'KUPON MAKAN', meal_family: 'KUPON MAKAN (KELUARGA)',
        doorprize: 'KUPON DOORPRIZE', sembako: 'KUPON SEMBAKO',
      };
      const ticketTitle = (ticketTitleMap[coupon.gate_type] || (coupon.gate_type || 'TIKET').toUpperCase());
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.font = 'bold 26px Arial';
      ctx.fillText(ticketTitle, centerX, Math.round(H * 0.162));

      // --- QR Code via qr.js ---
      const qrValue = coupon.coupon_code || coupon.nik || 'NO-CODE';
      const QRlib = (await import('qr.js')).default;
      const qr = QRlib(qrValue, { typeNumber: -1, errorCorrectLevel: QRlib.ErrorCorrectLevel.H });
      const mods = qr.modules;
      const qrAreaSize = Math.round(W * 0.46);
      const qrX = Math.round((W - qrAreaSize) / 2);
      const qrY = Math.round(H * 0.305);
      const cellSize = qrAreaSize / mods.length;
      // QR background putih + shadow
      const qrPad = 16;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(30,64,175,0.35)';
      ctx.shadowBlur = 30;
      ctx.fillRect(qrX - qrPad, qrY - qrPad, qrAreaSize + qrPad * 2, qrAreaSize + qrPad * 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f172a';
      for (let r = 0; r < mods.length; r++) {
        for (let c = 0; c < mods.length; c++) {
          if (mods[r][c]) {
            ctx.fillRect(
              qrX + Math.round(c * cellSize),
              qrY + Math.round(r * cellSize),
              Math.ceil(cellSize), Math.ceil(cellSize)
            );
          }
        }
      }

      // --- Nama peserta ---
      const participantName = (coupon.profiles?.name || coupon.name || '-').toUpperCase();
      const nik = coupon.nik || '-';
      const infoY = Math.round(H * 0.74);
      const infoX = Math.round(W * 0.08);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(30,58,138,0.75)';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('NAMA', infoX, infoY);
      ctx.fillStyle = '#172554';
      ctx.font = 'bold 32px Arial';
      ctx.fillText(participantName, infoX, infoY + 36);

      // --- NIK ---
      const nikY = Math.round(H * 0.812);
      ctx.fillStyle = 'rgba(30,58,138,0.75)';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('NIK', infoX, nikY);
      ctx.fillStyle = '#172554';
      ctx.font = 'bold 28px Courier New, monospace';
      ctx.fillText(nik, infoX, nikY + 34);

      // --- Kode kupon ---
      if (coupon.coupon_code) {
        ctx.fillStyle = 'rgba(30,58,138,0.65)';
        ctx.font = 'bold 22px Courier New, monospace';
        ctx.fillText(coupon.coupon_code, infoX, Math.round(H * 0.864));
      }

      // --- Badge status ---
      const statusLabel = coupon.status === 'active' ? 'AKTIF' : 'SUDAH DIGUNAKAN';
      const statusBgColor = coupon.status === 'active' ? '#10b981' : '#f59e0b';
      const sbX = Math.round(W * 0.68);
      const sbY = Math.round(H * 0.75);
      ctx.fillStyle = statusBgColor;
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      const sW = ctx.measureText(statusLabel).width + 28;
      const sH = 34; const sR = 17;
      ctx.beginPath();
      ctx.moveTo(sbX - sW / 2 + sR, sbY - sH / 2);
      ctx.arcTo(sbX + sW / 2, sbY - sH / 2, sbX + sW / 2, sbY + sH / 2, sR);
      ctx.arcTo(sbX + sW / 2, sbY + sH / 2, sbX - sW / 2, sbY + sH / 2, sR);
      ctx.arcTo(sbX - sW / 2, sbY + sH / 2, sbX - sW / 2, sbY - sH / 2, sR);
      ctx.arcTo(sbX - sW / 2, sbY - sH / 2, sbX + sW / 2, sbY - sH / 2, sR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(statusLabel, sbX, sbY);

      // --- Logo SPS Corner (kanan bawah) ---
      if (spsLogoImg.complete && spsLogoImg.naturalWidth > 0) {
        const lW = Math.round(W * 0.22);
        const lH = Math.round(lW * (spsLogoImg.naturalHeight / spsLogoImg.naturalWidth));
        ctx.drawImage(spsLogoImg, sbX - lW / 2, Math.round(H * 0.8), lW, lH);
      }

      // --- Download ---
      const link = document.createElement('a');
      link.download = `tiket-${participantName.replace(/\s+/g, '-')}-${coupon.coupon_code || ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      appToast.success('Berhasil!', `Tiket ${coupon.profiles?.name || coupon.name} berhasil didownload.`);
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