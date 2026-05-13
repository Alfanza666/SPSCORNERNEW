import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { ClipboardList, Package, AlertTriangle, CheckCircle2, RefreshCw, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { formatRupiah } from '../../../lib/utils';
import toast from 'react-hot-toast';

export default function AdminStockOpname() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock, price, image_url, categories(name), profiles:seller_id(name)')
        .order('stock', { ascending: true });
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      toast.error('Gagal memuat produk: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async (productId: string, newStock: number) => {
    if (newStock < 0) return;
    try {
      setSaving(productId);
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
      setAdjustments(prev => { const n = { ...prev }; delete n[productId]; return n; });
      toast.success('Stok berhasil diperbarui');
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categories?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockCount = products.filter(p => p.stock < 5).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Stock Opname</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Verifikasi dan koreksi stok semua produk</p>
        </div>
        <button onClick={fetchProducts} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors shadow-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Produk</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-white">{products.length}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-5 border border-red-100 dark:border-red-900/30">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Stok Menipis</p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400">{lowStockCount}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900/30 col-span-2 sm:col-span-1">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Stok Normal</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{products.length - lowStockCount}</p>
        </div>
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Cari produk atau kategori..."
        className="w-full border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
      />

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 h-16 animate-pulse border border-zinc-100 dark:border-zinc-800" />)}</div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <th className="text-left px-5 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Produk</th>
                  <th className="text-left px-5 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Penjual</th>
                  <th className="text-center px-5 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stok Saat Ini</th>
                  <th className="text-center px-5 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Koreksi Stok</th>
                  <th className="text-center px-5 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {filtered.map(product => {
                  const isLow = product.stock < 5;
                  const adjVal = adjustments[product.id] ?? product.stock;
                  return (
                    <motion.tr key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${isLow ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-xl object-cover border border-zinc-100 dark:border-zinc-700" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                              <Package className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">{product.name}</p>
                            <p className="text-[10px] text-zinc-400">{product.categories?.name || '-'} · {formatRupiah(product.price)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                        {product.profiles?.name || '-'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${isLow ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                          {isLow && <TrendingDown className="w-3 h-3" />}
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={adjVal}
                          onChange={e => setAdjustments(prev => ({ ...prev, [product.id]: parseInt(e.target.value) || 0 }))}
                          className="w-20 text-center border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1.5 text-sm font-bold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => handleAdjust(product.id, adjVal)}
                          disabled={saving === product.id || adjVal === product.stock}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 mx-auto"
                        >
                          {saving === product.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Simpan
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
