import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Edit2, Trash2, Loader2, ListPlus, Users, Upload, FileText, X, GripVertical, Copy, Settings, Eye, Check, ChevronDown, ChevronUp, Download, ClipboardList, AlertCircle, Trophy, Info, Gift, Image, RotateCcw, ExternalLink } from 'lucide-react';
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
  const [dynamicForms, setDynamicForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showEligibility, setShowEligibility] = useState(false);

  // Registrant viewer
  const [showRegistrants, setShowRegistrants] = useState(false);
  const [registrantProgram, setRegistrantProgram] = useState<any>(null);
  const [registrants, setRegistrants] = useState<any[]>([]);
  const [registrantsLoading, setRegistrantsLoading] = useState(false);

  const handleViewRegistrants = async (program: any) => {
    setRegistrantProgram(program);
    setShowRegistrants(true);
    setRegistrantsLoading(true);
    try {
      const { data } = await supabase
        .from('program_responses')
        .select('*, profiles!program_responses_user_id_fkey(name, nik)')
        .eq('program_id', program.id)
        .order('created_at', { ascending: false });
      setRegistrants(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data pendaftar');
    } finally {
      setRegistrantsLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    program_type: '',
    start_date: '',
    end_date: '',
    is_active: true,
    is_targeted: false,
    dynamic_form_id: '',
    // Gathering options
    enable_meal: true,
    enable_doorprize: false,
    enable_family: false,
    enable_form: true,
    paid_addons: [] as { id: string; name: string; price: number }[],
    max_participants: 0,
    // Kurban/Bingkisan options
    kurban_type: 'sapi',
    distribution_date: '',
    target_level: 'all',
    // Turnamen options
    tournament_mode: 'individual',
    team_size: 0,
    allow_register_team: false,
  });

  // Banner Upload State
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>('');
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format harus JPG, PNG, atau WebP');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran maksimal 5MB');
      return;
    }

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const uploadBanner = async (programId: string): Promise<string | null> => {
    if (!bannerFile) return formData.banner_url || null;
    
    setUploadingBanner(true);
    try {
      const fileExt = bannerFile.name.split('.').pop();
      const fileName = `${programId}-banner-${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('program-files')
        .upload(filePath, bannerFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('program-files')
        .getPublicUrl(filePath);

      setUploadingBanner(false);
      return publicUrl;
    } catch (error: any) {
      console.error('Banner upload error:', error);
      toast.error('Gagal upload banner');
      setUploadingBanner(false);
      return null;
    }
  };

  // Helper for paid add-ons
  const addPaidAddon = () => {
    setFormData({
      ...formData,
      paid_addons: [...formData.paid_addons, { id: crypto.randomUUID(), name: '', price: 0 }]
    });
  };

  const updatePaidAddon = (id: string, field: 'name' | 'price', value: string | number) => {
    setFormData({
      ...formData,
      paid_addons: formData.paid_addons.map(addon => 
        addon.id === id ? { ...addon, [field]: field === 'price' ? Number(value) : value } : addon
      )
    });
  };

  const removePaidAddon = (id: string) => {
    setFormData({
      ...formData,
      paid_addons: formData.paid_addons.filter(addon => addon.id !== id)
    });
  };

  const [formConfig, setFormConfig] = useState<FormField[]>([]);
  const [targetNiks, setTargetNiks] = useState('');
  const [uploadedEligibleCount, setUploadedEligibleCount] = useState(0);
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPrograms();
    fetchDynamicForms();
    fetchDepartments();
    if (formData.is_targeted) {
      fetchEligibleUsers();
    }
  }, [formData.is_targeted]);

  const fetchDepartments = async () => {
    try {
      const { data } = await supabase
        .from('employees')
        .select('department')
        .neq('department', '')
        .order('department');
      const depts = [...new Set((data || []).map(d => d.department))];
      setAvailableDepartments(depts);
    } catch {}
  };

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

  const fetchDynamicForms = async () => {
    try {
      const { data } = await supabase
        .from('dynamic_forms')
        .select('id, title')
        .eq('is_active', true);
      if (data) setDynamicForms(data);
    } catch (error) {
      console.error('Error fetching forms:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', program_type: '',
      start_date: '', end_date: '', is_active: true, is_targeted: false,
      dynamic_form_id: '', banner_url: '',
      enable_meal: true, enable_doorprize: false, enable_family: false, enable_form: true,
      paid_addons: [], max_participants: 0,
      kurban_type: 'sapi', distribution_date: '', target_level: 'all',
      tournament_mode: 'individual', team_size: 0, allow_register_team: false
    });
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(null);
    setBannerPreview('');
    setFormConfig([]);
    setTargetNiks('');
    setTargetDepartments([]);
    setUploadedEligibleCount(0);
    setIsModalOpen(false);
    setEditingProgram(null);
    setShowFormBuilder(false);
    setShowEligibility(false);
  };

  const openEditModal = (program: any) => {
    const meta = program.metadata || {};
    setEditingProgram(program);
    if (bannerPreview && bannerPreview.startsWith('blob:')) URL.revokeObjectURL(bannerPreview);
    setBannerFile(null);
    setBannerPreview(program.banner_url || '');
    setFormData({
      name: program.name,
      description: program.description || '',
      program_type: program.program_type || 'gathering',
      start_date: program.start_date || '',
      end_date: program.end_date || '',
      is_active: program.is_active,
      is_targeted: program.is_targeted,
      dynamic_form_id: program.dynamic_form_id || '',
      banner_url: program.banner_url || '',
      // Gathering
      enable_meal: meta.enable_meal ?? true,
      enable_doorprize: meta.enable_doorprize ?? false,
      enable_family: meta.enable_family ?? false,
      enable_form: meta.enable_form ?? true,
      paid_addons: meta.paid_addons || [],
      max_participants: meta.max_participants ?? 0,
      // Kurban
      kurban_type: meta.kurban_type ?? 'sapi',
      distribution_date: meta.distribution_date ?? '',
      target_level: meta.target_level ?? 'all',
      // Turnamen
      tournament_mode: meta.tournament_mode ?? 'individual',
      team_size: meta.team_size ?? 0,
      allow_register_team: meta.allow_register_team ?? false
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
      const programData: any = {
        name: formData.name,
        description: formData.description,
        program_type: formData.program_type,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        is_active: formData.is_active,
        is_targeted: formData.is_targeted,
        dynamic_form_id: formData.dynamic_form_id || null,
        banner_url: formData.banner_url || null,
        form_config: formConfig,
        target_departments: targetDepartments.length > 0 ? targetDepartments : null,
        metadata: {
          enable_meal: formData.enable_meal,
          enable_doorprize: formData.enable_doorprize,
          enable_family: formData.enable_family,
          enable_form: formData.enable_form,
          paid_addons: formData.paid_addons,
          max_participants: formData.max_participants,
          kurban_type: formData.kurban_type,
          distribution_date: formData.distribution_date,
          target_level: formData.target_level,
          tournament_mode: formData.tournament_mode,
          team_size: formData.team_size,
          allow_register_team: formData.allow_register_team
        }
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
        if (programData.is_active) {
            supabase.auth.getSession().then(({ data: { session } }) => {
                fetch('/api/admin/programs/notify', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                    },
                    body: JSON.stringify({ program_id: programId, title: programData.name })
                }).catch((err) => console.error('Failed to notify program start:', err));
            });
        }
      }

      if (bannerFile) {
        const uploadedUrl = await uploadBanner(programId);
        if (uploadedUrl) {
          await supabase.from('union_programs').update({ banner_url: uploadedUrl }).eq('id', programId);
          URL.revokeObjectURL(bannerPreview);
        }
      }

      if (formData.is_targeted && (targetNiks.trim() || targetDepartments.length > 0)) {
        await supabase.from('program_eligibility').delete().eq('program_id', programId);
        await supabase.from('program_coupons').delete().eq('program_id', programId).eq('status', 'active');
        
        const manualNiks = targetNiks.trim()
          ? targetNiks.split(/[,\n]/).map(nik => nik.trim()).filter(nik => nik.length >= 5)
          : [];

        let deptNiks: string[] = [];
        if (targetDepartments.length > 0) {
          const { data: deptEmployees } = await supabase
            .from('employees')
            .select('nik')
            .in('department', targetDepartments);
          deptNiks = (deptEmployees || []).map(e => e.nik).filter(Boolean);
        }

        const allNiks = [...new Set([...manualNiks, ...deptNiks])];

        if (allNiks.length > 0) {
          const eligibilityData = allNiks.map(nik => ({
            program_id: programId,
            nik: nik
          }));

          const { error: eligError } = await supabase.from('program_eligibility').insert(eligibilityData);
          if (eligError) throw eligError;

          toast.loading('Mendistribusikan kupon...', { duration: 2000 });
          try {
             const { data: count, error: genError } = await supabase.rpc('generate_program_coupons', {
               p_program_id: programId,
               p_niks: allNiks
             });
             if (genError) throw genError;
             if (count > 0) {
               toast.success(`Berhasil membagikan ${count} kupon otomatis kepada peserta!`);
             }
          } catch (genErr: any) {
             console.error("Auto generation failed", genErr);
             toast.error("Program disimpan, tetapi distribusi kupon otomatis gagal.");
          }
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
      const newStatus = !program.is_active;
      toast.success(`Program ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
      if (newStatus) {
          supabase.auth.getSession().then(({ data: { session } }) => {
              fetch('/api/admin/programs/notify', {
                  method: 'POST',
                  headers: { 
                      'Content-Type': 'application/json',
                      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                  },
                  body: JSON.stringify({ program_id: program.id, title: program.name })
              }).catch((err) => console.error('Failed to notify program status change:', err));
          });
      }
      fetchPrograms();
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const closeProgram = async (program: any) => {
    if (!confirm('Tutup program ini? Semua kupon aktif akan di-expire. Peserta tetap bisa lihat history.')) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const response = await fetch(`/api/admin/programs/${program.id}/close`, {
        method: 'POST',
        headers
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success('Program ditutup dan kupon di-expire');
      fetchPrograms();
    } catch (error: any) {
      toast.error('Gagal menutup program: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('Yakin hapus program ini? Semua kupon terkait akan ikut terhapus.')) return;
    try {
      await supabase.from('program_coupons').delete().eq('program_id', id);
      await supabase.from('program_eligibility').delete().eq('program_id', id);
      const { error } = await supabase.from('union_programs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Program dan seluruh kuponnya dihapus');
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
                  {prog.is_active && prog.end_date && new Date(prog.end_date) < new Date() && (
                    <button
                      onClick={() => closeProgram(prog)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                      title="Tutup program & expire kupon"
                    >
                      Tutup
                    </button>
                  )}
                  <button
                    onClick={() => handleViewRegistrants(prog)}
                    className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                    title="Lihat Pendaftar"
                  >
                    <Users className="w-4 h-4" />
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

                  {/* Dynamic Options based on Program Type */}
                  <div className="mt-6 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings className="w-5 h-5 text-zinc-500" />
                      <p className="font-bold text-zinc-700 dark:text-zinc-300">Pengaturan {formData.program_type === 'gathering' ? 'Gathering' : formData.program_type === 'kurban' ? 'Kurban' : 'Program'}</p>
                    </div>

                    {formData.program_type === 'gathering' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <input
                              type="checkbox"
                              checked={formData.enable_meal}
                              onChange={e => setFormData({ ...formData, enable_meal: e.target.checked })}
                              className="w-5 h-5 rounded accent-green-600"
                            />
                            <div>
                              <span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Makan (Meal)</span>
                              <span className="text-xs text-zinc-400">Tiket makan & QR Code</span>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <input
                              type="checkbox"
                              checked={formData.enable_doorprize}
                              onChange={e => setFormData({ ...formData, enable_doorprize: e.target.checked })}
                              className="w-5 h-5 rounded accent-purple-600"
                            />
                            <div>
                              <span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Doorprize</span>
                              <span className="text-xs text-zinc-400">Spin wheel & Coupon</span>
                            </div>
                          </label>
                        </div>
                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                          <input
                            type="checkbox"
                            checked={formData.enable_family}
                            onChange={e => setFormData({ ...formData, enable_family: e.target.checked })}
                            className="w-5 h-5 rounded accent-indigo-600"
                          />
                          <div>
                            <span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Keluarga (Family)</span>
                            <span className="text-xs text-zinc-400">Tambah anggota keluarga via QRIS</span>
                          </div>
                        </label>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1">Maks. Peserta (0 = unlimited)</label>
                          <input
                            type="number"
                            value={formData.max_participants}
                            onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })}
                            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    )}

                    {formData.program_type === 'kurban' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1">Jenis Hewan Kurban</label>
                          <select
                            value={formData.kurban_type}
                            onChange={e => setFormData({ ...formData, kurban_type: e.target.value })}
                            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-sm"
                          >
                            <option value="sapi">Sapi (1 orang max 1 sapi)</option>
                            <option value="kambing">Kambing (1 orang max 1 kambing)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1">Tanggal Distribusi Daging</label>
                          <input
                            type="date"
                            value={formData.distribution_date}
                            onChange={e => setFormData({ ...formData, distribution_date: e.target.value })}
                            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1">Maks. Peserta (0 = unlimited)</label>
                          <input
                            type="number"
                            value={formData.max_participants}
                            onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })}
                            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    )}

                    {formData.program_type !== 'gathering' && formData.program_type !== 'kurban' && (
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1">Maks. Peserta (0 = unlimited)</label>
                        <input
                          type="number"
                          value={formData.max_participants}
                          onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })}
                          className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-sm"
                          placeholder="0"
                        />
                      </div>
                    )}
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
                {/* STEP 1: Dasar - Wajib diisi dulu */}
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
                      placeholder="Penjelasan lengkap tentang program ini..."
                    />
                  </div>
                  
                  {/* Banner Upload */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3 mb-3">
                      <Image className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">Banner Acara</p>
                        <p className="text-xs text-zinc-500">Opsional: Unggah gambar banner untuk tampilan di portal</p>
                      </div>
                    </div>
                    
                    {!bannerPreview && !bannerFile ? (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 text-zinc-400 mb-2" />
                          <p className="text-xs text-zinc-500">Klik untuk upload banner</p>
                          <p className="text-[10px] text-zinc-400">JPG, PNG, WebP (maks 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleBannerUpload} />
                      </label>
                    ) : (
                      <div className="relative">
                        <img 
                          src={bannerPreview} 
                          alt="Banner Preview" 
                          className="w-full h-40 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700" 
                        />
                        <button 
                          type="button"
                          onClick={() => { if (bannerPreview) URL.revokeObjectURL(bannerPreview); setBannerFile(null); setBannerPreview(''); setFormData({...formData, banner_url: ''}); }}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {uploadingBanner && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-purple-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Mengunggah banner...
                      </div>
                    )}
                  </div>
                  
                  {/* PROGRESSIVE DISCLOSURE - PICK TYPE FIRST */}
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <label className="block text-sm font-bold text-amber-800 dark:text-amber-200 mb-2">
                      Langkah 1: Pilih Jenis Program *
                    </label>
                    <select
                      required
                      value={formData.program_type}
                      onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                      className="w-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- Pilih Tipe Program --</option>
                      <option value="gathering">Gathering (Acara Karyawan)</option>
                      <option value="kurban">Kurban (Pembagian Daging)</option>
                      <option value="bingkisan">Bingkisan (Leburan/THR)</option>
                      <option value="turnamen">Turnamen (Olahraga/Kompetisi)</option>
                    </select>
                  </div>

                  {/* STEP 2: Details - Only show after type is selected */}
                  {formData.program_type && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
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
                      <div className="flex items-center justify-start gap-3 pt-6">
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
                    </motion.div>
                  )}
                </div>
                  
                  {/* Formulir Tambahan Acara */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <ClipboardList className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white">Formulir Tambahan Acara</p>
                          <p className="text-xs text-zinc-500">Aktifkan polling atau kuesioner untuk peserta</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={!!formData.dynamic_form_id}
                          onChange={e => setFormData({ ...formData, dynamic_form_id: e.target.checked ? formData.dynamic_form_id : '' })}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    
                    {formData.dynamic_form_id ? (
                      <div className="space-y-3">
                        <select
                          value={formData.dynamic_form_id}
                          onChange={e => setFormData({ ...formData, dynamic_form_id: e.target.value })}
                          className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Pilih Formulir --</option>
                          {dynamicForms.filter(f => f.is_active).map(form => (
                            <option key={form.id} value={form.id}>{form.title}</option>
                          ))}
                        </select>
                        {formData.dynamic_form_id && dynamicForms.find(f => f.id === formData.dynamic_form_id) && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                            <p className="text-xs text-green-700 dark:text-green-400">
                              ✓ Formulir aktif: <span className="font-semibold">{dynamicForms.find(f => f.id === formData.dynamic_form_id)?.title}</span>
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <p className="text-[10px] md:text-xs text-amber-700 dark:text-amber-400 font-medium">
                            Formulir ini akan muncul di portal karyawan sebelum mereka mengkonfirmasi kehadiran.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-zinc-400 dark:text-zinc-500">
                        <p className="text-sm">Toggle di atas untuk mengaktifkan</p>
                      </div>
                    )}
                  </div>

                {/* LANGKAH 3: PENGATURAN KHUSUS BERDASARKAN JENIS PROGRAM */}
                {formData.program_type && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-zinc-500" />
                      <h3 className="font-bold text-zinc-700 dark:text-zinc-300">Langkah 3: Konfigurasi {formData.program_type === 'gathering' ? 'Gathering' : formData.program_type === 'kurban' ? 'Kurban' : formData.program_type === 'bingkisan' ? 'Bingkisan' : formData.program_type === 'turnamen' ? 'Turnamen' : 'Program'}</h3>
                    </div>

                    {/* CARD: GATHERING */}
                    {formData.program_type === 'gathering' && (
                      <div className="grid gap-4">
                        {/* Gate Settings */}
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-3">
                            <Gift className="w-4 h-4 text-green-600" />
                            <span className="font-bold text-green-800 dark:text-green-200 text-sm">Gate & Tiket</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-green-100 dark:border-green-900">
                              <input type="checkbox" checked={formData.enable_meal} onChange={e => setFormData({ ...formData, enable_meal: e.target.checked })} className="w-5 h-5 rounded accent-green-600" />
                              <div><span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Tiket Makan</span><span className="text-xs text-zinc-400">QR Meal coupon</span></div>
                            </label>
                            <label className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-green-100 dark:border-green-900">
                              <input type="checkbox" checked={formData.enable_doorprize} onChange={e => setFormData({ ...formData, enable_doorprize: e.target.checked })} className="w-5 h-5 rounded accent-purple-600" />
                              <div><span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Doorprize</span><span className="text-xs text-zinc-400">Spin wheel & kupon</span></div>
                            </label>
                          </div>
                        </div>

                        {/* Family Payment */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-indigo-600" />
                              <span className="font-bold text-indigo-800 dark:text-indigo-200 text-sm">Keluarga Berbayar</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={formData.enable_family} onChange={e => setFormData({ ...formData, enable_family: e.target.checked })} className="sr-only peer" />
                              <div className="w-9 h-5 bg-zinc-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          </div>
                          {formData.enable_family && (
                            <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-800 space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Daftar Item Berbayar (Add-ons)</label>
                                <button type="button" onClick={addPaidAddon} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold">
                                  <Plus className="w-3 h-3" /> Tambah Item
                                </button>
                              </div>
                              
                              {formData.paid_addons.length === 0 && (
                                <p className="text-xs text-zinc-400 italic">Belum ada item. Klik "+ Tambah Item" untuk menambahkan.</p>
                              )}
                              
                              {formData.paid_addons.map((addon, idx) => (
                                <div key={addon.id} className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                  <span className="text-xs text-zinc-400 w-6">{idx + 1}.</span>
                                  <input 
                                    type="text" 
                                    value={addon.name}
                                    onChange={e => updatePaidAddon(addon.id, 'name', e.target.value)}
                                    className="flex-1 border-none bg-transparent text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none"
                                    placeholder="Nama item (contoh: Sewa Tenda)"
                                  />
                                  <input 
                                    type="number" 
                                    value={addon.price}
                                    onChange={e => updatePaidAddon(addon.id, 'price', e.target.value)}
                                    className="w-24 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs text-right"
                                    placeholder="Harga"
                                  />
                                  <button type="button" onClick={() => removePaidAddon(addon.id)} className="text-red-500 hover:text-red-700">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Kuota & Form */}
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-zinc-500 mb-1">Kuota Maks (0 = unlimited)</label>
                              <input type="number" value={formData.max_participants} onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })} className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div className="flex items-center pt-5 justify-end">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={formData.enable_form} onChange={e => setFormData({ ...formData, enable_form: e.target.checked })} className="w-4 h-4 rounded accent-blue-600" />
                                <span className="text-sm text-zinc-600 dark:text-zinc-300">Aktifkan Form/Poll</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CARD: KURBAN & BINGKISAN */}
                    {(formData.program_type === 'kurban' || formData.program_type === 'bingkisan') && (
                      <div className="grid gap-4">
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center gap-2 mb-3">
                            <Gift className="w-4 h-4 text-amber-600" />
                            <span className="font-bold text-amber-800 dark:text-amber-200 text-sm">Konfigurasi {formData.program_type === 'kurban' ? 'Kurban' : 'Bingkisan'}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {formData.program_type === 'kurban' && (
                              <div>
                                <label className="block text-xs text-amber-600 dark:text-amber-400 mb-1">Jenis Hewan</label>
                                <select value={formData.kurban_type} onChange={e => setFormData({ ...formData, kurban_type: e.target.value })} className="w-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm">
                                  <option value="sapi">Sapi (1 orang max 1)</option>
                                  <option value="kambing">Kambing (1 orang max 1)</option>
                                </select>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs text-amber-600 dark:text-amber-400 mb-1">Tanggal Distribusi</label>
                              <input type="date" value={formData.distribution_date} onChange={e => setFormData({ ...formData, distribution_date: e.target.value })} className="w-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-amber-600 dark:text-amber-400 mb-1">Target Jabatan</label>
                              <select value={formData.target_level} onChange={e => setFormData({ ...formData, target_level: e.target.value })} className="w-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm">
                                <option value="all">Semua Karyawan</option>
                                <option value="operative">Hanya Operative</option>
                                <option value="staff">Hanya Staff & above</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-amber-600 dark:text-amber-400 mb-1">Kuota Maks (0 = unlimited)</label>
                              <input type="number" value={formData.max_participants} onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })} className="w-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm" />
                            </div>
                          </div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-blue-700 dark:text-blue-300"><Info className="w-3 h-3 inline mr-1" /> Kupon akan otomatis digenerate untuk NIK yang di-upload di section Targeted. Karyawan tidak perlu konfirmasi hadir.</p>
                        </div>
                      </div>
                    )}

                    {/* CARD: TURNAMEN */}
                    {formData.program_type === 'turnamen' && (
                      <div className="grid gap-4">
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                          <div className="flex items-center gap-2 mb-3">
                            <Trophy className="w-4 h-4 text-orange-600" />
                            <span className="font-bold text-orange-800 dark:text-orange-200 text-sm">Konfigurasi Turnamen</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-orange-600 dark:text-orange-400 mb-1">Mode Pendaftaran</label>
                              <select value={formData.tournament_mode} onChange={e => setFormData({ ...formData, tournament_mode: e.target.value })} className="w-full border border-orange-300 dark:border-orange-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm">
                                <option value="individual">Individu</option>
                                <option value="team">Tim</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-orange-600 dark:text-orange-400 mb-1">Ukuran Tim (0 jika individu)</label>
                              <input type="number" value={formData.team_size} onChange={e => setFormData({ ...formData, team_size: parseInt(e.target.value) || 0 })} className="w-full border border-orange-300 dark:border-orange-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-orange-100 dark:border-orange-900">
                                <input type="checkbox" checked={formData.allow_register_team} onChange={e => setFormData({ ...formData, allow_register_team: e.target.checked })} className="w-5 h-5 rounded accent-orange-600" />
                                <div><span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Tim Bisa Mendaftarkan Diri</span><span className="text-xs text-zinc-400">Leader bisa buat tim & invite anggota</span></div>
                              </label>
                            </div>
                            <div>
                              <label className="block text-xs text-orange-600 dark:text-orange-400 mb-1">Kuota Maks (0 = unlimited)</label>
                              <input type="number" value={formData.max_participants} onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })} className="w-full border border-orange-300 dark:border-orange-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

                      {/* Target Departments */}
                      <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-500" />
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Target Departemen</label>
                        </div>
                        {availableDepartments.length === 0 ? (
                          <p className="text-xs text-zinc-400 italic">Belum ada data departemen</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {availableDepartments.map(dept => {
                              const selected = targetDepartments.includes(dept);
                              return (
                                <button
                                  key={dept}
                                  type="button"
                                  onClick={() => setTargetDepartments(prev =>
                                    selected ? prev.filter(d => d !== dept) : [...prev, dept]
                                  )}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    selected
                                      ? 'bg-purple-600 text-white shadow-md'
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                  }`}
                                >
                                  {dept}
                                </button>
                              );
                            })}
                          </div>
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
                    onClick={() => { resetForm(); }}
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

        {/* Registrant Modal */}
        <AnimatePresence>
          {showRegistrants && registrantProgram && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => { setShowRegistrants(false); setRegistrantProgram(null); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white">Pendaftar Program</h3>
                      <p className="text-xs text-zinc-500 truncate max-w-[300px]">{registrantProgram.name}</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowRegistrants(false); setRegistrantProgram(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
                  {registrantsLoading ? (
                    <div className="flex justify-center py-16">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                  ) : registrants.length === 0 ? (
                    <div className="text-center py-16">
                      <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                      <p className="font-bold text-zinc-500">Belum ada pendaftar</p>
                      <p className="text-xs text-zinc-400 mt-1">Belum ada yang mendaftar program ini</p>
                    </div>
                  ) : (
                    <div className="p-6 space-y-4">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{registrants.length} Pendaftar</p>
                      {registrants.map((resp) => (
                        <div key={resp.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                {resp.profiles?.name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-zinc-900 dark:text-white">{resp.profiles?.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono">{resp.profiles?.nik}</p>
                              </div>
                            </div>
                            <div className="text-right text-[10px] text-zinc-400">
                              {resp.additional_family > 0 && (
                                <p className="font-bold text-zinc-600 dark:text-zinc-300">+{resp.additional_family} keluarga</p>
                              )}
                              <p>{resp.payment_status === 'paid' ? 'Lunas' : 'Pending'}</p>
                            </div>
                          </div>
                          {resp.answers && Object.keys(resp.answers).length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800">
                              {Object.entries(resp.answers).map(([key, val]) => (
                                <div key={key} className="text-xs flex gap-2 py-1">
                                  <span className="font-bold text-zinc-500 shrink-0">{key}:</span>
                                  <span className="text-zinc-700 dark:text-zinc-300">{String(val)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
}