import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { 
  ChevronLeft, Loader2, Download, Table, 
  Search, Calendar, User, FileSpreadsheet, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Response {
  id: string;
  user_id: string;
  form_id: string;
  answers: Record<string, any>;
  created_at: string;
  profiles: {
    name: string;
    nik: string;
  };
}

interface FormField {
  id: string;
  label: string;
  type: string;
}

interface DynamicForm {
  id: string;
  title: string;
  fields: FormField[];
}

export default function AdminFormResponses() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<DynamicForm | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);

  useEffect(() => {
    if (formId) fetchData();
  }, [formId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Form Definition
      const { data: formData, error: formError } = await supabase
        .from('dynamic_forms')
        .select('*')
        .eq('id', formId)
        .single();
      
      if (formError) throw formError;
      setForm(formData);

      // Fetch Responses
      const { data: resData, error: resError } = await supabase
        .from('dynamic_form_responses')
        .select('*, profiles:user_id(name, nik)')
        .eq('form_id', formId)
        .order('created_at', { ascending: false });

      if (resError) throw resError;
      setResponses(resData || []);
    } catch (error: any) {
      toast.error('Gagal memuat data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!form || responses.length === 0) return;

    try {
      const data = responses.map(r => {
        const row: Record<string, any> = {
          'Nama': r.profiles?.name || 'Anonim',
          'NIK': r.profiles?.nik || '-',
          'Waktu Submit': new Date(r.created_at).toLocaleString('id-ID'),
        };

        form.fields.forEach(field => {
          let answer = r.answers[field.id];
          if (Array.isArray(answer)) answer = answer.join(', ');
          row[field.label] = answer || '-';
        });

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Respon Formulir');
      
      // Auto-width columns
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const cols = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxLen = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && cell.v) {
            const len = cell.v.toString().length;
            if (len > maxLen) maxLen = len;
          }
        }
        cols.push({ wch: maxLen + 2 });
      }
      ws['!cols'] = cols;

      XLSX.writeFile(wb, `Respon_${form.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Export Excel berhasil!');
    } catch (error: any) {
      toast.error('Gagal export: ' + error.message);
    }
  };

  const filteredResponses = responses.filter(r => 
    r.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.profiles?.nik?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard/admin/forms')}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Hasil Respon</h1>
            <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">{form?.title}</p>
          </div>
        </div>

        <button
          onClick={exportToExcel}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          <FileSpreadsheet className="w-5 h-5" />
          Export ke Excel
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 dark:border-zinc-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-blue-600" />
            <span className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">
              {responses.length} Respon Masuk
            </span>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari Nama atau NIK..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border-none rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Waktu</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pengisi</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">NIK</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredResponses.map((res) => (
                <tr 
                  key={res.id}
                  className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors group"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {new Date(res.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 font-black text-[10px]">
                        {res.profiles?.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-black text-zinc-900 dark:text-white">
                        {res.profiles?.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono font-bold text-zinc-500">
                      {res.profiles?.nik || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedResponse(res)}
                      className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-zinc-400 hover:text-blue-600 rounded-lg transition-all"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Response Detail Modal */}
      <AnimatePresence>
        {selectedResponse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResponse(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-50 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">{selectedResponse.profiles?.name}</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">NIK: {selectedResponse.profiles?.nik}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedResponse(null)}
                  className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6 custom-scrollbar">
                {form?.fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{field.label}</p>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                      <p className="text-zinc-900 dark:text-white font-bold">
                        {Array.isArray(selectedResponse.answers[field.id]) 
                          ? selectedResponse.answers[field.id].join(', ') 
                          : selectedResponse.answers[field.id] || '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-50 dark:border-zinc-800">
                <button
                  onClick={() => setSelectedResponse(null)}
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Tutup Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
