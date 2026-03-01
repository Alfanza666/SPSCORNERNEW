import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatRupiah } from '../../../lib/utils';
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Image as ImageIcon,
  DollarSign,
  Download,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  ShieldCheck,
  Calendar,
  ChevronRight,
  Upload,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalTransactions: 0,
    failedTransactions: 0,
    totalSellers: 0,
    activeSellers: 0,
    totalFees: 0,
    pendingWithdrawals: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [failedTransactions, setFailedTransactions] = useState<any[]>([]);
  const [qrisUrl, setQrisUrl] = useState('');
  const [newQrisUrl, setNewQrisUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [uploadingQris, setUploadingQris] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDashboardData();
    }
  }, [user]);

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `qris_${Math.random()}.${fileExt}`;
      const filePath = `settings/${fileName}`;

      setUploadingQris(true);

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setNewQrisUrl(publicUrl);
      alert('Gambar QRIS berhasil diunggah! Jangan lupa klik Simpan QRIS.');
    } catch (error: any) {
      console.error('Error uploading QRIS:', error);
      alert(`Gagal mengunggah QRIS: ${error.message}`);
    } finally {
      setUploadingQris(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const { data: txData } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('status', 'success');
        
      const totalSales = txData?.reduce((sum, tx) => sum + tx.total_amount, 0) || 0;
      
      const { count: txCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });
        
      const { count: failedCount } = await supabase
        .from('failed_transactions')
        .select('*', { count: 'exact', head: true });
        
      const { count: sellerCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'seller');

      const { count: activeSellerCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'seller')
        .eq('is_active', true);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('total_fee_paid')
        .eq('role', 'seller');
      
      const totalFees = profiles?.reduce((sum, p) => sum + (p.total_fee_paid || 0), 0) || 0;

      const { count: pendingWithdrawalsCount } = await supabase
        .from('withdrawals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        totalSales,
        totalTransactions: txCount || 0,
        failedTransactions: failedCount || 0,
        totalSellers: sellerCount || 0,
        activeSellers: activeSellerCount || 0,
        totalFees,
        pendingWithdrawals: pendingWithdrawalsCount || 0
      });

      const { data: recentTx } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentTransactions(recentTx || []);

      const { data: failedTx } = await supabase
        .from('failed_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setFailedTransactions(failedTx || []);

      const { data: qrisData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'qris_image_url')
        .single();
      if (qrisData) {
        setQrisUrl(qrisData.value);
        setNewQrisUrl(qrisData.value);
      }

      const { data: chartData } = await supabase
        .from('transactions')
        .select('created_at, total_amount')
        .eq('status', 'success')
        .order('created_at', { ascending: true });

      if (chartData) {
        const groupedData = chartData.reduce((acc: any, curr: any) => {
          const date = format(new Date(curr.created_at), 'MMM dd');
          if (!acc[date]) {
            acc[date] = 0;
          }
          acc[date] += Number(curr.total_amount);
          return acc;
        }, {});

        const formattedChartData = Object.keys(groupedData).map(date => ({
          date,
          sales: groupedData[date]
        }));
        setSalesData(formattedChartData);
      }

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQris = async () => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'qris_image_url', value: newQrisUrl });
        
      if (error) throw error;
      setQrisUrl(newQrisUrl);
      alert('QRIS berhasil diperbarui');
    } catch (error) {
      console.error('Error updating QRIS:', error);
      alert('Gagal memperbarui QRIS');
    }
  };

  const exportToCSV = () => {
    if (recentTransactions.length === 0) return;
    
    const headers = ['ID', 'Pembeli', 'Total', 'Status', 'Tanggal'];
    const csvContent = [
      headers.join(','),
      ...recentTransactions.map(tx => 
        `${tx.id},"${tx.buyer_name}",${tx.total_amount},${tx.status},"${format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_penjualan_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const maxSales = Math.max(...salesData.map(d => d.sales), 1);

  const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <motion.div 
      whileHover={{ y: -5 }}
      className="glass-card p-6 flex flex-col gap-4 border-zinc-200/60"
    >
      <div className="flex items-center justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{value}</h3>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight mb-2">
            Overview Dashboard
          </h1>
          <p className="text-zinc-500 flex items-center gap-2 font-medium text-sm md:text-base">
            <Calendar className="w-4 h-4 text-emerald-500" />
            Hari ini, {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={fetchDashboardData}
            className="flex-1 md:flex-none btn-secondary h-12 px-5 flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
          <button 
            onClick={exportToCSV} 
            className="flex-1 md:flex-none btn-primary h-12 px-5 flex items-center justify-center gap-2 shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Pendapatan" 
          value={formatRupiah(stats.totalSales)} 
          icon={DollarSign} 
          color="bg-emerald-100 text-emerald-600"
          trend={12}
        />
        <StatCard 
          title="Total Biaya (8%)" 
          value={formatRupiah(stats.totalFees)} 
          icon={CreditCard} 
          color="bg-blue-100 text-blue-600"
          trend={8}
        />
        <StatCard 
          title="Penjual Aktif" 
          value={`${stats.activeSellers} / ${stats.totalSellers}`} 
          icon={Users} 
          color="bg-amber-100 text-amber-600"
        />
        <StatCard 
          title="Penarikan Pending" 
          value={stats.pendingWithdrawals} 
          icon={AlertTriangle} 
          color="bg-red-100 text-red-600"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* Sales Chart */}
        <div className="lg:col-span-2 space-y-10">
          <div className="glass-card p-8 border-zinc-200/60">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-xl font-black text-zinc-900 tracking-tight">Grafik Penjualan</h2>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">7 Hari Terakhir</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Pendapatan</span>
                </div>
              </div>
            </div>
            
            <div className="h-[300px] md:h-[350px] w-full flex items-end gap-2 md:gap-3 pt-10">
              {salesData.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300 gap-4">
                  <TrendingUp className="w-12 h-12 stroke-[1]" />
                  <p className="font-bold">Belum ada data penjualan</p>
                </div>
              ) : (
                salesData.map((data, index) => {
                  const heightPercentage = (data.sales / maxSales) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-4 group h-full justify-end">
                      <div className="w-full relative flex justify-center h-full items-end">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(heightPercentage, 4)}%` }}
                          transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                          className="w-full max-w-[48px] bg-emerald-500 rounded-t-xl transition-all duration-300 group-hover:bg-emerald-600 group-hover:shadow-lg group-hover:shadow-emerald-500/20 relative"
                        >
                          {/* Tooltip */}
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-zinc-900 text-white text-[10px] font-black py-2 px-3 rounded-lg whitespace-nowrap z-20 shadow-xl pointer-events-none">
                            {formatRupiah(data.sales)}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                          </div>
                        </motion.div>
                      </div>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider truncate w-full text-center">
                        {data.date}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Transactions Lists */}
          <div className="grid md:grid-cols-2 gap-10">
            <div className="glass-card overflow-hidden border-zinc-200/60">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Transaksi Sukses
                </h3>
                <button className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">Lihat Semua</button>
              </div>
              <div className="divide-y divide-zinc-100">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-zinc-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
                        {tx.buyer_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 text-sm group-hover:text-emerald-600 transition-colors">{tx.buyer_name}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">
                          {format(new Date(tx.created_at), 'dd MMM, HH:mm', { locale: id })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-zinc-900 text-sm">{formatRupiah(tx.total_amount)}</p>
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Berhasil</span>
                    </div>
                  </div>
                ))}
                {recentTransactions.length === 0 && (
                  <div className="p-10 text-center text-zinc-400 text-sm font-medium italic">Belum ada transaksi</div>
                )}
              </div>
            </div>

            <div className="glass-card overflow-hidden border-zinc-200/60">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Indikasi Palsu
                </h3>
                <button className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline">Lihat Semua</button>
              </div>
              <div className="divide-y divide-zinc-100">
                {failedTransactions.map((tx) => (
                  <div key={tx.id} className="p-5 flex flex-col gap-3 hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-black text-xs">
                          {tx.buyer_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 text-sm">{tx.buyer_name}</p>
                          <p className="text-[10px] text-zinc-400 font-medium">
                            {format(new Date(tx.created_at), 'dd MMM, HH:mm', { locale: id })}
                          </p>
                        </div>
                      </div>
                      <p className="font-black text-zinc-900 text-sm">{formatRupiah(tx.attempted_amount)}</p>
                    </div>
                    <div className="flex items-start gap-3 bg-red-50/50 p-3 rounded-xl border border-red-100/50">
                       <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                       <p className="text-[10px] text-red-700 font-medium leading-relaxed line-clamp-2">
                         {tx.reason}
                       </p>
                    </div>
                  </div>
                ))}
                {failedTransactions.length === 0 && (
                  <div className="p-10 text-center text-zinc-400 text-sm font-medium italic">Tidak ada catatan gagal</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-10">
          <div className="glass-card p-8 border-zinc-200/60">
            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-8 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-600" />
              Pengaturan QRIS
            </h3>
            
            <div className="space-y-8">
              <div className="relative group">
                <div className="absolute -inset-2 bg-emerald-500/5 rounded-3xl blur-xl group-hover:bg-emerald-500/10 transition-colors" />
                <div className="relative bg-zinc-50 p-6 rounded-[2rem] border border-zinc-200/60 flex justify-center shadow-inner">
                  {qrisUrl ? (
                    <img src={qrisUrl} alt="QRIS Aktif" className="w-full aspect-square object-contain rounded-xl" />
                  ) : (
                    <div className="w-full aspect-square flex flex-col items-center justify-center text-zinc-300 gap-3">
                      <QrCode className="w-16 h-16 stroke-[1]" />
                      <p className="text-xs font-bold uppercase tracking-widest">Belum Ada QRIS</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Ganti Gambar QRIS</label>
                <div className="relative">
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={handleQrisUpload}
                    disabled={uploadingQris}
                    className="hidden"
                    id="qris-upload"
                  />
                  <label 
                    htmlFor="qris-upload"
                    className="w-full h-14 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center gap-3 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                  >
                    {uploadingQris ? (
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600" />
                        <span className="text-sm font-bold text-zinc-500 group-hover:text-emerald-600">Pilih File Baru</span>
                      </>
                    )}
                  </label>
                </div>
                
                {newQrisUrl && newQrisUrl !== qrisUrl && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100"
                  >
                    <img src={newQrisUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg shadow-sm" />
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Preview Terunggah</p>
                      <p className="text-[9px] text-blue-500 font-medium">Klik simpan untuk menerapkan</p>
                    </div>
                  </motion.div>
                )}
              </div>

              <button 
                onClick={handleUpdateQris} 
                disabled={!newQrisUrl || newQrisUrl === qrisUrl}
                className="btn-primary w-full h-14 flex items-center justify-center gap-2 shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none"
              >
                <ShieldCheck className="w-5 h-5" />
                Simpan Perubahan
              </button>
            </div>
          </div>

          <div className="glass-card p-8 border-zinc-200/60 bg-zinc-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Status Sistem
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">Database</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">AI Validator</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ready
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">Storage</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
const QrCode = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="5" height="5" x="3" y="3" rx="1" />
    <rect width="5" height="5" x="16" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="16" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </svg>
);

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
