import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Megaphone, Plus, X, Pin, Trash2, Loader2, Edit, Upload, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  is_pinned: boolean;
  created_by: string;
  profiles?: { name: string };
  created_at: string;
}

export default function AdminAnnouncements() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', is_pinned: false, image_url: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      fetchAnnouncements();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      toast.error('Mohon lengkapi semua kolom');
      return;
    }

    setSaving(true);
    try {
      const announcementData = {
        title: form.title,
        content: form.content,
        is_pinned: form.is_pinned,
        image_url: form.image_url,
        created_by: user?.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Pengumuman diperbarui');
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert(announcementData);
        if (error) throw error;
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
                message: form.content.substring(0, 100) + (form.content.length > 100 ? '...' : ''),
                url: '/portal/pengumuman'
              })
            });
          }
        } catch (e) {
          console.error("Broadcast failed:", e);
        }
      }

      setForm({ title: '', content: '', is_pinned: false, image_url: '' });
      setShowForm(false);
      setEditingId(null);
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setForm({ 
      title: announcement.title, 
      content: announcement.content, 
      is_pinned: announcement.is_pinned,
      image_url: announcement.image_url || ''
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus pengumuman ini?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast.success('Pengumuman dihapus');
      fetchAnnouncements();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal menghapus');
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-4 text-center">Akses ditolak</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Pengumuman</h1>
            <p className="text-sm text-zinc-500">Buat dan kelola pengumuman</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', content: '', is_pinned: false, image_url: '' }); }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Buat
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 mb-4 border border-zinc-200 dark:border-zinc-700 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{editingId ? 'Edit' : 'Buat'} Pengumuman</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-zinc-50 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
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
                  className="input-clay w-full"
                  placeholder="Judul pengumuman"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">Konten</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="input-clay w-full h-32"
                  placeholder="Isi pengumuman..."
                  required
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
              <button
                type="submit"
                disabled={saving || uploading}
                className="btn-clay-primary w-full py-3"
              >
                {saving ? <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> : editingId ? 'Perbarui' : 'Publikasikan'}
              </button>
            </form>
          </div>
        )}

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
                      <div className="flex items-center gap-2 mb-2">
                        {announcement.is_pinned && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-full uppercase tracking-tighter">
                            <Pin className="w-2.5 h-2.5" /> PENTING
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          {format(new Date(announcement.created_at), 'dd MMM yyyy')}
                        </span>
                      </div>
                      <h3 className="font-bold text-zinc-900 dark:text-white leading-tight text-lg mb-2">{announcement.title}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-3 leading-relaxed">{announcement.content}</p>
                      <div className="flex items-center gap-2 mt-4 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          {announcement.profiles?.name?.charAt(0) || 'A'}
                        </div>
                        {announcement.profiles?.name || 'Admin'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
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