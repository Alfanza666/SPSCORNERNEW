import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Tag, Plus, Users, CheckCircle, Loader2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminFlashsale() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newAsset, setNewAsset] = useState({ title: '', description: '', estimated_price: 0, image_url: '' });

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const { data } = await supabase
        .from('sps_assets')
        .select('*, asset_bookings(*, profiles(name, nik))')
        .order('created_at', { ascending: false });
      if (data) setAssets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('sps_assets').insert([newAsset]);
      if (error) throw error;
      toast.success('Aset berhasil ditambahkan!');
      setIsAdding(false);
      fetchAssets();
    } catch (error) {
      toast.error('Gagal menambah aset');
    }
  };

  const handleSetWinner = async (assetId: string, bookingId: string, userId: string) => {
    const finalPrice = prompt("Masukkan Harga Deal / Final (Angka saja):");
    if (!finalPrice) return;

    try {
      // 1. Update Asset Status & Winner
      await supabase.from('sps_assets').update({ 
        status: 'sold', 
        winner_id: userId,
        final_price: parseInt(finalPrice)
      }).eq('id', assetId);

      // 2. Update Booking Status (Yang menang)
      await supabase.from('asset_bookings').update({ status: 'won' }).eq('id', bookingId);
      
      // 3. Update Booking Status (Yang kalah)
      await supabase.from('asset_bookings').update({ status: 'lost' })
        .eq('asset_id', assetId)
        .neq('id', bookingId);

      toast.success('Pemenang berhasil ditetapkan!');
      fetchAssets();
    } catch (error) {
      toast.error('Gagal menetapkan pemenang');
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Kelola Flashsale</h1>
          <p className="text-sm text-zinc-500">Lelang Aset Perusahaan (Siapa Cepat Dia Dapat)</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"
        >
          <Plus className="w-5 h-5"/> Tambah Aset
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddAsset} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-6 space-y-4">
          <input type="text" placeholder="Nama Aset (Misal: Laptop Lenovo T480)" required
            onChange={e => setNewAsset({...newAsset, title: e.target.value})}
            className="w-full p-3 rounded-xl border dark:bg-zinc-950 dark:border-zinc-800" />
          <textarea placeholder="Deskripsi Singkat & Kondisi" required
            onChange={e => setNewAsset({...newAsset, description: e.target.value})}
            className="w-full p-3 rounded-xl border dark:bg-zinc-950 dark:border-zinc-800" />
          <div className="flex gap-4">
            <input type="number" placeholder="Estimasi Harga (Rp)" required
              onChange={e => setNewAsset({...newAsset, estimated_price: parseInt(e.target.value)})}
              className="w-1/2 p-3 rounded-xl border dark:bg-zinc-950 dark:border-zinc-800" />
            <input type="url" placeholder="URL Gambar / Link Foto"
              onChange={e => setNewAsset({...newAsset, image_url: e.target.value})}
              className="w-1/2 p-3 rounded-xl border dark:bg-zinc-950 dark:border-zinc-800" />
          </div>
          <button type="submit" className="w-full py-3 bg-green-600 text-white font-bold rounded-xl">Simpan Aset</button>
        </form>
      )}

      {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600"/> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map(asset => (
            <div key={asset.id} className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
               {asset.image_url && <img src={asset.image_url} alt={asset.title} className="w-full h-40 object-cover"/>}
               <div className="p-4">
                 <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-lg">{asset.title}</h3>
                   <span className={`px-2 py-1 text-[10px] font-bold rounded-lg uppercase ${asset.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {asset.status}
                   </span>
                 </div>
                 <p className="text-sm font-black text-red-600 mb-4">Est. Rp {asset.estimated_price.toLocaleString('id-ID')}</p>
                 
                 <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                   <h4 className="text-xs font-bold text-zinc-500 mb-2 flex items-center gap-2"><Users className="w-4 h-4"/> Daftar Booking ({asset.asset_bookings?.length || 0})</h4>
                   <div className="max-h-40 overflow-y-auto space-y-2">
                     {asset.asset_bookings?.sort((a:any, b:any) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()).map((booking: any, idx: number) => (
                       <div key={booking.id} className={`flex justify-between items-center p-2 rounded-lg text-xs border ${booking.status === 'won' ? 'bg-green-100 border-green-200 dark:bg-green-900/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'}`}>
                         <div>
                           <p className="font-bold">{idx + 1}. {booking.profiles?.name}</p>
                           <p className="text-[10px] text-zinc-500">{new Date(booking.booking_time).toLocaleTimeString()}</p>
                         </div>
                         {asset.status === 'open' && (
                           <button onClick={() => handleSetWinner(asset.id, booking.id, booking.user_id)} className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold">
                             Jadikan Pemenang
                           </button>
                         )}
                         {booking.status === 'won' && <CheckCircle className="w-4 h-4 text-green-600"/>}
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
