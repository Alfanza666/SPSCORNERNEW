import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  Plus, X, Trash2, Calendar, Loader2,
  Settings, Copy, LayoutTemplate, Send,
  Wand2, PanelLeftOpen, BarChart3, ClipboardList, Sparkles, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { FormConfig, FormField, FieldType } from '../../../types/form';
import FormCanvas from '../../../components/forms/FormCanvas';
import PremiumFormExperience from '../../../components/forms/PremiumFormExperience';
import { parseAIResponse } from '../../../utils/aiResponseParser';
import { createEventRsvpTemplate } from '../../../utils/formTemplates';
import BuilderTopbar from '../../../components/form-builder/BuilderTopbar';
import FieldPalette from '../../../components/form-builder/FieldPalette';
import BuilderCanvas from '../../../components/form-builder/BuilderCanvas';
import InspectorPanel from '../../../components/form-builder/InspectorPanel';
import FieldSettingsPanel from '../../../components/form-builder/FieldSettingsPanel';
import LogicFlowPanel from '../../../components/form-builder/LogicFlowPanel';
import type { BuilderDevice, InspectorTab } from '../../../components/form-builder/types';

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

function getFieldTypeDefaults(type: FieldType): Partial<FormField> {
  return {
    options: ['select', 'radio', 'checkbox', 'image_choice'].includes(type)
      ? [{ value: 'opt1', label: 'Opsi 1', image: '' }]
      : undefined,
    max: type === 'rating' ? 5 : undefined,
    max_scale: type === 'scale' ? 10 : undefined,
    items: type === 'addon_group' ? [{ id: 'item1', name: 'Item', sizes: ['M'], price: 0 }] : undefined,
    allow_multiple: type === 'addon_group' ? true : undefined,
    subfields: type === 'repeater' ? [
      { id: 'name', type: 'text', label: 'Nama lengkap', required: true },
      { id: 'relation', type: 'text', label: 'Hubungan', required: true },
    ] : undefined,
    min_items: type === 'repeater' ? 0 : undefined,
    max_items: type === 'repeater' ? 5 : undefined,
    item_label: type === 'repeater' ? 'Anggota' : undefined,
    item_unit_price: type === 'repeater' ? 0 : undefined,
    qris_image_url: type === 'payment_section' ? '' : undefined,
    account_name: type === 'payment_section' ? '' : undefined,
    payment_description: type === 'payment_section' ? '' : undefined,
    verify_with_ai: type === 'payment_section' ? false : undefined,
    payment_methods: type === 'payment_section' ? ['bank_transfer', 'manual_qris'] : undefined,
    proof_required: type === 'payment_section' ? true : undefined,
  };
}

