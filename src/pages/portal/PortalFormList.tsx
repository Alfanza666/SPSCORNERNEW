import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  ClipboardList, ChevronRight, Loader2, Search, 
  Filter, FileText, Calendar, ArrowRight, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DynamicForm {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
  program_name?: string;
  program_id?: string;
}

export default function PortalFormList() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [forms, setForms] = useState<DynamicForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) fetchForms();
  }, [user]);

  const fetchForms = async () => {
    setLoading(true);
    try {
      // Fetch active forms
      const { data: formsData, error: formsError } = await supabase
        .from('dynamic_forms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (formsError) throw formsError;

      // Fetch programs that are linked to these forms
      const { data: programsData } = await supabase
        .from('union_programs')
        .select('id, name, dynamic_form_id')
        .not('dynamic_form_id', 'is', null);

      const enrichedForms = (formsData || []).map(form => {
        const linkedProgram = programsData?.find(p => p.dynamic_form_id === form.id);
        return {
          ...form,
          program_name: linkedProgram?.name,
          program_id: linkedProgram?.id
        };
      });

      setForms(enrichedForms);
    } catch (error: any) {
      console.error('Error fetching forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredForms = forms.filter(f => 
    f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          Daftar Formulir
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">Isi survei, pendaftaran program, atau kuesioner</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari judul atau deskripsi formulir..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
          <p className="text-zinc-400 font-bold animate-pulse">Memuat formulir...</p>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <ClipboardList className="w-20 h-20 text-zinc-100 dark:text-zinc-800 mx-auto mb-6" />
          <p className="text-zinc-500 font-black text-xl">Tidak ada formulir ditemukan</p>
          <p className="text-zinc-400 mt-2">Coba gunakan kata kunci pencarian lain.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {filteredForms.map((form, index) => (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/portal/forms/${form.id}${form.program_id ? `?programId=${form.program_id}` : ''}`)}
                className="group bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer overflow-hidden relative"
              >
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <FileText className="w-7 h-7" />
                    </div>
                    {form.program_name && (
                      <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                        Program Terkait
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                    {form.title}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-6 h-10">
                    {form.description || 'Isi formulir ini untuk memberikan informasi yang dibutuhkan.'}
                  </p>

                  <div className="flex items-center justify-between pt-6 border-t border-zinc-50 dark:border-zinc-800">
                    <div className="flex flex-col gap-1">
                      {form.program_name && (
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                          <Info className="w-3 h-3" />
                          <span>{form.program_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        <Calendar className="w-3 h-3" />
                        <span>Dibuat {new Date(form.created_at).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
