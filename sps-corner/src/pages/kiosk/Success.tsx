import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Printer, ArrowRight, Star, Clock, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

export default function Success() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [currentTime] = useState(new Date());
  const [transaction, setTransaction] = useState<any>(null);
  const transactionId = location.state?.transactionId;

  useEffect(() => {
    if (transactionId) {
      fetchTransaction();
    }
  }, [transactionId]);

  const fetchTransaction = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          transaction_items (
            *,
            products (
              name,
              category
            )
          )
        `)
        .eq('id', transactionId)
        .single();
      
      if (!error && data) {
        setTransaction(data);
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
    }
  };

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

    const timer = setTimeout(() => {
      navigate('/kiosk');
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [navigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleEmailSalesAdmin = () => {
    if (!transaction) return;
    const sarirotiItems = transaction.transaction_items.filter((item: any) => item.products.category?.toLowerCase() === 'sariroti' || item.products.name.toLowerCase().includes('sariroti'));
    
    if (sarirotiItems.length === 0) return;

    const subject = encodeURIComponent(`Pesanan Baru Sariroti - ID #${transaction.id.slice(0, 8)}`);
    const body = encodeURIComponent(`Halo Sales Admin Sariroti,

Berikut adalah detail pesanan baru dari Koperasi Karyawan (SPS Corner):

ID Pesanan: #${transaction.id.slice(0, 8)}
Tanggal: ${new Date(transaction.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
Nama Pemesan: ${user?.name || 'Karyawan'}

Detail Pesanan:
${sarirotiItems.map((item: any) => `- ${item.products.name} (Qty: ${item.quantity})`).join('\n')}

Mohon diproses untuk pengambilan besok.

Terima kasih,
Sistem SPS Corner`);

    window.location.href = `mailto:Sales.Admin.bjm@sariroti.com?subject=${subject}&body=${body}`;
  };

  const handlePrintNota = () => {
    if (!transaction) return;
    const sarirotiItems = transaction.transaction_items.filter((item: any) => item.products.category?.toLowerCase() === 'sariroti' || item.products.name.toLowerCase().includes('sariroti'));
    
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
                  <td>${item.products.name}</td>
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

  const hasSariroti = transaction?.transaction_items?.some((item: any) => item.products.category?.toLowerCase() === 'sariroti' || item.products.name.toLowerCase().includes('sariroti'));
  const digitalItems = transaction?.transaction_items?.filter((item: any) => item.metadata?.is_digital);

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-30 dark:opacity-10">
        <div className="absolute top-0 left-0 w-40 h-40 sm:w-64 sm:h-64 bg-blue-200 dark:bg-blue-600 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-40 h-40 sm:w-64 sm:h-64 bg-amber-200 dark:bg-amber-600 rounded-full blur-2xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.8 }}
        className="text-center max-w-md w-full clay-card p-6 sm:p-8 relative"
      >
        {/* Floating Stars */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
          className="absolute -top-3 -left-3 sm:-top-5 sm:-left-5 text-amber-400 drop-shadow-lg"
        >
          <Star className="w-6 h-6 sm:w-10 sm:h-10 fill-current" />
        </motion.div>
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          className="absolute -bottom-3 -right-3 sm:-bottom-5 sm:-right-5 text-amber-400 drop-shadow-lg"
        >
          <Star className="w-5 h-5 sm:w-8 sm:h-8 fill-current" />
        </motion.div>

        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-md"
        >
          <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-white stroke-[1.5]" />
        </motion.div>

        <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white mb-2 sm:mb-3 tracking-tight">
          Yuhuu! Berhasil.
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-4 sm:mb-6 leading-relaxed px-2 font-medium">
          Terima kasih telah berbelanja di <span className="text-blue-600 dark:text-blue-400 font-black">SPS Corner</span>. Pesananmu sudah tercatat dan siap untuk dinikmati!
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 sm:p-4 mb-6 sm:mb-8 border border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center gap-1.5 shadow-inner">
          <p className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest">Waktu Transaksi</p>
          <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-mono font-bold text-sm sm:text-base">
            <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            {format(currentTime, 'dd MMM yyyy, HH:mm:ss', { locale: id })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
          <button
            onClick={handlePrint}
            className="btn-clay-secondary h-10 sm:h-12 text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
            Cetak Struk
          </button>
          <button
            onClick={() => navigate('/kiosk')}
            className="btn-clay-primary h-10 sm:h-12 text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 group"
          >
            <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4" />
            Pesan Lagi
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {digitalItems && digitalItems.length > 0 && (
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-zinc-100 dark:border-zinc-800 border-dashed text-left">
            <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-3 text-center">Produk Digital Berhasil Dikirim</p>
            <div className="space-y-3">
              {digitalItems.map((item: any, idx: number) => {
                const productName = item.products?.name || item.metadata?.product_name || 'Produk Digital';
                return (
                  <div key={idx} className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tighter">{productName}</span>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-500">{item.metadata.target_number}</span>
                    </div>
                    {productName.toLowerCase().includes('pln') && (
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
                        <p className="text-[8px] text-zinc-400 uppercase font-bold mb-1">Token PLN</p>
                        <p className="text-sm font-mono font-black text-zinc-900 dark:text-white tracking-widest">
                          {Math.floor(Math.random() * 10000)}-{Math.floor(Math.random() * 10000)}-{Math.floor(Math.random() * 10000)}-{Math.floor(Math.random() * 10000)}
                        </p>
                      </div>
                    )}
                    <p className="text-[8px] text-emerald-600/70 dark:text-emerald-400/70 mt-2 text-center italic">Status: Berhasil / Sukses</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasSariroti && (
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-zinc-100 dark:border-zinc-800 border-dashed">
            <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-3">Pesanan Sariroti Anda</p>
            <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={handleEmailSalesAdmin}
                className="btn-clay-secondary bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 h-10 sm:h-12 text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                Email Sales Admin
              </button>
              <button
                onClick={handlePrintNota}
                className="btn-clay-secondary bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 h-10 sm:h-12 text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                Cetak Nota Klaim
              </button>
            </div>
          </div>
        )}
        
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800 border-dashed">
          <p className="text-zinc-400 dark:text-zinc-500 text-[8px] sm:text-[10px] font-bold tracking-wide">
            Halaman ini akan kembali otomatis dalam beberapa saat...
          </p>
        </div>
      </motion.div>
    </div>
  );
}
