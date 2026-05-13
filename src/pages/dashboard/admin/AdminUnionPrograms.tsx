import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Edit2, Trash2, Loader2, ListPlus, Users } from 'lucide-react';
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
  const [targetNiks, setTargetNiks] = useState(''); // Comma separated NIKs

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
          <Plus className="w-5 h-5"/> Buat Program Baru
        </button>
      </div>

      {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600"/> : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
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
                <tr key={prog.id}>
                  <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-white">{prog.name}</td>
                  <td className="px-6 py-4 capitalize text-zinc-600 dark:text-zinc-400">{prog.program_type}</td>
                  <td className="px-6 py-4">
                    {prog.is_targeted ? (
                      <span className="flex items-center gap-1 text-orange-600 font-semibold text-xs">
                        <Users className="w-3 h-3" /> Targeted
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-xs">Umum</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {Array.isArray(prog.form_config) ? prog.form_config.length : 0} pertanyaan
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${prog.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {prog.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                </tr>
              ))}
              {programs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">
                    Belum ada program. Buat program pertama Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== MODAL BUAT PROGRAM ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-black text-zinc-900 dark:text-white">Buat Program Baru</h2>
              <button
                onClick={resetForm}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
              {/* Info Dasar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Nama Program *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contoh: Program Kurban 2025"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Deskripsi</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Deskripsi singkat program..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Tipe Program</label>
                  <select
                    value={formData.program_type}
                    onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gathering">Gathering</option>
                    <option value="kurban">Kurban</option>
                    <option value="bantuan">Bantuan</option>
                    <option value="pelatihan">Pelatihan</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="is_active" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Program Aktif
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_targeted"
                    checked={formData.is_targeted}
                    onChange={e => setFormData({ ...formData, is_targeted: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="is_targeted" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Program Targeted (NIK Tertentu)
                  </label>
                </div>
              </div>

              {/* Target NIK */}
              {formData.is_targeted && (
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> NIK yang Berhak (pisahkan dengan koma)
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={targetNiks}
                    onChange={e => setTargetNiks(e.target.value)}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1234567890, 0987654321, ..."
                  />
                </div>
              )}

              {/* Form Builder */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <ListPlus className="w-4 h-4" /> Pertanyaan Formulir Pendaftaran
                  </h3>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Tambah Pertanyaan
                  </button>
                </div>
                {formConfig.length === 0 && (
                  <p className="text-xs text-zinc-400 text-center py-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
                    Tidak ada pertanyaan. Klik "Tambah Pertanyaan" untuk mulai membangun formulir.
                  </p>
                )}
                <div className="space-y-3">
                  {formConfig.map((field, index) => (
                    <div key={field.id} className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-400">Pertanyaan #{index + 1}</span>
                        <button type="button" onClick={() => removeQuestion(field.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Label pertanyaan..."
                        value={field.label}
                        onChange={e => updateQuestion(field.id, 'label', e.target.value)}
                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <select
                          value={field.type}
                          onChange={e => updateQuestion(field.id, 'type', e.target.value)}
                          className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="text">Teks</option>
                          <option value="number">Angka</option>
                          <option value="select">Pilihan Ganda</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-zinc-500">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={e => updateQuestion(field.id, 'required', e.target.checked)}
                            className="w-3 h-3"
                          />
                          Wajib
                        </label>
                      </div>
                      {field.type === 'select' && (
                        <input
                          type="text"
                          placeholder="Opsi pilihan, pisah dengan koma (Ya, Tidak, ...)"
                          value={field.options}
                          onChange={e => updateQuestion(field.id, 'options', e.target.value)}
                          className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 py-2.5 rounded-xl font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Menyimpan...' : 'Simpan Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
