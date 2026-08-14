import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, X, Zap, ZapOff } from 'lucide-react';
import { useMomentsStore } from '../../store/useMomentsStore';
import { useAuthStore } from '../../store/useAuthStore';

export default function MomentsCamera() {
  const navigate = useNavigate();
  const { frames, selectedFrame, fetchFrames, setSelectedFrame } = useMomentsStore();
  const { user } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isFlash, setIsFlash] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setIsReady(true);
    } catch (err) {
      console.error('Camera error:', err);
    }
  }, [facingMode, stream]);

  // Initialize
  useEffect(() => {
    fetchFrames();
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Load frame image
  useEffect(() => {
    if (selectedFrame?.image_url) {
      const img = new Image();
      img.onload = () => {
        console.log('Frame image loaded:', selectedFrame.name);
        setFrameImage(img);
      };
      img.onerror = (err) => {
        console.error('Frame image load error:', err);
        setFrameImage(null);
      };
      img.src = selectedFrame.image_url;
    } else {
      setFrameImage(null);
    }
  }, [selectedFrame]);

  // Switch camera
  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isReady) {
      startCamera();
    }
  }, [facingMode]);

  // Capture photo
  const capturePhoto = () => {
    if (isCountingDown) return;

    setIsCountingDown(true);
    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          doCapture();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const doCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Flash
    setIsFlash(true);
    setTimeout(() => setIsFlash(false), 200);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get raw photo
    const rawPhoto = canvas.toDataURL('image/jpeg', 0.95);

    // Draw frame if selected
    if (frameImage) {
      console.log('Drawing frame on canvas:', frameImage.width, 'x', frameImage.height);
      ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
    } else {
      console.log('No frame selected or frame not loaded');
    }

    // Add watermark for guest users (burned into photo)
    if (!user) {
      const fontSize = Math.max(12, canvas.width * 0.02);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('Powered by SPS Corner', canvas.width / 2, canvas.height - fontSize);
    }

    // Get final photo
    const finalPhoto = canvas.toDataURL('image/jpeg', 0.95);

    console.log('Photo captured:', { hasFrame: !!selectedFrame, isGuest: !user });

    // Navigate to preview
    navigate('/moments/preview', {
      state: {
        rawPhoto,
        finalPhoto,
        frameId: selectedFrame?.id
      }
    });

    setIsCountingDown(false);
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Camera viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Frame overlay */}
        {selectedFrame && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img
              src={selectedFrame.image_url}
              alt={selectedFrame.name}
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20">
          <button
            onClick={() => navigate('/moments')}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer transition-colors hover:bg-black/60"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setFlashEnabled(!flashEnabled)}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer transition-colors hover:bg-black/60"
          >
            {flashEnabled ? (
              <Zap className="w-5 h-5 text-[#CA8A04]" />
            ) : (
              <ZapOff className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Countdown overlay */}
        <AnimatePresence>
          {isCountingDown && countdown > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              className="absolute inset-0 flex items-center justify-center z-30"
            >
              <div className="text-white text-[120px] font-bold font-sans drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                {countdown}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flash effect */}
        <AnimatePresence>
          {isFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-white z-40"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative bg-[#0C0A09] pt-4 pb-8 px-6">
        {/* Frame selector */}
        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 px-4">
            {/* No frame option */}
            <button
              onClick={() => setSelectedFrame(null)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                !selectedFrame
                  ? 'border-[#CA8A04] bg-[#CA8A04]/10'
                  : 'border-[#44403C] bg-[#1C1917]'
              }`}
            >
              <span className="text-xs text-[#A8A29E] font-sans">None</span>
            </button>

            {frames.map((frame) => (
              <button
                key={frame.id}
                onClick={() => setSelectedFrame(frame)}
                className={`flex-shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-200 ${
                  selectedFrame?.id === frame.id
                    ? 'border-[#CA8A04] ring-2 ring-[#CA8A04]/30'
                    : 'border-[#44403C]'
                }`}
              >
                <img
                  src={frame.image_url}
                  alt={frame.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Shutter and switch camera */}
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={switchCamera}
            className="w-12 h-12 rounded-full bg-[#1C1917] flex items-center justify-center cursor-pointer transition-colors hover:bg-[#44403C]"
          >
            <RefreshCw className="w-5 h-5 text-[#A8A29E]" />
          </button>

          <button
            onClick={capturePhoto}
            disabled={isCountingDown}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-16 h-16 rounded-full border-4 border-[#0C0A09]" />
          </button>

          <div className="w-12 h-12" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
