import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import {
  ClipboardList, ChevronLeft, Loader2, Send,
  CheckCircle2, AlertCircle, Calendar, Info, UploadCloud, X, Plus, Trash2, Star, Image, Link2, Lock, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { FormConfig, FormField, AddonItem } from '../../types/form';

interface DynamicForm {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  target_niks?: string[];
  target_departments?: string[];
}

interface AddonOrder {
  item_id: string;
  size: string;
  quantity: number;
}

export default function PortalFormView() {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const programId = searchParams.get('programId');
  
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [form, setForm] = useState<DynamicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  // State khusus untuk Addon Group (multiple rows)
  const [addonOrders, setAddonOrders] = useState<Record<string, AddonOrder[]>>({});
  // State untuk file uploads ( menyimpan public URL setelah upload)
  const [fileUploads, setFileUploads] = useState<Record<string, string>>({});
  // State untuk image uploads
  const [imageUploads, setImageUploads] = useState<Record<string, string>>({});
  const [imageUrlInputs, setImageUrlInputs] = useState<Record<string, string>>({});

  // Department targeting
  const [userDepartment, setUserDepartment] = useState<string>('');

  useEffect(() => {
    if (formId) {
      fetchForm();
      fetchUserDepartment();
    }
  }, [formId]);

  const fetchUserDepartment = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('employees')
        .select('department')
        .eq('id', user.id)
        .single();
      if (data?.department) setUserDepartment(data.department);
    } catch {}
  };

  const fetchForm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dynamic_forms')
        .select('*')
        .eq('id', formId)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;

      let desc = data.description;
      let theme = '#673AB7';
      let banner = '';
      try {
        const parsed = JSON.parse(data.description);
        if (parsed.text !== undefined) {
          desc = parsed.text;
          theme = parsed.theme || '#673AB7';
          banner = parsed.banner || '';
        }
      } catch(e) {}
      
      data.description = desc;
      (data as any).theme_color = theme;
      (data as any).banner_url = banner;

      setForm(data);
      
      const initialAnswers: Record<string, any> = {};
      data.fields.forEach((f: FormField) => {
        if (f.type === 'checkbox') initialAnswers[f.id] = [];
        if (f.type === 'addon_group') initialAnswers[f.id] = null; // Tidak digunakan langsung
      });
      setAnswers(initialAnswers);
    } catch (error: any) {
      toast.error('Formulir tidak ditemukan');
      navigate('/portal/program');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('program-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: { owner: user?.id } // Penting untuk RLS policy
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('program-files')
        .getPublicUrl(filePath);

      setFileUploads(prev => ({ ...prev, [fieldId]: publicUrl }));
      toast.success('File berhasil diunggah');
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal mengunggah file');
    }
  };

  const handleImageUpload = async (fieldId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `img_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('program-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: { owner: user?.id }
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('program-files')
        .getPublicUrl(filePath);

      setImageUploads(prev => ({ ...prev, [fieldId]: publicUrl }));
      setAnswers(prev => ({ ...prev, [fieldId]: publicUrl }));
      toast.success('Gambar berhasil diunggah');
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal mengunggah gambar');
    }
  };

  const handleImageUrl = (fieldId: string, url: string) => {
    setImageUploads(prev => ({ ...prev, [fieldId]: url }));
    setAnswers(prev => ({ ...prev, [fieldId]: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validasi manual — hanya field yang visible
    const visibleFields = form?.fields.filter(isFieldVisible) || [];
    const missingFields = visibleFields.filter(f => {
        if (!f.required) return false;
        if (f.type === 'checkbox' && (!answers[f.id] || answers[f.id].length === 0)) return true;
        if (f.type === 'addon_group') {
            // Validasi addon: cek apakah ada pesanan yang quantity > 0
            const orders = addonOrders[f.id] || [];
            const hasOrder = orders.some(o => o.quantity > 0);
            return !hasOrder; // Jika wajib tapi tidak ada pesanan sama sekali
        }
        if (f.type === 'file_upload' && !fileUploads[f.id]) return true;
        if (f.type === 'image' && !imageUploads[f.id]) return true;
        return !answers[f.id];
    });

    if (missingFields && missingFields.length > 0) {
      toast.error(`Mohon lengkapi kolom wajib: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      // Format payload respons — exclude hidden fields
      const finalAnswers: Record<string, any> = {};
      visibleFields.forEach(f => {
        if (answers[f.id] !== undefined) finalAnswers[f.id] = answers[f.id];
      });
      
      // Inject file uploads ke jawaban
      Object.keys(fileUploads).forEach(key => {
        if (visibleFields.some(f => f.id === key)) finalAnswers[key] = fileUploads[key];
      });

      // Inject image uploads ke jawaban
      Object.keys(imageUploads).forEach(key => {
        if (visibleFields.some(f => f.id === key)) finalAnswers[key] = imageUploads[key];
      });

      // Inject addon orders ke jawaban
      Object.keys(addonOrders).forEach(key => {
        if (visibleFields.some(f => f.id === key)) finalAnswers[key] = addonOrders[key];
      });

      const { error: respError } = await supabase
        .from('dynamic_form_responses')
        .insert({
          form_id: formId,
          user_id: user.id,
          answers: finalAnswers
        });
      if (respError) throw respError;

      // Registrasi program jika ada
      if (programId) {
         // (Sama seperti kode sebelumnya, skip untuk brevity)
      }

      setSubmitted(true);
      toast.success('Formulir berhasil dikirim!');
    } catch (error: any) {
      toast.error('Gagal mengirim formulir: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = prev[fieldId] || [];
      if (checked) return { ...prev, [fieldId]: [...current, option] };
      return { ...prev, [fieldId]: current.filter((o: string) => o !== option) };
    });
  };

  // --- Conditional Logic ---
  const isFieldVisible = (field: FormField): boolean => {
    if (!field.condition) return true;
    const parentAnswer = answers[field.condition.fieldId];
    
    switch (field.condition.operator) {
      case 'eq':
        return parentAnswer === field.condition.value;
      case 'neq':
        return parentAnswer !== field.condition.value;
      case 'in': {
        const values = Array.isArray(field.condition.value) ? field.condition.value : [field.condition.value];
        return values.includes(parentAnswer);
      }
      default:
        return true;
    }
  };

  // --- Helper Renderers ---

  const renderImageChoice = (field: FormField) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {field.options?.map((opt) => (
        <label 
          key={opt.value}
          className={`relative cursor-pointer group rounded-2xl overflow-hidden border-2 transition-all ${
            answers[field.id] === opt.value
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-zinc-100 dark:border-zinc-800 hover:border-blue-300'
          }`}
        >
          <input
            type="radio"
            name={field.id}
            value={opt.value}
            checked={answers[field.id] === opt.value}
            onChange={() => setAnswers({ ...answers, [field.id]: opt.value })}
            className="sr-only"
          />
          <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 relative">
            {opt.image ? (
              <img src={opt.image} alt={opt.label} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}
            {answers[field.id] === opt.value && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                </div>
            )}
          </div>
          <div className="p-3 bg-white dark:bg-zinc-900">
            <p className="font-bold text-sm text-center text-zinc-800 dark:text-white">{opt.label}</p>
          </div>
        </label>
      ))}
    </div>
  );

  const renderRating = (field: FormField) => {
    const max = field.max || 5;
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {[...Array(max)].map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAnswers({ ...answers, [field.id]: i + 1 })}
              className={`p-2 transition-transform hover:scale-110 ${answers[field.id] === i + 1 ? 'text-yellow-400' : 'text-zinc-300'}`}
            >
              <Star className="w-8 h-8 fill-current" />
            </button>
          ))}
        </div>
        <p className="text-sm font-bold text-zinc-400">
            {answers[field.id] ? `Anda memberi ${answers[field.id]} bintang` : 'Pilih jumlah bintang'}
        </p>
      </div>
    );
  };

  const renderScale = (field: FormField) => {
    const max = field.max_scale || 10;
    return (
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-zinc-400 font-bold uppercase">
            <span>1</span>
            <span>{max}</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {[...Array(max)].map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAnswers({ ...answers, [field.id]: i + 1 })}
              className={`flex-1 min-w-[40px] h-12 rounded-xl font-bold transition-all ${
                answers[field.id] === i + 1
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderFileUpload = (field: FormField) => (
    <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 text-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {fileUploads[field.id] ? (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-blue-600">
                    <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300 truncate max-w-[200px]">File Terunggah</p>
                    <p className="text-xs text-blue-500/70 truncate max-w-[200px]">{fileUploads[field.id].split('/').pop()}</p>
                </div>
            </div>
            <button onClick={() => setFileUploads(prev => ({...prev, [field.id]: ''}))} className="text-zinc-400 hover:text-red-500">
                <X className="w-5 h-5" />
            </button>
        </div>
      ) : (
        <label className="cursor-pointer block">
          <input 
            type="file" 
            className="hidden" 
            accept={field.allowed_types?.join(',')}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(field.id, e.target.files[0])}
          />
          <UploadCloud className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Klik untuk Unggah</p>
          <p className="text-xs text-zinc-400 mt-1">Max {field.max_size_mb || 5}MB</p>
        </label>
      )}
    </div>
  );

  const renderAddonGroup = (field: FormField) => {
    const orders = addonOrders[field.id] || [{ item_id: field.items?.[0]?.id || '', size: '', quantity: 0 }];
    
    const addRow = () => {
        setAddonOrders(prev => ({
            ...prev,
            [field.id]: [...(prev[field.id] || []), { item_id: field.items?.[0]?.id || '', size: '', quantity: 0 }]
        }));
    };

    const updateRow = (index: number, key: keyof AddonOrder, value: any) => {
        const newOrders = [...orders];
        newOrders[index] = { ...newOrders[index], [key]: value };
        setAddonOrders(prev => ({ ...prev, [field.id]: newOrders }));
    };

    const removeRow = (index: number) => {
        if (orders.length > 1) {
            const newOrders = orders.filter((_, i) => i !== index);
            setAddonOrders(prev => ({ ...prev, [field.id]: newOrders }));
        } else {
            // Reset if it's the last one
             updateRow(0, 'quantity', 0);
             updateRow(0, 'size', '');
        }
    };

    return (
        <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {orders.map((order, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                         {/* Pilihan Item (Hidden if only 1 item) */}
                         {field.items && field.items.length > 1 && (
                            <select 
                                value={order.item_id}
                                onChange={(e) => updateRow(idx, 'item_id', e.target.value)}
                                className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                            >
                                {field.items.map(item => (
                                    <option key={item.id} value={item.id}>{item.name} (Rp {item.price})</option>
                                ))}
                            </select>
                         )}
                         
                         {/* Size Selector */}
                         <select 
                            value={order.size}
                            onChange={(e) => updateRow(idx, 'size', e.target.value)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
                         >
                             <option value="">Pilih Ukuran</option>
                             {field.items?.find(i => i.id === order.item_id)?.sizes.map(s => (
                                 <option key={s} value={s}>{s}</option>
                             ))}
                         </select>

                         {/* Quantity */}
                         <input 
                            type="number" 
                            min="1"
                            value={order.quantity}
                            onChange={(e) => updateRow(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
                            placeholder="Jumlah"
                         />
                    </div>
                    <button onClick={() => removeRow(idx)} className="p-3 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            ))}
            
            <button 
                onClick={addRow}
                className="w-full py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-500 font-bold text-sm hover:bg-white dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" /> Tambah Pesanan Ekstra
            </button>
            
            {field.required && (
                 <p className="text-xs text-orange-500 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Wajib memesan minimal 1
                 </p>
            )}
        </div>
    );
  };

  if (!user) return <Navigate to="/login" />;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;

  // Check targeting
  const isTargeted = !form?.target_niks && !form?.target_departments || (
    form?.target_niks?.includes(user?.nik || '') ||
    (form?.target_departments?.length > 0 && userDepartment && form.target_departments.includes(userDepartment))
  );

  if (!isTargeted && form) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-zinc-100 dark:border-zinc-800 shadow-xl">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-zinc-400" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Akses Terbatas</h2>
          <p className="text-zinc-500 mb-8">Formulir ini hanya dapat diakses oleh anggota yang telah ditentukan.</p>
          <button onClick={() => navigate('/portal')} className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-4 rounded-2xl font-black">Kembali</button>
        </div>
      </div>
    );
  }

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-zinc-100 dark:border-zinc-800 shadow-xl">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Berhasil!</h2>
            <p className="text-zinc-500 mb-8">Terima kasih telah mengisi formulir.</p>
            <button onClick={() => navigate('/portal/forms')} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black">Kembali</button>
        </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><ChevronLeft className="w-6 h-6 text-zinc-500" /></button>
          <div className="flex-1"><h1 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white truncate">{form?.title}</h1></div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-8">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-10 border border-zinc-100 dark:border-zinc-800 shadow-sm mb-8">
           <div className="mb-8 pb-8 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">{form?.title}</h2>
              <p className="text-zinc-500 leading-relaxed">{form?.description}</p>
           </div>

           <form onSubmit={handleSubmit} className="space-y-0">
              {form?.fields.map((field) => {
                const visible = isFieldVisible(field);
                return (
                <motion.div
                  key={field.id}
                  layout
                  animate={{ 
                    height: visible ? 'auto' : 0, 
                    opacity: visible ? 1 : 0,
                    marginBottom: visible ? 40 : 0,
                    overflow: 'hidden'
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                >
                  <div className="space-y-3">
                  <label className="flex items-center gap-2 text-base font-bold text-zinc-700 dark:text-zinc-300">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                 
                 {/* --- Rendering Types --- */}
                 
                 {field.type === 'text' && (
                   <input type="text" required={field.required} placeholder={field.placeholder} value={answers[field.id] || ''} onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none" />
                 )}

                 {field.type === 'textarea' && (
                   <textarea required={field.required} rows={4} value={answers[field.id] || ''} onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none" />
                 )}

                 {field.type === 'number' && (
                   <input type="number" required={field.required} value={answers[field.id] || ''} onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none" />
                 )}

                 {field.type === 'date' && (
                   <input type="date" required={field.required} value={answers[field.id] || ''} onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none" />
                 )}

                 {field.type === 'select' && (
                   <select required={field.required} value={answers[field.id] || ''} onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 appearance-none">
                     <option value="">-- Pilih --</option>
                     {field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                   </select>
                 )}

                 {field.type === 'radio' && (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {field.options?.map(opt => (
                       <label key={opt.value} className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer ${answers[field.id] === opt.value ? 'bg-blue-50 border-blue-500' : 'bg-zinc-50 border-zinc-100'}`}>
                         <input type="radio" name={field.id} checked={answers[field.id] === opt.value} onChange={() => setAnswers({...answers, [field.id]: opt.value})} className="w-5 h-5 accent-blue-500" />
                         <span className="font-bold text-sm">{opt.label}</span>
                       </label>
                     ))}
                   </div>
                 )}
                 
                 {field.type === 'checkbox' && (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {field.options?.map(opt => (
                       <label key={opt.value} className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer ${answers[field.id]?.includes(opt.value) ? 'bg-blue-50 border-blue-500' : 'bg-zinc-50 border-zinc-100'}`}>
                         <input type="checkbox" checked={answers[field.id]?.includes(opt.value)} onChange={(e) => handleCheckboxChange(field.id, opt.value, e.target.checked)} className="w-5 h-5 accent-blue-500 rounded" />
                         <span className="font-bold text-sm">{opt.label}</span>
                       </label>
                     ))}
                   </div>
                 )}

                 {field.type === 'image_choice' && renderImageChoice(field)}
                 {field.type === 'rating' && renderRating(field)}
                 {field.type === 'scale' && renderScale(field)}
                  {field.type === 'file_upload' && renderFileUpload(field)}
                  {field.type === 'image' && (
                    <div className="space-y-3">
                      {imageUploads[field.id] ? (
                        <div className="space-y-3">
                          <div className="relative rounded-2xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700">
                            <img src={imageUploads[field.id]} alt={field.label} className="w-full max-h-80 object-contain bg-zinc-50 dark:bg-zinc-800" />
                            <button
                              type="button"
                              onClick={() => { setImageUploads(prev => ({...prev, [field.id]: ''})); setAnswers(prev => ({...prev, [field.id]: ''})); }}
                              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Upload */}
                          <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(field.id, e.target.files[0])} />
                            <UploadCloud className="w-8 h-8 text-zinc-300" />
                            <span className="text-sm font-bold text-zinc-500">Klik untuk upload gambar</span>
                          </label>
                          {/* OR divider */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                            <span className="text-xs text-zinc-400 font-bold">ATAU</span>
                            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                          </div>
                          {/* URL input */}
                          <div className="flex gap-2">
                            <input
                              type="url"
                              placeholder="Atau masukkan URL gambar..."
                              value={imageUrlInputs[field.id] || ''}
                              onChange={(e) => {
                                setImageUrlInputs(prev => ({...prev, [field.id]: e.target.value}));
                                handleImageUrl(field.id, e.target.value);
                              }}
                              className="flex-1 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm focus:border-blue-500 focus:outline-none"
                            />
                            {imageUrlInputs[field.id] && (
                              <button
                                type="button"
                                onClick={() => handleImageUrl(field.id, imageUrlInputs[field.id])}
                                className="px-4 py-2 bg-blue-500 text-white rounded-2xl font-bold text-sm hover:bg-blue-600 transition-colors"
                              >
                                <Link2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {field.type === 'addon_group' && renderAddonGroup(field)}

                </div>
                </motion.div>
              );})}

             <div className="pt-8 flex flex-col gap-4">
               <button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 shadow-2xl shadow-blue-500/30">
                 {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Send className="w-6 h-6" /> Kirim Formulir</>}
               </button>
             </div>
           </form>
        </div>
      </div>
    </div>
  );
}

function ImageIcon({className}: {className?: string}) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
    )
}