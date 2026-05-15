import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { 
  ClipboardList, Plus, X, Trash2, Save, MoveUp, MoveDown, 
  Type, List, CheckSquare, Calendar, Loader2, ChevronRight,
  Eye, Settings, AlertCircle, Copy, GripVertical, Check, Link2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface FormField {
  id: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'textarea';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

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
  
  const [editingForm, setEditingForm] = useState<Partial<DynamicForm>>({
    title: '',
    description: '',
    fields: [],
    is_active: true
  });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

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

  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: 'Pertanyaan Baru',
      required: false,
      options: ['Opsi 1'],
      placeholder: 'Masukkan jawaban...'
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
      if (editingForm.id) {
        const { error } = await supabase
          .from('dynamic_forms')
          .update({
            title: editingForm.title,
            description: editingForm.description,
            fields: editingForm.fields,
            is_active: editingForm.is_active
          })
          .eq('id', editingForm.id);
        if (error) throw error;
        toast.success('Formulir diperbarui');
      } else {
        const { error } = await supabase
          .from('dynamic_forms')
          .insert({
            title: editingForm.title,
            description: editingForm.description,
            fields: editingForm.fields,
            is_active: editingForm.is_active,
            created_by: user?.id
          });
        if (error) throw error;
        toast.success('Formulir dibuat');
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
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-blue-500" />
              Dynamic Form Builder
            </h1>
            <p className="text-zinc-500 font-medium mt-1">Buat formulir survei, pendaftaran, atau kuesioner dinamis</p>
          </div>
          {!showEditor && (
            <button
              onClick={() => {
                setEditingForm({ title: '', description: '', fields: [], is_active: true });
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Field Types Palette */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm sticky top-8">
                <h3 className="font-black text-sm text-zinc-400 uppercase tracking-widest mb-6">Pilihan Pertanyaan</h3>
                <div className="grid grid-cols-1 gap-3">
                  <PaletteButton icon={<Type />} label="Teks Singkat" onClick={() => addField('text')} />
                  <PaletteButton icon={<List />} label="Teks Panjang" onClick={() => addField('textarea')} />
                  <PaletteButton icon={<Settings />} label="Angka" onClick={() => addField('number')} />
                  <PaletteButton icon={<List />} label="Pilihan Ganda (Dropdown)" onClick={() => addField('select')} />
                  <PaletteButton icon={<CheckSquare />} label="Pilihan Tunggal (Radio)" onClick={() => addField('radio')} />
                  <PaletteButton icon={<CheckSquare />} label="Centang (Checkbox)" onClick={() => addField('checkbox')} />
                  <PaletteButton icon={<Calendar />} label="Tanggal" onClick={() => addField('date')} />
                </div>

                <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Status Aktif</span>
                    <button
                      onClick={() => setEditingForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${editingForm.is_active ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editingForm.is_active ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
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
              <div className="lg:col-span-2 space-y-6">
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
                  </div>
                </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {editingForm.fields?.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setActiveFieldId(field.id)}
                      className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 border transition-all relative ${
                        activeFieldId === field.id 
                          ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-xl z-10' 
                          : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-300'
                      }`}
                    >
                      <div className="relative group/field">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-blue-600 transition-opacity ${activeFieldId === field.id ? 'opacity-100' : 'opacity-0'}`} />
                      
                      {/* Grip icon for visual cue */}
                      <div className="absolute left-1/2 -top-3 -translate-x-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity">
                        <GripVertical className="w-5 h-5 text-zinc-300 rotate-90" />
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="flex flex-col gap-1 pt-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }} 
                            className={`p-2 rounded-lg transition-all ${index === 0 ? 'text-zinc-100 dark:text-zinc-800 cursor-not-allowed' : 'text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20'}`}
                            disabled={index === 0}
                          >
                            <MoveUp className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }} 
                            className={`p-2 rounded-lg transition-all ${index === (editingForm.fields?.length || 0) - 1 ? 'text-zinc-100 dark:text-zinc-800 cursor-not-allowed' : 'text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20'}`}
                            disabled={index === (editingForm.fields?.length || 0) - 1}
                          >
                            <MoveDown className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => updateField(field.id, { label: e.target.value })}
                              className="flex-1 font-bold bg-transparent border-b border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 transition-colors p-1 text-lg dark:text-white"
                              placeholder="Ketik Pertanyaan..."
                            />
                            <div className="flex items-center gap-2">
                              <select 
                                value={field.type}
                                onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                                className="bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-xs font-bold p-2 focus:ring-0"
                              >
                                <option value="text">Teks Singkat</option>
                                <option value="textarea">Teks Panjang</option>
                                <option value="number">Angka</option>
                                <option value="select">Dropdown</option>
                                <option value="radio">Pilihan Tunggal</option>
                                <option value="checkbox">Kotak Centang</option>
                                <option value="date">Tanggal</option>
                              </select>
                            </div>
                          </div>

                          {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                            <div className="space-y-3 ml-4">
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Opsi Jawaban</p>
                              <div className="space-y-2">
                                {field.options?.map((opt, optIndex) => (
                                  <div key={optIndex} className="flex items-center gap-3 group/opt">
                                    <div className="w-4 h-4 border-2 border-zinc-200 dark:border-zinc-700 rounded-full" />
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const newOpts = [...(field.options || [])];
                                        newOpts[optIndex] = e.target.value;
                                        updateField(field.id, { options: newOpts });
                                      }}
                                      className="flex-1 bg-transparent border-b border-transparent focus:border-zinc-100 dark:focus:border-zinc-800 p-1 text-sm dark:text-white"
                                    />
                                    <button 
                                      onClick={() => {
                                        const newOpts = field.options?.filter((_, i) => i !== optIndex);
                                        updateField(field.id, { options: newOpts });
                                      }}
                                      className="text-zinc-300 hover:text-red-500 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => updateField(field.id, { options: [...(field.options || []), `Opsi ${(field.options?.length || 0) + 1}`] })}
                                  className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-2 mt-2"
                                >
                                  <Plus className="w-3 h-3" /> Tambah Opsi
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="pt-4 mt-4 border-t border-zinc-50 dark:border-zinc-800 flex items-center justify-end gap-6">
                            <button 
                              onClick={(e) => { e.stopPropagation(); duplicateField(field); }}
                              className="text-zinc-400 hover:text-blue-500 flex items-center gap-1.5 text-xs font-bold transition-colors"
                            >
                              <Copy className="w-4 h-4" /> Duplikasi
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                              className="text-zinc-400 hover:text-red-500 flex items-center gap-1.5 text-xs font-bold transition-colors"
                            >
                              <Trash2 className="w-4 h-4" /> Hapus
                            </button>
                            <div className="w-px h-6 bg-zinc-100 dark:bg-zinc-800" />
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                className="w-5 h-5 rounded accent-blue-500"
                              />
                              <span className="text-xs font-black text-zinc-400 uppercase tracking-tighter">Wajib Diisi</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
                
                {editingForm.fields?.length === 0 && (
                  <div className="text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                    <AlertCircle className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-400 font-bold">Kanvas Masih Kosong</p>
                    <p className="text-zinc-300 text-sm mt-1">Pilih jenis pertanyaan dari panel kiri untuk mulai membangun formulir.</p>
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
                <p className="text-zinc-400 mt-2">Buat formulir dinamis pertama Anda untuk mengumpulkan data anggota.</p>
              </div>
            ) : (
              forms.map(form => (
                <div key={form.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-zinc-200 dark:border-b-zinc-800 hover:border-b-blue-500">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${form.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {form.is_active ? 'Aktif' : 'Nonaktif'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => copyFormLink(form.id)}
                        className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 rounded-xl transition-colors"
                        title="Salin Link"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingForm(form);
                          setShowEditor(true);
                        }}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-zinc-400 hover:text-blue-500 rounded-xl transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(form.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-xl transition-colors"
                      >
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
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => navigate(`/dashboard/admin/forms/responses/${form.id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all"
                      >
                        Lihat Respon <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
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

function PaletteButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full p-4 bg-zinc-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 group-hover:text-blue-500 shadow-sm transition-colors">
        {icon}
      </div>
      <span className="font-bold text-sm text-zinc-600 dark:text-zinc-300 group-hover:text-blue-600 transition-colors">{label}</span>
    </button>
  );
}
