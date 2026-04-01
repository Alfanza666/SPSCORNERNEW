import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Upload, FileImage, ShieldCheck, AlertCircle, Info, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import toast from 'react-hot-toast';

export default function Validate() {
  const { items, getTotal, clearCart, reservations } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  const buyerName = user?.name || sessionStorage.getItem('buyerName') || 'Unknown';
  const totalAmount = getTotal();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar (JPG, PNG, dll).');
        return;
      }
      
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Gagal memproses gambar. Silakan coba lagi.');
    }
  };

  const retake = () => {
    setImageSrc(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateReceipt = async () => {
    if (!imageSrc) return;
    
    setIsValidating(true);
    setValidationResult(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key not configured");
      }

      const ai = new GoogleGenAI({ apiKey });
      const base64Data = imageSrc.split(',')[1];

      const prompt = `
        Analyze this transfer receipt image.
        I need to verify if this is a valid payment receipt for the exact amount of Rp ${totalAmount}.
        
        CRITICAL CHECKS:
        1. Is it a valid payment/transfer receipt? (Not a random image)
        2. Does the amount match EXACTLY ${totalAmount} or Rp ${totalAmount}? (e.g., if totalAmount is 15000, look for 15.000, 15,000, or 15000).
        3. Is the status "Berhasil", "Sukses", or "Successful"?
        4. Is the date of the transaction today or within the last 24 hours?
        
        You MUST respond in valid JSON format ONLY, with no markdown formatting or extra text.
        Structure:
        {
          "valid": boolean,
          "reason": "string. Jika valid, berikan pesan sukses singkat. Jika tidak valid, berikan alasan spesifik dalam Bahasa Indonesia (misal: 'Jumlah transfer tidak sesuai. Diharapkan Rp ${totalAmount}, tetapi yang tertera adalah Rp X', atau 'Gambar buram dan nominal tidak terbaca', atau 'Ini bukan bukti transfer yang sah')."
        }
      `;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
        }
      });

      const responseText = result.text;
      if (!responseText) {
        throw new Error("No response from AI");
      }

      const aiResult = JSON.parse(responseText);

      if (aiResult.valid) {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const createRes = await fetch('/api/transactions/create', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            buyer_name: buyerName,
            buyer_id: user?.id || null,
            total_amount: totalAmount,
            status: 'success',
            receipt_image: imageSrc,
            items: items
          })
        });

        let errorData;
        if (!createRes.ok) {
          try {
            errorData = await createRes.json();
          } catch (e) {
            throw new Error(`Server error: ${createRes.status} ${createRes.statusText}`);
          }
          throw new Error(errorData?.error || 'Failed to create transaction');
        }

        let txData;
        try {
          const data = await createRes.json();
          txData = data.transaction;
        } catch (e) {
          throw new Error('Invalid response from server when creating transaction');
        }

        for (const resId of reservations) {
          await supabase.rpc('confirm_stock_deduction', {
            p_reservation_id: resId
          });
        }

        setValidationResult({ valid: true, message: 'Pembayaran Berhasil Diverifikasi!' });
        
        setTimeout(() => {
          clearCart();
          sessionStorage.removeItem('buyerName');
          navigate('/kiosk/success', { state: { transactionId: txData.id } });
        }, 2000);

      } else {
        await supabase.from('failed_transactions').insert({
          buyer_name: buyerName,
          buyer_id: user?.id || null,
          attempted_amount: totalAmount,
          reason: aiResult.reason,
          receipt_image: imageSrc
        });

        setValidationResult({ valid: false, message: aiResult.reason });
      }

    } catch (error: any) {
      console.error('Validation error:', error);
      setValidationResult({ 
        valid: false, 
        message: error.message || 'Terjadi kesalahan saat memvalidasi gambar. Silakan coba lagi.' 
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
        className="text-center mb-6 sm:mb-8"
      >
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[8px] sm:text-[10px] font-bold mb-4 sm:mb-6 shadow-inner dark:shadow-none border border-blue-100/50 dark:border-blue-900/30 uppercase tracking-widest">
          <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4" />
          Verifikasi AI Otomatis
        </div>
        <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white mb-1.5 sm:mb-2 tracking-tighter">Konfirmasi Pembayaran</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed px-4 font-medium">
          Upload bukti transfer Anda untuk verifikasi instan oleh sistem kecerdasan buatan kami.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="lg:col-span-3">
          <div className="clay-card p-4 sm:p-6">
            <div className="relative bg-zinc-50 dark:bg-zinc-800/50 rounded-xl sm:rounded-2xl overflow-hidden aspect-[4/3] flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-700 group transition-all duration-500 hover:border-blue-200 dark:hover:border-blue-800 shadow-inner">
              {!imageSrc ? (
                <div className="text-center p-4 sm:p-6">
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 dark:bg-blue-900/30 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4 transition-all duration-500 group-hover:bg-blue-600 group-hover:text-white text-blue-700 dark:text-blue-400 shadow-sm"
                  >
                    <FileImage className="w-6 h-6 sm:w-8 sm:h-8 stroke-[1.5]" />
                  </motion.div>
                  <h3 className="text-base sm:text-xl font-black text-zinc-900 dark:text-white mb-1 tracking-tighter">Pilih File Bukti</h3>
                  <p className="text-[8px] sm:text-xs text-zinc-400 dark:text-zinc-500 mb-4 sm:mb-6 max-w-[200px] sm:max-w-[250px] mx-auto font-medium leading-relaxed">Format JPG, PNG atau Screenshot M-Banking</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-clay-primary flex items-center gap-1.5 sm:gap-2 mx-auto text-[10px] sm:text-xs px-3 py-1.5 sm:px-4 sm:py-2"
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                    Pilih Gambar
                  </button>
                </div>
              ) : (
                <div className="w-full h-full relative">
                  <img src={imageSrc} alt="Receipt" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
              )}

              <AnimatePresence>
                {isValidating && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-zinc-900/90 backdrop-blur-xl flex flex-col items-center justify-center text-white p-4 sm:p-6 text-center"
                  >
                    <div className="relative mb-4 sm:mb-6">
                      <div className="absolute inset-0 bg-blue-500/30 blur-xl sm:blur-2xl rounded-full animate-pulse" />
                      <Loader2 className="w-8 h-8 sm:w-12 sm:h-12 animate-spin text-blue-400 relative z-10" />
                    </div>
                    <h3 className="text-base sm:text-xl font-black tracking-widest mb-1.5 sm:mb-2 uppercase text-white drop-shadow-md">AI SCANNING</h3>
                    <div className="w-24 sm:w-32 h-1 sm:h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="w-full h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                      />
                    </div>
                    <p className="text-zinc-400 mt-4 sm:mt-6 text-[10px] sm:text-xs font-bold px-4 sm:px-6 leading-relaxed">Memverifikasi nominal dan keaslian struk pembayaran Anda...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {validationResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-start gap-2 sm:gap-3 border-2 ${
                    validationResult.valid 
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-100 dark:border-blue-800 shadow-inner' 
                      : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-100 dark:border-red-800 shadow-inner'
                  }`}
                >
                  <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0 shadow-md ${validationResult.valid ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm mb-0.5 tracking-tighter">
                      {validationResult.valid ? 'Validasi Berhasil' : 'Validasi Gagal'}
                    </h4>
                    <p className="text-[10px] sm:text-xs font-bold opacity-80 leading-relaxed">{validationResult.message}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
              {imageSrc && (
                <>
                  {validationResult?.valid === false ? (
                    <button 
                      onClick={retake} 
                      className="btn-clay-danger w-full h-10 sm:h-12 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                    >
                      <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                      Unggah Ulang Bukti
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={retake} 
                        disabled={isValidating || validationResult?.valid}
                        className="btn-clay-secondary flex-1 h-10 sm:h-12 flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs"
                      >
                        <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                        Ganti Gambar
                      </button>
                      <button 
                        onClick={validateReceipt}
                        disabled={isValidating || validationResult?.valid}
                        className="btn-clay-primary flex-[2] h-10 sm:h-12 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                            Memproses...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                            Verifikasi Sekarang
                          </>
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="clay-card p-4 sm:p-6">
            <h3 className="text-[10px] sm:text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-1.5 sm:gap-2">
              <Info className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 dark:text-blue-400" />
              Ringkasan Pembayaran
            </h3>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Nama Pembeli</span>
                <span className="font-black text-zinc-900 dark:text-white text-base sm:text-lg tracking-tighter">{buyerName}</span>
              </div>
              
              <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
              
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Total Tagihan</span>
                <span className="font-black text-blue-600 dark:text-blue-400 text-lg sm:text-2xl tracking-tighter">
                  {formatRupiah(totalAmount)}
                </span>
              </div>
              
              <div className="pt-3 sm:pt-4">
                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg sm:rounded-xl border border-amber-100 dark:border-amber-800 shadow-inner">
                  <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                    Pastikan nominal yang Anda transfer <b className="text-amber-700 dark:text-amber-400">sama persis</b> dengan total tagihan. AI akan menolak struk jika nominal tidak sesuai atau gambar tidak jelas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/kiosk/checkout')}
            disabled={isValidating || validationResult?.valid}
            className="w-full py-2 sm:py-3 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 group uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 group-hover:-translate-x-1.5 transition-transform" />
            Kembali ke QRIS
          </button>
        </div>
      </div>
    </div>
  );
}
