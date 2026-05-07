import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { 
  Megaphone, Gift, Calendar, Users, ClipboardCheck, 
  Plus, Edit, Trash2, Eye, X, CheckCircle, XCircle,
  MessageSquare, Heart, AlertTriangle, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface UnionProgram {
  id: string;
  name: string;
  description: string;
  program_type: 'kupon' | 'kurban' | 'gathering' | 'attendance' | 'lainnya';
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

interface Feedback {
  id: string;
  user_id: string;
  type: 'kritik' | 'saran' | 'pengaduan' | 'pembelaan';
  title: string;
  description: string;
  status: 'pending' | 'diproses' | 'selesai' | 'ditolak';
  response: string;
  profiles?: { name: string };
  created_at: string;
}

export default function AdminUnionPrograms() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<UnionProgram[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'programs' | 'feedback'>('programs');
  const [showModal, setShowModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<UnionProgram | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    program_type: 'kupon',
    start_date: '',
    end_date: '',
    is_active: true
  });
  const [feedbackResponse, setFeedbackResponse] = useState('');

  useEffect(() => {
    if (user?.role !== 'superadmin' && user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [progRes, feedRes] = await Promise.all([
        supabase.from('union_programs').select('*').order('created_at', { ascending: false }),
        supabase.from('feedbacks').select('*, profiles(name)').order('created_at', { ascending: false }).limit(50)
      ]);
      
      if (progRes.data) setPrograms(progRes.data);
      if (feedRes.data) setFeedbacks(feedRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedProgram) {
        await supabase.from('union_programs').update(formData).eq('id', selectedProgram.id);
        toast.success('Program diperbarui');
      } else {
        await supabase.from('union_programs').insert({ ...formData, created_by: user?.id });
        toast.success('Program dibuat');
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error('Gagal menyimpan program');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus program ini?')) return;
    try {
      await supabase.from('union_programs').delete().eq('id', id);
      toast.success('Program dihapus');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus');
    }
  };

  const handleFeedbackResponse = async (feedbackId: string, status: string, response: string) => {
    try {
      await supabase.from('feedbacks').update({
        status,
        response,
        responded_by: user?.id,
        responded_at: new Date().toISOString()
      }).eq('id', feedbackId);
      toast.success('Feedback diproses');
      setShowFeedbackModal(false);
      fetchData();
    } catch (error) {
      toast.error('Gagal memproses feedback');
    }
  };

  const getProgramIcon = (type: string) => {
    switch (type) {
      case 'kupon': return <Gift className="w-5 h-5" />;
      case 'kurban': return <Shield className="w-5 h-5" />;
      case 'gathering': return <Users className="w-5 h-5" />;
      case 'attendance': return <ClipboardCheck className="w-5 h-5" />;
      default: return <Calendar className="w-5 h-5" />;
    }
  };

  const getFeedbackIcon = (type: string) => {
    switch (type) {
      case 'kritik': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'saran': return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'pengaduan': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'pembelaan': return <Shield className="w-5 h-5 text-green-500" />;
      default: return <MessageSquare className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700',
      diproses: 'bg-blue-100 text-blue-700',
      selesai: 'bg-green-100 text-green-700',
      ditolak: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status as keyof typeof styles]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">
            Program Serikat
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Kelola kritik, saran, dan program serikat
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab('programs')}
          className={`px-4 py-2 font-bold text-sm transition-colors ${
            activeTab === 'programs'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <Megaphone className="w-4 h-4 inline mr-2" />
          Program
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 font-bold text-sm transition-colors ${
            activeTab === 'feedback'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Kritik & Saran
          {feedbacks.filter(f => f.status === 'pending').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {feedbacks.filter(f => f.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Programs Tab */}
      {activeTab === 'programs' && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setSelectedProgram(null);
              setFormData({
                name: '',
                description: '',
                program_type: 'kupon',
                start_date: '',
                end_date: '',
                is_active: true
              });
              setShowModal(true);
            }}
            className="btn-clay-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Buat Program Baru
          </button>

          {loading ? (
            <div className="text-center py-8 text-zinc-400">Memuat...</div>
          ) : programs.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
              Belum ada program. Klik "Buat Program Baru" untuk memulai.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                        {getProgramIcon(program.program_type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">{program.name}</h3>
                        <p className="text-xs text-zinc-500 capitalize">{program.program_type}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      program.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {program.is_active ? 'AKTIF' : 'TIDAK AKTIF'}
                    </span>
                  </div>
                  
                  {program.description && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {program.description}
                    </p>
                  )}
                  
                  {(program.start_date || program.end_date) && (
                    <div className="mt-2 text-xs text-zinc-400">
                      {program.start_date && format(new Date(program.start_date), 'dd MMM yyyy')}
                      {program.start_date && program.end_date && ' - '}
                      {program.end_date && format(new Date(program.end_date), 'dd MMM yyyy')}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedProgram(program);
                        setFormData({
                          name: program.name,
                          description: program.description || '',
                          program_type: program.program_type,
                          start_date: program.start_date || '',
                          end_date: program.end_date || '',
                          is_active: program.is_active
                        });
                        setShowModal(true);
                      }}
                      className="flex-1 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      <Edit className="w-3 h-3 inline mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(program.id)}
                      className="py-2 px-3 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-zinc-400">Memuat...</div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
              Belum ada kritik/saran. Anggota bisa提交melalui menu Profil.
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {getFeedbackIcon(feedback.type)}
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">{feedback.title}</h3>
                        <p className="text-xs text-zinc-500">
                          {feedback.profiles?.name || 'Anonim'} • {format(new Date(feedback.created_at), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(feedback.status)}
                  </div>
                  
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
                    {feedback.description}
                  </p>
                  
                  {feedback.response && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-xs font-bold text-green-700 dark:text-green-400">Respons:</p>
                      <p className="text-sm text-green-600 dark:text-green-300">{feedback.response}</p>
                    </div>
                  )}
                  
                  {feedback.status === 'pending' && (
                    <button
                      onClick={() => {
                        setSelectedFeedback(feedback);
                        setShowFeedbackModal(true);
                      }}
                      className="mt-3 btn-clay-primary py-2"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Proses
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Program Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black">
                {selectedProgram ? 'Edit Program' : 'Program Baru'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nama Program
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-clay w-full"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Jenis Program
                </label>
                <select
                  value={formData.program_type}
                  onChange={(e) => setFormData({ ...formData, program_type: e.target.value as any })}
                  className="input-clay w-full"
                >
                  <option value="kupon">Kupon</option>
                  <option value="kurban">Kurban</option>
                  <option value="gathering">Gathering</option>
                  <option value="attendance">Daftar Hadir</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-clay w-full h-24"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Mulai
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="input-clay w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Selesai
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="input-clay w-full"
                  />
                </div>
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-bold">Program Aktif</span>
              </label>
              
              <button type="submit" className="btn-clay-primary w-full">
                {selectedProgram ? 'Simpan Perubahan' : 'Buat Program'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Response Modal */}
      {showFeedbackModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black">Proses Feedback</h2>
              <button onClick={() => setShowFeedbackModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <p className="text-xs font-bold text-zinc-500 uppercase">Jenis</p>
                <p className="font-bold capitalize">{selectedFeedback.type}</p>
              </div>
              
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <p className="text-xs font-bold text-zinc-500 uppercase">Judul</p>
                <p className="font-bold">{selectedFeedback.title}</p>
              </div>
              
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <p className="text-xs font-bold text-zinc-500 uppercase">Isi</p>
                <p className="text-sm">{selectedFeedback.description}</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Respons/Tanggapan
                </label>
                <textarea
                  value={feedbackResponse}
                  onChange={(e) => setFeedbackResponse(e.target.value)}
                  className="input-clay w-full h-32"
                  placeholder="Tulis respons atau tanggapan..."
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedbackResponse(selectedFeedback.id, 'ditolak', feedbackResponse)}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600"
                >
                  <XCircle className="w-4 h-4 inline mr-2" />
                  Tolak
                </button>
                <button
                  onClick={() => handleFeedbackResponse(selectedFeedback.id, 'selesai', feedbackResponse)}
                  className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600"
                >
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}