import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Megaphone, Plus, X, Pin, Trash2, Loader2, Edit, Upload, Image as ImageIcon, Users, Trophy, ClipboardList, Calendar, ChevronDown, ChevronUp, UserPlus, FileText, BarChart3, CheckCheck } from 'lucide-react';
import RichTextEditor from '../../../components/ui/RichTextEditor';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  is_pinned: boolean;
  announcement_type?: string;
  gathering_config?: GatheringConfig;
  target_niks?: string[];
  created_by: string;
  profiles?: { name: string };
  created_at: string;
}

interface GatheringConfig {
  voting_enabled: boolean;
  voting_deadline?: string;
  surveys: GatheringSurvey[];
}

interface GatheringSurvey {
  id: string;
  title: string;
  description?: string;
  form_id?: string;
  external_url?: string;
}

interface CandidateInput {
  id?: string;
  name: string;
  photo_url: string;
  photo_file?: File;
  sort_order: number;
}

export default function AdminAnnouncements() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Basic form
  const [form, setForm] = useState({
    title: '',
    content: '',
    is_pinned: false,
    image_url: '',
    announcement_type: 'general' as 'general' | 'gathering'
  });

  // Gathering-specific state
  const [candidates, setCandidates] = useState<CandidateInput[]>([]);
  const [gatheringConfig, setGatheringConfig] = useState<GatheringConfig>({
    voting_enabled: false,
    voting_deadline: '',
    surveys: []
  });
  const [targetNiks, setTargetNiks] = useState('');
  const [showGatheringSection, setShowGatheringSection] = useState(false);
  const [dynamicForms, setDynamicForms] = useState<{ id: string; title: string }[]>([]);
  const [uploadingCandidate, setUploadingCandidate] = useState<string | null>(null);

  // Voting results modal
  const [showVoteResults, setShowVoteResults] = useState(false);
  const [voteResultsAnnouncement, setVoteResultsAnnouncement] = useState<Announcement | null>(null);
  const [voteResultsCandidates, setVoteResultsCandidates] = useState<{ id: string; name: string; photo_url?: string; count: number }[]>([]);
  const [voteResultsLoading, setVoteResultsLoading] = useState(false);

  const handleViewVoteResults = async (announcement: Announcement) => {
    setVoteResultsAnnouncement(announcement);
    setShowVoteResults(true);
    setVoteResultsLoading(true);
    try {
      const { data: candidates } = await supabase
        .from('gathering_candidates')
        .select('*')
        .eq('announcement_id', announcement.id)
        .order('sort_order');

      const { data: allVotes } = await supabase
        .from('gathering_votes')
        .select('candidate_id')
        .eq('announcement_id', announcement.id);

      const counts: Record<string, number> = {};
      if (allVotes) {
        allVotes.forEach(v => { counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1; });
      }

      setVoteResultsCandidates(
        (candidates || []).map(c => ({
          id: c.id,
          name: c.name,
          photo_url: c.photo_url,
          count: counts[c.id] || 0,
        }))
      );
    } catch (error) {
      console.error('Error fetching vote results:', error);
      toast.error('Gagal memuat hasil voting');
    } finally {
      setVoteResultsLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      fetchAnnouncements();
      fetchDynamicForms();
    }
  }, [user]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles(name)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDynamicForms = async () => {
    try {
      const { data } = await supabase
        .from('dynamic_forms')
        .select('id, title')
        .eq('is_active', true);
      if (data) setDynamicForms(data);
    } catch (error) {
      console.error('Error fetching forms:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `posters/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('announcements')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('announcements')
        .getPublicUrl(filePath);

      setForm({ ...form, image_url: publicUrl });
      toast.success('Gambar berhasil diunggah');
    } catch (error: any) {
      toast.error('Gagal mengunggah gambar: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Candidate photo upload
  const handleCandidatePhotoUpload = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    const candidateKey = `candidate-${index}`;
    setUploadingCandidate(candidateKey);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `candidate-${Date.now()}-${index}.${fileExt}`;
      const filePath = `candidates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('announcements')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('announcements')
        .getPublicUrl(filePath);

      const updated = [...candidates];
      updated[index] = { ...updated[index], photo_url: publicUrl };
      setCandidates(updated);
      toast.success('Foto kandidat diunggah');
    } catch (error: any) {
      toast.error('Gagal mengunggah foto: ' + error.message);
    } finally {
      setUploadingCandidate(null);
    }
  };

  const addCandidate = () => {
    setCandidates([...candidates, { name: '', photo_url: '', sort_order: candidates.length }]);
  };

  const removeCandidate = (index: number) => {
    setCandidates(candidates.filter((_, i) => i !== index));
  };

  const updateCandidate = (index: number, field: keyof CandidateInput, value: any) => {
    const updated = [...candidates];
    updated[index] = { ...updated[index], [field]: value };
    setCandidates(updated);
  };

  // Survey management
  const addSurvey = () => {
    setGatheringConfig({
      ...gatheringConfig,
      surveys: [...gatheringConfig.surveys, { id: crypto.randomUUID(), title: '', description: '', form_id: '' }]
    });
  };

  const removeSurvey = (id: string) => {
    setGatheringConfig({
      ...gatheringConfig,
      surveys: gatheringConfig.surveys.filter(s => s.id !== id)
    });
  };

  const updateSurvey = (id: string, field: string, value: string) => {
    setGatheringConfig({
      ...gatheringConfig,
      surveys: gatheringConfig.surveys.map(s => s.id === id ? { ...s, [field]: value } : s)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      toast.error('Mohon lengkapi semua kolom');
      return;
    }

    // Validate gathering-specific fields
    if (form.announcement_type === 'gathering' && gatheringConfig.voting_enabled) {
      if (candidates.length === 0) {
        toast.error('Tambahkan minimal 1 kandidat untuk voting');
        return;
      }
      const hasEmptyName = candidates.some(c => !c.name.trim());
      if (hasEmptyName) {
        toast.error('Semua kandidat harus memiliki nama');
        return;
      }
    }

    setSaving(true);
    try {
      // Parse target NIKs
      const nikArray = targetNiks.trim()
        ? targetNiks.split(/[,\n;]/).map(nik => nik.trim()).filter(nik => nik.length >= 3)
        : null;

      const announcementData: any = {
        title: form.title,
        content: form.content,
        is_pinned: form.is_pinned,
        image_url: form.image_url || null,
        announcement_type: form.announcement_type,
        gathering_config: form.announcement_type === 'gathering' ? gatheringConfig : null,
        target_niks: form.announcement_type === 'gathering' ? nikArray : null,
        created_by: user?.id
      };

      let announcementId: string;

      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingId);
        if (error) throw error;
        announcementId = editingId;
        toast.success('Pengumuman diperbarui');
      } else {
        const { data, error } = await supabase
          .from('announcements')
          .insert(announcementData)
          .select('id')
          .single();
        if (error) throw error;
        announcementId = data.id;
        toast.success('Pengumuman dipublikasikan');

        // Trigger push notification broadcast
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch('/api/notifications/broadcast', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                title: 'Pengumuman Baru: ' + form.title,
                message: form.content.replace(/<[^>]*>/g, '').substring(0, 100) + (form.content.replace(/<[^>]*>/g, '').length > 100 ? '...' : ''),
                url: '/portal/pengumuman'
              })
            });
          }
        } catch (e) {
          console.error("Broadcast failed:", e);
        }
      }

      // Save candidates for gathering type
      if (form.announcement_type === 'gathering' && gatheringConfig.voting_enabled) {
        // Delete existing candidates first (for edit mode)
        if (editingId) {
          await supabase.from('gathering_candidates').delete().eq('announcement_id', announcementId);
        }

        // Insert candidates
        if (candidates.length > 0) {
          const candidateData = candidates.map((c, i) => ({
            announcement_id: announcementId,
            name: c.name,
            photo_url: c.photo_url || null,
            sort_order: i
          }));

          const { error: candError } = await supabase
            .from('gathering_candidates')
            .insert(candidateData);
          if (candError) throw candError;
        }
      }

      resetForm();
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Gagal menyimpan: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (announcement: Announcement) => {
    setForm({
      title: announcement.title,
      content: announcement.content,
      is_pinned: announcement.is_pinned,
      image_url: announcement.image_url || '',
      announcement_type: (announcement.announcement_type as any) || 'general'
    });
    setEditingId(announcement.id);

    if (announcement.announcement_type === 'gathering') {
      setShowGatheringSection(true);
      setGatheringConfig(announcement.gathering_config || { voting_enabled: false, voting_deadline: '', surveys: [] });
      setTargetNiks(announcement.target_niks?.join(', ') || '');

      // Fetch existing candidates
      const { data: candidateData } = await supabase
        .from('gathering_candidates')
        .select('*')
        .eq('announcement_id', announcement.id)
        .order('sort_order');

      if (candidateData) {
        setCandidates(candidateData.map(c => ({
          id: c.id,
          name: c.name,
          photo_url: c.photo_url || '',
          sort_order: c.sort_order
        })));
      }
    } else {
      setShowGatheringSection(false);
      setCandidates([]);
      setGatheringConfig({ voting_enabled: false, voting_deadline: '', surveys: [] });
      setTargetNiks('');
    }

    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus pengumuman ini? Data voting dan kandidat terkait juga akan terhapus.')) return;
    try {
      // Cascade deletes handle candidates and votes
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast.success('Pengumuman dihapus');
      fetchAnnouncements();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal menghapus');
    }
  };

  const resetForm = () => {
    setForm({ title: '', content: '', is_pinned: false, image_url: '', announcement_type: 'general' });
    setEditingId(null);
    setShowForm(false);
    setShowGatheringSection(false);
    setCandidates([]);
    setGatheringConfig({ voting_enabled: false, voting_deadline: '', surveys: [] });
    setTargetNiks('');
  };

  // CSV upload for NIK
  const handleNikCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const niks = lines.slice(1).map(l => l.split(/[,\t;]/)[0]?.trim()).filter(n => n && n.length >= 3);
      setTargetNiks(niks.join(', '));
      toast.success(`${niks.length} NIK berhasil dimuat dari file`);
    } catch (error: any) {
      toast.error('Gagal membaca file');
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-4 text-center">Akses ditolak</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Pengumuman</h1>
            <p className="text-sm text-zinc-500">Buat dan kelola pengumuman</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Buat
          </button>
        </div>

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-zinc-900 rounded-xl p-4 mb-4 border border-zinc-200 dark:border-zinc-700 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">{editingId ? 'Edit' : 'Buat'} Pengumuman</h3>
                <button onClick={resetForm}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Announcement Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Tipe Pengumuman</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, announcement_type: 'general' }); setShowGatheringSection(false); }}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.announcement_type === 'general'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <Megaphone className={`w-5 h-5 mb-1 ${form.announcement_type === 'general' ? 'text-blue-600' : 'text-zinc-400'}`} />
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">Umum</p>
                      <p className="text-[10px] text-zinc-400">Pengumuman biasa</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, announcement_type: 'gathering' }); setShowGatheringSection(true); }}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.announcement_type === 'gathering'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <Users className={`w-5 h-5 mb-1 ${form.announcement_type === 'gathering' ? 'text-amber-600' : 'text-zinc-400'}`} />
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">Gathering</p>
                      <p className="text-[10px] text-zinc-400">Voting, survei, target</p>
                    </button>
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Poster / Gambar (Opsional)</label>
                  <div className="flex flex-col gap-3">
                    {form.image_url && (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                        <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, image_url: '' })}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-zinc-50 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>
                          <ImageIcon className="w-4 h-4" />
                          {form.image_url ? 'Ganti Gambar' : 'Unggah Poster / Gambar'}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Judul</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Judul pengumuman"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Konten</label>
                  <RichTextEditor
                    content={form.content}
                    onChange={(html) => setForm({ ...form, content: html })}
                    placeholder="Isi pengumuman..."
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                    className="w-5 h-5 rounded accent-amber-500"
                  />
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Tandai PENTING (Sematkan di Atas)</span>
                </label>

                {/* ═══════════════════════════════════════════ */}
                {/* GATHERING SECTION */}
                {/* ═══════════════════════════════════════════ */}
                {showGatheringSection && form.announcement_type === 'gathering' && (
                  <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <h4 className="font-bold text-zinc-900 dark:text-white">Pengaturan Gathering</h4>
                    </div>

                    {/* Voting Toggle */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-5 h-5 text-amber-600" />
                          <div>
                            <p className="font-bold text-sm text-zinc-900 dark:text-white">Aktifkan Voting Ketua Panitia</p>
                            <p className="text-[10px] text-zinc-400">Tambahkan kandidat dan aktifkan pemilihan</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGatheringConfig({ ...gatheringConfig, voting_enabled: !gatheringConfig.voting_enabled })}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            gatheringConfig.voting_enabled ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            gatheringConfig.voting_enabled ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </label>
                    </div>

                    {/* Voting Deadline */}
                    {gatheringConfig.voting_enabled && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 mb-1">Batas Waktu Voting</label>
                          <input
                            type="date"
                            value={gatheringConfig.voting_deadline || ''}
                            onChange={(e) => setGatheringConfig({ ...gatheringConfig, voting_deadline: e.target.value })}
                            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* Candidates */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Kandidat Ketua Panitia</label>
                            <button
                              type="button"
                              onClick={addCandidate}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-900/40 transition-colors"
                            >
                              <UserPlus className="w-3.5 h-3.5" /> Tambah
                            </button>
                          </div>

                          {candidates.length === 0 && (
                            <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                              <Users className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                              <p className="text-xs text-zinc-400">Belum ada kandidat. Klik "Tambah" untuk menambahkan.</p>
                            </div>
                          )}

                          {candidates.map((candidate, idx) => (
                            <div key={idx} className="flex gap-3 items-start p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                              {/* Photo upload */}
                              <div className="shrink-0">
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`candidate-photo-${idx}`}
                                  className="hidden"
                                  onChange={(e) => e.target.files?.[0] && handleCandidatePhotoUpload(idx, e.target.files[0])}
                                />
                                <label
                                  htmlFor={`candidate-photo-${idx}`}
                                  className="block w-16 h-16 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 cursor-pointer hover:border-amber-400 transition-colors overflow-hidden bg-white dark:bg-zinc-900"
                                >
                                  {uploadingCandidate === `candidate-${idx}` ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                                    </div>
                                  ) : candidate.photo_url ? (
                                    <img src={candidate.photo_url} alt={candidate.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                                      <Upload className="w-4 h-4" />
                                      <span className="text-[8px] font-bold mt-0.5">Foto</span>
                                    </div>
                                  )}
                                </label>
                              </div>

                              {/* Name input */}
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={candidate.name}
                                  onChange={(e) => updateCandidate(idx, 'name', e.target.value)}
                                  className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  placeholder={`Nama Kandidat ${idx + 1}`}
                                />
                                <p className="text-[10px] text-zinc-400 mt-1">Kandidat #{idx + 1}</p>
                              </div>

                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() => removeCandidate(idx)}
                                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Surveys */}
                    <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-purple-500" />
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Survei Terkait</label>
                        </div>
                        <button
                          type="button"
                          onClick={addSurvey}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-bold hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Survei
                        </button>
                      </div>

                      {gatheringConfig.surveys.length === 0 && (
                        <p className="text-xs text-zinc-400 text-center py-3">Belum ada survei. Klik "Tambah Survei" jika diperlukan.</p>
                      )}

                      {gatheringConfig.surveys.map((survey) => (
                        <div key={survey.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={survey.title}
                              onChange={(e) => updateSurvey(survey.id, 'title', e.target.value)}
                              className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Judul survei"
                            />
                            <button type="button" onClick={() => removeSurvey(survey.id)} className="p-1.5 text-zinc-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={survey.description || ''}
                            onChange={(e) => updateSurvey(survey.id, 'description', e.target.value)}
                            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Deskripsi singkat (opsional)"
                          />
                          <select
                            value={survey.form_id || ''}
                            onChange={(e) => updateSurvey(survey.id, 'form_id', e.target.value)}
                            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Pilih formulir internal...</option>
                            {dynamicForms.map(f => (
                              <option key={f.id} value={f.id}>{f.title}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Target NIKs */}
                    <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Target NIK (Voting & Survei)</label>
                        </div>
                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-200 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" /> Upload CSV
                          <input type="file" accept=".csv,.txt" className="hidden" onChange={handleNikCsvUpload} />
                        </label>
                      </div>
                      <textarea
                        value={targetNiks}
                        onChange={(e) => setTargetNiks(e.target.value)}
                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 text-xs h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="Masukkan NIK dipisahkan koma atau enter. Contoh: 12345, 67890, ..."
                      />
                      {targetNiks.trim() && (
                        <p className="text-[10px] text-blue-600 font-bold">
                          {targetNiks.split(/[,\n;]/).filter(n => n.trim().length >= 3).length} NIK terdeteksi
                        </p>
                      )}
                      <p className="text-[10px] text-zinc-400">
                        Hanya NIK yang terdaftar yang bisa ikut voting dan mengakses survei. Kosongkan jika semua anggota boleh akses.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingId ? 'Perbarui' : 'Publikasikan'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vote Results Modal */}
        <AnimatePresence>
          {showVoteResults && voteResultsAnnouncement && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => { setShowVoteResults(false); setVoteResultsAnnouncement(null); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white">Hasil Voting</h3>
                      <p className="text-xs text-zinc-500 truncate max-w-[250px]">{voteResultsAnnouncement.title}</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowVoteResults(false); setVoteResultsAnnouncement(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                  {voteResultsLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    </div>
                  ) : voteResultsCandidates.length === 0 ? (
                    <div className="text-center py-10 text-zinc-400">
                      <p className="font-bold">Belum ada kandidat</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const totalVotes = voteResultsCandidates.reduce((sum, c) => sum + c.count, 0);
                        return (
                          <>
                            <div className="text-center mb-4">
                              <p className="text-3xl font-black text-zinc-900 dark:text-white">{totalVotes}</p>
                              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Suara</p>
                            </div>
                            {voteResultsCandidates.map((candidate, idx) => {
                              const percentage = totalVotes > 0 ? (candidate.count / totalVotes) * 100 : 0;
                              const isWinner = totalVotes > 0 && candidate.count === Math.max(...voteResultsCandidates.map(c => c.count));
                              return (
                                <div
                                  key={candidate.id}
                                  className={`p-4 rounded-2xl border-2 transition-all ${
                                    isWinner
                                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10'
                                      : 'border-zinc-100 dark:border-zinc-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    {candidate.photo_url ? (
                                      <img src={candidate.photo_url} alt={candidate.name} className="w-12 h-12 rounded-xl object-cover" />
                                    ) : (
                                      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                                        {candidate.name.charAt(0)}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold text-zinc-900 dark:text-white truncate">{candidate.name}</p>
                                        {isWinner && (
                                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-full">
                                            <CheckCheck className="w-3 h-3" /> PEMENANG
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-zinc-500">Kandidat #{idx + 1}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-2xl font-black text-zinc-900 dark:text-white">{candidate.count}</p>
                                      <p className="text-[10px] text-zinc-500 font-bold">{percentage.toFixed(1)}%</p>
                                    </div>
                                  </div>
                                  <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${percentage}%` }}
                                      transition={{ duration: 1, ease: 'easeOut' }}
                                      className={`h-full rounded-full ${
                                        isWinner
                                          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                          : 'bg-zinc-300 dark:bg-zinc-600'
                                      }`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p className="text-zinc-400 animate-pulse">Memuat pengumuman...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Megaphone className="w-16 h-16 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500 font-bold text-lg">Belum ada pengumuman</p>
            <p className="text-zinc-400 text-sm mt-1">Mulai buat pengumuman pertama Anda</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border transition-all overflow-hidden shadow-sm hover:shadow-md ${
                  announcement.is_pinned
                    ? 'border-l-4 border-l-amber-500 border-zinc-200 dark:border-zinc-700'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {announcement.image_url && (
                  <div className="w-full h-48 overflow-hidden border-b border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
                    <img src={announcement.image_url} alt={announcement.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {announcement.is_pinned && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-full uppercase tracking-tighter">
                            <Pin className="w-2.5 h-2.5" /> PENTING
                          </span>
                        )}
                        {announcement.announcement_type === 'gathering' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-black rounded-full uppercase tracking-tighter">
                            <Users className="w-2.5 h-2.5" /> GATHERING
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          {format(new Date(announcement.created_at), 'dd MMM yyyy')}
                        </span>
                      </div>
                      <h3 className="font-bold text-zinc-900 dark:text-white leading-tight text-lg mb-2">{announcement.title}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-3 leading-relaxed">{announcement.content.replace(/<[^>]*>/g, '')}</p>
                      <div className="flex items-center gap-2 mt-4 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          {announcement.profiles?.name?.charAt(0) || 'A'}
                        </div>
                        {announcement.profiles?.name || 'Admin'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {announcement.announcement_type === 'gathering' && announcement.gathering_config?.voting_enabled && (
                        <button
                          onClick={() => handleViewVoteResults(announcement)}
                          className="p-2.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-500 hover:text-amber-600 rounded-xl transition-all border border-amber-200 dark:border-amber-800"
                          title="Lihat Hasil Voting"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(announcement)}
                        className="p-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all border border-zinc-100 dark:border-zinc-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="p-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 rounded-xl transition-all border border-zinc-100 dark:border-zinc-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}