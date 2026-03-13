import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { QrCode, Upload, ShieldCheck, Info, ArrowLeft, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Checkout() {
  const { items, getTotal, reservations, setReservations } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [qrisUrl, setQrisUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const buyerName = user?.name || sessionStorage.getItem('buyerName');

  useEffect(() => {
    if (items.length === 0 || !buyerName) {
      navigate('/kiosk');
      return;
    }
    fetchQris();
  }, [items, buyerName, navigate]);

  const fetchQris = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'qris_image_url')
        .single();

      if (error) throw error;
      if (data) setQrisUrl(data.value);
    } catch (error) {
      console.error('Error fetching QRIS:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    if (reservations.length > 0) {
      try {
        for (const resId of reservations) {
          await supabase.rpc('release_stock', { p_reservation_id: resId });
        }
        setReservations([]);
      } catch (error) {
        console.error('Error releasing reservations on back:', error);
      }
    }
    navigate('/kiosk/cart');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs sm:text-sm font-bold mb-4 sm:mb-6">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Pembayaran Aman & Terenkripsi
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-zinc-900 mb-2 sm:mb-3 tracking-tight">Selesaikan Pembayaran</h1>
          <p className="text-zinc-500 text-sm sm:text-lg max-w-lg mx-auto leading-relaxed px-4">
            Silakan scan kode QR di bawah ini menggunakan aplikasi M-Banking atau e-Wallet pilihanmu.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-6 sm:gap-8 items-start">
          <div className="md:col-span-3">
            <div className="glass-card overflow-hidden shadow-2xl shadow-zinc-200/50 border-zinc-200/60">
              <div className="bg-zinc-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
                {/* Decorative Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                </div>
                
                <p className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-1.5 sm:mb-2 relative z-10">Total Tagihan</p>
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight relative z-10">
                  {formatRupiah(getTotal())}
                </h2>
              </div>
              
              <div className="p-6 sm:p-10 flex flex-col items-center bg-white">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-blue-500/5 rounded-[2rem] sm:rounded-[2.5rem] blur-xl sm:blur-2xl group-hover:bg-blue-500/10 transition-colors duration-500" />
                  
                  {loading ? (
                    <div className="w-48 h-48 sm:w-72 sm:h-72 bg-zinc-50 animate-pulse rounded-2xl sm:rounded-3xl flex items-center justify-center border-2 border-dashed border-zinc-200 relative z-10">
                      <QrCode className="w-10 h-10 sm:w-16 sm:h-16 text-zinc-200" />
                    </div>
                  ) : qrisUrl ? (
                    <div className="relative z-10 p-3 sm:p-4 bg-white rounded-2xl sm:rounded-[2rem] shadow-xl border border-zinc-100">
                      <img
                        src={qrisUrl}
                        alt="QRIS"
                        className="w-48 h-48 sm:w-64 sm:h-64 object-contain rounded-xl sm:rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 sm:w-72 sm:h-72 bg-zinc-50 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 relative z-10">
                      <QrCode className="w-10 h-10 sm:w-16 sm:h-16 mb-2 sm:mb-4 stroke-[1.5]" />
                      <p className="font-medium text-sm sm:text-base">QRIS belum diatur</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 sm:mt-10 flex items-center gap-2 sm:gap-3 text-zinc-400 text-xs sm:text-sm font-medium bg-zinc-50 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-zinc-100 text-center">
                  <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                  Simpan bukti transfer untuk validasi
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4 sm:space-y-6">
            <div className="glass-card p-5 sm:p-6 border-zinc-200/60">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-1.5 sm:gap-2">
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Detail Pesanan
              </h3>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col gap-0.5 sm:gap-1">
                  <span className="text-[10px] sm:text-xs text-zinc-400 font-medium uppercase tracking-wider">Pemesan</span>
                  <span className="font-bold text-zinc-900 text-base sm:text-lg">{buyerName}</span>
                </div>
                
                <div className="h-px bg-zinc-100 w-full" />
                
                <div className="flex flex-col gap-0.5 sm:gap-1">
                  <span className="text-[10px] sm:text-xs text-zinc-400 font-medium uppercase tracking-wider">Jumlah Item</span>
                  <span className="font-bold text-zinc-900 text-base sm:text-lg">
                    {items.reduce((sum, item) => sum + item.quantity, 0)} Produk
                  </span>
                </div>

                {user?.nik && (
                  <>
                    <div className="h-px bg-zinc-100 w-full" />
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                      <span className="text-[10px] sm:text-xs text-zinc-400 font-medium uppercase tracking-wider">NIK Terdaftar</span>
                      <span className="font-bold text-zinc-900 text-base sm:text-lg">{user.nik}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <button
                onClick={() => navigate('/kiosk/validate')}
                className="btn-primary w-full h-14 sm:h-20 text-base sm:text-xl shadow-blue-600/20 group flex items-center justify-center gap-3 sm:gap-4"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                Konfirmasi Bayar
              </button>

              <button
                onClick={handleBack}
                className="w-full py-3 sm:py-4 text-zinc-400 hover:text-zinc-600 transition-colors font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Kembali ke Keranjang
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
