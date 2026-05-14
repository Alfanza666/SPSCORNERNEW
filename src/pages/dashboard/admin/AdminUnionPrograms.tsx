import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Edit2, Trash2, Loader2, ListPlus, Users, Upload, FileText, X, GripVertical, Copy, Settings, Eye, Check, ChevronDown, ChevronUp, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface FormField {
  id: number;
  label: string;
  type: 'text' | 'select' | 'number' | 'textarea' | 'checkbox' | 'date' | 'time';
  options: string;
  required: boolean;
  placeholder: string;
  help_text: string;
}

export default function AdminUnionPrograms() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showEligibility, setShowEligibility] = useState(false);

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
  const [uploadedEligibleCount, setUploadedEligibleCount] = useState(0);
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPrograms();
    if (formData.is_targeted) {
      fetchEligibleUsers();
    }
  }, [formData.is_targeted]);

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

  const fetchEligibleUsers = async () => {
    try {
      const { data } = await supabase.from('profiles').select('nik, name').not('nik', 'is', null);
      if (data) setEligibleUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', program_type: 'gathering',
      start_date: '', end_date: '', is_active: true, is_targeted: false
    });
    setFormConfig([]);
    setTargetNiks('');
    setUploadedEligibleCount(0);
    setIsModalOpen(false);
    setEditingProgram(null);
    setShowFormBuilder(false);
    setShowEligibility(false);
  };

  const openEditModal = (program: any) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      description: program.description || '',
      program_type: program.program_type || 'gathering',
      start_date: program.start_date || '',
      end_date: program.end_date || '',
      is_active: program.is_active,
      is_targeted: program.is_targeted,
    });
    setFormConfig(program.form_config || []);
    setIsModalOpen(true);
    setShowFormBuilder(true);
    if (program.is_targeted) {
      setShowEligibility(true);
      fetchProgramEligibility(program.id);
    }
  };

  const [programEligibleNiks, setProgramEligibleNiks] = useState<string[]>([]);
  const fetchProgramEligibility = async (programId: string) => {
    try {
      const { data } = await supabase.from('program_eligibility').select('nik').eq('program_id', programId);
      if (data) setProgramEligibleNiks(data.map(d => d.nik));
    } catch (error) {
      console.error('Error fetching eligibility:', error);
    }
  };

  const addQuestion = () => {
    const newField: FormField = {
      id: Date.now(),
      label: '',
      type: 'text',
      options: '',
      required: true,
      placeholder: '',
      help_text: ''
    };
    setFormConfig([...formConfig, newField]);
  };

  const duplicateQuestion = (field: FormField) => {
    const duplicate = { ...field, id: Date.now(), label: field.label + ' (Salinan)' };
    const index = formConfig.findIndex(f => f.id === field.id);
    const newConfig = [...formConfig];
    newConfig.splice(index + 1, 0, duplicate);
    setFormConfig(newConfig);
  };

  const updateQuestion = (id: number, key: string, value: any) => {
    setFormConfig(formConfig.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeQuestion = (id: number) => {
    setFormConfig(formConfig.filter(f => f.id !== id));
  };

  const moveQuestion = (id: number, direction: 'up' | 'down') => {
    const index = formConfig.findIndex(f => f.id === id);
    if (direction === 'up' && index > 0) {
      const newConfig = [...formConfig];
      [newConfig[index - 1], newConfig[index]] = [newConfig[index], newConfig[index - 1]];
      setFormConfig(newConfig);
    } else if (direction === 'down' && index < formConfig.length - 1) {
      const newConfig = [...formConfig];
      [newConfig[index], newConfig[index + 1]] = [newConfig[index + 1], newConfig[index]];
      setFormConfig(newConfig);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error('Format file harus .xlsx, .xls, atau .csv');
      return;
    }

    try {
      toast.loading('Memproses file...');
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('File terlalu pendek atau tidak valid');
        return;
      }

      const header = lines[0].toLowerCase();
      let nikIndex = header.includes('nik') ? 0 : -1;
      
      if (nikIndex === -1) {
        toast.error('Kolom NIK tidak ditemukan. Pastikan file memiliki kolom NIK.');
        return;
      }

      const niks = lines.slice(1).map(line => {
        const cols = line.split(/[,\t;]/);
        return cols[nikIndex]?.trim();
      }).filter(nik => nik && nik.length >= 5);

      setTargetNiks(niks.join(', '));
      setUploadedEligibleCount(niks.length);
      toast.success(`Berhasil导入 ${niks.length} NIK dari file`);
    } catch (error: any) {
      toast.error('Gagal membaca file: ' + error.message);
    }
  };

  const downloadTemplate = () => {
    const template = 'NIK\n1234567890\n0987654321';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_nik_program.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const programData = {
        ...formData,
        form_config: formConfig
      };

      let programId;

      if (editingProgram) {
        const { data, error } = await supabase
          .from('union_programs')
          .update(programData)
          .eq('id', editingProgram.id)
          .select()
          .single();
        if (error) throw error;
        programId = editingProgram.id;
        toast.success('Program berhasil diperbarui');
      } else {
        const { data, error } = await supabase
          .from('union_programs')
          .insert([programData])
          .select()
          .single();
        if (error) throw error;
        programId = data.id;
        toast.success('Program berhasil dibuat');
      }

      if (formData.is_targeted && targetNiks.trim()) {
        await supabase.from('program_eligibility').delete().eq('program_id', programId);
        
        const nikArray = targetNiks.split(/[,\n]/).map(nik => nik.trim()).filter(nik => nik.length >= 5);
        const eligibilityData = nikArray.map(nik => ({
          program_id: programId,
          nik: nik
        }));

        if (eligibilityData.length > 0) {
          const { error: eligError } = await supabase.from('program_eligibility').insert(eligibilityData);
          if (eligError) throw eligError;
        }
      }

      resetForm();
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan program');
    } finally {
      setSaving(false);
    }
  };

  const toggleProgramStatus = async (program: any) => {
    try {
      const { error } = await supabase
        .from('union_programs')
        .update({ is_active: !program.is_active })
        .eq('id', program.id);
      if (error) throw error;
      toast.success(`Program ${!program.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchPrograms();
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('Yakin hapus program ini?')) return;
    try {
      await supabase.from('program_eligibility').delete().eq('program_id', id);
      const { error } = await supabase.from('union_programs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Program dihapus');
      fetchPrograms();
    } catch (error) {
      toast.error('Gagal menghapus program');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">Manajemen Program Serikat</h1>
          <p className="text-sm text-zinc-500">Buat program dan desain formulir pendaftaran</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-5 h-5" /> 
          <span className="hidden sm:inline">Buat Program Baru</span>
          <span className="sm:hidden">Baru</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid gap-4">
          {programs.map((prog) => (
            <motion.div
              key={prog.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    prog.is_targeted ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">{prog.name}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">{prog.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium rounded-full capitalize">{prog.program_type}</span>
                      {prog.is_targeted && (
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium rounded-full flex items-center gap-1">
                          <Users className="w-3 h-3" /> Targeted
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium rounded-full">
                        {Array.isArray(prog.form_config) ? prog.form_config.length : 0} pertanyaan
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleProgramStatus(prog)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      prog.is_active 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {prog.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                  <button
                    onClick={() => openEditModal(prog)}
                    className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteProgram(prog.id)}
                    className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          
          {programs.length === 0 && (
            <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700">
              <FileText className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 font-bold">Belum ada program</p>
              <p className="text-sm text-zinc-400">Buat program pertama Anda</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={resetForm}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 md:p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white">
                  {editingProgram ? 'Edit Program' : 'Buat Program Baru'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="overflow-y-auto p-4 md:p-6 space-y-6 flex-1">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Nama Program *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Contoh: Program Kurban 2025"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Deskripsi</label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Deskripsi singkat program..."
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Tipe</label>
                      <select
                        value={formData.program_type}
                        onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="gathering">Gathering</option>
                        <option value="kurban">Kurban</option>
                        <option value="bantuan">Bantuan</option>
                        <option value="pelatihan">Pelatihan</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Tanggal Mulai</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Tanggal Selesai</label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                          className="w-5 h-5 rounded accent-blue-600"
                        />
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Aktif</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Targeting */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowEligibility(!showEligibility)}
                    className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <div className="text-left">
                        <p className="font-bold text-purple-700 dark:text-purple-300">Program Targeted</p>
                        <p className="text-xs text-purple-500 dark:text-purple-400">Hanya NIK tertentu yang bisa mengikuti</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_targeted}
                          onChange={e => setFormData({ ...formData, is_targeted: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:ring-2 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                      {showEligibility ? <ChevronUp className="w-5 h-5 text-purple-500" /> : <ChevronDown className="w-5 h-5 text-purple-500" />}
                    </div>
                  </button>

                  {formData.is_targeted && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-4 space-y-4"
                    >
                      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-bold text-zinc-700 dark:text-zinc-300">Upload File NIK</p>
                            <p className="text-xs text-zinc-500">Format: .xlsx, .xls, .csv (kolom pertama = NIK)</p>
                          </div>
                          <button
                            type="button"
                            onClick={downloadTemplate}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <Download className="w-4 h-4" /> Download Template
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleExcelUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl text-purple-600 dark:text-purple-400 font-bold text-sm hover:bg-purple-100 dark:hover:bg-purple-900/50"
                          >
                            <Upload className="w-4 h-4" /> Upload Excel/CSV
                          </button>
                          <div className="flex-1">
                            <textarea
                              rows={2}
                              value={targetNiks}
                              onChange={e => { setTargetNiks(e.target.value); setUploadedEligibleCount(0); }}
                              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Atau masukkan NIK manual, pisahkan dengan koma..."
                            />
                          </div>
                        </div>
                        {uploadedEligibleCount > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                            <Check className="w-3 h-3 inline mr-1" /> {uploadedEligibleCount} NIK berhasil diimport
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Form Builder */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowFormBuilder(!showFormBuilder)}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <ListPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div className="text-left">
                        <p className="font-bold text-blue-700 dark:text-blue-300">Formulir Pendaftaran</p>
                        <p className="text-xs text-blue-500 dark:text-blue-400">Desain formulir seperti Google Form</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                        {formConfig.length} pertanyaan
                      </span>
                      {showFormBuilder ? <ChevronUp className="w-5 h-5 text-blue-500" /> : <ChevronDown className="w-5 h-5 text-blue-500" />}
                    </div>
                  </button>

                  {showFormBuilder && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-4 space-y-4"
                    >
                      {formConfig.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
                          <FileText className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                          <p className="text-zinc-500 font-medium">Belum ada pertanyaan</p>
                          <p className="text-xs text-zinc-400 mb-3">Tambahkan pertanyaan untuk formulir pendaftaran</p>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        {formConfig.map((field, index) => (
                          <div key={field.id} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="w-4 h-4 text-zinc-300" />
                                <span className="text-xs font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded">#{index + 1}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => moveQuestion(field.id, 'up')} disabled={index === 0} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-30">
                                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                                </button>
                                <button type="button" onClick={() => moveQuestion(field.id, 'down')} disabled={index === formConfig.length - 1} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-30">
                                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                                </button>
                                <button type="button" onClick={() => duplicateQuestion(field)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg">
                                  <Copy className="w-4 h-4 text-zinc-400" />
                                </button>
                                <button type="button" onClick={() => removeQuestion(field.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <input
                                type="text"
                                placeholder="Pertanyaan..."
                                value={field.label}
                                onChange={e => updateQuestion(field.id, 'label', e.target.value)}
                                className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <select
                                  value={field.type}
                                  onChange={e => updateQuestion(field.id, 'type', e.target.value)}
                                  className="border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg px-2 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="text">Teks Singkat</option>
                                  <option value="textarea">Paragraf</option>
                                  <option value="number">Angka</option>
                                  <option value="select">Pilihan Ganda</option>
                                  <option value="checkbox">Kotak Centang</option>
                                  <option value="date">Tanggal</option>
                                  <option value="time">Waktu</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="Placeholder..."
                                  value={field.placeholder}
                                  onChange={e => updateQuestion(field.id, 'placeholder', e.target.value)}
                                  className="border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg px-2 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                  <input
                                    type="checkbox"
                                    checked={field.required}
                                    onChange={e => updateQuestion(field.id, 'required', e.target.checked)}
                                    className="w-4 h-4 rounded accent-blue-600"
                                  />
                                  Wajib Diisi
                                </label>
                              </div>
                              {field.type === 'select' && (
                                <input
                                  type="text"
                                  placeholder="Opsi (pisah dengan koma): Ya, Tidak, Mungkin"
                                  value={field.options}
                                  onChange={e => updateQuestion(field.id, 'options', e.target.value)}
                                  className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              )}
                              <input
                                type="text"
                                placeholder="Teks bantuan (opsional)..."
                                value={field.help_text}
                                onChange={e => updateQuestion(field.id, 'help_text', e.target.value)}
                                className="w-full border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Tambah Pertanyaan
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 py-3 rounded-xl font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Menyimpan...' : editingProgram ? 'Simpan Perubahan' : 'Buat Program'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}