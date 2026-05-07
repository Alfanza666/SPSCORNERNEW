import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Megaphone, Plus, X, Pin, Trash2, Loader2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Announcement {
  id: string;
  title: string;
  content: string;
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
  const [form, setForm] = useState({ title: '', content: '', is_pinned: false });
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      toast.error('Mohon lengkapi semua kolom');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update({ title: form.title, content: form.content, is_pinned: form.is_pinned })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Pengumuman diperbarui');
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({ title: form.title, content: form.content, is_pinned: form.is_pinned, created_by: user?.id });
        if (error) throw error;
        toast.success('Pengumuman dipublikasikan');
      }

      setForm({ title: '', content: '', is_pinned: false });
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
    setForm({ title: announcement.title, content: announcement.content, is_pinned: announcement.is_pinned });
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
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', content: '', is_pinned: false }); }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Buat
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 mb-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">{editingId ? 'Edit' : 'Buat'} Pengumuman</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-bold">Tandai PENTING</span>
              </label>
              <button
                type="submit"
                disabled={saving}
                className="btn-clay-primary w-full"
              >
                {saving ? <Loader2 className="w-4 h-4 inline animate-spin" /> : 'Simpan'}
              </button>
            </form>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-8 text-zinc-400">Memuat...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-xl">
            <Megaphone className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500">Belum ada pengumuman</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`bg-white dark:bg-zinc-900 rounded-xl p-4 border ${
                  announcement.is_pinned ? 'border-l-4 border-l-amber-500 border-zinc-200 dark:border-zinc-700' : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {announcement.is_pinned && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                          PENTING
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">{announcement.title}</h3>
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-3">{announcement.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                      <span>{format(new Date(announcement.created_at), 'dd MMM yyyy HH:mm')}</span>
                      <span>{announcement.profiles?.name || 'Admin'}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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