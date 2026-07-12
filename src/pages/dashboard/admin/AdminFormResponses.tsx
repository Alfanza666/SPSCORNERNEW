import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
  ChevronLeft, Loader2, Download, Table,
  Search, Calendar, User, FileSpreadsheet, Eye, BarChart3, FileText
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
  employeeName?: string;
  employeeNik?: string;
  employeeDept?: string;
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
  const [showCharts, setShowCharts] = useState(false);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const responsesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formId) {
      fetchData();
      fetchDepartments();
    }
  }, [formId]);

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

      // Ambil NIK dari respon untuk mencocokkan dengan master data karyawan (employees)
      const niks = (resData || []).map(r => r.profiles?.nik).filter(Boolean);
      let employeesMap: Record<string, { name: string; department: string }> = {};

      if (niks.length > 0) {
        const { data: empData } = await supabase
          .from('employees')
          .select('nik, name, department')
          .in('nik', niks);
        
        (empData || []).forEach(e => {
          employeesMap[e.nik] = { name: e.name, department: e.department };
        });
      }

      // Gabungkan data respon dengan data karyawan resmi
      const enrichedResponses = (resData || []).map(r => {
        const userNik = r.profiles?.nik;
        const emp = userNik ? employeesMap[userNik] : null;
        return {
          ...r,
          employeeName: emp ? emp.name : r.profiles?.name || 'Anonim',
          employeeNik: userNik || '-',
          employeeDept: emp ? emp.department : 'Luar Serikat / Non-Staff'
        };
      });

      setResponses(enrichedResponses);
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
          'Nama Karyawan': r.employeeName,
          'NIK': r.employeeNik,
          'Departemen': r.employeeDept,
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

  // Chart aggregation
  const getChartData = (fieldId: string) => {
    const counts: Record<string, number> = {};
    responses.forEach(r => {
      const answer = r.answers[fieldId];
      if (answer !== undefined && answer !== null && answer !== '') {
        if (Array.isArray(answer)) {
          answer.forEach((v: string) => { counts[v] = (counts[v] || 0) + 1; });
        } else {
          counts[String(answer)] = (counts[String(answer)] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count, percentage: Math.round((count / responses.length) * 100) }))
      .sort((a, b) => b.count - a.count);
  };

  const isChartable = (type: string) => ['radio', 'select', 'checkbox', 'rating', 'scale', 'image_choice'].includes(type);

  // PDF Export
  const exportToPdf = async () => {
    if (!form || responses.length === 0) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.setFontSize(16);
      doc.text(form.title, 14, 20);
      doc.setFontSize(10);
      doc.text(`Total Responden: ${responses.length} | ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

      const tableData = responses.map(r => {
        const row: string[] = [
          r.employeeName || 'Anonim',
          r.employeeNik || '-',
          r.employeeDept || '-',
          new Date(r.created_at).toLocaleString('id-ID'),
        ];
        form.fields.forEach(f => {
          let answer = r.answers[f.id];
          if (Array.isArray(answer)) answer = answer.join(', ');
          row.push(String(answer || '-'));
        });
        return row;
      });

      const headers = ['Nama', 'NIK', 'Departemen', 'Waktu', ...form.fields.map(f => f.label)];

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 35,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [103, 58, 183] },
      });

      doc.save(`Respon_${form.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Export PDF berhasil!');
    } catch (error: any) {
      toast.error('Gagal export PDF: ' + error.message);
    }
  };

  const filteredResponses = responses.filter(r => {
    if (filterDepartment && r.employeeDept !== filterDepartment) {
      return false;
    }
    const nameMatch = (r.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const nikMatch = (r.employeeNik || '').toLowerCase().includes(searchTerm.toLowerCase());
    return nameMatch || nikMatch;
  });

  // Render answer based on type
  const renderAnswer = (field: any, answer: any) => {
    if (answer === null || answer === undefined || answer === '') return <span className="text-zinc-400 italic">-</span>;
    
    if (field.type === 'image' && typeof answer === 'string' && (answer.startsWith('http') || answer.startsWith('data:'))) {
      return (
        <a href={answer} target="_blank" rel="noopener noreferrer" className="inline-block">
          <img src={answer} alt="" className="w-20 h-20 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700 hover:opacity-80 transition-opacity" />
        </a>
      );
    }
    
    if (field.type === 'file_upload' && typeof answer === 'string') {
      return (
        <a href={answer} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs font-bold">
          Download File
        </a>
      );
    }

    if (Array.isArray(answer)) return answer.join(', ');
    return String(answer);
  };

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

        <div className="flex items-center gap-2 flex-wrap">
          {availableDepartments.length > 0 && (
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-3 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold focus:outline-none"
            >
              <option value="">Semua Departemen</option>
              {availableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowCharts(!showCharts)}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
              showCharts ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            Grafik
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Excel
          </button>
          <button
            onClick={exportToPdf}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-red-500/20 active:scale-95"
          >
            <FileText className="w-5 h-5" />
            PDF
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <AnimatePresence>
        {showCharts && form && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-50 dark:border-zinc-800">
              <h3 className="font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                Grafik Respon
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {form.fields.filter(f => isChartable(f.type)).map(field => {
                const data = getChartData(field.id);
                if (data.length === 0) return null;
                const maxCount = Math.max(...data.map(d => d.count), 1);
                return (
                  <div key={field.id} className="space-y-3">
                    <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">{field.label}</p>
                    <div className="space-y-2">
                      {data.map(item => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate">{item.label}</span>
                            <span className="text-zinc-400 font-mono">{item.count} ({item.percentage}%)</span>
                          </div>
                          <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(item.count / maxCount) * 100}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pengisi (Resmi)</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">NIK</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Departemen</th>
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
                        {(res.employeeName || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-black text-zinc-900 dark:text-white">
                        {res.employeeName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono font-bold text-zinc-500">
                      {res.employeeNik || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                      {res.employeeDept || '-'}
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
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">{selectedResponse.employeeName}</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                      NIK: {selectedResponse.employeeNik} | Dept: {selectedResponse.employeeDept}
                    </p>
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
                      <div className="text-zinc-900 dark:text-white font-bold">
                        {renderAnswer(field, selectedResponse.answers[field.id])}
                      </div>
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
