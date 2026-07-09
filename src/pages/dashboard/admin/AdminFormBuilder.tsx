import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  ClipboardList, Plus, X, Trash2, Save, MoveUp, MoveDown,
  Type, List, CheckSquare, Calendar, Loader2, ChevronRight,
  Settings, AlertCircle, Copy, Link2, ImageIcon,
  Sliders, Upload, ShoppingBag, MoreVertical, LayoutTemplate, MoreHorizontal,
  Sparkles, Users, DollarSign, Palette
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { FormConfig, FormField, FormOption, AddonItem, FieldType } from '../../../types/form';
import FormCanvas from '../../../components/forms/FormCanvas';
import { parseAIResponse } from '../../../utils/aiResponseParser';

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
    fields: [],
    layout_type: 'classic',
    font_family: 'Inter',
    input_style: 'rounded',
    bg_image_url: '',
    card_glassmorphism: false
  });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  
  // Program Linking State
  const [linkedProgramId, setLinkedProgramId] = useState<string>('');
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([]);

  // AI Chat Assistant
  const [showAIChat, setShowAIChat] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'ai' | 'design'>('ai');
  const [aiMessages, setAiMessages] = useState<{role:'user'|'ai', content:string}[]>([
    {role:'ai', content:'Halo! Saya asisten AI untuk membuat formulir. Ceritakan formulir apa yang ingin kamu buat? 😊'}
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  // Preview mode state managed internally by FormCanvas
  const [dragFieldIndex, setDragFieldIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Dynamic font loader for preview
  useEffect(() => {
    const font = editingForm.font_family || 'Inter';
    if (font !== 'Inter') {
      const linkId = 'dynamic-preview-font-stylesheet';
      let link = document.getElementById(linkId) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;700;800;900&display=swap`;
    }
  }, [editingForm.font_family]);

  const sendAIChat = async () => {
    const text = aiChatInput.trim();
    if (!text || aiChatLoading) return;
    setAiChatInput('');
    const updatedMessages = [...aiMessages, { role: 'user' as const, content: text }];
    setAiMessages(updatedMessages);
    setAiChatLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const conversation = updatedMessages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content
      }));
      const res = await fetch('/api/ai/generate-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          messages: conversation,
          currentForm: editingForm
        }),
      });
      const json = await res.json();
      if (json.success) {
        const { chatContent, updatedForm } = parseAIResponse(json);
        setAiMessages(prev => [...prev, { role: 'ai', content: chatContent }]);
        if (updatedForm) {
          setEditingForm(updatedForm);
          toast.success('Formulir diperbarui oleh AI!');
        }
      } else {
        toast.error('AI gagal merespons. Coba lagi.');
      }
    } catch {
      toast.error('Gagal menghubungi AI. Coba lagi.');
    } finally {
      setAiChatLoading(false);
    }
  };

  const handleShortcutClick = async (text: string) => {
    if (aiChatLoading) return;
    const updatedMessages = [...aiMessages, { role: 'user' as const, content: text }];
    setAiMessages(updatedMessages);
    setAiChatLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const conversation = updatedMessages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content
      }));
      const res = await fetch('/api/ai/generate-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          messages: conversation,
          currentForm: editingForm
        }),
      });
      const json = await res.json();
      if (json.success) {
        const { chatContent, updatedForm } = parseAIResponse(json);
        setAiMessages(prev => [...prev, { role: 'ai', content: chatContent }]);
        if (updatedForm) {
          setEditingForm(updatedForm);
          toast.success('Formulir diperbarui oleh AI!');
        }
      } else {
        toast.error('AI gagal merespons. Coba lagi.');
      }
    } catch {
      toast.error('Gagal menghubungi AI. Coba lagi.');
    } finally {
      setAiChatLoading(false);
    }
  };

  // Department targeting
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [targetNiks, setTargetNiks] = useState('');
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetCutoffDate, setTargetCutoffDate] = useState('');

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
      label: type === 'addon_group' ? 'Pesanan Ekstra (Mandiri)' : type === 'payment_section' ? 'Pembayaran' : 'Pertanyaan Tanpa Judul',
      required: false,
      placeholder: 'Masukkan jawaban...',
      options: type === 'select' || type === 'radio' || type === 'image_choice' 
        ? [{ value: 'opt1', label: 'Opsi 1', image: '' }] 
        : undefined,
      max: type === 'rating' ? 5 : undefined,
      max_scale: type === 'scale' ? 10 : undefined,
      items: type === 'addon_group' ? [{ id: 'item1', name: 'Baju Tambahan', sizes: ['S','M','L','XL'], price: 0 }] : undefined,
      allow_multiple: type === 'addon_group' ? true : undefined,
      qris_image_url: type === 'payment_section' ? '' : undefined,
      account_name: type === 'payment_section' ? '' : undefined,
      payment_description: type === 'payment_section' ? '' : undefined,
      verify_with_ai: type === 'payment_section' ? true : undefined,
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
        let query = supabase.from('employees').select('nik').in('department', targetDepartments);
        if (targetCutoffDate) {
          query = query.lte('tanggal_masuk', targetCutoffDate);
        }
        const { data: deptEmployees } = await query;
        resolvedDeptNiks = (deptEmployees || []).map(e => e.nik).filter(Boolean);
      }

      const allNiks = [...new Set([...nikArray, ...resolvedDeptNiks])];

      const payload: any = {
        title: editingForm.title,
        description: JSON.stringify({
          text: editingForm.description || '',
          theme: editingForm.theme_color || '#673AB7',
          banner: editingForm.banner_url || '',
          layout_type: editingForm.layout_type || 'classic',
          font_family: editingForm.font_family || 'Inter',
          input_style: editingForm.input_style || 'rounded',
          bg_image_url: editingForm.bg_image_url || '',
          card_glassmorphism: editingForm.card_glassmorphism || false
        }),
        fields: cleanFields,
        is_active: true,
        target_niks: allNiks.length > 0 ? allNiks : null,
        target_departments: targetDepartments.length > 0 ? targetDepartments : null,
        target_cutoff_date: targetCutoffDate || null
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditingForm({
                      title: 'Formulir Tanpa Judul',
                      description: '',
                      theme_color: '#673AB7',
                      banner_url: '',
                      fields: [],
                      layout_type: 'classic',
                      font_family: 'Inter',
                      input_style: 'rounded',
                      bg_image_url: '',
                      card_glassmorphism: false
                    });
                    setLinkedProgramId('');
                    setTargetNiks('');
                    setTargetDepartments([]);
                    setTargetCutoffDate('');
                    setAiMessages([{role:'ai', content:'Halo! Saya asisten AI untuk membuat dan merancang formulir ini. Ceritakan formulir seperti apa yang ingin kamu buat? 😊'}]);
                    setShowEditor(true);
                    setShowAIChat(true);
                  }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap"
                >
                  <Sparkles className="w-5 h-5" />
                  Buat dengan AI
                </button>
                <button
                  onClick={() => {
                    setEditingForm({
                      title: 'Formulir Tanpa Judul',
                      description: '',
                      theme_color: '#673AB7',
                      banner_url: '',
                      fields: [],
                      layout_type: 'classic',
                      font_family: 'Inter',
                      input_style: 'rounded',
                      bg_image_url: '',
                      card_glassmorphism: false
                    });
                    setLinkedProgramId('');
                    setTargetNiks('');
                    setTargetDepartments([]);
                    setTargetCutoffDate('');
                    setShowEditor(true);
                    setShowAIChat(false);
                  }}
                  className="bg-[#673AB7] hover:bg-[#5E35B1] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap"
                >
                  <Plus className="w-5 h-5" />
                  Buat Formulir
                </button>
              </div>
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
                              let layout_type = 'classic';
                              let font_family = 'Inter';
                              let input_style = 'rounded';
                              let bg_image_url = '';
                              let card_glassmorphism = false;
                              try {
                                const parsed = JSON.parse(form.description);
                                if (parsed.text !== undefined) {
                                  desc = parsed.text;
                                  theme = parsed.theme || '#673AB7';
                                  banner = parsed.banner || '';
                                  layout_type = parsed.layout_type || 'classic';
                                  font_family = parsed.font_family || 'Inter';
                                  input_style = parsed.input_style || 'rounded';
                                  bg_image_url = parsed.bg_image_url || '';
                                  card_glassmorphism = parsed.card_glassmorphism || false;
                                }
                              } catch(e) {}
                              setEditingForm({ 
                                ...form, 
                                description: desc, 
                                theme_color: theme, 
                                banner_url: banner,
                                layout_type,
                                font_family,
                                input_style,
                                bg_image_url,
                                card_glassmorphism
                              }); 
                              setTargetNiks(form.target_niks?.join('\n') || '');
                              setTargetDepartments(form.target_departments || []);
                              setTargetCutoffDate(form.target_cutoff_date || '');
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
         <div className="max-w-[1600px] mx-auto pb-32">
            {/* Editor Header */}
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between mb-6 bg-white dark:bg-zinc-900 p-4 rounded-3xl md:rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800 sticky top-4 z-50">
               <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                 <button onClick={() => setShowEditor(false)} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-200 font-bold px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-xs">
                    Kembali
                 </button>
                 
                 {/* Mode Tabs */}
                 <div className="bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 flex items-center shadow-inner">
                   <button
                     onClick={() => setIsPreviewMode(false)}
                     className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                       !isPreviewMode
                         ? 'bg-[#673AB7] text-white shadow-sm'
                         : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-250'
                     }`}
                   >
                     Desain Form
                   </button>
                   <button
                     onClick={() => setIsPreviewMode(true)}
                     className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                       isPreviewMode
                         ? 'bg-[#673AB7] text-white shadow-sm'
                         : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-250'
                     }`}
                   >
                     Pratinjau Live
                   </button>
                 </div>
               </div>

               <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button 
                      onClick={() => { 
                        if (showAIChat && sidebarTab === 'ai') {
                          setShowAIChat(false);
                        } else {
                          setShowAIChat(true);
                          setSidebarTab('ai');
                        }
                      }} 
                      className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 transition-all text-xs ${
                        showAIChat && sidebarTab === 'ai'
                          ? 'bg-[#673AB7] text-white shadow-md'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                      }`}
                    >
                       <Sparkles className="w-3.5 h-3.5" /> AI Assistant
                    </button>
                    <button 
                      onClick={() => { 
                        if (showAIChat && sidebarTab === 'design') {
                          setShowAIChat(false);
                        } else {
                          setShowAIChat(true);
                          setSidebarTab('design');
                        }
                      }} 
                      className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 transition-all text-xs ${
                        showAIChat && sidebarTab === 'design'
                          ? 'bg-[#673AB7] text-white shadow-md'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                       <Palette className="w-3.5 h-3.5" /> Tema & Gaya
                    </button>
                    <button onClick={handleSave} disabled={saving} className="bg-[#673AB7] text-white px-5 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-[#5E35B1] transition-all text-xs">
                       {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
                    </button>
                </div>
             </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
               {/* Left Panel: Form Workspace */}
               <div 
                 className={`flex-1 w-full relative transition-all duration-300 rounded-3xl p-4 md:p-8 min-h-[75vh] ${
                   showAIChat ? 'lg:max-w-[70%]' : 'max-w-4xl mx-auto'
                 }`}
                 style={{
                   backgroundImage: editingForm.bg_image_url ? `url(${editingForm.bg_image_url})` : undefined,
                   backgroundSize: 'cover',
                   backgroundPosition: 'center',
                   backgroundAttachment: 'local'
                 }}
               >
                 {editingForm.bg_image_url && (
                   <div className="absolute inset-0 bg-black/35 dark:bg-black/55 backdrop-blur-[2px] rounded-3xl pointer-events-none z-0" />
                 )}
                 
                 <div className="relative z-10" style={{ fontFamily: editingForm.font_family || 'Inter' }}>
                   {!isPreviewMode ? (
                     <>
                       {/* Main Form Title Card */}
                       <div 
                           onClick={() => setActiveFieldId('header')}
                           style={{
                             borderColor: activeFieldId === 'header' ? (editingForm.theme_color || '#673AB7') : undefined
                           }}
                           className={`rounded-2xl overflow-hidden border transition-all mb-4 relative ${
                               editingForm.card_glassmorphism 
                                 ? 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-white/20 dark:border-zinc-800/50 shadow-md' 
                                 : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm'
                           } ${activeFieldId === 'header' ? 'shadow-lg ring-1' : 'shadow-sm'}`}
                       >
                           <div className="h-3 w-full" style={{ backgroundColor: editingForm.theme_color || '#673AB7' }} />
                           {activeFieldId === 'header' && <div className="absolute left-0 top-3 bottom-0 w-1.5" style={{ backgroundColor: editingForm.theme_color || '#673AB7' }} />}
                           
                           <div className={`p-6 md:p-8 flex flex-col ${editingForm.layout_type === 'card' ? 'items-center text-center' : ''}`}>
                                {editingForm.layout_type === 'card' && (
                                  <span className="self-end bg-[#673AB7]/10 text-[#673AB7] text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider mb-4" style={{ color: editingForm.theme_color, backgroundColor: `${editingForm.theme_color}15` }}>
                                    Welcome Slide
                                  </span>
                                )}

                                {editingForm.layout_type === 'card' && editingForm.banner_url && (
                                  <div className="w-full max-w-[240px] h-20 overflow-hidden rounded-xl mb-4 border border-zinc-150 dark:border-zinc-800">
                                    <img src={editingForm.banner_url} alt="Logo" className="w-full h-full object-cover" />
                                  </div>
                                )}

                                <input
                                    type="text"
                                    value={editingForm.title}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, title: e.target.value }))}
                                    className={`text-4xl font-normal w-full bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-[var(--theme-color)] focus:ring-0 px-0 py-2 mb-4 text-zinc-900 dark:text-white transition-colors ${editingForm.layout_type === 'card' ? 'text-center font-bold' : ''}`}
                                    placeholder="Judul Formulir"
                                    style={{ '--theme-color': editingForm.theme_color } as any}
                                />
                                <textarea
                                    value={editingForm.description}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, description: e.target.value }))}
                                    className={`w-full bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-[var(--theme-color)] focus:ring-0 px-0 py-2 text-zinc-650 dark:text-zinc-400 resize-none min-h-[60px] text-sm ${editingForm.layout_type === 'card' ? 'text-center' : ''}`}
                                    placeholder="Deskripsi formulir"
                                    style={{ '--theme-color': editingForm.theme_color } as any}
                                />

                                {editingForm.layout_type === 'card' && (
                                  <div className="pt-2 pb-2 w-full flex justify-center">
                                    <button
                                      type="button"
                                      disabled
                                      className="px-10 py-3 text-white font-black text-sm rounded-full shadow-md cursor-not-allowed opacity-90 flex items-center gap-1.5"
                                      style={{ backgroundColor: editingForm.theme_color || '#673AB7' }}
                                    >
                                      START &rarr;
                                    </button>
                                  </div>
                                )}

                               {activeFieldId === 'header' && (
                                   <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-4">
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
                                                                       ? 'bg-[#673AB7] text-white shadow-md'
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

                                       {/* Cutoff Tanggal Masuk */}
                                       <div className="flex flex-col gap-2 mb-4">
                                           <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-1.5">
                                               <Calendar className="w-3.5 h-3.5" /> Cutoff Tgl Masuk
                                           </label>
                                           <p className="text-[10px] text-zinc-400 -mt-1">Hanya karyawan dengan tgl masuk ≤ cutoff yang bisa mengisi</p>
                                           <input
                                               type="date"
                                               value={targetCutoffDate}
                                               onChange={(e) => setTargetCutoffDate(e.target.value)}
                                               className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:border-[#673AB7] outline-none"
                                           />
                                       </div>
                                   </div>
                               )}
                           </div>
                       </div>

                        {/* Form Fields */}
                        <div className="space-y-4">
                            <AnimatePresence>
                                {editingForm.fields?.map((field, index) => (
                                    <div
                                        key={field.id}
                                        draggable
                                        onDragStart={() => setDragFieldIndex(index)}
                                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                                        onDragEnd={() => { setDragFieldIndex(null); setDragOverIndex(null); }}
                                        onDrop={() => {
                                          if (dragFieldIndex !== null && dragFieldIndex !== index) {
                                            const reordered = [...(editingForm.fields || [])];
                                            const [moved] = reordered.splice(dragFieldIndex, 1);
                                            reordered.splice(index, 0, moved);
                                            setEditingForm(prev => ({ ...prev, fields: reordered }));
                                            setActiveFieldId(moved.id);
                                          }
                                          setDragFieldIndex(null);
                                          setDragOverIndex(null);
                                        }}
                                        className={`transition-all ${dragOverIndex === index && dragFieldIndex !== null && dragFieldIndex !== index ? 'ring-2 ring-purple-400/50 rounded-2xl scale-[1.01]' : ''}`}
                                    >
                                        <FieldCard 
                                            field={field}
                                            index={index}
                                            allFields={editingForm.fields || []}
                                            isActive={activeFieldId === field.id}
                                            onClick={() => setActiveFieldId(field.id)}
                                            onUpdate={(updates) => updateField(field.id, updates)}
                                            onMove={(dir) => moveField(index, dir)}
                                            onDuplicate={() => duplicateField(field)}
                                            onDelete={() => removeField(field.id)}
                                            isFirst={index === 0}
                                            isLast={index === (editingForm.fields?.length || 0) - 1}
                                            visualSettings={{
                                              font_family: editingForm.font_family,
                                              theme_color: editingForm.theme_color,
                                              input_style: editingForm.input_style,
                                              card_glassmorphism: editingForm.card_glassmorphism
                                            }}
                                        />
                                    </div>
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
                           <ToolbarButton icon={<DollarSign />} label="Pembayaran" onClick={() => addField('payment_section')} />
                       </div>
                     </>
                    ) : (
                      <FormCanvas
                        form={editingForm}
                        isGenerating={aiChatLoading}
                        onStart={() => {}}
                        onFinish={() => toast.success('Formulir berhasil dikirim (mode pratinjau)')}
                        onFieldClick={(id) => setActiveFieldId(id)}
                        activeFieldId={activeFieldId}
                      />
                    )}
                  </div>
                </div>

         {/* Right Panel: AI Sidebar */}
         {showAIChat && (
            <div className="w-full lg:w-[400px] lg:sticky lg:top-24 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl flex flex-col h-[600px] lg:h-[calc(100vh-12rem)] z-40 overflow-hidden">
              {/* Tabs Header */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setSidebarTab('ai')}
                  className={`flex-1 py-3.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                    sidebarTab === 'ai'
                      ? 'border-[#673AB7] text-[#673AB7] dark:text-white'
                      : 'border-transparent text-zinc-400 hover:text-zinc-650'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Asisten AI
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('design')}
                  className={`flex-1 py-3.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                    sidebarTab === 'design'
                      ? 'border-[#673AB7] text-[#673AB7] dark:text-white'
                      : 'border-transparent text-zinc-400 hover:text-zinc-655'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" /> Desain Visual
                </button>
                <button
                  type="button"
                  onClick={() => setShowAIChat(false)}
                  className="px-4 py-3 text-zinc-400 hover:text-zinc-600 border-b-2 border-transparent"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {sidebarTab === 'design' ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-1">Desain Visual Formulir</h3>
                    <p className="text-xs text-zinc-500">Kustomisasi visual ala JotForm untuk mempercantik tampilan.</p>
                  </div>

                  {/* Theme Color */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Tema Warna (Hex)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={editingForm.theme_color || '#673AB7'}
                        onChange={(e) => setEditingForm(prev => ({ ...prev, theme_color: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer border border-zinc-200 dark:border-zinc-700 p-0"
                      />
                      <input
                        type="text"
                        value={editingForm.theme_color || '#673AB7'}
                        onChange={(e) => setEditingForm(prev => ({ ...prev, theme_color: e.target.value }))}
                        className="flex-1 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold uppercase outline-none focus:border-[#673AB7] text-zinc-800 dark:text-white"
                        placeholder="#673AB7"
                      />
                    </div>
                  </div>

                  {/* Layout Type */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Tipe Layout</label>
                    <select
                      value={editingForm.layout_type || 'classic'}
                      onChange={(e) => setEditingForm(prev => ({ ...prev, layout_type: e.target.value as any }))}
                      className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold outline-none focus:border-[#673AB7] text-zinc-800 dark:text-white"
                    >
                      <option value="classic">Classic Form (Scroll Kebawah)</option>
                      <option value="card">Card Form (Slide Per Kartu)</option>
                    </select>
                  </div>

                  {/* Font Family */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Gaya Huruf (Font)</label>
                    <select
                      value={editingForm.font_family || 'Inter'}
                      onChange={(e) => setEditingForm(prev => ({ ...prev, font_family: e.target.value }))}
                      className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold outline-none focus:border-[#673AB7] text-zinc-800 dark:text-white"
                    >
                      <option value="Inter">Inter (Clean & Modern)</option>
                      <option value="Outfit">Outfit (Friendly & Round)</option>
                      <option value="Playfair Display">Playfair Display (Elegant & Serif)</option>
                      <option value="Space Grotesk">Space Grotesk (Tech & Bold)</option>
                    </select>
                  </div>

                  {/* Input Style */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Gaya Input</label>
                    <select
                      value={editingForm.input_style || 'rounded'}
                      onChange={(e) => setEditingForm(prev => ({ ...prev, input_style: e.target.value as any }))}
                      className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold outline-none focus:border-[#673AB7] text-zinc-800 dark:text-white"
                    >
                      <option value="rounded">Rounded Card (Bulat Premium)</option>
                      <option value="sharp">Sharp Border (Kotak Minimalis)</option>
                      <option value="underline">Underline Only (Klasik Bawah)</option>
                    </select>
                  </div>

                  {/* Glassmorphism */}
                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none font-bold text-zinc-700 dark:text-zinc-350">
                      <input
                        type="checkbox"
                        checked={editingForm.card_glassmorphism || false}
                        onChange={(e) => setEditingForm(prev => ({ ...prev, card_glassmorphism: e.target.checked }))}
                        className="w-4 h-4 rounded border-zinc-305 text-[#673AB7] focus:ring-[#673AB7]"
                      />
                      <span>Efek Kaca Transparansi Blur</span>
                    </label>
                  </div>

                  {/* Background Image URL */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Gambar Latar Belakang (URL Background)</label>
                    <input
                      type="text"
                      value={editingForm.bg_image_url || ''}
                      onChange={(e) => setEditingForm(prev => ({ ...prev, bg_image_url: e.target.value }))}
                      className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-[#673AB7] font-semibold text-zinc-800 dark:text-white"
                      placeholder="https://example.com/background.jpg"
                    />
                  </div>
                </div>
              ) : (
                <>
                   {/* Messages */}
                   <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between">
                     <div>
                       {aiMessages.length === 0 ? (
                         <div className="flex flex-col justify-center items-center text-center p-4 space-y-5 my-auto pt-8">
                           <div className="p-3 bg-purple-50 dark:bg-zinc-900 rounded-full text-[#673AB7] shadow-inner animate-pulse">
                             <Sparkles className="w-6 h-6" />
                           </div>
                           <div>
                             <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Halo! Saya adalah Asisten AI SPS Corner.</p>
                             <p className="text-[10px] text-zinc-400 mt-1 max-w-[240px] mx-auto">Sebutkan formulir yang ingin Anda buat, atau gunakan pintasan cepat di bawah:</p>
                           </div>
                           
                           <div className="w-full space-y-2 pt-2 text-left">
                             <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Pilih Template Cepat:</p>
                             {[
                               "Buat Form Pendaftaran Anggota Koperasi",
                               "Buat Form Kritik & Saran dan Pengaduan",
                               "Buat Form Pemesanan Roti Sari Roti",
                               "Buat Form Evaluasi Program Acara Serikat"
                             ].map((shortcut, idx) => (
                               <button
                                 key={idx}
                                 type="button"
                                 onClick={() => handleShortcutClick(shortcut)}
                                 className="w-full text-left p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-[10px] font-bold text-zinc-650 dark:text-zinc-350 hover:border-[#673AB7] hover:text-[#673AB7] transition-all shadow-sm flex items-center gap-2 hover:scale-[1.01]"
                               >
                                 <Sparkles className="w-3.5 h-3.5 text-zinc-450" />
                                 {shortcut}
                               </button>
                             ))}
                           </div>
                         </div>
                       ) : (
                         aiMessages.map((msg, i) => (
                           <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
                             <div
                               className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                 msg.role === 'user'
                                   ? 'bg-[#673AB7] text-white rounded-br-none'
                                   : 'bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 text-zinc-850 dark:text-zinc-200 rounded-bl-none shadow-sm'
                               }`}
                             >
                               {msg.content}
                             </div>
                           </div>
                         ))
                       )}

                       {aiChatLoading && (
                         <div className="flex justify-start mb-3">
                           <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs flex items-center gap-1.5 shadow-sm">
                             <span className="w-1.5 h-1.5 bg-zinc-450 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                             <span className="w-1.5 h-1.5 bg-zinc-450 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                             <span className="w-1.5 h-1.5 bg-zinc-450 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                           </div>
                         </div>
                       )}
                     </div>
                     <div ref={chatEndRef} />
                   </div>

                  {/* Input */}
                  <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-2">
                      <input
                        value={aiChatInput}
                        onChange={e => setAiChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIChat(); } }}
                        placeholder="Ubah tema ke merah, tambah field email..."
                        className="flex-1 px-4 py-2 text-xs rounded-full border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#673AB7] text-zinc-900 dark:text-white"
                        disabled={aiChatLoading}
                      />
                      <button
                        onClick={sendAIChat}
                        disabled={aiChatLoading || !aiChatInput.trim()}
                        className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {aiChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
         )}
         </div> {/* Close flex container */}
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
  field, allFields, isActive, onClick, onUpdate, onMove, onDuplicate, onDelete, isFirst, isLast, visualSettings, index 
}: any) {
  
  const themeColor = visualSettings?.theme_color || '#673AB7';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      style={{
        borderColor: isActive ? themeColor : undefined,
        fontFamily: visualSettings?.font_family || 'Inter',
        '--theme-color': themeColor
      } as any}
      className={`rounded-2xl overflow-hidden transition-all relative ${
        visualSettings?.card_glassmorphism 
          ? 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 shadow-md' 
          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm'
      } ${isActive ? 'shadow-xl ring-1' : ''}`}
    >
      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: themeColor }} />}
      
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {visualSettings?.layout_type === 'card' && (
                          <span className="text-[9px] font-black bg-zinc-100 dark:bg-zinc-805 text-zinc-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Slaid {index + 1}
                          </span>
                        )}
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
                        <div className="text-xs text-[#673AB7] font-bold flex items-center gap-1.5" style={{ color: themeColor }}>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8L22 12L18 16"/><path d="M6 8L2 12L6 16"/><path d="M9 4L15 20"/></svg>
                          Tampil jika "{label}" {opLabel} "{valDisplay}"
                        </div>
                      );
                    })()}
                    <div className="text-sm text-zinc-400 border-b border-dashed border-zinc-300 pb-1 w-2/3">
                        {field.type === 'payment_section' ? '💳 Pembayaran QRIS' : field.type === 'radio' ? 'Opsi 1' : field.type === 'text' ? 'Teks jawaban singkat' : field.placeholder}
                    </div>
                </div>
        ) : (
            // Edit Mode
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 md:items-start">
                    <div className="flex-1 flex flex-col gap-1.5">
                        {visualSettings?.layout_type === 'card' && (
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">
                            Slaid Kartu Pertanyaan Ke-{index + 1}
                          </span>
                        )}
                        <input
                            type="text"
                            value={field.label}
                            onChange={(e) => onUpdate({ label: e.target.value })}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border-b-2 border-zinc-300 focus:border-[var(--theme-color)] p-3 text-base text-zinc-900 dark:text-white outline-none rounded-t-md font-semibold"
                            placeholder="Pertanyaan"
                            style={{ '--theme-color': themeColor } as any}
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
                        <option value="payment_section">Pembayaran QRIS</option>
                    </select>
                </div>

                {/* Option Editor for Multiple Choice */}
                {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                    <div className="space-y-3">
                        {field.options?.map((opt: any, optIndex: number) => (
                            <div key={optIndex} className="flex items-center gap-2 group">
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
                                    className="flex-1 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#673AB7] py-1 text-sm outline-none dark:text-white min-w-0"
                                    placeholder={`Opsi ${optIndex + 1}`}
                                />
                                <div className="flex items-center gap-1 text-sm text-zinc-400">
                                    <span>Rp</span>
                                    <input
                                        type="number"
                                        value={opt.price || ''}
                                        onChange={(e) => {
                                            const newOpts = [...(field.options || [])];
                                            newOpts[optIndex] = { ...newOpts[optIndex], price: e.target.value ? parseInt(e.target.value) : undefined };
                                            onUpdate({ options: newOpts });
                                        }}
                                        className="w-20 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#673AB7] py-1 text-sm outline-none text-right dark:text-white"
                                        placeholder="0"
                                    />
                                </div>
                                <button onClick={() => {
                                    const newOpts = field.options?.filter((_:any, i:number) => i !== optIndex);
                                    onUpdate({ options: newOpts });
                                }} className="text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"><X className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full border-2 border-transparent flex-shrink-0" />
                            <button onClick={() => onUpdate({ options: [...(field.options || []), { value: `opt${Date.now()}`, label: `Opsi ${(field.options?.length || 0) + 1}`, image: '' }] })}
                            className="text-sm font-medium text-zinc-500 hover:text-[var(--theme-color)]">
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

                {/* Payment Section Editor */}
                {field.type === 'payment_section' && (
                    <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs font-bold text-zinc-500 uppercase">Pengaturan Pembayaran QRIS</p>
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Upload Gambar QRIS</label>
                            <input
                                type="text"
                                value={field.qris_image_url || ''}
                                onChange={(e) => onUpdate({ qris_image_url: e.target.value })}
                                className="w-full p-2 text-sm border rounded"
                                placeholder="https://example.com/qris.png"
                            />
                        </div>
                        {field.qris_image_url && (
                            <img src={field.qris_image_url} alt="QRIS" className="w-40 h-40 object-contain mx-auto rounded-lg border" />
                        )}
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-zinc-400 mb-1 block">Nama Rekening</label>
                                <input
                                    type="text"
                                    value={field.account_name || ''}
                                    onChange={(e) => onUpdate({ account_name: e.target.value })}
                                    className="w-full p-2 text-sm border rounded"
                                    placeholder="misal: SPS Corner"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Keterangan (opsional)</label>
                            <textarea
                                value={field.payment_description || ''}
                                onChange={(e) => onUpdate({ payment_description: e.target.value })}
                                className="w-full p-2 text-sm border rounded"
                                placeholder="misal: Transfer ke rekening di atas lalu upload bukti transfer"
                                rows={2}
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={field.verify_with_ai !== false}
                                onChange={(e) => onUpdate({ verify_with_ai: e.target.checked })}
                            />
                            Verifikasi bukti bayar otomatis dengan AI
                        </label>
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
                      className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-[var(--theme-color)] hover:bg-[var(--theme-color)]/5 px-3 py-2 rounded-lg transition-colors"
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