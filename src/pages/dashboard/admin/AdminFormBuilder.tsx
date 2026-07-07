import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  ClipboardList, Plus, X, Trash2, Save, MoveUp, MoveDown,
  Type, List, CheckSquare, Calendar, Loader2, ChevronRight,
  Settings, AlertCircle, Copy, Link2, ImageIcon, Star,
  Sliders, Upload, ShoppingBag, MoreVertical, LayoutTemplate, MoreHorizontal,
  Sparkles, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { FormConfig, FormField, FormOption, AddonItem, FieldType } from '../../../types/form';

interface DynamicForm {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  is_active: boolean;
  created_at: string;
}

export default function AdminFormBuilder() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [forms, setForms] = useState<DynamicForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editingForm, setEditingForm] = useState<FormConfig>({
    title: 'Formulir Tanpa Judul',
    description: '',
    theme_color: '#673AB7',
    banner_url: '',
    fields: []
  });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  
  // Program Linking State
  const [linkedProgramId, setLinkedProgramId] = useState<string>('');
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([]);

  // AI Generation
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Department targeting
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [targetNiks, setTargetNiks] = useState('');
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (showEditor) {
      fetchPrograms();
      fetchDepartments();
    }
  }, [showEditor]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('union_programs')
        .select('id, name, program_type, is_active')
        .eq('is_active', true)
        .order('name');
      if (!error) setAvailablePrograms(data || []);
    } catch (err) {}
  };

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

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Masukkan deskripsi formulir yang diinginkan');
      return;
    }
    setAiLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/ai/generate-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const fields = json.data.map((f: any) => ({
          id: f.id || Math.random().toString(36).substr(2, 9),
          type: f.type,
          label: f.label || 'Pertanyaan',
          required: f.required || false,
          placeholder: f.placeholder || '',
          options: ['select', 'radio', 'checkbox'].includes(f.type) && f.options ? f.options : undefined,
          max: f.type === 'rating' ? 5 : undefined,
          max_scale: f.type === 'scale' ? 10 : undefined,
          condition: f.condition || undefined,
        }));
        setEditingForm(prev => ({ ...prev, fields: [...(prev.fields || []), ...fields] }));
        toast.success(`${fields.length} field berhasil digenerate!`);
        setShowAI(false);
        setAiPrompt('');
      } else {
        toast.error('AI tidak dapat menghasilkan field. Coba prompt yang lebih spesifik.');
      }
    } catch (err) {
      toast.error('Gagal menghubungi AI. Coba lagi.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchForms();
  }, [user]);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dynamic_forms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setForms(data || []);
    } catch (error: any) {
      toast.error('Gagal memuat formulir: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: type === 'addon_group' ? 'Pesanan Ekstra (Mandiri)' : 'Pertanyaan Tanpa Judul',
      required: false,
      placeholder: 'Masukkan jawaban...',
      options: type === 'select' || type === 'radio' || type === 'image_choice' 
        ? [{ value: 'opt1', label: 'Opsi 1', image: '' }] 
        : undefined,
      max: type === 'rating' ? 5 : undefined,
      max_scale: type === 'scale' ? 10 : undefined,
      items: type === 'addon_group' ? [{ id: 'item1', name: 'Baju Tambahan', sizes: ['S','M','L','XL'], price: 0 }] : undefined,
      allow_multiple: type === 'addon_group' ? true : undefined
    };
    
    setEditingForm(prev => {
        const fields = [...(prev.fields || [])];
        const activeIndex = fields.findIndex(f => f.id === activeFieldId);
        if (activeIndex >= 0) {
            fields.splice(activeIndex + 1, 0, newField);
        } else {
            fields.push(newField);
        }
        return { ...prev, fields };
    });
    setActiveFieldId(newField.id);
  };

  const duplicateField = (field: FormField) => {
    const newField = { ...field, id: Math.random().toString(36).substr(2, 9) };
    setEditingForm(prev => {
        const fields = [...(prev.fields || [])];
        const activeIndex = fields.findIndex(f => f.id === field.id);
        fields.splice(activeIndex + 1, 0, newField);
        return { ...prev, fields };
    });
    setActiveFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setEditingForm(prev => ({
      ...prev,
      fields: prev.fields?.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const removeField = (id: string) => {
    setEditingForm(prev => ({
      ...prev,
      fields: prev.fields?.filter(f => f.id !== id)
    }));
    setActiveFieldId(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const fields = [...(editingForm.fields || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
    setEditingForm(prev => ({ ...prev, fields }));
  };

  const handleSave = async () => {
    if (!editingForm.title) {
      toast.error('Judul formulir wajib diisi');
      return;
    }
    if (!editingForm.fields || editingForm.fields.length === 0) {
      toast.error('Tambahkan minimal satu pertanyaan');
      return;
    }

    setSaving(true);
    try {
      const cleanFields = editingForm.fields.map(f => {
        if ((f.type === 'select' || f.type === 'radio' || f.type === 'image_choice') && f.options) {
          return { ...f, options: f.options.filter(o => o.label.trim() !== '') };
        }
        if (f.type === 'addon_group' && f.items) {
          return { ...f, items: f.items.filter(i => i.name.trim() !== '') };
        }
        return f;
      });

      const nikArray = targetNiks.trim()
        ? targetNiks.split(/[,\n;]/).map((nik: string) => nik.trim()).filter((nik: string) => nik.length >= 3)
        : [];

      let resolvedDeptNiks: string[] = [];
      if (targetDepartments.length > 0) {
        const { data: deptEmployees } = await supabase
          .from('employees')
          .select('nik')
          .in('department', targetDepartments);
        resolvedDeptNiks = (deptEmployees || []).map(e => e.nik).filter(Boolean);
      }

      const allNiks = [...new Set([...nikArray, ...resolvedDeptNiks])];

      const payload: any = {
        title: editingForm.title,
        description: JSON.stringify({
          text: editingForm.description || '',
          theme: editingForm.theme_color || '#673AB7',
          banner: editingForm.banner_url || ''
        }),
        fields: cleanFields,
        is_active: true,
        target_niks: allNiks.length > 0 ? allNiks : null,
        target_departments: targetDepartments.length > 0 ? targetDepartments : null
      };

      let currentFormId = editingForm.id;

      if (editingForm.id) {
        const { error } = await supabase.from('dynamic_forms').update(payload).eq('id', editingForm.id);
        if (error) throw error;
        toast.success('Formulir diperbarui');
      } else {
        const { data, error } = await supabase.from('dynamic_forms').insert({ ...payload, created_by: user?.id }).select().single();
        if (error) throw error;
        currentFormId = data.id;
        toast.success('Formulir dibuat');
      }

      if (linkedProgramId && currentFormId) {
        const { error: linkError } = await supabase.from('union_programs').update({ dynamic_form_id: currentFormId }).eq('id', linkedProgramId);
        if (!linkError) toast.success('Formulir berhasil ditautkan ke program!');
      }
      
      setShowEditor(false);
      fetchForms();
    } catch (error: any) {
      toast.error('Gagal menyimpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus formulir ini? Semua respon yang terkait juga akan hilang.')) return;
    try {
      const { error } = await supabase.from('dynamic_forms').delete().eq('id', id);
      if (error) throw error;
      toast.success('Formulir dihapus');
      fetchForms();
    } catch (error: any) {
      toast.error('Gagal menghapus: ' + error.message);
    }
  };

  const copyFormLink = (id: string) => {
    const url = `${window.location.origin}/portal/forms/${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link formulir disalin!');
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-8 text-center font-bold text-red-500">Akses Ditolak</div>;
  }

  return (
    <div className={`min-h-screen ${showEditor ? 'bg-[#F0EBFF] dark:bg-zinc-950' : 'bg-zinc-50 dark:bg-zinc-950'} p-4 md:p-8 transition-colors duration-500`}>
      {!showEditor ? (
         <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                  <LayoutTemplate className="w-8 h-8 text-[#673AB7]" />
                  Formulir Dinamis
                </h1>
                <p className="text-zinc-500 font-medium mt-1">Kelola pendaftaran, kuesioner, dan polling interaktif</p>
              </div>
              <button
                  onClick={() => {
                  setEditingForm({ title: 'Formulir Tanpa Judul', description: '', theme_color: '#673AB7', banner_url: '', fields: [] });
                  setLinkedProgramId('');
                  setTargetNiks('');
                  setTargetDepartments([]);
                  setShowEditor(true);
                }}
                className="bg-[#673AB7] hover:bg-[#5E35B1] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Buat Formulir
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#673AB7]" /></div>
                ) : forms.length === 0 ? (
                    <div className="col-span-full text-center py-20">
                        <ClipboardList className="w-20 h-20 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
                        <p className="text-zinc-500 font-bold">Belum Ada Formulir</p>
                    </div>
                ) : forms.map(form => (
                    <div key={form.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg transition-all group cursor-pointer flex flex-col">
                        <div 
                          className="h-24 bg-[#673AB7]/10 flex items-center justify-center border-b border-zinc-100 dark:border-zinc-800 relative"
                          onClick={async () => {
                              let desc = form.description;
  let theme = '#673AB7';
  let banner = '';
  try {
    const parsed = JSON.parse(form.description);
    if (parsed.text !== undefined) {
      desc = parsed.text;
      theme = parsed.theme || '#673AB7';
      banner = parsed.banner || '';
    }
  } catch(e) {}
  setEditingForm({ ...form, description: desc, theme_color: theme, banner_url: banner }); 
                              setShowEditor(true);
                              const { data } = await supabase.from('union_programs').select('id').eq('dynamic_form_id', form.id).single();
                              setLinkedProgramId(data?.id || '');
                          }}
                        >
                            <LayoutTemplate className="w-12 h-12 text-[#673AB7]/50" />
                            {!form.is_active && (
                                <span className="absolute top-2 right-2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded-md font-bold">Draft</span>
                            )}
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1 mb-1">{form.title}</h3>
                                <div className="text-xs text-zinc-500 mb-4 flex items-center gap-1"><Type className="w-3 h-3"/> {form.fields?.length || 0} Pertanyaan</div>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/admin/forms/responses/${form.id}`); }} className="text-xs font-bold text-[#673AB7] bg-[#673AB7]/10 px-3 py-1.5 rounded-lg hover:bg-[#673AB7]/20 transition-colors">
                                    Lihat Respon
                                </button>
                                <div className="flex items-center gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); copyFormLink(form.id); }} className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Link2 className="w-4 h-4"/></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(form.id); }} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
         </div>
      ) : (
         <div className="max-w-3xl mx-auto pb-32">
            {/* Editor Header */}
            <div className="flex items-center justify-between mb-6 bg-white dark:bg-zinc-900 p-4 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800 sticky top-4 z-50">
               <button onClick={() => setShowEditor(false)} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 font-bold px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  Kembali
               </button>
               <div className="flex items-center gap-2">
                   <button onClick={() => setShowAI(true)} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-all text-sm">
                      <Sparkles className="w-4 h-4" /> AI
                   </button>
                   <button onClick={handleSave} disabled={saving} className="bg-[#673AB7] text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-[#5E35B1] transition-all">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
                   </button>
                </div>
             </div>

            <div className="relative">
                {/* Main Form Title Card */}
                <div 
                    onClick={() => setActiveFieldId('header')}
                    className={`bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border transition-all mb-4 relative ${
                        activeFieldId === 'header' ? 'border-[#673AB7] shadow-lg' : 'border-zinc-200 dark:border-zinc-800 shadow-sm'
                    }`}
                >
                    <div className="h-3 w-full" style={{ backgroundColor: editingForm.theme_color || '#673AB7' }} />
                    {activeFieldId === 'header' && <div className="absolute left-0 top-3 bottom-0 w-1.5 bg-[#673AB7]" />}
                    
                    <div className="p-6 md:p-8">
                        <input
                            type="text"
                            value={editingForm.title}
                            onChange={(e) => setEditingForm(prev => ({ ...prev, title: e.target.value }))}
                            className="text-4xl font-normal w-full bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-[#673AB7] focus:ring-0 px-0 py-2 mb-4 text-zinc-900 dark:text-white transition-colors"
                            placeholder="Judul Formulir"
                        />
                        <textarea
                            value={editingForm.description}
                            onChange={(e) => setEditingForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-[#673AB7] focus:ring-0 px-0 py-2 text-zinc-600 dark:text-zinc-400 resize-none min-h-[60px] text-sm"
                            placeholder="Deskripsi formulir"
                        />

                        {activeFieldId === 'header' && (
                            <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Tema Warna (Hex)</label>
                                    <div className="flex items-center gap-3">
                                      <input
                                          type="color"
                                          value={editingForm.theme_color || '#673AB7'}
                                          onChange={(e) => setEditingForm(prev => ({ ...prev, theme_color: e.target.value }))}
                                          className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                                      />
                                      <input
                                          type="text"
                                          value={editingForm.theme_color || '#673AB7'}
                                          onChange={(e) => setEditingForm(prev => ({ ...prev, theme_color: e.target.value }))}
                                          className="flex-1 p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:border-[#673AB7] outline-none uppercase"
                                          placeholder="#673AB7"
                                      />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Banner URL (Gambar Opsional)</label>
                                    <input
                                        type="text"
                                        value={editingForm.banner_url || ''}
                                        onChange={(e) => setEditingForm(prev => ({ ...prev, banner_url: e.target.value }))}
                                        className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:border-[#673AB7] outline-none"
                                        placeholder="https://contoh.com/banner.jpg"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Tautkan ke Program Acara</label>
                                    <select
                                        value={linkedProgramId}
                                        onChange={(e) => setLinkedProgramId(e.target.value)}
                                        className="w-full md:w-1/2 p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:border-[#673AB7] outline-none"
                                    >
                                        <option value="">-- Tidak Ditautkan --</option>
                                        {availablePrograms.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Target NIK */}
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" /> Target NIK
                                  </label>
                                  <textarea
                                    value={targetNiks}
                                    onChange={(e) => setTargetNiks(e.target.value)}
                                    className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:border-[#673AB7] outline-none h-16 resize-none font-mono"
                                    placeholder="Pisahkan dengan koma atau enter. Contoh: 12345, 67890"
                                  />
                                </div>

                                {/* Target Departments */}
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" /> Target Departemen
                                  </label>
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
                            </div>
                        )}
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    <AnimatePresence>
                        {editingForm.fields?.map((field, index) => (
                            <FieldCard 
                                key={field.id}
                                field={field}
                                allFields={editingForm.fields || []}
                                isActive={activeFieldId === field.id}
                                onClick={() => setActiveFieldId(field.id)}
                                onUpdate={(updates) => updateField(field.id, updates)}
                                onMove={(dir) => moveField(index, dir)}
                                onDuplicate={() => duplicateField(field)}
                                onDelete={() => removeField(field.id)}
                                isFirst={index === 0}
                                isLast={index === (editingForm.fields?.length || 0) - 1}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                {/* Google Forms Style Floating Toolbar */}
                <div className="fixed right-4 md:absolute md:-right-16 top-1/2 md:top-32 -translate-y-1/2 md:translate-y-0 bg-white dark:bg-zinc-900 p-2 rounded-xl md:rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3 z-50">
                    <ToolbarButton icon={<Plus />} label="Teks Pendek" onClick={() => addField('text')} />
                    <ToolbarButton icon={<List />} label="Paragraf" onClick={() => addField('textarea')} />
                    <ToolbarButton icon={<CheckSquare />} label="Pilihan Ganda" onClick={() => addField('radio')} />
                    <ToolbarButton icon={<Sliders />} label="Skala Penilaian" onClick={() => addField('scale')} />
                    <ToolbarButton icon={<ShoppingBag />} label="Grup Pemesanan" onClick={() => addField('addon_group')} />
                    <ToolbarButton icon={<ImageIcon />} label="Gambar" onClick={() => addField('image')} />
                </div>

                {/* AI Generation Modal */}
                <AnimatePresence>
                  {showAI && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAI(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-black text-zinc-900 dark:text-white">Generate dengan AI</h3>
                              <p className="text-xs text-zinc-500">Deskripsikan formulir yang kamu butuhkan</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          <textarea
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="w-full h-32 p-4 border border-zinc-200 dark:border-zinc-700 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            placeholder="Contoh: Buat form pendaftaran gathering dengan field nama, no hp, ukuran baju (S/M/L/XL/XXL), konfirmasi hadir, dan catatan makanan..."
                          />
                          <div className="flex gap-3">
                            <button onClick={() => setShowAI(false)} className="flex-1 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                              Batal
                            </button>
                            <button onClick={generateWithAI} disabled={aiLoading} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              {aiLoading ? 'Mengenerate...' : 'Generate'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
            </div>
         </div>
      )}
    </div>
  );
}

// --- Toolbar Helper ---
function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
    return (
        <button onClick={onClick} title={label} className="p-2.5 text-zinc-500 hover:text-[#673AB7] hover:bg-[#673AB7]/10 rounded-xl transition-colors relative group">
            {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {label}
            </span>
        </button>
    );
}

// --- Field Card ---
function FieldCard({ 
  field, allFields, isActive, onClick, onUpdate, onMove, onDuplicate, onDelete, isFirst, isLast 
}: any) {

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden transition-all relative ${
        isActive ? 'border border-[#673AB7] shadow-xl' : 'border border-zinc-200 dark:border-zinc-800 shadow-sm'
      }`}
    >
      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#673AB7]" />}
      
      {/* Drag Handle Top Bar */}
      {isActive && (
          <div className="flex justify-center pt-2 pb-0 cursor-move text-zinc-300">
              <MoreHorizontal className="w-6 h-6" />
          </div>
      )}

      <div className={`p-6 ${isActive ? 'pt-2' : ''}`}>
        {!isActive ? (
            // Preview Mode
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-1">
                        <span className="text-[15px] font-medium text-zinc-800 dark:text-zinc-200">{field.label}</span>
                        {field.required && <span className="text-red-500">*</span>}
                    </div>
                    {field.condition && (() => {
                      const pf = allFields?.find((f: any) => f.id === field.condition.fieldId);
                      const label = pf ? pf.label : '(field dihapus)';
                      const valDisplay = Array.isArray(field.condition.value) 
                        ? field.condition.value.join(', ') 
                        : field.condition.value;
                      const opLabel = field.condition.operator === 'eq' ? '=' : field.condition.operator === 'neq' ? '≠' : '∈';
                      return (
                        <div className="text-xs text-[#673AB7] font-bold flex items-center gap-1.5">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8L22 12L18 16"/><path d="M6 8L2 12L6 16"/><path d="M9 4L15 20"/></svg>
                          Tampil jika "{label}" {opLabel} "{valDisplay}"
                        </div>
                      );
                    })()}
                    <div className="text-sm text-zinc-400 border-b border-dashed border-zinc-300 pb-1 w-2/3">
                        {field.type === 'radio' ? 'Opsi 1' : field.type === 'text' ? 'Teks jawaban singkat' : field.placeholder}
                    </div>
                </div>
        ) : (
            // Edit Mode
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 md:items-start">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={field.label}
                            onChange={(e) => onUpdate({ label: e.target.value })}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border-b-2 border-zinc-300 focus:border-[#673AB7] p-3 text-base text-zinc-900 dark:text-white outline-none rounded-t-md"
                            placeholder="Pertanyaan"
                        />
                    </div>
                    <select 
                        value={field.type}
                        onChange={(e) => onUpdate({ type: e.target.value })}
                        className="w-full md:w-56 p-3 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium focus:border-[#673AB7] outline-none"
                    >
                        <option value="text">Jawaban Singkat</option>
                        <option value="textarea">Paragraf</option>
                        <option value="radio">Pilihan Ganda</option>
                        <option value="checkbox">Kotak Centang</option>
                        <option value="select">Tarik-turun (Dropdown)</option>
                        <option value="scale">Skala Linier</option>
                        <option value="date">Tanggal</option>
                        <option value="rating">Bintang</option>
                        <option value="file_upload">Upload File</option>
                        <option value="image">Upload Gambar / URL</option>
                        <option value="image_choice">Pilihan Gambar</option>
                        <option value="addon_group">Grup Pesanan (Add-on)</option>
                    </select>
                </div>

                {/* Option Editor for Multiple Choice */}
                {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                    <div className="space-y-3">
                        {field.options?.map((opt: any, optIndex: number) => (
                            <div key={optIndex} className="flex items-center gap-3 group">
                                {field.type === 'radio' ? <div className="w-4 h-4 rounded-full border-2 border-zinc-300 flex-shrink-0" /> : 
                                 field.type === 'checkbox' ? <div className="w-4 h-4 rounded border-2 border-zinc-300 flex-shrink-0" /> : 
                                 <span className="text-zinc-400 font-mono text-sm">{optIndex + 1}.</span>}
                                
                                <input
                                    type="text"
                                    value={opt.label}
                                    onChange={(e) => {
                                        const newOpts = [...(field.options || [])];
                                        newOpts[optIndex] = { ...newOpts[optIndex], label: e.target.value };
                                        onUpdate({ options: newOpts });
                                    }}
                                    className="flex-1 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#673AB7] py-1 text-sm outline-none dark:text-white"
                                    placeholder={`Opsi ${optIndex + 1}`}
                                />
                                <button onClick={() => {
                                    const newOpts = field.options?.filter((_:any, i:number) => i !== optIndex);
                                    onUpdate({ options: newOpts });
                                }} className="text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"><X className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full border-2 border-transparent flex-shrink-0" />
                            <button onClick={() => onUpdate({ options: [...(field.options || []), { value: `opt${Date.now()}`, label: `Opsi ${(field.options?.length || 0) + 1}`, image: '' }] })}
                            className="text-sm font-medium text-zinc-500 hover:text-[#673AB7]">
                                Tambahkan opsi
                            </button>
                        </div>
                    </div>
                )}

                {/* Linear Scale Editor */}
                {field.type === 'scale' && (
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-zinc-500">1 hingga</span>
                        <select value={field.max_scale || 5} onChange={(e) => onUpdate({ max_scale: parseInt(e.target.value) })} className="border p-2 rounded">
                            {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                )}

                {/* Addon Group Editor */}
                {field.type === 'addon_group' && (
                    <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-bold text-zinc-500 uppercase">Daftar Produk Pesanan</p>
                            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={field.allow_multiple} onChange={(e) => onUpdate({ allow_multiple: e.target.checked })}/> Multi-pilih</label>
                        </div>
                        {field.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input type="text" value={item.name} onChange={(e) => { const newItems = [...field.items]; newItems[idx].name = e.target.value; onUpdate({ items: newItems }); }} className="flex-1 p-2 text-sm border rounded" placeholder="Nama Barang" />
                                <input type="number" value={item.price} onChange={(e) => { const newItems = [...field.items]; newItems[idx].price = parseInt(e.target.value); onUpdate({ items: newItems }); }} className="w-24 p-2 text-sm border rounded" placeholder="Rp" />
                            </div>
                        ))}
                        <button onClick={() => onUpdate({ items: [...(field.items || []), { id: `item${Date.now()}`, name: '', sizes: ['S'], price: 0 }] })} className="text-xs text-blue-600 font-bold">Tambah Barang</button>
                    </div>
                )}

                {/* Conditional Logic Editor */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-3 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8L22 12L18 16"/><path d="M6 8L2 12L6 16"/><path d="M9 4L15 20"/></svg>
                    ATUR LOGIKA TAMPIL
                  </p>
                  
                  {field.condition ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-zinc-500 font-medium">Tampilkan jika</span>
                        <select
                          value={field.condition.fieldId}
                          onChange={(e) => {
                            if (!e.target.value) {
                              onUpdate({ condition: undefined });
                              return;
                            }
                            const parentField = allFields.find((f: any) => f.id === e.target.value);
                            const firstOpt = parentField?.options?.[0]?.value || '';
                            onUpdate({ condition: { fieldId: e.target.value, operator: 'eq', value: firstOpt } });
                          }}
                          className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none flex-1 min-w-[140px]"
                        >
                          <option value="">-- Pilih Field --</option>
                          {allFields
                            ?.filter((f: any) => f.id !== field.id && ['radio','select','checkbox'].includes(f.type))
                            .map((f: any) => (
                              <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={field.condition.operator}
                          onChange={(e) => onUpdate({ condition: { ...field.condition, operator: e.target.value } })}
                          className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none"
                        >
                          <option value="eq">sama dengan</option>
                          <option value="neq">tidak sama</option>
                          <option value="in">salah satu</option>
                        </select>

                        {(() => {
                          const parentField = allFields?.find((f: any) => f.id === field.condition.fieldId);
                          const hasOptions = parentField?.options?.length > 0;
                          
                          if (hasOptions) {
                            return (
                              <select
                                value={field.condition.value}
                                onChange={(e) => onUpdate({ condition: { ...field.condition, value: e.target.value } })}
                                className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none flex-1 min-w-[120px]"
                              >
                                <option value="">-- Pilih Nilai --</option>
                                {parentField.options.map((opt: any) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            );
                          }
                          return (
                            <input
                              type="text"
                              value={field.condition.value as string}
                              onChange={(e) => onUpdate({ condition: { ...field.condition, value: e.target.value } })}
                              placeholder="Nilai pemicu..."
                              className="flex-1 p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none min-w-[120px]"
                            />
                          );
                        })()}

                        <button
                          onClick={() => onUpdate({ condition: undefined })}
                          className="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => onUpdate({ condition: { fieldId: '', operator: 'eq', value: '' } })}
                      className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-[#673AB7] hover:bg-[#673AB7]/5 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Aturan Logika
                    </button>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end gap-4 mt-6">
                    <button onClick={onDuplicate} title="Duplikasikan" className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <Copy className="w-5 h-5" />
                    </button>
                    <button onClick={onDelete} title="Hapus" className="p-2 text-zinc-500 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-2" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Wajib diisi</span>
                        <button 
                            type="button"
                            onClick={() => onUpdate({ required: !field.required })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${field.required ? 'bg-[#673AB7]' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                        >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${field.required ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </motion.div>
  );
}