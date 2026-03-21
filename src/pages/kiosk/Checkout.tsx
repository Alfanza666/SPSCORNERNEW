import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { ShieldCheck, ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

// Declare snap on window object
declare global {
  interface Window {
    snap: any;
  }
}

export default function Checkout() {
  const { items, getTotal, reservations, setReservations, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const buyerName = user?.name || sessionStorage.getItem('buyerName');

  useEffect(() => {
    if (items.length === 0 || !buyerName) {
      navigate('/kiosk');
      return;
    }
  }, [items, buyerName, navigate]);

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

  const handlePayment = async () => {
    if (!buyerName) return;
    setLoading(true);

    try {
      // 1. Create transaction record in Supabase (status: pending)
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          buyer_name: buyerName,
          total_amount: getTotal(),
          status: 'pending',
          payment_method: 'midtrans'
        })
        .select()
        .single();

      if (txError) throw txError;

      // 2. Create transaction items
      const txItems = items.map(item => ({
        transaction_id: tx.id,
        product_id: item.is_digital ? null : item.id,
        quantity: item.quantity,
        price_at_time: item.price,
        seller_id: item.is_digital ? null : item.seller_id,
        metadata: item.is_digital ? {
          is_digital: true,
          target_number: item.target_number,
          product_name: item.name,
          sku: item.sku
        } : null
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(txItems);

      if (itemsError) throw itemsError;

      // 3. Call backend to get Midtrans Snap Token
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: tx.id,
          gross_amount: getTotal(),
          items: items.map(item => ({
            id: item.id,
            price: item.price,
            quantity: item.quantity,
            name: item.name
          })),
          customer_details: {
            first_name: buyerName,
            email: user?.email || 'customer@spscorner.com'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get payment token');
      }

      const { token } = await response.json();

      // 4. Trigger Midtrans Snap Popup
      window.snap.pay(token, {
        onSuccess: async function(result: any) {
          // Update transaction status to paid
          await supabase
            .from('transactions')
            .update({ status: 'paid' })
            .eq('id', tx.id);
            
          // Confirm reservations
          for (const resId of reservations) {
            await supabase.rpc('confirm_reservation', { p_reservation_id: resId });
          }

          // Trigger Email for Sariroti items
          try {
            await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: tx.id,
                buyer_name: buyerName,
                items: items,
                total_amount: getTotal()
              })
            });
          } catch (emailErr) {
            console.error('Failed to trigger email:', emailErr);
          }
          
          clearCart();
          navigate('/kiosk/success', { state: { orderId: tx.id } });
        },
        onPending: function(result: any) {
          toast.success('Menunggu pembayaran diselesaikan');
          navigate('/kiosk/history');
        },
        onError: function(result: any) {
          toast.error('Pembayaran gagal');
          setLoading(false);
        },
        onClose: function() {
          toast.error('Anda menutup popup pembayaran');
          setLoading(false);
        }
      });

    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Terjadi kesalahan saat memproses pembayaran');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500 text-[8px] sm:text-[10px] font-bold mb-4 sm:mb-6 shadow-inner dark:shadow-none border border-amber-100/50 dark:border-amber-900/30 uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4" />
            Pembayaran Aman & Terenkripsi
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white mb-1.5 sm:mb-2 tracking-tighter">Selesaikan Pembayaran</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed px-4 font-medium">
            Pilih metode pembayaran melalui Midtrans untuk menyelesaikan pesanan Anda.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden mb-6">
          <div className="bg-zinc-900 dark:bg-zinc-950 text-white p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            </div>
            
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Total Tagihan</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter relative z-10 text-white drop-shadow-md">
              {formatRupiah(getTotal())}
            </h2>
          </div>
          
          <div className="p-6 sm:p-8">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Detail Pesanan
            </h3>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Pemesan</span>
                <span className="font-black text-zinc-900 dark:text-white text-lg tracking-tighter">{buyerName}</span>
              </div>
              
              <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
              
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Jumlah Item</span>
                <span className="font-black text-zinc-900 dark:text-white text-lg tracking-tighter">
                  {items.reduce((sum, item) => sum + item.quantity, 0)} Produk
                </span>
              </div>

              {user?.nik && (
                <>
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">NIK Terdaftar</span>
                    <span className="font-black text-zinc-900 dark:text-white text-lg tracking-tighter">{user.nik}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handlePayment}
            disabled={loading}
            className="btn-clay-primary w-full h-12 sm:h-14 text-sm sm:text-base group flex items-center justify-center gap-3"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                Bayar Sekarang
              </>
            )}
          </button>

          <button
            onClick={handleBack}
            disabled={loading}
            className="w-full py-3 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-xs flex items-center justify-center gap-2 group uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform" />
            Kembali ke Keranjang
          </button>
        </div>
      </motion.div>
    </div>
  );
}
