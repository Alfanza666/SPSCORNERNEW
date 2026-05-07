import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Megaphone, Calendar, Clock, ChevronRight, X } from 'lucide-react';
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

export default function PortalPengumuman() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    fetchAnnouncements();
  }, [user]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles(name)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="min-h-screen bg-[#e8ebf2] dark:bg-zinc-950">
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-zinc-400">Memuat...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-xl">
            <Megaphone className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Belum ada pengumuman</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div
              key={announcement.id}
              onClick={() => setSelectedAnnouncement(announcement)}
              className={`bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:shadow-md transition-all ${
                announcement.is_pinned ? 'border-l-4 border-l-amber-500' : ''
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
                  <p className="text-sm text-zinc-500 line-clamp-2 mt-1">{announcement.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(announcement.created_at), 'dd MMM yyyy HH:mm')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Megaphone className="w-3 h-3" />
                      {announcement.profiles?.name || 'Admin'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedAnnouncement && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 p-4 flex items-center justify-between">
              <h2 className="font-black text-lg">{selectedAnnouncement.title}</h2>
              <button 
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {selectedAnnouncement.is_pinned && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">PENTING</span>
                  <span className="text-xs text-amber-700 dark:text-amber-400">Pengumuman wajib dibaca</span>
                </div>
              )}
              <div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </div>
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-400">
                Diposting oleh {selectedAnnouncement.profiles?.name || 'Admin'} • {format(new Date(selectedAnnouncement.created_at), 'dd MMMM yyyy pukul HH:mm')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}