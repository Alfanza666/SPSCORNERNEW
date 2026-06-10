import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Skeleton } from '../../../components/ui/Skeleton';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Users, Package, Calendar, ArrowUpRight } from 'lucide-react';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function AdminAnalytics() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/analytics/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (res.ok) setData(result);
      else console.error('Analytics fetch error:', result);
    } catch (e) {
      console.error('Analytics fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm text-center py-12 text-zinc-500">
        Gagal memuat data analytics
      </div>
    );
  }

  const statsCards = [
    { label: 'Pendapatan Bulan Ini', value: `Rp ${(data.monthRevenue || 0).toLocaleString('id-ID')}`, icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Total Pendapatan', value: `Rp ${(data.totalRevenue || 0).toLocaleString('id-ID')}`, icon: TrendingUp, color: 'text-blue-500' },
    { label: 'Transaksi Bulan Ini', value: data.monthTx || 0, icon: ShoppingCart, color: 'text-violet-500' },
    { label: 'Total Transaksi', value: data.totalTx || 0, icon: ShoppingCart, color: 'text-amber-500' },
    { label: 'Penjual Aktif', value: data.sellerCount || 0, icon: Users, color: 'text-green-500' },
    { label: 'Produk Aktif', value: data.productCount || 0, icon: Package, color: 'text-rose-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-white">📊 Analytics</h1>
        <button onClick={fetchData} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <ArrowUpRight className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statsCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-zinc-800 dark:text-white">{card.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Daily Revenue Chart */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" /> Pendapatan Harian (7 Hari)
        </h2>
        {data.dailyBreakdown?.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dailyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `Rp${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `Rp ${v.toLocaleString('id-ID')}`} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-zinc-400 text-center py-8">Belum ada data transaksi dalam 7 hari terakhir</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500" /> Produk Terlaris
          </h2>
          {data.topProducts?.length > 0 ? (
            <div className="space-y-3">
              {data.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-800 dark:text-white">{p.quantity} pcs</div>
                    <div className="text-xs text-zinc-400">Rp {p.revenue.toLocaleString('id-ID')}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-400 text-center py-8">Belum ada data produk</p>
          )}
        </div>

        {/* Category Pie Chart */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-500" /> Kategori Produk
          </h2>
          {data.categoryData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {data.categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-zinc-400 text-center py-8">Belum ada data kategori</p>
          )}
        </div>
      </div>
    </div>
  );
}
