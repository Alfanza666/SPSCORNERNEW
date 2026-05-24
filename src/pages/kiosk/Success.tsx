import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle2, ShoppingBag, Printer, ArrowRight, Star, Clock, Mail,
  ChevronDown, Copy, ExternalLink, Store, MapPin,
  CreditCard, Smartphone, Wallet, ShieldCheck
} from 'lucide-react';
import { motion, useMotionValue, animate, useDragControls } from 'motion/react';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useCartStore } from '../../store/useCartStore';
import { formatRupiah } from '../../lib/utils';
import toast from 'react-hot-toast';

const SHEET_HEIGHT = window.innerHeight * 0.78;
const COLLAPSED_VISIBLE = 140;
const COLLAPSED_Y = SHEET_HEIGHT - COLLAPSED_VISIBLE;
const EXPANDED_Y = 0;

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  qris: { label: 'QRIS (Otomatis)', icon: Smartphone },
  manual_qris: { label: 'QRIS (Manual)', icon: Smartphone },
  va_bca: { label: 'Virtual Account BCA', icon: CreditCard },
  va_mandiri: { label: 'Virtual Account Mandiri', icon: CreditCard },
  redirect: { label: 'Transfer Bank / E-Wallet', icon: Wallet },
  points: { label: 'Poin Loyalitas', icon: Star },
};

function isDigitalPayment(transaction: any) {
  return transaction?.transaction_items?.some((item: any) => item.metadata?.is_digital);
}

