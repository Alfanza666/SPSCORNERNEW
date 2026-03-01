import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { QrCode, Upload, ShieldCheck, Info, ArrowLeft, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';

export default function Checkout() {
  const { items, getTotal } = useCartStore();
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-bold mb-6">
            <ShieldCheck className="w-4 h-4" />
            Pembayaran Aman & Terenkripsi
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-3 tracking-tight">Selesaikan Pembayaran</h1>
          <p className="text-zinc-500 text-lg max-w-lg mx-auto leading-relaxed">
            Silakan scan kode QR di bawah ini menggunakan aplikasi M-Banking atau e-Wallet pilihanmu.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-8 items-start">
          <div className="md:col-span-3">
            <div className="glass-card overflow-hidden shadow-2xl shadow-zinc-200/50 border-zinc-200/60">
              <div className="bg-zinc-900 text-white p-8 text-center relative overflow-hidden">
                {/* Decorative Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                </div>
                
                <p className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-2 relative z-10">Total Tagihan</p>
                <h2 className="text-5xl font-black tracking-tight relative z-10">
                  {formatRupiah(getTotal())}
                </h2>
              </div>
              
              <div className="p-10 flex flex-col items-center bg-white">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-emerald-500/5 rounded-[2.5rem] blur-2xl group-hover:bg-emerald-500/10 transition-colors duration-500" />
                  
                  {loading ? (
                    <div className="w-72 h-72 bg-zinc-50 animate-pulse rounded-3xl flex items-center justify-center border-2 border-dashed border-zinc-200 relative z-10">
                      <QrCode className="w-16 h-16 text-zinc-200" />
                    </div>
                  ) : qrisUrl ? (
                    <div className="relative z-10 p-4 bg-white rounded-[2rem] shadow-xl border border-zinc-100">
                      <img
                        src={qrisUrl}
                        alt="QRIS"
                        className="w-64 h-64 object-contain rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-72 h-72 bg-zinc-50 rounded-3xl flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 relative z-10">
                      <QrCode className="w-16 h-16 mb-4 stroke-[1.5]" />
                      <p className="font-medium">QRIS belum diatur</p>
                    </div>
                  )}
                </div>

                <div className="mt-10 flex items-center gap-3 text-zinc-400 text-sm font-medium bg-zinc-50 px-6 py-3 rounded-2xl border border-zinc-100">
                  <Info className="w-4 h-4 text-blue-500" />
                  Simpan bukti transfer untuk validasi
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <div className="glass-card p-6 border-zinc-200/60">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Detail Pesanan
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Pemesan</span>
                  <span className="font-bold text-zinc-900 text-lg">{buyerName}</span>
                </div>
                
                <div className="h-px bg-zinc-100 w-full" />
                
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Jumlah Item</span>
                  <span className="font-bold text-zinc-900 text-lg">
                    {items.reduce((sum, item) => sum + item.quantity, 0)} Produk
                  </span>
                </div>

                {user?.nik && (
                  <>
                    <div className="h-px bg-zinc-100 w-full" />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">NIK Terdaftar</span>
                      <span className="font-bold text-zinc-900 text-lg">{user.nik}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate('/kiosk/validate')}
                className="btn-primary w-full h-20 text-xl shadow-emerald-600/20 group flex items-center justify-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                Konfirmasi Bayar
              </button>

              <button
                onClick={() => navigate('/kiosk/cart')}
                className="w-full py-4 text-zinc-400 hover:text-zinc-600 transition-colors font-bold text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Keranjang
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
