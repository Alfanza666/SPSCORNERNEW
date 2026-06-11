import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Package, TrendingUp, TrendingDown, RotateCcw, AlertCircle, Calendar, Filter, ExternalLink, ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

const TYPE_LABELS = {
  sale: { label: 'Terjual', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400', icon: TrendingDown },
  restock: { label: 'Restock', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400', icon: TrendingUp },
  correction: { label: 'Koreksi', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400', icon: RotateCcw },
  manual_update: { label: 'Opname', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400', icon: ClipboardList },
};

export default function StockTrace({ isAdmin }: { isAdmin?: boolean }) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      let query = supabase.from('products').select('id, name, stock, seller_id').order('name');
      if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) query = query.eq('seller_id', user.id);
      }
      const { data } = await query;
      setProducts(data || []);
    } catch (err: any) {
      toast.error('Gagal memuat produk: ' + err.message);
    }
  };

  const loadMovements = useCallback(async (productId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('limit', '200');

      const { data, error } = await supabase
        .from('stock_adjustments')
        .select('*, transactions!left(id, status, buyer_name, created_at)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      let filtered = data || [];
      if (filterType) filtered = filtered.filter(m => m.adjustment_type === filterType);
      if (startDate) filtered = filtered.filter(m => new Date(m.created_at) >= new Date(startDate));
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(m => new Date(m.created_at) <= end);
      }

      setMovements(filtered);
      setTotal(filtered.length);
    } catch (err: any) {
      toast.error('Gagal memuat riwayat: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, startDate, endDate]);

  const handleSelectProduct = (id: string) => {
    const product = products.find(p => p.id === id);
    setSelectedProduct(product);
    if (id) loadMovements(id);
    else setMovements([]);
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getQtyChange = (movement: any) => {
    if (!movement.previous_stock || !movement.new_stock) return null;
    return movement.new_stock - movement.previous_stock;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <h1 className="text-2xl font-black text-zinc-800 dark:text-white flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-500" />
          Lacak Riwayat Stok
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pantau seluruh mutasi stok per produk — penjualan, restock, retur, opname, dan koreksi
        </p>
      </motion.div>

      {/* Search & Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-clay w-full pl-11"
          />
        </div>

        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); if (selectedProduct) loadMovements(selectedProduct.id); }}
          className="input-clay"
        >
          <option value="">Semua Tipe</option>
          {Object.entries(TYPE_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>

        <select
          value={selectedProduct?.id || ''}
          onChange={e => handleSelectProduct(e.target.value)}
          className="input-clay"
        >
          <option value="">— Pilih Produk —</option>
          {filteredProducts.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} (Stok: {p.stock})
            </option>
          ))}
        </select>
      </div>

      {/* Date filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-clay flex-1" />
          <span className="text-zinc-400">s/d</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-clay flex-1" />
        </div>
        <div className="flex justify-end">
          {selectedProduct && (
            <button onClick={() => loadMovements(selectedProduct.id)} className="btn-clay-primary h-10 px-5 text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" /> Terapkan Filter
            </button>
          )}
        </div>
      </div>

      {/* Info produk terpilih */}
      {selectedProduct && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{selectedProduct.name}</h3>
            <p className="text-sm text-zinc-500">Stok saat ini: <span className="font-bold text-zinc-900 dark:text-white">{selectedProduct.stock}</span></p>
          </div>
          <div className="text-right text-sm text-zinc-400">
            <span className="font-bold text-zinc-900 dark:text-white">{total}</span> mutasi tercatat
          </div>
        </motion.div>
      )}

      {/* Tabel Mutasi */}
      {selectedProduct && (
        <div className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-zinc-400">Memuat...</div>
          ) : movements.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>Belum ada mutasi stok untuk produk ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80">
                    <th className="text-left p-4 font-bold text-zinc-500 uppercase tracking-wider text-[11px]">Waktu</th>
                    <th className="text-left p-4 font-bold text-zinc-500 uppercase tracking-wider text-[11px]">Tipe</th>
                    <th className="text-center p-4 font-bold text-zinc-500 uppercase tracking-wider text-[11px]">Perubahan</th>
                    <th className="text-center p-4 font-bold text-zinc-500 uppercase tracking-wider text-[11px]">Stok Akhir</th>
                    <th className="text-left p-4 font-bold text-zinc-500 uppercase tracking-wider text-[11px]">Transaksi</th>
                    <th className="text-left p-4 font-bold text-zinc-500 uppercase tracking-wider text-[11px]">Status</th>
                    <th className="text-left p-4 font-bold text-zinc-500 uppercase tracking-wider text-[11px]">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m: any, i: number) => {
                    const typeInfo = TYPE_LABELS[m.adjustment_type] || { label: m.adjustment_type, color: 'text-zinc-600 bg-zinc-50', icon: AlertCircle };
                    const Icon = typeInfo.icon;
                    const qty = getQtyChange(m);
                    const tx = m.transactions;
                    return (
                      <tr key={m.id || i} className="border-b border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className="p-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap text-xs">
                          {new Date(m.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${typeInfo.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className={`p-4 text-center font-bold ${qty !== null ? (qty > 0 ? 'text-emerald-600' : qty < 0 ? 'text-red-600' : '') : 'text-zinc-400'}`}>
                          {qty !== null ? `${qty > 0 ? '+' : ''}${qty}` : '-'}
                        </td>
                        <td className="p-4 text-center font-bold text-zinc-900 dark:text-white">{m.new_stock ?? '-'}</td>
                        <td className="p-4 text-xs text-zinc-500">
                          {tx ? (
                            <a href={`/dashboard/admin/transactions?id=${m.transaction_id}`} className="text-amber-600 hover:underline inline-flex items-center gap-1">
                              #{m.transaction_id?.slice(0, 8)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : m.transaction_id ? (
                            <span className="text-zinc-400">#{m.transaction_id.slice(0, 8)}</span>
                          ) : '-'}
                        </td>
                        <td className="p-4">
                          {tx ? (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              tx.status === 'paid' || tx.status === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                              tx.status === 'failed' || tx.status === 'cancelled' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                              'bg-zinc-50 text-zinc-500'
                            }`}>
                              {tx.status}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-4 text-xs text-zinc-400 max-w-[200px] truncate" title={m.notes}>{m.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
