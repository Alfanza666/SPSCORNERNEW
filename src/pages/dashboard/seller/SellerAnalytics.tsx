import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { Skeleton } from '../../../components/ui/Skeleton';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, Wallet, TrendingUp, Calendar, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SellerAnalytics() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
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
      const res = await fetch('/api/analytics/seller', {
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
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
    { label: 'Total Pesanan', value: data.totalOrders || 0, icon: ShoppingCart, color: 'text-blue-500' },
    { label: 'Saldo Saat Ini', value: `Rp ${(data.balance || 0).toLocaleString('id-ID')}`, icon: Wallet, color: 'text-amber-500' },
    { label: 'Total Penjualan', value: `Rp ${(data.totalSales || 0).toLocaleString('id-ID')}`, icon: TrendingUp, color: 'text-violet-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-white">📊 Analytics Saya</h1>
        <button onClick={fetchData} className="text-sm text-blue-600 hover:text-blue-700">
          🔄 Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" /> Pendapatan 30 Hari Terakhir
        </h2>
        {data.weeklyBreakdown?.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.weeklyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `Rp${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `Rp ${v.toLocaleString('id-ID')}`} />
              <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-zinc-400 text-center py-8">Belum ada data penjualan dalam 30 hari terakhir</p>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-500" /> Performa Produk
        </h2>
        {data.productData?.length > 0 ? (
          <div className="space-y-3">
            {data.productData.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{p.name}</span>
                </div>
                <span className="text-sm font-bold text-zinc-800 dark:text-white">{p.quantity} terjual</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-400 text-center py-8">Belum ada data penjualan produk</p>
        )}
      </div>
    </div>
  );
}
