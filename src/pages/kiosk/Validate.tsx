import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Upload, FileImage, ShieldCheck, AlertCircle, Info, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";

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
        alert('File harus berupa gambar (JPG, PNG, dll).');
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
      alert('Gagal memproses gambar. Silakan coba lagi.');
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
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .insert({
            buyer_name: buyerName,
            buyer_id: user?.id || null,
            total_amount: totalAmount,
            status: 'success',
            receipt_image: imageSrc
          })
          .select()
          .single();

        if (txError) throw txError;

        for (const item of items) {
          await supabase.from('transaction_items').insert({
            transaction_id: txData.id,
            product_id: item.id,
            seller_id: item.seller_id,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity
          });
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
          navigate('/kiosk/success');
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
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6 sm:mb-12"
      >
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs sm:text-sm font-bold mb-4 sm:mb-6">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Verifikasi AI Otomatis
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-zinc-900 mb-2 sm:mb-3 tracking-tight">Konfirmasi Pembayaran</h1>
        <p className="text-zinc-500 text-sm sm:text-lg max-w-lg mx-auto leading-relaxed px-4">
          Upload bukti transfer Anda untuk verifikasi instan oleh sistem kecerdasan buatan kami.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-6 sm:gap-10">
        <div className="lg:col-span-3">
          <div className="glass-card overflow-hidden shadow-2xl shadow-zinc-200/50 border-zinc-200/60 p-4 sm:p-8">
            <div className="relative bg-zinc-50 rounded-2xl sm:rounded-[2rem] overflow-hidden aspect-[4/3] flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 group transition-all duration-300 hover:border-blue-300">
              {!imageSrc ? (
                <div className="text-center p-6 sm:p-10">
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-16 h-16 sm:w-24 sm:h-24 bg-blue-100 rounded-2xl sm:rounded-[2rem] flex items-center justify-center mx-auto mb-4 sm:mb-6 transition-colors group-hover:bg-blue-600 group-hover:text-white text-blue-700"
                  >
                    <FileImage className="w-8 h-8 sm:w-12 sm:h-12 stroke-[1.5]" />
                  </motion.div>
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-900 mb-1 sm:mb-2">Pilih File Bukti</h3>
                  <p className="text-xs sm:text-sm text-zinc-500 mb-6 sm:mb-8 max-w-[200px] mx-auto">Format JPG, PNG atau Screenshot M-Banking</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-primary flex items-center gap-2 mx-auto text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                  >
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
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
                    className="absolute inset-0 bg-zinc-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 sm:p-10 text-center"
                  >
                    <div className="relative mb-6 sm:mb-8">
                      <div className="absolute inset-0 bg-blue-500/20 blur-2xl sm:blur-3xl rounded-full animate-pulse" />
                      <Loader2 className="w-12 h-12 sm:w-20 sm:h-20 animate-spin text-blue-400 relative z-10" />
                    </div>
                    <h3 className="text-xl sm:text-3xl font-black tracking-[0.2em] mb-3 sm:mb-4 uppercase">AI SCANNING</h3>
                    <div className="w-32 sm:w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="w-full h-full bg-blue-500"
                      />
                    </div>
                    <p className="text-zinc-400 mt-4 sm:mt-6 text-xs sm:text-sm font-medium px-4">Memverifikasi nominal dan keaslian struk pembayaran Anda...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {validationResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-6 sm:mt-8 p-4 sm:p-6 rounded-xl sm:rounded-2xl flex items-start gap-3 sm:gap-4 border-2 ${
                    validationResult.valid 
                      ? 'bg-blue-50 text-blue-800 border-blue-100' 
                      : 'bg-red-50 text-red-800 border-red-100'
                  }`}
                >
                  <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0 ${validationResult.valid ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                      <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-base sm:text-xl mb-0.5 sm:mb-1">
                      {validationResult.valid ? 'Validasi Berhasil' : 'Validasi Gagal'}
                    </h4>
                    <p className="text-xs sm:text-sm font-medium opacity-80 leading-relaxed">{validationResult.message}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
              {imageSrc && (
                <>
                  {validationResult?.valid === false ? (
                    <button 
                      onClick={retake} 
                      className="btn-primary w-full h-12 sm:h-16 flex items-center justify-center gap-2 text-sm sm:text-base bg-red-600 hover:bg-red-700 shadow-red-600/20"
                    >
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                      Unggah Ulang Bukti
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={retake} 
                        disabled={isValidating || validationResult?.valid}
                        className="btn-secondary flex-1 h-12 sm:h-16 flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                        Ganti Gambar
                      </button>
                      <button 
                        onClick={validateReceipt}
                        disabled={isValidating || validationResult?.valid}
                        className="btn-primary flex-[2] h-12 sm:h-16 flex items-center justify-center gap-2 sm:gap-3 shadow-blue-600/20 text-sm sm:text-base"
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                            Memproses...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
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

        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          <div className="glass-card p-5 sm:p-8 border-zinc-200/60 shadow-xl shadow-zinc-200/50">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 sm:mb-8 flex items-center gap-1.5 sm:gap-2">
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
              Ringkasan Pembayaran
            </h3>
            
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[10px] sm:text-xs text-zinc-400 font-medium uppercase tracking-wider">Nama Pembeli</span>
                <span className="font-bold text-zinc-900 text-lg sm:text-xl">{buyerName}</span>
              </div>
              
              <div className="h-px bg-zinc-100 w-full" />
              
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[10px] sm:text-xs text-zinc-400 font-medium uppercase tracking-wider">Total Tagihan</span>
                <span className="font-black text-blue-600 text-2xl sm:text-3xl tracking-tight">
                  {formatRupiah(totalAmount)}
                </span>
              </div>
              
              <div className="pt-4 sm:pt-6">
                <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 bg-amber-50 rounded-xl sm:rounded-2xl border border-amber-100">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] sm:text-xs text-amber-900 leading-relaxed font-medium">
                    Pastikan nominal yang Anda transfer <b className="text-amber-700">sama persis</b> dengan total tagihan. AI akan menolak struk jika nominal tidak sesuai atau gambar tidak jelas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/kiosk/checkout')}
            disabled={isValidating || validationResult?.valid}
            className="w-full py-3 sm:py-4 text-zinc-400 hover:text-zinc-600 transition-colors font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 h-4" />
            Kembali ke QRIS
          </button>
        </div>
      </div>
    </div>
  );
}
