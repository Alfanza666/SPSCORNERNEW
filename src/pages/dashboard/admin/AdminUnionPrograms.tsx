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
                  <td className="px-6 py-4
