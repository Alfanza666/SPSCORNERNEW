import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Megaphone, Calendar, Clock, ChevronRight, X, Pin, FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import SPSLogo from '../../components/SPSLogo';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchAnnouncements();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = announcements.filter(a => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAnnouncements(filtered);
    } else {
      setFilteredAnnouncements(announcements);
    }
  }, [searchQuery, announcements]);

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
      setFilteredAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg overflow-hidden">
            <SPSLogo variant="icon" className="w-7 h-7 md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              Pengumuman Serikat
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">SPS</span>
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400">Informasi terbaru untuk anggota SP</p>
          </div>
        </div>
        <div className="hidden md:block">
          <SPSLogo variant="stack" className="h-10" />
        </div>
      </div>

      {/* Search & Info */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari pengumuman..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 md:py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800/50">
          <Pin className="w-4 h-4 text-blue-500" />
          <p className="text-xs md:text-sm text-blue-700 dark:text-blue-300 font-medium">Pengumuman PENTING harus dibaca</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 md:py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 md:w-12 md:h-12 border-4 border-blue-500 border-t-transparent rounded-full"
          />
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12 md:py-20 bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl shadow-lg"
        >
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4 md:mb-6">
            <Megaphone className="w-10 h-10 md:w-12 md:h-12 text-zinc-400" />
          </div>
          <p className="text-zinc-500 font-bold text-lg md:text-xl mb-2">
            {searchQuery ? 'Pengumuman tidak ditemukan' : 'Belum Ada Pengumuman'}
          </p>
          <p className="text-xs md:text-sm text-zinc-400">
            {searchQuery ? 'Coba kata kunci lain' : 'Pengumuman dari manajemen akan muncul di sini'}
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:gap-6">
          {filteredAnnouncements.map((announcement, idx) => (
            <motion.button
              key={announcement.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedAnnouncement(announcement)}
              className={`bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl p-5 md:p-6 text-left border shadow-md md:shadow-lg transition-all cursor-pointer group ${
                announcement.is_pinned 
                  ? 'border-l-4 border-l-amber-500 border-t-amber-200 border-r-amber-200 dark:border-amber-800' 
                  : 'border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800'
              }`}
            >
              <div className="flex items-start gap-4 md:gap-5">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${
                  announcement.is_pinned 
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                }`}>
                  <Megaphone className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  {announcement.is_pinned && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-800/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg md:rounded-xl mb-2 md:mb-3">
                      <Pin className="w-3 h-3" /> PENTING
                    </span>
                  )}
                  <h3 className="font-bold text-base md:text-lg text-zinc-900 dark:text-white leading-tight mb-2">{announcement.title}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-3">{announcement.content}</p>
                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(announcement.created_at), 'dd MMM yyyy')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(announcement.created_at), 'HH:mm')}
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      {announcement.profiles?.name || 'Admin SP'}
                    </span>
                  </div>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors shrink-0">
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-zinc-400 group-hover:text-amber-600 transition-colors" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
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
              className="bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 p-4 md:p-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center ${
                    selectedAnnouncement.is_pinned 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  }`}>
                    <Megaphone className="w-6 h-6 md:w-7 md:h-7 text-white" />
                  </div>
                  {selectedAnnouncement.is_pinned && (
                    <span className="px-3 md:px-4 py-1.5 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-800/30 text-amber-700 dark:text-amber-400 text-sm font-bold rounded-xl">
                      PENTING
                    </span>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-2 md:p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6 text-zinc-500" />
                </motion.button>
              </div>
              
              <div className="p-5 md:p-8 space-y-5 md:space-y-6 overflow-y-auto">
                <div>
                  <h2 className="font-black text-xl md:text-2xl text-zinc-900 dark:text-white mb-3 md:mb-4">{selectedAnnouncement.title}</h2>
                  <div className="flex items-center gap-4 md:gap-6 text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                      {format(new Date(selectedAnnouncement.created_at), 'dd MMMM yyyy')}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 md:w-5 md:h-5" />
                      {format(new Date(selectedAnnouncement.created_at), 'HH:mm')}
                    </span>
                  </div>
                </div>
                
                <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                
                <div className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {selectedAnnouncement.content}
                </div>
                
                <div className="pt-4 md:pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3 md:gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg md:text-xl">{selectedAnnouncement.profiles?.name?.charAt(0) || 'A'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Diposting oleh</p>
                    <p className="font-bold text-base md:text-lg text-zinc-900 dark:text-white">{selectedAnnouncement.profiles?.name || 'Admin SP'}</p>
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