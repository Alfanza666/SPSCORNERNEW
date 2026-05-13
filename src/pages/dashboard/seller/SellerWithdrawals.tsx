import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatRupiah } from '../../../lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toWITADate } from '../../../lib/timezone';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  AlertCircle, 
  Wallet, 
  ArrowUpRight, 
  History, 
  Info,
  Loader2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

import { Skeleton } from '../../../components/ui/Skeleton';

export default function SellerWithdrawals() {
  const { user } = useAuthStore();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('BCA');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (user?.role === 'seller') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user?.id)
        .single();
        
      if (profileData) {
        setBalance(profileData.balance || 0);
      }

      const { data: withdrawalData, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setWithdrawals(withdrawalData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const withdrawAmount = Number(amount);
    
    if (withdrawAmount < 50000) {
      toast.error('Minimal penarikan adalah Rp 50.000');
      return;
    }
    
    if (withdrawAmount > balance) {
      toast.error('Saldo tidak mencukupi');
      return;
    }

    // Validasi nomor rekening / nomor HP
    const cleanAccNum = accountNumber.replace(/\s/g, '');
    if (cleanAccNum.length < 8 || cleanAccNum.length > 20 || !/^\d+$/.test(cleanAccNum)) {
      toast.error('Nomor rekening/HP tidak valid. Masukkan angka 8-20 digit.');
      return;
    }

    // Validasi nama pemilik rekening
    const cleanAccName = accountName.trim();
    if (cleanAccName.length < 3) {
      toast.error('Nama pemilik rekening minimal 3 karakter.');
      return;
    }

    try {
      setIsRequesting(true);
      
      const fee = withdrawAmount * 0.08;
      const netAmount = withdrawAmount - fee;

      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .insert({
          seller_id: user?.id,
          amount: withdrawAmount,
          fee: fee,
          net_amount: netAmount,
          status: 'pending',
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName
        });

      if (withdrawalError) throw withdrawalError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ balance: balance - withdrawAmount })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      setAmount('');
      fetchData();
      toast.success('Permintaan penarikan berhasil dikirim. Menunggu persetujuan admin.');
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      toast.error('Gagal mengirim permintaan penarikan');
    } finally {
      setIsRequesting(false);
    }
  };

  if (loading && withdrawals.length === 0) {
    return (
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-8">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-96 w-full rounded-3xl" />
          </div>
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm h-full p-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const feePreview = Number(amount) * 0.08;
  const netPreview = Number(amount) - feePreview;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">
            Penarikan Dana
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Cairkan pendapatan jualan Anda ke rekening pribadi
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 dark:bg-zinc-950 rounded-2xl p-8 text-white border-none relative overflow-hidden shadow-sm"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Saldo Tersedia</p>
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center clay-icon border-white/10">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <h2 className="text-4xl font-black tracking-tighter mb-4">
                {formatRupiah(balance)}
              </h2>
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 p-2 rounded-lg inline-flex clay-badge border-blue-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Aman & Terverifikasi
              </div>
            </div>
          </motion.div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-8">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Ajukan Penarikan
            </h3>
            <form onSubmit={handleRequestWithdrawal} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Jumlah Penarikan (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-zinc-400 dark:text-zinc-500">Rp</span>
                    <input 
                      required 
                      type="number"
                      min="50000"
                      max={balance}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Minimal 50.000"
                      className="input-clay pl-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nama Bank Tujuan</label>
                  <select 
                    required 
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="input-clay"
                  >
                    <option value="BCA">BCA (Bank Central Asia)</option>
                    <option value="Mandiri">Bank Mandiri</option>
                    <option value="BNI">BNI (Bank Negara Indonesia)</option>
                    <option value="BRI">BRI (Bank Rakyat Indonesia)</option>
                    <option value="BSI">BSI (Bank Syariah Indonesia)</option>
                    <option value="BSI">Bank Kalsel</option>
                    <option value="Gopay">GoPay</option>
                    <option value="Ovo">OVO</option>
                    <option value="Dana">DANA</option>
                    <option value="ShopeePay">ShopeePay</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nomor Rekening / HP</label>
                    <input 
                      required 
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Contoh: 1234567890"
                      className="input-clay"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nama Pemilik Rekening</label>
                    <input 
                      required 
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Contoh: John Doe"
                      className="input-clay"
                    />
                  </div>
                </div>
              </div>
              
              <AnimatePresence>
                {Number(amount) >= 50000 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-3 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)]">
                      <div className="flex justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                        <span>Jumlah Kotor</span>
                        <span>{formatRupiah(Number(amount))}</span>
                      </div>
                      {/* Breakdown rinci biaya 8% */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
                          <span>├ Biaya transfer antar bank</span>
                          <span>2.5%</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
                          <span>├ Biaya operasional platform</span>
                          <span>3.0%</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
                          <span>├ Cadangan dana darurat koperasi</span>
                          <span>1.5%</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
                          <span>└ Biaya maintenance & domain web</span>
                          <span>1.0%</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-widest border-t border-zinc-200 dark:border-zinc-700 pt-2">
                        <span>Total Biaya (8%)</span>
                        <span>-{formatRupiah(feePreview)}</span>
                      </div>
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-end">
                        <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">Dana Diterima</span>
                        <span className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{formatRupiah(netPreview)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-3">
                  <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] text-blue-800 dark:text-blue-200 font-black uppercase tracking-wider">Rincian Biaya Penarikan 8%</p>
                    <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                      Biaya 8% mencakup: biaya transfer antarbank (2.5%), operasional platform SPS Corner (3%), cadangan dana darurat koperasi (1.5%), dan biaya maintenance web + domain (1%). Biaya ini mendukung keberlangsungan platform dan koperasi.
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-800 dark:text-amber-200 font-bold uppercase tracking-wider leading-relaxed">
                    Proses pencairan 1–3 hari kerja. Konfirmasi akan dikirim ke email Anda saat transfer selesai.
                  </p>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-clay-primary w-full h-12" 
                disabled={isRequesting || Number(amount) < 50000 || Number(amount) > balance}
              >
                {isRequesting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Tarik Dana Sekarang'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm h-full overflow-hidden flex flex-col">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Riwayat Penarikan
              </h3>
            </div>
            <div className="hidden md:block flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] bg-zinc-50/50 dark:bg-zinc-800/50">
                    <th className="p-6">Tanggal</th>
                    <th className="p-6">Jumlah Kotor</th>
                    <th className="p-6">Biaya (8%)</th>
                    <th className="p-6">Diterima</th>
                    <th className="p-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group">
                      <td className="p-6">
                        <p className="font-bold text-zinc-900 dark:text-white">{format(toWITADate(w.created_at), 'dd MMM yyyy', { locale: id })}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">{format(toWITADate(w.created_at), 'HH:mm', { locale: id })} WITA</p>
                      </td>
                      <td className="p-6 text-sm font-bold text-zinc-600 dark:text-zinc-400">{formatRupiah(w.amount)}</td>
                      <td className="p-6 text-sm font-bold text-red-500 dark:text-red-400">-{formatRupiah(w.fee)}</td>
                      <td className="p-6">
                        <p className="font-black text-blue-600 dark:text-blue-400">{formatRupiah(w.net_amount)}</p>
                      </td>
                      <td className="p-6">
                        {w.status === 'pending' && (
                          <span className="clay-badge bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <Clock className="w-3 h-3 mr-1.5" /> Pending
                          </span>
                        )}
                        {w.status === 'approved' && (
                          <span className="clay-badge bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <CheckCircle2 className="w-3 h-3 mr-1.5" /> Disetujui
                          </span>
                        )}
                        {w.status === 'paid' && (
                          <span className="clay-badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            <CheckCircle2 className="w-3 h-3 mr-1.5" /> Dibayar
                          </span>
                        )}
                        {w.status === 'rejected' && (
                          <span className="clay-badge bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            <XCircle className="w-3 h-3 mr-1.5" /> Ditolak
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-4 text-zinc-300 dark:text-zinc-600">
                          <History className="w-16 h-16 stroke-[1]" />
                          <p className="font-bold text-zinc-400 dark:text-zinc-500">Belum ada riwayat penarikan</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800 flex-1 overflow-y-auto">
              {withdrawals.map((w) => (
                <div key={w.id} className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-zinc-900 dark:text-white">{format(new Date(w.created_at), 'dd MMM yyyy', { locale: id })}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">{format(new Date(w.created_at), 'HH:mm', { locale: id })} WITA</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-blue-600 dark:text-blue-400 text-lg tracking-tight">{formatRupiah(w.net_amount)}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Diterima</p>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)]">
                    <div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-wider">Kotor</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{formatRupiah(w.amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-red-500 dark:text-red-400 font-black uppercase tracking-wider">Biaya (8%)</p>
                      <p className="text-sm font-bold text-red-500 dark:text-red-400">-{formatRupiah(w.fee)}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    {w.status === 'pending' && (
                      <span className="clay-badge bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <Clock className="w-3 h-3 mr-1.5" /> Pending
                      </span>
                    )}
                    {w.status === 'approved' && (
                      <span className="clay-badge bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <CheckCircle2 className="w-3 h-3 mr-1.5" /> Disetujui
                      </span>
                    )}
                    {w.status === 'paid' && (
                      <span className="clay-badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <CheckCircle2 className="w-3 h-3 mr-1.5" /> Dibayar
                      </span>
                    )}
                    {w.status === 'rejected' && (
                      <span className="clay-badge bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        <XCircle className="w-3 h-3 mr-1.5" /> Ditolak
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
