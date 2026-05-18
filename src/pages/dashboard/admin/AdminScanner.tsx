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

  // Modal States
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{ name: string; nik: string; gate: string; message: string } | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

    // STOP Scanner immediately to prevent double scan
    if (html5QrCodeRef.current && scanning) {
      try {
        await html5QrCodeRef.current.stop();
        setScanning(false);
      } catch (e) { console.error("Stop scanner failed", e); }
    }

    // Process the scan
    setTimeout(async () => {
      const result = await processScan(decodedText);
      setIsProcessing(false);

      if (result?.success) {
        // Show Success Modal
        setSuccessData({
          name: result.name,
          nik: result.nik,
          gate: result.gate,
          message: result.message
        });
        setShowSuccessModal(true);
      } else {
        // Show Error Modal
        setErrorMessage(result?.error || 'Kupon tidak valid');
        setShowErrorModal(true);
      }

      // Reset cooldown after interaction (via modal buttons)
    }, 500);
  };

  const onScanFailure = (error: any) => {
    // Silent fail for continuous scanning
  };

const processScan = async (code: string) => {
    try {
      // Call RPC function
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
        <div className="flex-1 relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-[0_0_40px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(255,255,255,0.05)] mb-4">
          
          {/* Instruction Text */}
          <div className="absolute top-4 left-0 right-0 text-center z-10 pointer-events-none">
            <span className="bg-black/50 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-xs font-bold border border-white/10 shadow-lg">
              {scanning ? 'Arahkan QR Code ke area ini' : 'Aktifkan kamera untuk memulai'}
            </span>
          </div>

          {/* Camera View */}
          {!scanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-zinc-900">
              <div className="w-32 h-32 rounded-3xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700 shadow-inner">
                <Camera className="w-16 h-16 text-zinc-500" />
              </div>
              <p className="text-zinc-400 font-medium">Kamera belum aktif</p>
              <button 
                onClick={startScanner}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
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

        {/* === SUCCESS MODAL === */}
        <AnimatePresence>
          {showSuccessModal && successData && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900 w-full max-w-sm rounded-3xl p-8 border border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.2)] text-center"
              >
                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                
                <h2 className="text-2xl font-black text-white mb-2">Validasi Berhasil!</h2>
                
                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-6 text-left border border-zinc-700/50">
                  <div className="mb-2">
                    <p className="text-xs text-zinc-500 font-bold uppercase">Nama Karyawan</p>
                    <p className="text-lg font-black text-white">{successData.name}</p>
                  </div>
                  <div className="mb-2">
                    <p className="text-xs text-zinc-500 font-bold uppercase">NIK</p>
                    <p className="text-sm font-mono text-zinc-300">{successData.nik}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-bold uppercase">Jenis Kupon</p>
                    <span className="inline-block mt-1 px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/30">
                      {successData.gate.toUpperCase()}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    setCooldown(false);
                    setLastScannedCode(null);
                    startScanner(); // Resume scanner
                  }}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" /> Scan Selanjutnya
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === ERROR MODAL === */}
        <AnimatePresence>
          {showErrorModal && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900 w-full max-w-sm rounded-3xl p-8 border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] text-center"
              >
                <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                  <XCircle className="w-12 h-12 text-red-500" />
                </div>
                
                <h2 className="text-2xl font-black text-white mb-2">Gagal Memindai</h2>
                <p className="text-zinc-400 mb-8">{errorMessage}</p>

                <button 
                  onClick={() => {
                    setShowErrorModal(false);
                    setCooldown(false);
                    setLastScannedCode(null);
                    startScanner(); // Resume scanner
                  }}
                  className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl border border-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" /> Coba Lagi
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}