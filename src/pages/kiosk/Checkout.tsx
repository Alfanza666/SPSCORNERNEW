import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { ShieldCheck, ArrowLeft, CreditCard, Loader2, QrCode, CheckCircle2, Phone, Star } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function Checkout() {
  const { items, getTotal, reservations, setReservations, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'summary' | 'ipaymu_direct' | 'manual_qris'>('summary');
  const [directPaymentData, setDirectPaymentData] = useState<any>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [verifyingReceipt, setVerifyingReceipt] = useState(false);
  const [qrisUrl, setQrisUrl] = useState<string>('/qris.png');
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [pointPaymentLoading, setPointPaymentLoading] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    qrisDynamic: true,
    qrisManual: true,
    vaBca: false,
    vaMandiri: false,
    redirect: true
  });
  const [guestPhone, setGuestPhone] = useState(sessionStorage.getItem('buyerPhone') || '');
  const [countdown, setCountdown] = useState<number | null>(null);
  // Ref untuk mencegah pembuatan transaksi duplikat
  const txIdRef = useRef<string | null>(null);

  const subtotal = getTotal();
  
  // Estimasi MDR untuk tampilan UI (iPaymu menggunakan Math.ceil)
  const estimatedMdr = Math.ceil(subtotal * 0.007);
  const estimatedTotal = subtotal + estimatedMdr;

  const grandTotal = subtotal; // Real base amount untuk backend & iPaymu

  const buyerName = user?.name || sessionStorage.getItem('buyerName');

  const saveGuestTransaction = (txId: string) => {
    // Always save last transaction to sessionStorage for success page access (even for guests)
    sessionStorage.setItem('lastTransactionId', txId);
    if (!user) {
      try {
        const history = JSON.parse(localStorage.getItem('guest_transactions') || '[]');
        if (!history.includes(txId)) {
          history.push(txId);
          localStorage.setItem('guest_transactions', JSON.stringify(history));
        }
      } catch (e) {
        console.error('Failed to save guest transaction', e);
      }
    }
  };

  useEffect(() => {
    if (items.length === 0 || !buyerName) {
      navigate('/kiosk');
      return;
    }

    // Fetch dynamic QRIS URL and Loyalty setting
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', [
            'qris_image_url', 
            'loyalty_enabled',
            'payment_method_qris_dynamic',
            'payment_method_qris_manual',
            'payment_method_va_bca',
            'payment_method_va_mandiri',
            'payment_method_redirect'
          ]);

        if (data) {
          const qris = data.find(d => d.key === 'qris_image_url');
          if (qris && qris.value) setQrisUrl(qris.value);
          
          const loyalty = data.find(d => d.key === 'loyalty_enabled');
          if (loyalty && loyalty.value === 'true') setLoyaltyEnabled(true);

          const getBool = (key: string, def: boolean) => {
            const found = data.find(d => d.key === key);
            return found ? found.value === 'true' : def;
          };

          setPaymentSettings({
            qrisDynamic: getBool('payment_method_qris_dynamic', true),
            qrisManual: getBool('payment_method_qris_manual', true),
            vaBca: getBool('payment_method_va_bca', false),
            vaMandiri: getBool('payment_method_va_mandiri', false),
            redirect: getBool('payment_method_redirect', true)
          });
        }
      } catch (err) {
        console.error('Failed to fetch Checkout settings:', err);
      }
    };

    fetchSettings();

    // Request push notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [items, buyerName, navigate]);

  // Countdown timer for QRIS payment (15 minutes)
  useEffect(() => {
    if (paymentStep !== 'ipaymu_direct') { setCountdown(null); return; }
    const end = Date.now() + 15 * 60 * 1000;
    setCountdown(15 * 60);
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [paymentStep]);

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
    setLoadingMessage('Menyiapkan pesanan...');

    try {
      // 1. Create transaction record via backend API
      const txData: any = {
        buyer_name: buyerName,
        buyer_id: user?.id || null,
        buyer_phone: user?.phone || guestPhone || null,
        buyer_email: user?.email || null,
        total_amount: grandTotal,
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
        let errorMessage = 'Failed to create transaction';
        try {
          const text = await createRes.text();
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData?.error || errorMessage;
          } catch (e) {
            console.error('Non-JSON error response from create:', text);
            errorMessage = `Server error (${createRes.status}): ${text.slice(0, 100)}`;
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        throw new Error(errorMessage);
      }
      const { transaction: tx } = await createRes.json();
      setTransactionId(tx.id);
      saveGuestTransaction(tx.id);
      setLoadingMessage('Menghubungkan ke gerbang pembayaran iPaymu...');

      // 2. Create IPaymu Direct Payment
      // Use real user phone if available, otherwise generate a realistic dummy phone
      const realPhone = user?.phone?.replace(/[^0-9]/g, '');
      const dummyPhone = realPhone && realPhone.length >= 10
        ? realPhone
        : ('0812' + Math.floor(10000000 + Math.random() * 90000000).toString());

      // Clean up buyerName (remove numbers, special chars, ensure min length)
      let cleanName = (user?.name || buyerName).replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleanName.length < 3 || cleanName.toLowerCase().includes('test')) {
        cleanName = user?.name || 'Pelanggan SPS Corner';
      }
      // Ensure name is at least 3 chars for iPaymu
      if (cleanName.length < 3) cleanName = "Pelanggan";
      const dummyEmail = `${cleanName.replace(/\s+/g, '').toLowerCase().substring(0, 10)}${Math.floor(Math.random() * 1000)}@gmail.com`;

      const ipaymuRes = await fetch('/api/payment/ipaymu/direct', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: tx.id,
          amount: grandTotal,
          buyer_name: cleanName,
          buyer_email: user?.email || dummyEmail,
          buyer_phone: dummyPhone,
          payment_method: method,
          payment_channel: channel
        })
      });

      if (!ipaymuRes.ok) {
        let errorMessage = 'Failed to create IPaymu direct payment';
        try {
          const text = await ipaymuRes.text();
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData?.error || errorMessage;
          } catch (e) {
            console.error('Non-JSON error response from ipaymu direct:', text);
            errorMessage = `Server error (${ipaymuRes.status}): ${text.slice(0, 100)}`;
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        throw new Error(errorMessage);
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

  const handleManualQris = async () => {
    if (!buyerName) return;
    setLoading(true);

    try {
      // 1. Create transaction record via backend API
      const txData: any = {
        buyer_name: buyerName,
        buyer_id: user?.id || null,
        buyer_email: user?.email || null,
        buyer_phone: user?.phone || guestPhone || null,  // [QA FIX] was missing buyer_phone
        total_amount: grandTotal, // Use same base amount for consistency
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

      const txRes = await fetch('/api/transactions/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(txData)
      });

      if (!txRes.ok) {
        let errorMessage = 'Failed to create transaction';
        try {
          const text = await txRes.text();
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData?.error || errorMessage;
          } catch (e) {
            console.error('Non-JSON error response from create:', text);
            errorMessage = `Server error (${txRes.status}): ${text.slice(0, 100)}`;
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        throw new Error(errorMessage);
      }

      const { transaction } = await txRes.json();
      setTransactionId(transaction.id);
      saveGuestTransaction(transaction.id);
      setPaymentStep('manual_qris');

      // 2. Confirm reservations
      for (const resId of reservations) {
        await supabase.rpc('confirm_stock_deduction', { p_reservation_id: resId });
      }

    } catch (error: any) {
      console.error('Manual QRIS error:', error);
      toast.error(error.message || 'Terjadi kesalahan saat memproses pembayaran');
    } finally {
      setLoading(false);
    }
  };

  const handlePointPayment = async () => {
    if (!buyerName || !user) return;
    
    // Check if points are sufficient locally before sending request
    const total = getTotal();
    if ((user.loyalty_points || 0) < total) {
      toast.error('Points Anda tidak mencukupi untuk pembayaran ini');
      return;
    }

    setPointPaymentLoading(true);
    setLoading(true);

    try {
      // 1. Create transaction
      const txData: any = {
        buyer_name: buyerName,
        buyer_id: user.id,
        buyer_email: user.email || null,
        total_amount: total,
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

      const txRes = await fetch('/api/transactions/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(txData)
      });

      if (!txRes.ok) {
        let errorMessage = 'Failed to create transaction';
        try {
          const text = await txRes.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData?.error || errorMessage;
        } catch (e) {
           errorMessage = 'Server error on transaction creation';
        }
        throw new Error(errorMessage);
      }

      const { transaction } = await txRes.json();
      setTransactionId(transaction.id);

      // Confirm reservations
      for (const resId of reservations) {
        await supabase.rpc('confirm_stock_deduction', { p_reservation_id: resId });
      }

      // 2. Pay using points
      const payRes = await fetch('/api/payment/points/pay', {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: transaction.id })
      });

      if (!payRes.ok) {
        let errorMessage = 'Gagal memproses pembayaran point';
        try {
          const text = await payRes.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData?.error || errorMessage;
        } catch (e) {
          // ignore
        }
        throw new Error(errorMessage);
      }

      toast.success('Berhasil membayar dengan Points!');
      clearCart();
      setReservations([]);
      navigate('/kiosk/success', { state: { transactionId: transaction.id } });

    } catch (error: any) {
      console.error('Point Payment error:', error);
      toast.error(error.message || 'Terjadi kesalahan saat memproses pembayaran');
    } finally {
      setLoading(false);
      setPointPaymentLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const verifyReceipt = async () => {
    if (!receiptImage || !transactionId) return;
    setVerifyingReceipt(true);

    try {
      const response = await fetch('/api/payment/manual/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          receipt_image: receiptImage,
          expected_amount: grandTotal  // [QA FIX] was getTotal(), should match what user actually paid
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memverifikasi bukti pembayaran');
      }

      if (data.success) {
        toast.success('Pembayaran berhasil diverifikasi!');
        clearCart();
        setReservations([]);
        sessionStorage.removeItem('buyerName');
        navigate('/kiosk/success', { state: { transactionId } });
      } else {
        toast.error(data.error || 'Bukti pembayaran tidak valid atau nominal tidak sesuai');
      }
    } catch (error: any) {
      console.error('Verify receipt error:', error);
      toast.error(error.message || 'Terjadi kesalahan saat memverifikasi bukti pembayaran');
    } finally {
      setVerifyingReceipt(false);
    }
  };

  const handlePayment = async () => {
    if (!buyerName) return;
    setLoading(true);

    try {
      let tx: any = null;

      // Build auth headers once — dipakai di semua fetch di bawah
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      if (!txIdRef.current) {
        // 1. Create transaction record via backend API to bypass RLS
        const txData: any = {
          buyer_name: buyerName,
          buyer_id: user?.id || null,
          buyer_email: user?.email || null,
          total_amount: grandTotal,
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

        const createRes = await fetch('/api/transactions/create', {
          method: 'POST',
          headers,
          body: JSON.stringify(txData)
        });

        if (!createRes.ok) {
          let errorMessage = 'Failed to create transaction';
          try {
            const text = await createRes.text();
            try {
              const errorData = JSON.parse(text);
              errorMessage = errorData?.error || errorMessage;
            } catch (e) {
              console.error('Non-JSON error response from create:', text);
              errorMessage = `Server error (${createRes.status}): ${text.slice(0, 100)}`;
            }
          } catch (e) {
            console.error('Failed to read error response:', e);
          }
          throw new Error(errorMessage);
        }

        const createData = await createRes.json();
        tx = createData.transaction;
        setTransactionId(tx.id);
        saveGuestTransaction(tx.id);
        txIdRef.current = tx.id;
      } else {
        tx = { id: txIdRef.current };
      }

      // Use real user phone if available, otherwise use guest-entered phone
      const realPhone = user?.phone?.replace(/[^0-9]/g, '') || guestPhone.replace(/[^0-9]/g, '');
      // Generate unique dummy phone using timestamp + random to avoid conflicts
      const randomSuffix = Math.floor(Date.now() % 90000000) + 1000000;
      const dummyPhone = realPhone && realPhone.length >= 9
        ? realPhone
        : ('0812' + randomSuffix.toString());

      // Clean up buyerName (remove numbers, special chars, ensure min length)
      let cleanName = (user?.name || buyerName).replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleanName.length < 3 || cleanName.toLowerCase().includes('test')) {
        cleanName = user?.name || 'Pelanggan SPS Corner';
      }
      // Ensure name is at least 3 chars for iPaymu
      if (cleanName.length < 3) cleanName = "Pelanggan";
      const dummyEmail = `${cleanName.replace(/\s+/g, '').toLowerCase().substring(0, 10)}${Math.floor(Math.random() * 1000)}@gmail.com`;

      // 2. Create IPaymu Payment
      const ipaymuRes = await fetch('/api/payment/ipaymu/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: tx.id,
          amount: getTotal(),
          buyer_name: cleanName,
          buyer_email: user?.email || dummyEmail,
          buyer_phone: dummyPhone,
          items: items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          }))
        })
      });

      if (!ipaymuRes.ok) {
        let errorMessage = 'Failed to create IPaymu payment';
        try {
          const text = await ipaymuRes.text();
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData?.error || errorMessage;
          } catch (e) {
            console.error('Non-JSON error response from ipaymu:', text);
            errorMessage = `Server error (${ipaymuRes.status}): ${text.slice(0, 100)}`;
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        throw new Error(errorMessage);
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
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-zinc-400 dark:text-zinc-600 mb-4 sm:mb-6 uppercase tracking-widest justify-center">
        <span className="cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors" onClick={() => navigate('/kiosk')}>Menu</span>
        <span className="opacity-50">/</span>
        <span className="cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors" onClick={() => navigate('/kiosk/cart')}>Keranjang</span>
        <span className="opacity-50">/</span>
        <span className="text-blue-600 dark:text-blue-400">Pembayaran</span>
      </div>
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
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden mb-6 tour-checkout-methods">
              <div className="bg-zinc-900 dark:bg-zinc-950 text-white p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                </div>

                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Total Tagihan</p>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tighter relative z-10 text-white drop-shadow-md">
                  {formatRupiah(estimatedTotal)}
                </h2>
                <p className="text-zinc-500 text-[10px] font-medium relative z-10 mt-1">
                  Subtotal {formatRupiah(subtotal)} + Biaya Layanan {formatRupiah(estimatedMdr)}
                </p>
              </div>

              <div className="p-6 sm:p-8">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Pilih Metode Pembayaran
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Loyalty Points Option */}
                  {user && loyaltyEnabled && (
                    <button
                      onClick={handlePointPayment}
                      disabled={loading || pointPaymentLoading || (user.loyalty_points || 0) < getTotal()}
                      className="flex items-center gap-4 p-4 rounded-xl border border-amber-200 dark:border-amber-900 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-900/10 hover:border-amber-300 dark:hover:border-amber-700 transition-all text-left group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed md:col-span-2 sm:col-span-1"
                    >
                      <div className="w-12 h-12 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-amber-100 dark:border-zinc-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                      </div>
                      <div>
                        <p className="font-black text-amber-900 dark:text-amber-100 text-sm tracking-tight flex items-center gap-2">
                           Bayar Penuh via Points
                           {(user.loyalty_points || 0) < getTotal() && <span className="text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">Kurang</span>}
                        </p>
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                          Saldo Anda: <strong className="font-black text-amber-900 dark:text-amber-200">{user.loyalty_points || 0} Pts</strong>
                        </p>
                      </div>
                      <div className="absolute right-0 top-0 w-16 h-16 bg-gradient-to-br from-amber-400/20 to-transparent rounded-bl-full pointer-events-none" />
                    </button>
                  )}

                  {/* QRIS (Otomatis) Option */}
                  {paymentSettings.qrisDynamic && (
                    <button
                      onClick={() => {
                        if (!user && !guestPhone) {
                          toast.error('Silakan isi nomor HP untuk dihubungi jika ada kendala');
                          return;
                        }
                        handleDirectPayment('qris', 'qris');
                      }}
                      disabled={loading}
                      className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                        <QrCode className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-zinc-900 dark:text-white text-sm tracking-tight">QRIS (Otomatis)</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Gopay, OVO, Dana, LinkAja</p>
                      </div>
                    </button>
                  )}

                  {/* VA BCA Option */}
                  {paymentSettings.vaBca && (
                    <button
                      onClick={() => {
                        if (!user && !guestPhone) {
                          toast.error('Silakan isi nomor HP untuk dihubungi jika ada kendala');
                          return;
                        }
                        handleDirectPayment('va', 'bca');
                      }}
                      disabled={loading}
                      className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                        <CreditCard className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-black text-zinc-900 dark:text-white text-sm tracking-tight">Virtual Account BCA</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Transfer via M-Banking BCA</p>
                      </div>
                    </button>
                  )}

                  {/* VA Mandiri Option */}
                  {paymentSettings.vaMandiri && (
                    <button
                      onClick={() => {
                        if (!user && !guestPhone) {
                          toast.error('Silakan isi nomor HP untuk dihubungi jika ada kendala');
                          return;
                        }
                        handleDirectPayment('va', 'mandiri');
                      }}
                      disabled={loading}
                      className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                        <CreditCard className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-black text-zinc-900 dark:text-white text-sm tracking-tight">Virtual Account Mandiri</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Transfer via Livin' Mandiri</p>
                      </div>
                    </button>
                  )}

                  {/* Manual QRIS Option */}
                  {paymentSettings.qrisManual && (
                    <button
                      onClick={() => {
                        if (!user && !guestPhone) {
                          toast.error('Silakan isi nomor HP untuk dihubungi jika ada kendala');
                          return;
                        }
                        handleManualQris();
                      }}
                      disabled={loading}
                      className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group relative overflow-hidden"
                    >
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                        <QrCode className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-black text-zinc-900 dark:text-white text-sm tracking-tight">QRIS (Manual)</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Upload Bukti Bayar</p>
                      </div>
                    </button>
                  )}
                </div>

                {paymentSettings.redirect && (
                  <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (!user && !guestPhone) {
                            toast.error('Silakan isi nomor HP untuk dihubungi jika ada kendala');
                            return;
                          }
                          handlePayment();
                        }}
                        disabled={loading}
                        className="btn-clay-secondary w-full h-12 sm:h-14 text-sm sm:text-base group flex items-center justify-center gap-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center shadow-inner">
                          <ShieldCheck className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                        </div>
                        Metode Pembayaran Lainnya
                      </button>
                    </div>
                  </div>
                )}
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
        ) : paymentStep === 'manual_qris' ? (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden p-6 sm:p-8 text-center">
              <div className="max-w-[280px] mx-auto mb-6">
                <img src={qrisUrl} alt="QRIS Manual" className="w-full aspect-square object-contain rounded-xl shadow-md" />
              </div>

              <div className="space-y-2 mb-8">
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Total Bayar</p>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
                  {formatRupiah(estimatedTotal)}
                </h2>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 text-left mb-6">
                <h4 className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-2">Instruksi:</h4>
                <ol className="text-xs text-blue-600 dark:text-blue-300 space-y-1.5 list-decimal pl-4 font-medium">
                  <li>Scan kode QR di atas menggunakan aplikasi pembayaran Anda</li>
                  <li>Masukkan nominal <strong>{formatRupiah(estimatedTotal)}</strong></li>
                  <li>Selesaikan pembayaran</li>
                  <li>Screenshot bukti pembayaran dan upload di bawah ini</li>
                </ol>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <label
                    htmlFor="receipt-upload"
                    className="btn-clay-secondary w-full h-12 sm:h-14 text-sm sm:text-base group flex items-center justify-center gap-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white cursor-pointer"
                  >
                    {receiptImage ? 'Ganti Bukti Pembayaran' : 'Upload Bukti Pembayaran'}
                  </label>
                </div>

                {receiptImage && (
                  <div className="mt-4">
                    <img src={receiptImage} alt="Bukti Pembayaran" className="max-h-48 mx-auto rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={verifyReceipt}
                disabled={!receiptImage || verifyingReceipt}
                className="btn-clay-primary w-full h-12 sm:h-14 text-sm sm:text-base group flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyingReceipt ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Verifikasi Pembayaran
                  </>
                )}
              </button>

              <button
                onClick={() => setPaymentStep('summary')}
                disabled={verifyingReceipt}
                className="w-full py-3 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-xs flex items-center justify-center gap-2 group uppercase tracking-widest"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform" />
                Ganti Metode Pembayaran
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden p-6 sm:p-8 text-center">
              {/* Countdown Timer */}
              {countdown !== null && (
                <div className={`mb-5 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black ${
                  countdown < 60 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800'
                    : countdown < 300
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800'
                }`}>
                  <Phone className="w-4 h-4" />
                  Batas waktu bayar: {String(Math.floor(countdown / 60)).padStart(2,'0')}:{String(countdown % 60).padStart(2,'0')}
                  {countdown === 0 && <span className="ml-2 font-normal text-xs">— Waktu habis, buat pesanan baru</span>}
                </div>
              )}

              {/* QRIS code display only */}

              {(() => {
                const qrString = directPaymentData?.QrString || (directPaymentData?.PaymentNo?.startsWith('00') ? directPaymentData.PaymentNo : null);
                const vaNumber = directPaymentData?.VaNumber || (!directPaymentData?.PaymentNo?.startsWith('00') ? directPaymentData?.PaymentNo : null);
                const qrImage = directPaymentData?.QrImage;
                const qrTemplate = directPaymentData?.QrTemplate;

                if (qrString) {
                  return (
                    <div className="max-w-[280px] mx-auto mb-6">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`} alt="QRIS" className="w-full aspect-square object-contain rounded-xl shadow-md" />
                      {qrTemplate && (
                        <a href={qrTemplate} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-2 block font-bold uppercase tracking-widest">
                          Buka QRIS di Tab Baru
                        </a>
                      )}
                    </div>
                  );
                }

                if (qrImage) {
                  return (
                    <div className="max-w-[280px] mx-auto mb-6">
                      <img src={qrImage} alt="QRIS" className="w-full aspect-square object-contain rounded-xl shadow-md" />
                    </div>
                  );
                }

                if (vaNumber) {
                  return (
                    <div className="mb-8 p-8 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">Nomor Virtual Account</p>
                      <h2 className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 tracking-widest mb-4">
                        {vaNumber}
                      </h2>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(vaNumber);
                          toast.success('Nomor VA berhasil disalin');
                        }}
                        className="text-[10px] font-bold text-zinc-500 hover:text-blue-600 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
                      >
                        Salin Nomor VA
                      </button>
                    </div>
                  );
                }
                
                if (qrTemplate) {
                  return (
                    <div className="max-w-[280px] mx-auto mb-6 text-center">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 font-medium">Sistem iPaymu mengharuskan Anda membuka halaman khusus untuk melihat QRIS ini.</p>
                      <a href={qrTemplate} target="_blank" rel="noreferrer" className="btn-clay-primary inline-flex h-12 px-6 items-center justify-center gap-2 text-sm">
                        <QrCode className="w-4 h-4" />
                        Tampilkan Kode QRIS
                      </a>
                    </div>
                  );
                }

                return null;
              })()}

              <div className="space-y-2 mb-8">
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Total Bayar</p>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
                  {formatRupiah(estimatedTotal)}
                </h2>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 text-left tour-payment-instructions">
                <h4 className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-2">Instruksi:</h4>
                <ol className="text-xs text-blue-600 dark:text-blue-300 space-y-1.5 list-decimal pl-4 font-medium">
                  {(() => {
                    const isQris = directPaymentData?.QrString || directPaymentData?.PaymentNo?.startsWith('00') || directPaymentData?.QrImage || directPaymentData?.QrTemplate;
                    if (isQris) {
                      return (
                        <>
                          <li>Buka aplikasi pembayaran Anda (Gopay, OVO, Dana, M-Banking, dll)</li>
                          <li>Scan kode QR di atas</li>
                          <li>Pastikan nominal sesuai dengan total tagihan</li>
                          <li>Pembayaran akan terkonfirmasi otomatis setelah berhasil</li>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <li>Buka aplikasi M-Banking atau ATM Anda</li>
                          <li>Pilih menu Transfer / Virtual Account</li>
                          <li>Masukkan nomor VA di atas</li>
                          <li>Pastikan nominal sesuai dengan total tagihan</li>
                          <li>Pembayaran akan terkonfirmasi otomatis setelah berhasil</li>
                        </>
                      );
                    }
                  })()}
                </ol>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => {
                  clearCart();
                  sessionStorage.removeItem('buyerName');
                  navigate('/kiosk/success', { state: { transactionId } });
                }}
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

      {loading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="clay-card p-8 max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 border-4 border-blue-100 dark:border-blue-900/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Memproses Pembayaran</h3>
              <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm leading-relaxed">
                {loadingMessage || 'Mohon tunggu sebentar, kami sedang memproses permintaan Anda...'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
