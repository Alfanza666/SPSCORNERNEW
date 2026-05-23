import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Package, CheckCircle2, XCircle, Clock, Search, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminReturns() {
  const { user } = useAuthStore();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_returns')
        .select(`
          *,
          products (name, stock),
          profiles!product_returns_seller_id_fkey (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReturns(data || []);
    } catch (error) {
      console.error('Error fetching returns:', error);
      toast.error('Gagal memuat data retur');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/product-returns/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ id, status: newStatus })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success(`Permintaan retur berhasil di-${newStatus === 'approved' ? 'setujui' : 'tolak'}`);
      fetchReturns();
    } catch (error: any) {
      console.error('Error updating return:', error);
      toast.error(`Gagal memperbarui status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredReturns = returns.filter(ret => 
    ret.products?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Permintaan Retur</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Kelola permintaan retur produk (misal: basi/rusak)</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari nama produk atau seller..."
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
                <th className="px-6 py-4 font-bold">Seller</th>
                <th className="px-6 py-4 font-bold">Produk</th>
                <th className="px-6 py-4 font-bold">Stok Saat Ini</th>
                <th className="px-6 py-4 font-bold">Qty Retur</th>
                <th className="px-6 py-4 font-bold">Alasan</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">Memuat data...</td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">Belum ada permintaan retur</td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {new Date(ret.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-zinc-900 dark:text-white">
                      {ret.profiles?.name}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {ret.products?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {ret.products?.stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-amber-600 dark:text-amber-400">
                      -{ret.quantity}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300 max-w-xs truncate">
                      {ret.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {ret.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
                        </span>
                      ) : ret.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                          <XCircle className="w-3.5 h-3.5" /> Ditolak
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" /> Menunggu
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {ret.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleUpdateStatus(ret.id, 'approved')}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title="Setujui"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(ret.id, 'rejected')}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Tolak"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
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
