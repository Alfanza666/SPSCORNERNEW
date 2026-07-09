import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  ClipboardList, Plus, X, Trash2, Save, MoveUp, MoveDown,
  Type, List, CheckSquare, Calendar, Loader2, ChevronRight,
  Settings, AlertCircle, Copy, Link2, ImageIcon,
  Sliders, Upload, ShoppingBag, LayoutTemplate,
  Sparkles, Users, DollarSign, Palette, GripVertical,
  Star, Eye, EyeOff, ArrowLeft, Send, Menu,
  FileText, AlignLeft, CircleDot, ChevronDown, OptionIcon,
  GanttChart, Hash, Heart, HelpCircle
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

const FIELD_TEMPLATES: { type: FieldType; icon: React.ReactNode; label: string; color: string }[] = [
  { type: 'text', icon: <Type className="w-4 h-4" />, label: 'Teks Singkat', color: '#6366F1' },
  { type: 'textarea', icon: <AlignLeft className="w-4 h-4" />, label: 'Paragraf', color: '#8B5CF6' },
  { type: 'number', icon: <Hash className="w-4 h-4" />, label: 'Angka', color: '#06B6D4' },
  { type: 'select', icon: <ChevronDown className="w-4 h-4" />, label: 'Dropdown', color: '#10B981' },
  { type: 'radio', icon: <CircleDot className="w-4 h-4" />, label: 'Pilihan Ganda', color: '#F59E0B' },
  { type: 'checkbox', icon: <CheckSquare className="w-4 h-4" />, label: 'Centang', color: '#EC4899' },
  { type: 'rating', icon: <Star className="w-4 h-4" />, label: 'Bintang', color: '#F43F5E' },
  { type: 'scale', icon: <GanttChart className="w-4 h-4" />, label: 'Skala', color: '#14B8A6' },
  { type: 'date', icon: <Calendar className="w-4 h-4" />, label: 'Tanggal', color: '#8B5CF6' },
  { type: 'file_upload', icon: <Upload className="w-4 h-4" />, label: 'Upload File', color: '#6366F1' },
];

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
    theme_color: '#6366F1',
    banner_url: '',
    fields: [],
    layout_type: 'classic',
    font_family: 'Inter',
    input_style: 'rounded',
    bg_image_url: '',
    card_glassmorphism: false
  });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [linkedProgramId, setLinkedProgramId] = useState<string>('');
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([]);

  const [showAIChat, setShowAIChat] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'ai' | 'design'>('ai');
  const [aiMessages, setAiMessages] = useState<{role:'user'|'ai', content:string}[]>([
    {role:'ai', content:'Halo! Saya asisten AI untuk membuat formulir. Ceritakan formulir apa yang ingin kamu buat?'}
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [dragFieldIndex, setDragFieldIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
      link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
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
        body: JSON.stringify({ messages: conversation, currentForm: editingForm }),
      });
      const json = await res.json();
      if (json.success) {
        let { chatContent, updatedForm } = parseAIResponse(json);
        // Inline fallback: if parseAIResponse failed, try raw regex extraction
        if (!updatedForm && json.message) {
          try {
            const match = json.message.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              if (parsed.fields || parsed.updatedForm || parsed.title) {
                const formData = parsed.updatedForm || parsed;
                const fields = (formData.fields || []).map((f: any) => ({
                  id: f.id || Math.random().toString(36).substr(2, 9),
                  type: f.type || 'text',
                  label: f.label || 'Pertanyaan',
                  required: f.required || false,
                  placeholder: f.placeholder || '',
                  description: f.description || '',
                  options: ['select','radio','checkbox','image_choice'].includes(f.type) && f.options ? f.options.filter((o: any) => o.label?.trim()) : undefined,
                  max: f.type === 'rating' ? (f.max || 5) : undefined,
                  max_scale: f.type === 'scale' ? (f.max_scale || 10) : undefined,
                  condition: f.condition || undefined,
                  items: f.type === 'addon_group' ? f.items : undefined,
                  allow_multiple: f.type === 'addon_group' ? (f.allow_multiple ?? true) : undefined,
                  qris_image_url: f.type === 'payment_section' ? (f.qris_image_url || '') : undefined,
                  account_name: f.type === 'payment_section' ? (f.account_name || '') : undefined,
                  payment_description: f.type === 'payment_section' ? (f.payment_description || '') : undefined,
                  verify_with_ai: f.type === 'payment_section' ? (f.verify_with_ai ?? true) : undefined,
                }));
                updatedForm = {
                  title: formData.title || 'Formulir Tanpa Judul',
                  description: formData.description || '',
                  theme_color: formData.theme_color || '#6366F1',
                  banner_url: formData.banner_url || '',
                  layout_type: formData.layout_type || 'card',
                  font_family: formData.font_family || 'Inter',
                  input_style: formData.input_style || 'rounded',
                  bg_image_url: formData.bg_image_url || '',
                  card_glassmorphism: formData.card_glassmorphism || false,
                  fields,
                };
                chatContent = json.message
                  .replace(match[0], '')
                  .replace(/```json/g, '')
                  .replace(/```/g, '')
                  .trim() || 'Formulir berhasil diperbarui oleh AI.';
              }
            }
          } catch (e) {
            console.warn('[Inline fallback] Gagal parse JSON:', e);
          }
        }
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
        body: JSON.stringify({ messages: conversation, currentForm: editingForm }),
      });
      const json = await res.json();
      if (json.success) {
        let { chatContent, updatedForm } = parseAIResponse(json);
        if (!updatedForm && json.message) {
          try {
            const match = json.message.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              if (parsed.fields || parsed.updatedForm || parsed.title) {
                const formData = parsed.updatedForm || parsed;
                const fields = (formData.fields || []).map((f: any) => ({
                  id: f.id || Math.random().toString(36).substr(2, 9),
                  type: f.type || 'text',
                  label: f.label || 'Pertanyaan',
                  required: f.required || false,
                  placeholder: f.placeholder || '',
                  description: f.description || '',
                  options: ['select','radio','checkbox','image_choice'].includes(f.type) && f.options ? f.options.filter((o: any) => o.label?.trim()) : undefined,
                  max: f.type === 'rating' ? (f.max || 5) : undefined,
                  max_scale: f.type === 'scale' ? (f.max_scale || 10) : undefined,
                  condition: f.condition || undefined,
                  items: f.type === 'addon_group' ? f.items : undefined,
                  allow_multiple: f.type === 'addon_group' ? (f.allow_multiple ?? true) : undefined,
                  qris_image_url: f.type === 'payment_section' ? (f.qris_image_url || '') : undefined,
                  account_name: f.type === 'payment_section' ? (f.account_name || '') : undefined,
                  payment_description: f.type === 'payment_section' ? (f.payment_description || '') : undefined,
                  verify_with_ai: f.type === 'payment_section' ? (f.verify_with_ai ?? true) : undefined,
                }));
                updatedForm = {
                  title: formData.title || 'Formulir Tanpa Judul',
                  description: formData.description || '',
                  theme_color: formData.theme_color || '#6366F1',
                  banner_url: formData.banner_url || '',
                  layout_type: formData.layout_type || 'card',
                  font_family: formData.font_family || 'Inter',
                  input_style: formData.input_style || 'rounded',
                  bg_image_url: formData.bg_image_url || '',
                  card_glassmorphism: formData.card_glassmorphism || false,
                  fields,
                };
                chatContent = json.message
                  .replace(match[0], '')
                  .replace(/```json/g, '')
                  .replace(/```/g, '')
                  .trim() || 'Formulir berhasil diperbarui oleh AI.';
              }
            }
          } catch (e) {
            console.warn('[Shortcut fallback] Gagal parse JSON:', e);
          }
        }
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

  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [targetNiks, setTargetNiks] = useState('');
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetCutoffDate, setTargetCutoffDate] = useState('');

  useEffect(() => {
    if (showEditor) { fetchPrograms(); fetchDepartments(); }
  }, [showEditor]);

  const fetchPrograms = async () => {
    const { data } = await supabase.from('union_programs').select('id, name, program_type, is_active').eq('is_active', true).order('name');
    if (data) setAvailablePrograms(data);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('employees').select('department').neq('department', '').order('department');
    if (data) setAvailableDepartments([...new Set(data.map(d => d.department))]);
  };

  useEffect(() => { if (user) fetchForms(); }, [user]);

  const fetchForms = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('dynamic_forms').select('*').order('created_at', { ascending: false });
    if (error) toast.error('Gagal memuat formulir: ' + error.message);
    else setForms(data || []);
    setLoading(false);
  };

  const createNewField = (type: FieldType): FormField => ({
    id: Math.random().toString(36).substr(2, 9),
    type,
    label: type === 'addon_group' ? 'Pesanan Ekstra' : type === 'payment_section' ? 'Pembayaran' : 'Pertanyaan Baru',
    required: false,
    placeholder: 'Masukkan jawaban...',
    options: ['select','radio','image_choice'].includes(type) ? [{ value: 'opt1', label: 'Opsi 1', image: '' }] : undefined,
    max: type === 'rating' ? 5 : undefined,
    max_scale: type === 'scale' ? 10 : undefined,
    items: type === 'addon_group' ? [{ id: 'item1', name: 'Item', sizes: ['M'], price: 0 }] : undefined,
    allow_multiple: type === 'addon_group' ? true : undefined,
    qris_image_url: type === 'payment_section' ? '' : undefined,
    account_name: type === 'payment_section' ? '' : undefined,
    payment_description: type === 'payment_section' ? '' : undefined,
    verify_with_ai: type === 'payment_section' ? true : undefined,
  });

  const addField = (type: FieldType) => {
    const newField = createNewField(type);
    setEditingForm(prev => {
      const fields = [...(prev.fields || [])];
      const activeIndex = fields.findIndex(f => f.id === activeFieldId);
      if (activeIndex >= 0) fields.splice(activeIndex + 1, 0, newField);
      else fields.push(newField);
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
    setEditingForm(prev => ({ ...prev, fields: prev.fields?.filter(f => f.id !== id) }));
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
    if (!editingForm.title) { toast.error('Judul formulir wajib diisi'); return; }
    if (!editingForm.fields?.length) { toast.error('Tambahkan minimal satu pertanyaan'); return; }
    setSaving(true);
    try {
      const cleanFields = editingForm.fields.map(f => {
        if (['select','radio','image_choice'].includes(f.type) && f.options)
          return { ...f, options: f.options.filter(o => o.label.trim()) };
        if (f.type === 'addon_group' && f.items)
          return { ...f, items: f.items.filter(i => i.name.trim()) };
        return f;
      });

      const nikArray = targetNiks.trim()
        ? targetNiks.split(/[,\n;]/).map(n => n.trim()).filter(n => n.length >= 3) : [];

      let resolvedDeptNiks: string[] = [];
      if (targetDepartments.length > 0) {
        let q = supabase.from('employees').select('nik').in('department', targetDepartments);
        if (targetCutoffDate) q = q.lte('tanggal_masuk', targetCutoffDate);
        const { data } = await q;
        resolvedDeptNiks = (data || []).map(e => e.nik).filter(Boolean);
      }

      const payload = {
        title: editingForm.title,
        description: JSON.stringify({
          text: editingForm.description || '',
          theme: editingForm.theme_color || '#6366F1',
          banner: editingForm.banner_url || '',
          layout_type: editingForm.layout_type || 'classic',
          font_family: editingForm.font_family || 'Inter',
          input_style: editingForm.input_style || 'rounded',
          bg_image_url: editingForm.bg_image_url || '',
          card_glassmorphism: editingForm.card_glassmorphism || false
        }),
        fields: cleanFields,
        is_active: true,
        target_niks: [...new Set([...nikArray, ...resolvedDeptNiks])].length > 0 ? [...new Set([...nikArray, ...resolvedDeptNiks])] : null,
        target_departments: targetDepartments.length > 0 ? targetDepartments : null,
        target_cutoff_date: targetCutoffDate || null
      };

      let currentFormId = editingForm.id;
      if (editingForm.id) {
        const { error } = await supabase.from('dynamic_forms').update(payload).eq('id', editingForm.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('dynamic_forms').insert({ ...payload, created_by: user?.id }).select().single();
        if (error) throw error;
        currentFormId = data.id;
      }

      if (linkedProgramId && currentFormId) {
        await supabase.from('union_programs').update({ dynamic_form_id: currentFormId }).eq('id', linkedProgramId);
      }
      toast.success('Formulir disimpan!');
      setShowEditor(false);
      fetchForms();
    } catch (error: any) {
      toast.error('Gagal menyimpan: ' + error.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus formulir ini? Semua respon juga akan hilang.')) return;
    await supabase.from('dynamic_forms').delete().eq('id', id);
    toast.success('Formulir dihapus');
    fetchForms();
  };

  const copyFormLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/portal/forms/${id}`);
    toast.success('Link formulir disalin!');
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin'))
    return <div className="p-8 text-center font-bold text-red-500">Akses Ditolak</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {!showEditor ? (
        <FormListView
          forms={forms} loading={loading} user={user}
          onEdit={(form) => {
            let desc = form.description, theme = '#6366F1', banner = '', layout_type = 'classic',
                font_family = 'Inter', input_style = 'rounded', bg_image_url = '', card_glassmorphism = false;
            try {
              const p = JSON.parse(form.description);
              if (p.text !== undefined) { desc = p.text; theme = p.theme || '#6366F1'; banner = p.banner || '';
                layout_type = p.layout_type || 'classic'; font_family = p.font_family || 'Inter';
                input_style = p.input_style || 'rounded'; bg_image_url = p.bg_image_url || '';
                card_glassmorphism = p.card_glassmorphism || false; }
            } catch {}
            setEditingForm({ ...form, description: desc, theme_color: theme, banner_url: banner,
              layout_type, font_family, input_style, bg_image_url, card_glassmorphism });
            setTargetNiks(form.target_niks?.join('\n') || '');
            setTargetDepartments(form.target_departments || []);
            setTargetCutoffDate(form.target_cutoff_date || '');
            setShowEditor(true);
            supabase.from('union_programs').select('id').eq('dynamic_form_id', form.id).single().then(({ data }) =>
              setLinkedProgramId(data?.id || ''));
          }}
          onNewWithAI={() => {
            resetForm(); setShowEditor(true); setShowAIChat(true); setSidebarTab('ai'); setAiMessages([
              {role:'ai', content:'Halo! Saya asisten AI untuk membuat formulir. Ceritakan formulir seperti apa yang ingin kamu buat?'}
            ]);
          }}
          onNewManual={() => { resetForm(); setShowEditor(true); setShowAIChat(true); setSidebarTab('design'); }}
          onDelete={handleDelete}
          onCopyLink={copyFormLink}
          onViewResponses={(id) => navigate(`/dashboard/admin/forms/responses/${id}`)}
        />
      ) : (
        <EditorView
          editingForm={editingForm} setEditingForm={setEditingForm}
          activeFieldId={activeFieldId} setActiveFieldId={setActiveFieldId}
          isPreviewMode={isPreviewMode} setIsPreviewMode={setIsPreviewMode}
          showAIChat={showAIChat} setShowAIChat={setShowAIChat}
          sidebarTab={sidebarTab} setSidebarTab={setSidebarTab}
          aiMessages={aiMessages} setAiMessages={setAiMessages}
          aiChatInput={aiChatInput} setAiChatInput={setAiChatInput}
          aiChatLoading={aiChatLoading} setAiChatLoading={setAiChatLoading}
          chatEndRef={chatEndRef}
          dragFieldIndex={dragFieldIndex} setDragFieldIndex={setDragFieldIndex}
          dragOverIndex={dragOverIndex} setDragOverIndex={setDragOverIndex}
          linkedProgramId={linkedProgramId} setLinkedProgramId={setLinkedProgramId}
          availablePrograms={availablePrograms}
          targetNiks={targetNiks} setTargetNiks={setTargetNiks}
          targetDepartments={targetDepartments} setTargetDepartments={setTargetDepartments}
          targetCutoffDate={targetCutoffDate} setTargetCutoffDate={setTargetCutoffDate}
          availableDepartments={availableDepartments}
          saving={saving}
          onAddField={addField}
          onUpdateField={updateField}
          onRemoveField={removeField}
          onDuplicateField={duplicateField}
          onMoveField={moveField}
          onSendAIChat={sendAIChat}
          onShortcutClick={handleShortcutClick}
          onSave={handleSave}
          onBack={() => { setShowEditor(false); fetchForms(); }}
        />
      )}
    </div>
  );

  function resetForm() {
    setEditingForm({
      title: 'Formulir Tanpa Judul', description: '', theme_color: '#6366F1', banner_url: '',
      fields: [], layout_type: 'card', font_family: 'Inter', input_style: 'rounded',
      bg_image_url: '', card_glassmorphism: false
    });
    setActiveFieldId(null);
    setLinkedProgramId('');
    setTargetNiks('');
    setTargetDepartments([]);
    setTargetCutoffDate('');
    setAiMessages([{role:'ai', content:'Halo! Saya asisten AI untuk membuat formulir. Ceritakan formulir seperti apa yang ingin kamu buat?'}]);
    setIsPreviewMode(false);
  }
}

function FormListView({ forms, loading, onEdit, onNewWithAI, onNewManual, onDelete, onCopyLink, onViewResponses }: any) {
  const navigate = useNavigate();
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
            <LayoutTemplate className="w-8 h-8 text-indigo-500" />
            Formulir Dinamis
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Buat dan kelola formulir digital</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onNewWithAI} className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all active:scale-95">
            <Sparkles className="w-5 h-5" />
            Buat dengan AI
          </button>
          <button onClick={onNewManual} className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
            <Plus className="w-5 h-5" />
            Form Baru
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {loading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
        ) : forms.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <ClipboardList className="w-20 h-20 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500 font-bold">Belum Ada Formulir</p>
          </div>
        ) : forms.map((form: any) => (
          <div key={form.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-md transition-all group cursor-pointer flex flex-col">
            <div onClick={() => onEdit(form)} className="h-24 bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center border-b border-zinc-100 dark:border-zinc-800 relative">
              <LayoutTemplate className="w-12 h-12 text-indigo-300 dark:text-indigo-700" />
              {!form.is_active && <span className="absolute top-2 right-2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded-md font-bold">Draft</span>}
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1 mb-1">{form.title}</h3>
                <div className="text-xs text-zinc-500"><Type className="w-3 h-3 inline mr-1"/>{form.fields?.length || 0} Pertanyaan</div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <button onClick={(e) => { e.stopPropagation(); onViewResponses(form.id); }} className="text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
                  Lihat Respon
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onCopyLink(form.id); }} className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Copy className="w-4 h-4"/></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(form.id); }} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorView({
  editingForm, setEditingForm, activeFieldId, setActiveFieldId,
  isPreviewMode, setIsPreviewMode,
  showAIChat, setShowAIChat, sidebarTab, setSidebarTab,
  aiMessages, setAiMessages, aiChatInput, setAiChatInput,
  aiChatLoading, setAiChatLoading, chatEndRef,
  dragFieldIndex, setDragFieldIndex, dragOverIndex, setDragOverIndex,
  linkedProgramId, setLinkedProgramId, availablePrograms,
  targetNiks, setTargetNiks, targetDepartments, setTargetDepartments,
  targetCutoffDate, setTargetCutoffDate, availableDepartments,
  saving, onAddField, onUpdateField, onRemoveField, onDuplicateField,
  onMoveField, onSendAIChat, onShortcutClick, onSave, onBack
}: any) {
  const themeColor = editingForm.theme_color || '#6366F1';

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
          <input
            type="text" value={editingForm.title}
            onChange={(e) => setEditingForm((prev: any) => ({ ...prev, title: e.target.value }))}
            className="text-base font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-900 dark:text-white w-48 md:w-64"
            placeholder="Judul Formulir"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
            <button onClick={() => setIsPreviewMode(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!isPreviewMode ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
              <FileText className="w-3.5 h-3.5 inline mr-1" />Edit
            </button>
            <button onClick={() => setIsPreviewMode(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isPreviewMode ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
              <Eye className="w-3.5 h-3.5 inline mr-1" />Preview
            </button>
          </div>

          <button onClick={() => { setShowAIChat(true); setSidebarTab('ai'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              showAIChat && sidebarTab === 'ai'
                ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}>
            <Sparkles className="w-3.5 h-3.5" /> AI
          </button>
          <button onClick={() => { setShowAIChat(true); setSidebarTab('design'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              showAIChat && sidebarTab === 'design'
                ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}>
            <Palette className="w-3.5 h-3.5" /> Tema
          </button>

          <button onClick={onSave} disabled={saving}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Field Palette */}
        {!isPreviewMode && (
          <div className="hidden lg:flex flex-col w-56 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tambah Field</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {FIELD_TEMPLATES.map(t => (
                <button key={t.type} onClick={() => onAddField(t.type)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group">
                  <span className="p-1.5 rounded-md" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
                    {t.icon}
                  </span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Center: Form Canvas */}
        <div className={`flex-1 overflow-y-auto ${isPreviewMode ? 'bg-zinc-100 dark:bg-zinc-900' : 'bg-[#F8F9FC] dark:bg-zinc-950'}`}>
          <div className="max-w-3xl mx-auto p-4 md:p-8">
            {isPreviewMode ? (
              <FormCanvas
                form={editingForm}
                isGenerating={aiChatLoading}
                onStart={() => {}}
                onFinish={() => toast.success('Formulir berhasil dikirim (mode pratinjau)')}
                onFieldClick={(id: any) => setActiveFieldId(id)}
                activeFieldId={activeFieldId}
              />
            ) : (
              <div className="space-y-4">
                {/* Editable Form Header */}
                <div onClick={() => setActiveFieldId('header')}
                  className={`bg-white dark:bg-zinc-900 rounded-xl border transition-all ${
                    activeFieldId === 'header'
                      ? 'border-indigo-500 shadow-sm ring-1 ring-indigo-500/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}>
                  <div className="p-5 md:p-6">
                    <input type="text" value={editingForm.title}
                      onChange={(e) => setEditingForm((prev: any) => ({ ...prev, title: e.target.value }))}
                      className="text-2xl font-bold w-full bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-900 dark:text-white mb-2"
                      placeholder="Judul Formulir" />
                    <textarea value={editingForm.description}
                      onChange={(e) => setEditingForm((prev: any) => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-500 dark:text-zinc-400 resize-none text-sm min-h-[40px]"
                      placeholder="Deskripsi formulir (opsional)" rows={2} />
                  </div>

                  {activeFieldId === 'header' && (
                    <div className="px-5 pb-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                      <select value={linkedProgramId} onChange={(e) => setLinkedProgramId(e.target.value)}
                        className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500">
                        <option value="">-- Program Acara --</option>
                        {availablePrograms.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <textarea value={targetNiks} onChange={(e) => setTargetNiks(e.target.value)}
                        className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs outline-none h-14 resize-none font-mono"
                        placeholder="Target NIK (pisahkan dengan koma/enter)" />
                      <div className="flex flex-wrap gap-1.5">
                        {availableDepartments.map((dept: string) => {
                          const sel = targetDepartments.includes(dept);
                          return (
                            <button key={dept} type="button" onClick={() => setTargetDepartments((prev: string[]) =>
                              sel ? prev.filter((d: string) => d !== dept) : [...prev, dept])}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                                sel ? 'bg-indigo-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                              }`}>{dept}</button>);
                        })}
                      </div>
                      <input type="date" value={targetCutoffDate} onChange={(e) => setTargetCutoffDate(e.target.value)}
                        className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs outline-none" />
                    </div>
                  )}
                </div>

                {/* Field List */}
                <AnimatePresence>
                  {editingForm.fields?.map((field: FormField, index: number) => (
                    <motion.div key={field.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}>
                      <FieldCard
                        field={field} index={index}
                        allFields={editingForm.fields}
                        isActive={activeFieldId === field.id}
                        onClick={() => setActiveFieldId(field.id)}
                        onUpdate={(u: any) => onUpdateField(field.id, u)}
                        onMove={(d: any) => onMoveField(index, d)}
                        onDuplicate={() => onDuplicateField(field)}
                        onDelete={() => onRemoveField(field.id)}
                        isFirst={index === 0}
                        isLast={index === (editingForm.fields?.length || 0) - 1}
                        themeColor={themeColor}
                        dragFieldIndex={dragFieldIndex} setDragFieldIndex={setDragFieldIndex}
                        dragOverIndex={dragOverIndex} setDragOverIndex={setDragOverIndex}
                        onReorder={(from: number, to: number) => {
                          const f = [...(editingForm.fields || [])];
                          const [m] = f.splice(from, 1);
                          f.splice(to, 0, m);
                          setEditingForm((prev: any) => ({ ...prev, fields: f }));
                          setActiveFieldId(m.id);
                        }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Add Field Button */}
                <button onClick={() => onAddField('text')}
                  className="w-full py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-400 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                  <Plus className="w-4 h-4 inline mr-1" /> Tambah Field
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: AI Copilot / Design */}
        {showAIChat && (
          <div className="w-80 lg:w-96 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0">
            {/* Panel Header */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
              <button onClick={() => setSidebarTab('ai')}
                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  sidebarTab === 'ai' ? 'border-indigo-500 text-indigo-600 dark:text-white' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}>
                <Sparkles className="w-3.5 h-3.5" /> AI Copilot
              </button>
              <button onClick={() => setSidebarTab('design')}
                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  sidebarTab === 'design' ? 'border-indigo-500 text-indigo-600 dark:text-white' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}>
                <Palette className="w-3.5 h-3.5" /> Desain
              </button>
              <button onClick={() => setShowAIChat(false)} className="px-3 py-3 text-zinc-400 hover:text-zinc-600 border-b-2 border-transparent">
                <X className="w-4 h-4" />
              </button>
            </div>

            {sidebarTab === 'design' ? (
              <DesignPanel editingForm={editingForm} setEditingForm={setEditingForm} />
            ) : (
              <AICopilotPanel
                aiMessages={aiMessages} aiChatInput={aiChatInput} setAiChatInput={setAiChatInput}
                aiChatLoading={aiChatLoading} chatEndRef={chatEndRef}
                onSend={onSendAIChat} onShortcutClick={onShortcutClick}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AICopilotPanel({ aiMessages, aiChatInput, setAiChatInput, aiChatLoading, chatEndRef, onSend, onShortcutClick }: any) {
  const [showTemplates, setShowTemplates] = useState(true);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50 dark:bg-zinc-950">
        {aiMessages.length === 1 && showTemplates && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Halo! Saya asisten AI SPS Corner. Ceritakan formulir apa yang ingin kamu buat, atau pilih template di bawah:
              </div>
            </div>
            <div className="space-y-1.5 pl-8">
              {[
                "Buat Form Pendaftaran Anggota Koperasi",
                "Buat Form Kritik & Saran",
                "Buat Form Pemesanan Roti",
                "Buat Form Evaluasi Program"
              ].map((s, i) => (
                <button key={i} onClick={() => { setShowTemplates(false); onShortcutClick(s); }}
                  className="w-full text-left p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 transition-all flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-zinc-400 shrink-0" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {aiMessages.length > 1 && (
          <div className="space-y-3">
            {aiMessages.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-500 text-white rounded-br-none'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-bl-none shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {aiChatLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl rounded-bl-none px-4 py-2.5 text-xs flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2">
          <input value={aiChatInput} onChange={(e) => setAiChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Tulis deskripsi form..."
            className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-white"
            disabled={aiChatLoading} />
          <button onClick={onSend} disabled={aiChatLoading || !aiChatInput.trim()}
            className="p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-all">
            {aiChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

function DesignPanel({ editingForm, setEditingForm }: any) {
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tema Warna</label>
        <div className="flex items-center gap-2">
          <input type="color" value={editingForm.theme_color || '#6366F1'}
            onChange={(e) => setEditingForm((prev: any) => ({ ...prev, theme_color: e.target.value }))}
            className="w-8 h-8 rounded cursor-pointer border border-zinc-200 dark:border-zinc-700 p-0" />
          <input type="text" value={editingForm.theme_color || '#6366F1'}
            onChange={(e) => setEditingForm((prev: any) => ({ ...prev, theme_color: e.target.value }))}
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold uppercase outline-none focus:border-indigo-500 text-zinc-800 dark:text-white" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tipe Layout</label>
        <select value={editingForm.layout_type || 'classic'}
          onChange={(e) => setEditingForm((prev: any) => ({ ...prev, layout_type: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold outline-none focus:border-indigo-500 text-zinc-800 dark:text-white">
          <option value="classic">Classic (Scroll)</option>
          <option value="card">Card Form (Slide)</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Font</label>
        <select value={editingForm.font_family || 'Inter'}
          onChange={(e) => setEditingForm((prev: any) => ({ ...prev, font_family: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold outline-none focus:border-indigo-500 text-zinc-800 dark:text-white">
          <option value="Inter">Inter</option>
          <option value="Outfit">Outfit</option>
          <option value="Playfair Display">Playfair Display</option>
          <option value="Space Grotesk">Space Grotesk</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Gaya Input</label>
        <select value={editingForm.input_style || 'rounded'}
          onChange={(e) => setEditingForm((prev: any) => ({ ...prev, input_style: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold outline-none focus:border-indigo-500 text-zinc-800 dark:text-white">
          <option value="rounded">Rounded</option>
          <option value="sharp">Sharp</option>
          <option value="underline">Underline</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none font-bold text-zinc-700 dark:text-zinc-350">
          <input type="checkbox" checked={editingForm.card_glassmorphism || false}
            onChange={(e) => setEditingForm((prev: any) => ({ ...prev, card_glassmorphism: e.target.checked }))}
            className="w-4 h-4 rounded border-zinc-300 text-indigo-500 focus:ring-indigo-500" />
          Glassmorphism Effect
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Background Image URL</label>
        <input type="text" value={editingForm.bg_image_url || ''}
          onChange={(e) => setEditingForm((prev: any) => ({ ...prev, bg_image_url: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500 text-zinc-800 dark:text-white"
          placeholder="https://..." />
      </div>
    </div>
  );
}

function FieldCard({ field, index, allFields, isActive, onClick, onUpdate, onMove, onDuplicate, onDelete, isFirst, isLast, themeColor, dragFieldIndex, dragOverIndex, setDragFieldIndex, setDragOverIndex, onReorder }: any) {
  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={() => setDragFieldIndex(index)}
      onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
      onDragEnd={() => { setDragFieldIndex(null); setDragOverIndex(null); }}
      onDrop={() => { if (dragFieldIndex !== null && dragFieldIndex !== index) onReorder(dragFieldIndex, index); setDragFieldIndex(null); setDragOverIndex(null); }}
      className={`bg-white dark:bg-zinc-900 rounded-xl border transition-all ${
        isActive
          ? 'border-indigo-500 shadow-sm ring-1 ring-indigo-500/20'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      } ${dragFieldIndex === index ? 'opacity-50' : ''} ${dragOverIndex === index && dragFieldIndex !== index ? 'border-indigo-400 ring-2 ring-indigo-400/30 scale-[1.01]' : ''}`}
    >
      {!isActive ? (
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <GripVertical className="w-4 h-4 text-zinc-300 cursor-grab shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{field.label}</span>
                {field.required && <span className="text-red-400 text-xs">*</span>}
              </div>
              <span className="text-[11px] text-zinc-400 capitalize">{field.type.replace('_', ' ')}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-400 font-mono mr-2">#{index + 1}</span>
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1 text-zinc-400 hover:text-zinc-600 rounded"><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-zinc-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ) : (
        <FieldEditor
          field={field} index={index} allFields={allFields}
          onUpdate={onUpdate} onMove={onMove}
          onDuplicate={onDuplicate} onDelete={onDelete}
          isFirst={isFirst} isLast={isLast}
          themeColor={themeColor}
        />
      )}
    </div>
  );
}

function FieldEditor({ field, index, allFields, onUpdate, onMove, onDuplicate, onDelete, isFirst, isLast, themeColor }: any) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <GripVertical className="w-4 h-4 text-zinc-300 cursor-grab shrink-0" />
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Field #{index + 1}</span>
        <span className="text-[10px] text-zinc-300 capitalize">({field.type.replace('_', ' ')})</span>
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex-1">
          <input type="text" value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 p-1 text-sm text-zinc-900 dark:text-white outline-none font-semibold"
            placeholder="Pertanyaan" />
        </div>
        <select value={field.type} onChange={(e) => onUpdate({ type: e.target.value })}
          className="w-40 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium outline-none focus:border-indigo-500 text-zinc-800 dark:text-white">
          <option value="text">Teks Singkat</option>
          <option value="textarea">Paragraf</option>
          <option value="radio">Pilihan Ganda</option>
          <option value="checkbox">Centang</option>
          <option value="select">Dropdown</option>
          <option value="scale">Skala</option>
          <option value="date">Tanggal</option>
          <option value="rating">Bintang</option>
          <option value="file_upload">Upload File</option>
        </select>
      </div>

      {['select','radio','checkbox'].includes(field.type) && (
        <div className="space-y-2 pl-4 border-l-2 border-zinc-100 dark:border-zinc-800">
          {field.options?.map((opt: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              {field.type === 'radio' ? <CircleDot className="w-3.5 h-3.5 text-zinc-300" /> :
               field.type === 'checkbox' ? <CheckSquare className="w-3.5 h-3.5 text-zinc-300" /> :
               <span className="text-xs text-zinc-400 w-4">{i + 1}.</span>}
              <input type="text" value={opt.label}
                onChange={(e) => {
                  const newOpts = [...(field.options || [])];
                  newOpts[i] = { ...newOpts[i], label: e.target.value };
                  onUpdate({ options: newOpts });
                }}
                className="flex-1 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-indigo-500 py-0.5 text-xs outline-none dark:text-white"
                placeholder={`Opsi ${i + 1}`} />
              <button onClick={() => onUpdate({ options: field.options?.filter((_: any, j: number) => j !== i) })}
                className="text-zinc-300 hover:text-red-400 p-0.5"><X className="w-3 h-3" /></button>
            </div>
          ))}
          <button onClick={() => onUpdate({ options: [...(field.options || []), { value: `opt${Date.now()}`, label: `Opsi ${(field.options?.length || 0) + 1}` }] })}
            className="text-xs font-medium text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Tambah opsi
          </button>
        </div>
      )}

      {field.type === 'scale' && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Skala 1 hingga</span>
          <select value={field.max_scale || 5} onChange={(e) => onUpdate({ max_scale: parseInt(e.target.value) })}
            className="border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-xs outline-none">
            {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {field.type === 'addon_group' && (
        <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-between">
            Produk
            <label className="flex items-center gap-1.5 text-[10px] font-normal text-zinc-400">
              <input type="checkbox" checked={field.allow_multiple} onChange={(e) => onUpdate({ allow_multiple: e.target.checked })} /> Multi
            </label>
          </label>
          {field.items?.map((item: any, i: number) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={item.name} onChange={(e) => { const items = [...field.items]; items[i].name = e.target.value; onUpdate({ items }); }}
                className="flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700 outline-none" placeholder="Nama" />
              <input type="number" value={item.price} onChange={(e) => { const items = [...field.items]; items[i].price = parseInt(e.target.value) || 0; onUpdate({ items }); }}
                className="w-20 px-2 py-1 text-xs border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700 outline-none" placeholder="Rp" />
            </div>
          ))}
          <button onClick={() => onUpdate({ items: [...(field.items || []), { id: `item${Date.now()}`, name: '', sizes: ['M'], price: 0 }] })}
            className="text-xs text-indigo-500 font-medium">+ Barang</button>
        </div>
      )}

      {field.type === 'payment_section' && (
        <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">QRIS Image URL</label>
            <input type="text" value={field.qris_image_url || ''} onChange={(e) => onUpdate({ qris_image_url: e.target.value })}
              className="w-full px-2 py-1.5 text-xs border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700 outline-none" placeholder="https://..." />
          </div>
          {field.qris_image_url && <img src={field.qris_image_url} alt="QRIS" className="w-24 h-24 object-contain mx-auto rounded border" />}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500 block mb-1">Nama Rekening</label>
              <input type="text" value={field.account_name || ''} onChange={(e) => onUpdate({ account_name: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700 outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <input type="checkbox" checked={field.verify_with_ai !== false} onChange={(e) => onUpdate({ verify_with_ai: e.target.checked })} />
            Verifikasi AI
          </label>
        </div>
      )}

      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {!isFirst && <button onClick={(e) => { e.stopPropagation(); onMove('up'); }} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><MoveUp className="w-3.5 h-3.5" /></button>}
          {!isLast && <button onClick={(e) => { e.stopPropagation(); onMove('down'); }} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><MoveDown className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
            <span>Wajib</span>
            <button onClick={(e) => { e.stopPropagation(); onUpdate({ required: !field.required }); }}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${field.required ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${field.required ? 'translate-x-3.5' : 'translate-x-1'}`} />
            </button>
          </label>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Copy className="w-3.5 h-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-zinc-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {field.condition && (
        <div className="pt-0 text-[10px] text-indigo-500 font-medium flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          Tampil jika {(allFields || []).find((f: any) => f.id === field.condition.fieldId)?.label || '(field)'} {field.condition.operator === 'eq' ? '=' : field.condition.operator === 'neq' ? '≠' : '∈'} {Array.isArray(field.condition.value) ? field.condition.value.join(', ') : field.condition.value}
        </div>
      )}
    </div>
  );
}
