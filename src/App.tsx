import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Trash2, Loader2, ListPlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface FormField {
  id: number;
  label: string;
  type: 'text' | 'select' | 'number';
  options: string;
  required: boolean;
}

export default function AdminUnionPrograms() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    program_type: 'gathering',
    start_date: '',
    end_date: '',
    is_active: true,
    is_targeted: false,
  });

  const [formConfig, setFormConfig] = useState<FormField[]>([]);
  const [targetNiks, setTargetNiks] = useState('');

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('union_programs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setPrograms(data);
    } catch (error) {
      toast.error('Gagal memuat program');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', program_type: 'gathering',
      start_date: '', end_date: '', is_active: true, is_targeted: false
    });
    setFormConfig([]);
    setTargetNiks('');
    setIsModalOpen(false);
  };

  // --- LOGIKA FORM BUILDER ---
  const addQuestion = () => {
    setFormConfig([...formConfig, { id: Date.now(), label: '', type: 'text', options: '', required: true }]);
  };

  const updateQuestion = (id: number, key: string, value: any) => {
    setFormConfig(formConfig.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeQuestion = (id: number) => {
    setFormConfig(formConfig.filter(f => f.id !== id));
  };
  // ---------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Simpan Program Beserta Konfigurasi Form-nya
      const { data: newProgram, error: progError } = await supabase
        .from('union_programs')
        .insert([{
          ...formData,
          form_config: formConfig
        }])
        .select()
        .single();

      if (progError) throw progError;

      // 2. Jika Program Targeted (Misal Kurban), Simpan NIK yang berhak
      if (formData.is_targeted && targetNiks.trim() !== '') {
        const nikArray = targetNiks.split(',').map(nik => nik.trim()).filter(nik => nik.length > 0);
        const eligibilityData = nikArray.map(nik => ({
          program_id: newProgram.id,
          nik: nik
        }));

        if (eligibilityData.length > 0) {
          const { error: eligError } = await supabase.from('program_eligibility').insert(eligibilityData);
          if (eligError) throw eligError;
        }
      }

      toast.success('Program & Formulir berhasil dibuat!');
      resetForm();
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan program');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Manajemen Program</h1>
          <p className="text-sm text-zinc-500">Buat program dan desain formulir pendaftaran.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2">
          <Plus className="w-5 h-5" /> Buat Program Baru
        </button>
      </div>

      {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /> : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-950 text-xs uppercase font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4">Nama Program</th>
                  <th className="px-6 py-4">Tipe</th>
                  <th className="px-6 py-4">Targeting</th>
                  <th className="px-6 py-4">Pertanyaan Form</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {programs.map((prog) => (
                  <tr key={prog.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-6 py-4 font-bold text-blue-600">{prog.name}</td>
                    <td className="px-6 py-4 uppercase text-xs font-bold">{prog.program_type}</td>
                    <td className="px-6 py-4">
                      {prog.is_targeted ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-bold">Khusus NIK</span> : <span className="text-zinc-500 text-xs">Umum</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{prog.form_config?.length || 0} Pertanyaan</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${prog.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {prog.is_active ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL PEMBUATAN PROGRAM & FORMULIR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <h2 className="font-black text-xl">Buat Program Baru</h2>
              <button onClick={resetForm} className="text-zinc-400 hover:text-red-500 font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Info Dasar Program */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1">Nama Program</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 border rounded-xl dark:bg-zinc-950 dark:border-zinc-800 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1">Deskripsi</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full p-3 border rounded-xl dark:bg-zinc-950 dark:border-zinc-800 text-sm" rows={2} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Tanggal Mulai</label>
                  <input type="date" required value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full p-3 border rounded-xl dark:bg-zinc-950 dark:border-zinc-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Tanggal Selesai</label>
                  <input type="date" required value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full p-3 border rounded-xl dark:bg-zinc-950 dark:border-zinc-800 text-sm" />
                </div>
              </div>

              {/* Targeting NIK */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 rounded-xl space-y-3">
                <label className="flex items-center gap-2 font-bold text-sm text-purple-900 dark:text-purple-100 cursor-pointer">
                  <input type="checkbox" checked={formData.is_targeted} onChange={e => setFormData({ ...formData, is_targeted: e.target.checked })} className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500" />
                  Program Khusus (Target NIK Tertentu)
                </label>
                {formData.is_targeted && (
                  <div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">Masukkan NIK Karyawan yang berhak (pisahkan dengan koma). Contoh: 1011, 1012, 1013</p>
                    <textarea
                      value={targetNiks} onChange={e => setTargetNiks(e.target.value)}
                      placeholder="1011, 1012, 1013..."
                      className="w-full p-3 border rounded-xl dark:bg-zinc-950 dark:border-purple-800/50 text-sm" rows={3}
                    />
                  </div>
                )}
              </div>

              {/* FORM BUILDER */}
              <div className="p-5 bg-zinc-50 dark:bg-zinc-800/30 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2"><ListPlus className="w-5 h-5 text-blue-500" /> Desain Formulir Kustom</h3>
                    <p className="text-xs text-zinc-500 mt-1">Buat pertanyaan spesifik untuk diisi karyawan.</p>
                  </div>
                  <button type="button" onClick={addQuestion} className="text-xs bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-xl font-bold hover:opacity-80 transition-opacity">
                    + Tambah Pertanyaan
                  </button>
                </div>

                <div className="space-y-3">
                  {formConfig.map((field, idx) => (
                    <div key={field.id} className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full font-black text-xs shrink-0 mt-1.5">
                          {idx + 1}
                        </div>
                        <input placeholder="Tulis Pertanyaan (Misal: Ukuran Baju)" value={field.label} onChange={(e) => updateQuestion(field.id, 'label', e.target.value)} className="flex-1 p-2 border rounded-lg text-sm dark:bg-zinc-950 dark:border-zinc-800" required />
                        <select value={field.type} onChange={(e) => updateQuestion(field.id, 'type', e.target.value)} className="p-2 border rounded-lg text-sm dark:bg-zinc-950 dark:border-zinc-800 w-full sm:w-40 shrink-0">
                          <option value="text">Teks Singkat</option>
                          <option value="select">Pilihan Ganda</option>
                          <option value="number">Angka</option>
                        </select>
                        <button type="button" onClick={() => removeQuestion(field.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0 flex items-center justify-center">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      {field.type === 'select' && (
                        <div className="mt-3 ml-0 sm:ml-9">
                          <input placeholder="Masukkan opsi pilihan, pisahkan dengan koma (Contoh: S, M, L, XL)" value={field.options} onChange={(e) => updateQuestion(field.id, 'options', e.target.value)} className="w-full p-2 border border-blue-200 dark:border-blue-800 rounded-lg text-xs bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 placeholder-blue-300 dark:placeholder-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 mt-6">
                <button type="submit" disabled={saving} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Simpan Program & Formulir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}