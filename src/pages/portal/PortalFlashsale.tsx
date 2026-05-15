import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Zap, Tag, Loader2, CheckCircle, Shield, ChevronLeft, Clock, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<any>(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        hari: Math.floor(difference / (1000 * 60 * 60 * 24)),
        jam: Math.floor((difference / (1000 * 60 * 60)) % 24),
        menit: Math.floor((difference / 1000 / 60) % 60),
        detik: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const timerComponents: any[] = [];

  Object.keys(timeLeft).forEach((interval) => {
    if (!(timeLeft as any)[interval]) return;
    timerComponents.push(
      <span key={interval} className="flex flex-col items-center">
        <span className="text-lg font-black leading-none">{(timeLeft as any)[interval]}</span>
        <span className="text-[8px] uppercase opacity-60 tracking-tighter">{interval}</span>
      </span>
    );
  });

  return (
    <div className="flex items-center gap-3">
      {timerComponents.length ? (
        <div className="flex gap-4 p-4 bg-zinc-950/10 dark:bg-zinc-100/10 backdrop-blur rounded-2xl border border-white/20">
          {timerComponents}
        </div>
      ) : (
        <span className="font-black text-green-500 animate-pulse">Dimulai Sekarang!</span>
      )}
    </div>
  );
}

export default function PortalFlashsale() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchAssets();
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAssets = async () => {
    try {
      const { data } = await supabase
        .from('sps_assets')
        .select('*, asset_bookings(user_id, status)')
        .eq('status', 'open')
        .order('start_time', { ascending: true });
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
      </div>

      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 shadow-xl shadow-blue-500/20"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Zap className="w-10 h-10 text-white fill-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white mb-1 tracking-tight">SPS Flashsale Aset</h2>
            <p className="text-blue-100 text-lg font-medium">Lelang aset perusahaan. Siapa Cepat, Dia Dapat!</p>
          </div>
        </div>
      </motion.div>

      {/* Assets Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border border-zinc-100 dark:border-zinc-800">
          <div className="w-24 h-24 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-12 h-12 text-zinc-300" />
          </div>
          <p className="text-zinc-500 font-black text-xl mb-2">Belum Ada Aset</p>
          <p className="text-sm text-zinc-400">Nantikan update lelang selanjutnya!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {assets.map((asset, idx) => {
            const myBooking = asset.asset_bookings?.find((b: any) => b.user_id === user?.id);
            const totalBookings = asset.asset_bookings?.length || 0;
            const startTime = new Date(asset.start_time);
            const hasStarted = now >= startTime;

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-none group"
              >
                <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  {asset.image_url ? (
                    <img src={asset.image_url} alt={asset.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                       <Tag className="w-12 h-12"/>
                    </div>
                  )}
                  
                  <div className="absolute top-4 left-4">
                    {!hasStarted ? (
                      <span className="px-4 py-2 bg-amber-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest flex items-center gap-2 shadow-lg">
                        <Clock className="w-3 h-3"/> Akan Datang
                      </span>
                    ) : (
                      <span className="px-4 py-2 bg-green-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest flex items-center gap-2 shadow-lg animate-pulse">
                        <Zap className="w-3 h-3 fill-white"/> Sedang Berlangsung
                      </span>
                    )}
                  </div>
                  
                  {!hasStarted && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-3 text-white/80">Dimulai Dalam</p>
                      <CountdownTimer targetDate={asset.start_time} />
                    </div>
                  )}
                </div>

                <div className="p-8">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-black text-2xl text-zinc-900 dark:text-white leading-tight">{asset.title}</h3>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Peminat</p>
                       <p className="font-black text-lg text-zinc-900 dark:text-white">{totalBookings}</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed line-clamp-2">{asset.description}</p>
                  
                  <div className="flex items-center gap-4 mb-8 p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                       <Tag className="w-6 h-6 text-blue-600"/>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Estimasi Harga</p>
                      <p className="font-black text-2xl text-blue-600">Rp {asset.estimated_price?.toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {myBooking ? (
                      <div className={`w-full py-5 rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-lg ${
                        myBooking.status === 'won' 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                      }`}>
                        <CheckCircle className="w-6 h-6" />
                        {myBooking.status === 'won' ? 'SELAMAT! ANDA MENANG' : 'ANDA SUDAH DAFTAR'}
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleBooking(asset.id)}
                        disabled={bookingId === asset.id || !hasStarted}
                        className={`w-full py-5 rounded-[1.5rem] font-black shadow-xl transition-all flex items-center justify-center gap-3 relative overflow-hidden group ${
                          !hasStarted 
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed shadow-none' 
                            : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 active:scale-95'
                        }`}
                      >
                        {bookingId === asset.id ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <Zap className={`w-6 h-6 ${hasStarted ? 'fill-current' : ''}`} />
                            {hasStarted ? 'BOOKING SEKARANG' : 'BELUM DIMULAI'}
                          </>
                        )}
                      </button>
                    )}
                    
                    {!hasStarted && (
                      <p className="text-center text-[10px] font-black text-amber-600 uppercase tracking-widest">
                        Tombol akan aktif otomatis saat waktu dimulai
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}