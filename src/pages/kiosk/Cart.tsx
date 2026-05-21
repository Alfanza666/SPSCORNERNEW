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
    if (!user) {
      toast('Silakan masuk ke akun Anda terlebih dahulu untuk melanjutkan pembayaran.', {
        icon: '🔒',
        duration: 3000,
      });
      navigate(`/login?redirect=${encodeURIComponent('/kiosk/cart')}`);
      return;
    }

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
                      className="text-zinc-300 dark:text-zinc-600 p-1.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md sm:rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </motion.button>
                  </div>

                  <div className="flex items-center justify-between mt-2 sm:mt-4">
                    <div className="flex items-center bg-zinc-50 dark:bg-zinc-800/50 rounded-md sm:rounded-lg p-0.5 sm:p-1 shadow-inner dark:shadow-none border border-zinc-50 dark:border-zinc-800">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          if (item.quantity > 1) updateQuantity(item.id, item.quantity - 1);
                        }}
                        disabled={item.quantity <= 1 || isReserving}
                        className="h-6 w-6 sm:h-8 sm:w-8 rounded-sm sm:rounded-md bg-white dark:bg-zinc-700 shadow-sm dark:shadow-none flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors border border-zinc-50 dark:border-zinc-700"
                      >
                        <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </motion.button>
                      <span className="font-black w-6 sm:w-8 text-center text-zinc-900 dark:text-white text-xs sm:text-sm tracking-tighter">
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
                        className="h-6 w-6 sm:h-8 sm:w-8 rounded-sm sm:rounded-md bg-white dark:bg-zinc-700 shadow-sm dark:shadow-none flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 transition-colors border border-zinc-50 dark:border-zinc-700"
                      >
                        <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </motion.button>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-[8px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest mb-0.5">Subtotal</p>
                      <p className="font-black text-zinc-900 dark:text-white text-xs sm:text-sm tracking-tighter">{formatRupiah(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-1">
          <div className="clay-card p-4 sm:p-6 sticky top-20 sm:top-24">
            <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-1.5 tracking-tighter">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 dark:text-blue-400" />
              Ringkasan
            </h2>
            
            <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 guide-cart-buyer-info">
              <div className="flex justify-between text-zinc-400 dark:text-zinc-500 font-bold text-[10px] sm:text-xs">
                <span>Total Item</span>
                <span className="text-zinc-900 dark:text-white font-black">
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400 dark:text-zinc-500 font-bold text-[10px] sm:text-xs">
                <span>Subtotal</span>
                <span className="text-zinc-900 dark:text-white font-black">
                  {formatRupiah(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400 dark:text-zinc-500 font-bold text-[10px] sm:text-xs mt-2">
                <span className="flex items-center gap-1">
                  Biaya Layanan
                  <span className="text-[8px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded font-black">
                    QRIS 0.7%
                  </span>
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-black">+{formatRupiah(estimatedMdr)}</span>
              </div>
              <div className="pt-3 sm:pt-4 border-t border-zinc-50 dark:border-zinc-800 flex justify-between items-end mt-3">
                <span className="text-zinc-400 dark:text-zinc-500 font-bold text-[10px] sm:text-xs">Total Tagihan</span>
                <span className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                  {formatRupiah(estimatedTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-4 sm:mb-6 guide-cart-summary">
              <div>
                <label className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-zinc-700 dark:text-zinc-300 ml-1 mb-2 uppercase tracking-widest">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 dark:text-blue-400" />
                  Nama Pemesan
                </label>
                <div className="relative">
                  <input
                    placeholder="Masukkan nama Anda"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    disabled={isReserving || !!user}
                    className={`input-clay h-10 sm:h-12 text-xs sm:text-sm pl-3 ${user ? 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-50 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed' : ''}`}
                  />
                  {user?.nik && (
                    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-zinc-100/80 dark:bg-zinc-800/80 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[8px] sm:text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest border border-white/50 dark:border-zinc-700 shadow-sm">
                      NIK: {user.nik}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-zinc-700 dark:text-zinc-300 ml-1 mb-2 uppercase tracking-widest">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 dark:text-blue-400" />
                  Nomor HP (WhatsApp)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="Contoh: 08123456789"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value.replace(/\\D/g, ''))}
                    disabled={isReserving}
                    className="input-clay h-10 sm:h-12 text-xs sm:text-sm pl-3"
                  />
                </div>
                <p className="text-[8px] sm:text-[9px] text-zinc-400 dark:text-zinc-500 font-bold italic ml-1 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 dark:text-emerald-400" />
                  Untuk bantuan kendala & konfirmasi pesanan
                </p>
              </div>

              {!user && (
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-zinc-700 dark:text-zinc-300 ml-1 mb-2 uppercase tracking-widest">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email (Opsional)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="email@contoh.com - untuk dikirimkan nota/token"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      disabled={isReserving}
                      className="input-clay h-10 sm:h-12 text-xs sm:text-sm pl-3"
                    />
                  </div>
                  <p className="text-[8px] sm:text-[9px] text-zinc-400 dark:text-zinc-500 font-bold italic ml-1 mt-1.5 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 dark:text-emerald-400" />
                    Untuk dikirimkan nota & token listrik/pulsa
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleCheckout}
              disabled={isReserving}
              className="btn-clay-primary w-full h-10 sm:h-12 text-xs sm:text-sm group flex items-center justify-center gap-1.5 sm:gap-2 guide-cart-checkout-btn"
            >
              {isReserving ? (
                <>
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  Lanjut Pembayaran
                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </button>
            
            <button
              onClick={() => navigate('/kiosk')}
              className="w-full py-2 sm:py-3 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-black text-[8px] sm:text-[10px] flex items-center justify-center gap-1.5 mt-1 group uppercase tracking-widest"
            >
              <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 group-hover:-translate-x-1.5 transition-transform" />
              Kembali ke Menu
            </button>
            
            <p className="text-center text-[8px] sm:text-[10px] text-zinc-300 dark:text-zinc-600 mt-3 sm:mt-4 leading-relaxed font-bold">
              Dengan melanjutkan, kamu menyetujui syarat dan ketentuan yang berlaku di SPS Corner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
