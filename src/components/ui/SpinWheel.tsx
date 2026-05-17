import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Gift, Volume2, VolumeX, RefreshCw, Loader2, Crown } from 'lucide-react';
import toast from 'react-hot-toast';

interface SpinWheelProps {
  participants: Array<{ id: string; name: string; nik: string; couponCode: string }>;
  onWinnerSelected: (winner: any) => void;
  isSpinning: boolean;
  setIsSpinning: (v: boolean) => void;
}

export default function SpinWheel({ participants, onWinnerSelected, isSpinning, setIsSpinning }: SpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [winner, setWinner] = useState<any>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    drawWheel();
  }, [participants]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas || participants.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
    ];

    const sliceAngle = (2 * Math.PI) / participants.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw slices
    participants.forEach((p, i) => {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      const text = p.name.length > 12 ? p.name.substring(0, 12) + '...' : p.name;
      ctx.fillText(text, radius - 30, 5);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw center text
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', centerX, centerY - 8);
    ctx.font = '10px Arial';
    ctx.fillText('DOORPRIZE', centerX, centerY + 8);

    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius - 10);
    ctx.lineTo(centerX - 15, centerY - radius - 35);
    ctx.lineTo(centerX + 15, centerY - radius - 35);
    ctx.closePath();
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.stroke();
  };

  const spin = () => {
    if (participants.length === 0) {
      toast.error('Tidak ada peserta');
      return;
    }

    if (isSpinning) return;

    setIsSpinning(true);
    setShowResult(false);

    const randomIndex = Math.floor(Math.random() * participants.length);
    const sliceAngle = 360 / participants.length;
    
    // Calculate target rotation (multiple spins + land on winner)
    const spins = 5;
    const baseRotation = spins * 360;
    const targetAngle = baseRotation + (360 - (randomIndex * sliceAngle) - (sliceAngle / 2));
    
    const startRotation = rotation;
    const totalRotation = targetAngle + startRotation;
    
    const duration = 5000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const currentRotation = startRotation + (totalRotation - startRotation) * eased;
      setRotation(currentRotation);

      // Play tick sound
      if (soundEnabled && progress < 0.95) {
        const tickAngle = (currentRotation % 360);
        const currentIndex = Math.floor(tickAngle / sliceAngle);
        if (currentIndex !== Math.floor(((currentRotation - 5) % 360) / sliceAngle)) {
          playTick();
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        const winningParticipant = participants[randomIndex];
        setWinner(winningParticipant);
        setShowResult(true);
        onWinnerSelected(winningParticipant);
      }
    };

    requestAnimationFrame(animate);
  };

  const playTick = () => {
    // Simple click sound using Web Audio API
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      // Ignore audio errors
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <motion.div
          animate={{ rotate: rotation }}
          transition={{ duration: 0 }}
          className="relative"
        >
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="rounded-full shadow-2xl"
          />
        </motion.div>
        
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
          <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] border-t-red-500 drop-shadow-lg" />
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <button
          onClick={spin}
          disabled={isSpinning || participants.length === 0}
          className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-zinc-400 disabled:to-zinc-500 text-white font-black text-lg rounded-full shadow-lg shadow-red-500/30 flex items-center gap-2"
        >
          {isSpinning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Mengundi...
            </>
          ) : (
            <>
              <Gift className="w-5 h-5" />
              PUTAR
            </>
          )}
        </button>
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && winner && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-24 h-24 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
              >
                <Crown className="w-12 h-12 text-white" />
              </motion.div>
              
              <h2 className="text-3xl font-black text-amber-500 mb-2">SELAMAT!</h2>
              <p className="text-lg font-bold text-zinc-600 dark:text-zinc-400 mb-4">Pemenang Doorprize</p>
              
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-6 mb-6 border border-amber-200 dark:border-amber-800">
                <p className="text-2xl font-black text-zinc-900 dark:text-white mb-2">{winner.name}</p>
                <p className="text-sm font-mono text-zinc-500">NIK: {winner.nik}</p>
                <p className="text-xs font-mono text-blue-600 mt-2">Kupon: {winner.couponCode}</p>
              </div>
              
              <button
                onClick={() => setShowResult(false)}
                className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-full"
              >
                Tutup
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnimatePresence(props: any) {
  const { children } = props;
  return <>{children}</>;
}