import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatRupiah } from '../../../lib/utils';
import { Package, CheckCircle2, Clock, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SellerTransactions() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('id');

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;
      const res = await fetch(`/api/transactions/seller/${user.id}`);
      if (!res.ok) {
        throw new Error('Gagal mengambil data');
      }
      const data = await res.json();
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Gagal memuat data transaksi');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReady = async (item: any) => {
    try {
      // 1. Update metadata di transaction_items
      const newMetadata = { ...item.metadata, status: 'ready' };
      const { error: updateError } = await supabase
        .from('transaction_items')
        .update({ metadata: newMetadata })
        .eq('id', item.id);

      if (updateError) throw updateError;

      // 2. Kirim notifikasi ke pembeli
      if (item.transactions?.buyer_id) {
        const productName = item.products?.name || item.metadata?.product_name || 'Produk';
        await supabase.from('notifications').insert({
          user_id: item.transactions.buyer_id,
          type: 'transaction',
          title: '🍞 Pesanan Siap Diambil',
          message: `Pesanan ${productName} Anda sudah siap. Silahkan ambil di Koperasi/Kantin.`,
          path: `/kiosk/history?id=${item.transaction_id}`
        });
      }

      toast.success('Berhasil mengirim notifikasi ke pembeli!');
      fetchTransactions();
    } catch (error) {
      console.error('Error marking ready:', error);
      toast.error('Gagal menandai siap diambil');
    }
  };

  const handleConfirm = async (item: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/transactions/confirm-sariroti', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ transaction_id: item.transaction_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengkonfirmasi pesanan');
      
      toast.success('Pesanan berhasil dikonfirmasi dan nota dikirim ke pembeli.');
      fetchTransactions();
    } catch (error: any) {
      console.error('Error confirming:', error);
      toast.error(error.message);
    }
  };

  const filteredItems = items.filter(item => {
    // Jika ada ID dari notifikasi, TAMPILKAN HANYA transaksi tersebut
    if (highlightId) {
      return item.transaction_id === highlightId;
    }
    const productName = item.products?.name || item.metadata?.product_name || item.name || '';
    // Jika tidak ada, gunakan pencarian biasa
    return (
      item.transactions?.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Pesanan Masuk</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Kelola pesanan dari pelanggan Anda</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari nama pembeli atau produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-6 py-4 font-bold">Tanggal</th>
                <th className="px-6 py-4 font-bold">Pembeli</th>
                <th className="px-6 py-4 font-bold">Produk</th>
                <th className="px-6 py-4 font-bold">Qty</th>
                <th className="px-6 py-4 font-bold">Subtotal</th>
                <th className="px-6 py-4 font-bold">Status Pembayaran</th>
                <th className="px-6 py-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                    Belum ada pesanan
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {new Date(item.transactions?.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-zinc-900 dark:text-white">
                      {item.transactions?.buyer_name}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {item.products?.name || item.metadata?.product_name || item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-zinc-900 dark:text-white">
                      {formatRupiah(item.subtotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.transactions?.status === 'success' || item.transactions?.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Lunas
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          Menunggu
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {user?.name?.toLowerCase().includes('sariroti') || user?.name?.toLowerCase().includes('koperasi') ? (
                        item.transactions?.metadata?.sariroti_confirmed ? (
                          item.metadata?.status === 'ready' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-700 text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                              ✓ Siap Diambil
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarkReady(item)}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-colors shadow-sm"
                            >
                              Tandai Siap
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleConfirm(item)}
                            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs font-bold transition-colors shadow-sm flex items-center gap-2 inline-flex ml-auto"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Konfirmasi
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-blue-200 text-blue-700 text-xs font-bold bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                          ✓ Sedang Diproses
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
