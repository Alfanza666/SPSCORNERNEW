import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatRupiah } from '../../../lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Download, Search, Filter, Wallet, ArrowRight, Loader2, User, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    if (!confirm(`Yakin ingin mengubah status penarikan ini menjadi ${newStatus}?`)) return;

    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      if (newStatus === 'rejected') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', sellerId)
          .single();

        if (profile) {
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

      fetchWithdrawals();
      alert(`Status berhasil diubah menjadi ${newStatus}`);
    } catch (error) {
      console.error('Error updating withdrawal status:', error);
      alert('Gagal mengubah status penarikan');
    }
  };

  const exportToCSV = () => {
    if (withdrawals.length === 0) return;
    
    const headers = ['ID', 'Penjual', 'Jumlah Kotor', 'Biaya (8%)', 'Jumlah Bersih', 'Status', 'Tanggal'];
    const csvContent = [
      headers.join(','),
      ...withdrawals.map(w => 
        `${w.id},"${w.profiles?.name}",${w.amount},${w.fee},${w.net_amount},${w.status},"${format(new Date(w.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_penarikan_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredWithdrawals = withdrawals.filter(w => 
    w.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && withdrawals.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight mb-2">
            Permintaan Penarikan
          </h1>
          <p className="text-zinc-500 font-medium flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-500" />
            Validasi dan proses pencairan dana mitra penjual
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

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari nama penjual..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-12 h-14"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary h-14 px-6 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter Status
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden border-zinc-200/60 shadow-xl shadow-zinc-200/40">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] bg-zinc-50/50">
                <th className="p-6">Penjual</th>
                <th className="p-6">Rincian Dana</th>
                <th className="p-6">Diterima</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredWithdrawals.map((w) => (
                <motion.tr 
                  layout
                  key={w.id} 
                  className="hover:bg-zinc-50/50 transition-colors group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center font-black text-xl shadow-inner">
                        {w.profiles?.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">{w.profiles?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(w.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-zinc-900">{formatRupiah(w.amount)}</p>
                      <p className="text-[10px] text-red-500 font-black uppercase tracking-wider">Biaya Admin: {formatRupiah(w.fee)}</p>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="font-black text-emerald-600 text-lg tracking-tight">{formatRupiah(w.net_amount)}</p>
                  </td>
                  <td className="p-6">
                    {w.status === 'pending' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3 mr-1.5" /> Pending
                      </span>
                    )}
                    {w.status === 'approved' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">
                        <CheckCircle2 className="w-3 h-3 mr-1.5" /> Disetujui
                      </span>
                    )}
                    {w.status === 'paid' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 mr-1.5" /> Dibayar
                      </span>
                    )}
                    {w.status === 'rejected' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700">
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
                            className="btn-secondary h-10 px-4 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50"
                          >
                            Setujui
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(w.id, 'rejected', w.seller_id, w.amount)}
                            className="btn-secondary h-10 px-4 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                      {w.status === 'approved' && (
                        <button 
                          onClick={() => handleUpdateStatus(w.id, 'paid', w.seller_id, w.amount)}
                          className="btn-primary h-10 px-6 text-[10px] font-black uppercase tracking-widest shadow-emerald-600/20"
                        >
                          Tandai Dibayar
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filteredWithdrawals.map((w) => (
            <div key={w.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center font-black text-lg">
                    {w.profiles?.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900">{w.profiles?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-zinc-400 font-medium">
                      {format(new Date(w.created_at), 'dd MMM, HH:mm', { locale: id })}
                    </p>
                  </div>
                </div>
                {w.status === 'pending' && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-wider">Pending</span>
                )}
                {w.status === 'approved' && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-wider">Disetujui</span>
                )}
                {w.status === 'paid' && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">Dibayar</span>
                )}
                {w.status === 'rejected' && (
                  <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wider">Ditolak</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Kotor</p>
                  <p className="font-bold text-zinc-900 text-sm">{formatRupiah(w.amount)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Bersih</p>
                  <p className="font-black text-emerald-600 text-sm">{formatRupiah(w.net_amount)}</p>
                </div>
              </div>
              {w.status !== 'paid' && w.status !== 'rejected' && (
                <div className="flex items-center gap-2 pt-2">
                  {w.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleUpdateStatus(w.id, 'approved', w.seller_id, w.amount)}
                        className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-blue-100"
                      >
                        Setujui
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(w.id, 'rejected', w.seller_id, w.amount)}
                        className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-red-100"
                      >
                        Tolak
                      </button>
                    </>
                  )}
                  {w.status === 'approved' && (
                    <button 
                      onClick={() => handleUpdateStatus(w.id, 'paid', w.seller_id, w.amount)}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/20"
                    >
                      Tandai Dibayar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredWithdrawals.length === 0 && (
          <div className="p-20 text-center">
            <div className="flex flex-col items-center gap-4 text-zinc-300">
              <Wallet className="w-16 h-16 stroke-[1]" />
              <p className="font-bold text-zinc-400">Tidak ada permintaan penarikan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