function createBlankPremiumForm(): FormConfig {
  return {
    title: 'Formulir Tanpa Judul',
    description: '',
    theme_color: '#4F46E5',
    banner_url: '',
    fields: [],
    layout_type: 'card',
    font_family: 'Inter',
    input_style: 'rounded',
    bg_image_url: '',
    card_glassmorphism: false,
    experience_version: 2,
    theme: {
      preset: 'sps_event_premium',
      primary_color: '#4F46E5',
      accent_color: '#7C3AED',
      radius: 'rounded',
      density: 'comfortable',
      choice_style: 'cards',
      button_style: 'gradient',
      cover_overlay: 'soft',
      show_progress: true,
    },
    outcomes: [
      { id: 'submitted', kind: 'submitted', title: 'Jawaban berhasil dikirim' },
    ],
    default_outcome_id: 'submitted',
    review_enabled: true,
    autosave_draft: true,
    welcome_screen: {
      enabled: true,
      eyebrow: 'Formulir digital',
      badge: 'Form resmi SPS',
      start_label: 'Mulai',
      highlights: [],
      adaptive_note_enabled: false,
    },
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

  const [editingForm, setEditingForm] = useState<FormConfig>(() => createBlankPremiumForm());
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [linkedProgramId, setLinkedProgramId] = useState<string>('');
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([]);

  const [builderDevice, setBuilderDevice] = useState<BuilderDevice>('desktop');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('ai');
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [isMobileFieldPaletteOpen, setIsMobileFieldPaletteOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'Halo! Saya asisten AI untuk membuat formulir. Ceritakan formulir apa yang ingin kamu buat?' }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isPreviewMode, setIsPreviewMode] = useState(false);

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
      if (window.innerWidth < 1280) setIsMobileInspectorOpen(false);
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
    label: type === 'addon_group'
      ? 'Pesanan Ekstra'
      : type === 'payment_section'
        ? 'Pembayaran'
        : type === 'repeater'
          ? 'Daftar Anggota'
          : 'Pertanyaan Baru',
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
    setInspectorTab('field');
  };

  const insertFieldAt = (type: FieldType, targetIndex: number) => {
    const newField = createNewField(type);
    setEditingForm(previous => {
      const fields = [...(previous.fields || [])];
      fields.splice(Math.min(Math.max(targetIndex, 0), fields.length), 0, newField);
      return { ...previous, fields };
    });
    setActiveFieldId(newField.id);
    setInspectorTab('field');
  };

  const reorderFieldById = (fieldId: string, targetIndex: number) => {
    setEditingForm(previous => {
      const fields = [...(previous.fields || [])];
      const sourceIndex = fields.findIndex(field => field.id === fieldId);
      if (sourceIndex < 0) return previous;
      const [moved] = fields.splice(sourceIndex, 1);
      const adjustedIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      fields.splice(Math.min(Math.max(adjustedIndex, 0), fields.length), 0, moved);
      return { ...previous, fields };
    });
    setActiveFieldId(fieldId);
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
  const handleSave = async (publish = false) => {
    if (!editingForm.title) { toast.error('Judul formulir wajib diisi'); return; }
    if (!editingForm.fields?.length) { toast.error('Tambahkan minimal satu pertanyaan'); return; }
    const hasConfiguredCharge = editingForm.fields.some(field =>
      (field.options || []).some(option => Number(option.price || 0) > 0)
      || (field.items || []).some(item => Number(item.price || 0) > 0)
      || Number(field.unit_price || 0) > 0
      || Number(field.item_unit_price || 0) > 0,
    );
    const paymentField = editingForm.fields.find(field => field.type === 'payment_section');
    if (publish && editingForm.experience_version === 2 && hasConfiguredCharge && !linkedProgramId) {
      toast.error('Formulir berbayar wajib dihubungkan ke Program Kerja agar harga dan QR diproses aman.');
      setInspectorTab('settings');
      return;
    }
    if (publish && hasConfiguredCharge && paymentField) {
      const methods = paymentField.payment_methods || [];
      const bankConfigured = paymentField.bank_accounts?.some(account => account.account_number.trim() && account.account_name.trim());
      const qrisConfigured = Boolean(paymentField.qris_image_url?.trim());
      if (methods.length === 0
        || (methods.includes('bank_transfer') && !bankConfigured)
        || (methods.includes('manual_qris') && !qrisConfigured)) {
        toast.error('Lengkapi rekening/QRIS untuk setiap metode pembayaran yang diaktifkan.');
        setActiveFieldId(paymentField.id);
        setInspectorTab('field');
        return;
      }
    }
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
          card_glassmorphism: editingForm.card_glassmorphism || false,
          experience_version: editingForm.experience_version || 1,
          theme_config: editingForm.theme || null,
          outcomes: editingForm.outcomes || [],
          default_outcome_id: editingForm.default_outcome_id || null,
          review_enabled: editingForm.review_enabled ?? true,
          autosave_draft: editingForm.autosave_draft ?? false,
          program_automation: editingForm.program_automation || null,
          welcome_screen: editingForm.welcome_screen || null,
        }),
        fields: cleanFields,
        is_active: publish ? true : Boolean((editingForm as any).is_active),
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

      if (publish && linkedProgramId && currentFormId) {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) throw new Error('Sesi admin berakhir. Silakan login kembali.');
        const linkResponse = await fetch(`/api/admin/programs/${linkedProgramId}/link-form-v2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ form_id: currentFormId }),
        });
        const linkResult = await linkResponse.json();
        if (!linkResponse.ok) throw new Error(linkResult.error || 'Gagal menyinkronkan formulir dengan program.');
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
    setEditingForm(createBlankPremiumForm());
    setActiveFieldId(null);
    setLinkedProgramId('');
    setTargetNiks('');
    setTargetDepartments([]);
    setTargetCutoffDate('');
    setAiMessages([{ role: 'ai', content: 'Halo! Saya asisten AI untuk membuat formulir. Ceritakan formulir apa yang ingin kamu buat?' }]);
    setIsPreviewMode(false);
    setInspectorTab('ai');
    setBuilderDevice('desktop');
    setIsMobileFieldPaletteOpen(false);
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin'))
    return <div className="p-8 text-center font-bold text-red-500">Akses Ditolak</div>;

  // ─── List View ────────────────────────────────────────────────────────────
  if (!showEditor) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8">
          <section className="relative overflow-hidden rounded-[2.25rem] bg-zinc-950 px-5 py-7 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.9)] sm:px-8 sm:py-10 dark:bg-zinc-900">
            <div aria-hidden="true" className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] lg:items-end">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200"><Sparkles className="h-3.5 w-3.5" /> SPS Form Studio 2.0</span>
                <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">Bangun pengalaman formulir yang terasa premium.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">Susun pertanyaan secara visual, atur cabang jawaban, hitung biaya, dan terbitkan QR program dari satu workflow.</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button onClick={() => { resetForm(); setShowEditor(true); setInspectorTab('ai'); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-bold text-white shadow-xl shadow-indigo-950/40 transition hover:-translate-y-0.5"><Wand2 className="h-4 w-4" /> Buat dengan AI</button>
                  <button onClick={() => { resetForm(); setShowEditor(true); setInspectorTab('design'); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/15"><Plus className="h-4 w-4" /> Mulai dari kosong</button>
                </div>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  const template = createEventRsvpTemplate();
                  setEditingForm(template);
                  setActiveFieldId(template.fields[0]?.id || null);
                  setInspectorTab('field');
                  setShowEditor(true);
                }}
                className="group rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-5 text-left backdrop-blur transition hover:-translate-y-1 hover:border-indigo-400/50 hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-950/40"><Calendar className="h-5 w-5" /></span><ArrowRight className="h-5 w-5 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-white" /></div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-300">Template unggulan</p>
                <h2 className="mt-2 text-xl font-black">RSVP acara & keluarga</h2>
                <p className="mt-2 text-xs leading-6 text-zinc-400">Kehadiran, ukuran baju, camping, anggota keluarga, biaya, pembayaran manual, dan QR terpisah.</p>
              </button>
            </div>
          </section>
        </div>

        {/* Forms Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">Workspace</p><h2 className="mt-1 text-xl font-black text-zinc-900 dark:text-white">Formulir Anda</h2></div><span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">{forms.length} form</span></div>
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
                onClick={() => { resetForm(); setShowEditor(true); setInspectorTab('ai'); }}
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
                      font_family = 'Inter', input_style = 'rounded', bg_image_url = '', card_glassmorphism = false,
                      experience_version: 1 | 2 = 1, theme_config = undefined, outcomes = undefined,
                      default_outcome_id = undefined, review_enabled = true, autosave_draft = false,
                      program_automation = undefined, welcome_screen = undefined;
                    try {
                      const p = JSON.parse(form.description);
                      if (p.text !== undefined) {
                        desc = p.text; theme = p.theme || '#6366F1'; banner = p.banner || '';
                        layout_type = p.layout_type || 'classic'; font_family = p.font_family || 'Inter';
                        input_style = p.input_style || 'rounded'; bg_image_url = p.bg_image_url || '';
                        card_glassmorphism = p.card_glassmorphism || false;
                        experience_version = p.experience_version === 2 ? 2 : 1;
                        theme_config = p.theme_config;
                        outcomes = p.outcomes;
                        default_outcome_id = p.default_outcome_id;
                        review_enabled = p.review_enabled ?? true;
                        autosave_draft = p.autosave_draft ?? false;
                        program_automation = p.program_automation;
                        welcome_screen = p.welcome_screen;
                      }
                    } catch { }
                    setEditingForm({
                      ...form, description: desc, theme_color: theme, banner_url: banner,
                      layout_type, font_family, input_style, bg_image_url, card_glassmorphism,
                      experience_version, theme: theme_config, outcomes, default_outcome_id,
                      review_enabled, autosave_draft, program_automation, welcome_screen,
                    });
                    setTargetNiks(form.target_niks?.join('\n') || '');
                    setTargetDepartments(form.target_departments || []);
                    setTargetCutoffDate(form.target_cutoff_date || '');
                    setInspectorTab('design');
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


  const selectedFieldIndex = editingForm.fields.findIndex(field => field.id === activeFieldId);
  const selectedField = selectedFieldIndex >= 0 ? editingForm.fields[selectedFieldIndex] : null;
  const fieldInspector = selectedField ? (
    <FieldSettingsPanel
      field={selectedField}
      index={selectedFieldIndex}
      allFields={editingForm.fields}
      outcomes={editingForm.outcomes}
      onUpdate={updates => updateField(selectedField.id, updates)}
      onDuplicate={() => duplicateField(selectedField)}
      onDelete={() => removeField(selectedField.id)}
      onMove={direction => moveField(selectedFieldIndex, direction)}
    />
  ) : undefined;

  const aiInspector = (
    <AICopilotPanel
      aiMessages={aiMessages}
      aiChatInput={aiChatInput}
      setAiChatInput={setAiChatInput}
      aiChatLoading={aiChatLoading}
      chatEndRef={chatEndRef}
      onSend={sendAIChat}
      onShortcutClick={handleShortcutClick}
      onClose={() => setIsMobileInspectorOpen(false)}
    />
  );

  const settingsInspector = (
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
      onClose={() => setIsMobileInspectorOpen(false)}
    />
  );

  const renderInspector = (className: string, onClose?: () => void) => (
    <InspectorPanel
      form={editingForm}
      selectedField={selectedField}
      activeTab={inspectorTab}
      onTabChange={setInspectorTab}
      onUpdateField={updateField}
      onUpdateForm={updates => setEditingForm(previous => ({ ...previous, ...updates }))}
      panels={{
        field: fieldInspector,
        logic: (
          <LogicFlowPanel
            form={editingForm}
            selectedFieldId={activeFieldId}
            onSelectField={fieldId => { setActiveFieldId(fieldId); setInspectorTab('field'); }}
            onUpdateField={updateField}
          />
        ),
        ai: aiInspector,
        settings: settingsInspector,
      }}
      onClose={onClose}
      className={className}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 dark:bg-zinc-950">
      <BuilderTopbar
        title={editingForm.title}
        onTitleChange={title => setEditingForm(previous => ({ ...previous, title }))}
        device={builderDevice}
        onDeviceChange={setBuilderDevice}
        saveStatus={saving ? 'saving' : 'unsaved'}
        previewActive={isPreviewMode}
        publishing={saving}
        onBack={() => { setShowEditor(false); fetchForms(); }}
        onSave={() => void handleSave(false)}
        onTogglePreview={() => setIsPreviewMode(previous => !previous)}
        onPublish={() => void handleSave(true)}
      />

      <div className="flex min-h-0 flex-1">
        {!isPreviewMode && (
          <FieldPalette
            onAddField={addField}
            searchValue={fieldSearch}
            onSearchChange={setFieldSearch}
            className="hidden w-64 shrink-0 lg:flex xl:w-72"
          />
        )}

        {isPreviewMode ? (
          <main className="min-w-0 flex-1 overflow-y-auto bg-slate-100 px-3 py-6 sm:px-6 dark:bg-zinc-950">
            <div className="mx-auto max-w-5xl">
              {editingForm.experience_version === 2 ? (
                <PremiumFormExperience form={editingForm} mode="preview" />
              ) : (
                <FormCanvas
                  form={editingForm}
                  isGenerating={aiChatLoading}
                  onStart={() => undefined}
                  onFinish={() => toast.success('Formulir dikirim (mode pratinjau)')}
                  onFieldClick={(id: string) => { setActiveFieldId(id); setInspectorTab('field'); }}
                  activeFieldId={activeFieldId}
                />
              )}
            </div>
          </main>
        ) : (
          <BuilderCanvas
            form={editingForm}
            device={builderDevice}
            selectedFieldId={activeFieldId}
            onSelectField={fieldId => {
              setActiveFieldId(fieldId);
              setInspectorTab(fieldId && fieldId !== 'header' ? 'field' : 'design');
            }}
            onUpdateForm={updates => setEditingForm(previous => ({ ...previous, ...updates }))}
            onInsertField={targetIndex => insertFieldAt('text', targetIndex)}
            onDropField={insertFieldAt}
            onReorderField={reorderFieldById}
            onDuplicateField={fieldId => {
              const field = editingForm.fields.find(candidate => candidate.id === fieldId);
              if (field) duplicateField(field);
            }}
            onDeleteField={removeField}
            className="min-w-0 flex-1"
          />
        )}

        {!isPreviewMode && renderInspector('hidden w-[360px] shrink-0 xl:flex')}
      </div>

      {!isPreviewMode && (
        <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur xl:hidden dark:border-zinc-700 dark:bg-zinc-900/95">
          <button
            type="button"
            onClick={() => setIsMobileFieldPaletteOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <PanelLeftOpen className="h-4 w-4" /> Elemen
          </button>
          <button
            type="button"
            onClick={() => setIsMobileInspectorOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white dark:bg-white dark:text-zinc-950"
          >
            <Settings className="h-4 w-4" /> Inspector
          </button>
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
              className="fixed inset-0 z-40 bg-zinc-950/45 backdrop-blur-[1px] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-[min(92vw,380px)] shadow-2xl lg:hidden"
            >
              <FieldPalette
                onAddField={type => {
                  addField(type);
                  setIsMobileFieldPaletteOpen(false);
                }}
                searchValue={fieldSearch}
                onSearchChange={setFieldSearch}
                onClose={() => setIsMobileFieldPaletteOpen(false)}
                compact
                className="w-full"
              />
            </motion.div>
          </>
        )}

        {!isPreviewMode && isMobileInspectorOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Tutup inspector"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileInspectorOpen(false)}
              className="fixed inset-0 z-40 bg-zinc-950/45 backdrop-blur-[1px] xl:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="fixed inset-y-0 right-0 z-50 w-[min(94vw,400px)] shadow-2xl xl:hidden"
            >
              {renderInspector('w-full', () => setIsMobileInspectorOpen(false))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
