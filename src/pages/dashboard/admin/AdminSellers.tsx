import React, { useState, useEffect } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../../lib/supabase';
import { formatRupiah } from '../../../lib/utils';
import { 
  Users, 
  Plus, 
  Trash2, 
  Power, 
  PowerOff, 
  Search, 
  Filter, 
  MoreVertical,
  Mail,
  ShieldCheck,
  X,
  Loader2,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

import { Skeleton } from '../../../components/ui/Skeleton';
import { useAuthStore } from '../../../store/useAuthStore';

export default function AdminSellers() {
  const { user } = useAuthStore();
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSeller, setNewSeller] = useState({ nik: '', password: '', name: '' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Revision State
  const [selectedSellerForRevision, setSelectedSellerForRevision] = useState<any | null>(null);
  const [revisionAmount, setRevisionAmount] = useState<string>('');
  const [revisionType, setRevisionType] = useState<'add' | 'subtract'>('add');
  const [isRevising, setIsRevising] = useState(false);

  // Seller Registration Link State
  const [sellerLinkDays, setSellerLinkDays] = useState(7);
  const [sellerLinkUses, setSellerLinkUses] = useState(1);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [sellerLinkExpires, setSellerLinkExpires] = useState('');

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleReviseBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSellerForRevision || !revisionAmount) return;
    
    setIsRevising(true);
    try {
      const amount = Number(revisionAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Jumlah revisi tidak valid');
        return;
      }

      const currentBalance = selectedSellerForRevision.balance || 0;
      const newBalance = revisionType === 'add' ? currentBalance + amount : currentBalance - amount;

      if (newBalance < 0) {
        toast.error('Saldo tidak boleh menjadi negatif');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', selectedSellerForRevision.id);

      if (error) throw error;

      toast.success('Saldo berhasil direvisi');
      setSelectedSellerForRevision(null);
      setRevisionAmount('');
      fetchSellers();
    } catch (error: any) {
      console.error('Error revising balance:', error);
      toast.error(`Gagal merevisi saldo: ${error.message}`);
    } finally {
      setIsRevising(false);
    }
  };

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'seller')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setSellers(data || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanNik = newSeller.nik.trim();
      
      // Check if NIK already exists
      const { data: nikExists, error: checkError } = await supabase
        .rpc('check_nik_exists', { p_nik: cleanNik });

      if (checkError) {
        console.warn('check_nik_exists RPC failed, falling back to direct select:', checkError);
        // Fallback to direct select if RPC is not available
        const { data: existingUser, error: fallbackError } = await supabase
          .from('profiles')
          .select('id')
          .eq('nik', cleanNik)
          .maybeSingle();
          
        if (fallbackError) {
          console.error('Fallback NIK check failed:', fallbackError);
          toast.error('Terjadi kesalahan pada database. Pastikan schema database sudah diperbarui (menjalankan supabase-schema.sql).');
          setLoading(false);
          return;
        }

        if (existingUser) {
          toast.error('Gagal menambahkan penjual: NIK ini sudah terdaftar di sistem.');
          setLoading(false);
          return;
        }
      } else if (nikExists) {
        toast.error('Gagal menambahkan penjual: NIK ini sudah terdaftar di sistem.');
        setLoading(false);
        return;
      }

      const { createClient } = await import('@supabase/supabase-js');
      
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      });
      
      const email = `${cleanNik}@sps.local`;
      
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: email,
        password: newSeller.password,
        options: {
          data: {
            nik: cleanNik,
            name: newSeller.name,
            role: 'seller'
          }
        }
      });

      if (authError) {
        const errorMessage = authError.message?.toLowerCase() || '';
        if (errorMessage.includes('database error saving new user') || errorMessage.includes('user already registered')) {
          throw new Error('NIK ini sudah terdaftar di sistem.');
        }
        throw authError;
      }

      toast.success('Penjual berhasil ditambahkan!');
      setIsAdding(false);
      setNewSeller({ nik: '', password: '', name: '' });
      fetchSellers();
    } catch (error: any) {
      console.error('Error adding seller:', error);
      toast.error(`Gagal menambahkan penjual: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state optimistically
      setSellers(prev => prev.map(s => 
        s.id === id ? { ...s, is_active: !currentStatus } : s
      ));
    } catch (error) {
      console.error('Error updating seller status:', error);
      toast.error('Gagal mengubah status penjual');
    }
  };

  const handleDeleteSeller = async (id: string) => {
    try {
      // Delete products first to avoid foreign key constraint errors
      await supabase.from('products').delete().eq('seller_id', id);
      
      // Delete user via RPC (this will cascade to profiles)
      const { error } = await supabase.rpc('delete_user', { p_user_id: id });
      if (error) throw error;
      
      fetchSellers();
      toast.success('Penjual berhasil dihapus');
    } catch (error: any) {
      console.error('Error deleting seller:', error);
      toast.error(`Gagal menghapus penjual: ${error.message}`);
    }
  };

  const generateSellerLink = async () => {
    if (!user?.id) {
      toast.error('Anda belum login');
      return;
    }
    
    try {
      setGeneratingLink(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session ? 'exists' : 'null', 'Token:', session?.access_token?.slice(0,10));
      if (!session?.access_token) {
        toast.error('Sesi tidak ditemukan. Refresh halaman atau login ulang.');
        return;
      }
      const response = await fetch('/api/admin/seller-registration-links', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          days: sellerLinkDays, 
          maxUses: sellerLinkUses 
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal generate link');
      }

      setGeneratedLink(result.link);
      setSellerLinkExpires(result.expiresAt);
      toast.success('Link berhasil dibuat!');
      
    } catch (error: any) {
      console.error('Error generating seller link:', error);
      toast.error(error.message || 'Gagal generate link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const filteredSellers = sellers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">
            Manajemen Penjual
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Total {sellers.length} mitra penjual terdaftar
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(true)} 
          className="btn-clay-primary h-12 px-8 flex items-center gap-3 shadow-blue-600/20"
        >
          <UserPlus className="w-5 h-5" />
          Tambah Penjual
        </button>
      </div>

      {/* Seller Registration Link - untuk admin & superadmin */}
      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800/30 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                🔗 Link Pendaftaran Seller Baru
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Buat link untuk orang baru daftar jadi seller dengan batas waktu tertentu
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Berlaku (hari)</label>
              <select
                value={sellerLinkDays}
                onChange={(e) => setSellerLinkDays(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm"
              >
                <option value={2}>2 Hari</option>
                <option value={3}>3 Hari</option>
                <option value={7}>7 Hari</option>
                <option value={14}>14 Hari</option>
                <option value={30}>30 Hari</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">Max Penggunaan</label>
              <select
                value={sellerLinkUses}
                onChange={(e) => setSellerLinkUses(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm"
              >
                <option value={1}>1x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={generateSellerLink}
                disabled={generatingLink}
                className="btn-clay-primary w-full"
              >
                {generatingLink ? 'Membuat...' : 'Generate Link'}
              </button>
            </div>
          </div>

          {generatedLink && (
            <div className="mt-4 p-4 bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-700 rounded-xl">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">✅ Link Berhasil Dibuat:</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    toast.success('Link disalin!');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Copy
                </button>
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2">
                Berlaku hingga: {new Date(sellerLinkExpires).toLocaleDateString('id-ID', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari nama penjual..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-clay pl-12 h-12"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-clay-secondary h-12 px-6 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm p-8 bg-blue-50/30 dark:bg-blue-900/10 mb-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Tambah Penjual Baru</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddSeller} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Nama Toko/Penjual</label>
                    <input 
                      required 
                      value={newSeller.name}
                      onChange={(e) => setNewSeller({...newSeller, name: e.target.value})}
                      placeholder="Contoh: Toko Sejahtera"
                      className="input-clay"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">NIK Login</label>
                    <input 
                      required 
                      type="text"
                      value={newSeller.nik}
                      onChange={(e) => setNewSeller({...newSeller, nik: e.target.value})}
                      placeholder="Masukkan NIK"
                      className="input-clay"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Password</label>
                    <input 
                      required 
                      type="password"
                      minLength={6}
                      value={newSeller.password}
                      onChange={(e) => setNewSeller({...newSeller, password: e.target.value})}
                      placeholder="Minimal 6 karakter"
                      className="input-clay"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="btn-clay-secondary px-8">Batal</button>
                  <button type="submit" disabled={loading} className="btn-clay-primary px-10 shadow-blue-600/20">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Penjual'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] bg-zinc-50/50 dark:bg-zinc-800/50">
                <th className="p-6">Profil Penjual</th>
                <th className="p-6">Total Penjualan</th>
                <th className="p-6">Penjualan Bersih</th>
                <th className="p-6">Saldo Aktif</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredSellers.map((seller) => (
                <motion.tr 
                  layout
                  key={seller.id} 
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-xl shadow-inner">
                        {seller.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{seller.name}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {seller.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="font-bold text-zinc-900 dark:text-white">{formatRupiah(seller.total_sales || 0)}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Akumulasi kotor</p>
                  </td>
                  <td className="p-6">
                    <p className="font-bold text-amber-600 dark:text-amber-500">{formatRupiah((seller.total_sales || 0) * 0.92)}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Setelah biaya 8%</p>
                  </td>
                  <td className="p-6">
                    <p className="font-black text-blue-600 dark:text-blue-400">{formatRupiah(seller.balance || 0)}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Siap ditarik</p>
                  </td>
                  <td className="p-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      seller.is_active ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                    }`}>
                      {seller.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedSellerForRevision(seller)}
                        className="p-3 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                        title="Detail & Revisi Saldo"
                      >
                        <ShieldCheck className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleToggleActive(seller.id, seller.is_active)}
                        className={`p-3 rounded-xl transition-all ${
                          seller.is_active 
                            ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" 
                            : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                        }`}
                        title={seller.is_active ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {seller.is_active ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteSeller(seller.id)}
                        className="p-3 text-zinc-300 dark:text-zinc-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                        title="Hapus"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredSellers.map((seller) => (
            <div key={seller.id} className="p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-lg">
                  {seller.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-900 dark:text-white text-sm truncate">{seller.name}</p>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">{seller.id.slice(0, 8)}...</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  seller.is_active ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                }`}>
                  {seller.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div>
                  <p className="text-[8px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Saldo</p>
                  <p className="font-bold text-blue-600 dark:text-blue-400 text-xs">{formatRupiah(seller.balance || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Penjualan</p>
                  <p className="font-bold text-zinc-900 dark:text-white text-xs">{formatRupiah(seller.total_sales || 0)}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button 
                  onClick={() => setSelectedSellerForRevision(seller)}
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all font-bold text-[10px]"
                >
                  Revisi
                </button>
                <button 
                  onClick={() => handleToggleActive(seller.id, seller.is_active)}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-all ${
                    seller.is_active 
                      ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20" 
                      : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"
                  }`}
                >
                  {seller.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button 
                  onClick={() => handleDeleteSeller(seller.id)}
                  className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredSellers.length === 0 && (
          <div className="p-20 text-center">
            <div className="flex flex-col items-center gap-4 text-zinc-300 dark:text-zinc-600">
              <Users className="w-16 h-16 stroke-[1]" />
              <p className="font-bold text-zinc-400 dark:text-zinc-500">Tidak ada penjual ditemukan</p>
            </div>
          </div>
        )}
      </div>

      {/* Revision Modal */}
      <AnimatePresence>
        {selectedSellerForRevision && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">Detail & Revisi Saldo</h3>
                <button onClick={() => setSelectedSellerForRevision(null)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Penjual</p>
                  <p className="font-black text-zinc-900 dark:text-white">{selectedSellerForRevision.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">ID: {selectedSellerForRevision.id}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Saldo Saat Ini</p>
                    <p className="font-black text-blue-700 dark:text-blue-300 text-lg">{formatRupiah(selectedSellerForRevision.balance || 0)}</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Total Penjualan</p>
                    <p className="font-black text-zinc-900 dark:text-white text-lg">{formatRupiah(selectedSellerForRevision.total_sales || 0)}</p>
                  </div>
                </div>

                <form onSubmit={handleReviseBalance} className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <h4 className="font-bold text-zinc-900 dark:text-white">Form Revisi Saldo</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRevisionType('add')}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm border transition-all ${
                        revisionType === 'add' 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300' 
                          : 'bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400'
                      }`}
                    >
                      + Tambah Saldo
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevisionType('subtract')}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm border transition-all ${
                        revisionType === 'subtract' 
                          ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300' 
                          : 'bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400'
                      }`}
                    >
                      - Kurangi Saldo
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Jumlah (Rp)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={revisionAmount}
                      onChange={(e) => setRevisionAmount(e.target.value)}
                      placeholder="Masukkan jumlah..."
                      className="input-clay w-full"
                    />
                  </div>
                  <div className="pt-2 flex justify-end gap-3">
                    <button type="button" onClick={() => setSelectedSellerForRevision(null)} className="btn-clay-secondary px-6">Batal</button>
                    <button type="submit" disabled={isRevising} className="btn-clay-primary px-6">
                      {isRevising ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Revisi'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
