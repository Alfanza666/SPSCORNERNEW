import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatRupiah } from '../../../lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Download, CheckCircle2, XCircle, Eye, X, Receipt, Search, Filter, Calendar, ArrowRight, User, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminTransactions() {
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

  useEffect(() => {
    fetchTransactions();
    fetchSellers();
  }, []);

  useEffect(() => {
    if (filters.sellerId) {
      fetchSellerTransactionIds(filters.sellerId);
    } else {
      setSellerTxIds(new Set());
    }
  }, [filters.sellerId]);

  const fetchSellers = async () => {
    const { data } = await supabase.from('profiles').select('id, name').eq('role', 'seller');
    setSellers(data || []);
  };

  const fetchSellerTransactionIds = async (sellerId: string) => {
    const { data } = await supabase
      .from('transaction_items')
      .select('transaction_id')
      .eq('seller_id', sellerId);
    
    if (data) {
      setSellerTxIds(new Set(data.map(item => item.transaction_id)));
    }
  };

  const fetchTransactionItems = async (txId: string) => {
    try {
      setLoadingItems(true);
      const { data, error } = await supabase
        .from('transaction_items')
        .select('*, products(name)')
        .eq('transaction_id', txId);
      
      if (error) throw error;
      setTxItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoadingItems(false);
    }
  };

  const openDetails = async (tx: any) => {
    setSelectedTx(tx);
    if (activeTab === 'success') {
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

  const exportToCSV = () => {
    const dataToExport = activeTab === 'success' ? transactions : failedTransactions;
    if (dataToExport.length === 0) return;
    
    let headers = [];
    let csvContent = [];

    if (activeTab === 'success') {
      headers = ['ID', 'Pembeli', 'Total', 'Status', 'Tanggal'];
      csvContent = [
        headers.join(','),
        ...dataToExport.map(tx => 
          `${tx.id},"${tx.buyer_name}",${tx.total_amount},${tx.status},"${format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
        )
      ];
    } else {
      headers = ['ID', 'Pembeli', 'Total Dicoba', 'Alasan', 'Tanggal'];
      csvContent = [
        headers.join(','),
        ...dataToExport.map(tx => 
          `${tx.id},"${tx.buyer_name}",${tx.attempted_amount},"${tx.reason}","${format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
        )
      ];
    }

    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_transaksi_${activeTab}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight mb-2">
            Riwayat Transaksi
          </h1>
          <p className="text-zinc-500 font-medium flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-500" />
            Pantau semua aktivitas pembayaran di SPS Corner
          </p>
        </div>
        <button 
          onClick={exportToCSV} 
          className="btn-primary h-14 px-8 flex items-center gap-3 shadow-emerald-600/20"
        >
          <Download className="w-5 h-5" />
          Export Laporan
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200/60 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('success')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'success' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Sukses
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'failed' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Gagal
          </button>
        </div>

        <div className="flex flex-1 items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Cari pembeli atau ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-12 h-14"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary h-14 px-6 flex items-center gap-2 transition-colors shrink-0 ${showFilters ? 'bg-zinc-900 text-white border-zinc-900' : ''}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">{showFilters ? 'Tutup Filter' : 'Filter Lanjut'}</span>
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
            <div className="glass-card p-8 border-zinc-200/60 bg-zinc-50/30 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Dari Tanggal</label>
                <input 
                  type="date" 
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="input-field h-12"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Sampai Tanggal</label>
                <input 
                  type="date" 
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="input-field h-12"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Filter Penjual</label>
                <select 
                  value={filters.sellerId}
                  onChange={(e) => setFilters({...filters, sellerId: e.target.value})}
                  className="input-field h-12 appearance-none"
                >
                  <option value="">Semua Penjual</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button 
                  onClick={() => setFilters({ startDate: '', endDate: '', sellerId: '' })}
                  className="text-xs font-black text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card overflow-hidden border-zinc-200/60 shadow-xl shadow-zinc-200/40">
        {/* Desktop View */}
        <div className="hidden md:block divide-y divide-zinc-100">
          {filteredTransactions.map((tx) => (
            <motion.div 
              layout
              key={tx.id} 
              className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between hover:bg-zinc-50/50 transition-colors group gap-6"
            >
              <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner ${
                  activeTab === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                  {activeTab === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-black text-zinc-900 text-xl group-hover:text-emerald-600 transition-colors">{tx.buyer_name}</p>
                    {tx.buyer_id && (
                      <span className="bg-zinc-100 text-zinc-500 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Member</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono">
                      <Receipt className="w-3.5 h-3.5" />
                      ID: {tx.id.slice(0, 12)}...
                    </span>
                  </div>
                  {activeTab === 'failed' && (
                    <div className="mt-3 bg-red-50/50 p-3 rounded-xl border border-red-100/50 inline-flex items-center gap-2">
                       <XCircle className="w-3.5 h-3.5 text-red-500" />
                       <p className="text-[10px] text-red-700 font-bold uppercase tracking-wider">{tx.reason}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 pt-4 md:pt-0">
                <div className="text-left md:text-right">
                  <p className={`text-2xl font-black tracking-tight ${activeTab === 'success' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                    {formatRupiah(activeTab === 'success' ? tx.total_amount : tx.attempted_amount)}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em] mt-1">
                    {activeTab === 'success' ? 'Pembayaran Berhasil' : 'Validasi Ditolak'}
                  </p>
                </div>
                <button 
                  onClick={() => openDetails(tx)}
                  className="w-12 h-12 rounded-xl bg-zinc-100 text-zinc-400 hover:bg-zinc-900 hover:text-white flex items-center justify-center transition-all shadow-sm"
                >
                  <Eye className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    activeTab === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {activeTab === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">{tx.buyer_name}</p>
                    <p className="text-[10px] text-zinc-400">{format(new Date(tx.created_at), 'dd MMM, HH:mm', { locale: id })}</p>
                  </div>
                </div>
                <button 
                  onClick={() => openDetails(tx)}
                  className="p-2 text-zinc-400 hover:text-emerald-500"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Total</p>
                  <p className={`font-black text-sm ${activeTab === 'success' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                    {formatRupiah(activeTab === 'success' ? tx.total_amount : tx.attempted_amount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Status</p>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${
                    activeTab === 'success' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {activeTab === 'success' ? 'Berhasil' : 'Gagal'}
                  </span>
                </div>
              </div>
              {activeTab === 'failed' && (
                <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                  <p className="text-[10px] text-red-700 font-medium leading-relaxed">
                    <span className="font-black uppercase mr-1">Alasan:</span>
                    {tx.reason}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredTransactions.length === 0 && (
          <div className="p-20 text-center">
            <div className="flex flex-col items-center gap-4 text-zinc-300">
              <Receipt className="w-16 h-16 stroke-[1]" />
              <p className="font-bold text-zinc-400">Tidak ada transaksi ditemukan</p>
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
              className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 border border-zinc-200"
            >
              <div className="p-6 md:p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${activeTab === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                    <Receipt className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">Detail Transaksi</h2>
                    <p className="text-[10px] md:text-xs text-zinc-400 font-mono tracking-wider truncate max-w-[150px] md:max-w-none">{selectedTx.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTx(null)} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-900 flex items-center justify-center transition-colors">
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                  {/* Left Column: Info */}
                  <div className="space-y-8 md:space-y-10">
                    <div className="glass-card p-6 md:p-8 space-y-6 border-zinc-200/60 bg-zinc-50/30">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pembeli</span>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-emerald-500" />
                          <span className="font-bold text-zinc-900">{selectedTx.buyer_name}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Waktu</span>
                        <span className="font-bold text-zinc-900 text-right">
                          {format(new Date(selectedTx.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          activeTab === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {activeTab === 'success' ? 'Berhasil' : 'Gagal'}
                        </span>
                      </div>
                      {activeTab === 'failed' && (
                        <div className="pt-6 border-t border-zinc-200/60">
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-2">Alasan Penolakan</span>
                          <p className="text-red-700 font-bold text-sm bg-red-50 p-4 rounded-xl border border-red-100">{selectedTx.reason}</p>
                        </div>
                      )}
                      <div className="pt-8 border-t border-zinc-200/60 flex flex-col md:flex-row md:justify-between md:items-end gap-2">
                        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Total Bayar</span>
                        <span className={`text-3xl md:text-4xl font-black tracking-tighter ${activeTab === 'success' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                          {formatRupiah(activeTab === 'success' ? selectedTx.total_amount : selectedTx.attempted_amount)}
                        </span>
                      </div>
                    </div>

                    {activeTab === 'success' && (
                      <div className="space-y-4 md:space-y-6">
                        <h3 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                          <Package className="w-4 h-4 text-emerald-500" /> Item Terbeli
                        </h3>
                        <div className="glass-card overflow-hidden border-zinc-200/60">
                          {loadingItems ? (
                            <div className="p-12 text-center">
                               <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                            </div>
                          ) : txItems.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-zinc-50 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                  <tr>
                                    <th className="px-4 md:px-6 py-4 text-left">Produk</th>
                                    <th className="px-4 md:px-6 py-4 text-center">Qty</th>
                                    <th className="px-4 md:px-6 py-4 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {txItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                                      <td className="px-4 md:px-6 py-4 text-zinc-900 font-bold">{item.products?.name || 'Produk Terhapus'}</td>
                                      <td className="px-4 md:px-6 py-4 text-center text-zinc-500 font-black">{item.quantity}</td>
                                      <td className="px-4 md:px-6 py-4 text-right text-zinc-900 font-black">{formatRupiah(item.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="p-12 text-center text-zinc-400 font-medium italic">Tidak ada data item</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Receipt */}
                  <div className="space-y-4 md:space-y-6">
                    <h3 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-500" /> Bukti Pembayaran
                    </h3>
                    {selectedTx.receipt_image ? (
                      <div className="relative group rounded-3xl md:rounded-[2.5rem] overflow-hidden border-2 border-zinc-100 bg-zinc-50 aspect-[3/4] flex items-center justify-center shadow-inner">
                        <img 
                          src={selectedTx.receipt_image} 
                          alt="Struk" 
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-zinc-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                          <button 
                            onClick={() => window.open(selectedTx.receipt_image, '_blank')}
                            className="btn-primary h-12 md:h-14 px-6 md:px-8 flex items-center gap-2 shadow-emerald-600/20"
                          >
                            <ExternalLink className="w-4 h-4 md:w-5 md:h-5" />
                            Buka Gambar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-[3/4] bg-zinc-50 rounded-3xl md:rounded-[2.5rem] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-300 gap-4">
                        <Receipt className="w-16 md:w-20 h-16 md:h-20 stroke-[1]" />
                        <p className="font-bold uppercase tracking-widest text-[10px]">Tidak ada gambar bukti</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
                <button 
                  onClick={() => setSelectedTx(null)} 
                  className="btn-secondary h-12 md:h-14 px-8 md:px-10 w-full md:w-auto"
                >
                  Tutup Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Package = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7.5 4.27 9 5.15" />
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
);

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
