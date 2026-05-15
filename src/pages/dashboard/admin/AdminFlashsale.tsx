import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Tag, Plus, Users, CheckCircle, Loader2, DollarSign, Upload, Image as ImageIcon, X, Trash2, Edit, Calendar, FileText, Download, Copy, FileSpreadsheet, Link as LinkIcon, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function AdminFlashsale() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [bulkData, setBulkData] = useState('');
  const [imageMode, setImageMode] = useState<'upload' | 'link'>('upload');
  
  const [bulkSettings, setBulkSettings] = useState({
    estimated_price: 1000000,
    start_time: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
  });

  const initialAssetState = { 
    title: '', 
    specifications: '',
    kelengkapan: '',
    serial_number: '',
    estimated_price: 0, 
    image_url: '', 
    status: 'open',
    start_time: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
  };

  const [newAsset, setNewAsset] = useState(initialAssetState);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('sps_assets')
        .select('*, asset_bookings(*, profiles(name, nik))')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) {
        // Parse description back to fields if it looks like JSON
        const processed = data.map(item => {
          try {
            const parsed = JSON.parse(item.description);
            return { ...item, ...parsed };
          } catch {
            return item;
          }
        });
        setAssets(processed);
      }
    } catch (error: any) {
      console.error('Error fetching assets:', error);
      toast.error('Gagal mengambil data aset');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar (maksimal 5MB)');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `flashsale/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('flashsale')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('flashsale')
        .getPublicUrl(filePath);

      if (isEdit && editingAsset) {
        setEditingAsset({ ...editingAsset, image_url: publicUrl });
      } else {
        setNewAsset(prev => ({ ...prev, image_url: publicUrl }));
      }
      toast.success('Gambar berhasil diunggah!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Gagal mengunggah gambar: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.image_url) {
      toast.error('Mohon tentukan gambar aset (Upload atau Link)');
      return;
    }

    try {
      setLoading(true);
      // Store fields in description as JSON for flexibility
      const descriptionData = JSON.stringify({
        specifications: newAsset.specifications,
        kelengkapan: newAsset.kelengkapan,
        serial_number: newAsset.serial_number
      });

      const { error } = await supabase.from('sps_assets').insert([{
        title: newAsset.title,
        description: descriptionData,
        estimated_price: newAsset.estimated_price,
        image_url: newAsset.image_url,
        status: newAsset.status,
        start_time: new Date(newAsset.start_time).toISOString()
      }]);
      
      if (error) throw error;
      
      toast.success('Aset berhasil ditambahkan!');
      setIsAdding(false);
      setNewAsset(initialAssetState);
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal menambah aset: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const processRowToAsset = (cols: string[]) => {
    const itemName = cols[0]?.trim() || 'Aset Tanpa Nama';
    const assetCode = cols[2]?.trim() || '';
    const serialNo = cols[5]?.trim() || '';
    const spek = cols[8]?.trim() || '';
    const kelengkapan = cols[9]?.trim() || '';

    let imageUrl = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80';
    if (itemName.toLowerCase().includes('dell')) {
      imageUrl = 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80';
    } else if (itemName.toLowerCase().includes('lenovo')) {
      imageUrl = 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80';
    }

    const descriptionData = JSON.stringify({
      specifications: spek,
      kelengkapan: kelengkapan,
      serial_number: serialNo || assetCode
    });

    return {
      title: itemName,
      description: descriptionData,
      estimated_price: bulkSettings.estimated_price,
      start_time: new Date(bulkSettings.start_time).toISOString(),
      image_url: imageUrl,
      status: 'open'
    };
  };

  const handleBulkImport = async () => {
    if (!bulkData.trim()) {
      toast.error('Data bulk kosong');
      return;
    }

    setLoading(true);
    try {
      const rows = bulkData.split('\n').filter(row => row.trim());
      const startIdx = (rows[0].toLowerCase().includes('itemname') || rows[0].toLowerCase().includes('assetcode')) ? 1 : 0;
      
      const newAssets = rows.slice(startIdx).map(row => {
        const cols = row.split('\t');
        return processRowToAsset(cols);
      });

      const { error } = await supabase.from('sps_assets').insert(newAssets);
      if (error) throw error;

      toast.success(`${newAssets.length} aset berhasil diimpor!`);
      setIsBulkAdding(false);
      setBulkData('');
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal impor bulk: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length <= 1) {
        toast.error('File kosong atau hanya berisi header');
        return;
      }

      const startIdx = (String(jsonData[0][0]).toLowerCase().includes('itemname')) ? 1 : 0;
      const newAssets = jsonData.slice(startIdx).map(row => {
        return processRowToAsset(row.map(cell => String(cell || '')));
      });

      const { error } = await supabase.from('sps_assets').insert(newAssets);
      if (error) throw error;

      toast.success(`${newAssets.length} aset berhasil diimpor dari file!`);
      setIsBulkAdding(false);
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal impor file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    try {
      setLoading(true);
      const descriptionData = JSON.stringify({
        specifications: editingAsset.specifications,
        kelengkapan: editingAsset.kelengkapan,
        serial_number: editingAsset.serial_number
      });

      const { error } = await supabase
        .from('sps_assets')
        .update({
          title: editingAsset.title,
          description: descriptionData,
          estimated_price: editingAsset.estimated_price,
          image_url: editingAsset.image_url,
          status: editingAsset.status,
          start_time: new Date(editingAsset.start_time).toISOString()
        })
        .eq('id', editingAsset.id);

      if (error) throw error;

      toast.success('Aset berhasil diperbarui!');
      setEditingAsset(null);
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal memperbarui aset: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus aset ini?')) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('sps_assets').delete().eq('id', id);
      if (error) throw error;
      toast.success('Aset berhasil dihapus');
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal menghapus aset: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetWinner = async (assetId: string, bookingId: string, userId: string) => {
    const finalPrice = prompt("Masukkan Harga Deal / Final (Angka saja):");
    if (!finalPrice) return;

    try {
      const { error: assetError } = await supabase.from('sps_assets').update({ 
        status: 'sold', 
        winner_id: userId,
        final_price: parseInt(finalPrice)
      }).eq('id', assetId);

      if (assetError) throw assetError;

      await supabase.from('asset_bookings').update({ status: 'won' }).eq('id', bookingId);
      await supabase.from('asset_bookings').update({ status: 'lost' }).eq('asset_id', assetId).neq('id', bookingId);

      toast.success('Pemenang berhasil ditetapkan!');
      fetchAssets();
    } catch (error: any) {
      toast.error('Gagal menetapkan pemenang');
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Kelola Flashsale</h1>
          <p className="text-sm text-zinc-500 font-medium tracking-wide">Lelang Aset Perusahaan (Siapa Cepat Dia Dapat)</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => setIsBulkAdding(true)} className="flex-1 md:flex-none bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
            <FileSpreadsheet className="w-5 h-5"/> Bulk Import
          </button>
          <button onClick={() => setIsAdding(!isAdding)} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95">
            {isAdding ? <X className="w-5 h-5"/> : <Plus className="w-5 h-5"/>}
            {isAdding ? 'Batal' : 'Tambah Aset'}
          </button>
        </div>
      </div>

      {/* Bulk Import Modal */}
      {isBulkAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 my-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black">Bulk Import Flash Sale</h2>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Impor puluhan data aset sekaligus</p>
              </div>
              <button onClick={() => setIsBulkAdding(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 transition-colors"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div onClick={() => bulkFileRef.current?.click()} className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform"><FileSpreadsheet className="w-8 h-8"/></div>
                  <div className="text-center">
                    <p className="font-black text-zinc-900 dark:text-white">Upload File Excel</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Klik untuk pilih file .xlsx</p>
                  </div>
                  <input type="file" ref={bulkFileRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                </div>

                <div className="space-y-4">
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Est. Harga (Batch Ini)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"/>
                      <input type="number" value={bulkSettings.estimated_price} onChange={e => setBulkSettings({...bulkSettings, estimated_price: parseInt(e.target.value) || 0})}
                        className="w-full p-4 pl-10 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Waktu Mulai (Batch Ini)</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"/>
                      <input type="datetime-local" value={bulkSettings.start_time} onChange={e => setBulkSettings({...bulkSettings, start_time: e.target.value})}
                        className="w-full p-4 pl-10 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-x-0 top-0 flex items-center justify-center -translate-y-1/2">
                   <span className="bg-white dark:bg-zinc-900 px-4 text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em]">ATAU PASTE DATA</span>
                </div>
                <div className="pt-4 space-y-2">
                  <textarea 
                    placeholder="ItemName	New User	AssetCode	HostName	PurchaseDate	SerialNo	Disposal	FADA	Spek	Kelengkapan"
                    value={bulkData}
                    onChange={e => setBulkData(e.target.value)}
                    className="w-full h-48 p-6 rounded-3xl border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 font-mono text-[10px] focus:ring-2 focus:ring-blue-500/20 outline-none resize-none overflow-x-auto whitespace-pre"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsBulkAdding(false)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold transition-all">Batal</button>
                <button onClick={handleBulkImport} disabled={loading} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5"/>}
                  Proses Impor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddAsset} className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 mb-8 space-y-8 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block ml-1">Nama Barang & Serial Number</label>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Nama Barang" required value={newAsset.title} onChange={e => setNewAsset({...newAsset, title: e.target.value})}
                    className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold" />
                  <input type="text" placeholder="Serial Number / SN" required value={newAsset.serial_number} onChange={e => setNewAsset({...newAsset, serial_number: e.target.value})}
                    className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block ml-1">Spesifikasi</label>
                  <textarea placeholder="Contoh: i5 Gen 8, RAM 8GB, SSD 256GB" required rows={2} value={newAsset.specifications} onChange={e => setNewAsset({...newAsset, specifications: e.target.value})}
                    className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-medium" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block ml-1">Kelengkapan</label>
                  <textarea placeholder="Contoh: Charger, Mouse, Tas" required rows={2} value={newAsset.kelengkapan} onChange={e => setNewAsset({...newAsset, kelengkapan: e.target.value})}
                    className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-medium" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block ml-1">Estimasi Harga</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400"/>
                    <input type="number" placeholder="Harga" required value={newAsset.estimated_price || ''} onChange={e => setNewAsset({...newAsset, estimated_price: parseInt(e.target.value) || 0})}
                      className="w-full p-4 pl-12 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-black text-blue-600" />
                  </div>
                  <p className="text-[9px] text-zinc-400 font-bold mt-2 leading-tight italic">
                    * Harga cuma estimasi, harga final tergantung harga beli dan kelayakan/kualitas produk.
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block ml-1">Waktu Mulai Lelang</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none"/>
                    <input type="datetime-local" required value={newAsset.start_time} onChange={e => setNewAsset({...newAsset, start_time: e.target.value})}
                      className="w-full p-4 pl-12 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gambar Produk (Opsional)</label>
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <button type="button" onClick={() => setImageMode('upload')} className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all ${imageMode === 'upload' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600' : 'text-zinc-500'}`}>UPLOAD</button>
                  <button type="button" onClick={() => setImageMode('link')} className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all ${imageMode === 'link' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600' : 'text-zinc-500'}`}>LINK URL</button>
                </div>
              </div>

              {imageMode === 'upload' ? (
                <div onClick={() => fileInputRef.current?.click()} className={`aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${newAsset.image_url ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
                  {newAsset.image_url ? <img src={newAsset.image_url} className="w-full h-full object-cover" /> : (
                    <div className="text-center p-6">
                      {uploading ? <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-2 mx-auto"/> : <Upload className="w-10 h-10 text-zinc-300 mb-2 mx-auto"/>}
                      <p className="text-xs font-bold text-zinc-400 uppercase">Klik untuk Upload</p>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={e => handleImageUpload(e)} accept="image/*" className="hidden" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400"/>
                    <input type="url" placeholder="Masukkan Link Gambar (https://...)" value={newAsset.image_url} onChange={e => setNewAsset({...newAsset, image_url: e.target.value})}
                      className="w-full p-4 pl-12 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-sm" />
                  </div>
                  {newAsset.image_url && (
                    <div className="aspect-video rounded-3xl overflow-hidden border border-zinc-100">
                      <img src={newAsset.image_url} className="w-full h-full object-cover" onError={(e) => {(e.target as any).src = 'https://via.placeholder.com/800x450?text=Link+Gambar+Tidak+Valid'}} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <button type="submit" disabled={loading || uploading} className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black rounded-3xl shadow-2xl active:scale-[0.98] transition-all uppercase tracking-widest text-sm">
            {loading ? 'Menyimpan...' : 'Tayangkan Aset Flash Sale'}
          </button>
        </form>
      )}

      {/* Edit Modal (Condensed but functional) */}
      {editingAsset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300 my-auto">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black">Edit Aset</h2>
               <button onClick={() => setEditingAsset(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 transition-colors"><X className="w-7 h-7"/></button>
             </div>
             <form onSubmit={handleUpdateAsset} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Nama" value={editingAsset.title} onChange={e => setEditingAsset({...editingAsset, title: e.target.value})} className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 font-bold" />
                  <input type="text" placeholder="SN" value={editingAsset.serial_number} onChange={e => setEditingAsset({...editingAsset, serial_number: e.target.value})} className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 font-bold" />
                </div>
                <textarea placeholder="Spek" value={editingAsset.specifications} onChange={e => setEditingAsset({...editingAsset, specifications: e.target.value})} className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 font-medium" rows={2}/>
                <textarea placeholder="Kelengkapan" value={editingAsset.kelengkapan} onChange={e => setEditingAsset({...editingAsset, kelengkapan: e.target.value})} className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 font-medium" rows={2}/>
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" value={editingAsset.estimated_price} onChange={e => setEditingAsset({...editingAsset, estimated_price: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 font-black text-blue-600" />
                  <input type="datetime-local" value={new Date(editingAsset.start_time).toISOString().slice(0, 16)} onChange={e => setEditingAsset({...editingAsset, start_time: e.target.value})} className="w-full p-4 rounded-2xl border dark:bg-zinc-950 dark:border-zinc-800 font-bold" />
                </div>
                <div className="flex gap-4">
                   <button type="button" onClick={() => setEditingAsset(null)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold uppercase tracking-widest text-xs">Batal</button>
                   <button type="submit" disabled={loading} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl uppercase tracking-widest text-xs">Simpan</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {loading && !isAdding && !editingAsset && !isBulkAdding ? <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 my-20"/> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {assets.map(asset => (
            <div key={asset.id} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all group relative">
               <div className="aspect-video relative overflow-hidden">
                 {asset.image_url ? <img src={asset.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"/> : (
                   <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><ImageIcon className="w-10 h-10 text-zinc-300"/></div>
                 )}
                 <div className="absolute top-4 right-4 flex gap-2">
                   <button onClick={() => setEditingAsset(asset)} className="p-2.5 bg-white/90 backdrop-blur rounded-full text-zinc-600 hover:text-blue-600 shadow-lg hover:scale-110 transition-all"><Edit className="w-4 h-4"/></button>
                   <button onClick={() => handleDeleteAsset(asset.id)} className="p-2.5 bg-white/90 backdrop-blur rounded-full text-zinc-600 hover:text-red-600 shadow-lg hover:scale-110 transition-all"><Trash2 className="w-4 h-4"/></button>
                 </div>
                 <div className="absolute bottom-4 left-4"><span className={`px-4 py-2 text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg ${asset.status === 'open' ? 'bg-green-500 text-white' : 'bg-zinc-900 text-white'}`}>{asset.status === 'open' ? 'Tersedia' : 'Terjual'}</span></div>
               </div>

               <div className="p-8">
                 <div className="mb-6">
                   <h3 className="font-black text-2xl text-zinc-900 dark:text-white leading-tight mb-2">{asset.title}</h3>
                   <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-[9px] font-black text-zinc-500 uppercase tracking-widest">SN: {asset.serial_number || 'N/A'}</span>
                      <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md text-[9px] font-black text-blue-600 uppercase tracking-widest">Mulai: {new Date(asset.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Spesifikasi</p>
                       <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 line-clamp-2">{asset.specifications || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Kelengkapan</p>
                       <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 line-clamp-2">{asset.kelengkapan || 'N/A'}</p>
                    </div>
                 </div>

                 <div className="mb-6 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-[1.5rem] border border-blue-100/50 dark:border-blue-800/30">
                    <div className="flex justify-between items-end">
                       <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Estimasi Harga</p>
                          <p className="text-2xl font-black text-blue-600">Rp {asset.estimated_price?.toLocaleString('id-ID')}</p>
                       </div>
                       <div className="group relative cursor-help">
                          <Info className="w-5 h-5 text-blue-300"/>
                          <div className="absolute bottom-full right-0 mb-3 w-48 p-3 bg-zinc-900 text-white text-[9px] font-medium leading-relaxed rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                             Harga cuma estimasi, harga final tergantung harga beli dan kelayakan produk.
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">Peminat / Booking ({asset.asset_bookings?.length || 0})</h4>
                   <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                     {asset.asset_bookings?.sort((a:any, b:any) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()).map((booking: any, idx: number) => (
                       <div key={booking.id} className={`flex justify-between items-center p-3.5 rounded-2xl text-xs border transition-all ${booking.status === 'won' ? 'bg-green-50 border-green-200' : 'bg-white dark:bg-zinc-950 border-zinc-100'}`}>
                         <div className="flex items-center gap-3">
                           <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] ${booking.status === 'won' ? 'bg-green-500 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{idx + 1}</div>
                           <p className="font-bold text-zinc-900 dark:text-white">{booking.profiles?.name}</p>
                         </div>
                         {asset.status === 'open' && <button onClick={() => handleSetWinner(asset.id, booking.id, booking.user_id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] hover:scale-105 active:scale-95 transition-all shadow-md shadow-blue-500/20">Pilih</button>}
                         {booking.status === 'won' && <CheckCircle className="w-5 h-5 text-green-600"/>}
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
