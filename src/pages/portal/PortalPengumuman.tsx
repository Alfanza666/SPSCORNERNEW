import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Megaphone, Calendar, Clock, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

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
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md mx-auto p-4 pb-8 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-8 h-8 text-zinc-400" />
            </div>
            <p className="text-zinc-500 font-medium">Belum ada pengumuman</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <motion.button
              key={announcement.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedAnnouncement(announcement)}
              className={`w-full bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:shadow-lg hover:shadow-blue-500/10 transition-all text-left ${
                announcement.is_pinned ? 'border-l-4 border-l-amber-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {announcement.is_pinned && (
                      <span className="px-2.5 py-1 bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 text-xs font-bold rounded-full">
                        PENTING
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">{announcement.title}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1">{announcement.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(announcement.created_at), 'dd MMM yyyy, HH:mm')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Megaphone className="w-3.5 h-3.5" />
                      {announcement.profiles?.name || 'Admin'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedAnnouncement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 p-5 flex items-center justify-between">
                <h2 className="font-black text-lg text-zinc-900 dark:text-white pr-4">{selectedAnnouncement.title}</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </motion.button>
              </div>
              <div className="p-5 space-y-4">
                {selectedAnnouncement.is_pinned && (
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 rounded-xl">
                    <span className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold rounded-full">PENTING</span>
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Pengumuman wajib dibaca</span>
                  </div>
                )}
                <div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {selectedAnnouncement.content}
                </div>
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Diposting oleh {selectedAnnouncement.profiles?.name || 'Admin'} • {format(new Date(selectedAnnouncement.created_at), 'dd MMMM yyyy, HH:mm')}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}