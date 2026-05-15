import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Zap, Tag, Loader2, CheckCircle, Shield, ChevronLeft, Clock, Calendar, Info, Cpu, Package, Fingerprint, ImageIcon, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<any>(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        h: Math.floor(difference / (1000 * 60 * 60 * 24)),
        j: Math.floor((difference / (1000 * 60 * 60)) % 24),
        m: Math.floor((difference / 1000 / 60) % 60),
        s: Math.floor((difference / 1000) % 60),
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
    timerComponents.push(
      <span key={interval} className="flex items-baseline gap-0.5">
        <span className="text-sm font-black tracking-tighter">{(timeLeft as any)[interval].toString().padStart(2, '0')}</span>
        <span className="text-[7px] font-black uppercase opacity-60">{interval}</span>
      </span>
    );
  });

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 backdrop-blur-xl text-white rounded-full border border-white/10 shadow-xl">
      {timerComponents.length ? timerComponents : <span className="text-[10px] font-black animate-pulse text-green-400">READY</span>}
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
      
      if (data) {
        const processed = data.map(item => {
          try {
            const parsed = JSON.parse(item.description);
            return { ...item, details: parsed };
          } catch {
            return { ...item, details: { specifications: item.description } };
          }
        });
        setAssets(processed);
      }
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
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/portal')}
            className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group shadow-sm"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-1">Flashsale Aset</h1>
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Sistem Lelang Cepat - Bagian Umum</p>
          </div>
        </div>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sinkronisasi Waktu Server...</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-zinc-900 rounded-[3rem] shadow-sm border border-zinc-100 dark:border-zinc-800">
          <div className="w-24 h-24 rounded-3xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-12 h-12 text-zinc-200" />
          </div>
          <p className="text-zinc-500 font-black text-2xl mb-2">Belum Ada Aset Terdaftar</p>
          <p className="text-sm text-zinc-400 font-medium max-w-xs mx-auto">Nantikan lelang aset perusahaan selanjutnya.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {assets.map((asset, idx) => {
            const myBooking = asset.asset_bookings?.find((b: any) => b.user_id === user?.id);
            const totalBookings = asset.asset_bookings?.length || 0;
            const startTime = new Date(asset.start_time);
            const hasStarted = now >= startTime;

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-2xl shadow-zinc-200/50 dark:shadow-none group flex flex-col h-full hover:border-blue-500/30 transition-colors"
              >
                {/* Image Section - Now more visible for "review" */}
                <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  {asset.image_url ? (
                    <img src={asset.image_url} alt={asset.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                       <ImageIcon className="w-16 h-16"/>
                    </div>
                  )}
                  
                  {/* Status & Timer Overlay - Better positioning for visibility */}
                  <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex justify-between items-end">
                    {!hasStarted ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/90 backdrop-blur text-white text-[9px] font-black rounded-full uppercase tracking-widest w-fit shadow-xl">
                          <Clock className="w-3 h-3"/> Review Mode
                        </div>
                        <CountdownTimer targetDate={asset.start_time} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-xl animate-pulse">
                        <Zap className="w-3.5 h-3.5 fill-white"/> LIVE NOW
                      </div>
                    )}
                    
                    <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-2xl flex flex-col items-center shadow-xl">
                       <p className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Peminat</p>
                       <p className="text-sm font-black text-zinc-900 leading-none">{totalBookings}</p>
                    </div>
                  </div>

                  {/* Top Right Label */}
                  <div className="absolute top-6 right-6">
                     <div className="p-2 bg-white/90 backdrop-blur rounded-xl text-zinc-400">
                        <Eye className="w-4 h-4"/>
                     </div>
                  </div>
                </div>

                <div className="p-10 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1">
                       <h3 className="font-black text-2xl text-zinc-900 dark:text-white tracking-tight">{asset.title}</h3>
                       <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          <Fingerprint className="w-3 h-3"/> {asset.details?.serial_number || 'No Serial'}
                       </div>
                    </div>
                  </div>
                  
                  {/* Structured Details - Always visible for review */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                     <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-2">
                        <div className="flex items-center gap-2 text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                           <Cpu className="w-3 h-3 text-blue-500"/> Spesifikasi
                        </div>
                        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 italic">{asset.details?.specifications || 'N/A'}</p>
                     </div>
                     <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-2">
                        <div className="flex items-center gap-2 text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                           <Package className="w-3 h-3 text-blue-500"/> Kelengkapan
                        </div>
                        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 italic">{asset.details?.kelengkapan || 'N/A'}</p>
                     </div>
                  </div>
                  
                  <div className="mt-auto space-y-6">
                    <div className="p-6 bg-blue-600/5 dark:bg-blue-600/10 rounded-3xl border border-blue-600/10 dark:border-blue-600/20">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Estimasi Harga</p>
                             <div className="group relative cursor-help">
                                <Info className="w-3.5 h-3.5 text-blue-300"/>
                                <div className="absolute bottom-full left-0 mb-3 w-56 p-4 bg-zinc-900 text-white text-[9px] font-bold leading-relaxed rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl z-50">
                                   Harga cuma estimasi, harga final tergantung harga beli & kelayakan produk.
                                </div>
                             </div>
                          </div>
                          <p className="font-black text-3xl text-blue-600 tracking-tight">Rp {asset.estimated_price?.toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    </div>

                    {/* LIVE BUTTON LOGIC */}
                    <div className="space-y-3">
                      {myBooking ? (
                        <div className={`w-full py-6 rounded-3xl font-black flex items-center justify-center gap-3 shadow-2xl transition-all ${
                          myBooking.status === 'won' 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          {myBooking.status === 'won' ? <Shield className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                          {myBooking.status === 'won' ? 'SELAMAT! ANDA MENANG' : 'ANDA SUDAH BOOKING'}
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleBooking(asset.id)}
                          disabled={bookingId === asset.id || !hasStarted}
                          className={`w-full py-6 rounded-3xl font-black shadow-2xl transition-all flex items-center justify-center gap-3 relative overflow-hidden group ${
                            !hasStarted 
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' 
                              : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 active:scale-95 hover:shadow-blue-500/20'
                          }`}
                        >
                          {bookingId === asset.id ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <>
                              <Zap className={`w-6 h-6 ${hasStarted ? 'fill-current animate-pulse' : ''}`} />
                              {hasStarted ? 'AMBIL SEKARANG' : 'BELUM DIMULAI'}
                            </>
                          )}
                          
                          {/* Animated progress if not started */}
                          {!hasStarted && (
                            <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000 ease-linear" style={{ 
                                width: `${Math.min(100, Math.max(0, (1 - (+new Date(asset.start_time) - +now) / (60 * 60 * 1000)) * 100))}%` 
                            }} />
                          )}
                        </button>
                      )}
                      
                      {!hasStarted && (
                        <p className="text-center text-[9px] font-black text-amber-600 uppercase tracking-widest animate-pulse">
                           Tombol akan aktif otomatis saat waktu tercapai
                        </p>
                      )}
                    </div>
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