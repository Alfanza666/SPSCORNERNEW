import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  Plus, X, Trash2, Save, MoveUp, MoveDown,
  Type, CheckSquare, Calendar, Loader2,
  Settings, Copy, ImageIcon,
  Upload, LayoutTemplate,
  Palette, GripVertical,
  Star, Eye, ArrowLeft, Send,
  FileText, AlignLeft, CircleDot, ChevronDown,
  GanttChart, Hash, HelpCircle,
  Layers, Wand2, PanelLeftOpen, X as XIcon, BarChart3,
  ClipboardList, Search,
  MousePointer2, DollarSign, ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { FormConfig, FormField, FormOption, FieldType } from '../../../types/form';
import FormCanvas from '../../../components/forms/FormCanvas';
import FormFieldRenderer from '../../../components/forms/FormFieldRenderer';
import { parseAIResponse } from '../../../utils/aiResponseParser';

interface DynamicForm {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  is_active: boolean;
  created_at: string;
  target_niks?: string[];
  target_departments?: string[];
  target_cutoff_date?: string;
}

// ─── Field catalogue with JotForm-style grouping ───────────────────────────
const FIELD_GROUPS = [
  {
    label: 'Dasar',
    items: [
      { type: 'text' as FieldType, icon: Type, label: 'Teks Singkat', color: '#6366F1', bg: '#EEF2FF' },
      { type: 'textarea' as FieldType, icon: AlignLeft, label: 'Paragraf', color: '#8B5CF6', bg: '#F5F3FF' },
      { type: 'number' as FieldType, icon: Hash, label: 'Angka', color: '#06B6D4', bg: '#ECFEFF' },
      { type: 'date' as FieldType, icon: Calendar, label: 'Tanggal', color: '#8B5CF6', bg: '#F5F3FF' },
    ]
  },
  {
    label: 'Pilihan',
    items: [
      { type: 'select' as FieldType, icon: ChevronDown, label: 'Dropdown', color: '#10B981', bg: '#ECFDF5' },
      { type: 'radio' as FieldType, icon: CircleDot, label: 'Pilihan Ganda', color: '#F59E0B', bg: '#FFFBEB' },
      { type: 'checkbox' as FieldType, icon: CheckSquare, label: 'Centang', color: '#EC4899', bg: '#FDF2F8' },
    ]
  },
  {
    label: 'Rating',
    items: [
      { type: 'rating' as FieldType, icon: Star, label: 'Bintang', color: '#F43F5E', bg: '#FFF1F2' },
      { type: 'scale' as FieldType, icon: GanttChart, label: 'Skala', color: '#14B8A6', bg: '#F0FDFA' },
    ]
  },
  {
    label: 'Lainnya',
    items: [
      { type: 'file_upload' as FieldType, icon: Upload, label: 'Upload File', color: '#6366F1', bg: '#EEF2FF' },
      { type: 'image' as FieldType, icon: ImageIcon, label: 'Upload Gambar', color: '#0EA5E9', bg: '#F0F9FF' },
      { type: 'image_choice' as FieldType, icon: ImageIcon, label: 'Pilihan Gambar', color: '#D946EF', bg: '#FDF4FF' },
      { type: 'addon_group' as FieldType, icon: ShoppingCart, label: 'Daftar Pesanan', color: '#F97316', bg: '#FFF7ED' },
      { type: 'payment_section' as FieldType, icon: DollarSign, label: 'Pembayaran', color: '#059669', bg: '#ECFDF5' },
    ]
  },
];

const ALL_FIELD_TYPES = FIELD_GROUPS.flatMap(g => g.items);

function getFieldTypeDefaults(type: FieldType): Partial<FormField> {
  return {
    options: ['select', 'radio', 'checkbox', 'image_choice'].includes(type)
      ? [{ value: 'opt1', label: 'Opsi 1', image: '' }]
      : undefined,
    max: type === 'rating' ? 5 : undefined,
    max_scale: type === 'scale' ? 10 : undefined,
    items: type === 'addon_group' ? [{ id: 'item1', name: 'Item', sizes: ['M'], price: 0 }] : undefined,
    allow_multiple: type === 'addon_group' ? true : undefined,
    qris_image_url: type === 'payment_section' ? '' : undefined,
    account_name: type === 'payment_section' ? '' : undefined,
    payment_description: type === 'payment_section' ? '' : undefined,
    verify_with_ai: type === 'payment_section' ? true : undefined,
  };
}

