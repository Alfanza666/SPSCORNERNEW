import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { 
  Camera, CameraOff, RotateCcw, CheckCircle2, XCircle, 
  Loader2, History, QrCode, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';

interface ScanLog {
  id: string;
  name: string;
  nik: string;
  status: string; // success, error
  message: string;
  timestamp: string;
}

// Helper to play beep sound
const playBeep = (type: 'success' | 'error') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio play error", e);
  }
};

export default function AdminScanner() {
  const { user } = useAuthStore();
  const [scanning, setScanning] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [scanHistory, setScanHistory] = useState<ScanLog[]>([]);
  const [sessionSuccessCount, setSessionSuccessCount] = useState<number>(0);
  
  // Lock state prevents multiple scans of the SAME or DIFFERENT codes while processing
  const [isLocked, setIsLocked] = useState(false);
  
  // Modals
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{ name: string; nik: string; gate: string; message: string } | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const html5QrCodeRef = useRef<any>(null);

  useEffect(() => {
    fetchTotalScans();
    return () => {
      stopScanner();
    };
  }, []);

  const fetchTotalScans = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('program_coupons')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'claimed')
        .gte('claimed_at', today.toISOString());
      
      if (count !== null) setSessionSuccessCount(count);
    } catch (e) { console.error(e); }
  };

  const startScanner = async () => {
    if (scanning) return;
    
    if (window.isSecureContext === false) {
      toast.error('Akses Kamera Ditolak: Fitur kamera memerlukan HTTPS.');
      return;
    }

    setScanning(true);
    setIsLocked(false);

    // Beri waktu bagi React untuk merender DOM (memunculkan div #qr-reader-scanner)
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (html5QrCodeRef.current) {
          try { await html5QrCodeRef.current.stop(); } catch (e) { }
      }

      // 1. Dapatkan izin secara paksa menggunakan standar web paling dasar tanpa filter
      // Ini memaksa Chrome memunculkan pop-up izin jika belum ada
      let stream;
      try {
        const constraints = cameraFacing === 'environment' 
          ? { video: { facingMode: 'environment' } } 
          : { video: true };
        
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (fallbackErr) {
          // Jika facingMode ditolak, coba panggil kamera apa saja tanpa batasan
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } catch (e: any) {
        throw new Error("Chrome menolak akses: " + e.message);
      }

      // 2. Ambil ID kamera yang berhasil dibuka oleh browser
      const videoTrack = stream.getVideoTracks()[0];
      const deviceId = videoTrack.getSettings().deviceId;

      // 3. Matikan stream sementara agar hardware dilepaskan
      stream.getTracks().forEach(track => track.stop());

      // 4. Beri jeda agar OS Android (terutama Chrome) benar-benar mereset hardware kamera
      await new Promise(resolve => setTimeout(resolve, 300));

      html5QrCodeRef.current = new Html5Qrcode("qr-reader-scanner");

      // 5. Mulai scanner menggunakan ID kamera yang pasti valid tersebut
      await html5QrCodeRef.current.start(
        deviceId || { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          disableFlip: false
        },
        onScanSuccess,
        onScanFailure
      );
    } catch (err: any) {
      console.error("Error starting scanner", err);
      let errorMsg = err.message || "Gagal mengakses kamera";
      
      if (errorMsg.toLowerCase().includes('permission denied') || 
          errorMsg.toLowerCase().includes('notallowederror') || 
          errorMsg.toLowerCase().includes('not allowed')) {
        errorMsg = "Akses kamera diblokir. Harap buka Pengaturan (Settings) > Aplikasi > Browser Anda (Chrome/Safari), lalu izinkan akses Kamera. Jika di browser, klik ikon gembok di URL bar lalu izinkan kamera.";
      } else {
        // Output detailed error for debugging
        errorMsg = `Gagal: ${err.name || 'UnknownError'} - ${err.message || String(err)}`;
      }
      
      toast.error(errorMsg, { duration: 8000 });
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && scanning) {
      try {
        await html5QrCodeRef.current.stop();
        setScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  const toggleCamera = async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    if (scanning) {
      await stopScanner();
      setTimeout(() => startScanner(), 500);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    // strict lock
    if (isLocked) return;
    setIsLocked(true);
    
    // Pause scanner if possible
    if (html5QrCodeRef.current) {
        try { html5QrCodeRef.current.pause(true); } catch(e) {}
    }

    // Process scan
    const result = await processScan(decodedText);
    
    if (result.success) {
      playBeep('success');
      setSuccessData({
        name: result.name,
        nik: result.nik,
        gate: result.gate,
        message: result.message
      });
      setSessionSuccessCount(prev => prev + 1);
      setShowSuccessModal(true);
      // navigator.vibrate is supported on Android
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
    } else {
      playBeep('error');
      setErrorMessage(result.error);
      setShowErrorModal(true);
      if (navigator.vibrate) navigator.vibrate([300]);
    }
  };

  const onScanFailure = (error: any) => {
    // Ignore continuous errors
  };

  const processScan = async (code: string) => {
    try {
      const { data, error } = await supabase.rpc('claim_program_coupon', {
        p_coupon_code: code,
        p_admin_id: user?.id
      });

      if (error) throw error;
      const result = data as any; 

      if (result && result.success) {
        const gate = result.gate || 'attendance';
        addToHistory({
          id: Math.random().toString(36).substr(2, 9),
          name: result.name,
          nik: result.nik,
          status: 'success',
          message: result.message || gate,
          timestamp: new Date().toISOString()
        });
        return { success: true, name: result.name, nik: result.nik, gate: gate, message: result.message };
      } else {
        addToHistory({
          id: Math.random().toString(36).substr(2, 9),
          name: 'Unknown',
          nik: code,
          status: 'error',
          message: result?.error || 'Kupon tidak valid',
          timestamp: new Date().toISOString()
        });
        return { success: false, error: result?.error || 'Kupon tidak valid' };
      }
    } catch (err: any) {
      console.error("Scan Error:", err);
      return { success: false, error: "Terjadi kesalahan sistem." };
    }
  };

  const addToHistory = (log: ScanLog) => {
    setScanHistory(prev => [log, ...prev].slice(0, 10)); // keep last 10
  };

  const handleResumeScan = () => {
    setShowSuccessModal(false);
    setShowErrorModal(false);
    
    // Add small delay before unlock
    setTimeout(() => {
        if (html5QrCodeRef.current && scanning) {
            try { html5QrCodeRef.current.resume(); } catch(e) {}
        }
        setIsLocked(false);
    }, 500);
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-8 text-center font-bold text-red-500">Akses Ditolak</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-900 dark:text-white relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col h-screen p-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 bg-zinc-50/80 dark:bg-zinc-900/80 p-4 rounded-3xl backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/50 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <QrCode className="w-6 h-6 text-zinc-900 dark:text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg">Pindai Kupon</h1>
              <p className="text-xs text-zinc-400">Scanner Pro</p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                {sessionSuccessCount}
             </div>
             <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Hari Ini</div>
          </div>
        </div>

        {/* Scanner Area */}
        <div className="flex-1 relative mb-4 rounded-3xl overflow-hidden bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 backdrop-blur-xl flex flex-col shadow-2xl">
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={toggleCamera}
              className="p-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-xl text-zinc-900 dark:text-white hover:bg-zinc-100 dark:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-zinc-100/50 dark:bg-black/40">
            {!scanning ? (
              <div className="text-center p-6">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-200 dark:border-zinc-700 shadow-xl">
                  <CameraOff className="w-8 h-8 text-zinc-400" />
                </div>
                <p className="text-zinc-400 font-medium mb-6">Kamera tidak aktif</p>
                <button
                  onClick={startScanner}
                  className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-zinc-900 dark:text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center mx-auto gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Nyalakan Kamera
                </button>
              </div>
            ) : (
              <div className="w-full h-full relative">
                {/* HTML5 QR Scanner injects video here */}
                <div id="qr-reader-scanner" className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" style={{ border: 'none' }}></div>
                
                {/* Custom Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-white/20 rounded-3xl relative overflow-hidden">
                        {/* Laser Line */}
                        <motion.div 
                           animate={{ y: [0, 256, 0] }}
                           transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                           className="w-full h-[2px] bg-blue-500 shadow-[0_0_15px_3px_rgba(59,130,246,0.5)] absolute top-0"
                        />
                        {/* Corner markers */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-3xl"></div>
                    </div>
                </div>

                {isLocked && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-zinc-900 dark:text-white animate-spin" />
                    </div>
                )}
              </div>
            )}
          </div>
          
          {scanning && (
            <div className="p-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800">
               <button
                  onClick={stopScanner}
                  className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <CameraOff className="w-5 h-5" />
                  Matikan Kamera
                </button>
            </div>
          )}
        </div>

        {/* History Bottom Sheet Area */}
        <div className="h-48 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-200 dark:border-zinc-800/50 p-5 overflow-hidden flex flex-col shadow-2xl">
          <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2 shrink-0">
            <History className="w-4 h-4" /> Riwayat Scan
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
            {scanHistory.length === 0 ? (
              <div className="text-center py-6 text-zinc-600 text-sm font-medium">Belum ada riwayat</div>
            ) : (
              scanHistory.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-200 dark:border-zinc-700/50">
                  <div className="flex items-center gap-3 min-w-0">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate">{log.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{log.nik} • {log.message}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0 ml-2">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && successData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2rem] w-full max-w-sm overflow-hidden shadow-[0_0_40px_rgba(34,197,94,0.1)] relative"
            >
              {/* Decorative top blur */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-green-500/20 blur-3xl rounded-full" />
              
              <div className="p-8 flex flex-col items-center text-center relative z-10">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Scan Berhasil!</h2>
                <p className="text-green-400 font-bold mb-6 text-sm bg-green-500/10 px-4 py-1.5 rounded-full uppercase tracking-wider">{successData.message}</p>
                
                <div className="w-full bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl p-4 mb-6 border border-zinc-800">
                  <p className="text-sm text-zinc-400 mb-1">Nama Peserta</p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">{successData.name}</p>
                  <div className="w-full h-[1px] bg-zinc-800 my-3" />
                  <p className="text-sm text-zinc-400 mb-1">NIK</p>
                  <p className="font-mono text-zinc-300 font-bold">{successData.nik}</p>
                </div>

                <button
                  onClick={handleResumeScan}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-zinc-900 dark:text-white font-black rounded-2xl transition-all active:scale-95 text-lg"
                >
                  Lanjut Scan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2rem] w-full max-w-sm overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.1)] relative"
            >
              {/* Decorative top blur */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500/20 blur-3xl rounded-full" />
              
              <div className="p-8 flex flex-col items-center text-center relative z-10">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                  <XCircle className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Scan Gagal</h2>
                
                <div className="w-full bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl p-5 mb-6 border border-zinc-800 flex items-start gap-3 text-left">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-200">{errorMessage}</p>
                </div>

                <button
                  onClick={handleResumeScan}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-zinc-900 dark:text-white font-black rounded-2xl transition-all active:scale-95 text-lg"
                >
                  Coba Lagi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
