import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Package, AlertTriangle, Clock, CheckCircle2, RefreshCw, User } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

interface PickupRecord {
  id: string;
  created_at: string;
  transaction_id: string;
  buyer_name: string;
  items: { name: string; quantity: number }[];
  status: 'pending' | 'ready' | 'completed';
  notes?: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  ready: { label: 'Siap Ambil', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Package },
  completed: { label: 'Sudah Diambil', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
};

export default function AdminPickup() {
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => { fetchPickups(); }, []);

  const fetchPickups = async () => {
    try {
      setLoading(true);
      // Fetch transactions that have Sariroti/bakery products pending pickup
      const { data, error } = await supabase
        .from('transactions')
        .select('id, created_at, buyer_name, buyer_phone, status, payment_method, total_amount, transaction_items(quantity, products(name, categories(name)))')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Filter only transactions with Sariroti/Koperasi items
      const pickupTx = (data || []).filter(tx =>
        (tx as any).transaction_items?.some((item: any) =>
          item.products?.categories?.name?.toLowerCase().includes('sariroti') ||
          item.products?.categories?.name?.toLowerCase().includes('koperasi') ||
          item.products?.categories?.name?.toLowerCase().includes('roti')
        )
      );
      setPickups(pickupTx);
    } catch (err: any) {
      console.error('Error fetching pickups:', err);
      setPickups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReady = async (txId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ pickup_status: 'ready', pickup_ready_at: new Date().toISOString() })
        .eq('id', txId);
      if (error) throw error;
      toast.success('Pesanan ditandai siap diambil');
      fetchPickups();
    } catch (err: any) {
      // Column might not exist yet — notify gracefully
      toast.error('Fitur ini memerlukan migrasi kolom pickup_status di tabel transactions');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Penyerahan Roti</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Kelola pengambilan pesanan produk Sariroti / Koperasi
          </p>
        </div>
        <button onClick={fetchPickups} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors shadow-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Informasi Fitur</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
            Halaman ini menampilkan transaksi sukses yang mengandung produk Sariroti / Koperasi.
            Untuk fitur tracking status pickup lengkap, kolom <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">pickup_status</code> perlu ditambahkan ke tabel <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">transactions</code> di Supabase.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-6 h-24 animate-pulse border border-zinc-100 dark:border-zinc-800" />)}</div>
      ) : pickups.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
          <Package className="w-12 h-12 text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-1">Tidak ada pesanan</h3>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Belum ada transaksi sukses dengan produk Sariroti/Koperasi.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pickups.map((tx: any) => (
            <motion.div key={tx.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5 hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-black text-zinc-900 dark:text-white text-sm">{tx.buyer_name || 'Guest'}</p>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">#{tx.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tx.transaction_items?.map((item: any, idx: number) => (
                        <span key={idx} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                          {item.products?.name} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleMarkReady(tx.id)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Siap
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
