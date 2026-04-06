import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { ShieldCheck, ArrowLeft, CreditCard, Loader2, QrCode, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function Checkout() {
  const { items, getTotal, reservations, setReservations, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'summary' | 'ipaymu_direct'>('summary');
  const [directPaymentData, setDirectPaymentData] = useState<any>(null);

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

  const handleDirectPayment = async (method: string, channel: string) => {
    if (!buyerName) return;
    setLoading(true);

    try {
      // 1. Create transaction record via backend API
      const txData: any = {
        buyer_name: buyerName,
        buyer_id: user?.id || null,
        total_amount: getTotal(),
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          is_digital: item.is_digital,
          sku: item.sku,
          target_number: item.target_number,
          seller_id: item.seller_id,
          metadata: item.metadata
        }))
      };
      
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const createRes = await fetch('/api/transactions/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(txData)
      });

      if (!createRes.ok) throw new Error('Failed to create transaction');
      const { transaction: tx } = await createRes.json();
      setTransactionId(tx.id);

      // 2. Create IPaymu Direct Payment
      const ipaymuRes = await fetch('/api/payment/ipaymu/direct', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: tx.id,
          amount: getTotal(),
          buyer_name: buyerName,
          buyer_email: user?.email || 'customer@example.com',
          buyer_phone: '08123456789',
          payment_method: method,
          payment_channel: channel
        })
      });

      if (!ipaymuRes.ok) {
        const errorData = await ipaymuRes.json();
        throw new Error(errorData?.error || 'Failed to create IPaymu direct payment');
      }

      const { data } = await ipaymuRes.json();
      setDirectPaymentData(data);
      setPaymentStep('ipaymu_direct');

      // 3. Confirm reservations
      for (const resId of reservations) {
        await supabase.rpc('confirm_stock_deduction', { p_reservation_id: resId });
      }

    } catch (error: any) {
      console.error('Direct Payment error:', error);
      toast.error(error.message || 'Terjadi kesalahan saat memproses pembayaran');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!buyerName) return;
    setLoading(true);

    try {
      // 1. Create transaction record via backend API to bypass RLS
      const txData: any = {
        buyer_name: buyerName,
        buyer_id: user?.id || null,
        total_amount: getTotal(),
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          is_digital: item.is_digital,
          sku: item.sku,
          target_number: item.target_number,
          seller_id: item.seller_id,
          metadata: item.metadata
        }))
      };
      
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const createRes = await fetch('/api/transactions/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(txData)
      });

      if (!createRes.ok) {
        const errorData = await createRes.json();
        throw new Error(errorData?.error || 'Failed to create transaction');
      }

      const { transaction: tx } = await createRes.json();
      setTransactionId(tx.id);

      // 2. Create IPaymu Payment
      const ipaymuRes = await fetch('/api/payment/ipaymu/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: tx.id,
          amount: getTotal(),
          buyer_name: buyerName,
          buyer_email: user?.email || 'customer@example.com',
          buyer_phone: '08123456789',
          items: items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          }))
        })
      });

      if (!ipaymuRes.ok) {
        const errorData = await ipaymuRes.json();
        throw new Error(errorData?.error || 'Failed to create IPaymu payment');
      }

      const { payment_url } = await ipaymuRes.json();

      // 3. Confirm reservations before redirecting
      for (const resId of reservations) {
        await supabase.rpc('confirm_stock_deduction', { p_reservation_id: resId });
      }

      // 4. Redirect to IPaymu
      window.location.href = payment_url;
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
          <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white mb-1.5 sm:mb-2 tracking-tighter">
            {paymentStep === 'summary' ? 'Selesaikan Pembayaran' : 'Selesaikan Pembayaran Anda'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed px-4 font-medium">
            {paymentStep === 'summary' 
              ? 'Pilih metode pembayaran yang Anda inginkan untuk menyelesaikan pesanan.' 
              : 'Gunakan detail di bawah ini untuk menyelesaikan pembayaran Anda.'}
          </p>
        </div>

        {paymentStep === 'summary' ? (
          <>
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
                   Pilih Metode Pembayaran
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* QRIS Option */}
                  <button
                    onClick={() => handleDirectPayment('qris', 'linkaja')}
                    disabled={loading}
                    className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                      <QrCode className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-black text-zinc-900 dark:text-white text-sm tracking-tight">QRIS (Otomatis)</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Gopay, OVO, Dana, LinkAja</p>
                    </div>
                  </button>

                  {/* VA BCA Option */}
                  <button
                    onClick={() => handleDirectPayment('va', 'bca')}
                    disabled={loading}
                    className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                      <CreditCard className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-black text-zinc-900 dark:text-white text-sm tracking-tight">Virtual Account BCA</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Transfer via M-Banking BCA</p>
                    </div>
                  </button>

                  {/* VA Mandiri Option */}
                  <button
                    onClick={() => handleDirectPayment('va', 'mandiri')}
                    disabled={loading}
                    className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                      <CreditCard className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-black text-zinc-900 dark:text-white text-sm tracking-tight">Virtual Account Mandiri</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Transfer via Livin' Mandiri</p>
                    </div>
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="relative">
                    <button
                      onClick={handlePayment}
                      disabled={loading}
                      className="btn-clay-secondary w-full h-12 sm:h-14 text-sm sm:text-base group flex items-center justify-center gap-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      Metode Lainnya (Redirect iPaymu)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleBack}
              disabled={loading}
              className="w-full py-3 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-xs flex items-center justify-center gap-2 group uppercase tracking-widest"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform" />
              Kembali ke Keranjang
            </button>
          </>
        ) : (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden p-6 sm:p-8 text-center">
              {directPaymentData?.QrImage ? (
                <div className="max-w-[280px] mx-auto mb-6">
                  <img src={directPaymentData.QrImage} alt="QRIS" className="w-full aspect-square object-contain rounded-xl shadow-md" />
                </div>
              ) : directPaymentData?.VaNumber ? (
                <div className="mb-8 p-8 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">Nomor Virtual Account</p>
                  <h2 className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 tracking-widest mb-4">
                    {directPaymentData.VaNumber}
                  </h2>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(directPaymentData.VaNumber);
                      toast.success('Nomor VA berhasil disalin');
                    }}
                    className="text-[10px] font-bold text-zinc-500 hover:text-blue-600 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
                  >
                    Salin Nomor VA
                  </button>
                </div>
              ) : null}
              
              <div className="space-y-2 mb-8">
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Total Bayar</p>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
                  {formatRupiah(getTotal())}
                </h2>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 text-left">
                <h4 className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-2">Instruksi:</h4>
                <ol className="text-xs text-blue-600 dark:text-blue-300 space-y-1.5 list-decimal pl-4 font-medium">
                  {directPaymentData?.QrImage ? (
                    <>
                      <li>Buka aplikasi pembayaran Anda (Gopay, OVO, Dana, M-Banking, dll)</li>
                      <li>Scan kode QR di atas</li>
                      <li>Pastikan nominal sesuai dengan total tagihan</li>
                      <li>Pembayaran akan terkonfirmasi otomatis setelah berhasil</li>
                    </>
                  ) : (
                    <>
                      <li>Buka aplikasi M-Banking atau ATM Anda</li>
                      <li>Pilih menu Transfer / Virtual Account</li>
                      <li>Masukkan nomor VA di atas</li>
                      <li>Pastikan nominal sesuai dengan total tagihan</li>
                      <li>Pembayaran akan terkonfirmasi otomatis setelah berhasil</li>
                    </>
                  )}
                </ol>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate('/kiosk/history')}
                className="btn-clay-primary w-full h-12 sm:h-14 text-sm sm:text-base group flex items-center justify-center gap-3"
              >
                <CheckCircle2 className="w-5 h-5" />
                Cek Status Pembayaran
              </button>

              <button
                onClick={() => setPaymentStep('summary')}
                disabled={loading}
                className="w-full py-3 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-xs flex items-center justify-center gap-2 group uppercase tracking-widest"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform" />
                Ganti Metode Pembayaran
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