export default function Success() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { clearCart } = useCartStore();
  const [currentTime] = useState(new Date());
  const [transaction, setTransaction] = useState<any>(null);
  const queryParams = new URLSearchParams(location.search);
  const transactionId = location.state?.transactionId
    || queryParams.get('id')
    || sessionStorage.getItem('lastTransactionId');

  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const scrolledRef = useRef(false);

  useEffect(() => {
    let pollTimeout: number | undefined;

    const fetchTransaction = async () => {
      try {
        const response = await fetch(`/api/transactions/${transactionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch transaction');
        }
        const data = await response.json();

        if (data && data.transaction) {
          setTransaction(data.transaction);

          const processingItems = data.transaction.transaction_items?.filter(
            (item: any) => item.metadata?.is_digital && item.metadata?.status === 'processing'
          );

          if (processingItems && processingItems.length > 0) {
            pollTimeout = setTimeout(fetchTransaction, 3000) as any;
          }
        }
      } catch (error) {
        console.error('Error fetching transaction:', error);
      }
    };

    if (transactionId) {
      fetchTransaction();
    }

    return () => {
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [transactionId]);

  useEffect(() => {
    const duration = 4 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    clearCart();
    sessionStorage.removeItem('buyerName');
    sessionStorage.removeItem('buyerPhone');
  }, [clearCart]);

  const handleDragEnd = useCallback((_: any, info: { offset: { y: number }; velocity: { y: number } }) => {
    const threshold = COLLAPSED_Y * 0.35;

    if (info.offset.y < -threshold || info.velocity.y < -300) {
      setExpanded(true);
    } else if (info.offset.y > threshold || info.velocity.y > 300) {
      setExpanded(false);
    }
  }, []);

  const toggleSheet = () => {
    setExpanded((prev) => !prev);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmailSalesAdmin = () => {
    if (!transaction) return;
    const sarirotiItems = transaction.transaction_items.filter((item: any) =>
      item.products?.category?.toLowerCase() === 'sariroti'
      || item.products?.name?.toLowerCase().includes('sariroti')
    );

    if (sarirotiItems.length === 0) return;

    const subject = encodeURIComponent(`Pesanan Baru Sariroti - ID #${transaction.id.slice(0, 8)}`);
    const body = encodeURIComponent(`Halo Sales Admin Sariroti,

Berikut adalah detail pesanan baru dari Koperasi Karyawan (SPS Corner):

ID Pesanan: #${transaction.id.slice(0, 8)}
Tanggal: ${new Date(transaction.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
Nama Pemesan: ${user?.name || 'Karyawan'}

Detail Pesanan:
${sarirotiItems.map((item: any) => `- ${item.products?.name || item.metadata?.product_name || 'Produk Koperasi'} (Qty: ${item.quantity})`).join('\n')}

Mohon diproses untuk pengambilan besok.

Terima kasih,
Sistem SPS Corner`);

    window.location.href = `mailto:Sales.Admin.bjm@sariroti.com?subject=${subject}&body=${body}`;
  };

  const handlePrintNota = () => {
    if (!transaction) return;
    const sarirotiItems = transaction.transaction_items.filter((item: any) =>
      item.products?.category?.toLowerCase() === 'sariroti'
      || item.products?.name?.toLowerCase().includes('sariroti')
    );

    if (sarirotiItems.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Mohon izinkan pop-up untuk mencetak nota.');
      return;
    }

    const html = `
      <html>
        <head>
          <title>Delivery Note - Sariroti</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 400px; margin: 0 auto; color: #000; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .sub-logo { font-size: 14px; margin-bottom: 10px; }
            .info { font-size: 12px; margin-bottom: 15px; }
            .info div { margin-bottom: 3px; }
            table { w-full; border-collapse: collapse; font-size: 12px; width: 100%; }
            th { border-bottom: 1px solid #000; text-align: left; padding: 5px 0; }
            td { padding: 5px 0; }
            .qty { text-align: center; }
            .footer { text-align: center; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; font-size: 12px; }
            @media print {
              body { padding: 0; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">KOPERASI KARYAWAN</div>
            <div class="sub-logo">SPS CORNER</div>
            <div>DELIVERY NOTE - SARIROTI</div>
          </div>
          <div class="info">
            <div><strong>ID Pesanan:</strong> #${transaction.id.slice(0, 8)}</div>
            <div><strong>Tanggal:</strong> ${new Date(transaction.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Nama Pemesan:</strong> ${user?.name || 'Karyawan'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th class="qty">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${sarirotiItems.map((item: any) => `
                <tr>
                  <td>${item.products?.name || item.metadata?.product_name || 'Produk Koperasi'}</td>
                  <td class="qty">${item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Nota ini merupakan bukti sah untuk pengambilan produk Sariroti di bagian Distribusi.</p>
            <p>Terima Kasih</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const copyReference = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('No. Referensi disalin!');
    }).catch(() => {
      toast.error('Gagal menyalin');
    });
  };

  const hasSariroti = transaction?.transaction_items?.some((item: any) =>
    item.products?.category?.toLowerCase() === 'sariroti'
    || item.products?.name?.toLowerCase().includes('sariroti')
  );

  const digitalItems = transaction?.transaction_items?.filter((item: any) => item.metadata?.is_digital);
  const isDigital = isDigitalPayment(transaction);
  const isPending = transaction?.status === 'pending';
  const paymentInfo = transaction?.payment_method
    ? PAYMENT_METHOD_LABELS[transaction.payment_method] || { label: transaction.payment_method, icon: CreditCard }
    : null;
  const PaymentIcon = paymentInfo?.icon || CreditCard;

  return (
    <div className="h-dvh w-full overflow-hidden relative bg-zinc-50 dark:bg-zinc-950 select-none">
      {/* ===== BACKGROUND SUCCESS SECTION ===== */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center px-6 ${
        isPending
          ? 'bg-gradient-to-b from-amber-400 to-amber-600'
          : isDigital
            ? 'bg-gradient-to-b from-violet-500 via-emerald-500 to-emerald-600'
            : 'bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600'
      }`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl mb-5 ${
            isPending
              ? 'bg-amber-100/30 text-amber-50'
              : 'bg-white/25 text-white'
          }`}
        >
          {isPending ? (
            <Clock className="w-10 h-10" />
          ) : (
            <CheckCircle2 className="w-10 h-10" />
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-white text-center mb-1.5"
        >
          {isPending ? 'Pembayaran Diverifikasi' : 'Pembayaran Berhasil!'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="text-white/80 text-sm text-center mb-6"
        >
          {isPending
            ? 'Pesanan Anda sedang kami proses'
            : 'Terima kasih, pesanan Anda telah diterima'
          }
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-white/60 text-xs font-medium mb-3"
        >
          {format(currentTime, 'dd MMM yyyy, HH:mm', { locale: id })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 150 }}
          className="text-white text-4xl font-black tracking-tight mb-8"
        >
          {transaction ? formatRupiah(transaction.total_amount) : '-'}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="relative"
        >
          <ShoppingBag className="w-24 h-24 text-white/15" strokeWidth={1} />
        </motion.div>
      </div>

      {/* ===== DRAGGABLE BOTTOM SHEET ===== */}
      <motion.div
        drag="y"
        dragControls={dragControls}
        dragConstraints={{ top: EXPANDED_Y, bottom: COLLAPSED_Y }}
        dragElastic={{ top: 0.05, bottom: 0.1 }}
        onDragEnd={handleDragEnd}
        initial={false}
        animate={{ y: expanded ? EXPANDED_Y : COLLAPSED_Y }}
        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
        style={{ height: SHEET_HEIGHT }}
        className="absolute bottom-0 left-0 right-0 z-20"
      >
        <div className="bg-white dark:bg-zinc-900 rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_40px_rgba(0,0,0,0.4)] h-full flex flex-col">
          {/* Drag Handle */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="pt-3 pb-1 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          >
            <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <button
              onClick={toggleSheet}
              className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Collapsed Summary */}
          {!expanded && (
            <div className="px-5 py-3 flex items-center gap-4 shrink-0">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 dark:text-white text-sm truncate">
                  SPS Corner
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">Kantin Koperasi Karyawan</span>
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-zinc-900 dark:text-white text-base">
                  {transaction ? formatRupiah(transaction.total_amount) : '-'}
                </p>
                <p className={`text-[10px] font-medium ${isPending ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isPending ? 'Menunggu' : 'Lunas'}
                </p>
              </div>
            </div>
          )}

          {/* Expanded Content */}
          <div
            ref={contentRef}
            className={`flex-1 overflow-y-auto px-5 pb-6 ${expanded ? '' : 'hidden'}`}
          >
            {/* Merchant Info */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Store className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-zinc-900 dark:text-white">SPS Corner</p>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  Kantin Koperasi Karyawan
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-bold ${isPending ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isPending ? 'Menunggu' : 'Lunas'}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-100 dark:bg-zinc-800 mb-5" />

            {/* Item List */}
            <p className="text-xs font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider">
              Detail Pesanan
            </p>
            <div className="space-y-3 mb-5">
              {transaction?.transaction_items && transaction.transaction_items.slice(0, 10).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {item.products?.name || item.metadata?.product_name || 'Produk'}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {item.quantity} x {item.price ? formatRupiah(item.price) : '-'}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white shrink-0">
                    {item.price ? formatRupiah(item.price * item.quantity) : '-'}
                  </p>
                </div>
              ))}
              {(transaction?.transaction_items?.length || 0) > 10 && (
                <p className="text-xs text-zinc-500 font-medium">
                  + {(transaction?.transaction_items?.length || 0) - 10} produk lainnya
                </p>
              )}
            </div>

            {/* Total */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 mb-5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Pembayaran</span>
                <span className="text-lg font-black text-zinc-900 dark:text-white">
                  {transaction ? formatRupiah(transaction.total_amount) : '-'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {format(currentTime, 'dd MMM yyyy, HH:mm', { locale: id })}
              </p>
            </div>

            {/* Payment Method */}
            <p className="text-xs font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider">
              Metode Pembayaran
            </p>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center">
                <PaymentIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">
                  {paymentInfo?.label || '—'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Pembayaran {isPending ? 'diverifikasi' : 'berhasil'}
                </p>
              </div>
            </div>

            {/* Reference Number */}
            <p className="text-xs font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider">
              No. Referensi
            </p>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-mono font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {transaction ? `#${transaction.id.slice(0, 12).toUpperCase()}` : '—'}
                </span>
              </div>
              {transaction && (
                <button
                  onClick={() => copyReference(`#${transaction.id.slice(0, 12).toUpperCase()}`)}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors shrink-0 ml-2"
                >
                  <Copy className="w-4 h-4 text-zinc-500" />
                </button>
              )}
            </div>

            {/* Digital Items Section */}
            {digitalItems && digitalItems.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider">
                  Status Produk Digital
                </p>
                <div className="space-y-3">
                  {digitalItems.map((item: any, idx: number) => {
                    const productName = item.products?.name || item.metadata?.product_name || 'Produk Digital';
                    const isProcessing = item.metadata?.status === 'processing';
                    const isFailed = item.metadata?.status === 'failed';

                    return (
                      <div key={idx} className={`p-4 rounded-2xl border ${
                        isProcessing ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30' :
                        isFailed ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30' :
                        'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/30'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold ${
                            isProcessing ? 'text-amber-700 dark:text-amber-400' :
                            isFailed ? 'text-red-700 dark:text-red-400' :
                            'text-emerald-700 dark:text-emerald-400'
                          }`}>{productName}</span>
                          <span className="text-[10px] font-mono text-zinc-500">{item.metadata?.target_number}</span>
                        </div>

                        {isProcessing ? (
                          <div className="flex items-center justify-center py-3 gap-2 text-amber-600 dark:text-amber-400">
                            <Clock className="w-4 h-4 animate-spin" />
                            <span className="text-xs font-bold tracking-widest uppercase animate-pulse">Sedang Diproses...</span>
                          </div>
                        ) : isFailed ? (
                          <div className="py-2">
                            <p className="text-xs text-red-600 font-medium">{item.metadata?.digiflazz_message || item.metadata?.digiflazz_error || 'Transaksi gagal diproses sistem.'}</p>
                          </div>
                        ) : (
                          <>
                            {(item.metadata?.sn || item.metadata?.digiflazz_response?.sn || item.metadata?.data?.sn) && (
                              <div className="bg-white dark:bg-zinc-800 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                                <p className="text-[9px] text-zinc-400 uppercase font-bold mb-1">SN / Token / Ref</p>
                                <p className="text-sm font-mono font-black text-zinc-900 dark:text-white tracking-widest break-all select-all">
                                  {item.metadata?.sn || item.metadata?.digiflazz_response?.sn || item.metadata?.data?.sn}
                                </p>
                              </div>
                            )}
                            <p className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 mt-2 text-center italic">Status: Berhasil / Sukses</p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {digitalItems.some((i: any) => i.status === 'processing') && (
                  <p className="text-[10px] text-zinc-500 text-center mt-4 leading-relaxed">
                    Pesanan diproses otomatis. Mohon tunggu sebentar, token/SN akan muncul otomatis.
                    Atau kembali kapan saja jika ingin melihat Riwayat Pesanan nanti.
                  </p>
                )}
              </div>
            )}

            {/* Sariroti Section */}
            {hasSariroti && (
              <div className="mb-5">
                <p className="text-xs font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider">
                  Pesanan Sariroti
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handlePrintNota}
                    className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors text-xs font-bold flex flex-col items-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Cetak Delivery Note
                  </button>
                  <button
                    onClick={handlePrint}
                    className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors text-xs font-bold flex flex-col items-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Cetak Struk
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2 pb-4">
              {isPending ? (
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-2xl font-bold transition-colors text-sm shadow-lg shadow-emerald-200/50 dark:shadow-none active:scale-[0.98]"
                >
                  Cek Status Pembayaran
                </button>
              ) : (
                <button
                  onClick={() => navigate('/kiosk')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-2xl font-bold transition-colors text-sm shadow-lg shadow-emerald-200/50 dark:shadow-none active:scale-[0.98]"
                >
                  Kembali ke Beranda
                </button>
              )}
              <button
                onClick={() => navigate('/kiosk/history')}
                className="w-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 h-12 rounded-2xl font-bold transition-colors text-sm active:scale-[0.98]"
              >
                Lihat Riwayat Pesanan
              </button>

              {hasSariroti && (
                <button
                  onClick={handleEmailSalesAdmin}
                  className="w-full bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 border-2 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 h-12 rounded-2xl font-bold transition-colors text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Mail className="w-4 h-4" />
                  Email Sales Admin Sariroti
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
