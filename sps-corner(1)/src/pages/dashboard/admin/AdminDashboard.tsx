import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { exportCSV, formatRupiah } from '../../../lib/utils';
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

  const exportToCSV = async () => {
    try {
      const { data: allTx, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      if (!allTx || allTx.length === 0) {
        alert('Tidak ada data transaksi untuk diexport.');
        return;
      }
      
      const headers = ['ID', 'Pembeli', 'Total', 'Status', 'Tanggal'];
      const csvContent = [
        headers.join(','),
        ...allTx.map(tx => 
          `${tx.id},"${tx.buyer_name}",${tx.total_amount},${tx.status},"${format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
        )
      ].join('\n');

      exportCSV(csvContent, `laporan_penjualan_lengkap_${format(new Date(), 'yyyyMMdd')}.csv`);
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      alert(`Gagal mengekspor laporan: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const maxSales = Math.max(...salesData.map(d => d.sales), 1);

  const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <motion.div 
      whileHover={{ y: -2 }}
      className="glass-card p-3 sm:p-5 flex flex-col gap-2 border-zinc-200/60"
    >
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${color} shadow-sm`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-xs font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg ${trend > 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
            {trend > 0 ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 truncate">{title}</p>
        <h3 className="text-sm sm:text-xl font-black text-zinc-900 tracking-tight truncate">{value}</h3>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 tracking-tight mb-1 sm:mb-2">
            Overview Dashboard
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 flex items-center gap-2 font-medium">
            <Calendar className="w-4 h-4 text-blue-500" />
            Hari ini, {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={fetchDashboardData}
            className="btn-secondary h-10 px-3 sm:h-12 sm:px-5 flex items-center gap-2 text-xs sm:text-sm"
          >
            <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
            Refresh Data
          </button>
          <button 
            onClick={exportToCSV} 
            className="btn-primary h-10 px-3 sm:h-12 sm:px-5 flex items-center gap-2 shadow-blue-600/20 text-xs sm:text-sm"
          >
            <Download className="w-3 h-3 sm:w-4 sm:h-4" />
            Export Laporan
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard 
          title="Total Pendapatan" 
          value={formatRupiah(stats.totalSales)} 
          icon={DollarSign} 
          color="bg-blue-100 text-blue-600"
          trend={12}
        />
        <StatCard 
          title="Total Biaya (8%)" 
          value={formatRupiah(stats.totalFees)} 
          icon={CreditCard} 
          color="bg-amber-100 text-amber-600"
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

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-10">
        {/* Sales Chart */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-10">
          <div className="glass-card p-4 sm:p-8 border-zinc-200/60">
            <div className="flex items-center justify-between mb-6 sm:mb-10">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight">Grafik Penjualan</h2>
                <p className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">7 Hari Terakhir</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-500" />
                  <span className="text-[8px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-wider">Pendapatan</span>
                </div>
              </div>
            </div>
            
            <div className="h-[200px] sm:h-[350px] w-full flex items-end gap-2 sm:gap-3 pt-6 sm:pt-10">
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
                          className="w-full max-w-[48px] bg-blue-500 rounded-t-xl transition-all duration-300 group-hover:bg-blue-600 group-hover:shadow-lg group-hover:shadow-blue-500/20 relative"
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
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  Transaksi Sukses
                </h3>
                <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Lihat Semua</button>
              </div>
              <div className="divide-y divide-zinc-100">
                <AnimatePresence mode="popLayout">
                  {recentTransactions.map((tx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={tx.id} 
                      className="p-3 sm:p-5 flex items-center justify-between hover:bg-zinc-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs sm:text-sm">
                          {tx.buyer_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 text-xs sm:text-sm group-hover:text-blue-600 transition-colors">{tx.buyer_name}</p>
                          <p className="text-[9px] sm:text-[10px] text-zinc-400 font-medium">
                            {format(new Date(tx.created_at), 'dd MMM, HH:mm', { locale: id })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-zinc-900 text-xs sm:text-sm">{formatRupiah(tx.total_amount)}</p>
                        <span className="text-[8px] sm:text-[9px] font-black text-blue-600 uppercase tracking-tighter">Berhasil</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
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
                <AnimatePresence mode="popLayout">
                  {failedTransactions.map((tx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={tx.id} 
                      className="p-3 sm:p-5 flex flex-col gap-2 sm:gap-3 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-black text-[10px] sm:text-xs">
                            {tx.buyer_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 text-xs sm:text-sm">{tx.buyer_name}</p>
                            <p className="text-[9px] sm:text-[10px] text-zinc-400 font-medium">
                              {format(new Date(tx.created_at), 'dd MMM, HH:mm', { locale: id })}
                            </p>
                          </div>
                        </div>
                        <p className="font-black text-zinc-900 text-xs sm:text-sm">{formatRupiah(tx.attempted_amount)}</p>
                      </div>
                      <div className="flex items-start gap-2 sm:gap-3 bg-red-50/50 p-2 sm:p-3 rounded-xl border border-red-100/50">
                         <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 shrink-0 mt-0.5" />
                         <p className="text-[9px] sm:text-[10px] text-red-700 font-medium leading-relaxed line-clamp-2">
                           {tx.reason}
                         </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {failedTransactions.length === 0 && (
                  <div className="p-10 text-center text-zinc-400 text-sm font-medium italic">Tidak ada catatan gagal</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6 sm:space-y-10">
          <div className="glass-card p-4 sm:p-8 border-zinc-200/60">
            <h3 className="text-xs sm:text-sm font-black text-zinc-900 uppercase tracking-widest mb-4 sm:mb-8 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              Pengaturan QRIS
            </h3>
            
            <div className="space-y-6 sm:space-y-8">
              <div className="relative group">
                <div className="absolute -inset-2 bg-blue-500/5 rounded-3xl blur-xl group-hover:bg-blue-500/10 transition-colors" />
                <div className="relative bg-zinc-50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-zinc-200/60 flex justify-center shadow-inner">
                  {qrisUrl ? (
                    <img src={qrisUrl} alt="QRIS Aktif" className="w-full aspect-square object-contain rounded-xl" />
                  ) : (
                    <div className="w-full aspect-square flex flex-col items-center justify-center text-zinc-300 gap-2 sm:gap-3">
                      <QrCode className="w-12 h-12 sm:w-16 sm:h-16 stroke-[1]" />
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Belum Ada QRIS</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <label className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Ganti Gambar QRIS</label>
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
                    className="w-full h-12 sm:h-14 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center gap-2 sm:gap-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    {uploadingQris ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-blue-600" />
                    ) : (
                      <>
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 group-hover:text-blue-600" />
                        <span className="text-xs sm:text-sm font-bold text-zinc-500 group-hover:text-blue-600">Pilih File Baru</span>
                      </>
                    )}
                  </label>
                </div>
                
                {newQrisUrl && newQrisUrl !== qrisUrl && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-amber-50 rounded-xl border border-amber-100"
                  >
                    <img src={newQrisUrl} alt="Preview" className="w-10 h-10 sm:w-12 h-12 object-cover rounded-lg shadow-sm" />
                    <div className="flex-1">
                      <p className="text-[9px] sm:text-[10px] font-black text-amber-700 uppercase tracking-wider">Preview Terunggah</p>
                      <p className="text-[8px] sm:text-[9px] text-amber-500 font-medium">Klik simpan untuk menerapkan</p>
                    </div>
                  </motion.div>
                )}
              </div>

              <button 
                onClick={handleUpdateQris} 
                disabled={!newQrisUrl || newQrisUrl === qrisUrl}
                className="btn-primary w-full h-12 sm:h-14 flex items-center justify-center gap-2 shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none text-xs sm:text-sm"
              >
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                Simpan Perubahan
              </button>
            </div>
          </div>

          <div className="glass-card p-8 border-zinc-200/60 bg-zinc-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                Status Sistem
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">Database</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">AI Validator</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Ready
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">Storage</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
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
