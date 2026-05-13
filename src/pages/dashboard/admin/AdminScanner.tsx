import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';
import { QrCode, ShieldCheck, UserCheck, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function AdminScanner() {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader", 
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanError);

    async function onScanSuccess(decodedText: string) {
      if (isProcessing) return;
      setIsProcessing(true);
      
      try {
        // 1. Cek apakah ini Kode Program (Kurban/Gathering) atau Aset
        // Kita asumsikan format kode: PROG-XXXX atau ASSET-XXXX
        
        // Logika Validasi Kurban / Program
        const { data: registration, error } = await supabase
          .from('program_registrations')
          .select('*, union_programs(name), profiles(name, nik)')
          .eq('kupon_code', decodedText)
          .single();

        if (error || !registration) {
          toast.error("Kode QR Tidak Valid!");
          return;
        }

        if (registration.status === 'diambil') {
          setScanResult({ error: "SUDAH PERNAH DIAMBIL", data: registration });
          toast.error("Tanda terima ini sudah pernah digunakan!");
        } else {
          // Update Status Menjadi Diambil (Tanda Terima Sah)
          const { error: updateError } = await supabase
            .from('program_registrations')
            .update({ 
              status: 'diambil',
              redeemed_at: new Date().toISOString() 
            })
            .eq('id', registration.id);

          if (updateError) throw updateError;
          
          setScanResult({ success: true, data: registration });
          toast.success("Verifikasi Berhasil! Silakan berikan hak karyawan.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Terjadi kesalahan sistem.");
      } finally {
        setIsProcessing(false);
      }
    }

    function onScanError(err: any) {
      // Abaikan error scanning rutin (tidak ketemu QR)
    }

    return () => scanner.clear();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 bg-zinc-800 rounded-full">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-black text-xl">SPS Admin Scanner</h1>
          <p className="text-xs text-zinc-500">Scan QR Tanda Terima Karyawan</p>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 mb-6">
        <div id="reader" className="w-full"></div>
      </div>

      {/* Result Display */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-3 p-6 bg-blue-600/20 rounded-2xl border border-blue-600/30">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500"/>
          <p className="font-bold">Memverifikasi Database...</p>
        </div>
      )}

      {scanResult && (
        <div className={`p-6 rounded-3xl border-2 animate-in fade-in zoom-in duration-300 ${
          scanResult.success ? 'bg-emerald-600/10 border-emerald-500/50' : 'bg-red-600/10 border-red-500/50'
        }`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-2xl ${scanResult.success ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {scanResult.success ? <UserCheck className="w-6 h-6 text-white"/> : <AlertCircle className="w-6 h-6 text-white"/>}
            </div>
            <div>
              <h2 className="font-black text-lg leading-tight">
                {scanResult.success ? "VERIFIKASI SUKSES" : scanResult.error}
              </h2>
              <p className="text-xs opacity-70">Program: {scanResult.data?.union_programs?.name}</p>
            </div>
          </div>

          <div className="space-y-2 bg-black/30 p-4 rounded-xl border border-white/5">
            <div className="flex justify-between">
              <span className="text-xs text-zinc-500 font-bold uppercase">Nama Karyawan</span>
              <span className="text-sm font-black">{scanResult.data?.profiles?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-500 font-bold uppercase">NIK</span>
              <span className="text-sm font-mono">{scanResult.data?.profiles?.nik}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-500 font-bold uppercase">Kode Kupon</span>
              <span className="text-sm font-mono text-amber-500">{scanResult.data?.kupon_code}</span>
            </div>
          </div>

          <button 
            onClick={() => setScanResult(null)}
            className="w-full mt-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-all"
          >
            Scan Selanjutnya
          </button>
        </div>
      )}

      {/* Info Box */}
      {!scanResult && !isProcessing && (
        <div className="p-6 bg-zinc-900 rounded-3xl border border-zinc-800 text-center">
          <QrCode className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 font-medium leading-relaxed">
            Arahkan kamera ke QR Code yang ada di <br/> 
            <span className="text-white">Portal SPS</span> milik Karyawan.
          </p>
        </div>
      )}
    </div>
  );
}
