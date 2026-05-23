import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { BarChart3, Download, Search, Loader2, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

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
  const [report, setReport] = useState<ReportProduct[]>([]);
  const [sellers, setSellers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await (await import('../../../lib/supabase')).supabase.auth.getSession();
      const params = new URLSearchParams();
      if (sellerFilter) params.set('seller_id', sellerFilter);
      if (dateStart) params.set('date_start', dateStart);
      if (dateEnd) params.set('date_end', dateEnd);
      if (category) params.set('category', category);

      const res = await fetch(`/api/admin/stock-report?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch report');
      const data = await res.json();
      setReport(data.report || []);
      setSellers(data.sellers || {});
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Stock report error:', err);
    } finally {
      setLoading(false);
    }
  }, [sellerFilter, dateStart, dateEnd, category]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const filtered = report.filter(p =>
    !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = {
    products: filtered.length,
    stockAwal: filtered.reduce((s, p) => s + p.initialStock, 0),
    restock: filtered.reduce((s, p) => s + p.totalRestock, 0),
    sold: filtered.reduce((s, p) => s + p.totalSold, 0),
    returned: filtered.reduce((s, p) => s + p.totalReturned, 0),
    stockAkhir: filtered.reduce((s, p) => s + p.currentStock, 0),
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast.error('Tidak ada data untuk diexport');
      return;
    }

    const excelData = filtered.map((p, i) => ({
      No: i + 1,
      'Nama Produk': p.name,
      SKU: p.sku || '-',
      Seller: sellers[p.seller_id || ''] || '-',
      'Stok Awal': p.initialStock,
      Restock: p.totalRestock,
      Terjual: p.totalSold,
      Retur: p.totalReturned,
      'Stok Akhir': p.currentStock,
    }));

    excelData.push({
      No: '',
      'Nama Produk': 'TOTAL',
      SKU: '',
      Seller: '',
      'Stok Awal': totals.stockAwal,
      Restock: totals.restock,
      Terjual: totals.sold,
      Retur: totals.returned,
      'Stok Akhir': totals.stockAkhir,
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Stok');

    const colWidths = [
      { wch: 4 }, { wch: 40 }, { wch: 15 }, { wch: 20 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
    ];
    ws['!cols'] = colWidths;

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[addr]) continue;
      ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } } };
    }

    XLSX.writeFile(wb, `Laporan_Stok_SPS_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('File Excel berhasil di-download');
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Laporan pergerakan stok per produk dengan export Excel</p>
          </div>
        </div>
        <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-sm font-semibold shadow-sm">
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </button>
      </motion.div>

      {/* Summary Cards */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Produk', value: totals.products, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Stok Awal', value: totals.stockAwal, color: 'text-zinc-700', bg: 'bg-zinc-50 dark:bg-zinc-800' },
          { label: 'Restock', value: totals.restock, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Terjual', value: totals.sold, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Retur', value: totals.returned, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Stok Akhir', value: totals.stockAkhir, color: 'text-zinc-800', bg: 'bg-zinc-100 dark:bg-zinc-700' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-xl p-4 border border-zinc-200/50 dark:border-zinc-700/50`}>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{card.label}</div>
            <div className={`text-xl font-bold ${card.color} tabular-nums`}>{card.value.toLocaleString('id-ID')}</div>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text" placeholder="Cari produk..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm min-w-[160px]">
          <option value="">Semua Seller</option>
          {Object.entries(sellers).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" />
        <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" />
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-400"><BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>Tidak ada data</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 sticky top-0">
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
                {filtered.map(p => (
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
              <tfoot className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/80">
                <tr>
                  <td className="px-4 py-3 font-bold text-zinc-800 dark:text-zinc-100">TOTAL</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-bold font-mono tabular-nums">{totals.stockAwal}</td>
                  <td className="px-4 py-3 text-right font-bold font-mono tabular-nums text-emerald-600">{totals.restock}</td>
                  <td className="px-4 py-3 text-right font-bold font-mono tabular-nums text-orange-600">{totals.sold}</td>
                  <td className="px-4 py-3 text-right font-bold font-mono tabular-nums text-blue-600">{totals.returned}</td>
                  <td className="px-4 py-3 text-right font-bold font-mono tabular-nums">{totals.stockAkhir}</td>
                </tr>
              </tfoot>
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
