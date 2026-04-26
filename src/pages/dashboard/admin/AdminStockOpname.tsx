import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { ClipboardList, Search, Save, Loader2, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminStockOpname() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [opnameItems, setOpnameItems] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchHistory();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*, profiles(name)')
        .order('name', { ascending: true });
      if (error) throw error;
      setProducts(data || []);
      
      // Initialize opname items with current system stock
      const initial: Record<string, number> = {};
      data?.forEach(p => {
        initial[p.id] = p.stock;
      });
      setOpnameItems(initial);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_opnames')
        .select('*, profiles(name), stock_opname_items(*, products(name))')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleUpdatePhysicalStock = (productId: string, val: string) => {
    const num = parseInt(val) || 0;
    setOpnameItems(prev => ({ ...prev, [productId]: num }));
  };

  const handleSubmitOpname = async () => {
    if (!user) return;
    
    const confirm = window.confirm('Apakah Anda yakin ingin menyimpan Stock Opname ini? Data stok sistem akan diperbarui sesuai fisik.');
    if (!confirm) return;

    setSaving(true);
    try {
      // 1. Create Opname Header
      const { data: opname, error: headerError } = await supabase
        .from('stock_opnames')
        .insert({
          user_id: user.id,
          notes: notes,
          status: 'completed'
        })
        .select()
        .single();

      if (headerError) throw headerError;

      // 2. Prepare Items and Update Products
      const itemsToInsert = [];
      for (const product of products) {
        const physical = opnameItems[product.id];
        const system = product.stock;
        const variance = physical - system;

        if (variance !== 0) {
          // Record Item
          itemsToInsert.push({
            opname_id: opname.id,
            product_id: product.id,
            system_stock: system,
            physical_stock: physical,
            variance: variance
          });

          // Update Product Stock
          const { error: stockError } = await supabase
            .from('products')
            .update({ stock: physical })
            .eq('id', product.id);
          
          if (stockError) throw stockError;

          // Log Adjustment
          await supabase.from('stock_adjustments').insert({
            product_id: product.id,
            user_id: user.id,
            previous_stock: system,
            new_stock: physical,
            adjustment_type: 'correction',
            notes: `Stock Opname Variance (${variance > 0 ? '+' : ''}${variance}). ID Opname: ${opname.id}`
          });
        }
      }

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('stock_opname_items')
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      toast.success('Stock Opname berhasil disimpan!');
      setNotes('');
      fetchProducts();
      fetchHistory();
    } catch (error: any) {
      console.error('Error saving opname:', error);
      toast.error(`Gagal menyimpan: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.profiles?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Stock Opname</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Audit fisik stok untuk menjaga akurasi inventaris kantin otomatis.</p>
        </div>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="btn-clay-secondary h-12 px-6 flex items-center gap-2"
        >
          <History className="w-5 h-5" />
          {showHistory ? 'Lanjut Opname' : 'Lihat Riwayat'}
        </button>
      </div>

      {!showHistory ? (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Cari produk..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-clay pl-12 h-12"
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <input 
                type="text"
                placeholder="Catatan Opname..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-clay h-12 flex-1 md:w-64"
              />
              <button 
                onClick={handleSubmitOpname}
                disabled={saving || loading}
                className="btn-clay-primary h-12 px-8 flex items-center gap-2 shadow-blue-600/20"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Simpan Opname
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest bg-zinc-50/50 dark:bg-zinc-800/50">
                    <th className="p-6">Produk</th>
                    <th className="p-6 text-center">Stok Sistem</th>
                    <th className="p-6 text-center">Stok Fisik (Aktual)</th>
                    <th className="p-6 text-center">Selisih (Variance)</th>
                    <th className="p-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredProducts.map((p) => {
                    const physical = opnameItems[p.id] ?? p.stock;
                    const system = p.stock;
                    const variance = physical - system;
                    
                    return (
                      <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group">
                        <td className="p-6">
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white">{p.name}</p>
                            <p className="text-[10px] text-zinc-400 font-medium">Seller: {p.profiles?.name}</p>
                          </div>
                        </td>
                        <td className="p-6 text-center font-mono font-bold text-zinc-500">{system}</td>
                        <td className="p-6">
                          <div className="flex justify-center">
                            <input 
                              type="number"
                              min="0"
                              value={physical}
                              onChange={(e) => handleUpdatePhysicalStock(p.id, e.target.value)}
                              className="w-20 h-10 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-700 rounded-xl text-center font-black text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className={`font-mono font-black ${variance === 0 ? 'text-zinc-400' : variance > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {variance > 0 ? `+${variance}` : variance}
                          </span>
                        </td>
                        <td className="p-6">
                          {variance !== 0 ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-amber-500">
                              <AlertTriangle className="w-3.5 h-3.5" /> Ada Selisih
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-emerald-500">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Sesuai
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {history.map((op) => (
            <div key={op.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-50 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-black text-zinc-900 dark:text-white">Opname oleh {op.profiles?.name || 'Admin'}</p>
                    <p className="text-xs text-zinc-400 font-medium">{format(new Date(op.created_at), 'dd MMMM yyyy, HH:mm', { locale: id })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="clay-badge bg-emerald-100 text-emerald-700">Selesai</span>
                </div>
              </div>
              
              {op.notes && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl mb-4 italic italic">"{op.notes}"</p>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Detail Selisih</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {op.stock_opname_items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{item.products?.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-zinc-400">{item.system_stock} → {item.physical_stock}</span>
                        <span className={`text-xs font-black ${item.variance > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {item.variance > 0 ? `+${item.variance}` : item.variance}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!op.stock_opname_items || op.stock_opname_items.length === 0) && (
                    <p className="text-xs text-zinc-400 font-medium italic p-2">Tidak ada selisih stok.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <ClipboardList className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold">Belum ada riwayat stock opname.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
