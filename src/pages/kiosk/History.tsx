import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { ShoppingBag, Calendar, ChevronRight, Package, Clock, CheckCircle2, XCircle, ArrowLeft, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  products: {
    name: string;
    image_url: string;
    category: string;
  };
}

interface Transaction {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  receipt_image: string;
  transaction_items: TransactionItem[];
}

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          transaction_items (
            *,
            products (
              name,
              image_url,
              category
            )
          )
        `)
        .eq('buyer_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setTransactions(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintNota = (tx: Transaction) => {
    const sarirotiItems = tx.transaction_items.filter(item => item.products.category?.toLowerCase() === 'sariroti' || item.products.name.toLowerCase().includes('sariroti'));
    
    if (sarirotiItems.length === 0) {
      toast.error('Tidak ada produk Sariroti dalam pesanan ini.');
      return;
    }

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
            <div><strong>ID Pesanan:</strong> #${tx.id.slice(0, 8)}</div>
            <div><strong>Tanggal:</strong> ${new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
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
              ${sarirotiItems.map(item => `
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

  const handleEmailSalesAdmin = (tx: Transaction) => {
    const sarirotiItems = tx.transaction_items.filter(item => item.products.category?.toLowerCase() === 'sariroti' || item.products.name.toLowerCase().includes('sariroti'));
    
    if (sarirotiItems.length === 0) {
      toast.error('Tidak ada produk Sariroti dalam pesanan ini.');
      return;
    }

    const subject = encodeURIComponent(`Pesanan Baru Sariroti - ID #${tx.id.slice(0, 8)}`);
    const body = encodeURIComponent(`Halo Sales Admin Sariroti,

Berikut adalah detail pesanan baru dari Koperasi Karyawan (SPS Corner):

ID Pesanan: #${tx.id.slice(0, 8)}
Tanggal: ${new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
Nama Pemesan: ${user?.name || 'Karyawan'}

Detail Pesanan:
${sarirotiItems.map(item => `- ${item.products.name} (Qty: ${item.quantity})`).join('\n')}

Mohon diproses untuk pengambilan besok.

Terima kasih,
Sistem SPS Corner`);

    window.location.href = `mailto:Sales.Admin.bjm@sariroti.com?subject=${subject}&body=${body}`;
  };

  const filteredTransactions = transactions.filter(tx => 
    tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.transaction_items.some(item => item.products.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 sm:px-6">
        <div className="clay-card p-8 sm:p-12 max-w-md w-full">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl sm:rounded-[32px] flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]">
            <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-300 dark:text-zinc-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white mb-3 sm:mb-4">Belum Masuk</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 sm:mb-10 font-bold text-sm sm:text-base">Silakan masuk untuk melihat riwayat pembelian Anda.</p>
          <button onClick={() => navigate('/login')} className="btn-clay-primary w-full py-3 sm:py-4 text-base sm:text-lg">
            Masuk Sekarang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-8 px-4 sm:px-6 pb-10 sm:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">Riwayat Pesanan</h1>
          <p className="text-zinc-400 dark:text-zinc-500 mt-0.5 sm:mt-1 font-bold uppercase tracking-[0.2em] text-[8px] sm:text-[10px]">Pantau semua transaksi Anda di sini</p>
        </div>
        
        <div className="relative group w-full sm:w-64">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 w-3.5 h-3.5 sm:w-4 sm:h-4 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" />
          <input
            type="text"
            placeholder="Cari pesanan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-clay pl-9 sm:pl-10 py-2 sm:py-2.5 text-xs sm:text-sm h-10 w-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 sm:space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="clay-card p-4 sm:p-6 h-28 sm:h-32 animate-pulse bg-zinc-50/50 dark:bg-zinc-800/50" />
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12 sm:py-20 clay-card"
        >
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-inner">
            <ShoppingBag className="w-8 h-8 sm:w-12 sm:h-12 text-zinc-200 dark:text-zinc-700" />
          </div>
          <h3 className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-white mb-1.5 sm:mb-2 tracking-tight">Belum ada pesanan</h3>
          <p className="text-zinc-400 dark:text-zinc-500 max-w-sm mx-auto font-medium mb-5 sm:mb-6 text-xs sm:text-sm">Mulai belanja sekarang dan nikmati kemudahan di SPS Corner!</p>
          <button onClick={() => navigate('/kiosk')} className="btn-clay-primary px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm">
            Mulai Belanja
          </button>
        </motion.div>
      ) : (
        <div className="space-y-4 sm:space-y-6 tour-kiosk-history-list">
          <AnimatePresence mode="popLayout">
            {filteredTransactions.map((tx) => (
              <motion.div
                key={tx.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="clay-card overflow-hidden group hover:shadow-lg transition-all duration-500"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md ${
                        tx.status === 'success' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {tx.status === 'success' ? <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                          <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">ID Pesanan</span>
                          <span className="text-[8px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded shadow-inner">#{tx.id.slice(0, 8)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-900 dark:text-white font-black text-xs sm:text-base tracking-tighter">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-zinc-300 dark:text-zinc-600" />
                          {new Date(tx.created_at).toLocaleDateString('id-ID', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-left sm:text-right">
                      <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-0.5">Total Pembayaran</p>
                      <p className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{formatRupiah(tx.total_amount)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    {tx.transaction_items.map((item) => {
                      const productName = item.products?.name || item.metadata?.product_name || 'Produk Terhapus';
                      const imageUrl = item.products?.image_url;
                      
                      return (
                        <div key={item.id} className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg sm:rounded-xl border border-zinc-50 dark:border-zinc-800 shadow-inner">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-zinc-800 rounded-md sm:rounded-lg overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-700 shrink-0">
                            {imageUrl ? (
                              <img src={imageUrl} alt={productName} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-200 dark:text-zinc-700">
                                <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm truncate tracking-tight">{productName}</h4>
                              {item.metadata?.is_digital && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                                  item.status === 'delivered' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                  item.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                  {item.status === 'delivered' ? 'Sukses' : item.status === 'failed' ? 'Gagal' : 'Proses'}
                                </span>
                              )}
                            </div>
                            <p className="text-[8px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                              {item.quantity} x {formatRupiah(item.price_at_time)}
                            </p>
                            {item.metadata?.is_digital && (
                              <div className="flex flex-col gap-0.5 mt-1">
                                <p className="text-[8px] font-mono text-emerald-600 dark:text-emerald-400">
                                  Tujuan: {item.metadata.target_number}
                                </p>
                                {item.metadata.sn && (
                                  <p className="text-[8px] font-mono text-zinc-500 dark:text-zinc-400">
                                    SN: {item.metadata.sn}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-black text-zinc-900 dark:text-white text-xs sm:text-base tracking-tighter">{formatRupiah(item.price_at_time * item.quantity)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800 border-dashed flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-widest ${tx.status === 'success' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 shadow-inner' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 shadow-inner'}`}>
                        {tx.status === 'success' ? 'Selesai' : 'Gagal'}
                      </div>
                      <span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Metode: QRIS</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {tx.status === 'success' && tx.transaction_items.some(item => item.products.category?.toLowerCase() === 'sariroti' || item.products.name.toLowerCase().includes('sariroti')) && (
                        <>
                          <button 
                            onClick={() => handleEmailSalesAdmin(tx)}
                            className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs flex items-center gap-1 hover:gap-1.5 transition-all uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800"
                          >
                            Email Sales
                          </button>
                          <button 
                            onClick={() => handlePrintNota(tx)}
                            className="text-amber-600 dark:text-amber-400 font-bold text-[10px] sm:text-xs flex items-center gap-1 hover:gap-1.5 transition-all uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-800"
                          >
                            Cetak Nota
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => {/* View Details Modal or Page */}}
                        className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs flex items-center gap-1 hover:gap-1.5 transition-all uppercase tracking-widest"
                      >
                        Lihat Detail <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={() => navigate('/kiosk')}
          className="inline-flex items-center text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-xs sm:text-sm gap-1.5 sm:gap-2 group uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 group-hover:-translate-x-1.5 transition-transform" />
          Kembali Belanja
        </button>
      </div>
    </div>
  );
}
