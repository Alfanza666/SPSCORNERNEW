import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  Users, Plus, X, Trash2, Save, Search, Upload, Download,
  Loader2, AlertCircle, CheckCircle2, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { Employee } from '../../../types/employee';

export default function AdminEmployees() {
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nik: '', name: '', department: '', tanggal_masuk: '' });
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: { row: number; name?: string; nik?: string; reason: string }[];
  } | null>(null);

  useEffect(() => {
    if (user) fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ nik: '', name: '', department: '', tanggal_masuk: '' });
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({ nik: emp.nik, name: emp.name, department: emp.department, tanggal_masuk: emp.tanggal_masuk || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nik.trim() || !form.name.trim()) {
      toast.error('NIK dan Nama wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        nik: form.nik.trim(),
        name: form.name.trim(),
        department: form.department.trim(),
      };
      if (form.tanggal_masuk.trim()) payload.tanggal_masuk = form.tanggal_masuk.trim();

      if (editingId) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Data karyawan diperbarui');
      } else {
        const { error } = await supabase.from('employees').insert(payload);
        if (error) {
          if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
            throw new Error('NIK sudah terdaftar');
          }
          throw error;
        }
        toast.success('Karyawan ditambahkan');
      }
      setShowModal(false);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus data karyawan "${name}"?`)) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      toast.success('Data dihapus');
      fetchEmployees();
    } catch (err: any) {
      toast.error('Gagal menghapus: ' + err.message);
    }
  };

  // ── Excel Import ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportReport(null);
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      let imported = 0;
      let skipped = 0;
      const errorsList: { row: number; name?: string; nik?: string; reason: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Excel row numbering starts at 2 for first data row (1-indexed headers)
        
        const rawNik = row.NIK ?? row.Nik ?? row.nik ?? row.NIP ?? row.nip;
        const rawName = row.NAMA ?? row.Nama ?? row.nama ?? row.Name ?? row.name;
        const rawDept = row.DEPARTEMEN ?? row.Departemen ?? row.departemen ?? row.Department ?? row.department ?? row.Divisi ?? row.divisi;
        const rawTgl = row.TANGGAL_MASUK ?? row.Tanggal_Masuk ?? row.tanggal_masuk ?? row.TGL_MASUK ?? row.tgl_masuk ?? row.join_date;

        const nik = rawNik ? rawNik.toString().trim() : '';
        const name = rawName ? rawName.toString().trim() : '';
        const dept = rawDept ? rawDept.toString().trim() : '';
        
        let tgl = '';
        if (rawTgl !== undefined && rawTgl !== null) {
          const trimmedTgl = rawTgl.toString().trim();
          if (trimmedTgl) {
            if (/^\d+(\.\d+)?$/.test(trimmedTgl)) {
              const serial = parseFloat(trimmedTgl);
              const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
              if (!isNaN(dateObj.getTime())) {
                tgl = dateObj.toISOString().split('T')[0];
              } else {
                tgl = trimmedTgl;
              }
            } else {
              const dmy = trimmedTgl.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
              if (dmy) {
                tgl = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
              } else {
                tgl = trimmedTgl;
              }
            }
          }
        }

        if (!nik || !name) {
          skipped++;
          errorsList.push({
            row: rowNum,
            nik: nik || undefined,
            name: name || undefined,
            reason: `Kolom NIK atau NAMA kosong (NIK: "${nik || ''}", NAMA: "${name || ''}")`
          });
          continue;
        }

        const payload: any = { nik, name, department: dept };
        if (tgl) payload.tanggal_masuk = tgl;

        const { error: upsertError } = await supabase.from('employees').upsert(
          payload,
          { onConflict: 'nik', ignoreDuplicates: false }
        );

        if (upsertError) {
          if (tgl && (
            upsertError.message?.toLowerCase().includes('column') ||
            upsertError.message?.toLowerCase().includes('date') ||
            upsertError.message?.toLowerCase().includes('invalid input syntax') ||
            upsertError.message?.toLowerCase().includes('tanggal_masuk')
          )) {
            delete payload.tanggal_masuk;
            const { error: retryError } = await supabase.from('employees').upsert(
              payload,
              { onConflict: 'nik', ignoreDuplicates: false }
            );
            if (retryError) {
              skipped++;
              errorsList.push({
                row: rowNum,
                nik,
                name,
                reason: `Gagal menyimpan (dengan/tanpa tanggal): ${retryError.message}`
              });
              continue;
            }
          } else {
            skipped++;
            errorsList.push({
              row: rowNum,
              nik,
              name,
              reason: `Gagal menyimpan ke database: ${upsertError.message}`
            });
            continue;
          }
        }
        imported++;
      }

      setImportReport({
        total: rows.length,
        success: imported,
        failed: skipped,
        errors: errorsList
      });

      if (skipped > 0) {
        toast.error(`Import selesai dengan ${skipped} data dilewati.`);
      } else {
        toast.success(`Import berhasil: ${imported} karyawan ditambahkan.`);
      }
      fetchEmployees();
    } catch (err: any) {
      toast.error('Gagal import: ' + (err.message || 'Format file tidak sesuai'));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Download Template ──
  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['NIK', 'NAMA', 'DEPARTEMEN', 'TANGGAL_MASUK'],
        ['12345', 'Budi Santoso', 'IT', '2024-01-15'],
        ['67890', 'Siti Aminah', 'HRD', '2023-06-01'],
      ]);
      ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Karyawan');
      XLSX.writeFile(wb, 'template_karyawan.xlsx');
      toast.success('Template diunduh');
    } catch {
      toast.error('Gagal mengunduh template');
    }
  };

  const filtered = employees.filter(e =>
    e.nik.toLowerCase().includes(search.toLowerCase()) ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase()) ||
    (e.tanggal_masuk || '').includes(search)
  );

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-8 text-center font-bold text-red-500">Akses Ditolak</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Database Karyawan
            </h1>
            <p className="text-zinc-500 font-medium mt-1">
              {employees.length} karyawan terdaftar
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={downloadTemplate} className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 font-bold text-sm flex items-center gap-2 hover:bg-white dark:hover:bg-zinc-800 transition-colors">
              <Download className="w-4 h-4" /> Template
            </button>
            <label className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 font-bold text-sm flex items-center gap-2 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" /> {importing ? 'Mengimpor...' : 'Import Excel'}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
            <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95">
              <Plus className="w-4 h-4" /> Tambah
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari NIK, nama, atau departemen..."
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:border-blue-500 outline-none transition-colors"
          />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <Users className="w-16 h-16 text-zinc-200 dark:text-zinc-800 mx-auto mb-3" />
              <p className="font-bold text-zinc-500">{search ? 'Tidak ditemukan' : 'Belum ada data karyawan'}</p>
              {!search && (
                <button onClick={openAdd} className="mt-4 text-sm font-bold text-blue-600 hover:underline">Tambah data pertama</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <th className="text-left px-5 py-4 font-bold text-zinc-500 text-xs uppercase tracking-wider">NIK</th>
                    <th className="text-left px-5 py-4 font-bold text-zinc-500 text-xs uppercase tracking-wider">Nama</th>
                    <th className="text-left px-5 py-4 font-bold text-zinc-500 text-xs uppercase tracking-wider">Departemen</th>
                    <th className="text-left px-5 py-4 font-bold text-zinc-500 text-xs uppercase tracking-wider">Tgl Masuk</th>
                    <th className="text-right px-5 py-4 font-bold text-zinc-500 text-xs uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr key={emp.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-zinc-800 dark:text-zinc-200">{emp.nik}</td>
                      <td className="px-5 py-4 font-medium text-zinc-800 dark:text-zinc-200">{emp.name}</td>
                      <td className="px-5 py-4">
                        <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold">
                          {emp.department || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-zinc-500 font-mono">
                        {emp.tanggal_masuk || '-'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => openEdit(emp)} className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(emp.id, emp.name)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="px-5 py-3 text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
                Menampilkan {filtered.length} dari {employees.length} karyawan
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">
                  {editingId ? 'Edit Karyawan' : 'Tambah Karyawan'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1.5 block">NIK *</label>
                  <input
                    type="text"
                    value={form.nik}
                    onChange={(e) => setForm({ ...form, nik: e.target.value })}
                    className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
                    placeholder="12345"
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1.5 block">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
                    placeholder="Budi Santoso"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1.5 block">Departemen</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
                    placeholder="IT, HRD, Marketing, ..."
                    list="dept-list"
                  />
                  <datalist id="dept-list">
                    {[...new Set(employees.map(e => e.department).filter(Boolean))].map(d => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1.5 block">Tanggal Masuk</label>
                  <input
                    type="date"
                    value={form.tanggal_masuk}
                    onChange={(e) => setForm({ ...form, tanggal_masuk: e.target.value })}
                    className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  Batal
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Report Modal */}
      <AnimatePresence>
        {importReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setImportReport(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
                  Laporan Hasil Import
                </h2>
                <button onClick={() => setImportReport(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 flex-shrink-0 text-center">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs font-bold text-zinc-400 uppercase">Total Data</div>
                  <div className="text-2xl font-black text-zinc-800 dark:text-zinc-100 mt-1">{importReport.total}</div>
                </div>
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/30">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Berhasil</div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{importReport.success}</div>
                </div>
                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl border border-rose-100/30">
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">Dilewati</div>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{importReport.failed}</div>
                </div>
              </div>

              {importReport.errors.length > 0 && (
                <div className="flex-1 overflow-y-auto min-h-0 mb-6 pr-1 space-y-2.5">
                  <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    Detail Baris Yang Dilewati / Bermasalah:
                  </h3>
                  <div className="space-y-2.5">
                    {importReport.errors.map((err, idx) => (
                      <div key={idx} className="p-3 bg-rose-50/30 dark:bg-rose-950/5 border border-rose-100/20 rounded-xl text-xs flex flex-col md:flex-row md:items-start justify-between gap-2">
                        <div>
                          <span className="font-mono bg-rose-100/60 dark:bg-rose-950/30 px-2 py-0.5 rounded text-rose-700 dark:text-rose-300 font-bold mr-2">
                            Baris {err.row}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                            {err.reason}
                          </span>
                        </div>
                        {(err.nik || err.name) && (
                          <div className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px] md:text-right flex-shrink-0">
                            {err.nik && `NIK: ${err.nik}`}
                            {err.nik && err.name && ' | '}
                            {err.name && `Nama: ${err.name}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end flex-shrink-0 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button onClick={() => setImportReport(null)} className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-sm rounded-xl hover:opacity-90 transition-opacity">
                  Tutup Laporan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
