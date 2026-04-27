import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { formatRupiah, exportExcel, cn } from '../../../lib/utils';
import { format, isValid } from 'date-fns';
import { id } from 'date-fns/locale';
import { Download, CheckCircle2, XCircle, Eye, X, Receipt, Search, Filter, Calendar, ArrowRight, User, Image as ImageIcon, ExternalLink, Clock, Bell, Package, PackageCheck, Loader2 } from 'lucide-react';
import { Skeleton, TableRowSkeleton, TransactionSkeleton } from '../../../components/ui/Skeleton';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/useAuthStore';

export default function AdminTransactions() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [failedTransactions, setFailedTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'success' | 'failed'>('success');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [txItems, setTxItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sellers, setSellers] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sellerId: ''
  });
  const [sellerTxIds, setSellerTxIds] = useState<Set<string>>(new Set());
  const [sellerSubtotals, setSellerSubtotals] = useState<Record<string, number>>({});
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open transaction detail if ?id= param is present (from notification deep-link)
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl && (transactions.length > 0 || failedTransactions.length > 0)) {
      const tx = transactions.find(t => t.id === idFromUrl);
      const failedTx = failedTransactions.find(t => t.id === idFromUrl);
      
      if (tx) {
        if (activeTab !== 'success') setActiveTab('success');
        openDetails(tx, true);
        setSearchParams({}, { replace: true });
      } else if (failedTx) {
        if (activeTab !== 'failed') setActiveTab('failed');
        openDetails(failedTx, false);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, transactions, failedTransactions]);

  const handleAutoCleanup = async () => {
    try {
      // Use absolute path for reliability
      await fetch('/api/admin/transactions/cleanup', { method: 'POST' });
    } catch (e) {
      console.error('Auto-cleanup failed', e);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchSellers();
    handleAutoCleanup();
  }, []);

  useEffect(() => {
    if (filters.sellerId) {
      fetchSellerTransactionIds(filters.sellerId);
    } else {
      setSellerTxIds(new Set());
      setSellerSubtotals({});
    }
  }, [filters.sellerId]);

  const fetchSellers = async () => {
    const { data } = await supabase.from('profiles').select('id, name').eq('role', 'seller');
    setSellers(data || []);
  };

  const fetchSellerTransactionIds = async (sellerId: string) => {
    const { data } = await supabase
      .from('transaction_items')
      .select('transaction_id, price, quantity')
      .eq('seller_id', sellerId);
    
    if (data) {
      const ids = new Set<string>();
      const subtotals: Record<string, number> = {};
      data.forEach(item => {
        ids.add(item.transaction_id);
        subtotals[item.transaction_id] = (subtotals[item.transaction_id] || 0) + (item.price * item.quantity);
      });
      setSellerTxIds(ids);
      setSellerSubtotals(subtotals);
    }
  };

  const fetchTransactionItems = async (txId: string) => {
    try {
      setLoadingItems(true);
      const { data, error } = await supabase
        .from('transaction_items')
        .select('*, products(name, category)')
        .eq('transaction_id', txId);
      
      if (error) throw error;
      setTxItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoadingItems(false);
    }
  };

  const openDetails = async (tx: any, isSuccessTab: boolean = activeTab === 'success') => {
    setSelectedTx(tx);
    if (isSuccessTab) {
      await fetchTransactionItems(tx.id);
    } else {
      setTxItems([]);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (txError) throw txError;
      setTransactions(txData || []);

      const { data: failedData, error: failedError } = await supabase
        .from('failed_transactions')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (failedError) throw failedError;
      setFailedTransactions(failedData || []);

    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const dataToExport = activeTab === 'success' ? transactions : failedTransactions;
    if (dataToExport.length === 0) return;

    let headers: string[];
    let rows: (string | number | null)[][];

    if (activeTab === 'success') {
      headers = ['ID Transaksi', 'Nama Pembeli', 'Email Pembeli', 'Total Bayar (Rp)', 'Metode Bayar', 'Status', 'Tanggal'];
      rows = dataToExport.map(tx => [
        tx.id,
        tx.buyer_name,
        tx.buyer_email || '-',
        Number(tx.total_amount),
        tx.payment_method || '-',
        tx.status,
        format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm:ss')
      ]);
    } else {
      headers = ['ID', 'Nama Pembeli', 'Total Dicoba (Rp)', 'Alasan Gagal', 'Tanggal'];
      rows = dataToExport.map(tx => [
        tx.id,
        tx.buyer_name,
        Number(tx.attempted_amount),
        tx.reason,
        format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm:ss')
      ]);
    }

    exportExcel(headers, rows, `laporan_transaksi_${activeTab}_${format(new Date(), 'yyyyMMdd')}`, 'Laporan Transaksi');
  };

  const filteredTransactions = (activeTab === 'success' ? transactions : failedTransactions).filter(tx => {
    const matchesSearch = tx.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tx.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const txDate = new Date(tx.created_at);
    const matchesStartDate = !filters.startDate || txDate >= new Date(filters.startDate);
    const matchesEndDate = !filters.endDate || txDate <= new Date(filters.endDate + 'T23:59:59');
    
    const matchesSeller = !filters.sellerId || (activeTab === 'success' && sellerTxIds.has(tx.id));

    return matchesSearch && matchesStartDate && matchesEndDate && matchesSeller;
  });

  if (loading && transactions.length === 0) {
    return (
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-12 w-40 rounded-2xl" />
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <Skeleton className="h-12 w-full md:w-96 rounded-2xl" />
          <div className="flex gap-2 w-full md:w-auto">
            <Skeleton className="h-12 w-32 rounded-2xl" />
            <Skeleton className="h-12 w-32 rounded-2xl" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <th key={i} className="p-6"><Skeleton className="h-4 w-20" /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={5} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <TransactionSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">
            Riwayat Transaksi
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Pantau semua aktivitas pembayaran di SPS Corner
          </p>
        </div>
        <button 
          onClick={exportToExcel} 
          className="btn-clay-primary h-12 px-8 flex items-center gap-3"
        >
          <Download className="w-5 h-5" />
          Export Excel
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/50 w-full md:w-auto shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]">
          <button
            onClick={() => setActiveTab('success')}
            className={cn(
              "flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
              activeTab === 'success' 
                ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            Sukses
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={cn(
              "flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
              activeTab === 'failed' 
                ? "bg-white dark:bg-zinc-700 text-red-600 dark:text-red-400 shadow-sm" 
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            Gagal
          </button>
        </div>

        <div className="flex flex-1 flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex w-full md:w-auto gap-4 flex-1">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Cari pembeli atau ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-clay pl-12 h-12 w-full"
              />
            </div>
            <select 
              value={filters.sellerId}
              onChange={(e) => setFilters({...filters, sellerId: e.target.value})}
              className="input-clay h-12 appearance-none hidden md:block w-48 shrink-0"
            >
              <option value="">Semua Penjual</option>
              {sellers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "btn-clay-secondary h-12 px-6 flex items-center justify-center gap-2 transition-colors shrink-0 w-full md:w-auto",
              showFilters && "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white"
            )}
          >
            <Filter className="w-4 h-4" />
            <span className="inline">{showFilters ? 'Tutup Filter' : 'Filter Lanjut'}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-8 bg-zinc-50/30 dark:bg-zinc-800/30 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Dari Tanggal</label>
                <input 
                  type="date" 
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="input-clay h-12 w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Sampai Tanggal</label>
                <input 
                  type="date" 
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="input-clay h-12 w-full"
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button 
                  onClick={() => setFilters({ startDate: '', endDate: '', sellerId: '' })}
                  className="text-xs font-black text-red-500 dark:text-red-400 uppercase tracking-widest hover:text-red-600 dark:hover:text-red-300 transition-colors"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] bg-zinc-50/50 dark:bg-zinc-800/50">
                <th className="p-4 lg:p-6">ID & Waktu</th>
                <th className="p-4 lg:p-6">Pembeli</th>
                <th className="p-4 lg:p-6">Total</th>
                <th className="p-4 lg:p-6">Status</th>
                <th className="p-4 lg:p-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <AnimatePresence mode="popLayout">
                {filteredTransactions.map((tx) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={tx.id} 
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group"
                  >
                    <td className="p-4 lg:p-6">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-900 dark:text-white">
                          <Receipt className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                          {tx.id.slice(0, 8)}...
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                          <Calendar className="w-3.5 h-3.5" />
                          {isValid(new Date(tx.created_at)) ? format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm:ss', { locale: id }) : 'Waktu tidak valid'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 lg:p-6">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-zinc-900 dark:text-white text-sm lg:text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[150px] lg:max-w-[200px]">
                          {tx.buyer_name}
                        </p>
                        {tx.buyer_id && (
                          <span className="clay-badge bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">Member</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 lg:p-6">
                      <div className="flex flex-col">
                        <p className={`text-sm lg:text-base font-black tracking-tight ${activeTab === 'success' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
                          {formatRupiah(filters.sellerId && activeTab === 'success' ? (sellerSubtotals[tx.id] || 0) : (activeTab === 'success' ? tx.total_amount : tx.attempted_amount))}
                        </p>
                        {filters.sellerId && activeTab === 'success' && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Total Pesanan: {formatRupiah(tx.total_amount || 0)}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 lg:p-6">
                      {activeTab === 'success' ? (
                        <span className={`clay-badge ${
                          tx.status === 'success' || tx.status === 'paid' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' :
                          tx.status === 'processing' || tx.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
                          'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                        }`}>
                          {tx.status === 'success' || tx.status === 'paid' ? <CheckCircle2 className="w-3 h-3 mr-1.5" /> : 
                           tx.status === 'processing' || tx.status === 'pending' ? <Clock className="w-3 h-3 mr-1.5" /> : <XCircle className="w-3 h-3 mr-1.5" />}
                          {tx.status === 'success' ? 'Selesai' : 
                           tx.status === 'paid' ? 'Dibayar' : 
                           tx.status === 'processing' ? 'Proses' : 
                           tx.status === 'pending' ? 'Menunggu' : 'Gagal'}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="clay-badge bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 w-fit">
                            <XCircle className="w-3 h-3 mr-1.5" /> Gagal
                          </span>
                          <p className="text-[10px] text-red-600 dark:text-red-400 font-bold truncate max-w-[150px] lg:max-w-[200px]" title={tx.reason}>{tx.reason}</p>
                        </div>
                      )}
                    </td>
                    <td className="p-4 lg:p-6 text-right">
                      <button 
                        onClick={() => openDetails(tx)}
                        className="w-10 h-10 clay-icon bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4 lg:w-5 lg:h-5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          <AnimatePresence mode="popLayout">
            {filteredTransactions.map((tx) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                key={tx.id} 
                className="p-4 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-900 dark:text-white">
                      <Receipt className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                      {tx.id.slice(0, 8)}...
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(tx.created_at), 'dd MMM yy, HH:mm:ss', { locale: id })}
                    </span>
                  </div>
                  {activeTab === 'success' ? (
                    <span className={`clay-badge ${
                      tx.status === 'success' || tx.status === 'paid' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' :
                      tx.status === 'processing' || tx.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
                      'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                    }`}>
                      {tx.status === 'success' ? 'Selesai' : 
                       tx.status === 'paid' ? 'Dibayar' : 
                       tx.status === 'processing' ? 'Proses' : 
                       tx.status === 'pending' ? 'Menunggu' : 'Gagal'}
                    </span>
                  ) : (
                    <span className="clay-badge bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
                      Gagal
                    </span>
                  )}
                </div>
                
                <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-700/50 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)]">
                  <div>
                    <p className="text-[8px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Pembeli</p>
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-zinc-900 dark:text-white text-sm truncate max-w-[120px]">{tx.buyer_name}</p>
                      {tx.buyer_id && <span className="clay-badge bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-[8px]">Member</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Total</p>
                    <p className={`font-black text-sm ${activeTab === 'success' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
                      {formatRupiah(filters.sellerId && activeTab === 'success' ? sellerSubtotals[tx.id] : (activeTab === 'success' ? tx.total_amount : tx.attempted_amount))}
                    </p>
                    {filters.sellerId && activeTab === 'success' && (
                      <p className="text-[8px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Total Pesanan: {formatRupiah(tx.total_amount)}</p>
                    )}
                  </div>
                </div>

                {activeTab === 'failed' && tx.reason && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800/30 line-clamp-2">{tx.reason}</p>
                )}

                <button 
                  onClick={() => openDetails(tx)}
                  className="btn-clay-secondary w-full h-12 flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Lihat Detail
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="p-20 text-center">
            <div className="flex flex-col items-center gap-4 text-zinc-300 dark:text-zinc-600">
              <Receipt className="w-16 h-16 stroke-[1]" />
              <p className="font-bold text-zinc-400 dark:text-zinc-500">Tidak ada transaksi ditemukan</p>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTx(null)}
              className="absolute inset-0 bg-zinc-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl md:rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${activeTab === 'success' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>
                    <Receipt className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Detail Transaksi</h2>
                      {selectedTx.metadata?.sariroti_confirmed && (
                        <span className="clay-badge bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[10px]">
                          Sariroti Dikonfirmasi
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] md:text-xs text-zinc-400 dark:text-zinc-500 font-mono tracking-wider truncate max-w-[150px] md:max-w-none">{selectedTx.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTx(null)} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors">
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                  {/* Left Column: Info */}
                  <div className="space-y-8 md:space-y-10">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 md:p-8 space-y-6 bg-zinc-50/30 dark:bg-zinc-800/30">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Pembeli</span>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                          <span className="font-bold text-zinc-900 dark:text-white">{selectedTx.buyer_name}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Waktu</span>
                        <span className="font-bold text-zinc-900 dark:text-white text-right">
                          {format(new Date(selectedTx.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Status</span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          activeTab === 'success' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {activeTab === 'success' ? 'Berhasil' : 'Gagal'}
                        </span>
                      </div>
                      {activeTab === 'failed' && (
                        <div className="pt-6 border-t border-zinc-200/60 dark:border-zinc-700/50">
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-2">Alasan Penolakan</span>
                          <p className="text-red-700 dark:text-red-300 font-bold text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/30">{selectedTx.reason}</p>
                        </div>
                      )}
                      <div className="pt-8 border-t border-zinc-200/60 dark:border-zinc-700/50 flex flex-col md:flex-row md:justify-between md:items-end gap-2">
                        <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Total Bayar</span>
                        <span className={`text-3xl md:text-4xl font-black tracking-tighter ${activeTab === 'success' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
                          {formatRupiah(activeTab === 'success' ? selectedTx.total_amount : selectedTx.attempted_amount)}
                        </span>
                      </div>
                    </div>

                    {activeTab === 'success' && (
                      <div className="space-y-4 md:space-y-6">
                        <h3 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-500 dark:text-blue-400" /> Item Terbeli
                        </h3>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                          {loadingItems ? (
                            <div className="p-12 text-center">
                               <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
                            </div>
                          ) : txItems.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                                  <tr>
                                    <th className="px-4 md:px-6 py-4 text-left">Produk</th>
                                    <th className="px-4 md:px-6 py-4 text-right">Harga Satuan</th>
                                    <th className="px-4 md:px-6 py-4 text-center">Qty</th>
                                    <th className="px-4 md:px-6 py-4 text-center">Status</th>
                                    <th className="px-4 md:px-6 py-4 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                  {txItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                                      <td className="px-4 md:px-6 py-4 text-zinc-900 dark:text-white font-bold">
                                        {item.products?.name || item.metadata?.product_name || 'Produk Terhapus'}
                                        {item.metadata?.is_digital && (
                                          <span className="ml-2 text-[8px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">Digital</span>
                                        )}
                                      </td>
                                      <td className="px-4 md:px-6 py-4 text-right text-zinc-500 dark:text-zinc-400 font-medium">{formatRupiah(item.price)}</td>
                                      <td className="px-4 md:px-6 py-4 text-center text-zinc-500 dark:text-zinc-400 font-black">{item.quantity}</td>
                                      <td className="px-4 md:px-6 py-4 text-center">
                                        <span className={`clay-badge text-[8px] ${
                                          item.metadata?.status === 'delivered' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
                                          item.metadata?.status === 'failed' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' :
                                          item.metadata?.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 animate-pulse' :
                                          'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                        }`}>
                                          {item.metadata?.status === 'delivered' ? 'Sukses' : 
                                           item.metadata?.status === 'failed' ? 'Gagal' : 
                                           item.metadata?.status === 'processing' ? 'Proses' : 
                                           item.metadata?.status || 'Pending'}
                                        </span>
                                      </td>
                                      <td className="px-4 md:px-6 py-4 text-right text-zinc-900 dark:text-white font-black">{formatRupiah(item.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="p-12 text-center text-zinc-400 dark:text-zinc-500 font-medium italic">Tidak ada data item</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Receipt */}
                  <div className="space-y-4 md:space-y-6">
                    <h3 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" /> Bukti Pembayaran
                    </h3>
                    {selectedTx.receipt_image ? (
                      <div className="relative group rounded-3xl md:rounded-[2.5rem] overflow-hidden border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 aspect-[3/4] flex items-center justify-center shadow-inner">
                        <img 
                          src={selectedTx.receipt_image} 
                          alt="Struk" 
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-zinc-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                          <button 
                            onClick={() => window.open(selectedTx.receipt_image, '_blank')}
                            className="btn-clay-primary h-10 md:h-12 px-6 md:px-8 flex items-center gap-2 shadow-blue-600/20"
                          >
                            <ExternalLink className="w-4 h-4 md:w-5 md:h-5" />
                            Buka Gambar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-[3/4] bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl md:rounded-[2.5rem] border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-600 gap-4">
                        <Receipt className="w-16 md:w-20 h-16 md:h-20 stroke-[1]" />
                        <p className="font-bold uppercase tracking-widest text-[10px]">Tidak ada gambar bukti</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex flex-col gap-3">
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSelectedTx(null)} 
                    className="btn-clay-secondary h-10 md:h-12 px-8 md:px-10 flex-1"
                  >
                    Tutup Detail
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


