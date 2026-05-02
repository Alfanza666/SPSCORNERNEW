import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Printer, ArrowRight, Star, Clock, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useCartStore } from '../../store/useCartStore';
import { formatRupiah } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function Success() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { clearCart } = useCartStore();
  const [currentTime] = useState(new Date());
  const [transaction, setTransaction] = useState<any>(null);
  const queryParams = new URLSearchParams(location.search);
  const transactionId = location.state?.transactionId || queryParams.get('id');

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
            // Ping DB every 3s waiting for Webhook to resolve it
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
    // Clear cart and guest session data when reaching success page
    clearCart();
    sessionStorage.removeItem('buyerName');
    sessionStorage.removeItem('buyerPhone');
    // We no longer auto navigate to kiosk. User must click explicitly.
  }, [clearCart]);

  const handlePrint = () => {
    window.print();
  };

  const handleEmailSalesAdmin = () => {
    if (!transaction) return;
    const sarirotiItems = transaction.transaction_items.filter((item: any) => item.products?.category?.toLowerCase() === 'sariroti' || item.products?.name?.toLowerCase().includes('sariroti'));
    
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
    const sarirotiItems = transaction.transaction_items.filter((item: any) => item.products?.category?.toLowerCase() === 'sariroti' || item.products?.name?.toLowerCase().includes('sariroti'));
    
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

  const hasSariroti = transaction?.transaction_items?.some((item: any) => item.products?.category?.toLowerCase() === 'sariroti' || item.products?.name?.toLowerCase().includes('sariroti'));
  const digitalItems = transaction?.transaction_items?.filter((item: any) => item.metadata?.is_digital);

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.3, duration: 0.8 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-xl border border-zinc-200 dark:border-zinc-800"
      >
        {/* Top Header Card */}
        <div className={`relative p-8 text-center ${transaction?.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${transaction?.status === 'pending' ? 'bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400'}`}
          >
            {transaction?.status === 'pending' ? (
              <Clock className="w-8 h-8" />
            ) : (
              <CheckCircle2 className="w-8 h-8" />
            )}
          </motion.div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mb-2">
            {transaction?.status === 'pending' ? 'Pembayarannya masih diverifikasi' : 'Pembayaran Anda berhasil!'}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {transaction?.status === 'pending'
              ? 'Pilih \'Cek lagi statusnya\' untuk perbarui status transaksi, atau lihat riwayat pesanan.'
              : 'Pesanan Anda telah diterima. Cek statusnya di halaman riwayat pesanan.'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6">
          <p className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Ringkasan belanja</p>
          <div className="space-y-3 mb-6">
            {transaction?.transaction_items && transaction.transaction_items.slice(0, 3).map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{item.products?.name || item.metadata?.product_name || 'Produk'} (x{item.quantity})</span>
                <span className="text-zinc-900 dark:text-white font-medium">{item.price ? formatRupiah(item.price * item.quantity) : '-'}</span>
              </div>
            ))}
            {(transaction?.transaction_items?.length || 0) > 3 && (
              <div className="text-sm text-zinc-500 font-medium">+ {(transaction?.transaction_items?.length || 0) - 3} produk lainnya</div>
            )}
            
            <div className="flex justify-between items-center text-sm pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <span className="font-bold text-zinc-900 dark:text-white">Total pembayaran</span>
              <span className="font-black text-zinc-900 dark:text-white text-base">{transaction ? formatRupiah(transaction.total_amount) : '-'}</span>
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2">
              Waktu Transaksi: {format(currentTime, 'dd MMM yyyy, HH:mm', { locale: id })}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {transaction?.status === 'pending' ? (
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-full font-bold transition-colors text-sm"
              >
                Cek lagi statusnya
              </button>
            ) : (
              <button
                onClick={() => navigate('/kiosk')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-full font-bold transition-colors text-sm"
              >
                Kembali ke beranda
              </button>
            )}
            <button
              onClick={() => navigate('/kiosk/history')}
              className="w-full bg-white dark:bg-zinc-900 text-emerald-600 border-2 border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 h-12 rounded-full font-bold transition-colors text-sm"
            >
              Lihat riwayat pesanan
            </button>
          </div>

        {digitalItems && digitalItems.length > 0 && (
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-zinc-100 dark:border-zinc-800 border-dashed text-left">
            <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-3 text-center">Status Produk Digital</p>
            <div className="space-y-3">
              {digitalItems.map((item: any, idx: number) => {
                const productName = item.products?.name || item.metadata?.product_name || 'Produk Digital';
                const isProcessing = item.metadata?.status === 'processing';
                const isFailed = item.metadata?.status === 'failed';
                
                return (
                  <div key={idx} className={`p-3 rounded-xl border ${
                    isProcessing ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30' :
                    isFailed ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30' :
                    'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                        isProcessing ? 'text-amber-700 dark:text-amber-400' :
                        isFailed ? 'text-red-700 dark:text-red-400' :
                        'text-emerald-700 dark:text-emerald-400'
                      }`}>{productName}</span>
                      <span className={`text-[10px] font-mono ${
                        isProcessing ? 'text-amber-600 dark:text-amber-500' :
                        isFailed ? 'text-red-600 dark:text-red-500' :
                        'text-emerald-600 dark:text-emerald-500'
                      }`}>{item.metadata.target_number}</span>
                    </div>

                    {isProcessing ? (
                      <div className="flex items-center justify-center py-2 gap-2 text-amber-600 dark:text-amber-400">
                        <Clock className="w-4 h-4 animate-spin" />
                        <span className="text-[10px] font-bold tracking-widest uppercase animate-pulse">Sedang Diproses...</span>
                      </div>
                    ) : isFailed ? (
                      <div className="text-center py-2">
                        <p className="text-[10px] text-red-600 font-medium">{item.metadata?.digiflazz_message || item.metadata?.digiflazz_error || 'Transaksi gagal diproses sistem.'}</p>
                      </div>
                    ) : (
                      <>
                        {(item.metadata?.sn || item.metadata?.digiflazz_response?.sn || item.metadata?.data?.sn) && (
                          <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
                            <p className="text-[8px] text-zinc-400 uppercase font-bold mb-1">SN / Token / Ref</p>
                            <p className="text-sm font-mono font-black text-zinc-900 dark:text-white tracking-widest break-all">
                              {item.metadata?.sn || item.metadata?.digiflazz_response?.sn || item.metadata?.data?.sn}
                            </p>
                          </div>
                        )}
                        <p className="text-[8px] text-emerald-600/70 dark:text-emerald-400/70 mt-2 text-center italic">Status: Berhasil / Sukses</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            
            {digitalItems.some((i: any) => i.status === 'processing') && (
              <p className="text-[10px] text-zinc-500 text-center mt-4">Pesanan diproses otomatis. Mohon tunggu sebentar di layer ini, token/SN akan muncul otomatis. Atau kembali kapan saja jika ingin melihat Riwayat Pesanan nanti.</p>
            )}
          </div>
        )}

        {hasSariroti && (
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-zinc-100 dark:border-zinc-800 border-dashed">
            <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-3">Pesanan Sariroti Anda</p>
            <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={handlePrintNota}
                className="btn-clay-secondary bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 h-10 sm:h-12 text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                Cetak Nota Klaim
              </button>
              <button
                onClick={handlePrint}
                className="btn-clay-secondary h-10 sm:h-12 text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                Cetak Struk
              </button>
            </div>
          </div>
        )}
        
        </div>
      </motion.div>
    </div>
  );
}
