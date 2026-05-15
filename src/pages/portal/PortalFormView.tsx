import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  ClipboardList, ChevronLeft, Loader2, Send, 
  CheckCircle2, AlertCircle, Calendar, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

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

  useEffect(() => {
    if (formId) fetchForm();
  }, [formId]);

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
      setForm(data);
      
      // Initialize checkbox answers as empty arrays
      const initialAnswers: Record<string, any> = {};
      data.fields.forEach((f: FormField) => {
        if (f.type === 'checkbox') initialAnswers[f.id] = [];
      });
      setAnswers(initialAnswers);
    } catch (error: any) {
      toast.error('Formulir tidak ditemukan atau sudah tidak aktif');
      navigate('/portal/program');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate required fields
    const missingFields = form?.fields.filter(f => f.required && (!answers[f.id] || (Array.isArray(answers[f.id]) && answers[f.id].length === 0)));
    if (missingFields && missingFields.length > 0) {
      toast.error(`Mohon isi field wajib: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save Form Response
      const { error: respError } = await supabase
        .from('dynamic_form_responses')
        .insert({
          form_id: formId,
          user_id: user.id,
          answers: answers
        });
      if (respError) throw respError;

      // 2. If programId exists, register for program
      if (programId) {
        const kuponCode = programId.slice(0, 4).toUpperCase() + '-' + user.id.slice(0, 5).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
        const { error: regError } = await supabase
          .from('program_registrations')
          .insert({
            program_id: programId,
            user_id: user.id,
            status: 'terdaftar',
            kupon_code: kuponCode
          });
        if (regError) {
          console.error('Program registration error (might be already registered):', regError);
          // Don't throw error if user is already registered, just proceed
        }
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
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      } else {
        return { ...prev, [fieldId]: current.filter((o: string) => o !== option) };
      }
    });
  };

  if (!user) return <Navigate to="/login" />;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-zinc-500 font-bold animate-pulse">Memuat formulir...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-zinc-100 dark:border-zinc-800 shadow-xl"
        >
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Berhasil Terkirim!</h2>
          <p className="text-zinc-500 mb-8">Terima kasih telah mengisi formulir ini. Data Anda telah kami simpan.</p>
          <button
            onClick={() => navigate(programId ? '/portal/program' : '/portal/forms')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black transition-all active:scale-95 shadow-lg shadow-blue-500/20"
          >
            {programId ? 'Kembali ke Program' : 'Kembali ke Daftar Formulir'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 md:py-6 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-zinc-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white truncate">{form?.title}</h1>
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Formulir Anggota SP</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-8">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-10 border border-zinc-100 dark:border-zinc-800 shadow-sm mb-8">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <ClipboardList className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">{form?.title}</h2>
              <p className="text-zinc-500 leading-relaxed">{form?.description}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {form?.fields.map((field) => (
              <div key={field.id} className="space-y-3">
                <label className="flex items-center gap-2 text-base font-bold text-zinc-700 dark:text-zinc-300">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                
                {field.type === 'text' && (
                  <input
                    type="text"
                    required={field.required}
                    placeholder={field.placeholder}
                    value={answers[field.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-zinc-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    required={field.required}
                    placeholder={field.placeholder}
                    rows={4}
                    value={answers[field.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-zinc-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all resize-none"
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    required={field.required}
                    placeholder={field.placeholder}
                    value={answers[field.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-zinc-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                )}

                {field.type === 'date' && (
                  <input
                    type="date"
                    required={field.required}
                    value={answers[field.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-zinc-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                )}

                {field.type === 'select' && (
                  <select
                    required={field.required}
                    value={answers[field.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-zinc-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all appearance-none"
                  >
                    <option value="">-- Pilih Opsi --</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.type === 'radio' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {field.options?.map(opt => (
                      <label 
                        key={opt}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                          answers[field.id] === opt 
                            ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                            : 'bg-zinc-50 border-zinc-100 text-zinc-600 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={field.id}
                          checked={answers[field.id] === opt}
                          onChange={() => setAnswers({ ...answers, [field.id]: opt })}
                          className="w-5 h-5 accent-blue-500"
                        />
                        <span className="font-bold text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {field.type === 'checkbox' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {field.options?.map(opt => (
                      <label 
                        key={opt}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                          answers[field.id]?.includes(opt)
                            ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                            : 'bg-zinc-50 border-zinc-100 text-zinc-600 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={answers[field.id]?.includes(opt)}
                          onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                          className="w-5 h-5 accent-blue-500 rounded"
                        />
                        <span className="font-bold text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="pt-8 flex flex-col items-center gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl shadow-blue-500/30"
              >
                {submitting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Send className="w-6 h-6" />
                    Kirim Formulir
                  </>
                )}
              </button>
              <div className="flex items-center gap-2 text-zinc-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Mohon periksa kembali jawaban Anda</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
