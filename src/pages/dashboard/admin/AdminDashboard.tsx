import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatRupiah } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp,
  AlertTriangle,
  CircleAlert,
  XCircle,
  Image as ImageIcon,
  DollarSign,
  ShieldCheck,
  Calendar,
  ChevronRight,
  Upload,
  Wallet,
  QrCode,
  Loader2,
  Receipt,
  Wrench,
  RotateCw,
  CircleDollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

type OverviewMetrics = {
  grossSettled: number;
  recordedFee: number;
  netSettled: number;
  settledCount: number;
  pendingCount: number;
  failedCount: number;
  failedAmount: number;
  validationFailedCount: number;
  totalSellers: number;
  activeSellers: number;
  pendingWithdrawals: number;
  itemGrossSettled?: number;
  allocationDifference?: number;
  unallocatedGross?: number;
  overallocatedGross?: number;
  ledgerComplete?: boolean;
  fulfillmentFailedCount?: number;
  fulfillmentFailedAmount?: number;
};

type DashboardOverview = {
  metrics: OverviewMetrics;
  sellerBreakdown: any[];
  salesChart: any[];
  recentSettled: any[];
  pendingTransactions: any[];
};

const EMPTY_METRICS: OverviewMetrics = {
  grossSettled: 0,
  recordedFee: 0,
  netSettled: 0,
  settledCount: 0,
  pendingCount: 0,
  failedCount: 0,
  failedAmount: 0,
  validationFailedCount: 0,
  totalSellers: 0,
  activeSellers: 0,
  pendingWithdrawals: 0,
  itemGrossSettled: 0,
  allocationDifference: 0,
  unallocatedGross: 0,
  overallocatedGross: 0,
  ledgerComplete: true,
  fulfillmentFailedCount: 0,
  fulfillmentFailedAmount: 0,
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getSellerTotal = (seller: any) =>
  toNumber(seller?.grossSettled ?? seller?.gross_settled ?? seller?.total ?? seller?.amount);

const getSellerName = (seller: any) =>
  seller?.sellerName || seller?.seller_name || seller?.name || 'Sumber belum terpetakan';

const getChartTotal = (entry: any) =>
  toNumber(entry?.grossSettled ?? entry?.gross_settled ?? entry?.total ?? entry?.sales ?? entry?.amount);

const formatChartDate = (entry: any) => {
  if (entry?.label) return String(entry.label);
  const rawDate = entry?.date || entry?.day;
  if (!rawDate) return '-';
  const parsed = new Date(`${String(rawDate).slice(0, 10)}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime())
    ? String(rawDate)
    : format(parsed, 'dd MMM', { locale: id });
};

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<DashboardOverview>({
    metrics: EMPTY_METRICS,
    sellerBreakdown: [],
    salesChart: [],
    recentSettled: [],
    pendingTransactions: [],
  });
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [qrisUrl, setQrisUrl] = useState('');
  const [newQrisUrl, setNewQrisUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [uploadingQris, setUploadingQris] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAdminTools, setShowAdminTools] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      fetchDashboardData();
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sesi admin berakhir. Silakan masuk kembali.');

      const authHeader = { Authorization: `Bearer ${session.access_token}` };
      const [overviewRes, resetsResult, qrisResult] = await Promise.all([
        fetch('/api/admin/dashboard/overview', { headers: authHeader }),
        fetch('/api/admin/password-resets', { headers: authHeader })
          .then(async response => response.ok ? response.json() : [])
          .catch(error => {
            console.error('Failed to fetch password resets:', error);
            return [];
          }),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'qris_image_url')
          .maybeSingle(),
      ]);

      const overviewPayload = await overviewRes.json().catch(() => null);
      if (!overviewRes.ok) {
        throw new Error(overviewPayload?.error || `Gagal memuat ringkasan (${overviewRes.status})`);
      }

      const dashboardData = overviewPayload?.data;
      if (!dashboardData?.metrics) {
        throw new Error('Respons ringkasan dashboard tidak lengkap.');
      }

      const rawMetrics = dashboardData.metrics;
      const normalizedOverview: DashboardOverview = {
        metrics: {
          grossSettled: toNumber(rawMetrics.grossSettled),
          recordedFee: toNumber(rawMetrics.recordedFee),
          netSettled: toNumber(rawMetrics.netSettled),
          settledCount: toNumber(rawMetrics.settledCount),
          pendingCount: toNumber(rawMetrics.pendingCount),
          failedCount: toNumber(rawMetrics.failedCount),
          failedAmount: toNumber(rawMetrics.failedAmount),
          validationFailedCount: toNumber(rawMetrics.validationFailedCount),
          totalSellers: toNumber(rawMetrics.totalSellers),
          activeSellers: toNumber(rawMetrics.activeSellers),
          pendingWithdrawals: toNumber(rawMetrics.pendingWithdrawals),
          itemGrossSettled: toNumber(rawMetrics.itemGrossSettled),
          allocationDifference: toNumber(rawMetrics.allocationDifference),
          unallocatedGross: toNumber(rawMetrics.unallocatedGross),
          overallocatedGross: toNumber(rawMetrics.overallocatedGross),
          ledgerComplete: rawMetrics.ledgerComplete !== false,
          fulfillmentFailedCount: toNumber(rawMetrics.fulfillmentFailedCount),
          fulfillmentFailedAmount: toNumber(rawMetrics.fulfillmentFailedAmount),
        },
        sellerBreakdown: Array.isArray(dashboardData.sellerBreakdown) ? dashboardData.sellerBreakdown : [],
        salesChart: Array.isArray(dashboardData.salesChart) ? dashboardData.salesChart : [],
        recentSettled: Array.isArray(dashboardData.recentSettled) ? dashboardData.recentSettled : [],
        pendingTransactions: Array.isArray(dashboardData.pendingTransactions) ? dashboardData.pendingTransactions : [],
      };

      setOverview(normalizedOverview);
      setPendingTransactions(normalizedOverview.pendingTransactions);
      setResetRequests(Array.isArray(resetsResult) ? resetsResult : []);

      if (!qrisResult.error && qrisResult.data?.value) {
        setQrisUrl(qrisResult.data.value);
        setNewQrisUrl(qrisResult.data.value);
      }
      setDashboardError(null);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      const message = error instanceof Error ? error.message : 'Gagal memuat ringkasan dashboard.';
      setDashboardError(message);
      toast.error(message);
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
      setPendingTransactions(prev => prev.filter(tx => tx.id !== txId));
      await fetchDashboardData();
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
      await fetchDashboardData();
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
          if (errorJson.tip) errorMessage += `\n\nTips: ${errorJson.tip}`;
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { metrics } = overview;
  const salesData = overview.salesChart.map(entry => ({
    ...entry,
    label: formatChartDate(entry),
    total: getChartTotal(entry),
  }));
  const maxSales = Math.max(...salesData.map(entry => entry.total), 1);
  const breakdownTotal = overview.sellerBreakdown.reduce(
    (sum, seller) => sum + getSellerTotal(seller),
    0,
  );
  const breakdownDifference = metrics.grossSettled - breakdownTotal;
  const expectedNetSettled = toNumber(metrics.itemGrossSettled) - metrics.recordedFee;
  const netDifference = metrics.netSettled - expectedNetSettled;
  const needsAction =
    metrics.pendingCount +
    metrics.pendingWithdrawals +
    resetRequests.length;
  const hasFinancialMismatch =
    Math.abs(breakdownDifference) >= 1 || Math.abs(netDifference) >= 1 || metrics.ledgerComplete === false;

  const MetricCard = ({
    title,
    value,
    description,
    formula,
    icon: Icon,
    iconClass,
    onClick,
    footer,
  }: any) => {
    const Component = onClick ? 'button' : 'div';
    return (
      <Component
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={[
          'group flex min-h-36 w-full flex-col rounded-2xl border border-zinc-100 bg-white p-5 text-left shadow-sm transition-all dark:border-zinc-800 dark:bg-zinc-900 sm:p-6',
          onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:hover:border-blue-800' : '',
        ].join(' ')}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className={['flex h-11 w-11 items-center justify-center rounded-2xl', iconClass].join(' ')}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="group/info relative inline-flex">
            <CircleAlert className="h-4 w-4 cursor-help text-zinc-400" aria-label={'Rumus ' + title} />
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-6 z-30 hidden w-64 rounded-xl bg-zinc-950 px-3 py-2 text-[11px] font-medium leading-relaxed text-white shadow-xl group-hover/info:block dark:bg-white dark:text-zinc-900"
            >
              {formula}
            </span>
          </span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{title}</p>
        <p className="mt-1 text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">{value}</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
        {footer}
      </Component>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            Overview Dashboard
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
            </span>
            <span>{metrics.activeSellers}/{metrics.totalSellers} penjual aktif</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <RotateCw className="h-4 w-4" />
            Segarkan
          </button>
          <button
            type="button"
            onClick={() => setShowAdminTools(true)}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
          >
            <Wrench className="h-4 w-4" />
            Alat Admin
          </button>
        </div>
      </div>

      {dashboardError && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-bold">Ringkasan belum dapat dipercaya</p>
              <p className="mt-1 text-xs">{dashboardError}</p>
            </div>
          </div>
          <button type="button" onClick={fetchDashboardData} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700">
            Coba lagi
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Omzet Lunas (GMV)"
          value={formatRupiah(metrics.grossSettled)}
          description={metrics.settledCount.toLocaleString('id-ID') + ' transaksi paid/success, semua waktu'}
          formula="Jumlah total transaksi berstatus paid atau success. Pending dan gagal tidak dihitung."
          icon={DollarSign}
          iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
          onClick={() => setShowBreakdown(true)}
          footer={
            <span className="mt-auto flex items-center gap-1 pt-3 text-[11px] font-bold text-blue-600 dark:text-blue-400">
              Lihat sumber omzet <ChevronRight className="h-3.5 w-3.5" />
            </span>
          }
        />
        <MetricCard
          title="Fee Tercatat"
          value={formatRupiah(metrics.recordedFee)}
          description="Selisih nilai bruto dan subtotal ledger transaksi lunas"
          formula="Item gross settled dikurangi subtotal ledger settled. Transaksi tanpa item tidak dihitung sebagai fee."
          icon={CircleDollarSign}
          iconClass="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
        />
        <MetricCard
          title="Bersih Setelah Fee"
          value={formatRupiah(metrics.netSettled)}
          description="Jumlah subtotal ledger untuk transaksi lunas"
          formula="Jumlah subtotal transaction_items pada transaksi paid atau success; setara GMV dikurangi fee tercatat. Bukan saldo kas atau saldo bank."
          icon={Wallet}
          iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
        />
        <MetricCard
          title="Perlu Tindakan"
          value={needsAction.toLocaleString('id-ID')}
          description={metrics.pendingCount + ' transaksi | ' + resetRequests.length + ' reset | ' + metrics.pendingWithdrawals + ' penarikan'}
          formula="Transaksi pending + penarikan pending + permintaan reset password. Percobaan validasi gagal adalah riwayat, bukan antrean tindakan."
          icon={AlertTriangle}
          iconClass="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
          footer={
            <p className="mt-auto pt-3 text-[11px] font-semibold text-red-600 dark:text-red-400">
              {metrics.failedCount} transaksi gagal | {formatRupiah(metrics.failedAmount)}
            </p>
          }
        />
      </div>

      {hasFinancialMismatch && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Rekonsiliasi data diperlukan</p>
            <p className="mt-1 text-xs leading-relaxed">
              {Math.abs(breakdownDifference) >= 1
                ? 'Breakdown berbeda ' + formatRupiah(Math.abs(breakdownDifference)) + ' dari omzet. '
                : ''}
              {Math.abs(netDifference) >= 1
                ? 'Nilai bersih berbeda ' + formatRupiah(Math.abs(netDifference)) + ' dari rumus omzet dikurangi fee.'
                : ''}
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-white sm:text-lg">
                Omzet Lunas 7 Hari
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Hanya transaksi paid/success, dikelompokkan menurut kalender WITA.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              GMV settled
            </div>
          </div>

          <div className="mt-6 flex h-60 w-full items-end gap-2 sm:h-72 sm:gap-3">
            {salesData.length === 0 ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-zinc-300 dark:text-zinc-600">
                <TrendingUp className="h-10 w-10 stroke-[1]" />
                <p className="text-sm font-semibold">Belum ada transaksi lunas dalam 7 hari</p>
              </div>
            ) : (
              salesData.map((entry, index) => {
                const heightPercentage = (entry.total / maxSales) * 100;
                return (
                  <div
                    key={entry.date || entry.day || index}
                    className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-3"
                  >
                    <div className="relative flex h-full w-full items-end justify-center">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: Math.max(heightPercentage, entry.total > 0 ? 4 : 0) + '%' }}
                        transition={{ duration: 0.6, delay: index * 0.04 }}
                        className="relative w-full max-w-12 rounded-t-lg bg-blue-500 transition-colors group-hover:bg-blue-600"
                      >
                        <div className="pointer-events-none absolute -top-11 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block dark:bg-white dark:text-zinc-950">
                          {formatRupiah(entry.total)}
                        </div>
                      </motion.div>
                    </div>
                    <span className="w-full truncate text-center text-[9px] font-bold uppercase text-zinc-400 sm:text-[10px]">
                      {entry.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="flex min-h-80 flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 p-4 dark:border-zinc-800 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-zinc-900 dark:text-white">Pusat Tindakan</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Antrean yang membutuhkan keputusan admin.</p>
              </div>
              {needsAction > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {needsAction}
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['Pembayaran', metrics.pendingCount],
                ['Reset akun', resetRequests.length],
                ['Penarikan', metrics.pendingWithdrawals],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-0.5 text-base font-black text-zinc-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            {toNumber(metrics.fulfillmentFailedCount) > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="text-[10px] font-black uppercase tracking-wider">Fulfillment digital perlu rekonsiliasi</p>
                <p className="mt-1 text-[10px] leading-relaxed">
                  {toNumber(metrics.fulfillmentFailedCount)} pembayaran sudah lunas, tetapi pengiriman produk digital gagal
                  {toNumber(metrics.fulfillmentFailedAmount) > 0
                    ? ' | ' + formatRupiah(toNumber(metrics.fulfillmentFailedAmount))
                    : ''}.
                </p>
              </div>
            )}
          </div>

          <div className="max-h-[30rem] flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {pendingTransactions.slice(0, 3).map(transaction => (
              <div key={transaction.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">
                      {transaction.buyer_name || transaction.buyerName || 'Pembeli'}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                      Pembayaran pending | {formatRupiah(transaction.total_amount ?? transaction.totalAmount ?? 0)}
                    </p>
                  </div>
                  <Receipt className="h-4 w-4 shrink-0 text-blue-500" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRejectTransaction(transaction.id)}
                    className="h-8 rounded-lg border border-red-200 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  >
                    Tolak
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveTransaction(transaction.id)}
                    className="h-8 rounded-lg bg-blue-600 text-[10px] font-bold text-white hover:bg-blue-700"
                  >
                    Konfirmasi
                  </button>
                </div>
              </div>
            ))}

            {resetRequests.slice(0, 3).map(request => (
              <div key={request.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">
                    {request.user_name || 'Pengguna'}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">Permintaan reset password</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCompleteReset(request.id)}
                  className="h-8 shrink-0 rounded-lg bg-amber-100 px-3 text-[10px] font-bold text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
                >
                  Tandai selesai
                </button>
              </div>
            ))}

            {pendingTransactions.length === 0 && resetRequests.length === 0 && (
              <div className="flex min-h-32 flex-col items-center justify-center gap-2 p-6 text-center text-zinc-400">
                <ShieldCheck className="h-8 w-8 text-emerald-500" />
                <p className="text-sm font-semibold">Tidak ada antrean pembayaran atau reset akun</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/transactions')}
            className="border-t border-zinc-100 p-3 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:border-zinc-800 dark:text-blue-400 dark:hover:bg-blue-950/20"
          >
            Buka riwayat transaksi
          </button>
        </section>
      </div>

      {showBreakdown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 backdrop-blur-sm sm:p-4"
          onClick={() => setShowBreakdown(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revenue-breakdown-title"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={event => event.stopPropagation()}
            className="flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:max-h-[calc(100dvh-2rem)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-4 dark:border-zinc-800 sm:p-6">
              <div>
                <h2 id="revenue-breakdown-title" className="text-lg font-black text-zinc-900 dark:text-white">
                  Sumber Omzet Lunas
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Agregasi seluruh transaksi paid/success, termasuk PPOB.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup rincian omzet"
                onClick={() => setShowBreakdown(false)}
                className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {overview.sellerBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">Belum ada rincian sumber omzet.</p>
              ) : (
                overview.sellerBreakdown.map((seller, index) => {
                  const total = getSellerTotal(seller);
                  const percentage = metrics.grossSettled > 0
                    ? (total / metrics.grossSettled) * 100
                    : 0;
                  return (
                    <div key={seller.sellerId || seller.seller_id || seller.id || index} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{getSellerName(seller)}</p>
                          <p className="shrink-0 text-sm font-black text-blue-600 dark:text-blue-400">{formatRupiah(total)}</p>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: Math.min(percentage, 100) + '%' }} />
                        </div>
                        <p className="mt-1 text-[10px] font-medium text-zinc-400">{percentage.toFixed(1)}% dari GMV</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Total breakdown</span>
                <span className="text-base font-black text-zinc-950 dark:text-white">{formatRupiah(breakdownTotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-500">Omzet lunas</span>
                <span className="font-bold text-zinc-700 dark:text-zinc-200">{formatRupiah(metrics.grossSettled)}</span>
              </div>
              {Math.abs(breakdownDifference) >= 1 && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  Selisih rekonsiliasi: {formatRupiah(Math.abs(breakdownDifference))}. Jangan gunakan breakdown ini sebelum data diperbaiki.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {showAdminTools && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 backdrop-blur-sm sm:p-4"
          onClick={() => setShowAdminTools(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-tools-title"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={event => event.stopPropagation()}
            className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:max-h-[calc(100dvh-2rem)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-4 dark:border-zinc-800 sm:p-6">
              <div>
                <h2 id="admin-tools-title" className="flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-white">
                  <Wrench className="h-5 w-5 text-blue-600" />
                  Alat Admin
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Pengujian email dan pengaturan QRIS dipisahkan dari ringkasan operasional.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup alat admin"
                onClick={() => setShowAdminTools(false)}
                className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-6 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[0.8fr_1.2fr]">
              <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 sm:p-5">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">Pengujian Sistem</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Kirim email uji tanpa mencampurkannya dengan metrik pendapatan.
                </p>
                <button
                  type="button"
                  onClick={handleTestEmail}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Test Email Sariroti
                </button>
              </section>

              <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 sm:p-5">
                <h3 className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  Pengaturan QRIS
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                    {newQrisUrl || qrisUrl ? (
                      <img src={newQrisUrl || qrisUrl} alt="Pratinjau QRIS aktif" className="h-full w-full object-contain" />
                    ) : (
                      <QrCode className="h-14 w-14 text-zinc-300 dark:text-zinc-600" />
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrisUpload}
                      disabled={uploadingQris}
                      className="hidden"
                      id="dashboard-qris-upload"
                    />
                    <label
                      htmlFor="dashboard-qris-upload"
                      className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 text-xs font-bold text-zinc-600 hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-blue-950/20"
                    >
                      {uploadingQris ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploadingQris ? 'Mengunggah...' : 'Pilih gambar QRIS'}
                    </label>
                    <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
                      Maksimal 2 MB. Perubahan baru aktif setelah disimpan.
                    </p>
                    <button
                      type="button"
                      onClick={handleUpdateQris}
                      disabled={!newQrisUrl || newQrisUrl === qrisUrl}
                      className="mt-4 h-11 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Simpan QRIS
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}


