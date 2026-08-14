import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Download, Share2, RotateCcw, Check } from 'lucide-react';
import { useMomentsStore } from '../../store/useMomentsStore';
import SPSLogo from '../../components/SPSLogo';

interface LocationState {
  rawPhoto: string;
  finalPhoto: string;
  frameId?: string;
}

export default function MomentsPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { savePhoto, event } = useMomentsStore();
  const state = location.state as LocationState;

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Redirect if no photo
  useEffect(() => {
    if (!state?.rawPhoto) {
      navigate('/moments/camera');
    }
  }, [state, navigate]);

  if (!state?.rawPhoto) return null;

  const { rawPhoto, finalPhoto, frameId } = state;

  // Save photo to server
  useEffect(() => {
    const save = async () => {
      setIsSaving(true);
      await savePhoto({
        event_id: event?.id,
        frame_id: frameId,
        photo_raw_base64: rawPhoto,
        photo_final_base64: finalPhoto,
        device_info: {
          userAgent: navigator.userAgent,
          screen: `${window.screen.width}x${window.screen.height}`
        }
      });
      setIsSaving(false);
      setIsSaved(true);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    };
    save();
  }, []);

  // Download photo
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = finalPhoto;
    link.download = `sps-moments-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  // Share photo
  const handleShare = async () => {
    try {
      // Convert base64 to blob
      const response = await fetch(finalPhoto);
      const blob = await response.blob();
      const file = new File([blob], `sps-moments-${Date.now()}.jpg`, { type: 'image/jpeg' });

      if (navigator.share) {
        await navigator.share({
          title: 'SPS Corner Moments',
          text: `${event?.name || 'Employee Gathering 2026'} - ${event?.subtitle || 'FORWARD AS ONE'}`,
          files: [file]
        });
      } else {
        // Fallback: download
        handleDownload();
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // Take another photo
  const handleRetake = () => {
    navigate('/moments/camera');
  };

  return (
    <div className="fixed inset-0 bg-[#0C0A09] flex flex-col">
      {/* Success toast */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: showSuccess ? 1 : 0, y: showSuccess ? 0 : -20 }}
        className="absolute top-4 left-4 right-4 z-50"
      >
        <div className="bg-[#16A34A]/90 backdrop-blur-sm text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg">
          <Check className="w-5 h-5" />
          <span className="text-sm font-sans">Your Moment Has Been Captured</span>
        </div>
      </motion.div>

      {/* Photo preview */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <motion.img
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          src={finalPhoto}
          alt="Captured moment"
          className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        />
      </div>

      {/* Bottom controls */}
      <div className="bg-[#0C0A09] pt-4 pb-8 px-6">
        {/* Action buttons */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRetake}
            className="flex items-center gap-2 px-6 py-3 bg-[#1C1917] text-[#A8A29E] rounded-xl cursor-pointer transition-colors hover:bg-[#44403C]"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-sans">Take Again</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-3 bg-[#CA8A04] text-[#0C0A09] rounded-xl cursor-pointer transition-all hover:bg-[#D4A017]"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-semibold font-sans">Download</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleShare}
            className="flex items-center gap-2 px-6 py-3 bg-[#1C1917] text-[#A8A29E] rounded-xl cursor-pointer transition-colors hover:bg-[#44403C]"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-sm font-sans">Share</span>
          </motion.button>
        </div>

        {/* Watermark for non-logged in users */}
        <div className="flex justify-center">
          <div className="flex items-center gap-1.5 opacity-60">
            <SPSLogo className="w-3.5 h-3.5" />
            <span className="text-[9px] text-[#78716C] tracking-wider font-sans">Powered by SPS Corner</span>
          </div>
        </div>
      </div>

      {/* Saving overlay */}
      {isSaving && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1C1917] rounded-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#CA8A04] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#A8A29E] font-sans">Saving your moment...</span>
          </div>
        </div>
      )}
    </div>
  );
}
