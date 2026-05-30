import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Printer, Search, FileSpreadsheet, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function AdminCouponReports() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [nomorSurat, setNomorSurat] = useState<string>('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    fetchPrograms();
    // Default rentang hari ini
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
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
    if (reportData.length === 0) {
      toast.error('Tarik data terlebih dahulu');
      return;
    }

    const excelData = reportData.map((row, index) => ({
      No: index + 1,
      'Waktu Scan': new Date(row.claimed_at).toLocaleString('id-ID'),
      'Program': row.union_programs?.name || '-',
      'NIK': row.nik,
      'Nama Karyawan': row.name || row.profiles?.name || '-',
      'Jenis Kupon': row.coupon_type.toUpperCase()
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    if (nomorSurat) XLSX.utils.sheet_add_aoa(ws, [[`Nomor Surat: ${nomorSurat}`]], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Scan Kupon");
    XLSX.writeFile(wb, `Laporan_Kupon_SPS_${startDate}_to_${endDate}.xlsx`);
  };

  const printPDF = () => {
    if (reportData.length === 0) {
      toast.error('Tarik data terlebih dahulu');
      return;
    }
    window.print();
  };

  const startEditTime = (row: any) => {
    setEditingId(row.id);
    setEditValue(new Date(row.claimed_at).toISOString().slice(0, 16));
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
          <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
            >
              <FileSpreadsheet className="w-5 h-5" /> Export Excel
            </button>
            <button
              onClick={printPDF}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
            >
              <Printer className="w-5 h-5" /> Cetak PDF Resmi
            </button>
          </div>
        )}
      </div>

      {/* PREVIEW TABEL (TIDAK TER-PRINT) */}
      {reportData.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500">Waktu</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500">NIK</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500">Karyawan</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500">Program</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-zinc-500 text-center">Jenis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {reportData.map((row, i) => (
                  <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                    <td className="py-3 px-6 text-sm whitespace-nowrap">
                      {editingId === row.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="datetime-local"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="p-1 border border-blue-400 rounded text-xs w-44"
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
                        {row.coupon_type}
                      </span>
                    </td>
                  </tr>
                ))}
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/* AREA KHUSUS PRINT PDF BER-KOP SURAT (HANYA MUNCUL SAAT PRINT)*/}
      {/* ──────────────────────────────────────────────────────────── */}
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 15mm;
            }
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            /* Hilangkan shadow & warna background khusus print */
            * {
              background: transparent !important;
              color: black !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }
          }
        `}
      </style>

      {reportData.length > 0 && (
        <div className="print-area hidden print:block bg-white text-black p-0 w-full font-serif leading-tight">
          {/* KOP SURAT */}
          <div className="flex items-center gap-6 mb-2 border-b-4 border-double border-black pb-4">
            <img 
              src="/logos/serikat-logo.png" 
              alt="Logo Serikat" 
              className="w-24 h-24 object-contain"
              crossOrigin="anonymous" 
            />
            <div className="flex-1">
              <h1 className="text-[20px] font-bold leading-tight">FEDERASI SERIKAT PEKERJA SUKSES (F-SPS)</h1>
              <h2 className="text-[16px] font-bold leading-tight">PT.NIPPON INDOSARI CORPINDO, TBK. PLANT BANJARMASIN</h2>
              <p className="text-[12px] leading-tight mt-1">No.Pencatatan Disnaker: 500.15.15.1/325/Disnaker/2024</p>
              <p className="text-[12px] leading-tight">BIZPARK COMMERCIAL ESTATE Blok C2 No. 6 Jl. Gubernur Soebardjo (Lingkar Selatan),</p>
              <p className="text-[12px] leading-tight">Kayu Bawang, Kec. Gambut Banjar, Kalimantan Selatan</p>
            </div>
          </div>
          
          <div className="text-center my-6">
            <h3 className="text-[16px] font-bold uppercase underline">Laporan Validasi Kupon Program</h3>
            <p className="text-[12px] mt-2">
              Nomor: {nomorSurat || '_________________________'}
            </p>
            <p className="text-[12px] mt-1">
              Periode: {new Date(startDate).toLocaleDateString('id-ID')} s/d {new Date(endDate).toLocaleDateString('id-ID')}
            </p>
          </div>

          {/* TABEL DATA PADA PDF */}
          <table className="w-full border-collapse border border-black text-[11px] mb-10">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 font-bold text-center">NO</th>
                <th className="border border-black p-2 font-bold text-center">WAKTU SCAN</th>
                <th className="border border-black p-2 font-bold text-left">NIK</th>
                <th className="border border-black p-2 font-bold text-left">NAMA KARYAWAN</th>
                <th className="border border-black p-2 font-bold text-left">NAMA PROGRAM</th>
                <th className="border border-black p-2 font-bold text-center">JENIS</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-2 text-center">{idx + 1}</td>
                  <td className="border border-black p-2 text-center">{new Date(row.claimed_at).toLocaleString('id-ID')}</td>
                  <td className="border border-black p-2 text-left">{row.nik}</td>
                  <td className="border border-black p-2 text-left">{row.name || row.profiles?.name}</td>
                  <td className="border border-black p-2 text-left">{row.union_programs?.name}</td>
                  <td className="border border-black p-2 text-center uppercase">{row.coupon_type}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* KOLOM TANDA TANGAN */}
          <div className="flex justify-end mt-12 mb-20 text-[12px]">
            <div className="text-center w-64">
              <p>Banjarmasin, {new Date().toLocaleDateString('id-ID')}</p>
              <p className="mb-16">Panitia Penyelenggara / Admin</p>
              <p className="font-bold underline">( ............................................. )</p>
            </div>
          </div>

          {/* FOOTER PDF */}
          <div className="mt-8 pt-4 text-[10px] italic border-t border-gray-300">
            <p className="font-bold">Federasi Serikat Pekerja Sukses (F-SPS)</p>
            <p>PT. Nippon Indosari Corpindo Tbk Plant Banjarmasin - Harmonis.bjm@sariroti.com</p>
          </div>

        </div>
      )}
    </div>
  );
}
