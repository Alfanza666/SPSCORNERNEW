import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatRupiah } from '../../../lib/utils';
import { 
  Package, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  Calendar,
  ChevronRight,
  Plus,
  ShoppingBag,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function SellerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSales: 0,
    balance: 0,
    totalWithdrawn: 0,
    totalFeePaid: 0
  });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'seller') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { count: prodCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user?.id);

      const { data: lowStockData } = await supabase
        .from('products')
        .select('name, stock')
        .eq('seller_id', user?.id)
        .lt('stock', 5)
        .order('stock', { ascending: true })
        .limit(5);

      setLowStockProducts(lowStockData || []);

      const { data: profile } = await supabase
        .from('profiles')
        .select('balance, total_sales, total_withdrawn, total_fee_paid')
        .eq('id', user?.id)
        .single();

      setStats({
        totalProducts: prodCount || 0,
        totalSales: profile?.total_sales || 0,
        balance: profile?.balance || 0,
        totalWithdrawn: profile?.total_withdrawn || 0,
        totalFeePaid: profile?.total_fee_paid || 0
      });

    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <motion.div 
      whileHover={{ y: -5 }}
      className="glass-card p-6 flex flex-col gap-4 border-zinc-200/60"
    >
      <div className="flex items-center justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div>
        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{value}</h3>
        {subtitle && <p className="text-[10px] text-zinc-400 font-medium mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight mb-2">
            Dashboard Penjual
          </h1>
          <p className="text-zinc-500 flex items-center gap-2 font-medium text-sm md:text-base">
            <Calendar className="w-4 h-4 text-emerald-500" />
            Hari ini, {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard/seller/products')}
            className="flex-1 md:flex-none btn-secondary h-12 px-5 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk
          </button>
          <button 
            onClick={() => navigate('/dashboard/seller/withdrawals')}
            className="flex-1 md:flex-none btn-primary h-12 px-5 flex items-center justify-center gap-2 shadow-emerald-600/20"
          >
            <Wallet className="w-4 h-4" />
            Tarik Saldo
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Saldo Tersedia" 
          value={formatRupiah(stats.balance)} 
          icon={DollarSign} 
          color="bg-emerald-100 text-emerald-600"
          subtitle={`Estimasi bersih: ${formatRupiah(stats.balance * 0.92)}`}
        />
        <StatCard 
          title="Total Penjualan" 
          value={formatRupiah(stats.totalSales)} 
          icon={TrendingUp} 
          color="bg-blue-100 text-blue-600"
        />
        <StatCard 
          title="Total Ditarik" 
          value={formatRupiah(stats.totalWithdrawn)} 
          icon={CreditCard} 
          color="bg-purple-100 text-purple-600"
        />
        <StatCard 
          title="Total Produk" 
          value={stats.totalProducts} 
          icon={Package} 
          color="bg-amber-100 text-amber-600"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Low Stock Alerts */}
        <div className="glass-card overflow-hidden border-zinc-200/60">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Peringatan Stok Menipis
            </h3>
            <button 
              onClick={() => navigate('/dashboard/seller/products')}
              className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
            >
              Update Stok
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {lowStockProducts.map((product, idx) => (
              <div key={idx} className="p-5 flex items-center justify-between hover:bg-zinc-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${product.stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">{product.name}</span>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  product.stock === 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {product.stock === 0 ? 'Habis' : `Sisa ${product.stock}`}
                </span>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <div className="p-10 text-center text-zinc-400 text-sm font-medium italic flex flex-col items-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 stroke-[1.5]" />
                Stok produk aman.
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Tips */}
        <div className="space-y-6">
          <div className="glass-card p-8 border-zinc-200/60 bg-zinc-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Tips Penjualan
              </h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-1">Update Foto Produk</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">Produk dengan foto yang jelas dan menarik cenderung lebih cepat laku.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-1">Pantau Stok</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">Jangan biarkan stok kosong terlalu lama agar pembeli tidak kecewa.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-8 border-emerald-100 bg-emerald-50/50">
             <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest mb-4">Informasi Biaya</h3>
             <p className="text-xs text-emerald-800 leading-relaxed font-medium">
               Setiap transaksi dikenakan biaya administrasi sebesar <b className="text-emerald-900">8%</b>. Biaya ini digunakan untuk pemeliharaan sistem dan pengembangan fitur SPS Corner.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
