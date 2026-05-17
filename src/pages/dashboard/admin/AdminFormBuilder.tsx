import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { 
  ClipboardList, Plus, X, Trash2, Save, MoveUp, MoveDown, 
  Type, List, CheckSquare, Calendar, Loader2, ChevronRight,
  Eye, Settings, AlertCircle, Copy, GripVertical, Check, Link2,
  Image as ImageIcon, Star, Sliders, Upload, ShoppingBag, MoreHorizontal
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
    title: '',
    description: '',
    fields: []
  });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Program Linking State
  const [linkedProgramId, setLinkedProgramId] = useState<string>('');
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([]);

  useEffect(() => {
    if (showEditor) {
      fetchPrograms();
    }
  }, [showEditor]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('union_programs')
        .select('id, name, program_type, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setAvailablePrograms(data || []);
    } catch (err) {
      console.error('Error fetching programs:', err);
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
      label: type === 'addon_group' ? 'Pesanan Ekstra (Mandiri)' : 'Pertanyaan Baru',
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
    
    setEditingForm(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newField]
    }));
    setActiveFieldId(newField.id);
  };

  const duplicateField = (field: FormField) => {
    const newField = { ...field, id: Math.random().toString(36).substr(2, 9) };
    setEditingForm(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newField]
    }));
    setActiveFieldId(newField.id);
    toast.success('Pertanyaan diduplikasi');
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
      // Clean up empty options or items before saving
      const cleanFields = editingForm.fields.map(f => {
        if ((f.type === 'select' || f.type === 'radio' || f.type === 'image_choice') && f.options) {
          return { ...f, options: f.options.filter(o => o.label.trim() !== '') };
        }
        if (f.type === 'addon_group' && f.items) {
          return { ...f, items: f.items.filter(i => i.name.trim() !== '') };
        }
        return f;
      });

      const payload = {
        title: editingForm.title,
        description: editingForm.description,
        fields: cleanFields,
        is_active: true
      };

      let currentFormId = editingForm.id;

      if (editingForm.id) {
        const { error } = await supabase
          .from('dynamic_forms')
          .update(payload)
          .eq('id', editingForm.id);
        if (error) throw error;
        toast.success('Formulir diperbarui');
      } else {
        const { data, error } = await supabase
          .from('dynamic_forms')
          .insert({
            ...payload,
            created_by: user?.id
          })
          .select()
          .single();
        if (error) throw error;
        currentFormId = data.id;
        toast.success('Formulir dibuat');
      }

      // Handle Program Linking
      if (linkedProgramId && currentFormId) {
        const { error: linkError } = await supabase
          .from('union_programs')
          .update({ dynamic_form_id: currentFormId })
          .eq('id', linkedProgramId);
        
        if (linkError) {
          console.error('Failed to link program:', linkError);
          toast.error('Formulir disimpan, tetapi gagal menautkan ke program.');
        } else {
          toast.success('Formulir berhasil ditautkan ke program!');
        }
      } else if (!linkedProgramId && editingForm.id) {
        // If user unlinked the program, we might want to clear it? 
        // Usually better to leave as is unless explicitly requested to clear.
        // But for safety let's assume if they select "Pilih Program..." (empty) we clear it?
        // Actually, the toggle logic "Turn off" sets it to empty.
        // Let's check if the user explicitly turned it OFF while it was previously ON.
        // This requires knowing the previous state, which is complex. 
        // For now, we only update if linkedProgramId is SET.
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-blue-500" />
              Advanced Form Builder
            </h1>
            <p className="text-zinc-500 font-medium mt-1">Buat formulir dinamis dengan polling visual dan add-ons</p>
          </div>
          {!showEditor && (
            <button
              onClick={() => {
                setEditingForm({ title: '', description: '', fields: [] });
                      setLinkedProgramId('');
                setShowEditor(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Buat Formulir Baru
            </button>
          )}
        </div>

        {showEditor ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Field Types Palette */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm sticky top-8">
                <h3 className="font-black text-sm text-zinc-400 uppercase tracking-widest mb-6">Bawaan Dasar</h3>
                <div className="grid grid-cols-1 gap-3">
                  <PaletteButton icon={<Type />} label="Teks Singkat" onClick={() => addField('text')} />
                  <PaletteButton icon={<List />} label="Teks Panjang" onClick={() => addField('textarea')} />
                  <PaletteButton icon={<Settings />} label="Angka" onClick={() => addField('number')} />
                  <PaletteButton icon={<CheckSquare />} label="Centang (Checkbox)" onClick={() => addField('checkbox')} />
                  <PaletteButton icon={<Calendar />} label="Tanggal" onClick={() => addField('date')} />
                </div>

                <h3 className="font-black text-sm text-zinc-400 uppercase tracking-widest mb-6 mt-8">Opsional & Interaktif</h3>
                <div className="grid grid-cols-1 gap-3">
                  <PaletteButton icon={<List />} label="Dropdown" onClick={() => addField('select')} />
                  <PaletteButton icon={<CheckSquare />} label="Pilihan Tunggal" onClick={() => addField('radio')} />
                  <PaletteButton icon={<ImageIcon />} label="Polling Visual (Gambar)" onClick={() => addField('image_choice')} />
                  <PaletteButton icon={<Star />} label="Rating Bintang" onClick={() => addField('rating')} />
                  <PaletteButton icon={<Sliders />} label="Skala (1-10)" onClick={() => addField('scale')} />
                  <PaletteButton icon={<Upload />} label="Unggah File" onClick={() => addField('file_upload')} />
                  <PaletteButton icon={<ShoppingBag />} label="Group Pemesanan (Add-on)" onClick={() => addField('addon_group')} />
                </div>

                <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Simpan Formulir</>}
                  </button>
                  <button
                    onClick={() => setShowEditor(false)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 py-4 rounded-2xl font-black transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>

            {/* Editor Canvas */}
            <div className="lg:col-span-9 space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all border-t-8 border-t-blue-600">
                <div className="p-8 space-y-4">
                  <input
                    type="text"
                    value={editingForm.title}
                    onChange={(e) => setEditingForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Judul Formulir"
                    className="text-3xl font-black w-full bg-transparent border-none focus:ring-0 p-0 placeholder:text-zinc-300 dark:text-white"
                  />
                  <textarea
                    value={editingForm.description}
                    onChange={(e) => setEditingForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Deskripsi singkat formulir..."
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-zinc-500 dark:text-zinc-400 resize-none h-auto min-h-[40px] placeholder:text-zinc-300"
                  />
                  
                  {/* Linkage Section */}
                  <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-zinc-400" />
                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Tautkan ke Program?</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setLinkedProgramId(linkedProgramId ? '' : (availablePrograms[0]?.id || ''))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${linkedProgramId ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${linkedProgramId ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    
                    {linkedProgramId && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <select
                          value={linkedProgramId}
                          onChange={(e) => setLinkedProgramId(e.target.value)}
                          className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Pilih Program...</option>
                          {availablePrograms.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.program_type})
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-zinc-400 mt-2">
                          Formulir ini akan muncul otomatis di halaman Portal Karyawan pada program yang dipilih.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {editingForm.fields?.map((field, index) => (
                    <FieldCard 
                      key={field.id}
                      field={field}
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
                
                {editingForm.fields?.length === 0 && (
                  <div className="text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                    <AlertCircle className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-400 font-bold">Kanvas Masih Kosong</p>
                    <p className="text-zinc-300 text-sm mt-1">Pilih jenis pertanyaan dari panel kiri.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
               <div className="col-span-full py-20 flex flex-col items-center justify-center">
                 <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
                 <p className="text-zinc-400 animate-pulse">Memuat daftar formulir...</p>
               </div>
            ) : forms.length === 0 ? (
              <div className="col-span-full text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                <ClipboardList className="w-20 h-20 text-zinc-100 dark:text-zinc-800 mx-auto mb-6" />
                <p className="text-zinc-500 font-black text-xl">Belum Ada Formulir</p>
                <p className="text-zinc-400 mt-2">Buat formulir dinamis pertama Anda.</p>
              </div>
            ) : (
              forms.map(form => (
                <div key={form.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-zinc-200 dark:border-b-zinc-800 hover:border-b-blue-500">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${form.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {form.is_active ? 'Aktif' : 'Nonaktif'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyFormLink(form.id)} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 rounded-xl transition-colors">
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button onClick={async () => { 
                        setEditingForm(form); 
                        setShowEditor(true);
                        
                        // Find linked program
                        if (form.id) {
                            const { data } = await supabase.from('union_programs').select('id').eq('dynamic_form_id', form.id).single();
                            if (data) setLinkedProgramId(data.id);
                            else setLinkedProgramId('');
                        }
                      }} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-zinc-400 hover:text-blue-500 rounded-xl transition-colors">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(form.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-xl transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">{form.title}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-6 h-10">{form.description || 'Tidak ada deskripsi'}</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-50 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                        <Type className="w-4 h-4 text-zinc-400" />
                      </div>
                      <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{form.fields?.length || 0} Kolom</span>
                    </div>
                    <button onClick={() => navigate(`/dashboard/admin/forms/responses/${form.id}`)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all">
                      Respon <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-Components for Builder ---

function PaletteButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all group text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 group-hover:text-blue-500 shadow-sm">
        {React.cloneElement(icon as React.ReactElement, { size: 18 })}
      </div>
      <span className="font-bold text-sm text-zinc-600 dark:text-zinc-300 group-hover:text-blue-600">{label}</span>
    </button>
  );
}

function FieldCard({ 
  field, isActive, onClick, onUpdate, onMove, onDuplicate, onDelete, isFirst, isLast 
}: {
  field: FormField;
  isActive: boolean;
  onClick: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
  onMove: (dir: 'up' | 'down') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 border transition-all relative group ${
        isActive 
          ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-xl z-10' 
          : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-300'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-blue-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
      
      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-1 pt-1">
          <button onClick={(e) => { e.stopPropagation(); onMove('up'); }} disabled={isFirst} className={`p-2 rounded-lg transition-all ${isFirst ? 'text-zinc-100 dark:text-zinc-800 cursor-not-allowed' : 'text-zinc-400 hover:bg-blue-50 hover:text-blue-600'}`}>
            <MoveUp className="w-5 h-5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMove('down'); }} disabled={isLast} className={`p-2 rounded-lg transition-all ${isLast ? 'text-zinc-100 dark:text-zinc-800 cursor-not-allowed' : 'text-zinc-400 hover:bg-blue-50 hover:text-blue-600'}`}>
            <MoveDown className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <input
              type="text"
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="flex-1 font-bold bg-transparent border-b border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 transition-colors p-1 text-lg dark:text-white"
              placeholder="Ketik Pertanyaan..."
            />
            <div className="flex items-center gap-2">
              <select 
                value={field.type}
                onChange={(e) => onUpdate({ type: e.target.value as FieldType })}
                className="bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-xs font-bold p-2 focus:ring-0"
              >
                <option value="text">Teks</option>
                <option value="textarea">Paragraf</option>
                <option value="number">Angka</option>
                <option value="select">Dropdown</option>
                <option value="radio">Radio</option>
                <option value="checkbox">Checkbox</option>
                <option value="image_choice">Gambar (Grid)</option>
                <option value="rating">Rating</option>
                <option value="scale">Skala</option>
                <option value="file_upload">Unggah File</option>
                <option value="addon_group">Addon Group</option>
                <option value="date">Tanggal</option>
              </select>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className={`p-2 rounded-lg transition-all ${showAdvanced ? 'bg-blue-50 text-blue-600' : 'text-zinc-400 hover:bg-zinc-100'}`}>
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700 space-y-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <label className="font-bold text-zinc-600 dark:text-zinc-400">Wajib Diisi</label>
                  <input type="checkbox" checked={field.required} onChange={(e) => onUpdate({ required: e.target.checked })} className="accent-blue-500 w-5 h-5" />
                </div>
                {field.type === 'rating' && (
                   <div className="flex items-center gap-4">
                      <span className="text-zinc-500">Max Bintang:</span>
                      <input type="number" value={field.max || 5} onChange={(e) => onUpdate({ max: parseInt(e.target.value) })} className="w-16 p-1 rounded border" />
                   </div>
                )}
                {field.type === 'scale' && (
                   <div className="flex items-center gap-4">
                      <span className="text-zinc-500">Skala Maks:</span>
                      <input type="number" value={field.max_scale || 10} onChange={(e) => onUpdate({ max_scale: parseInt(e.target.value) })} className="w-16 p-1 rounded border" />
                   </div>
                )}
                {field.type === 'file_upload' && (
                   <div className="flex items-center gap-4">
                      <span className="text-zinc-500">Ukuran Max (MB):</span>
                      <input type="number" value={field.max_size_mb || 5} onChange={(e) => onUpdate({ max_size_mb: parseInt(e.target.value) })} className="w-16 p-1 rounded border" />
                   </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Option Editors */}
          {(field.type === 'select' || field.type === 'radio' || field.type === 'image_choice') && (
            <div className="space-y-3 ml-4 pl-4 border-l-2 border-dashed border-zinc-200 dark:border-zinc-700">
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Opsi Jawaban</p>
               <div className="space-y-2">
                 {field.options?.map((opt, optIndex) => (
                   <div key={optIndex} className="flex items-center gap-2 group/opt">
                     <div className="w-6 h-6 rounded-full border-2 border-zinc-200 dark:border-zinc-600 flex-shrink-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-zinc-300" />
                     </div>
                     <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => {
                           const newOpts = [...(field.options || [])];
                           newOpts[optIndex] = { ...newOpts[optIndex], label: e.target.value };
                           onUpdate({ options: newOpts });
                        }}
                        className="flex-1 bg-transparent border-b border-transparent focus:border-zinc-300 p-1 text-sm dark:text-white"
                        placeholder="Label Opsi"
                     />
                     {field.type === 'image_choice' && (
                       <div className="flex items-center gap-1">
                         <input
                           type="text"
                           value={opt.image || ''}
                           onChange={(e) => {
                             const newOpts = [...(field.options || [])];
                             newOpts[optIndex] = { ...newOpts[optIndex], image: e.target.value };
                             onUpdate({ options: newOpts });
                           }}
                           className="w-24 bg-transparent border-b border-transparent focus:border-zinc-300 p-1 text-xs text-zinc-400"
                           placeholder="URL Gambar..."
                         />
                         {opt.image && <img src={opt.image} alt="preview" className="w-8 h-8 rounded object-cover border" />}
                       </div>
                     )}
                     <button 
                       onClick={() => {
                         const newOpts = field.options?.filter((_, i) => i !== optIndex);
                         onUpdate({ options: newOpts });
                       }}
                       className="text-zinc-300 hover:text-red-500 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                     >
                       <X className="w-3 h-3" />
                     </button>
                   </div>
                 ))}
                 <button
                   onClick={() => onUpdate({ options: [...(field.options || []), { value: `opt${(field.options?.length || 0)+1}`, label: `Opsi ${(field.options?.length || 0) + 1}`, image: '' }] })}
                   className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-2 mt-2"
                 >
                   <Plus className="w-3 h-3" /> Tambah Opsi
                 </button>
               </div>
            </div>
          )}

          {/* Addon Group Configuration */}
          {field.type === 'addon_group' && (
            <div className="space-y-3 ml-4 pl-4 border-l-2 border-dashed border-zinc-200 dark:border-zinc-700">
               <div className="flex items-center justify-between">
                 <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Konfigurasi Pesanan</p>
                 <label className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                    <input type="checkbox" checked={field.allow_multiple} onChange={(e) => onUpdate({ allow_multiple: e.target.checked })} className="accent-blue-500" />
                   multiple
                 </label>
               </div>
               <div className="space-y-2">
                 {field.items?.map((item, idx) => (
                   <div key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700 space-y-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...(field.items || [])];
                          newItems[idx] = { ...newItems[idx], name: e.target.value };
                          onUpdate({ items: newItems });
                        }}
                        className="w-full bg-transparent font-bold text-sm border-b border-zinc-200 dark:border-zinc-600 p-1"
                        placeholder="Nama Item (e.g. Baju Polos)"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.sizes.join(',')}
                          onChange={(e) => {
                            const newItems = [...(field.items || [])];
                            newItems[idx] = { ...newItems[idx], sizes: e.target.value.split(',') };
                            onUpdate({ items: newItems });
                          }}
                          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-1 text-xs"
                          placeholder="Ukuran (pisahkan koma)"
                        />
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const newItems = [...(field.items || [])];
                            newItems[idx] = { ...newItems[idx], price: parseInt(e.target.value) };
                            onUpdate({ items: newItems });
                          }}
                          className="w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-1 text-xs"
                          placeholder="Harga"
                        />
                      </div>
                   </div>
                 ))}
                 <button
                   onClick={() => onUpdate({ items: [...(field.items || []), { id: `item${Date.now()}`, name: 'Item Baru', sizes: ['S','M','L'], price: 0 }] })}
                   className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-2 mt-2"
                 >
                   <Plus className="w-3 h-3" /> Tambah Item
                 </button>
               </div>
            </div>
          )}

          <div className="pt-4 mt-4 border-t border-zinc-50 dark:border-zinc-800 flex items-center justify-end gap-6">
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="text-zinc-400 hover:text-blue-500 flex items-center gap-1.5 text-xs font-bold transition-colors">
              <Copy className="w-4 h-4" /> Duplikasi
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-zinc-400 hover:text-red-500 flex items-center gap-1.5 text-xs font-bold transition-colors">
              <Trash2 className="w-4 h-4" /> Hapus
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}