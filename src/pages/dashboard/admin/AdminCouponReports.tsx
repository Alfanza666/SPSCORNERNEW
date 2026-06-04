import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Printer, Search, FileSpreadsheet, Loader2, FileText, Plus, X, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminCouponReports() {
  const { user } = useAuthStore();
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [nomorSurat, setNomorSurat] = useState<string>('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // State untuk modal tambah data scan manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingData, setAddingData] = useState(false);
  const [newRecord, setNewRecord] = useState({
    programId: '',
    nik: '',
    name: '',
    claimedAt: new Date().toISOString().slice(0, 16),
    couponType: 'attendance'
  });
  const [downloading, setDownloading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const allSelected = reportData.length > 0 && reportData.every(row => selectedIds[row.id]);
  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  const toggleSelectAll = () => {
    const newSelected: Record<string, boolean> = {};
    if (allSelected) {
      reportData.forEach(row => {
        newSelected[row.id] = false;
      });
    } else {
      reportData.forEach(row => {
        newSelected[row.id] = true;
      });
    }
    setSelectedIds(newSelected);
  };

  useEffect(() => {
    fetchPrograms();
    // Default: awal bulan sampai hari ini
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    setStartDate(firstOfMonth);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const fetchPrograms = async () => {
    try {
      const { data } = await supabase.from('union_programs').select('id, name');
      if (data) setPrograms(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFetchData = async () => {
    if (!startDate || !endDate) {
      toast.error('Harap pilih rentang tanggal');
      return;
    }

    setFetchingData(true);
    try {
      let query = supabase
        .from('program_coupons')
        .select('*, profiles!program_coupons_user_id_fkey(name, nik, phone), union_programs(name)')
        .eq('status', 'claimed')
        .gte('claimed_at', `${startDate}T00:00:00Z`)
        .lte('claimed_at', `${endDate}T23:59:59Z`)
        .order('claimed_at', { ascending: false });

      if (selectedProgram !== 'all') {
        query = query.eq('program_id', selectedProgram);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReportData(data || []);
      if (data) {
        const initialSelected: Record<string, boolean> = {};
        data.forEach((row: any) => {
          initialSelected[row.id] = true;
        });
        setSelectedIds(initialSelected);
      } else {
        setSelectedIds({});
      }
      
      if (data?.length === 0) {
        toast.error('Tidak ada data scan ditemukan pada rentang waktu tersebut.');
      } else {
        toast.success(`${data?.length} data ditemukan`);
      }
    } catch (e: any) {
      toast.error('Gagal menarik data: ' + e.message);
    } finally {
      setFetchingData(false);
    }
  };

  const exportToExcel = () => {
    const selectedData = reportData.filter(row => selectedIds[row.id]);
    if (selectedData.length === 0) {
      toast.error('Pilih minimal satu NIK/data untuk diekspor');
      return;
    }

    const excelData = selectedData.map((row, index) => ({
      No: index + 1,
      'Waktu Scan': new Date(row.claimed_at).toLocaleString('id-ID'),
      'Program': row.union_programs?.name || '-',
      'NIK': row.nik,
      'Nama Karyawan': row.name || row.profiles?.name || '-',
      'Jenis Kupon': (row.coupon_type || row.gate_type || '-').toUpperCase()
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    if (nomorSurat) XLSX.utils.sheet_add_aoa(ws, [[`Nomor Surat: ${nomorSurat}`]], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Scan Kupon");
    XLSX.writeFile(wb, `Laporan_Kupon_SPS_${startDate}_to_${endDate}.xlsx`);
  };

  const downloadPDF = async () => {
    const selectedData = reportData.filter(row => selectedIds[row.id]);
    if (selectedData.length === 0) {
      toast.error('Pilih minimal satu NIK/data untuk diekspor');
      return;
    }
    setDownloading(true);
    try {
      const mm = (v: number) => v;
      const pageW = 210;
      const margin = 15;
      const usable = pageW - margin * 2;

      const doc = new jsPDF('p', 'mm', 'a4');
      let y = margin;

      // ── KOP SURAT ──
      // Logo
      const logoUrl = '/logos/serikat-logo.png';
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = logoUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try { doc.addImage(img, 'PNG', margin, y, 24, 24); } catch {}
            resolve();
          };
          img.onerror = () => resolve();
          if (img.complete) img.onload(null as any);
        });
      } catch {}

      // Teks kop
      doc.setFont('Times', 'Bold');
      doc.setFontSize(14);
      doc.text('FEDERASI SERIKAT PEKERJA SUKSES (F-SPS)', margin + 28, y + 6);
      doc.setFontSize(12);
      doc.text('PT.NIPPON INDOSARI CORPINDO, TBK. PLANT BANJARMASIN', margin + 28, y + 12);
      doc.setFont('Times', 'Normal');
      doc.setFontSize(9);
      doc.text('No.Pencatatan Disnaker: 500.15.15.1/325/Disnaker/2024', margin + 28, y + 18);
      doc.text('BIZPARK COMMERCIAL ESTATE Blok C2 No. 6 Jl. Gubernur Soebardjo (Lingkar Selatan),', margin + 28, y + 23);
      doc.text('Kayu Bawang, Kec. Gambut Banjar, Kalimantan Selatan', margin + 28, y + 28);

      y += 32;
      // Garis kop (double)
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      doc.line(margin, y + 0.8, pageW - margin, y + 0.8);
      y += 8;

      // ── JUDUL ──
      doc.setFont('Times', 'Bold');
      doc.setFontSize(13);
      doc.text('LAPORAN VALIDASI KUPON PROGRAM', pageW / 2, y, { align: 'center' });
      y += 7;
      doc.setFont('Times', 'Normal');
      doc.setFontSize(10);
      doc.text(`Nomor: ${nomorSurat || '_________________________'}`, pageW / 2, y, { align: 'center' });
      y += 5;
      doc.text(`Periode: ${new Date(startDate).toLocaleDateString('id-ID')} s/d ${new Date(endDate).toLocaleDateString('id-ID')}`, pageW / 2, y, { align: 'center' });
      y += 10;

      // ── TABEL ──
      const colW = [
        usable * 0.05,
        usable * 0.22,
        usable * 0.15,
        usable * 0.23,
        usable * 0.23,
        usable * 0.12,
      ];

      const rows = selectedData.map((row, idx) => [
        (idx + 1).toString(),
        new Date(row.claimed_at).toLocaleString('id-ID'),
        row.nik,
        row.name || row.profiles?.name || '-',
        row.union_programs?.name || '-',
        ((row.coupon_type || row.gate_type || '-') as string).toUpperCase()
      ]);

      autoTable(doc, {
        head: [['NO', 'WAKTU SCAN', 'NIK', 'NAMA KARYAWAN', 'NAMA PROGRAM', 'JENIS']],
        body: rows,
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: usable,
        columnStyles: {
          0: { cellWidth: colW[0], halign: 'center' },
          1: { cellWidth: colW[1], halign: 'center' },
          2: { cellWidth: colW[2], halign: 'left' },
          3: { cellWidth: colW[3], halign: 'left' },
          4: { cellWidth: colW[4], halign: 'left' },
          5: { cellWidth: colW[5], halign: 'center' },
        },
        headStyles: {
          font: 'Times',
          fontStyle: 'bold',
          fontSize: 8,
          fillColor: [200, 200, 200],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
        },
        bodyStyles: {
          font: 'Times',
          fontSize: 8,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
        },
        styles: {
          cellPadding: 2,
        },
        pageBreak: 'auto',
        showHead: 'everyPage',
        didDrawPage: (data) => {
          // Footer setiap halaman
          const pw = doc.internal.pageSize.getWidth();
          doc.setFont('Times', 'Italic');
          doc.setFontSize(7);
          doc.text('Federasi Serikat Pekerja Sukses (F-SPS) - PT. Nippon Indosari Corpindo Tbk Plant Banjarmasin', pw / 2, 290, { align: 'center' });
        },
      });

      // ── TANDA TANGAN ──
      const lastY = (doc as any).lastAutoTable.finalY || y;
      let sigY = lastY + 20;

      // Jika tanda tangan tidak cukup, halaman baru
      if (sigY > 260) {
        doc.addPage();
        sigY = 30;
      }

      doc.setFont('Times', 'Normal');
      doc.setFontSize(10);
      const tgl = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Banjarmasin, ${tgl}`, pageW - margin - 50, sigY);
      doc.text('Panitia Penyelenggara / Admin', pageW - margin - 50, sigY + 5);

      // Garis tanda tangan
      doc.line(pageW - margin - 50, sigY + 18, pageW - margin, sigY + 18);

      doc.save(`Laporan_Kupon_SPS_${startDate}_to_${endDate}.pdf`);
      toast.success('PDF berhasil di download');
    } catch (e: any) {
      toast.error('Gagal download PDF: ' + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const startEditTime = (row: any) => {
    setEditingId(row.id);
    setEditValue(new Date(row.claimed_at).toISOString().slice(0, 19));
  };

  const saveEditTime = async (row: any) => {
    if (!editValue) return;
    try {
      const newDate = new Date(editValue).toISOString();
      const { error } = await supabase
        .from('program_coupons')
        .update({ claimed_at: newDate })
        .eq('id', row.id);
      if (error) throw error;
      setReportData(prev => prev.map(r => r.id === row.id ? { ...r, claimed_at: newDate } : r));
      toast.success('Waktu berhasil diubah');
    } catch (e: any) {
      toast.error('Gagal menyimpan: ' + e.message);
    } finally {
      setEditingId(null);
    }
  };

  const cancelEdit = () => setEditingId(null);

  const handleManualClaim = async () => {
    if (!newRecord.programId || !newRecord.nik || !newRecord.name || !newRecord.claimedAt) {
      toast.error('Harap isi semua field');
      return;
    }
    setAddingData(true);
    try {
      // Cek apakah kupon sudah ada untuk NIK + Program ini
      const { data: existing } = await supabase
        .from('program_coupons')
        .select('id, status')
        .eq('nik', newRecord.nik)
        .eq('program_id', newRecord.programId)
        .maybeSingle();

      let couponId: string | null = existing?.id || null;

      if (!couponId) {
        // Generate kupon baru via RPC
        const { error: genError } = await supabase.rpc('generate_manual_coupon', {
          p_program_id: newRecord.programId,
          p_nik: newRecord.nik,
          p_name: newRecord.name
        });
        if (genError) throw genError;

        // Ambil ID kupon yang baru dibuat
        const { data: newCoupon } = await supabase
          .from('program_coupons')
          .select('id')
          .eq('nik', newRecord.nik)
          .eq('program_id', newRecord.programId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        couponId = newCoupon?.id || null;
        if (!couponId) throw new Error('Gagal menemukan kupon yang baru dibuat');
      }

      // Update status menjadi claimed dengan timestamp kustom
      const { error: updateError } = await supabase
        .from('program_coupons')
        .update({
          status: 'claimed',
          claimed_at: new Date(newRecord.claimedAt).toISOString(),
          gate_type: newRecord.couponType
        })
        .eq('id', couponId);

      if (updateError) throw updateError;

      toast.success('Data scan berhasil ditambahkan');
      setShowAddModal(false);
      setNewRecord(prev => ({
        ...prev,
        programId: '',
        nik: '',
        name: '',
        claimedAt: new Date().toISOString().slice(0, 16),
        couponType: 'attendance'
      }));
      handleFetchData();
    } catch (e: any) {
      toast.error('Gagal menambah data: ' + e.message);
    } finally {
      setAddingData(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER UTAMA (TIDAK TER-PRINT) */}
      <div className="print:hidden">
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Laporan Scan Kupon</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Tarik dan Ekspor riwayat validasi kupon untuk Program Serikat.</p>
      </div>

      {/* KONTROL FILTER (TIDAK TER-PRINT) */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Program Serikat</label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Program</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Mulai Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">No. Surat</label>
            <input
              type="text"
              value={nomorSurat}
              onChange={(e) => setNomorSurat(e.target.value)}
              placeholder="contoh: 001/F-SPS/V/2026"
              className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <button
              onClick={handleFetchData}
              disabled={fetchingData}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
            >
              {fetchingData ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Tarik Data
            </button>
          </div>
        </div>

        {reportData.length > 0 && (
          <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800">
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wider">
              Terpilih <span className="text-blue-600 dark:text-blue-400 font-extrabold">{selectedCount}</span> dari <span className="text-zinc-800 dark:text-zinc-200 font-extrabold">{reportData.length}</span> baris data kupon
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
              >
                <FileSpreadsheet className="w-5 h-5" /> Export Excel
              </button>
              <button
                onClick={downloadPDF}
                disabled={downloading}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {downloading ? 'Mengunduh...' : 'Download PDF'}
              </button>
            </div>
          </div>
        )}

        {/* Tombol Tambah Data Scan Manual */}
        <div className="mt-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
          >
            <Plus className="w-5 h-5" /> Tambah Data Scan
          </button>
        </div>
      </div>

      {/* ─── MODAL TAMBAH DATA SCAN MANUAL ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white">Tambah Data Scan</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Program Serikat</label>
                <select
                  value={newRecord.programId}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, programId: e.target.value }))}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Pilih Program --</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">NIK</label>
                  <input
                    type="text"
                    value={newRecord.nik}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, nik: e.target.value }))}
                    placeholder="1234567890"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Nama Karyawan</label>
                  <input
                    type="text"
                    value={newRecord.name}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nama lengkap"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Waktu Scan</label>
                <input
                  type="datetime-local"
                  value={newRecord.claimedAt}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, claimedAt: e.target.value }))}
                  step="1"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Jenis Kupon</label>
                <select
                  value={newRecord.couponType}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, couponType: e.target.value }))}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="attendance">Attendance</option>
                  <option value="doorprize">Doorprize</option>
                  <option value="sembako">Sembako</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 px-6 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleManualClaim}
                  disabled={addingData}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                >
                  {addingData ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  {addingData ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW TABEL (TIDAK TER-PRINT) */}
      {reportData.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500">Waktu</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500">NIK</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500">Karyawan</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500">Program</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500 text-center">Jenis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {reportData.map((row, i) => {
                  const isChecked = !!selectedIds[row.id];
                  return (
                    <tr key={row.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-opacity ${isChecked ? '' : 'opacity-50 bg-zinc-50/30 dark:bg-zinc-900/30'}`}>
                      <td className="py-3 px-6 text-center w-12">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(row.id)}
                          className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-6 text-sm whitespace-nowrap">
                        {editingId === row.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="datetime-local"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              step="1"
                              className="p-1 border border-blue-400 rounded text-xs w-52"
                              autoFocus
                            />
                            <button onClick={() => saveEditTime(row)} className="text-green-600 hover:text-green-700 font-bold text-xs px-1">✓</button>
                            <button onClick={cancelEdit} className="text-red-500 hover:text-red-600 font-bold text-xs px-1">✕</button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startEditTime(row)}
                            className="cursor-pointer hover:text-blue-600 hover:underline decoration-dotted"
                            title="Klik untuk edit waktu"
                          >
                            {new Date(row.claimed_at).toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-sm font-bold">{row.nik}</td>
                      <td className="py-3 px-6 text-sm">{row.name || row.profiles?.name}</td>
                      <td className="py-3 px-6 text-sm">{row.union_programs?.name}</td>
                      <td className="py-3 px-6 text-sm text-center">
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold rounded-full uppercase">
                          {(row.coupon_type || row.gate_type || '-')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {reportData.length > 10 && (
              <div className="p-4 text-center text-sm font-medium text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30">
                Menampilkan {reportData.length} baris data. Klik waktu untuk edit.
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
