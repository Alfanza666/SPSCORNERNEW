import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Package, PackageCheck, Bell, RefreshCw, X, Receipt, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function AdminPickup() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [readyMessage, setReadyMessage] = useState('');
  const [notifyingReady, setNotifyingReady] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_items(*, products(*))')
        .eq('status', 'success')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const filtered = (data || []).filter(tx => {
        const meta = tx.metadata || {};
        // Skip fully completed or ready orders that we don't need to process anymore
        if (meta.sariroti_order_status === 'ready' || meta.sariroti_order_status === 'completed') return false;
        
        // Find if this transaction has Sariroti items
        const hasSariroti = tx.transaction_items?.some((item: any) => 
          item.products?.category?.toLowerCase() === 'sariroti' || 
          item.products?.name?.toLowerCase().includes('sariroti') || 
          item.products?.name?.toLowerCase().includes('roti')
        );

        return hasSariroti;
      });
      
      setTransactions(filtered);
    } catch (error: any) {
      console.error('Error fetching pickups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSariroti = async () => {
    if (!selectedTx) return;
    setConfirming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/admin/transactions/confirm-sariroti', {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: selectedTx.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengkonfirmasi pesanan');

      toast.success('Berhasil! Nota telah dibuat dan dikirim ke pembeli.');
      
      setSelectedTx({
        ...selectedTx,
        metadata: {
          ...(selectedTx.metadata || {}),
          sariroti_confirmed: true,
          sariroti_order_status: 'confirmed',
        }
      });
      fetchTransactions();
    } catch (error: any) {
      console.error('Error confirming Sariroti order:', error);
      toast.error(error.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleNotifyReady = async () => {
    if (!selectedTx) return;
    setNotifyingReady(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const response = await fetch('/api/admin/transactions/notify-ready', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: selectedTx.id,
          custom_message: readyMessage.trim() || undefined
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim notifikasi');

      toast.success('✅ Notifikasi "Siap Diambil" berhasil dikirim ke pembeli!');
      setReadyMessage('');
      setSelectedTx(null);
      fetchTransactions();
    } catch (error: any) {
      console.error('Error sending ready notification:', error);
      toast.error(error.message);
    } finally {
      setNotifyingReady(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Penyerahan Roti</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">Daftar pesanan Sariroti yang belum dikirim notifikasi "Siap Diambil".</p>
        </div>
        <button 
          onClick={fetchTransactions}
          disabled={loading}
          className="btn-clay-secondary rounded-xl px-4 py-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-12 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-amber-500" /></div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 italic">Belum ada pesanan yang perlu dipanggil</div>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className="clay-card rounded-2xl overflow-hidden cursor-pointer" onClick={() => setSelectedTx(tx)}>
              <div className="p-5 flex justify-between items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-full flex items-center justify-center">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">{tx.buyer_name || 'Pembeli Tanpa Nama'}</h3>
                    <p className="text-sm font-medium text-zinc-500">{format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold uppercase tracking-widest">{tx.number || tx.id.slice(0, 8)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold uppercase tracking-widest">Sari Roti</span>
                    </div>
                  </div>
                </div>
                <button className="btn-clay-primary h-10 px-4 bg-amber-500 hover:bg-amber-600 border-amber-600">Proses</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal proses pickup */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTx(null)}></div>
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Proses Penyerahan</h3>
              <button 
                onClick={() => setSelectedTx(null)}
                className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:border-red-500 transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Pemberitahuan kepada pembeli</p>
                <h4 className="text-2xl font-black text-zinc-900 dark:text-white">{selectedTx.buyer_name || 'Pembeli Tanpa Nama'}</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Pesanan <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedTx.number || selectedTx.id.slice(0, 8)}</span></p>
              </div>

              {/* Tampilkan Daftar Pesanan supaya Admin tahu apa yang disiapkan */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4">
                <h5 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Item Pesanan:</h5>
                <div className="space-y-3">
                  {selectedTx.transaction_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-700 flex items-center justify-center font-bold text-zinc-900 dark:text-zinc-100 text-xs shadow-sm">
                          {item.quantity}x
                        </div>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.products?.name || item.metadata?.product_name || 'Produk'}</span>
                      </div>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">
                        Rp {((item.price || 0) * (item.quantity || 1)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {!selectedTx.metadata?.sariroti_confirmed ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-900/50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-blue-800 dark:text-blue-300">Langkah 1: Buat & Kirim Nota</p>
                      <p className="text-xs text-blue-600/80 dark:text-blue-400 mt-1 leading-relaxed">Nota pesanan akan dibuat dan dikirimkan otomatis ke notifikasi / email pembeli sebagai tanda terima. Lakukan ini saat pesanan mulai diproses.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleConfirmSariroti}
                    disabled={confirming}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {confirming ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {confirming ? 'Memproses Nota...' : 'Buat Nota & Kirim ke Pembeli'}
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-900/50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <PackageCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-amber-800 dark:text-amber-300">Langkah 2: Pesanan Siap Diambil</p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400 mt-1 leading-relaxed">Kirim pemberitahuan kepada pembeli bahwa pesanan roti mereka sudah siap diambil di koperasi.</p>
                    </div>
                  </div>
                  <textarea
                    value={readyMessage}
                    onChange={e => setReadyMessage(e.target.value)}
                    placeholder="Pesan opsional (misal: Silakan ambil di kasir lantai 1). Biarkan kosong untuk pesan default."
                    rows={3}
                    className="w-full text-sm p-4 rounded-xl bg-white dark:bg-zinc-950 border-2 border-amber-200 dark:border-amber-800/50 text-zinc-700 dark:text-zinc-300 font-medium resize-none focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={handleNotifyReady}
                    disabled={notifyingReady}
                    className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {notifyingReady ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                    {notifyingReady ? 'Mengirim Notifikasi...' : 'Beritahu Pembeli Pesanan Siap!'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
