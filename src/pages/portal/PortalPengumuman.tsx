import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Megaphone, Calendar, Clock, ChevronRight, ChevronLeft, X, Pin, FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

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

export default function PortalPengumuman() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
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
          <button
            onClick={() => navigate('/portal')}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Pengumuman Serikat
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">Informasi terbaru untuk anggota SP</p>
          </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredAnnouncements.map((announcement, idx) => (
            <motion.button
              key={announcement.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedAnnouncement(announcement)}
              className={`flex flex-col bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl text-left border shadow-md md:shadow-lg transition-all cursor-pointer group overflow-hidden ${
                announcement.is_pinned 
                  ? 'border-l-4 border-l-amber-500 border-t-amber-200 border-r-amber-200 dark:border-amber-800' 
                  : 'border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800'
              }`}
            >
              {announcement.image_url && (
                <div className="w-full h-40 md:h-48 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img src={announcement.image_url} alt={announcement.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {announcement.is_pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-full">
                          PENTING
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {format(new Date(announcement.created_at), 'dd MMM yyyy')}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white leading-tight mb-2 line-clamp-2">{announcement.title}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-4">{announcement.content}</p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-50 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase">
                      {announcement.profiles?.name?.charAt(0) || 'A'}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[100px]">
                      {announcement.profiles?.name || 'Admin'}
                    </span>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors">
                    <ChevronRight className="w-3 h-3 text-zinc-400 group-hover:text-amber-600" />
                  </div>
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedAnnouncement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 md:p-6 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedAnnouncement.is_pinned 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  }`}>
                    <Megaphone className="w-5 h-5 text-white" />
                  </div>
                  {selectedAnnouncement.is_pinned && (
                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full">
                      PENTING
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-500" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {selectedAnnouncement.image_url && (
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800">
                    <img src={selectedAnnouncement.image_url} alt={selectedAnnouncement.title} className="w-full h-auto" />
                  </div>
                )}
                
                <div className="p-6 md:p-8 space-y-6">
                  <div>
                    <h2 className="font-black text-2xl text-zinc-900 dark:text-white mb-4 leading-tight">{selectedAnnouncement.title}</h2>
                    <div className="flex items-center gap-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(selectedAnnouncement.created_at), 'dd MMMM yyyy')}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {format(new Date(selectedAnnouncement.created_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                  
                  <div className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                    {selectedAnnouncement.content}
                  </div>
                  
                  <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-xl">{selectedAnnouncement.profiles?.name?.charAt(0) || 'A'}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-0.5">Dipublikasikan oleh</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{selectedAnnouncement.profiles?.name || 'Admin Serikat Pekerja'}</p>
                    </div>
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