// ─── Main Component ────────────────────────────────────────────────────────
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

  const [rightPanel, setRightPanel] = useState<'ai' | 'design' | 'settings' | null>('ai');
  const [isMobileFieldPaletteOpen, setIsMobileFieldPaletteOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [isCanvasDropActive, setIsCanvasDropActive] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'Halo! Saya asisten AI untuk membuat formulir. Ceritakan formulir apa yang ingin kamu buat?' }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [dragFieldIndex, setDragFieldIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [targetNiks, setTargetNiks] = useState('');
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetCutoffDate, setTargetCutoffDate] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

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

  useEffect(() => {
    if (showEditor) { fetchPrograms(); fetchDepartments(); }
  }, [showEditor]);

  useEffect(() => { if (user) fetchForms(); }, [user]);

  // ─── AI Chat ─────────────────────────────────────────────────────────────
  const runAIChat = async (messages: { role: 'user' | 'ai'; content: string }[]) => {
    setAiChatLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
      const conversation = messages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content
      }));
      const res = await fetch('/api/ai/generate-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: conversation, currentForm: editingForm }),
      });
      const responseText = await res.text();
      let json: any;
      try { json = JSON.parse(responseText); }
      catch { throw new Error(`Server AI mengembalikan respons tidak valid (${res.status}).`); }

      if (!res.ok || !json.success) throw new Error(json.error || 'AI gagal menghasilkan formulir.');

      const { chatContent, updatedForm } = parseAIResponse(json, editingForm);
      if (!updatedForm?.fields.length) throw new Error('AI tidak menghasilkan pertanyaan formulir.');

      setEditingForm(updatedForm);
      setActiveFieldId(updatedForm.fields[0]?.id || null);
      setIsPreviewMode(false);
      setAiMessages(prev => [...prev, { role: 'ai', content: `${chatContent}\n\n✓ ${updatedForm.fields.length} pertanyaan diterapkan ke canvas.` }]);
      if (window.innerWidth < 1280) setRightPanel(null);
      toast.success(`Formulir diterapkan: ${updatedForm.fields.length} pertanyaan`);
    } catch (error: any) {
      const message = error?.message || 'Gagal menghubungi AI. Coba lagi.';
      toast.error(message);
      setAiMessages(prev => [...prev, { role: 'ai', content: `Formulir belum dapat diterapkan: ${message}` }]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const sendAIChat = async () => {
    const text = aiChatInput.trim();
    if (!text || aiChatLoading) return;
    setAiChatInput('');
    const updated = [...aiMessages, { role: 'user' as const, content: text }];
    setAiMessages(updated);
    await runAIChat(updated);
  };

  const handleShortcutClick = async (text: string) => {
    if (aiChatLoading) return;
    const updated = [...aiMessages, { role: 'user' as const, content: text }];
    setAiMessages(updated);
    await runAIChat(updated);
  };

  // ─── Data helpers ─────────────────────────────────────────────────────────
  const fetchPrograms = async () => {
    const { data } = await supabase.from('union_programs').select('id, name, program_type, is_active').eq('is_active', true).order('name');
    if (data) setAvailablePrograms(data);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('employees').select('department').neq('department', '').order('department');
    if (data) setAvailableDepartments([...new Set(data.map(d => d.department))]);
  };

  const fetchForms = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('dynamic_forms').select('*').order('created_at', { ascending: false });
    if (error) toast.error('Gagal memuat formulir: ' + error.message);
    else setForms(data || []);
    setLoading(false);
  };

  // ─── Field CRUD ───────────────────────────────────────────────────────────
  const createNewField = (type: FieldType): FormField => ({
    id: Math.random().toString(36).substr(2, 9),
    type,
    label: type === 'addon_group' ? 'Pesanan Ekstra' : type === 'payment_section' ? 'Pembayaran' : 'Pertanyaan Baru',
    required: false,
    placeholder: 'Masukkan jawaban...',
    ...getFieldTypeDefaults(type),
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
      const idx = fields.findIndex(f => f.id === field.id);
      fields.splice(idx + 1, 0, newField);
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
      fields: prev.fields
        ?.filter(field => field.id !== id)
        .map(field => field.condition?.fieldId === id ? { ...field, condition: undefined } : field),
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

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editingForm.title) { toast.error('Judul formulir wajib diisi'); return; }
    if (!editingForm.fields?.length) { toast.error('Tambahkan minimal satu pertanyaan'); return; }
    setSaving(true);
    try {
      const cleanFields = editingForm.fields.map((f, index, fields) => {
        const hasValidParent = !f.condition || fields.slice(0, index).some(parent => parent.id === f.condition?.fieldId);
        const normalizedField = hasValidParent ? f : { ...f, condition: undefined };
        if (['select', 'radio', 'checkbox', 'image_choice'].includes(f.type) && f.options)
          return { ...normalizedField, options: f.options.filter(o => o.label.trim()) };
        if (f.type === 'addon_group' && f.items)
          return { ...normalizedField, items: f.items.filter(i => i.name.trim()) };
        return normalizedField;
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
      toast.success('✅ Formulir berhasil disimpan!');
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

  function resetForm() {
    setEditingForm({
      title: 'Formulir Tanpa Judul', description: '', theme_color: '#6366F1', banner_url: '',
      fields: [], layout_type: 'classic', font_family: 'Inter', input_style: 'rounded',
      bg_image_url: '', card_glassmorphism: false
    });
    setActiveFieldId(null);
    setLinkedProgramId('');
    setTargetNiks('');
    setTargetDepartments([]);
    setTargetCutoffDate('');
    setAiMessages([{ role: 'ai', content: 'Halo! Saya asisten AI untuk membuat formulir. Ceritakan formulir apa yang ingin kamu buat?' }]);
    setIsPreviewMode(false);
    setRightPanel('ai');
    setIsMobileFieldPaletteOpen(false);
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin'))
    return <div className="p-8 text-center font-bold text-red-500">Akses Ditolak</div>;

  // ─── List View ────────────────────────────────────────────────────────────
  if (!showEditor) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] dark:bg-zinc-950">
        {/* Header */}
        <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                <LayoutTemplate className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Form Builder</h1>
                <p className="text-xs text-zinc-500">Kelola formulir digital Anda</p>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
              <button
                onClick={() => { resetForm(); setShowEditor(true); setRightPanel('ai'); }}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-95"
              >
                <Wand2 className="w-4 h-4" /> Buat dengan AI
              </button>
              <button
                onClick={() => { resetForm(); setShowEditor(true); setRightPanel('design'); }}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Form Baru
              </button>
            </div>
          </div>
        </div>

        {/* Forms Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : forms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl flex items-center justify-center mb-4">
                <ClipboardList className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300 mb-1">Belum ada formulir</h3>
              <p className="text-sm text-zinc-400 mb-6">Buat formulir pertama Anda dengan AI atau manual</p>
              <button
                onClick={() => { resetForm(); setShowEditor(true); setRightPanel('ai'); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Wand2 className="w-4 h-4" /> Buat dengan AI
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {forms.map((form: any) => (
                <FormCard
                  key={form.id}
                  form={form}
                  onEdit={() => {
                    let desc = form.description, theme = '#6366F1', banner = '', layout_type = 'classic',
                      font_family = 'Inter', input_style = 'rounded', bg_image_url = '', card_glassmorphism = false;
                    try {
                      const p = JSON.parse(form.description);
                      if (p.text !== undefined) {
                        desc = p.text; theme = p.theme || '#6366F1'; banner = p.banner || '';
                        layout_type = p.layout_type || 'classic'; font_family = p.font_family || 'Inter';
                        input_style = p.input_style || 'rounded'; bg_image_url = p.bg_image_url || '';
                        card_glassmorphism = p.card_glassmorphism || false;
                      }
                    } catch { }
                    setEditingForm({
                      ...form, description: desc, theme_color: theme, banner_url: banner,
                      layout_type, font_family, input_style, bg_image_url, card_glassmorphism
                    });
                    setTargetNiks(form.target_niks?.join('\n') || '');
                    setTargetDepartments(form.target_departments || []);
                    setTargetCutoffDate(form.target_cutoff_date || '');
                    setRightPanel('design');
                    setShowEditor(true);
                    supabase.from('union_programs').select('id').eq('dynamic_form_id', form.id).single()
                      .then(({ data }) => setLinkedProgramId(data?.id || ''));
                  }}
                  onDelete={() => handleDelete(form.id)}
                  onCopyLink={() => copyFormLink(form.id)}
                  onViewResponses={() => navigate(`/dashboard/admin/forms/responses/${form.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Editor View ─────────────────────────────────────────────────────────
  const themeColor = editingForm.theme_color || '#6366F1';
  const fieldCount = editingForm.fields?.length || 0;
  const normalizedFieldSearch = fieldSearch.trim().toLocaleLowerCase('id-ID');
  const filteredFieldGroups = FIELD_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.label.toLocaleLowerCase('id-ID').includes(normalizedFieldSearch)),
    }))
    .filter(group => group.items.length > 0);

  const handlePaletteDragStart = (event: React.DragEvent, type: FieldType) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-sps-form-field', type);
  };

  const handleCanvasDrop = (event: React.DragEvent) => {
    const type = event.dataTransfer.getData('application/x-sps-form-field') as FieldType;
    setIsCanvasDropActive(false);
    if (!ALL_FIELD_TYPES.some(fieldType => fieldType.type === type)) return;
    event.preventDefault();
    addField(type);
  };

  return (
    <div className="h-screen flex flex-col bg-[#F0F2F7] dark:bg-zinc-950 overflow-hidden">
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 shadow-sm">
        <button
          onClick={() => { setShowEditor(false); fetchForms(); }}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Kembali</span>
        </button>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />

        {/* Title edit */}
        <input
          type="text"
          value={editingForm.title}
          onChange={(e) => setEditingForm(prev => ({ ...prev, title: e.target.value }))}
          className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-800 dark:text-white truncate max-w-xs"
          placeholder="Judul Formulir"
        />

        <div className="flex items-center gap-1.5 ml-auto">
          {!isPreviewMode && (
            <button
              type="button"
              onClick={() => setIsMobileFieldPaletteOpen(true)}
              title="Tambah elemen"
              aria-label="Buka daftar elemen formulir"
              className="lg:hidden p-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsPreviewMode(previous => !previous)}
            title={isPreviewMode ? 'Kembali mengedit' : 'Pratinjau formulir'}
            aria-label={isPreviewMode ? 'Kembali mengedit formulir' : 'Pratinjau formulir'}
            className={`sm:hidden rounded-lg p-2 transition-colors ${isPreviewMode ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            {isPreviewMode ? <FileText className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>

          {/* Edit/Preview toggle */}
          <div className="hidden sm:flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setIsPreviewMode(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${!isPreviewMode ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <FileText className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => setIsPreviewMode(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${isPreviewMode ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>

          {/* Panel toggles */}
          <button
            onClick={() => setRightPanel(rightPanel === 'ai' ? null : 'ai')}
            title="AI Copilot"
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${rightPanel === 'ai' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <Wand2 className="w-4 h-4" />
            <span className="hidden sm:inline">AI</span>
          </button>
          <button
            onClick={() => setRightPanel(rightPanel === 'design' ? null : 'design')}
            title="Desain"
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${rightPanel === 'design' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Tema</span>
          </button>
          <button
            onClick={() => setRightPanel(rightPanel === 'settings' ? null : 'settings')}
            title="Pengaturan"
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${rightPanel === 'settings' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Simpan
          </button>
        </div>
      </div>

      {/* ── Body: 3-column layout ─────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left Sidebar: Field Palette ─────────────────────────────────── */}
        {!isPreviewMode && (
          <div className="hidden lg:flex flex-col w-52 xl:w-60 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0 overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 z-10">
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Elemen Form</p>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={fieldSearch}
                  onChange={(event) => setFieldSearch(event.target.value)}
                  placeholder="Cari elemen..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-xs text-zinc-800 outline-none transition focus:border-indigo-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:bg-zinc-900"
                />
              </div>
            </div>
            <div className="p-3 space-y-4">
              {filteredFieldGroups.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1 mb-1.5">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map(item => (
                      <button
                        key={item.type}
                        type="button"
                        draggable
                        onDragStart={(event) => handlePaletteDragStart(event, item.type)}
                        onClick={() => addField(item.type)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group text-left cursor-grab active:cursor-grabbing"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
                          style={{ backgroundColor: item.bg, color: item.color }}>
                          <item.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredFieldGroups.length === 0 && (
                <p className="px-2 py-8 text-center text-xs text-zinc-400">Elemen tidak ditemukan.</p>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {!isPreviewMode && isMobileFieldPaletteOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Tutup daftar elemen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileFieldPaletteOpen(false)}
                className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-[1px] lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,360px)] flex-col bg-white shadow-2xl dark:bg-zinc-900 lg:hidden"
              >
                <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <PanelLeftOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">Tambah Elemen</p>
                    <p className="text-[11px] text-zinc-400">Pilih elemen untuk ditambahkan ke formulir</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileFieldPaletteOpen(false)}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="border-b border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="search"
                      value={fieldSearch}
                      onChange={(event) => setFieldSearch(event.target.value)}
                      placeholder="Cari elemen formulir..."
                      autoFocus
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    {filteredFieldGroups.flatMap(group => group.items).map(item => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          addField(item.type);
                          setIsMobileFieldPaletteOpen(false);
                        }}
                        className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-zinc-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: item.bg, color: item.color }}>
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span className="mt-3 text-xs font-semibold text-zinc-700 dark:text-zinc-200">{item.label}</span>
                      </button>
                    ))}
                  </div>
                  {filteredFieldGroups.length === 0 && (
                    <p className="py-12 text-center text-sm text-zinc-400">Elemen tidak ditemukan.</p>
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Center: Canvas ───────────────────────────────────────────────── */}
        <div
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('application/x-sps-form-field')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setIsCanvasDropActive(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            setIsCanvasDropActive(false);
          }}
          onDrop={handleCanvasDrop}
          className={`relative flex-1 overflow-y-auto transition-colors ${isPreviewMode ? 'bg-zinc-200/60 dark:bg-zinc-900' : 'bg-[#F0F2F7] dark:bg-zinc-950'} ${isCanvasDropActive ? 'bg-indigo-50 dark:bg-indigo-950/20' : ''}`}
        >
          {isCanvasDropActive && !isPreviewMode && (
            <div className="pointer-events-none sticky top-3 z-20 mx-auto -mb-14 flex w-fit items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg">
              <Plus className="h-3.5 w-3.5" /> Lepaskan untuk menambahkan elemen
            </div>
          )}
          <div className="max-w-2xl mx-auto px-4 py-8">
            {isPreviewMode ? (
              <FormCanvas
                form={editingForm}
                isGenerating={aiChatLoading}
                onStart={() => { }}
                onFinish={() => toast.success('Formulir dikirim (mode pratinjau)')}
                onFieldClick={(id: any) => setActiveFieldId(id)}
                activeFieldId={activeFieldId}
              />
            ) : (
              <div className="space-y-2">
                {/* Form Header Card */}
                <div
                  onClick={() => setActiveFieldId('header')}
                  className={`bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border transition-all cursor-pointer ${activeFieldId === 'header' ? 'border-indigo-400 shadow-md ring-2 ring-indigo-500/20' : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'}`}
                >
                  {/* Color bar */}
                  <div className="h-2 w-full" style={{ backgroundColor: themeColor }} />
                  <div className="p-6">
                    <input
                      type="text"
                      value={editingForm.title}
                      onChange={(e) => setEditingForm(prev => ({ ...prev, title: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xl font-bold w-full bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-900 dark:text-white mb-2"
                      placeholder="Judul Formulir"
                    />
                    <textarea
                      value={editingForm.description}
                      onChange={(e) => setEditingForm(prev => ({ ...prev, description: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-400 dark:text-zinc-500 resize-none text-sm min-h-[36px]"
                      placeholder="Deskripsi formulir (opsional)"
                      rows={2}
                    />
                  </div>

                  {activeFieldId === 'header' && (
                    <div className="px-6 pb-5 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3" onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Program / Target</p>
                      <select
                        value={linkedProgramId}
                        onChange={(e) => setLinkedProgramId(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500 text-zinc-700 dark:text-zinc-300"
                      >
                        <option value="">-- Tidak terhubung program --</option>
                        {availablePrograms.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <textarea
                        value={targetNiks}
                        onChange={(e) => setTargetNiks(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none h-16 resize-none font-mono"
                        placeholder="Target NIK (pisahkan dengan koma/enter)"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {availableDepartments.map((dept: string) => {
                          const sel = targetDepartments.includes(dept);
                          return (
                            <button key={dept} type="button"
                              onClick={() => setTargetDepartments(prev => sel ? prev.filter(d => d !== dept) : [...prev, dept])}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${sel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}>
                              {dept}
                            </button>
                          );
                        })}
                      </div>
                      <input type="date" value={targetCutoffDate}
                        onChange={(e) => setTargetCutoffDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500" />
                    </div>
                  )}
                </div>

                {/* Field Cards */}
                <AnimatePresence initial={false}>
                  {editingForm.fields?.map((field, index) => (
                    <motion.div key={field.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.15 }}>
                      <FieldCard
                        field={field}
                        index={index}
                        allFields={editingForm.fields}
                        isActive={activeFieldId === field.id}
                        onClick={() => setActiveFieldId(field.id === activeFieldId ? null : field.id)}
                        onUpdate={(u: Partial<FormField>) => updateField(field.id, u)}
                        onMove={(d: 'up' | 'down') => moveField(index, d)}
                        onDuplicate={() => duplicateField(field)}
                        onDelete={() => removeField(field.id)}
                        isFirst={index === 0}
                        isLast={index === (editingForm.fields?.length || 0) - 1}
                        themeColor={themeColor}
                        dragFieldIndex={dragFieldIndex}
                        setDragFieldIndex={setDragFieldIndex}
                        dragOverIndex={dragOverIndex}
                        setDragOverIndex={setDragOverIndex}
                        onReorder={(from: number, to: number) => {
                          const f = [...(editingForm.fields || [])];
                          const [m] = f.splice(from, 1);
                          f.splice(to, 0, m);
                          setEditingForm(prev => ({ ...prev, fields: f }));
                          setActiveFieldId(m.id);
                        }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Add field button */}
                <button
                  onClick={() => addField('text')}
                  className="w-full py-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-sm font-semibold text-zinc-400 hover:text-indigo-600 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Tambah Pertanyaan
                </button>

                {/* Stats bar */}
                {fieldCount > 0 && (
                  <div className="flex items-center justify-center gap-6 py-3 text-xs text-zinc-400">
                    <span><b className="text-zinc-600 dark:text-zinc-300">{fieldCount}</b> pertanyaan</span>
                    <span><b className="text-zinc-600 dark:text-zinc-300">{editingForm.fields?.filter(f => f.required).length}</b> wajib diisi</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ───────────────────────────────────────────────────── */}
        {rightPanel && (
          <button
            type="button"
            aria-label="Tutup panel samping"
            onClick={() => setRightPanel(null)}
            className="fixed inset-0 z-30 bg-zinc-950/35 backdrop-blur-[1px] xl:hidden"
          />
        )}
        <AnimatePresence>
          {rightPanel && (
            <motion.div
              key={rightPanel}
              initial={{ x: 32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 32, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-y-0 right-0 z-40 flex w-[min(92vw,380px)] flex-col overflow-hidden border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 xl:relative xl:z-auto xl:w-[340px] xl:shrink-0 xl:shadow-none"
            >
              {rightPanel === 'ai' && (
                <AICopilotPanel
                  aiMessages={aiMessages}
                  aiChatInput={aiChatInput}
                  setAiChatInput={setAiChatInput}
                  aiChatLoading={aiChatLoading}
                  chatEndRef={chatEndRef}
                  onSend={sendAIChat}
                  onShortcutClick={handleShortcutClick}
                  onClose={() => setRightPanel(null)}
                />
              )}
              {rightPanel === 'design' && (
                <DesignPanel
                  editingForm={editingForm}
                  setEditingForm={setEditingForm}
                  onClose={() => setRightPanel(null)}
                />
              )}
              {rightPanel === 'settings' && (
                <SettingsPanel
                  linkedProgramId={linkedProgramId}
                  setLinkedProgramId={setLinkedProgramId}
                  availablePrograms={availablePrograms}
                  targetNiks={targetNiks}
                  setTargetNiks={setTargetNiks}
                  targetDepartments={targetDepartments}
                  setTargetDepartments={setTargetDepartments}
                  targetCutoffDate={targetCutoffDate}
                  setTargetCutoffDate={setTargetCutoffDate}
                  availableDepartments={availableDepartments}
                  onClose={() => setRightPanel(null)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Form Card (list view) ──────────────────────────────────────────────────
function FormCard({ form, onEdit, onDelete, onCopyLink, onViewResponses }: any) {
  let themeColor = '#6366F1';
  try { const p = JSON.parse(form.description); if (p.theme) themeColor = p.theme; } catch { }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group flex flex-col cursor-pointer" onClick={onEdit}>
      {/* Preview strip */}
      <div className="relative h-28 flex items-center justify-center overflow-hidden" style={{ backgroundColor: `${themeColor}15` }}>
        <div className="h-1 w-full absolute top-0" style={{ backgroundColor: themeColor }} />
        <div className="w-24 space-y-1.5 opacity-60">
          <div className="h-2.5 bg-zinc-300/70 dark:bg-zinc-600/50 rounded-full w-full" />
          <div className="h-1.5 bg-zinc-200/70 dark:bg-zinc-700/50 rounded-full w-3/4" />
          <div className="h-8 border-2 border-dashed border-zinc-300/50 dark:border-zinc-600/40 rounded-lg" />
          <div className="h-1.5 bg-zinc-200/70 dark:bg-zinc-700/50 rounded-full w-1/2 mt-1" />
          <div className="h-5 border-2 border-dashed border-zinc-300/50 dark:border-zinc-600/40 rounded-md" />
        </div>
        {!form.is_active && (
          <span className="absolute top-3 right-3 bg-zinc-700 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">Draft</span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 line-clamp-1 mb-1">{form.title}</h3>
        <p className="text-xs text-zinc-400 mb-auto">{form.fields?.length || 0} pertanyaan</p>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={(e) => { e.stopPropagation(); onViewResponses(); }}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
          >
            <BarChart3 className="w-3 h-3" /> Lihat Respon
          </button>
          <div className="flex gap-1">
            <button onClick={(e) => { e.stopPropagation(); onCopyLink(); }} className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-colors">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Copilot Panel ────────────────────────────────────────────────────────
const AI_SHORTCUTS = [
  '📋 Buat Form Pendaftaran Anggota',
  '⭐ Buat Form Survei Kepuasan Karyawan',
  '💬 Buat Form Kritik & Saran',
  '🗳️ Buat Form Evaluasi Program',
  '🍞 Buat Form Pemesanan Roti',
];

function AICopilotPanel({ aiMessages, aiChatInput, setAiChatInput, aiChatLoading, chatEndRef, onSend, onShortcutClick, onClose }: any) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">AI Form Builder</p>
            <p className="text-[10px] text-zinc-400">Powered by AI</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome + shortcuts */}
        {aiMessages.length <= 1 && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-2xl p-4 border border-violet-100 dark:border-violet-900/30">
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1">Coba template ini:</p>
              <div className="space-y-1.5 mt-2">
                {AI_SHORTCUTS.map((s, i) => (
                  <button key={i} onClick={() => onShortcutClick(s.replace(/^[^\w]+/, '').trim())}
                    className="w-full text-left px-3 py-2 bg-white dark:bg-zinc-900 border border-violet-100 dark:border-violet-900/30 rounded-xl text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {aiMessages.map((msg: any, i: number) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Wand2 className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${msg.role === 'user'
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-bl-sm'}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading dots */}
        {aiChatLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0 mr-2">
              <Wand2 className="w-3 h-3 text-white" />
            </div>
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
              {[0, 150, 300].map(delay => (
                <span key={delay} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
        <div className="flex items-end gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-2 focus-within:border-indigo-400 transition-colors">
          <textarea
            value={aiChatInput}
            onChange={(e) => setAiChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Ceritakan form yang ingin dibuat..."
            rows={2}
            className="flex-1 bg-transparent text-xs resize-none outline-none text-zinc-900 dark:text-white placeholder-zinc-400 py-1 px-1 min-h-[40px] max-h-[100px]"
            disabled={aiChatLoading}
          />
          <button
            onClick={onSend}
            disabled={aiChatLoading || !aiChatInput.trim()}
            className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-all shrink-0"
          >
            {aiChatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[10px] text-zinc-400 text-center mt-1.5">Enter kirim · Shift+Enter baris baru</p>
      </div>
    </div>
  );
}

// ─── Design Panel ────────────────────────────────────────────────────────────
const THEME_PRESETS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#3B82F6',
  '#1E293B', '#374151',
];

function DesignPanel({ editingForm, setEditingForm, onClose }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-indigo-500" />
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Desain & Tema</p>
        </div>
        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Color */}
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Warna Tema</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {THEME_PRESETS.map(color => (
              <button key={color} onClick={() => setEditingForm((p: any) => ({ ...p, theme_color: color }))}
                className="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110"
                style={{
                  backgroundColor: color,
                  borderColor: editingForm.theme_color === color ? 'white' : 'transparent',
                  boxShadow: editingForm.theme_color === color ? `0 0 0 2px ${color}` : 'none'
                }} />
            ))}
          </div>
          <div className="flex gap-2">
            <input type="color" value={editingForm.theme_color || '#6366F1'}
              onChange={(e) => setEditingForm((p: any) => ({ ...p, theme_color: e.target.value }))}
              className="w-9 h-9 rounded-lg cursor-pointer border border-zinc-200 dark:border-zinc-700 p-0.5" />
            <input type="text" value={editingForm.theme_color || '#6366F1'}
              onChange={(e) => setEditingForm((p: any) => ({ ...p, theme_color: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono outline-none focus:border-indigo-500 text-zinc-800 dark:text-white uppercase" />
          </div>
        </div>

        {/* Layout */}
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Layout</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'classic', label: 'Classic', desc: 'Satu halaman scroll', icon: Layers },
              { value: 'card', label: 'Card', desc: 'Satu pertanyaan per slide', icon: MousePointer2 },
            ].map(({ value, label, desc, icon: Icon }) => (
              <button key={value}
                onClick={() => setEditingForm((p: any) => ({ ...p, layout_type: value }))}
                className={`p-3 rounded-xl border-2 text-left transition-all ${editingForm.layout_type === value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
              >
                <Icon className={`w-4 h-4 mb-1 ${editingForm.layout_type === value ? 'text-indigo-600' : 'text-zinc-400'}`} />
                <p className={`text-xs font-bold ${editingForm.layout_type === value ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-600 dark:text-zinc-400'}`}>{label}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Font */}
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Font</label>
          <select value={editingForm.font_family || 'Inter'}
            onChange={(e) => setEditingForm((p: any) => ({ ...p, font_family: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold outline-none focus:border-indigo-500 text-zinc-800 dark:text-white">
            <option value="Inter">Inter (Default)</option>
            <option value="Outfit">Outfit</option>
            <option value="Playfair Display">Playfair Display</option>
            <option value="Space Grotesk">Space Grotesk</option>
          </select>
        </div>

        {/* Input Style */}
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Gaya Input</label>
          <div className="space-y-1.5">
            {[
              { value: 'rounded', label: 'Rounded', preview: 'border rounded-xl' },
              { value: 'sharp', label: 'Sharp', preview: 'border rounded' },
              { value: 'underline', label: 'Underline', preview: 'border-b' },
            ].map(({ value, label, preview }) => (
              <button key={value}
                onClick={() => setEditingForm((p: any) => ({ ...p, input_style: value }))}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${editingForm.input_style === value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}
              >
                <div className={`h-6 flex-1 bg-zinc-100 dark:bg-zinc-700 ${preview}`} />
                <span className={`text-xs font-semibold ${editingForm.input_style === value ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Glassmorphism */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <div>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Glassmorphism</p>
            <p className="text-[10px] text-zinc-400">Efek kaca transparan</p>
          </div>
          <button
            onClick={() => setEditingForm((p: any) => ({ ...p, card_glassmorphism: !p.card_glassmorphism }))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editingForm.card_glassmorphism ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${editingForm.card_glassmorphism ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Background */}
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Background Image (URL)</label>
          <input type="text" value={editingForm.bg_image_url || ''}
            onChange={(e) => setEditingForm((p: any) => ({ ...p, bg_image_url: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500 text-zinc-800 dark:text-white"
            placeholder="https://..." />
        </div>
      </div>
    </div>
  );
}

// ─── Settings Panel ──────────────────────────────────────────────────────────
function SettingsPanel({ linkedProgramId, setLinkedProgramId, availablePrograms, targetNiks, setTargetNiks, targetDepartments, setTargetDepartments, targetCutoffDate, setTargetCutoffDate, availableDepartments, onClose }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-500" />
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Pengaturan</p>
        </div>
        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Program Acara</label>
          <select value={linkedProgramId} onChange={(e) => setLinkedProgramId(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500 text-zinc-700 dark:text-zinc-300">
            <option value="">-- Tidak terhubung --</option>
            {availablePrograms.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Target NIK</label>
          <textarea value={targetNiks} onChange={(e) => setTargetNiks(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none h-20 resize-none font-mono focus:border-indigo-500"
            placeholder="Pisahkan dengan koma atau enter" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Target Departemen</label>
          <div className="flex flex-wrap gap-1.5">
            {availableDepartments.map((dept: string) => {
              const sel = targetDepartments.includes(dept);
              return (
                <button key={dept} type="button"
                  onClick={() => setTargetDepartments((prev: string[]) => sel ? prev.filter((d: string) => d !== dept) : [...prev, dept])}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${sel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}>
                  {dept}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Tanggal Masuk Maks</label>
          <input type="date" value={targetCutoffDate} onChange={(e) => setTargetCutoffDate(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500 text-zinc-700 dark:text-zinc-300" />
        </div>
      </div>
    </div>
  );
}

// ─── Field Card ──────────────────────────────────────────────────────────────
function FieldCard({ field, index, allFields, isActive, onClick, onUpdate, onMove, onDuplicate, onDelete, isFirst, isLast, themeColor, dragFieldIndex, setDragFieldIndex, dragOverIndex, setDragOverIndex, onReorder }: any) {
  const meta = ALL_FIELD_TYPES.find(t => t.type === field.type);

  return (
    <div
      onClick={onClick}
      draggable={!isActive}
      onDragStart={() => setDragFieldIndex(index)}
      onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
      onDragEnd={() => { setDragFieldIndex(null); setDragOverIndex(null); }}
      onDrop={() => {
        if (dragFieldIndex !== null && dragFieldIndex !== index) onReorder(dragFieldIndex, index);
        setDragFieldIndex(null); setDragOverIndex(null);
      }}
      className={`bg-white dark:bg-zinc-900 rounded-2xl border cursor-pointer transition-all ${isActive
        ? 'border-indigo-400 shadow-md ring-2 ring-indigo-500/15'
        : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
        } ${dragFieldIndex === index ? 'opacity-40 scale-95' : ''} ${dragOverIndex === index && dragFieldIndex !== index ? 'border-indigo-400 ring-2 ring-indigo-400/20 scale-[1.01]' : ''}`}
    >
      {!isActive ? (
        /* Collapsed view */
        <div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <GripVertical className="w-4 h-4 text-zinc-300 cursor-grab shrink-0 hover:text-zinc-400" />
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: meta?.bg || '#EEF2FF', color: meta?.color || '#6366F1' }}>
              {meta ? <meta.icon className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                {field.label}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </p>
              <p className="text-[10px] text-zinc-400 capitalize">{field.type.replace(/_/g, ' ')}</p>
            </div>
            <span className="text-[10px] text-zinc-300 font-mono shrink-0">{index + 1}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 text-zinc-300 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-zinc-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="pointer-events-none border-t border-zinc-100 px-5 py-4 opacity-90 dark:border-zinc-800">
            <FormFieldRenderer field={field} themeColor={themeColor} inputStyle="rounded" disabled />
          </div>
        </div>
      ) : (
        /* Expanded editor */
        <FieldEditor
          field={field}
          index={index}
          allFields={allFields}
          onUpdate={onUpdate}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          isFirst={isFirst}
          isLast={isLast}
          themeColor={themeColor}
          meta={meta}
        />
      )}
    </div>
  );
}

// ─── Field Editor ────────────────────────────────────────────────────────────
function FieldEditor({ field, index, allFields, onUpdate, onMove, onDuplicate, onDelete, isFirst, isLast, themeColor, meta }: any) {
  const conditionalParents = (allFields || [])
    .slice(0, index)
    .filter((candidate: FormField) => ['select', 'radio', 'checkbox'].includes(candidate.type) && candidate.options?.length);
  const selectedParent = conditionalParents.find((candidate: FormField) => candidate.id === field.condition?.fieldId);

  return (
    <div className="p-4 space-y-4">
      {/* Field header */}
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: meta?.bg || '#EEF2FF', color: meta?.color || '#6366F1' }}>
          {meta ? <meta.icon className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
        </div>
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex-1">Field #{index + 1} · {field.type.replace(/_/g, ' ')}</span>
        <div className="flex gap-0.5">
          {!isFirst && <button onClick={(e) => { e.stopPropagation(); onMove('up'); }} className="p-1.5 text-zinc-300 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><MoveUp className="w-3.5 h-3.5" /></button>}
          {!isLast && <button onClick={(e) => { e.stopPropagation(); onMove('down'); }} className="p-1.5 text-zinc-300 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><MoveDown className="w-3.5 h-3.5" /></button>}
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 text-zinc-300 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><Copy className="w-3.5 h-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-zinc-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Label + type selector */}
      <div className="space-y-2">
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-0 py-1 bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 text-sm font-semibold text-zinc-900 dark:text-white outline-none transition-colors"
          placeholder="Label pertanyaan"
          onClick={(e) => e.stopPropagation()}
        />
        <select
          value={field.type}
          onChange={(e) => {
            const nextType = e.target.value as FieldType;
            onUpdate({
              type: nextType,
              ...getFieldTypeDefaults(nextType),
              ...(nextType === 'payment_section' ? { required: false } : {}),
            });
          }}
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold outline-none focus:border-indigo-500 text-zinc-700 dark:text-zinc-300"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="text">Teks Singkat</option>
          <option value="textarea">Paragraf</option>
          <option value="number">Angka</option>
          <option value="radio">Pilihan Ganda</option>
          <option value="checkbox">Centang Ganda</option>
          <option value="select">Dropdown</option>
          <option value="scale">Skala</option>
          <option value="date">Tanggal</option>
          <option value="rating">Bintang</option>
          <option value="file_upload">Upload File</option>
          <option value="image">Upload Gambar</option>
          <option value="image_choice">Pilihan Gambar</option>
          <option value="addon_group">Daftar Pesanan</option>
          <option value="payment_section">Pembayaran</option>
        </select>
      </div>

      {/* Placeholder */}
      {['text', 'textarea', 'number'].includes(field.type) && (
        <input
          type="text"
          value={field.placeholder || ''}
          onChange={(e) => onUpdate({ placeholder: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500 text-zinc-600 dark:text-zinc-400"
          placeholder="Teks placeholder (opsional)"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <input
        type="text"
        value={field.description || ''}
        onChange={(event) => onUpdate({ description: event.target.value })}
        className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500 text-zinc-600 dark:text-zinc-400"
        placeholder="Petunjuk tambahan untuk pengisi (opsional)"
        onClick={(event) => event.stopPropagation()}
      />

      {/* Options editor */}
      {['select', 'radio', 'checkbox', 'image_choice'].includes(field.type) && (
        <div className="space-y-2 pl-3 border-l-2 border-zinc-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
          {field.options?.map((opt: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              {field.type === 'radio' && <CircleDot className="w-3.5 h-3.5 text-zinc-300 shrink-0" />}
              {field.type === 'checkbox' && <CheckSquare className="w-3.5 h-3.5 text-zinc-300 shrink-0" />}
              {field.type === 'select' && <span className="text-[10px] text-zinc-400 w-4 shrink-0">{i + 1}.</span>}
              <input
                type="text"
                value={opt.label}
                onChange={(e) => {
                  const newOpts = [...(field.options || [])];
                  newOpts[i] = { ...newOpts[i], label: e.target.value };
                  onUpdate({ options: newOpts });
                }}
                className="flex-1 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-indigo-500 py-0.5 text-xs outline-none dark:text-white transition-colors"
                placeholder={`Opsi ${i + 1}`}
              />
              {field.type === 'image_choice' && (
                <input
                  type="url"
                  value={opt.image || ''}
                  onChange={(event) => {
                    const newOptions = [...(field.options || [])];
                    newOptions[i] = { ...newOptions[i], image: event.target.value };
                    onUpdate({ options: newOptions });
                  }}
                  className="hidden min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 text-xs outline-none transition-colors focus:border-indigo-500 sm:block dark:text-white"
                  placeholder="URL gambar"
                />
              )}
              <button
                onClick={() => onUpdate({ options: field.options?.filter((_: any, j: number) => j !== i) })}
                className="text-zinc-300 hover:text-red-400 p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ options: [...(field.options || []), { value: `opt${Date.now()}`, label: `Opsi ${(field.options?.length || 0) + 1}` }] })}
            className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 mt-1"
          >
            <Plus className="w-3 h-3" /> Tambah opsi
          </button>
        </div>
      )}

      {/* Scale */}
      {field.type === 'scale' && (
        <div className="flex items-center gap-2 text-xs text-zinc-500" onClick={(e) => e.stopPropagation()}>
          <span>Skala 1 hingga</span>
          <select
            value={field.max_scale || 5}
            onChange={(e) => onUpdate({ max_scale: parseInt(e.target.value) })}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-800 text-xs outline-none focus:border-indigo-500"
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {/* Rating */}
      {field.type === 'rating' && (
        <div className="flex items-center gap-2 text-xs text-zinc-500" onClick={(e) => e.stopPropagation()}>
          <span>Jumlah bintang</span>
          <select
            value={field.max || 5}
            onChange={(e) => onUpdate({ max: parseInt(e.target.value) })}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-800 text-xs outline-none"
          >
            {[3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {/* Addon Group */}
      {field.type === 'addon_group' && (
        <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Produk</label>
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={field.allow_multiple} onChange={(e) => onUpdate({ allow_multiple: e.target.checked })} className="w-3 h-3" /> Multi pilih
            </label>
          </div>
          {field.items?.map((item: any, i: number) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={item.name}
                onChange={(e) => { const items = [...field.items]; items[i].name = e.target.value; onUpdate({ items }); }}
                className="flex-1 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 outline-none" placeholder="Nama" />
              <input type="number" value={item.price}
                onChange={(e) => { const items = [...field.items]; items[i].price = parseInt(e.target.value) || 0; onUpdate({ items }); }}
                className="w-20 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 outline-none" placeholder="Rp" />
            </div>
          ))}
          <button onClick={() => onUpdate({ items: [...(field.items || []), { id: `item${Date.now()}`, name: '', sizes: ['M'], price: 0 }] })}
            className="text-xs text-indigo-500 font-semibold flex items-center gap-1">
            <Plus className="w-3 h-3" /> Tambah item
          </button>
        </div>
      )}

      {/* Payment Section */}
      {field.type === 'payment_section' && (
        <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1 font-semibold">QRIS Image URL</label>
            <input type="text" value={field.qris_image_url || ''} onChange={(e) => onUpdate({ qris_image_url: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border rounded-xl bg-white dark:bg-zinc-800 dark:border-zinc-700 outline-none" placeholder="https://..." />
          </div>
          {field.qris_image_url && <img src={field.qris_image_url} alt="QRIS" className="w-20 h-20 object-contain mx-auto rounded-lg border" />}
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1 font-semibold">Nama Rekening</label>
            <input type="text" value={field.account_name || ''} onChange={(e) => onUpdate({ account_name: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border rounded-xl bg-white dark:bg-zinc-800 dark:border-zinc-700 outline-none" />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
            <input type="checkbox" checked={field.verify_with_ai !== false} onChange={(e) => onUpdate({ verify_with_ai: e.target.checked })} />
            Verifikasi otomatis dengan AI
          </label>
        </div>
      )}

      {/* Conditional branching */}
      <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Logika kondisi</span>
        </div>
        <select
          value={field.condition?.fieldId || ''}
          onChange={(event) => {
            const parent = conditionalParents.find((candidate: FormField) => candidate.id === event.target.value);
            if (!parent) return onUpdate({ condition: undefined });
            onUpdate({ condition: { fieldId: parent.id, operator: 'eq', value: parent.options?.[0]?.value || '' } });
          }}
          className="w-full rounded-lg border border-indigo-100 bg-white px-2.5 py-2 text-xs text-zinc-700 outline-none focus:border-indigo-400 dark:border-indigo-900/50 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="">Selalu tampil</option>
          {conditionalParents.map((parent: FormField) => <option key={parent.id} value={parent.id}>Jika: {parent.label}</option>)}
        </select>

        {field.condition && selectedParent && (
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
            <select
              value={field.condition.operator}
              onChange={(event) => {
                const operator = event.target.value as 'eq' | 'neq' | 'in';
                const currentValue = Array.isArray(field.condition.value) ? field.condition.value[0] : field.condition.value;
                onUpdate({ condition: { ...field.condition, operator, value: operator === 'in' ? [currentValue] : currentValue } });
              }}
              className="rounded-lg border border-indigo-100 bg-white px-2 py-2 text-xs outline-none dark:border-indigo-900/50 dark:bg-zinc-900"
            >
              <option value="eq">sama dengan</option>
              <option value="neq">tidak sama</option>
              <option value="in">salah satu</option>
            </select>
            <select
              value={Array.isArray(field.condition.value) ? field.condition.value[0] || '' : field.condition.value}
              onChange={(event) => onUpdate({
                condition: {
                  ...field.condition,
                  value: field.condition.operator === 'in' ? [event.target.value] : event.target.value,
                },
              })}
              className="min-w-0 rounded-lg border border-indigo-100 bg-white px-2 py-2 text-xs outline-none dark:border-indigo-900/50 dark:bg-zinc-900"
            >
              {selectedParent.options?.map((option: FormOption) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        )}
        {conditionalParents.length === 0 && (
          <p className="text-[10px] leading-relaxed text-zinc-400">Tambahkan pertanyaan pilihan di atas field ini untuk membuat cabang Ya/Tidak.</p>
        )}
      </div>

      {/* Required toggle */}
      {field.type === 'payment_section' ? (
        <p className="border-t border-zinc-100 pt-3 text-[10px] leading-relaxed text-zinc-400 dark:border-zinc-800">
          Bukti pembayaran divalidasi otomatis pada halaman pengisi sehingga tidak memakai toggle wajib umum.
        </p>
      ) : (
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-xs text-zinc-400">Wajib diisi</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUpdate({ required: !field.required }); }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${field.required ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${field.required ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
          </button>
        </div>
      )}
    </div>
  );
}
