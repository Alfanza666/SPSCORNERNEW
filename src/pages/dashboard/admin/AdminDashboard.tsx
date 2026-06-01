import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { exportExcel, formatRupiah } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CircleAlert,
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
  Search,
  KeyRound,
  Wallet,
  QrCode,
  Loader2,
  Package,
  Settings,
  Bug,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalTransactions: 0,
    failedTransactions: 0,
    totalSellers: 0,
    activeSellers: 0,
    totalFees: 0,
    pendingWithdrawals: 0,
    digiflazzBalance: 0,
    digiflazzError: null as string | null
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const [failedTransactions, setFailedTransactions] = useState<any[]>([]);
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [qrisUrl, setQrisUrl] = useState('');
  const [newQrisUrl, setNewQrisUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [uploadingQris, setUploadingQris] = useState(false);
  const [sellerBreakdown, setSellerBreakdown] = useState<any[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const handleAutoCleanup = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/admin/transactions/cleanup', {
        method: 'POST',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      });
    } catch (e) {
      console.error('Auto-cleanup failed', e);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      fetchDashboardData();
      handleAutoCleanup();
    }
  }, [user]);

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Ukuran file terlalu besar. Maksimal 2MB.');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `qris_${Math.random()}.${fileExt}`;
      const filePath = `settings/${fileName}`;

      setUploadingQris(true);

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        if (uploadError.message.includes('fetch') || uploadError.message.includes('NetworkError')) {
          throw new Error('Gagal mengunggah karena masalah jaringan atau bucket storage belum siap.');
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setNewQrisUrl(publicUrl);
      toast.success('Gambar QRIS berhasil diunggah! Jangan lupa klik Simpan QRIS.');
    } catch (error: any) {
      console.error('Error uploading QRIS:', error);
      toast.error(`Gagal mengunggah QRIS: ${error.message}`);
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
        .in('status', ['success', 'paid']);
        
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

      // Fetch Digiflazz Balance
      let digiflazzBalance = 0;
      let digiflazzError = null;
      try {
        const response = await fetch('/api/digital/cek-saldo');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            digiflazzBalance = data.data.deposit || 0;
          } else {
            digiflazzError = data.error || 'Gagal mengambil saldo';
          }
        } else {
          digiflazzError = `HTTP Error: ${response.status}`;
          console.error('Failed to fetch Digiflazz balance, status:', response.status);
        }
      } catch (err: any) {
        digiflazzError = err.message || 'Network error';
        console.error('Error fetching Digiflazz balance:', err);
      }

      setStats({
        totalSales,
        totalTransactions: txCount || 0,
        failedTransactions: failedCount || 0,
        totalSellers: sellerCount || 0,
        activeSellers: activeSellerCount || 0,
        totalFees,
        pendingWithdrawals: pendingWithdrawalsCount || 0,
        digiflazzBalance,
        digiflazzError
      });

      const { data: recentTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentTransactions(recentTx || []);

      const { data: pendingTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingTransactions(pendingTx || []);

      const { data: failedTx } = await supabase
        .from('failed_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setFailedTransactions(failedTx || []);

      // Fetch password reset requests using backend endpoint to bypass RLS
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
      
      try {
        const resetsRes = await fetch('/api/admin/password-resets', {
          headers: authHeader
        });
        if (resetsRes.ok) {
          const resetsData = await resetsRes.json();
          setResetRequests(resetsData || []);
        }
      } catch (err) {
        console.error('Failed to fetch password resets:', err);
      }

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

      // Seller revenue breakdown
      const { data: allItems, error: itemsError } = await supabase
        .from('transaction_items')
        .select('transaction_id, seller_id, price, quantity, metadata, profiles:seller_id(name), products (seller_id, profiles:seller_id(name))');
      
      if (itemsError) {
        console.error('Error fetching transaction_items for breakdown:', itemsError);
      }

      // Also get transaction status to only include successful ones
      const { data: successTxIds } = await supabase
        .from('transactions')
        .select('id')
        .in('status', ['success', 'paid']);

      if (allItems && successTxIds) {
        const successIdSet = new Set(successTxIds.map((t: any) => t.id));
        const breakdown: Record<string, { name: string; total: number }> = {};
        
        for (const item of allItems as any[]) {
          // Only count items from successful transactions
          if (!successIdSet.has(item.transaction_id)) continue;
          
          let sellerId = 'PPOB_DIGITAL';
          let sellerName = 'Produk Digital (PPOB)';
          
          const isDigital = item.metadata?.is_digital;
          const actualSellerId = item.seller_id || item.products?.seller_id;
          
          if (actualSellerId) {
            sellerId = actualSellerId;
            sellerName = item.products?.profiles?.name || item.profiles?.name || 'Penjual Koperasi';
          } else if (!isDigital) {
             // Fallback for physical items without a seller
             sellerId = 'UNKNOWN';
             sellerName = 'Produk Koperasi Tanpa Penjual';
          }
          
          if (!breakdown[sellerId]) {
            breakdown[sellerId] = { name: sellerName, total: 0 };
          }
          breakdown[sellerId].total += (item.price || 0) * (item.quantity || 1);
        }
        
        const breakdownArr = Object.entries(breakdown)
          .map(([id, val]) => ({ id, name: val.name, total: val.total }))
          .sort((a, b) => b.total - a.total);
        
        setSellerBreakdown(breakdownArr);
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
      toast.success('QRIS berhasil diperbarui');
    } catch (error) {
      console.error('Error updating QRIS:', error);
      toast.error('Gagal memperbarui QRIS');
    }
  };

  const handleCompleteReset = async (requestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/password-resets/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ id: requestId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status');
      
      toast.success('Permintaan ditandai selesai');
      fetchDashboardData();
    } catch (err: any) {
      console.error('Error completing reset:', err);
      toast.error('Gagal memperbarui status permintaan');
    }
  };

  const handleApproveTransaction = async (txId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/admin/transactions/approve', {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: txId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Gagal menyetujui transaksi');
      }

      toast.success('Transaksi berhasil disetujui!');
      
      // Update local state optimistically
      setPendingTransactions(prev => prev.filter(tx => tx.id !== txId));
      const approvedTx = pendingTransactions.find(tx => tx.id === txId);
      if (approvedTx) {
        setRecentTransactions(prev => [{...approvedTx, status: 'success'}, ...prev].slice(0, 5));
      }
      setStats(prev => ({
        ...prev,
        totalTransactions: prev.totalTransactions + 1,
        totalSales: prev.totalSales + (approvedTx?.total_amount || 0)
      }));
    } catch (error: any) {
      console.error('Error approving transaction:', error);
      toast.error(error.message);
    }
  };

  const handleRejectTransaction = async (txId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const response = await fetch('/api/admin/transactions/reject', {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: txId })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menolak transaksi');

      toast.success('Transaksi ditolak');
      setPendingTransactions(prev => prev.filter(tx => tx.id !== txId));
      setStats(prev => ({ ...prev, failedTransactions: prev.failedTransactions + 1 }));
    } catch (error: any) {
      console.error('Error rejecting transaction:', error);
      toast.error('Gagal menolak transaksi');
    }
  };

  const handleTestEmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Prompt user for target email, defaulting to the admin email
      const targetEmail = prompt('Masukkan email tujuan untuk test (kosongkan untuk menggunakan email di Pengaturan):', '');
      
      if (targetEmail === null) return; // User cancelled the prompt

      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: targetEmail })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Gagal kirim email';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
          if (errorJson.tip) errorMessage += `\n\n💡 ${errorJson.tip}`;
        } catch (e) {
          errorMessage = `Server Error (${response.status}): ${errorText.substring(0, 50)}...`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success) {
        toast.success(`Email test berhasil dikirim ke ${targetEmail}!`);
      } else {
        toast.error('Gagal kirim email: ' + (data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error testing email:', error);
      toast.error(error.message || 'Terjadi kesalahan saat mencoba kirim email test');
    }
  };

  const exportToExcel = async () => {
    try {
      const { data: allTx, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      if (!allTx || allTx.length === 0) {
        toast.error('Tidak ada data transaksi untuk diexport.');
        return;
      }
      
      const headers = ['ID Pesanan', 'Nama Pembeli', 'Total (Rp)', 'Status', 'Metode Pembayaran', 'Tanggal'];
      const rows = allTx.map(tx => [
        tx.id,
        tx.buyer_name,
        tx.total_amount,
        tx.status === 'success' ? 'Berhasil' : tx.status === 'failed' ? 'Gagal' : 'Pending',
        tx.payment_method?.toUpperCase() || 'QRIS',
        format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss')
      ]);

      exportExcel(headers, rows, `laporan_penjualan_${format(new Date(), 'yyyyMMdd')}`);
    } catch (error: any) {
      console.error('Error exporting Excel:', error);
      toast.error(`Gagal mengekspor laporan: ${error.message}`);
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <Skeleton className="h-96 rounded-2xl" />
            <div className="grid md:grid-cols-2 gap-10">
              <Skeleton className="h-64 rounded-2xl md:col-span-2" />
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </div>
          <div className="space-y-10">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const maxSales = Math.max(...salesData.map(d => d.sales), 1);

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      className="bg-white dark:bg-zinc-900 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md dark:shadow-none transition-all"
    >
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
      <div>
        <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 truncate">{title}</p>
        <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{value}</h3>
        {subtitle && (
          <p className="text-xs text-red-500 mt-2 whitespace-normal break-words">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">
            Overview Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2 font-medium">
            <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Hari ini, {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={handleTestEmail}
            className="flex-1 sm:flex-none bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all h-10 px-3 sm:px-5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Test Email Sariroti</span>
            <span className="sm:hidden">Test Email</span>
          </button>
          <button 
            onClick={fetchDashboardData}
            className="flex-1 sm:flex-none bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all h-10 px-3 sm:px-5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold shadow-sm dark:shadow-none"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh Data</span>
            <span className="sm:hidden">Refresh</span>
          </button>
          <button 
            onClick={exportToExcel} 
            className="flex-1 sm:flex-none bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white transition-all h-10 px-3 sm:px-5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold shadow-sm shadow-blue-600/20 dark:shadow-none"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Laporan</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Quick Access Menu */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-4 sm:p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
         <h2 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-4">Akses Cepat</h2>
         <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <button 
              onClick={() => navigate('/dashboard/admin/transactions')}
              className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-3xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 transition-colors group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-800 clay-icon-blue flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-center text-zinc-700 dark:text-zinc-300 line-clamp-1">Riwayat Transaksi</span>
            </button>
            <button 
              onClick={() => navigate('/dashboard/admin/products')}
              className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-3xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 transition-colors group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-800 clay-icon-blue flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-bold text-center text-zinc-700 dark:text-zinc-300 line-clamp-1">Semua Produk</span>
            </button>
            <button 
              onClick={() => navigate('/dashboard/admin/withdrawals')}
              className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-3xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 transition-colors group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-800 clay-icon-blue flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-bold text-center text-zinc-700 dark:text-zinc-300 line-clamp-1">Penarikan Saldo</span>
            </button>
            <button 
              onClick={() => navigate('/dashboard/admin/settings')}
              className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-3xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 transition-colors group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-800 clay-icon-blue flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-xs font-bold text-center text-zinc-700 dark:text-zinc-300 line-clamp-1">Pengaturan Web</span>
            </button>
            <button 
              onClick={() => navigate('/dashboard/admin/reports')}
              className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-3xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 transition-colors group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-800 clay-icon-blue flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform relative">
                <Bug className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-xs font-bold text-center text-zinc-700 dark:text-zinc-300 line-clamp-1">Laporan & Bug</span>
            </button>
         </div>
      </div>

      {/* iPaymu Integration Status Banner — hanya tampil hijau jika VA & API KEY terkonfigurasi */}
      <div className={`rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border ${
        stats.digiflazzBalance > 0
          ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-100 dark:border-emerald-800/30'
          : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800/30'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            stats.digiflazzBalance > 0
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${
              stats.digiflazzBalance > 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-amber-900 dark:text-amber-100'
            }`}>Integrasi iPaymu (Payment Gateway)</h3>
            <p className={`text-xs mt-0.5 ${
              stats.digiflazzBalance > 0 ? 'text-emerald-700/80 dark:text-emerald-300/80' : 'text-amber-700/80 dark:text-amber-300/80'
            }`}>
              {stats.digiflazzBalance > 0
                ? 'Payment gateway aktif dan terkonfigurasi dengan benar.'
                : 'Pastikan IPAYMU_VA dan IPAYMU_API_KEY sudah diatur di environment variables (.env).'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            stats.digiflazzBalance > 0 ? 'bg-emerald-500' : 'bg-amber-500'
          }`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${
            stats.digiflazzBalance > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          }`}>
            {stats.digiflazzBalance > 0 ? 'Production Mode' : 'Belum Dikonfigurasi'}
          </span>
        </div>
      </div>

      {/* Configuration Alert */}
      {(stats.digiflazzBalance === 0 && !stats.digiflazzError) || (stats.digiflazzError && stats.digiflazzError.includes('credentials not configured')) ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <CircleAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">Peringatan Konfigurasi</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              Saldo Digiflazz terbaca Rp 0 atau kredensial belum diatur. Pastikan <strong>DIGIFLAZZ_USERNAME</strong> dan <strong>DIGIFLAZZ_API_KEY</strong> sudah diatur dengan benar di menu Settings. 
              Jika menggunakan Resend, pastikan <strong>RESEND_API_KEY</strong> juga sudah aktif.
            </p>
          </div>
        </div>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
        <div 
          className="bg-white dark:bg-zinc-900 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md dark:shadow-none transition-all cursor-pointer group col-span-1"
          onClick={() => setShowBreakdown(true)}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 truncate">Total Pendapatan</p>
            <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{formatRupiah(stats.totalSales)}</h3>
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 font-bold flex items-center gap-1 group-hover:underline">
              <ChevronRight className="w-3 h-3" /> Lihat breakdown sumber
            </p>
          </div>
        </div>
        <StatCard 
          title="Total Biaya (Fee)" 
          value={formatRupiah(stats.totalFees)} 
          icon={CreditCard} 
          color="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
        />
        <StatCard 
          title="Saldo Digiflazz" 
          value={stats.digiflazzError ? 'Error' : formatRupiah(stats.digiflazzBalance)} 
          icon={Wallet} 
          color={stats.digiflazzError ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"}
          subtitle={stats.digiflazzError}
        />
        <StatCard 
          title="Penjual Aktif" 
          value={`${stats.activeSellers} / ${stats.totalSellers}`} 
          icon={Users} 
          color="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
        />
        <StatCard 
          title="Penarikan Pending" 
          value={stats.pendingWithdrawals} 
          icon={AlertTriangle} 
          color="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
        />
      </div>

      {/* Seller Revenue Breakdown Modal */}
      {showBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowBreakdown(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-zinc-200 dark:border-zinc-800"
          >
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10">
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">Breakdown Total Pendapatan</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Sumber pendapatan per penjual (semua transaksi)</p>
              </div>
              <button onClick={() => setShowBreakdown(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {sellerBreakdown.length === 0 ? (
                <p className="text-center text-zinc-400 dark:text-zinc-500 text-sm italic py-8">Belum ada data penjualan per penjual</p>
              ) : (
                sellerBreakdown.map((seller, idx) => {
                  const percentage = stats.totalSales > 0 ? ((seller.total / stats.totalSales) * 100).toFixed(1) : '0';
                  return (
                    <div key={seller.id} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white">{seller.name}</span>
                          <span className="text-sm font-black text-blue-600 dark:text-blue-400">{formatRupiah(seller.total)}</span>
                        </div>
                        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-medium">{percentage}% dari total</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <span className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Total Keseluruhan</span>
                <span className="text-base font-black text-zinc-900 dark:text-white">{formatRupiah(stats.totalSales)}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-10">
        {/* Sales Chart */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-10">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-4 sm:p-8">
            <div className="flex items-center justify-between mb-6 sm:mb-10">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">Grafik Penjualan</h2>
                <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">7 Hari Terakhir</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-500 dark:bg-blue-400" />
                  <span className="text-[8px] sm:text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Pendapatan</span>
                </div>
              </div>
            </div>
            
            <div className="h-[200px] sm:h-[350px] w-full flex items-end gap-2 sm:gap-3 pt-6 sm:pt-10">
              {salesData.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-600 gap-4">
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
                          className="w-full max-w-[48px] bg-blue-500 dark:bg-blue-600 rounded-t-xl transition-all duration-300 group-hover:bg-blue-600 dark:group-hover:bg-blue-500 group-hover:shadow-lg group-hover:shadow-blue-500/20 relative"
                        >
                          {/* Tooltip */}
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black py-2 px-3 rounded-lg whitespace-nowrap z-20 shadow-xl pointer-events-none">
                            {formatRupiah(data.sales)}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 dark:bg-white rotate-45" />
                          </div>
                        </motion.div>
                      </div>
                      <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider truncate w-full text-center">
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
            {/* Pending Transactions */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden md:col-span-2">
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                  Transaksi Menunggu Konfirmasi (QRIS Manual)
                  {pendingTransactions.length > 0 && (
                    <span className="bg-blue-600 dark:bg-blue-500 text-white dark:text-blue-950 text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                      {pendingTransactions.length}
                    </span>
                  )}
                </h3>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <AnimatePresence mode="popLayout">
                  {pendingTransactions.map((tx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      key={tx.id} 
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center clay-icon">
                          <QrCode className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white">{tx.buyer_name}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">Total: {formatRupiah(tx.total_amount)}</p>
                          <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {format(new Date(tx.created_at), 'dd MMM, HH:mm:ss', { locale: id })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleRejectTransaction(tx.id)}
                          className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                          Tolak
                        </button>
                        <button 
                          onClick={() => handleApproveTransaction(tx.id)}
                          className="btn-clay-primary py-2 px-6 text-[10px] bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 border-blue-700 dark:border-blue-600 text-white dark:text-blue-950"
                        >
                          Konfirmasi Bayar
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {pendingTransactions.length === 0 && (
                  <div className="p-10 text-center text-zinc-400 text-sm font-medium italic">Tidak ada transaksi pending</div>
                )}
              </div>
            </div>

            {/* Password Reset Requests */}
            <div id="reset-requests" className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden md:col-span-2">
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/20">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                  Permintaan Reset Password
                  {resetRequests.length > 0 && (
                    <span className="bg-amber-600 dark:bg-amber-500 text-white dark:text-amber-950 text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                      {resetRequests.length}
                    </span>
                  )}
                </h3>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <AnimatePresence mode="popLayout">
                  {resetRequests.map((req) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      key={req.id} 
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center clay-icon">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white">{req.user_name}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">NIK: {req.user_nik}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="text-right mr-0 sm:mr-4">
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {format(new Date(req.created_at), 'dd MMM, HH:mm:ss', { locale: id })}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleCompleteReset(req.id)}
                          className="btn-clay-primary py-2 px-4 text-[10px] bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-600 border-amber-700 dark:border-amber-600 text-white dark:text-amber-950"
                        >
                          Selesai Reset
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {resetRequests.length === 0 && (
                  <div className="p-10 text-center text-zinc-400 text-sm font-medium italic">Tidak ada permintaan reset pending</div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  Transaksi Sukses
                </h3>
                <button className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline">Lihat Semua</button>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <AnimatePresence mode="popLayout">
                  {recentTransactions.map((tx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={tx.id} 
                      className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm clay-icon">
                          {tx.buyer_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{tx.buyer_name}</p>
                          <p className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {format(new Date(tx.created_at), 'dd MMM, HH:mm:ss', { locale: id })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-zinc-900 dark:text-white text-xs sm:text-sm">{formatRupiah(tx.total_amount || 0)}</p>
                        <span className="clay-badge bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">Berhasil</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {recentTransactions.length === 0 && (
                  <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-sm font-medium italic">Belum ada transaksi</div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                  Indikasi Palsu
                </h3>
                <button className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest hover:underline">Lihat Semua</button>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <AnimatePresence mode="popLayout">
                  {failedTransactions.map((tx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={tx.id} 
                      className="p-4 sm:p-5 flex flex-col gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center font-black text-xs clay-icon">
                            {tx.buyer_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">{tx.buyer_name}</p>
                            <p className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                              {format(new Date(tx.created_at), 'dd MMM, HH:mm', { locale: id })}
                            </p>
                          </div>
                        </div>
                        <p className="font-black text-zinc-900 dark:text-white text-xs sm:text-sm">{formatRupiah(tx.attempted_amount)}</p>
                      </div>
                      <div className="flex items-start gap-3 bg-red-50/50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100/50 dark:border-red-800/30">
                         <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                         <p className="text-[10px] text-red-700 dark:text-red-300 font-medium leading-relaxed line-clamp-2">
                           {tx.reason}
                         </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {failedTransactions.length === 0 && (
                  <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-sm font-medium italic">Tidak ada catatan gagal</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6 sm:space-y-10">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 sm:p-8">
            <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-6 sm:mb-8 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Pengaturan QRIS
            </h3>
            
            <div className="space-y-6 sm:space-y-8">
              <div className="relative group">
                <div className="absolute -inset-2 bg-blue-500/5 dark:bg-blue-500/10 rounded-3xl blur-xl group-hover:bg-blue-500/10 dark:group-hover:bg-blue-500/20 transition-colors" />
                <div className="relative bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-[2rem] border border-zinc-200/60 dark:border-zinc-700/50 flex justify-center shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]">
                  {qrisUrl ? (
                    <img src={qrisUrl} alt="QRIS Aktif" className="w-full aspect-square object-contain rounded-xl" />
                  ) : (
                    <div className="w-full aspect-square flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-600 gap-3">
                      <QrCode className="w-16 h-16 stroke-[1]" />
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Belum Ada QRIS</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] sm:text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Ganti Gambar QRIS</label>
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
                    className="w-full h-12 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-center gap-3 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                  >
                    {uploadingQris ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                        <span className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">Pilih File Baru</span>
                      </>
                    )}
                  </label>
                </div>
                
                {newQrisUrl && newQrisUrl !== qrisUrl && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/30"
                  >
                    <img src={newQrisUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg shadow-sm" />
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">Preview Terunggah</p>
                      <p className="text-[9px] text-amber-500 dark:text-amber-500/80 font-medium">Klik simpan untuk menerapkan</p>
                    </div>
                  </motion.div>
                )}
              </div>

              <button 
                onClick={handleUpdateQris} 
                disabled={!newQrisUrl || newQrisUrl === qrisUrl}
                className="btn-clay-primary w-full h-12 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none text-xs sm:text-sm"
              >
                <ShieldCheck className="w-5 h-5" />
                Simpan Perubahan
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 dark:bg-zinc-950 rounded-2xl p-8 text-white relative overflow-hidden border-none shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 dark:bg-blue-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Status Sistem
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">Database</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">AI Validator</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
                    Ready
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">Storage</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
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


