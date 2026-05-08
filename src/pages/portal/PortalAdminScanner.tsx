import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { CheckCircle, XCircle, Download, ArrowLeft, Loader2, Search } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { exportExcel } from '../../lib/utils';
import { format } from 'date-fns';

export default function PortalAdminScanner() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'superadmin' || user?.role === 'admin') {
      fetchPrograms();
    }
  }, [user]);

  useEffect(() => {
    if (selectedProgram) {
      fetchAttendance();
    }
  }, [selectedProgram]);

  useEffect(() => {
    // Only initialize scanner if admin and a program is selected
    if ((user?.role === 'superadmin' || user?.role === 'admin') && selectedProgram) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [selectedProgram]);

  const fetchPrograms = async () => {
    try {
      const { data } = await supabase
        .from('union_programs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data) setPrograms(data);
    } catch (error) {
      console.error('Error fetching programs:', error);
    }
  };

  const fetchAttendance = async () => {
    if (!selectedProgram) return;
    try {
      const { data } = await supabase
        .from('program_registrations')
        .select('*, profiles(name, nik)')
        .eq('program_id', selectedProgram);

      if (data) setAttendanceData(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (loading) return; // Prevent multiple scans at once

    setLoading(true);
    try {
      // Find the registration by ID (which is the decoded text)
      const { data: reg, error: fetchErr } = await supabase
        .from('program_registrations')
        .select('*, profiles(name, nik)')
        .eq('id', decodedText)
        .single();

      if (fetchErr || !reg) {
        toast.error('Data QR tidak valid atau tidak ditemukan');
        setLoading(false);
        return;
      }

      if (reg.program_id !== selectedProgram) {
        toast.error('QR Code ini bukan untuk program yang sedang dipilih');
        setLoading(false);
        return;
      }

      // Check if already attended
      if (reg.is_attended && reg.is_snack_claimed) {
        toast.error(`Anggota ${reg.profiles?.name} sudah diproses sebelumnya!`);
        setScanResult({ ...reg, status: 'already_processed' });
        setLoading(false);
        return;
      }

      // Update attendance status
      const { error: updateErr } = await supabase
        .from('program_registrations')
        .update({
          is_attended: true,
          is_snack_claimed: true,
          status: 'hadir' // optional legacy column
        })
        .eq('id', reg.id);

      if (updateErr) throw updateErr;

      toast.success(`Berhasil! ${reg.profiles?.name} tercatat.`);
      setScanResult({ ...reg, status: 'success' });
      fetchAttendance(); // refresh table

      // Auto clear result after 3 seconds
      setTimeout(() => setScanResult(null), 3000);

    } catch (error: any) {
      console.error('Scan Error:', error);
      toast.error('Terjadi kesalahan saat memproses QR');
    } finally {
      setLoading(false);
    }
  };

  const onScanFailure = (error: any) => {
    // ignore recurring errors from missing frame
  };

  const handleExport = () => {
    if (attendanceData.length === 0) {
      toast.error('Belum ada data absensi');
      return;
    }

    const headers = ['No', 'NIK', 'Nama Anggota', 'Kode Kupon', 'Kehadiran', 'Snack/Klaim', 'Waktu Daftar'];
    const rows = attendanceData.map((row, index) => [
      index + 1,
      row.profiles?.nik || '-',
      row.profiles?.name || '-',
      row.kupon_code || '-',
      row.is_attended ? 'Hadir' : 'Tidak Hadir',
      row.is_snack_claimed ? 'Sudah Klaim' : 'Belum Klaim',
      format(new Date(row.created_at), 'dd-MM-yyyy HH:mm')
    ]);

    const progName = programs.find(p => p.id === selectedProgram)?.name || 'Program';
    exportExcel(headers, rows, `Kehadiran_${progName.replace(/\s+/g, '_')}`, 'Data');
    toast.success('Data berhasil diekspor');
  };

  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    return <Navigate to="/portal" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30 flex items-center justify-between">
        <button
          onClick={() => navigate('/portal')}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="text-lg font-black text-zinc-900 dark:text-white">Admin Scanner</h1>
        <div className="w-9" /> {/* spacer */}
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">

        {/* Program Selection */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            Pilih Program untuk di-Scan
          </label>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full p-3 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">-- Pilih Program Aktif --</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {selectedProgram && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Scanner Container */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-500" />
                Scan QR Peserta
              </h3>

              <div className="rounded-xl overflow-hidden bg-black/5">
                <div id="reader" className="w-full" />
              </div>

              {/* Scan Result Overlay/Message */}
              {scanResult && (
                <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${
                  scanResult.status === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {scanResult.status === 'success' ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircle className="w-6 h-6 text-amber-500" />
                  )}
                  <div>
                    <p className="font-bold">{scanResult.profiles?.name}</p>
                    <p className="text-xs opacity-80">{scanResult.profiles?.nik}</p>
                    <p className="text-xs font-medium mt-1">
                      {scanResult.status === 'success' ? 'Berhasil diproses!' : 'Sudah pernah discan.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Attendance List */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-col h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Data Kehadiran</h3>
                <button
                  onClick={handleExport}
                  className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-sm font-bold"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {attendanceData.length === 0 ? (
                  <div className="text-center py-10 text-zinc-400 text-sm">
                    Belum ada data partisipan
                  </div>
                ) : (
                  attendanceData.map((item) => (
                    <div key={item.id} className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-white line-clamp-1">{item.profiles?.name}</p>
                        <p className="text-xs text-zinc-500">{item.profiles?.nik}</p>
                      </div>
                      <div className="flex gap-1">
                        {item.is_attended ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">Hadir</span>
                        ) : (
                          <span className="px-2 py-1 bg-zinc-100 text-zinc-500 rounded-lg text-xs font-bold">Belum</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
