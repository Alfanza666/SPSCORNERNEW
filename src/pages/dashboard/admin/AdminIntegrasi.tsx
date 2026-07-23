import { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { supabase } from '../../../lib/supabase';
import { formatRupiah } from '../../../lib/utils';
import {
  Plug, RefreshCw, Search, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, ExternalLink, Loader2, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'history' | 'callbacks' | 'lookup';

export default function AdminIntegrasi() {
  const { user } = useAuthStore();
  const isSuperadmin = user?.role === 'superadmin';
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [loading, setLoading] = useState(false);

  // History state
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyStatus, setHistoryStatus] = useState('1');
  const [historyStart, setHistoryStart] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [historyEnd, setHistoryEnd] = useState(new Date().toISOString().slice(0, 10));

  // Callbacks state
  const [callbackData, setCallbackData] = useState<any[]>([]);
  const [callbackPage, setCallbackPage] = useState(0);
  const [callbackTotal, setCallbackTotal] = useState(0);

  // Lookup state
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);

  const headers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  };

  if (!isSuperadmin) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-zinc-500 font-bold">Akses hanya untuk Superadmin.</p>
      </div>
    );
  }

  const fetchHistory = async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ipaymu/history?status=${historyStatus}&startdate=${historyStart}&enddate=${historyEnd}&page=${page}&limit=20`, { headers: await headers() });
      const data = await res.json();
      if (data.success && data.data?.Data) {
        setHistoryData(data.data.Data.Transaction || []);
        setHistoryTotal(data.data.Data.Pagination?.total || 0);
      }
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const fetchCallbacks = async (offset: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ipaymu/callbacks?limit=20&offset=${offset}`, { headers: await headers() });
      const data = await res.json();
      if (data.success) {
        setCallbackData(data.data || []);
        setCallbackTotal(data.total || 0);
      }
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const lookupTransaction = async () => {
    if (!lookupId.trim()) return;
    setLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/admin/ipaymu/status/${lookupId.trim()}`, { headers: await headers() });
      const data = await res.json();
      if (data.success) setLookupResult(data.data);
      else toast.error(data.error || 'Not found');
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory(historyPage);
    if (activeTab === 'callbacks') fetchCallbacks(callbackPage);
  }, [activeTab, historyPage, callbackPage]);

  const statusBadge = (status: number) => {
    const map: Record<number, { label: string; color: string }> = {
      1: { label: 'Berhasil', color: 'bg-emerald-100 text-emerald-700' },
      6: { label: 'Unsettled', color: 'bg-blue-100 text-blue-700' },
      0: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
      '-2': { label: 'Expired', color: 'bg-zinc-100 text-zinc-500' },
      5: { label: 'Gagal', color: 'bg-red-100 text-red-600' },
    };
    const s = map[status] || { label: String(status), color: 'bg-zinc-100 text-zinc-500' };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.color}`}>{s.label}</span>;
  };

  const dbStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: 'bg-emerald-100 text-emerald-700',
      success: 'bg-emerald-100 text-emerald-700',
      pending: 'bg-amber-100 text-amber-700',
      failed: 'bg-red-100 text-red-600',
    };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>{status}</span>;
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'history', label: 'Riwayat iPaymu', icon: Clock },
    { key: 'callbacks', label: 'Callback Logs', icon: Plug },
    { key: 'lookup', label: 'Cek Status', icon: Search },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
          <Plug className="w-6 h-6" /> Integrasi iPaymu
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Monitor callback, riwayat transaksi, dan status pembayaran iPaymu.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── History Tab ─── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Status</label>
              <select value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}
                className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold">
                <option value="1">Berhasil (1)</option>
                <option value="6">Unsettled (6)</option>
                <option value="0">Pending (0)</option>
                <option value="-2">Expired (-2)</option>
                <option value="5">Gagal (5)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Dari</label>
              <input type="date" value={historyStart} onChange={e => setHistoryStart(e.target.value)}
                className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Sampai</label>
              <input type="date" value={historyEnd} onChange={e => setHistoryEnd(e.target.value)}
                className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold" />
            </div>
            <button onClick={() => { setHistoryPage(1); fetchHistory(1); }} disabled={loading}
              className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Muat
            </button>
          </div>

          <p className="text-[10px] text-zinc-400 font-bold">Total: {historyTotal} transaksi</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">TrxID</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Tanggal</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Pembeli</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Channel</th>
                  <th className="text-right py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Amount</th>
                  <th className="text-right py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Fee</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Ref</th>
                </tr>
              </thead>
              <tbody>
                {historyData.map((tx: any) => (
                  <tr key={tx.TransactionId} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="py-2 px-3 font-mono text-zinc-600">{tx.TransactionId}</td>
                    <td className="py-2 px-3 text-zinc-500">{tx.CreatedDate}</td>
                    <td className="py-2 px-3 font-bold">{tx.BuyerName || tx.Receiver}</td>
                    <td className="py-2 px-3">{tx.PaymentChannel}</td>
                    <td className="py-2 px-3 text-right font-bold">{formatRupiah(tx.Amount)}</td>
                    <td className="py-2 px-3 text-right text-zinc-400">{formatRupiah(tx.Fee)}</td>
                    <td className="py-2 px-3">{statusBadge(tx.Status)}</td>
                    <td className="py-2 px-3 font-mono text-zinc-400 text-[10px]">{tx.ReferenceId?.slice(0, 8)}</td>
                  </tr>
                ))}
                {historyData.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-zinc-400">Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {historyTotal > 20 && (
            <div className="flex items-center justify-between">
              <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage <= 1}
                className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-1 disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
              </button>
              <span className="text-[10px] text-zinc-400 font-bold">Hal {historyPage} / {Math.ceil(historyTotal / 20)}</span>
              <button onClick={() => setHistoryPage(p => p + 1)} disabled={historyPage >= Math.ceil(historyTotal / 20)}
                className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-1 disabled:opacity-30">
                Berikutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Callbacks Tab ─── */}
      {activeTab === 'callbacks' && (
        <div className="space-y-4">
          <button onClick={() => fetchCallbacks(callbackPage)} disabled={loading}
            className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Muat Ulang
          </button>

          <p className="text-[10px] text-zinc-400 font-bold">Total: {callbackTotal} transaksi dengan iPaymu TrxID</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">ID</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Waktu</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Pembeli</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Method</th>
                  <th className="text-right py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Amount</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">Status DB</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">iPaymu TrxID</th>
                  <th className="text-left py-2 px-3 font-bold text-zinc-400 uppercase tracking-widest">iPaymu Status</th>
                </tr>
              </thead>
              <tbody>
                {callbackData.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="py-2 px-3 font-mono text-zinc-600">{tx.id.slice(0, 8)}</td>
                    <td className="py-2 px-3 text-zinc-500">{new Date(tx.created_at).toLocaleString('id-ID')}</td>
                    <td className="py-2 px-3 font-bold">{tx.buyer_name}</td>
                    <td className="py-2 px-3">{tx.payment_method || '-'}</td>
                    <td className="py-2 px-3 text-right font-bold">{formatRupiah(tx.total_amount)}</td>
                    <td className="py-2 px-3">{dbStatusBadge(tx.status)}</td>
                    <td className="py-2 px-3 font-mono text-zinc-400 text-[10px]">{tx.payment_details?.ipaymu_trx_id || '-'}</td>
                    <td className="py-2 px-3 font-mono text-[10px]">{tx.payment_details?.ipaymu_status || '-'}</td>
                  </tr>
                ))}
                {callbackData.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-zinc-400">Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {callbackTotal > 20 && (
            <div className="flex items-center justify-between">
              <button onClick={() => { setCallbackPage(p => Math.max(0, p - 20)); fetchCallbacks(Math.max(0, callbackPage - 20)); }}
                disabled={callbackPage <= 0}
                className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-1 disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
              </button>
              <span className="text-[10px] text-zinc-400 font-bold">Menampilkan {callbackPage + 1}-{Math.min(callbackPage + 20, callbackTotal)} dari {callbackTotal}</span>
              <button onClick={() => { setCallbackPage(p => p + 20); fetchCallbacks(callbackPage + 20); }}
                disabled={callbackPage + 20 >= callbackTotal}
                className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-1 disabled:opacity-30">
                Berikutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Lookup Tab ─── */}
      {activeTab === 'lookup' && (
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-md">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Transaction ID iPaymu</label>
              <input type="text" value={lookupId} onChange={e => setLookupId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupTransaction()}
                placeholder="Masukkan Transaction ID atau Reference ID..."
                className="h-10 w-full px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono" />
            </div>
            <button onClick={lookupTransaction} disabled={loading || !lookupId.trim()}
              className="h-10 px-5 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Cek
            </button>
          </div>

          {lookupResult?.Data && (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-black">Transaksi Ditemukan</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Transaction ID</p>
                  <p className="font-mono font-bold">{lookupResult.Data.TransactionId}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Status</p>
                  {statusBadge(lookupResult.Data.Status)}
                  <span className="ml-1 text-zinc-500">({lookupResult.Data.StatusDesc})</span>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Paid Status</p>
                  <p className="font-bold">{lookupResult.Data.PaidStatus || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Amount</p>
                  <p className="font-bold">{formatRupiah(lookupResult.Data.Amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Fee</p>
                  <p className="font-bold">{formatRupiah(lookupResult.Data.Fee)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Type</p>
                  <p className="font-bold">{lookupResult.Data.TypeDesc}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Created</p>
                  <p>{lookupResult.Data.CreatedDate}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Success</p>
                  <p>{lookupResult.Data.SuccessDate || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Expired</p>
                  <p>{lookupResult.Data.ExpiredDate}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Settlement</p>
                  <p>{lookupResult.Data.SettlementDate || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Sender</p>
                  <p className="font-bold">{lookupResult.Data.Sender}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Receiver</p>
                  <p className="font-bold">{lookupResult.Data.Receiver}</p>
                </div>
              </div>
            </div>
          )}
          {lookupResult && !lookupResult.Data && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
              <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-red-600">Transaksi tidak ditemukan di iPaymu</p>
              <p className="text-xs text-red-400 mt-1">{lookupResult.Message || ''}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
