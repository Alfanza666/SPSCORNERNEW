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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-amber-50 text-amber-700 text-[8px] sm:text-[10px] font-bold mb-4 sm:mb-6 shadow-inner border border-amber-100/50 uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4" />
            Pembayaran Aman & Terenkripsi
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-zinc-900 mb-1.5 sm:mb-2 tracking-tighter">Selesaikan Pembayaran</h1>
          <p className="text-zinc-500 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed px-4 font-medium">
            Silakan scan kode QR di bawah ini menggunakan aplikasi M-Banking atau e-Wallet pilihanmu.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-4 sm:gap-6 items-start">
          <div className="lg:col-span-3">
            <div className="clay-card overflow-hidden">
              <div className="bg-zinc-900 text-white p-4 sm:p-6 text-center relative overflow-hidden">
                {/* Decorative Pattern */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                </div>
                
                <p className="text-zinc-400 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mb-0.5 sm:mb-1 relative z-10">Total Tagihan</p>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tighter relative z-10 text-white drop-shadow-md">
                  {formatRupiah(getTotal())}
                </h2>
              </div>
              
              <div className="p-4 sm:p-6 flex flex-col items-center bg-white">
                <div className="relative group">
                  <div className="absolute -inset-4 sm:-inset-6 bg-blue-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-blue-500/20 transition-all duration-700" />
                  
                  {loading ? (
                    <div className="w-40 h-40 sm:w-56 sm:h-56 bg-zinc-50 animate-pulse rounded-xl sm:rounded-2xl flex items-center justify-center border-2 border-dashed border-zinc-200 relative z-10">
                      <QrCode className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-300" />
                    </div>
                  ) : qrisUrl ? (
                    <div className="relative z-10 p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 sm:border-4 border-zinc-50 group-hover:scale-[1.02] transition-transform duration-500">
                      <img
                        src={qrisUrl}
                        alt="QRIS"
                        className="w-40 h-40 sm:w-56 sm:h-56 object-contain rounded-lg sm:rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-40 h-40 sm:w-56 sm:h-56 bg-zinc-50 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 relative z-10">
                      <QrCode className="w-10 h-10 sm:w-12 sm:h-12 mb-2 sm:mb-3 stroke-[1.5]" />
                      <p className="font-bold text-[8px] sm:text-[10px] uppercase tracking-widest">QRIS belum diatur</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 sm:mt-8 flex items-center gap-2 sm:gap-3 text-zinc-500 text-[10px] sm:text-xs font-medium bg-zinc-50 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-inner border border-zinc-50 text-center max-w-md leading-relaxed">
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
                  Simpan bukti transfer untuk validasi pembayaran Anda
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <div className="clay-card p-4 sm:p-6">
              <h3 className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-1.5 sm:gap-2">
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
                Detail Pesanan
              </h3>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Pemesan</span>
                  <span className="font-black text-zinc-900 text-base sm:text-lg tracking-tighter">{buyerName}</span>
                </div>
                
                <div className="h-px bg-zinc-100" />
                
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Jumlah Item</span>
                  <span className="font-black text-zinc-900 text-base sm:text-lg tracking-tighter">
                    {items.reduce((sum, item) => sum + item.quantity, 0)} Produk
                  </span>
                </div>

                {user?.nik && (
                  <>
                    <div className="h-px bg-zinc-100" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest">NIK Terdaftar</span>
                      <span className="font-black text-zinc-900 text-base sm:text-lg tracking-tighter">{user.nik}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <button
                onClick={() => navigate('/kiosk/validate')}
                className="btn-clay-primary w-full h-10 sm:h-12 text-xs sm:text-sm group flex items-center justify-center gap-2 sm:gap-3"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                Konfirmasi Bayar
              </button>

              <button
                onClick={handleBack}
                className="w-full py-2 sm:py-3 text-zinc-400 hover:text-blue-600 transition-colors font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 group uppercase tracking-widest"
              >
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 group-hover:-translate-x-1.5 transition-transform" />
                Kembali ke Keranjang
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
