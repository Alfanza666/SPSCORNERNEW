import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Zap, Tag, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export default function PortalFlashsale() {
  const { user } = useAuthStore();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const { data } = await supabase
        .from('sps_assets')
        .select('*, asset_bookings(user_id, status)')
        .eq('status', 'open');
      if (data) setAssets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (assetId: string) => {
    if (!user) return;
    setBookingId(assetId);
    try {
      const { error } = await supabase.from('asset_bookings').insert({
        asset_id: assetId,
        user_id: user.id
      });
      if (error) throw error;
      toast.success('Berhasil Booking Aset! Tunggu info harga final dari Admin.');
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal. Anda sudah booking atau kuota penuh.');
    } finally {
      setBookingId(null);
    }
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 p-4 pb-8">
      <div className="max-w-md mx-auto space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-red-600 to-red-700 rounded-3xl p-6 text-white shadow-xl shadow-red-500/30"
        >
          <h2 className="font-black text-2xl flex items-center gap-3"><Zap className="fill-white"/> SPS Flashsale Aset</h2>
          <p className="text-sm text-red-100 mt-1">Lelang aset perusahaan. Siapa Cepat, Dia Dapat!</p>
        </motion.div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-red-500"/></div>
      ) : (
        <div className="space-y-4">
          {assets.map((asset) => {
            const myBooking = asset.asset_bookings?.find((b: any) => b.user_id === user?.id);
            const totalBookings = asset.asset_bookings?.length || 0;

            return (
              <div key={asset.id} className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                {asset.image_url && <img src={asset.image_url} alt={asset.title} className="w-full h-48 object-cover"/>}
                <div className="p-5">
                  <h3 className="font-black text-lg mb-1">{asset.title}</h3>
                  <p className="text-sm text-zinc-500 mb-3">{asset.description}</p>
                  
                  <div className="flex items-center justify-between mb-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-zinc-400">Estimasi Harga</p>
                      <p className="font-black text-red-600">Rp {asset.estimated_price?.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-zinc-400">Peminat</p>
                      <p className="font-bold">{totalBookings} Orang</p>
                    </div>
                  </div>

                  {myBooking ? (
                    <button disabled className="w-full py-3 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5"/> {myBooking.status === 'won' ? 'Anda Menang!' : 'Berhasil Booking'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleBooking(asset.id)}
                      disabled={bookingId === asset.id}
                      className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 rounded-xl font-bold transition-all active:scale-95"
                    >
                      {bookingId === asset.id ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "Daftar Minat Sekarang"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
