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

import { Skeleton } from '../../../components/ui/Skeleton';

export default function AdminSellers() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSeller, setNewSeller] = useState({ nik: '', password: '', name: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSellers();
  }, []);

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
          alert('Terjadi kesalahan pada database. Pastikan schema database sudah diperbarui (menjalankan supabase-schema.sql).');
          setLoading(false);
          return;
        }

        if (existingUser) {
          alert('Gagal menambahkan penjual: NIK ini sudah terdaftar di sistem.');
          setLoading(false);
          return;
        }
      } else if (nikExists) {
        alert('Gagal menambahkan penjual: NIK ini sudah terdaftar di sistem.');
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

      alert('Penjual berhasil ditambahkan!');
      setIsAdding(false);
      setNewSeller({ nik: '', password: '', name: '' });
      fetchSellers();
    } catch (error: any) {
      console.error('Error adding seller:', error);
      alert(`Gagal menambahkan penjual: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const action = currentStatus ? 'menonaktifkan' : 'mengaktifkan';
    if (!confirm(`Yakin ingin ${action} penjual ini?`)) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      fetchSellers();
    } catch (error) {
      console.error('Error updating seller status:', error);
      alert('Gagal mengubah status penjual');
    }
  };

  const handleDeleteSeller = async (id: string) => {
    if (!confirm('Yakin ingin menghapus penjual ini? Semua produk dan data terkait akan terhapus.')) return;
    
    try {
      // Delete products first to avoid foreign key constraint errors
      await supabase.from('products').delete().eq('seller_id', id);
      
      // Delete user via RPC (this will cascade to profiles)
      const { error } = await supabase.rpc('delete_user', { p_user_id: id });
      if (error) throw error;
      
      fetchSellers();
    } catch (error: any) {
      console.error('Error deleting seller:', error);
      alert(`Gagal menghapus penjual: ${error.message}`);
    }
  };

  const filteredSellers = sellers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight mb-2">
            Manajemen Penjual
          </h1>
          <p className="text-zinc-500 font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
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

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
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
            <div className="glass-card p-8 border-blue-200 bg-blue-50/30 mb-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-zinc-900 tracking-tight">Tambah Penjual Baru</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-400 hover:text-zinc-900">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddSeller} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Nama Toko/Penjual</label>
                    <input 
                      required 
                      value={newSeller.name}
                      onChange={(e) => setNewSeller({...newSeller, name: e.target.value})}
                      placeholder="Contoh: Kantin Sehat"
                      className="input-clay"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">NIK Login</label>
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
                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Password</label>
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

      <div className="glass-card overflow-hidden border-zinc-200/60 shadow-xl shadow-zinc-200/40">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] bg-zinc-50/50">
                <th className="p-6">Profil Penjual</th>
                <th className="p-6">Total Penjualan</th>
                <th className="p-6">Penjualan Bersih</th>
                <th className="p-6">Saldo Aktif</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredSellers.map((seller) => (
                <motion.tr 
                  layout
                  key={seller.id} 
                  className="hover:bg-zinc-50/50 transition-colors group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl shadow-inner">
                        {seller.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">{seller.name}</p>
                        <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {seller.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="font-bold text-zinc-900">{formatRupiah(seller.total_sales || 0)}</p>
                    <p className="text-[10px] text-zinc-400 font-medium">Akumulasi kotor</p>
                  </td>
                  <td className="p-6">
                    <p className="font-bold text-amber-600">{formatRupiah((seller.total_sales || 0) * 0.92)}</p>
                    <p className="text-[10px] text-zinc-400 font-medium">Setelah biaya 8%</p>
                  </td>
                  <td className="p-6">
                    <p className="font-black text-blue-600">{formatRupiah(seller.balance || 0)}</p>
                    <p className="text-[10px] text-zinc-400 font-medium">Siap ditarik</p>
                  </td>
                  <td className="p-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      seller.is_active ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {seller.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleToggleActive(seller.id, seller.is_active)}
                        className={`p-3 rounded-xl transition-all ${
                          seller.is_active 
                            ? "text-red-500 hover:bg-red-50" 
                            : "text-blue-500 hover:bg-blue-50"
                        }`}
                        title={seller.is_active ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {seller.is_active ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteSeller(seller.id)}
                        className="p-3 text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
        <div className="md:hidden divide-y divide-zinc-100">
          {filteredSellers.map((seller) => (
            <div key={seller.id} className="p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-lg">
                  {seller.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-900 text-sm truncate">{seller.name}</p>
                  <p className="text-[9px] text-zinc-400 font-medium">{seller.id.slice(0, 8)}...</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  seller.is_active ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                }`}>
                  {seller.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                <div>
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Saldo</p>
                  <p className="font-bold text-blue-600 text-xs">{formatRupiah(seller.balance || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Penjualan</p>
                  <p className="font-bold text-zinc-900 text-xs">{formatRupiah(seller.total_sales || 0)}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button 
                  onClick={() => handleToggleActive(seller.id, seller.is_active)}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-all ${
                    seller.is_active 
                      ? "bg-red-50 text-red-600 border border-red-100" 
                      : "bg-blue-50 text-blue-600 border border-blue-100"
                  }`}
                >
                  {seller.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button 
                  onClick={() => handleDeleteSeller(seller.id)}
                  className="px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredSellers.length === 0 && (
          <div className="p-20 text-center">
            <div className="flex flex-col items-center gap-4 text-zinc-300">
              <Users className="w-16 h-16 stroke-[1]" />
              <p className="font-bold text-zinc-400">Tidak ada penjual ditemukan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
