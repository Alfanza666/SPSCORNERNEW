import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { formatRupiah } from '../../lib/utils';
import { ShoppingBag, Clock, User, Package, TrendingUp, CreditCard, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion } from 'motion/react';

export default function KioskHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchData();
    else setLoading(false);
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: orders } = await supabase
        .from('transactions')
        .select('id, created_at, total_amount, status, payment_method, pickup_code')
        .eq('buyer_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentOrders(orders || []);

      const { data: allOrders } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('buyer_id', user?.id)
        .in('status', ['paid', 'completed', 'confirmed', 'processed', 'pending_pickup', 'ready_for_pickup']);

      if (allOrders) {
        setTotalSpent(allOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0));
      }
    } catch (err) {
      console.error('Error fetching buyer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel: Record<string, string> = {
    pending: 'Menunggu Pembayaran', paid: 'Dibayar', processed: 'Diproses',
    pending_pickup: 'Siap Ambil', ready_for_pickup: 'Siap Ambil', completed: 'Selesai',
    cancelled: 'Dibatalkan', failed: 'Gagal'
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700', paid: 'bg-blue-100 text-blue-700',
    processed: 'bg-purple-100 text-purple-700', pending_pickup: 'bg-emerald-100 text-emerald-700',
    ready_for_pickup: 'bg-emerald-100 text-emerald-700', completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700', failed: 'bg-red-100 text-red-700'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-100 text-sm font-medium">Selamat datang,</p>
            <h2 className="text-2xl font-black">{user?.name || 'Pembeli'}</h2>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur">
            <User className="w-7 h-7" />
          </div>
        </div>
        <div className="bg-white/10 rounded-2xl p-4 backdrop-blur">
          <p className="text-blue-100 text-xs font-medium">Total Belanja</p>
          <p className="text-3xl font-black mt-1">{formatRupiah(totalSpent)}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <motion.button whileHover={{ y: -2 }} onClick={() => navigate('/kiosk')} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm text-left">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <p className="font-bold text-sm text-zinc-900 dark:text-white">Belanja</p>
          <p className="text-xs text-zinc-500 mt-0.5">Pesan makanan & minuman</p>
        </motion.button>
        <motion.button whileHover={{ y: -2 }} onClick={() => navigate('/kiosk/history')} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm text-left">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="font-bold text-sm text-zinc-900 dark:text-white">Riwayat</p>
          <p className="text-xs text-zinc-500 mt-0.5">Lihat pesanan sebelumnya</p>
        </motion.button>
        <motion.button whileHover={{ y: -2 }} onClick={() => navigate('/kiosk/preorder')} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm text-left">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <Package className="w-5 h-5" />
          </div>
          <p className="font-bold text-sm text-zinc-900 dark:text-white">Pre-Order</p>
          <p className="text-xs text-zinc-500 mt-0.5">Pesan dari jauh-jauh hari</p>
        </motion.button>
        <motion.button whileHover={{ y: -2 }} onClick={() => navigate('/kiosk/profile')} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm text-left">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
            <CreditCard className="w-5 h-5" />
          </div>
          <p className="font-bold text-sm text-zinc-900 dark:text-white">Profil</p>
          <p className="text-xs text-zinc-500 mt-0.5">Data diri & pengaturan</p>
        </motion.button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Pesanan Terakhir
          </h3>
          <button onClick={() => navigate('/kiosk/history')} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
            Lihat Semua <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingBag className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <p className="font-bold text-zinc-900 dark:text-white">Belum ada pesanan</p>
            <button onClick={() => navigate('/kiosk')} className="mt-3 text-sm font-bold text-blue-600 hover:underline">
              Mulai Belanja
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentOrders.map((order) => (
              <div key={order.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                    {order.pickup_code ? `#${order.pickup_code}` : order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">{formatRupiah(order.total_amount)}</p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg mt-1 ${statusColor[order.status] || 'bg-zinc-100 text-zinc-600'}`}>
                    {statusLabel[order.status] || order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
