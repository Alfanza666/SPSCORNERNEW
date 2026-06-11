import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Package, TrendingUp, TrendingDown, RotateCcw, AlertTriangle, Calendar, ExternalLink, ClipboardList, PlusCircle, AlertCircle, Info, ShoppingCart, XCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

const TYPE_META = {
  initial:       { label: 'Awal',       icon: PlusCircle,    color: 'bg-sky-500',   text: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/20' },
  sale:          { label: 'Terjual',    icon: ShoppingCart,  color: 'bg-emerald-500', text: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20' },
  restock:       { label: 'Restock',    icon: TrendingUp,    color: 'bg-blue-500',   text: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' },
  correction:    { label: 'Koreksi',    icon: RotateCcw,     color: 'bg-amber-500',  text: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20' },
  manual_update: { label: 'Opname',     icon: ClipboardList, color: 'bg-purple-500', text: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20' },
};

export default function StockTrace({ isAdmin }: { isAdmin?: boolean }) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [productInfo, setProductInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      let q = supabase.from('products').select('id, name, stock, seller_id').order('name');
      if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) q = q.eq('seller_id', user.id);
      }
      const { data } = await q;
      setProducts(data || []);
    } catch (err: any) {
      toast.error('Gagal muat produk: ' + err.message);
    }
  };

  const loadMovements = useCallback(async (productId: string) => {
    if (!productId) { setEvents([]); setProductInfo(null); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const { data, error } = await supabase
        .from('stock_adjustments')
        .select('*, transactions!left(id, status, buyer_name, created_at)')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Ambil info produk
      const { data: prod } = await supabase
        .from('products')
        .select('id, name, stock, seller_id, created_at')
        .eq('id', productId)
        .single();

      if (!prod) { toast.error('Produk tidak ditemukan'); return; }

      let sellerName = '';
      if (prod.seller_id) {
        const { data: s } = await supabase.from('profiles').select('name').eq('id', prod.seller_id).single();
        sellerName = s?.name || '';
      }

      // Synthetic creation event
      const all = [];
      let initialStock;
      let gapInfo = null;

      if (!data || data.length === 0) {
        initialStock = prod.stock;
        all.push({
          id: 'creation', is_synthetic: true, created_at: prod.created_at,
          adjustment_type: 'initial', previous_stock: 0, new_stock: initialStock,
          delta: initialStock, notes: 'Produk dibuat — stok awal', transactions: null,
        });
      } else {
        initialStock = data[0].previous_stock;
        const last = data[data.length - 1];
        const expected = last.new_stock;
        const gap = prod.stock - expected;
        if (gap !== 0) gapInfo = { current: prod.stock, expected, diff: gap };

        all.push({
          id: 'creation', is_synthetic: true, created_at: prod.created_at,
          adjustment_type: 'initial', previous_stock: 0, new_stock: initialStock,
          delta: initialStock, notes: 'Produk dibuat — stok awal', transactions: null,
        });

        for (const a of data) {
          all.push({ ...a, is_synthetic: false, delta: a.new_stock - a.previous_stock });
        }
      }

      // Filter
      let filtered = all;
      if (filterType && filterType !== 'initial') filtered = filtered.filter((e: any) => e.adjustment_type === filterType);
      if (startDate) filtered = filtered.filter((e: any) => new Date(e.created_at) >= new Date(startDate));
      if (endDate) {
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        filtered = filtered.filter((e: any) => new Date(e.created_at) <= end);
      }

      setEvents(filtered);
      setProductInfo({ ...prod, seller_name: sellerName, initial_stock: initialStock, gap: gapInfo });
    } catch (err: any) {
      toast.error('Gagal muat riwayat: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, startDate, endDate]);

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getTypeMeta = (type: string) => {
    const m = TYPE_META[type as keyof typeof TYPE_META];
    if (m) return m;
    return { label: type, icon: AlertCircle, color: 'bg-zinc-400', text: 'text-zinc-600 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800' };
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* ── Header ───────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl md:text-2xl font-black text-zinc-800 dark:text-white flex items-center gap-3">
          <Search className="w-6 h-6 text-amber-500" />
          Lacak Riwayat Stok
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Pilih produk untuk melihat timeline mutasi stok secara detail</p>
      </motion.div>

      {/* ── Filter bar ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)}
            className="input-clay w-full pl-10 h-11 text-sm" />
        </div>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); if (selectedId) loadMovements(selectedId); }}
          className="input-clay h-11 text-sm">
          <option value="">Semua tipe</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={selectedId} onChange={e => { setSelectedId(e.target.value); loadMovements(e.target.value); }}
          className="input-clay h-11 text-sm">
          <option value="">— Pilih Produk —</option>
          {filteredProducts.map(p => (
            <option key={p.id} value={p.id}>{p.name} (🟢{p.stock})</option>
          ))}
        </select>
      </div>

      {/* ── Date filter ─────────────────────────── */}
      {selectedId && (
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="input-clay h-9 text-xs flex-1 min-w-[130px]" />
          <span className="text-zinc-400 text-sm">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="input-clay h-9 text-xs flex-1 min-w-[130px]" />
          <button onClick={() => loadMovements(selectedId)}
            className="btn-clay-primary h-9 px-4 text-xs flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Terapkan
          </button>
        </div>
      )}

      {/* ── Warning Gap ─────────────────────────── */}
      {productInfo?.gap && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">
            <strong>Stok tidak sinkron!</strong> Menurut sistem, stok seharusnya <strong>{productInfo.gap.expected}</strong>, tapi saat ini <strong>{productInfo.gap.current}</strong> (selisih <strong>{productInfo.gap.diff > 0 ? '+' : ''}{productInfo.gap.diff}</strong>).
            {productInfo.gap.diff > 0
              ? ' Ada kemungkinan stok ditambah langsung tanpa tercatat.'
              : ' Ada kemungkinan stok dikurangi langsung tanpa tercatat.'}
          </div>
        </motion.div>
      )}

      {/* ── Product Info Card ─────────────────────── */}
      {productInfo && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{productInfo.name}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span>Dibuat: <strong>{new Date(productInfo.created_at).toLocaleDateString('id-ID')}</strong></span>
                <span>Stok awal: <strong>{productInfo.initial_stock}</strong></span>
                <span>Penjual: <strong>{productInfo.seller_name || '-'}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-zinc-900 dark:text-white">{productInfo.stock}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Stok Saat Ini</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-zinc-500">{events.length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Kejadian</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Timeline ─────────────────────────────── */}
      {selectedId && (
        <div className="relative">
          {loading ? (
            <div className="text-center py-12 text-zinc-400 text-sm">Memuat riwayat...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 flex flex-col items-center gap-2">
              <Info className="w-8 h-8" />
              <p className="text-sm">Tidak ada data untuk filter ini</p>
            </div>
          ) : (
            <div className="space-y-0">
              {events.map((ev: any, i: number) => {
                const meta = getTypeMeta(ev.adjustment_type);
                const Icon = meta.icon;
                const isLast = i === events.length - 1;
                const delta = ev.delta;
                const tx = ev.transactions;
                const isCreation = ev.is_synthetic;

                return (
                  <div key={ev.id || i} className="flex gap-4 group">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center shrink-0 w-8">
                      <div className={`w-4 h-4 rounded-full ring-4 ring-white dark:ring-zinc-900 ${meta.color} flex items-center justify-center ${isCreation ? 'ring-offset-0' : ''}`}>
                        <Icon className="w-2 h-2 text-white" />
                      </div>
                      {!isLast && <div className="w-0.5 flex-1 bg-zinc-200 dark:bg-zinc-700 group-last:hidden" />}
                    </div>

                    {/* Content card */}
                    <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
                      <div className={`bg-white dark:bg-zinc-800/40 border ${ev.gap ? 'border-red-300 dark:border-red-700' : 'border-zinc-200 dark:border-zinc-700'} rounded-xl p-4 hover:shadow-sm transition-shadow`}>
                        {/* Row 1: type badge + timestamp */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.text}`}>
                              {meta.label}
                            </span>
                            {isCreation && (
                              <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">Pertama</span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400">
                            {new Date(ev.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>

                        {/* Row 2: quantity change */}
                        <div className="flex items-center gap-3">
                          <div className={`text-lg font-black ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                            {delta > 0 ? '+' : ''}{delta}
                          </div>
                          {!isCreation && (
                            <div className="text-xs text-zinc-400">
                              {ev.previous_stock} → <span className="font-bold text-zinc-700 dark:text-zinc-300">{ev.new_stock}</span>
                            </div>
                          )}
                          <div className="ml-auto text-xs text-zinc-400 truncate max-w-[200px]" title={ev.notes}>
                            {ev.notes?.replace(/transaction /g, '#') || ''}
                          </div>
                        </div>

                        {/* Row 3: transaction link */}
                        {(tx || ev.transaction_id) && (
                          <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center gap-2 text-xs">
                            <ShoppingCart className="w-3.5 h-3.5 text-zinc-400" />
                            {tx ? (
                              <>
                                <a href={`/dashboard/${isAdmin ? 'admin' : 'seller'}/transactions?id=${ev.transaction_id}`}
                                  className="text-amber-600 hover:underline inline-flex items-center gap-1">
                                  #{ev.transaction_id?.slice(0, 8)}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  tx.status === 'paid' || tx.status === 'success'
                                    ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
                                    : tx.status === 'failed' || tx.status === 'cancelled'
                                      ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
                                      : 'text-zinc-500 bg-zinc-100 dark:bg-zinc-700'
                                }`}>
                                  {tx.status === 'paid' || tx.status === 'success' ? '✅ Berhasil'
                                    : tx.status === 'failed' ? '❌ Gagal'
                                    : tx.status === 'cancelled' ? '✖ Batal'
                                    : tx.status}
                                </span>
                                <span className="text-zinc-400">{tx.buyer_name}</span>
                              </>
                            ) : (
                              <span className="text-zinc-400">#{ev.transaction_id?.slice(0, 8)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Akhir timeline */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center shrink-0 w-8">
                  <div className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-600 ring-4 ring-white dark:ring-zinc-900" />
                </div>
                <div className="text-xs text-zinc-400 pb-4 pt-0.5">Saat ini</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
