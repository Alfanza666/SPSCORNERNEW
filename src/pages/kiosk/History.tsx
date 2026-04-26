import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { ShoppingBag, Calendar, ChevronRight, Package, Clock, CheckCircle2, XCircle, ArrowLeft, Search, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  status?: string;
  metadata?: any;
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
  pickup_code?: string;
  transaction_items: TransactionItem[];
}

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, [user]);

  useEffect(() => {
    let pollTimer: any;
    const hasProcessing = transactions.some(tx => 
      tx.transaction_items.some(item => item.metadata?.is_digital && (item.metadata?.status === 'processing' || item.metadata?.status === 'pending'))
    );

    if (hasProcessing) {
      pollTimer = setTimeout(() => {
        fetchHistorySilently();
      }, 5000);
    }

    return () => {
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [transactions]);

  const fetchHistorySilently = async () => {
    try {
      let query = supabase
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
        .order('created_at', { ascending: false });

      if (user) {
        query = query.eq('buyer_id', user.id);
      } else {
        try {
          const guestTxIds = JSON.parse(localStorage.getItem('guest_transactions') || '[]');
          if (guestTxIds.length > 0) {
            query = query.in('id', guestTxIds);
          } else {
            return; // No guest history
          }
        } catch {
          return;
        }
      }

      const { data, error } = await query;

      if (!error && data) {
        setTransactions(data);
        
        // Also update the selected modal detail so it live-updates if user is viewing it
        // USING functional update to prevent stale closures
        setSelectedTxDetail(prev => {
          if (!prev) return null;
          return data.find(t => t.id === prev.id) || prev;
        });
      }
    } catch (error) {
      console.error('Error polling history:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      let query = supabase
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
        .order('created_at', { ascending: false });

      if (user) {
        query = query.eq('buyer_id', user.id);
      } else {
        try {
          const guestTxIds = JSON.parse(localStorage.getItem('guest_transactions') || '[]');
          if (guestTxIds.length > 0) {
            query = query.in('id', guestTxIds);
          } else {
            setTransactions([]);
            return; // No guest history
          }
        } catch {
          setTransactions([]);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setTransactions(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (item: any) => {
    try {
      toast.loading('Memeriksa status pesanan API...', { id: 'check-status' });
      const res = await fetch('/api/digital/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_item_id: item.id })
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.itemStatus === 'delivered') toast.success('Pesanan berhasil!', { id: 'check-status' });
        else if (data.itemStatus === 'failed') toast.error('Pesanan gagal: ' + (data.message || 'Error'), { id: 'check-status' });
        else toast.success('Pesanan masih diproses (pending).', { id: 'check-status' });
        
        fetchHistorySilently();
      } else {
        toast.error('Gagal: ' + (data.error || 'Server error'), { id: 'check-status' });
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message, { id: 'check-status' });
    }
  };

  const handlePrintNota = (tx: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Mohon izinkan pop-up untuk mencetak nota.');
      return;
    }

    const html = `
      <html>
        <head>
          <title>Nota Pembelian - SPS Corner</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 400px; margin: 0 auto; color: #000; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .sub-logo { font-size: 14px; margin-bottom: 10px; }
            .info { font-size: 12px; margin-bottom: 15px; }
            .info div { margin-bottom: 3px; }
            table { border-collapse: collapse; font-size: 12px; width: 100%; }
            th { border-bottom: 1px solid #000; text-align: left; padding: 5px 0; }
            td { padding: 5px 0; }
            .qty { text-align: center; }
            .price { text-align: right; }
            .total-row { font-weight: bold; border-top: 1px dashed #000; }
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
            <div>NOTA PEMBELIAN</div>
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
                <th class="price">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${tx.transaction_items.map(item => `
                <tr>
                  <td>
                    ${item.products?.name || item.metadata?.product_name || 'Produk Koperasi'}
                    ${item.metadata?.is_digital ? `<br><small>Tujuan: ${item.metadata?.target_number}</small><br><small>SN: ${item.metadata?.sn || '-'}</small>` : ''}
                  </td>
                  <td class="qty">${item.quantity}</td>
                  <td class="price">${formatRupiah(item.price * item.quantity)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2" style="padding-top: 10px;">TOTAL</td>
                <td class="price" style="padding-top: 10px;">${formatRupiah(tx.total_amount)}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            <p>Terima Kasih atas Kunjungan Anda</p>
            <p>Simpan nota ini sebagai bukti transaksi yang sah</p>
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
    const sarirotiItems = tx.transaction_items.filter(item => item.products?.category?.toLowerCase() === 'sariroti' || item.products?.name?.toLowerCase().includes('sariroti'));
    
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
${sarirotiItems.map(item => `- ${item.products?.name || item.metadata?.product_name || 'Produk Koperasi'} (Qty: ${item.quantity})`).join('\n')}

Mohon diproses untuk pengambilan besok.

Terima kasih,
Sistem SPS Corner`);

    window.location.href = `mailto:Sales.Admin.bjm@sariroti.com?subject=${subject}&body=${body}`;
  };

  const handleCancelOrder = async (txId: string) => {
    if (!window.confirm('Yakin ingin membatalkan pesanan ini?')) return;
    try {
      setLoading(true);
      const res = await fetch('/api/transactions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success(data.message);
      fetchHistory();
    } catch (error: any) {
      toast.error('Gagal membatalkan pesanan: ' + error.message);
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => 
    tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.transaction_items.some(item => (item.products?.name || item.metadata?.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );



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
                        tx.status === 'success' || tx.status === 'paid' ? 'bg-blue-500 text-white' : 
                        tx.status === 'processing' || tx.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {tx.status === 'success' || tx.status === 'paid' ? <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> : 
                         tx.status === 'processing' || tx.status === 'pending' ? <Clock className="w-5 h-5 sm:w-6 sm:h-6" /> : <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
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

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800 border-dashed flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-widest shadow-inner ${
                        tx.status === 'success' || tx.status === 'paid' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 
                        tx.status === 'processing' || tx.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 
                        'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                      }`}>
                        {tx.status === 'success' ? 'Selesai' : 
                         tx.status === 'paid' ? 'Pesanan Terbayar' : 
                         tx.status === 'processing' ? 'Diproses Sistem' : 
                         tx.status === 'pending' ? 'Menunggu Pembayaran' : 'Pesanan Gagal'}
                      </div>
                      <span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Metode: {tx.payment_method?.toUpperCase() || 'QRIS'}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {tx.status === 'pending' && (
                        <button 
                          onClick={() => handleCancelOrder(tx.id)}
                          className="text-red-600 dark:text-red-400 font-bold text-[10px] sm:text-xs flex items-center gap-1 hover:gap-1.5 transition-all uppercase tracking-widest bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-full border border-red-100 dark:border-red-800"
                        >
                          Batalkan Pesanan
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedTxDetail(tx)}
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

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedTxDetail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedTxDetail(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                <h3 className="font-black text-lg sm:text-xl tracking-tight text-zinc-900 dark:text-white">
                  Detail Transaksi
                </h3>
                <button 
                  onClick={() => setSelectedTxDetail(null)}
                  className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">ID Pesanan</p>
                    <p className="font-mono text-sm font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded inline-block">
                      #{selectedTxDetail.id}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Waktu Pembayaran</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">
                      {new Date(selectedTxDetail.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">Item Pembelian</h4>
                  {selectedTxDetail.transaction_items.map((item) => {
                    const productName = item.products?.name || item.metadata?.product_name || 'Produk';
                    const itemSn = item.metadata?.sn || item.metadata?.digiflazz_response?.sn || item.metadata?.data?.sn;
                    
                    return (
                      <div key={item.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-sm text-zinc-900 dark:text-white">{productName}</p>
                            <p className="text-[10px] text-zinc-500 font-medium">{item.quantity} x {formatRupiah(item.price)}</p>
                          </div>
                          <p className="font-black text-sm text-zinc-900 dark:text-white">{formatRupiah(item.price * item.quantity)}</p>
                        </div>
                        
                        {item.metadata?.is_digital && (
                          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Target No</span>
                              <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-300">{item.metadata.target_number}</span>
                            </div>
                            
                            {item.metadata?.status === 'processing' ? (
                              <div className="flex flex-col items-center gap-2 mt-2">
                                <div className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-900/20 p-2 rounded text-amber-600 dark:text-amber-400 w-full">
                                  <Clock className="w-4 h-4 animate-spin" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Sedang Proses Operator...</span>
                                </div>
                                <button 
                                  onClick={() => handleCheckStatus(item)}
                                  className="text-[10px] uppercase tracking-widest font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors"
                                >
                                  Cek Paksa
                                </button>
                              </div>
                            ) : item.metadata?.status === 'failed' ? (
                              <div className="text-center bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-600 dark:text-red-400">
                                <p className="text-[10px] font-bold uppercase tracking-widest">{item.metadata?.digiflazz_message || 'Transaksi Gagal'}</p>
                              </div>
                            ) : itemSn ? (
                              <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg text-center mt-2 group relative overflow-hidden">
                                <div className="absolute inset-0 bg-emerald-50 dark:bg-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 relative z-10">SN / TOKEN / REFERENSI</p>
                                <p className="font-mono text-sm font-black text-zinc-900 dark:text-white tracking-widest break-all relative z-10 selection:bg-emerald-200 dark:selection:bg-emerald-900">
                                  {itemSn}
                                </p>
                              </div>
                            ) : ['delivered', 'success', 'paid'].includes(item.metadata?.status || '') ? (
                               <p className="text-xs font-bold text-center text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">Transaksi Sukses</p>
                            ) : ['failed', 'cancelled'].includes(selectedTxDetail?.status || '') ? (
                               <p className="text-xs font-bold text-center text-red-600 dark:text-red-500 uppercase tracking-widest mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">Status: Gagal / Dibatalkan</p>
                            ) : (
                              <div className="mt-2 text-center">
                                <p className="text-xs text-zinc-500 italic mb-2">Menunggu respons SN...</p>
                                <button 
                                  onClick={() => handleCheckStatus(item)}
                                  className="text-[10px] uppercase tracking-widest font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                                >
                                  Cek Status Manual
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sariroti / Bread Status */}
                        {(item.products?.category?.toLowerCase() === 'sariroti' || item.products?.name?.toLowerCase().includes('sariroti')) && (
                          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Status Pesanan Roti</span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1">
                              <div className={`text-center p-1.5 rounded-lg border ${selectedTxDetail.metadata?.sariroti_confirmed ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-800/20 border-zinc-100 dark:border-zinc-800'}`}>
                                <div className={`w-5 h-5 mx-auto rounded-full flex items-center justify-center mb-1 ${selectedTxDetail.metadata?.sariroti_confirmed ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'}`}>
                                  <CheckCircle2 className="w-3 h-3" />
                                </div>
                                <p className={`text-[8px] font-bold uppercase tracking-tighter ${selectedTxDetail.metadata?.sariroti_confirmed ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`}>Diterima</p>
                              </div>

                              <div className={`text-center p-1.5 rounded-lg border ${selectedTxDetail.metadata?.sariroti_confirmed && selectedTxDetail.metadata?.sariroti_order_status !== 'ready' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' : (selectedTxDetail.metadata?.sariroti_order_status === 'ready' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-800/20 border-zinc-100 dark:border-zinc-800')}`}>
                                <div className={`w-5 h-5 mx-auto rounded-full flex items-center justify-center mb-1 ${selectedTxDetail.metadata?.sariroti_confirmed && selectedTxDetail.metadata?.sariroti_order_status !== 'ready' ? 'bg-amber-500 text-white animate-pulse' : (selectedTxDetail.metadata?.sariroti_order_status === 'ready' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400')}`}>
                                  <Clock className="w-3 h-3" />
                                </div>
                                <p className={`text-[8px] font-bold uppercase tracking-tighter ${selectedTxDetail.metadata?.sariroti_confirmed && selectedTxDetail.metadata?.sariroti_order_status !== 'ready' ? 'text-amber-600 dark:text-amber-400' : (selectedTxDetail.metadata?.sariroti_order_status === 'ready' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400')}`}>Produksi</p>
                              </div>

                              <div className={`text-center p-1.5 rounded-lg border ${selectedTxDetail.metadata?.sariroti_order_status === 'ready' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' : 'bg-zinc-50 dark:bg-zinc-800/20 border-zinc-100 dark:border-zinc-800'}`}>
                                <div className={`w-5 h-5 mx-auto rounded-full flex items-center justify-center mb-1 ${selectedTxDetail.metadata?.sariroti_order_status === 'ready' ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'}`}>
                                  <ShoppingBag className="w-3 h-3" />
                                </div>
                                <p className={`text-[8px] font-bold uppercase tracking-tighter ${selectedTxDetail.metadata?.sariroti_order_status === 'ready' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>Siap Ambil</p>
                              </div>
                            </div>
                            
                            {selectedTxDetail.metadata?.sariroti_order_status === 'ready' && (
                              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800 text-center">
                                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1">Pesanan Siap!</p>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium leading-tight">
                                  {selectedTxDetail.metadata?.sariroti_ready_message || 'Silakan ambil pesanan Anda di kasir. Tunjukkan nota ini kepada petugas.'}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center p-4 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl">
                  <p className="font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-xs">Total Pembayaran</p>
                  <p className="font-black text-blue-600 dark:text-blue-400 text-xl tracking-tighter">{formatRupiah(selectedTxDetail.total_amount)}</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-end gap-3">
                {selectedTxDetail.status === 'success' || selectedTxDetail.status === 'paid' ? (
                  <>
                    {selectedTxDetail.transaction_items.some(item => item.products?.category?.toLowerCase() === 'sariroti' || item.products?.name?.toLowerCase().includes('sariroti')) && (
                      <button 
                        onClick={() => handleEmailSalesAdmin(selectedTxDetail)}
                        className="px-4 py-2 font-bold text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-200 transition-colors uppercase tracking-widest flex items-center gap-2"
                      >
                        Email Sales
                      </button>
                    )}
                    <button 
                      onClick={() => handlePrintNota(selectedTxDetail)}
                      className="px-4 py-2 font-black text-xs bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors uppercase tracking-widest flex items-center gap-2 shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      Cetak Nota
                    </button>
                  </>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
