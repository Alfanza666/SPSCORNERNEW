import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { Trash2, Plus, Minus, ArrowRight, ArrowLeft, ShoppingCart, ShoppingBag, Loader2, User, Info, CreditCard, ShieldCheck, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function Cart() {
  const { items, removeItem, updateQuantity, getTotal, reservations, setReservations } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [isReserving, setIsReserving] = useState(false);

  const subtotal = getTotal();
  
  // Estimasi MDR untuk tampilan UI (iPaymu menggunakan Math.ceil)
  const estimatedMdr = Math.ceil(subtotal * 0.007);
  const estimatedTotal = subtotal + estimatedMdr;

  const grandTotal = subtotal; // Real base amount untuk backend & iPaymu

  useEffect(() => {
    if (user) {
      setBuyerName(user.name);
      setBuyerPhone(user.phone || '');
      setBuyerEmail(user.email || '');
    } else {
      // Load guest data from sessionStorage
      setBuyerName(sessionStorage.getItem('buyerName') || '');
      setBuyerPhone(sessionStorage.getItem('buyerPhone') || '');
      setBuyerEmail(sessionStorage.getItem('buyerEmail') || '');
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 sm:p-6">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
          className="w-24 h-24 sm:w-32 sm:h-32 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 relative shadow-inner dark:shadow-none"
        >
          <ShoppingCart className="w-12 h-12 sm:w-14 sm:h-14 text-zinc-300 dark:text-zinc-600 stroke-[1.5]" />
          <motion.div 
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 bg-blue-500 text-white p-2 sm:p-3 rounded-xl shadow-md"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.div>
        </motion.div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mb-2">Keranjang Kosong</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm mb-6 sm:mb-8 text-center max-w-md leading-relaxed font-medium">
          Sepertinya kamu belum memilih menu apapun. Yuk, jelajahi menu lezat kami dan mulai memesan!
        </p>
        <button 
          onClick={() => navigate('/kiosk')} 
          className="btn-clay-primary h-10 sm:h-12 px-6 sm:px-8 text-xs sm:text-sm flex items-center gap-2"
        >
          <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
          Mulai Belanja
        </button>
      </div>
    );
  }

  const handleCheckout = async () => {
    // --- LOGIKA PENCEGAT LOGIN DITAMBAHKAN DI SINI ---
    if (!user) {
      toast('Silakan masuk ke akun Anda terlebih dahulu untuk melanjutkan pembayaran.', {
        icon: '🔒',
        duration: 3000,
      });
      // Arahkan ke login dengan membawa info URL tujuan checkout ini
      navigate(`/login?redirect=${encodeURIComponent('/kiosk/cart')}`);
      return;
    }
    // -------------------------------------------------

    if (!buyerName.trim()) {
      toast.error('Mohon masukkan nama Anda');
      return;
    }
    if (!buyerPhone.trim() || buyerPhone.length < 10) {
      toast.error('Mohon masukkan nomor HP yang valid');
      return;
    }

    if (!buyerEmail.trim() && !user) {
      toast.error('Mohon masukkan email untuk receive notifikasi pengambilan pesanan');
      return;
    }
    if (buyerEmail.trim() && !buyerEmail.includes('@')) {
      toast.error('Format email tidak valid');
      return;
    }

    setIsReserving(true);
    try {
      const newReservations: string[] = [];
      
      for (const item of items) {
        if (item.is_digital) continue;

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
      sessionStorage.setItem('buyerPhone', buyerPhone);
      sessionStorage.setItem('buyerEmail', buyerEmail);
      navigate('/kiosk/checkout');
    } catch (error: any) {
      console.error('Reservation error:', error);
      toast.error(error.message || 'Gagal memproses pesanan. Silakan coba lagi.');
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-zinc-400 dark:text-zinc-600 mb-3 sm:mb-4 uppercase tracking-widest">
        <span className="cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors" onClick={() => navigate('/kiosk')}>Menu</span>
        <span className="opacity-50">/</span>
        <span className="text-blue-600 dark:text-blue-400">Keranjang</span>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-4 sm:mb-8 gap-3 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-0.5 sm:mb-1">Keranjang Belanja</h1>
          <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 font-bold">
            <Info className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 dark:text-blue-400" />
            Tinjau pesananmu sebelum melanjutkan
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black shadow-inner dark:shadow-none flex items-center gap-1.5 w-fit uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">
          <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
          {items.length} Item Terpilih
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="clay-card p-3 sm:p-4 flex flex-row items-center gap-3 sm:gap-4 group guide-cart-item"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 shadow-inner dark:shadow-none border border-zinc-50 dark:border-zinc-800">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff&rounded=true` }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-200 dark:text-zinc-700">
                      <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 stroke-[1.5]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 w-full">
                  <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                    <div className="min-w-0 pr-3 sm:pr-4">
                      <h3 className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tighter">
                        {item.name}
                      </h3>
                      {item.is_digital && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Digital</span>
                          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{item.target_number}</span>
                        </div>
                      )}
                      <p className="text-blue-600 dark:text-blue-400 font-black text-[10px] sm:text-xs mt-0.5 tracking-tighter">
                        {formatRupiah(item.price)}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, color: '#ef4444' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeItem(item.id)}
                      disabled={isReserving}
                      className="text-zinc-300 dark:text-zinc-600 p-1.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-
