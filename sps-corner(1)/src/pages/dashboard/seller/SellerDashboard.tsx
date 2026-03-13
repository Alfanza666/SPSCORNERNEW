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
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="glass-card p-3 sm:p-5 flex flex-col gap-2 border-zinc-200/60"
  >
    <div className="flex items-center justify-between">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${color} shadow-sm`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
    </div>
    <div>
      <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 truncate">{title}</p>
      <h3 className="text-sm sm:text-xl font-black text-zinc-900 tracking-tight truncate">{value}</h3>
      {subtitle && <p className="text-[8px] sm:text-[9px] text-zinc-400 font-medium mt-0.5 truncate">{subtitle}</p>}
    </div>
  </motion.div>
);

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
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight mb-2">
            Dashboard Penjual
          </h1>
          <p className="text-zinc-500 flex items-center gap-2 font-medium text-sm md:text-base">
            <Calendar className="w-4 h-4 text-blue-500" />
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
            className="flex-1 md:flex-none btn-primary h-12 px-5 flex items-center justify-center gap-2 shadow-blue-600/20"
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
          color="bg-blue-100 text-blue-600"
          subtitle={`Estimasi bersih: ${formatRupiah(stats.balance * 0.92)}`}
        />
        <StatCard 
          title="Total Penjualan" 
          value={formatRupiah(stats.totalSales)} 
          icon={TrendingUp} 
          color="bg-amber-100 text-amber-600"
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

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-10">
        {/* Low Stock Alerts */}
        <div className="glass-card overflow-hidden border-zinc-200/60">
          <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Peringatan Stok Menipis
            </h3>
            <button 
              onClick={() => navigate('/dashboard/seller/products')}
              className="text-[9px] sm:text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
            >
              Update Stok
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {lowStockProducts.map((product, idx) => (
              <div key={idx} className="p-3 sm:p-5 flex items-center justify-between hover:bg-zinc-50 transition-colors group">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm ${product.stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-zinc-900 group-hover:text-blue-600 transition-colors">{product.name}</span>
                </div>
                <span className={`inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                  product.stock === 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {product.stock === 0 ? 'Habis' : `Sisa ${product.stock}`}
                </span>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <div className="p-6 sm:p-10 text-center text-zinc-400 text-xs sm:text-sm font-medium italic flex flex-col items-center gap-2 sm:gap-3">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500 stroke-[1.5]" />
                Stok produk aman.
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Tips */}
        <div className="space-y-6">
          <div className="glass-card p-6 sm:p-8 border-zinc-200/60 bg-zinc-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-blue-500/20 blur-3xl rounded-full -mr-12 -mt-12 sm:-mr-16 sm:-mt-16" />
            <div className="relative z-10">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Tips Penjualan
              </h3>
              <div className="space-y-4 sm:space-y-6">
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold mb-1">Update Foto Produk</p>
                    <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed">Produk dengan foto yang jelas dan menarik cenderung lebih cepat laku.</p>
                  </div>
                </div>
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold mb-1">Pantau Stok</p>
                    <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed">Jangan biarkan stok kosong terlalu lama agar pembeli tidak kecewa.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-6 sm:p-8 border-blue-100 bg-blue-50/50">
             <h3 className="text-xs sm:text-sm font-black text-blue-900 uppercase tracking-widest mb-3 sm:mb-4">Informasi Biaya</h3>
             <p className="text-[10px] sm:text-xs text-blue-800 leading-relaxed font-medium">
               Setiap transaksi dikenakan biaya administrasi sebesar <b className="text-blue-900">8%</b>. Biaya ini digunakan untuk pemeliharaan sistem dan pengembangan fitur SPS Corner.
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
