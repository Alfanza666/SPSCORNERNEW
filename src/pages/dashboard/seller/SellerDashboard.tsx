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
  Wallet,
  RotateCcw,
  ListOrdered,
  Power,
  PowerOff
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { appToast } from '../../../components/ui/AppToast';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { Skeleton } from '../../../components/ui/Skeleton';

type PeriodKey = 'today' | 'week' | 'month' | 'all';

const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

const PERIOD_OPTIONS: { key: PeriodKey; label: string; short: string }[] = [
  { key: 'today', label: 'Hari Ini', short: 'hari ini (WITA)' },
  { key: 'week', label: 'Minggu Ini', short: '7 hari terakhir' },
  { key: 'month', label: 'Bulan Ini', short: 'bulan berjalan (WITA)' },
  { key: 'all', label: 'Semua', short: 'semua waktu' },
];

// Batas awal periode dalam ISO UTC, mengikuti kalender WITA (UTC+8).
function periodStartIso(period: PeriodKey): string | null {
  if (period === 'all') return null;
  const shifted = new Date(Date.now() + WITA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  if (period === 'today') {
    return new Date(Date.UTC(year, month, day) - WITA_OFFSET_MS).toISOString();
  }
  if (period === 'month') {
    return new Date(Date.UTC(year, month, 1) - WITA_OFFSET_MS).toISOString();
  }
  // 'week': 7 hari kalender terakhir termasuk hari ini.
  return new Date(Date.UTC(year, month, day - 6) - WITA_OFFSET_MS).toISOString();
}

// Daftar 7 tanggal WITA terakhir (termasuk hari ini), format YYYY-MM-DD.
function lastSevenWitaDates(): string[] {
  const shifted = new Date(Date.now() + WITA_OFFSET_MS);
  const todayUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return Array.from({ length: 7 }, (_, i) =>
    new Date(todayUtc - (6 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
}

function witaDateKeyOf(iso: string): string | null {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts + WITA_OFFSET_MS).toISOString().slice(0, 10);
}

const StatCard = ({ title, value, icon: Icon, color, subtitle, index = 0 }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: index * 0.07 }}
    whileHover={{ y: -2 }}
    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-all"
  >
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} clay-icon`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div>
      <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1 truncate">{title}</p>
      <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight truncate">{value}</h3>
      {subtitle && <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium mt-1 truncate">{subtitle}</p>}
    </div>
  </motion.div>
);

export default function SellerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSales: 0,
    periodSales: 0,
    periodOrders: 0,
    balance: 0,
    totalWithdrawn: 0,
    totalFeePaid: 0
  });
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [periodLoading, setPeriodLoading] = useState(true);
  const [sparkline, setSparkline] = useState<{ date: string; total: number }[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(true);
  const [togglingStore, setTogglingStore] = useState(false);

  useEffect(() => {
    if (user?.role === 'seller') {
      fetchData();

      const profileSubscription = supabase
        .channel('seller-profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            const newProfile = payload.new;
            setStats(prev => ({
              ...prev,
              totalSales: newProfile.total_sales || prev.totalSales,
              balance: newProfile.balance || 0,
              totalWithdrawn: newProfile.total_withdrawn || prev.totalWithdrawn,
              totalFeePaid: newProfile.total_fee_paid || prev.totalFeePaid
            }));
            if (newProfile.store_open !== undefined) {
              setStoreOpen(newProfile.store_open);
            }
          }
        )
        .subscribe();

      const productsSubscription = supabase
        .channel('seller-products-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products',
            filter: `seller_id=eq.${user.id}`
          },
          () => {
            fetchData(); // Refetch low stock products when products change
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(profileSubscription);
        supabase.removeChannel(productsSubscription);
      };
    }
  }, [user]);

  // Fetch pendapatan periode secara terpisah supaya ganti periode tidak me-reset seluruh dashboard.
  useEffect(() => {
    if (user?.role === 'seller') {
      fetchPeriodSales(period);
    }
  }, [user, period]);

  const fetchPeriodSales = async (selectedPeriod: PeriodKey) => {
    if (!user?.id) return;
    try {
      setPeriodLoading(true);
      const startIso = periodStartIso(selectedPeriod);
      const weekStartIso = periodStartIso('week');
      // Pendapatan seller = subtotal item pada transaksi lunas (paid/success),
      // dihitung dari transaction_items (bukan profiles.total_sales) agar bisa difilter periode.
      let query = supabase
        .from('transaction_items')
        .select('transaction_id, subtotal, transactions!inner(status, created_at)')
        .eq('seller_id', user.id)
        .in('transactions.status', ['paid', 'success']);
      if (startIso) {
        query = query.gte('transactions.created_at', startIso);
      }
      // Sparkline 7 hari selalu diambil terpisah (query kecil, rentang 7 hari saja).
      const [periodResult, weekResult] = await Promise.all([
        query,
        supabase
          .from('transaction_items')
          .select('subtotal, transactions!inner(status, created_at)')
          .eq('seller_id', user.id)
          .in('transactions.status', ['paid', 'success'])
          .gte('transactions.created_at', weekStartIso),
      ]);
      if (periodResult.error) throw periodResult.error;
      if (weekResult.error) throw weekResult.error;

      const rows = periodResult.data || [];
      const total = rows.reduce((sum: number, row: any) => sum + (Number(row.subtotal) || 0), 0);
      const orders = new Set(rows.map((row: any) => row.transaction_id).filter(Boolean)).size;
      setStats(prev => ({ ...prev, periodSales: total, periodOrders: orders }));

      // Agregasi sparkline per tanggal WITA.
      const dayTotals = new Map<string, number>();
      for (const row of weekResult.data || []) {
        const createdAt = (row as any).transactions?.created_at;
        const key = createdAt ? witaDateKeyOf(createdAt) : null;
        if (!key) continue;
        dayTotals.set(key, (dayTotals.get(key) || 0) + (Number((row as any).subtotal) || 0));
      }
      setSparkline(lastSevenWitaDates().map(date => ({ date, total: dayTotals.get(date) || 0 })));
    } catch (error) {
      console.error('Error fetching period sales:', error);
    } finally {
      setPeriodLoading(false);
    }
  };

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
        .select('balance, total_sales, total_withdrawn, total_fee_paid, store_open')
        .eq('id', user?.id)
        .single();

      setStoreOpen(profile?.store_open !== false);

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

  const toggleStore = async () => {
    if (!user?.id) return;
    setTogglingStore(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ store_open: !storeOpen })
        .eq('id', user.id);
      if (error) throw error;
      setStoreOpen(!storeOpen);
      appToast.success(storeOpen ? 'Kiosk Ditutup' : 'Kiosk Dibuka');
    } catch (err: any) {
      appToast.error('Gagal', 'Gagal mengubah status kiosk');
    } finally {
      setTogglingStore(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-12 w-32 rounded-xl" />
            <Skeleton className="h-12 w-32 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          <Skeleton className="h-96 rounded-2xl" />
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">
            Dashboard Penjual
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2 font-medium text-sm md:text-base">
            <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Hari ini, {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button 
              onClick={toggleStore}
              disabled={togglingStore}
              className={`flex-1 sm:flex-none h-10 sm:h-12 px-3 sm:px-5 flex items-center justify-center gap-2 text-xs sm:text-sm rounded-xl font-bold transition-all shadow-sm ${
                storeOpen
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
              }`}
            >
              {togglingStore ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : storeOpen ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{storeOpen ? 'Buka Kiosk' : 'Tutup Kiosk'}</span>
              <span className="sm:hidden">{storeOpen ? 'Buka' : 'Tutup'}</span>
            </button>
          <button 
            onClick={() => navigate('/dashboard/seller/products')}
            className="flex-1 sm:flex-none btn-clay-secondary h-10 sm:h-12 px-3 sm:px-5 flex items-center justify-center gap-2 tour-seller-add-product text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Produk</span>
            <span className="sm:hidden">Tambah</span>
          </button>
          <button 
            onClick={() => navigate('/dashboard/seller/withdrawals')}
            className="flex-1 sm:flex-none btn-clay-primary h-10 sm:h-12 px-3 sm:px-5 flex items-center justify-center gap-2 tour-seller-withdraw text-xs sm:text-sm"
          >
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Tarik Saldo</span>
            <span className="sm:hidden">Tarik</span>
          </button>
        </div>
      </div>

      {/* Filter periode pendapatan */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter periode pendapatan">
        {PERIOD_OPTIONS.map(option => {
          const isActive = period === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setPeriod(option.key)}
              className={[
                'h-9 rounded-xl px-4 text-xs font-bold transition-all',
                isActive
                  ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900'
                  : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              {option.label}
            </button>
          );
        })}
        <span className="ml-1 text-[11px] font-medium text-zinc-400">
          Pendapatan dihitung untuk {(PERIOD_OPTIONS.find(o => o.key === period) || PERIOD_OPTIONS[3]).short}.
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 tour-seller-stats">
        <StatCard 
          index={0}
          title="Saldo Tersedia" 
          value={formatRupiah(stats.balance)} 
          icon={DollarSign} 
          color="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
          subtitle="Sudah termasuk potongan fee (Bersih)"
        />
        <StatCard 
          index={1}
          title={`Pendapatan ${PERIOD_OPTIONS.find(o => o.key === period)?.label || ''}`}
          value={periodLoading ? '...' : formatRupiah(stats.periodSales)}
          icon={TrendingUp} 
          color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
          subtitle={`${stats.periodOrders.toLocaleString('id-ID')} pesanan lunas · total semua waktu ${formatRupiah(stats.totalSales)}`}
        />
        <StatCard 
          index={2}
          title="Total Ditarik" 
          value={formatRupiah(stats.totalWithdrawn)} 
          icon={CreditCard} 
          color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard 
          index={3}
          title="Total Produk" 
          value={stats.totalProducts} 
          icon={Package} 
          color="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Sparkline pendapatan 7 hari (WITA) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Tren Pendapatan 7 Hari
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Subtotal item pada transaksi lunas, kalender WITA.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            {formatRupiah(sparkline.reduce((s, d) => s + d.total, 0))} / 7 hari
          </span>
        </div>
        {sparkline.every(d => d.total === 0) ? (
          <div className="flex h-28 flex-col items-center justify-center gap-2 text-zinc-300 dark:text-zinc-600">
            <TrendingUp className="h-8 w-8 stroke-[1]" />
            <p className="text-xs font-semibold">Belum ada pendapatan dalam 7 hari terakhir</p>
          </div>
        ) : (
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="sellerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fontWeight: 700 }}
                  className="text-zinc-400"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(8)}
                />
                <Tooltip
                  cursor={{ stroke: '#10b981', strokeOpacity: 0.3 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
                        <p className="mt-0.5 text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(Number(payload[0].value) || 0)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#sellerGradient)"
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  animationDuration={700}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.section>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-10">
        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden tour-seller-low-stock">
          <div className="p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
            <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
              Peringatan Stok Menipis
            </h3>
            <button 
              onClick={() => navigate('/dashboard/seller/products')}
              className="text-[9px] sm:text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
            >
              Update Stok
            </button>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {lowStockProducts.map((product, idx) => (
              <div key={idx} className="p-3 sm:p-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm clay-icon ${product.stock === 0 ? 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{product.name}</span>
                </div>
                <span className={`clay-badge ${
                  product.stock === 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400'
                }`}>
                  {product.stock === 0 ? 'Habis' : `Sisa ${product.stock}`}
                </span>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <div className="p-6 sm:p-10 text-center text-zinc-400 dark:text-zinc-500 text-xs sm:text-sm font-medium italic flex flex-col items-center gap-2 sm:gap-3">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-500 dark:text-blue-400 clay-icon flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                Stok produk aman.
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.button
              whileHover={{ y: -2 }}
              onClick={() => navigate('/dashboard/seller/transactions')}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 text-left hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                <ListOrdered className="w-6 h-6" />
              </div>
              <p className="font-bold text-zinc-900 dark:text-white text-sm mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Pesanan Hari Ini</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Lihat dan kelola pesanan masuk</p>
            </motion.button>
            <motion.button
              whileHover={{ y: -2 }}
              onClick={() => navigate('/dashboard/seller/products')}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 text-left hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <RotateCcw className="w-6 h-6" />
              </div>
              <p className="font-bold text-zinc-900 dark:text-white text-sm mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Request Restock</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Tambah stok produk yang menipis</p>
            </motion.button>
            <motion.button
              whileHover={{ y: -2 }}
              onClick={() => navigate('/dashboard/seller/products')}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 text-left hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                <Plus className="w-6 h-6" />
              </div>
              <p className="font-bold text-zinc-900 dark:text-white text-sm mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Tambah Produk Baru</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Jual produk baru di kiosk</p>
            </motion.button>
            <motion.button
              whileHover={{ y: -2 }}
              onClick={() => navigate('/dashboard/seller/transactions')}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 text-left hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="font-bold text-zinc-900 dark:text-white text-sm mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Riwayat Penjualan</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Cek transaksi dan pendapatan</p>
            </motion.button>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-blue-100 dark:border-blue-900/50 shadow-sm p-6 sm:p-8 bg-blue-50/50 dark:bg-blue-900/10">
             <h3 className="text-xs sm:text-sm font-black text-blue-900 dark:text-blue-400 uppercase tracking-widest mb-3 sm:mb-4">Informasi Biaya</h3>
             <p className="text-[10px] sm:text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
               Setiap penjualan produk Anda secara otomatis dikenakan potongan biaya platform sebesar <b className="text-blue-900 dark:text-blue-400">8%</b> di awal. Saldo yang tampil di dashboard sudah merupakan uang bersih Anda dan tidak akan dipotong lagi saat penarikan.
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
