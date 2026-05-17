import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { 
  Camera, CameraOff, RotateCcw, CheckCircle2, XCircle, 
  Loader2, History, QrCode, AlertTriangle, Flashlight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Html5QrcodeScannerState } from 'html5-qrcode';

interface ScanLog {
  id: string;
  name: string;
  nik: string;
  status: string; // success, error, duplicate
  message: string;
  timestamp: string;
}

export default function AdminScanner() {
  const { user } = useAuthStore();
  const [scanning, setScanning] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const scannerRef = useRef<any>(null);
  const html5QrCodeRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    if (scanning) return;
    setScanning(true);

    const { Html5Qrcode } = await import('html5-qrcode');
    
    // Unique ID for the scanner region
    const scannerId = "qr-reader-scanner";
    
    // Clean up previous instance if any
    if (html5QrCodeRef.current) {
        try {
            await html5QrCodeRef.current.stop();
        } catch (e) { /* ignore */ }
    }

    html5QrCodeRef.current = new Html5Qrcode(scannerId);

    try {
      await html5QrCodeRef.current.start(
        { facingMode: cameraFacing },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        onScanSuccess,
        onScanFailure
      );
    } catch (err: any) {
      console.error("Error starting scanner", err);
      toast.error("Gagal mengakses kamera: " + err.message);
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
      // Short delay to ensure camera resource is released
      setTimeout(() => startScanner(), 500);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (cooldown || isProcessing || decodedText === lastScannedCode) return;

    // Prevent spamming same code immediately
    setLastScannedCode(decodedText);
    setIsProcessing(true);
    setCooldown(true);

    // Add brief visual feedback delay
    setTimeout(async () => {
      await processScan(decodedText);
      setIsProcessing(false);
      
      // Reset cooldown after 2 seconds
      setTimeout(() => {
        setCooldown(false);
        setLastScannedCode(null);
      }, 2000);
    }, 500);
  };

  const onScanFailure = (error: any) => {
    // Silent fail for continuous scanning
  };

  const processScan = async (code: string) => {
    try {
      // Call RPC function (Assumes function 'claim_program_coupon' exists in DB)
      // If not available, we'll fall back to direct DB logic which we will comment out below
      const { data, error } = await supabase.rpc('claim_program_coupon', {
        p_coupon_code: code,
        p_admin_id: user?.id
      });

      if (error) throw error;

      const result = data as any; // Expected JSON from DB function

      if (result && result.success) {
        const gate = result.gate || 'attendance';
        let toastMsg = '';
        
        // Dynamic feedback based on gate type
        if (gate === 'attendance') {
            toastMsg = `Berhasil! ${result.name} (${result.nik}) telah Presensi.`;
            if (result.meal_coupon_id || result.doorprize_coupon_id) toastMsg += " & Kupon Lainnya diterbitkan!";
        } else if (gate === 'meal') {
            toastMsg = `Berhasil! ${result.name} (${result.nik}) mengambil Jatah Makan.`;
        } else if (gate === 'doorprize') {
            toastMsg = `Berhasil! ${result.name} (${result.nik}) mengambil Hadiah/Doorprize.`;
        } else {
            toastMsg = `Berhasil! ${result.name} (${result.nik}) klaim ${gate}.`;
        }

        toast.success(toastMsg, { icon: '🎉' });
        
        addToHistory({
          id: Math.random().toString(36).substr(2, 9),
          name: result.name,
          nik: result.nik,
          status: 'success',
          message: result.message || gate,
          timestamp: new Date().toISOString()
        });
      } else {
        addToHistory({
          id: Math.random().toString(36).substr(2, 9),
          name: 'Unknown',
          nik: code,
          status: 'error',
          message: result?.error || 'Kupon tidak valid',
          timestamp: new Date().toISOString()
        });
        toast.error(result?.error || "Kupon tidak valid");
      }

    } catch (err: any) {
      console.error("Scan Error:", err);
      
      // Clean error handling - no more legacy fallback
      addToHistory({
        id: Math.random().toString(36).substr(2, 9),
        name: '-',
        nik: code,
        status: 'error',
        message: 'Sistem Error / Kupon tidak valid',
        timestamp: new Date().toISOString()
      });
      
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    }
  };

  const addToHistory = (log: ScanLog) => {
    setScanHistory(prev => [log, ...prev].slice(0, 5));
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-8 text-center font-bold text-red-500">Akses Ditolak</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-hidden flex flex-col">
      {/* Background Blur & Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col h-screen p-4 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 bg-zinc-900/50 p-4 rounded-2xl backdrop-blur-md border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg">Pindai Kupon</h1>
              <p className="text-xs text-zinc-400">Mode Admin</p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-2xl font-black text-blue-400">
                {scanHistory.filter(h => h.status === 'success').length}
             </div>
             <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Sukses</div>
          </div>
        </div>

        {/* Scanner View */}
        <div className="flex-1 relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl mb-4">
          {/* Camera View */}
          {!scanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center animate-pulse">
                <Camera className="w-10 h-10 text-zinc-500" />
              </div>
              <p className="text-zinc-400 font-medium">Kamera belum aktif</p>
              <button 
                onClick={startScanner}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <Camera className="w-5 h-5" /> Nyalakan Kamera
              </button>
            </div>
          ) : (
            <div id="qr-reader-scanner" className="w-full h-full bg-black relative">
                {/* Overlay Effects via CSS or inline - Simulating full screen cover except box */}
                <div className="absolute inset-0 bg-black/60 pointer-events-none z-20" />
                
                {/* The scanner library creates an iframe/div, we need to ensure it's visible */}
            </div>
          )}

          {/* Scanning Frame Overlay */}
          {scanning && (
            <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
                <div className="w-64 h-64 relative">
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    
                    {/* Scan Line Animation (Optional) */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400/50 animate-[scan_2s_ease-in-out_infinite]" style={{ boxShadow: '0 0 10px #60a5fa' }} />
                </div>
            </div>
          )}

          {/* Top Controls */}
          {scanning && (
            <div className="absolute top-4 left-4 right-4 flex justify-between z-40">
              <button 
                onClick={stopScanner}
                className="p-3 bg-zinc-900/80 backdrop-blur text-white rounded-xl border border-zinc-700 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
              >
                <CameraOff className="w-6 h-6 text-red-400" />
              </button>
              <button 
                onClick={toggleCamera}
                className="p-3 bg-zinc-900/80 backdrop-blur text-white rounded-xl border border-zinc-700 hover:bg-zinc-800 transition-colors"
              >
                <RotateCcw className="w-6 h-6 text-blue-400" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Sheet / Status */}
        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3 text-zinc-400 text-xs font-bold uppercase tracking-widest">
            <History className="w-4 h-4" /> Riwayat Scan Terakhir
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
            {scanHistory.length === 0 ? (
                <div className="text-center py-4 text-zinc-500 text-sm">Belum ada scan</div>
            ) : (
                scanHistory.map((log) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={log.id} 
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                            log.status === 'success' 
                            ? 'bg-green-500/10 border-green-500/20' 
                            : 'bg-red-500/10 border-red-500/20'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            {log.status === 'success' ? 
                                <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
                                <XCircle className="w-5 h-5 text-red-500" />
                            }
                            <div>
                                <p className="font-bold text-sm text-white">{log.name}</p>
                                <p className="text-xs text-zinc-400">{log.nik}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-xs font-bold ${log.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                {log.status === 'success' ? 'OK' : 'GAGAL'}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                                {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                            </p>
                        </div>
                    </motion.div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}