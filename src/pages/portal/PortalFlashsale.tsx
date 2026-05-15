import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Zap, Tag, Loader2, CheckCircle, Shield, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export default function PortalFlashsale() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
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

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/portal')}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Flashsale Aset SPS
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">Lelang aset perusahaan</p>
          </div>
        </div>
        <div className="hidden lg:block">
          {/* Logo stack removed for professional look */}
        </div>
      </div>

      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-700 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl shadow-red-500/20"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-white mb-1">SPS Flashsale Aset</h2>
            <p className="text-red-100 text-sm sm:text-lg">Lelang aset perusahaan. Siapa Cepat, Dia Dapat!</p>
          </div>
        </div>
      </motion.div>

      {/* Assets Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full"
          />
        </div>
      ) : assets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl shadow-lg"
        >
          <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-12 h-12 text-zinc-400" />
          </div>
          <p className="text-zinc-500 font-bold text-xl mb-2">Belum Ada Aset</p>
          <p className="text-sm text-zinc-400">Aset yang dilelang akan muncul di sini</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assets.map((asset, idx) => {
            const myBooking = asset.asset_bookings?.find((b: any) => b.user_id === user?.id);
            const totalBookings = asset.asset_bookings?.length || 0;

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-lg"
              >
                {asset.image_url && (
                  <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <img src={asset.image_url} alt={asset.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6">
                  <h3 className="font-black text-xl text-zinc-900 dark:text-white mb-2">{asset.title}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">{asset.description}</p>
                  
                  <div className="flex items-center justify-between mb-5 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <p className="text-xs uppercase font-bold text-zinc-400 mb-1">Estimasi Harga</p>
                      <p className="font-black text-xl text-red-600">Rp {asset.estimated_price?.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase font-bold text-zinc-400 mb-1">Peminat</p>
                      <p className="font-bold text-lg">{totalBookings} Orang</p>
                    </div>
                  </div>

                  {myBooking ? (
                    <button disabled className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg">
                      <CheckCircle className="w-5 h-5" />
                      {myBooking.status === 'won' ? 'Anda Menang!' : 'Berhasil Booking'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleBooking(asset.id)}
                      disabled={bookingId === asset.id}
                      className="w-full py-4 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-white dark:to-zinc-100 text-white dark:text-zinc-900 hover:from-zinc-800 hover:to-zinc-700 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      {bookingId === asset.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Tag className="w-5 h-5" />
                          Daftar Minat Sekarang
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}