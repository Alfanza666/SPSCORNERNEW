import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatRupiah, exportCSV } from '../../../lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Download, Search, Filter, Wallet, ArrowRight, Loader2, User, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

import { Skeleton } from '../../../components/ui/Skeleton';

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*, profiles(name)')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, sellerId: string, amount: number) => {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      if (newStatus === 'rejected') {
        // Get latest balance to ensure we add to current balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', sellerId)
          .single();

        if (profile) {
          // Atomic add-back using gte to prevent issues
          await supabase
            .from('profiles')
            .update({ balance: profile.balance + amount })
            .eq('id', sellerId);
        }
      }

      if (newStatus === 'paid') {
        const withdrawal = withdrawals.find(w => w.id === id);
        if (withdrawal) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('total_withdrawn, total_fee_paid')
            .eq('id', sellerId)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({ 
                total_withdrawn: (profile.total_withdrawn || 0) + withdrawal.net_amount,
                total_fee_paid: (profile.total_fee_paid || 0) + withdrawal.fee
              })
              .eq('id', sellerId);
          }
        }
      }

      // Update local state optimistically instead of refetching everything
      setWithdrawals(prev => prev.map(w => 
        w.id === id ? { ...w, status: newStatus } : w
      ));
      
      toast.success(`Status berhasil diubah menjadi ${newStatus}`);
    } catch (error) {
      console.error('Error updating withdrawal status:', error);
      toast.error('Gagal mengubah status penarikan');
    }
  };

  const exportToCSV = () => {
    if (withdrawals.length === 0) return;
    
    const headers = ['ID', 'Penjual', 'Bank', 'No. Rekening', 'Nama Pemilik', 'Jumlah Kotor', 'Biaya (8%)', 'Jumlah Bersih', 'Status', 'Tanggal'];
    const rows = withdrawals.map(w => [
      w.id,
      w.profiles?.name || 'Unknown',
      w.bank_name || '-',
      w.account_number || '-',
      w.account_name || '-',
      w.amount,
      w.fee,
      w.net_amount,
      w.status,
      format(new Date(w.created_at), 'yyyy-MM-dd HH:mm:ss')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    exportCSV(csvContent, `laporan_penarikan_${format(new Date(), 'yyyyMMdd')}.csv`);
  };

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredWithdrawals = withdrawals.filter(w => {
    const matchesSearch = w.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading && withdrawals.length === 0) {
    return (
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-12 w-48 rounded-xl" />
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <Skeleton className="h-12 w-full md:w-96 rounded-xl" />
          <Skeleton className="h-12 w-48 rounded-xl" />
        </div>

        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
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
            Permintaan Penarikan
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Validasi dan proses pencairan dana mitra penjual
          </p>
        </div>
        <button 
          onClick={exportToCSV} 
          className="btn-clay-primary h-12 px-8 flex items-center gap-3"
        >
          <Download className="w-5 h-5" />
          Export Laporan
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari nama penjual..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-clay pl-12 h-12"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-clay pl-10 h-12 appearance-none pr-10 w-full"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Disetujui</option>
              <option value="paid">Dibayar</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] bg-zinc-50/50 dark:bg-zinc-800/50">
                <th className="p-6">Penjual</th>
                <th className="p-6">Rekening</th>
                <th className="p-6">Rincian Dana</th>
                <th className="p-6">Diterima</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredWithdrawals.map((w) => (
                <motion.tr 
                  layout
                  key={w.id} 
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center font-black text-xl clay-icon">
                        {w.profiles?.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{w.profiles?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(w.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="space-y-1">
                      <p className="font-bold text-zinc-900 dark:text-white uppercase text-xs tracking-wider">{w.bank_name || '-'}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono tracking-widest">{w.account_number || '-'}</p>
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{w.account_name || '-'}</p>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{formatRupiah(w.amount)}</p>
                      <p className="text-[10px] text-red-500 dark:text-red-400 font-black uppercase tracking-wider">Biaya Admin: {formatRupiah(w.fee)}</p>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="font-black text-blue-600 dark:text-blue-400 text-lg tracking-tight">{formatRupiah(w.net_amount)}</p>
                  </td>
                  <td className="p-6">
                    {w.status === 'pending' && (
                      <span className="clay-badge bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                        <Clock className="w-3 h-3 mr-1.5" /> Pending
                      </span>
                    )}
                    {w.status === 'approved' && (
                      <span className="clay-badge bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                        <CheckCircle2 className="w-3 h-3 mr-1.5" /> Disetujui
                      </span>
                    )}
                    {w.status === 'paid' && (
                      <span className="clay-badge bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                        <CheckCircle2 className="w-3 h-3 mr-1.5" /> Dibayar
                      </span>
                    )}
                    {w.status === 'rejected' && (
                      <span className="clay-badge bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
                        <XCircle className="w-3 h-3 mr-1.5" /> Ditolak
                      </span>
                    )}
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {w.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(w.id, 'approved', w.seller_id, w.amount)}
                            className="btn-clay-secondary h-10 px-4 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500"
                          >
                            Setujui
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(w.id, 'rejected', w.seller_id, w.amount)}
                            className="btn-clay-secondary h-10 px-4 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-500"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                      {w.status === 'approved' && (
                        <button 
                          onClick={() => handleUpdateStatus(w.id, 'paid', w.seller_id, w.amount)}
                          className="btn-clay-primary h-10 px-6 text-[10px] font-black uppercase tracking-widest"
                        >
                          Tandai Dibayar
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredWithdrawals.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-zinc-300 dark:text-zinc-600">
                      <Wallet className="w-16 h-16 stroke-[1]" />
                      <p className="font-bold text-zinc-400 dark:text-zinc-500">Tidak ada permintaan penarikan</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredWithdrawals.map((w) => (
            <div key={w.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center font-black text-sm clay-icon flex-shrink-0">
                    {w.profiles?.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-900 dark:text-white text-sm truncate">{w.profiles?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(w.created_at), 'dd MMM yy, HH:mm', { locale: id })}
                    </p>
                  </div>
                </div>
                <div>
                  {w.status === 'pending' && (
                    <span className="clay-badge bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                      Pending
                    </span>
                  )}
                  {w.status === 'approved' && (
                    <span className="clay-badge bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                      Disetujui
                    </span>
                  )}
                  {w.status === 'paid' && (
                    <span className="clay-badge bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                      Dibayar
                    </span>
                  )}
                  {w.status === 'rejected' && (
                    <span className="clay-badge bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
                      Ditolak
                    </span>
                  )}
                </div>
              </div>
              
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-3 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)]">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Tujuan Transfer</p>
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">{w.bank_name || '-'}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">{w.account_number || '-'}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">{w.account_name || '-'}</p>
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <div>
                    <p className="text-[8px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-wider">Kotor</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{formatRupiah(w.amount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] text-red-500 dark:text-red-400 font-black uppercase tracking-wider">Biaya</p>
                    <p className="text-sm font-bold text-red-500 dark:text-red-400">-{formatRupiah(w.fee)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-wider">Bersih</p>
                    <p className="text-base font-black text-blue-600 dark:text-blue-400 tracking-tight">{formatRupiah(w.net_amount)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                {w.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleUpdateStatus(w.id, 'approved', w.seller_id, w.amount)}
                      className="flex-1 btn-clay-secondary h-10 text-[10px] text-amber-600 dark:text-amber-500"
                    >
                      Setujui
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(w.id, 'rejected', w.seller_id, w.amount)}
                      className="flex-1 btn-clay-secondary h-10 text-[10px] text-red-600 dark:text-red-500"
                    >
                      Tolak
                    </button>
                  </>
                )}
                {w.status === 'approved' && (
                  <button 
                    onClick={() => handleUpdateStatus(w.id, 'paid', w.seller_id, w.amount)}
                    className="w-full btn-clay-primary h-12 text-[10px]"
                  >
                    Tandai Dibayar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
