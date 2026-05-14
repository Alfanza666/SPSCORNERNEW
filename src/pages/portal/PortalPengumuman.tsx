import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import SPSLogo from '../../components/SPSLogo';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Megaphone, Calendar, Clock, ChevronRight, X, Pin, FileText } from 'lucide-react';
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
    <div className="pb-8">
      <div className="max-w-md mx-auto px-4 pt-4 space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-5 shadow-xl shadow-blue-500/20"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Megaphone className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Pengumuman Serikat</h2>
              <p className="text-sm text-white/80">Informasi terbaru untuk anggota SP</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <Pin className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-white/90">Pengumuman yang ditandai PENTING harus segera dibaca</p>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"
            />
          </div>
        ) : announcements.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl shadow-lg"
          >
            <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-10 h-10 text-zinc-400" />
            </div>
            <p className="text-zinc-500 font-bold text-lg">Belum Ada Pengumuman</p>
            <p className="text-xs text-zinc-400 mt-2">Pengumuman dari manajemen akan muncul di sini</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {announcements.map((announcement, idx) => (
              <motion.button
                key={announcement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedAnnouncement(announcement)}
                className={`w-full bg-white dark:bg-zinc-900 rounded-3xl p-5 border shadow-lg cursor-pointer hover:shadow-xl transition-all text-left group ${
                  announcement.is_pinned 
                    ? 'border-l-4 border-l-amber-500 border-t-amber-200 border-r-amber-200 dark:border-amber-800' 
                    : 'border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {announcement.is_pinned && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-800/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl"
                      >
                        <Pin className="w-3 h-3" />
                        PENTING
                      </motion.div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        announcement.is_pinned 
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                      }`}>
                        <Megaphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white leading-tight">{announcement.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(announcement.created_at), 'dd MMM yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(announcement.created_at), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{announcement.content}</p>
                    <div className="flex items-center gap-2 mt-4 text-xs text-zinc-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Oleh: {announcement.profiles?.name || 'Admin SP'}</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors">
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-amber-600 transition-colors" />
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedAnnouncement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedAnnouncement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    selectedAnnouncement.is_pinned 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  }`}>
                    <Megaphone className="w-6 h-6 text-white" />
                  </div>
                  {selectedAnnouncement.is_pinned && (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-800/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl">
                      PENTING
                    </span>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </motion.button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="font-black text-xl text-zinc-900 dark:text-white mb-2">{selectedAnnouncement.title}</h2>
                  <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(selectedAnnouncement.created_at), 'dd MMMM yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(selectedAnnouncement.created_at), 'HH:mm')}
                    </span>
                  </div>
                </div>
                <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                <div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {selectedAnnouncement.content}
                </div>
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3 text-xs text-zinc-400">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{selectedAnnouncement.profiles?.name?.charAt(0) || 'A'}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">Diposting oleh</p>
                    <p className="text-zinc-900 dark:text-white font-bold">{selectedAnnouncement.profiles?.name || 'Admin SP'}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}