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
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const nik = (row.NIK || row.Nik || row.nik || row.NIP || row.nip || '').toString().trim();
        const name = (row.NAMA || row.Nama || row.nama || row.Name || row.name || '').toString().trim();
        const dept = (row.DEPARTEMEN || row.Departemen || row.departemen || row.Department || row.department || row.Divisi || row.divisi || '').toString().trim();
        const tgl = (row.TANGGAL_MASUK || row.Tanggal_Masuk || row.tanggal_masuk || row.TGL_MASUK || row.tgl_masuk || row.join_date || '').toString().trim();

        if (!nik || !name) { skipped++; continue; }

        const payload: any = { nik, name, department: dept };
        if (tgl) payload.tanggal_masuk = tgl;
        const { error } = await supabase.from('employees').upsert(
          payload,
          { onConflict: 'nik', ignoreDuplicates: false }
        );
        if (error) { skipped++; continue; }
        imported++;
      }

      toast.success(`Import selesai: ${imported} ditambahkan, ${skipped} dilewati`);
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
    </div>
  );
}
