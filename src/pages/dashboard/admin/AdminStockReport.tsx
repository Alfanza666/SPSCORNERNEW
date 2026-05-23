import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { BarChart3, Download, Search, Loader2, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ReportProduct {
  id: string;
  name: string;
  sku: string;
  seller_id: string | null;
  createdAt: string;
  initialStock: number;
  totalRestock: number;
  totalSold: number;
  totalReturned: number;
  currentStock: number;
}

export default function AdminStockReport() {
  const user = useAuthStore(s => s.user);
  const [report, setReport] = useState<ReportProduct[]>([]);
  const [sellers, setSellers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await (await import('../../../lib/supabase')).supabase.auth.getSession();
      const params = new URLSearchParams();
      if (sellerFilter) params.set('seller_id', sellerFilter);

      const res = await fetch(`/api/admin/stock-report?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch report');
      const data = await res.json();
      setReport(data.report || []);
      setSellers(data.sellers || {});
    } catch (err) {
      console.error('Stock report error:', err);
    } finally {
      setLoading(false);
    }
  }, [sellerFilter]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const filtered = report.filter(p =>
    !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['Nama Produk', 'SKU', 'Seller', 'Stok Awal', 'Total Restock', 'Total Terjual', 'Total Retur', 'Stok Akhir'];
    const rows = filtered.map(p => [
      p.name,
      p.sku,
      sellers[p.seller_id || ''] || '—',
      p.initialStock,
      p.totalRestock,
      p.totalSold,
      p.totalReturned,
      p.currentStock,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Laporan Stok</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ringkasan pergerakan stok per produk</p>
          </div>
        </div>
        <button onClick={handleExportCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-sm font-medium shadow-sm">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <select
          value={sellerFilter}
          onChange={e => setSellerFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all min-w-[180px]"
        >
          <option value="">Semua Seller</option>
          {Object.entries(sellers).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Tidak ada data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80">
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">Produk</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">Seller</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">Stok Awal</th>
                  <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Restock</th>
                  <th className="text-right px-4 py-3 font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">Terjual</th>
                  <th className="text-right px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">Retur</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">Stok Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                {filtered.map((p, i) => (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">{p.name}</div>
                      {p.sku && <div className="text-xs text-zinc-400">{p.sku}</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{sellers[p.seller_id || ''] || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{p.initialStock}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{p.totalRestock > 0 ? `+${p.totalRestock}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-orange-600 dark:text-orange-400 font-medium">{p.totalSold > 0 ? `-${p.totalSold}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400 font-medium">{p.totalReturned > 0 ? `+${p.totalReturned}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-zinc-800 dark:text-zinc-100">{p.currentStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {!loading && (
        <div className="text-xs text-zinc-400 text-right">
          Menampilkan {filtered.length} dari {report.length} produk
        </div>
      )}
    </div>
  );
}
