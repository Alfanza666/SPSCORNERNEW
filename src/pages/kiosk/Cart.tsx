import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { Trash2, Plus, Minus, ArrowRight, ShoppingCart, ShoppingBag, Loader2, User, Info, CreditCard, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

export default function Cart() {
  const { items, removeItem, updateQuantity, getTotal, reservations, setReservations } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [buyerName, setBuyerName] = useState('');
  const [isReserving, setIsReserving] = useState(false);

  useEffect(() => {
    if (user) {
      setBuyerName(user.name);
    }
  }, [user]);

  useEffect(() => {
    const releaseExistingReservations = async () => {
      if (reservations.length > 0) {
        try {
          for (const resId of reservations) {
            await supabase.rpc('release_stock', { p_reservation_id: resId });
          }
          setReservations([]);
        } catch (error) {
          console.error('Error releasing old reservations:', error);
        }
      }
    };
    releaseExistingReservations();
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
          className="w-40 h-40 bg-zinc-100 rounded-full flex items-center justify-center mb-8 relative"
        >
          <ShoppingCart className="w-20 h-20 text-zinc-300 stroke-[1.5]" />
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-2 -right-2 bg-blue-500 text-white p-3 rounded-2xl shadow-lg shadow-blue-200"
          >
            <Plus className="w-6 h-6" />
          </motion.div>
        </motion.div>
        <h2 className="text-3xl font-bold text-zinc-900 mb-3">Keranjang Kosong</h2>
        <p className="text-zinc-500 mb-10 text-center max-w-md leading-relaxed">
          Sepertinya kamu belum memilih menu apapun. Yuk, jelajahi menu lezat kami dan mulai memesan!
        </p>
        <button 
          onClick={() => navigate('/kiosk')} 
          className="btn-primary h-16 px-10 text-lg shadow-blue-600/20 flex items-center gap-3"
        >
          <ShoppingBag className="w-6 h-6" />
          Mulai Belanja
        </button>
      </div>
    );
  }

  const handleCheckout = async () => {
    if (!buyerName.trim()) {
      alert('Mohon masukkan nama Anda');
      return;
    }

    setIsReserving(true);
    try {
      const newReservations: string[] = [];
      
      for (const item of items) {
        const { data: resId, error } = await supabase.rpc('reserve_stock', {
          p_product_id: item.id,
          p_quantity: item.quantity,
          p_expires_in_minutes: 3
        });

        if (error) {
          for (const id of newReservations) {
            await supabase.rpc('release_stock', { p_reservation_id: id });
          }
          throw new Error(`Stok ${item.name} tidak mencukupi atau sedang dipesan orang lain.`);
        }
        
        if (resId) {
          newReservations.push(resId);
        }
      }

      setReservations(newReservations);
      sessionStorage.setItem('buyerName', buyerName);
      navigate('/kiosk/checkout');
    } catch (error: any) {
      console.error('Reservation error:', error);
      alert(error.message || 'Gagal memproses pesanan. Silakan coba lagi.');
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-2">Keranjang Belanja</h1>
          <p className="text-zinc-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Tinjau pesananmu sebelum melanjutkan ke pembayaran
          </p>
        </div>
        <div className="bg-blue-50 text-blue-700 py-2 px-5 rounded-2xl text-sm font-bold border border-blue-100 shadow-sm flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          {items.length} Item Terpilih
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-4 sm:p-5 flex flex-row items-center gap-4 sm:gap-6 group hover:border-blue-500/30 transition-all duration-300"
              >
                <div className="w-20 h-20 sm:w-28 sm:h-28 bg-zinc-100 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner border border-zinc-200/50">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.5]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 w-full">
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 pr-2">
                      <h3 className="font-bold text-sm sm:text-xl text-zinc-900 truncate group-hover:text-blue-600 transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-blue-600 font-extrabold text-xs sm:text-lg">
                        {formatRupiah(item.price)}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, color: '#ef4444' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeItem(item.id)}
                      disabled={isReserving}
                      className="text-zinc-400 p-1.5 sm:p-2 hover:bg-red-50 rounded-lg sm:rounded-xl transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.button>
                  </div>

                  <div className="flex items-center justify-between mt-2 sm:mt-4">
                    <div className="flex items-center bg-zinc-100 rounded-lg sm:rounded-xl p-1 sm:p-1.5 border border-zinc-200">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          if (item.quantity > 1) updateQuantity(item.id, item.quantity - 1);
                        }}
                        disabled={item.quantity <= 1 || isReserving}
                        className="h-6 w-6 sm:h-9 sm:w-9 rounded-md sm:rounded-lg bg-white shadow-sm flex items-center justify-center text-zinc-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                      >
                        <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                      </motion.button>
                      <span className="font-bold w-6 sm:w-10 text-center text-zinc-900 text-xs sm:text-lg">
                        {item.quantity}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          if (item.quantity < item.stock) {
                            updateQuantity(item.id, item.quantity + 1);
                          }
                        }}
                        disabled={item.quantity >= item.stock || isReserving}
                        className="h-6 w-6 sm:h-9 sm:w-9 rounded-md sm:rounded-lg bg-white shadow-sm flex items-center justify-center text-zinc-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      </motion.button>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-[9px] sm:text-xs text-zinc-400 font-medium uppercase tracking-wider mb-0.5 sm:mb-1">Subtotal</p>
                      <p className="font-bold text-zinc-900 text-xs sm:text-base">{formatRupiah(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-1">
          <div className="glass-card p-5 sm:p-8 sticky top-20 sm:top-24 shadow-xl shadow-zinc-200/50 border-zinc-200/60">
            <h2 className="text-lg sm:text-2xl font-bold text-zinc-900 mb-4 sm:mb-8 flex items-center gap-2 sm:gap-3">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
              Ringkasan
            </h2>
            
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              <div className="flex justify-between text-zinc-500 font-medium text-sm sm:text-base">
                <span>Total Item</span>
                <span className="text-zinc-900">
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500 font-medium text-sm sm:text-base">
                <span>Biaya Layanan</span>
                <span className="text-zinc-900">Rp 0</span>
              </div>
              <div className="pt-3 sm:pt-4 border-t border-zinc-100 flex justify-between items-end">
                <span className="text-zinc-500 font-medium text-sm sm:text-base">Total Bayar</span>
                <span className="text-xl sm:text-3xl font-extrabold text-blue-600 tracking-tight">
                  {formatRupiah(getTotal())}
                </span>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
              <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-zinc-700 ml-1">
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                Nama Pemesan
              </label>
              <div className="relative">
                <input
                  placeholder="Masukkan nama Anda"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  disabled={isReserving || !!user}
                  className={`input-field h-12 sm:h-14 text-sm sm:text-lg ${user ? 'bg-zinc-100 border-zinc-200 text-zinc-500 cursor-not-allowed' : ''}`}
                />
                {user?.nik && (
                  <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 bg-zinc-200/50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    NIK: {user.nik}
                  </div>
                )}
              </div>
              {user && (
                <p className="text-[9px] sm:text-[10px] text-zinc-400 italic ml-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Data terverifikasi otomatis dari akun Anda
                </p>
              )}
            </div>

            <button
              onClick={handleCheckout}
              disabled={!buyerName.trim() || isReserving}
              className="btn-primary w-full h-12 sm:h-16 text-sm sm:text-lg shadow-blue-600/20 group flex items-center justify-center gap-2 sm:gap-3"
            >
              {isReserving ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-6 sm:h-6 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  Lanjut Pembayaran
                  <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            
            <p className="text-center text-[10px] sm:text-xs text-zinc-400 mt-4 sm:mt-6 leading-relaxed">
              Dengan melanjutkan, kamu menyetujui syarat dan ketentuan yang berlaku di SPS Corner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
