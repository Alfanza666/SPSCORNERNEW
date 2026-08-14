import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Download, Share2, ArrowLeft, X } from 'lucide-react';
import { useMomentsStore } from '../../store/useMomentsStore';
import { useAuthStore } from '../../store/useAuthStore';
import SPSLogo from '../../components/SPSLogo';

export default function MomentsGallery() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { photos, event, fetchPhotos, likePhoto } = useMomentsStore();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Require login
  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/moments/gallery' } });
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    await fetchPhotos(event?.id);
    setIsLoading(false);
  };

  // Download photo
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `sps-moments-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Share photo
  const handleShare = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `sps-moments-${Date.now()}.jpg`, { type: 'image/jpeg' });

      if (navigator.share) {
        await navigator.share({
          title: 'SPS Corner Moments',
          text: `${event?.name || 'Employee Gathering 2026'} - ${event?.subtitle || 'FORWARD AS ONE'}`,
          files: [file]
        });
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const selectedPhotoData = photos.find(p => p.id === selectedPhoto);

  return (
    <div className="min-h-screen bg-[#0C0A09]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0C0A09]/80 backdrop-blur-xl border-b border-[#1C1917]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/moments')}
            className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center cursor-pointer transition-colors hover:bg-[#44403C]"
          >
            <ArrowLeft className="w-5 h-5 text-[#A8A29E]" />
          </button>
          <div className="text-center">
            <h1 className="text-sm font-semibold text-white font-sans">Event Gallery</h1>
            <p className="text-xs text-[#78716C] font-sans">{event?.name || 'Employee Gathering 2026'}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-6 h-6 border-2 border-[#CA8A04] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#78716C] font-sans">Loading gallery...</span>
          </div>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <SPSLogo className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm text-[#78716C] font-sans">No photos yet</p>
            <button
              onClick={() => navigate('/moments/camera')}
              className="mt-4 px-6 py-2 bg-[#CA8A04] text-[#0C0A09] rounded-xl text-sm font-sans cursor-pointer"
            >
              Take the first photo
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2">
          <div className="columns-2 md:columns-3 lg:columns-4 gap-2">
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                className="mb-2 break-inside-avoid cursor-pointer group"
                onClick={() => setSelectedPhoto(photo.id)}
              >
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={photo.photo_final}
                    alt={`Moment ${index + 1}`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-white" />
                        <span className="text-xs text-white font-sans">{photo.likes}</span>
                      </div>
                      {photo.is_featured && (
                        <span className="text-[10px] text-[#CA8A04] bg-[#CA8A04]/20 px-2 py-0.5 rounded-full font-sans">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Photo detail modal */}
      <AnimatePresence>
        {selectedPhoto && selectedPhotoData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex flex-col"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => likePhoto(selectedPhotoData.id)}
                  className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center cursor-pointer"
                >
                  <Heart className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => handleDownload(selectedPhotoData.photo_final)}
                  className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center cursor-pointer"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => handleShare(selectedPhotoData.photo_final)}
                  className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center cursor-pointer"
                >
                  <Share2 className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Photo */}
            <div className="flex-1 flex items-center justify-center p-4">
              <img
                src={selectedPhotoData.photo_final}
                alt="Selected moment"
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Photo info */}
            <div className="px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-4 text-xs text-[#78716C] font-sans">
                <span>{selectedPhotoData.likes} likes</span>
                <span>•</span>
                <span>{new Date(selectedPhotoData.created_at).toLocaleDateString('id-ID')}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
