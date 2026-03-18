import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatRupiah } from '../../../lib/utils';
import Papa from 'papaparse';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit, 
  Image as ImageIcon, 
  Power, 
  PowerOff, 
  Search, 
  Filter, 
  X, 
  Upload, 
  Loader2,
  Tag,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Skeleton, TableRowSkeleton, ProductSkeleton } from '../../../components/ui/Skeleton';

export default function SellerProducts() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [importingCSV, setImportingCSV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    category: '',
    image_url: ''
  });

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setImportingCSV(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const productsToInsert = results.data.map((row: any) => ({
            seller_id: user.id,
            name: row.name || row.Nama || row.Produk || '',
            description: row.description || row.Deskripsi || '',
            price: Number(row.price || row.Harga || 0),
            stock: Number(row.stock || row.Stok || 0),
            category: row.category || row.Kategori || 'Sariroti',
            image_url: row.image_url || row.Gambar || '',
            is_active: true
          })).filter((p: any) => p.name && p.price > 0);

          if (productsToInsert.length === 0) {
            toast.error('Tidak ada data valid yang ditemukan di file CSV. Pastikan ada kolom name, price, stock, category.');
            setImportingCSV(false);
            return;
          }

          const { error } = await supabase.from('products').insert(productsToInsert);
          if (error) throw error;

          toast.success(`Berhasil mengimpor ${productsToInsert.length} produk!`);
          fetchProducts();
        } catch (error: any) {
          console.error('Error importing CSV:', error);
          toast.error(`Gagal mengimpor CSV: ${error.message}`);
        } finally {
          setImportingCSV(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        toast.error('Gagal membaca file CSV');
        setImportingCSV(false);
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      setUploadingImage(true);

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      if (isEdit) {
        setEditingProduct((prev: any) => ({ ...prev, image_url: publicUrl }));
      } else {
        setNewProduct(prev => ({ ...prev, image_url: publicUrl }));
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(`Gagal mengunggah gambar: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'seller') {
      fetchProducts();
      fetchCategories();
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('products').insert({
        seller_id: user?.id,
        name: newProduct.name,
        description: newProduct.description,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
        category: newProduct.category,
        image_url: newProduct.image_url,
        is_active: true
      });

      if (error) throw error;
      
      setIsAdding(false);
      setNewProduct({ name: '', description: '', price: '', stock: '', category: '', image_url: '' });
      fetchProducts();
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast.error(`Gagal menambahkan produk: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: editingProduct.name,
          description: editingProduct.description,
          price: Number(editingProduct.price),
          stock: Number(editingProduct.stock),
          category: editingProduct.category,
          image_url: editingProduct.image_url
        })
        .eq('id', editingProduct.id);

      if (error) throw error;
      
      setEditingProduct(null);
      fetchProducts();
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(`Gagal memperbarui produk: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      fetchProducts();
    } catch (error) {
      console.error('Error updating product status:', error);
      toast.error('Gagal mengubah status produk');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      
      // Verify deletion
      const { data: checkData } = await supabase
        .from('products')
        .select('id')
        .eq('id', id)
        .single();
        
      if (checkData) {
        throw new Error('Produk gagal dihapus. Periksa kebijakan RLS di Supabase.');
      }

      fetchProducts();
      toast.success('Produk berhasil dihapus');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error.message || 'Gagal menghapus produk');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && products.length === 0) {
    return (
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-12 w-48 rounded-2xl" />
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <Skeleton className="h-12 w-full md:w-96 rounded-2xl" />
          <Skeleton className="h-12 w-40 rounded-2xl" />
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <th key={i} className="p-6"><Skeleton className="h-4 w-20" /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={6} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">
            Manajemen Produk
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Kelola stok dan harga produk jualan Anda
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef}
            onChange={handleImportCSV}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={importingCSV}
            className="btn-clay-secondary h-12 px-6 flex items-center gap-3"
          >
            {importingCSV ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button 
            onClick={() => setIsAdding(true)} 
            className="btn-clay-primary h-12 px-8 flex items-center gap-3"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Tambah Produk</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari produk Anda..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-clay pl-12 h-12"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="btn-clay-secondary h-12 px-6 flex-1 md:flex-none flex items-center gap-2">
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
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-blue-100 dark:border-blue-900/50 shadow-sm p-8 bg-blue-50/30 dark:bg-blue-900/10 mb-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Tambah Produk Baru</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddProduct} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Nama Produk</label>
                      <input 
                        required 
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                        placeholder="Contoh: Nasi Goreng Spesial"
                        className="input-clay"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Kategori</label>
                        <select 
                          required 
                          value={newProduct.category}
                          onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                          className="input-clay appearance-none"
                        >
                          <option value="">Pilih Kategori</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Stok Awal</label>
                        <input 
                          required 
                          type="number"
                          value={newProduct.stock}
                          onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                          placeholder="20"
                          className="input-clay"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Harga (Rp)</label>
                      <input 
                        required 
                        type="number"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                        placeholder="15000"
                        className="input-clay"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Deskripsi (Opsional)</label>
                      <textarea 
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                        placeholder="Deskripsi singkat produk..."
                        className="input-clay min-h-[100px] py-4"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Gambar Produk</label>
                    <div className="relative aspect-square rounded-[2.5rem] border-4 border-dashed border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center overflow-hidden group shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]">
                      {newProduct.image_url ? (
                        <>
                          <img src={newProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label htmlFor="new-product-image" className="btn-clay-secondary h-12 px-6 cursor-pointer flex items-center gap-2">
                              <Upload className="w-4 h-4" />
                              Ganti Gambar
                              <input id="new-product-image" type="file" accept="image/*" onChange={(e) => handleImageUpload(e, false)} className="hidden" />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label htmlFor="new-product-image-empty" className="cursor-pointer flex flex-col items-center gap-4 p-6 md:p-10 text-center w-full h-full justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {uploadingImage ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white">Klik untuk unggah foto</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">PNG, JPG up to 5MB</p>
                          </div>
                          <input id="new-product-image-empty" type="file" accept="image/*" onChange={(e) => handleImageUpload(e, false)} className="hidden" disabled={uploadingImage} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <button type="button" onClick={() => setIsAdding(false)} className="btn-clay-secondary px-8">Batal</button>
                  <button type="submit" disabled={loading || uploadingImage} className="btn-clay-primary px-10">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Produk'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {editingProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl md:rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-6 md:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Edit Produk</h2>
                  <button onClick={() => setEditingProduct(null)} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <form onSubmit={handleUpdateProduct} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Nama Produk</label>
                        <input 
                          required 
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                          className="input-clay"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Kategori</label>
                          <select 
                            required 
                            value={editingProduct.category}
                            onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                            className="input-clay appearance-none"
                          >
                            <option value="">Pilih Kategori</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Stok</label>
                          <input 
                            required 
                            type="number"
                            value={editingProduct.stock}
                            onChange={(e) => setEditingProduct({...editingProduct, stock: e.target.value})}
                            className="input-clay"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Harga (Rp)</label>
                        <input 
                          required 
                          type="number"
                          value={editingProduct.price}
                          onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})}
                          className="input-clay"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Deskripsi</label>
                        <textarea 
                          value={editingProduct.description || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                          className="input-clay min-h-[100px] py-4"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Gambar Produk</label>
                      <div className="relative aspect-square rounded-[2.5rem] border-4 border-dashed border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center overflow-hidden group shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]">
                        {editingProduct.image_url ? (
                          <>
                            <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label htmlFor="edit-product-image" className="btn-clay-secondary h-12 px-6 cursor-pointer flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Ganti Gambar
                                <input id="edit-product-image" type="file" accept="image/*" onChange={(e) => handleImageUpload(e, true)} className="hidden" />
                              </label>
                            </div>
                          </>
                        ) : (
                          <label htmlFor="edit-product-image-empty" className="cursor-pointer flex flex-col items-center gap-4 p-6 md:p-10 text-center w-full h-full justify-center">
                            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {uploadingImage ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                            </div>
                            <input id="edit-product-image-empty" type="file" accept="image/*" onChange={(e) => handleImageUpload(e, true)} className="hidden" disabled={uploadingImage} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <button type="button" onClick={() => setEditingProduct(null)} className="btn-clay-secondary px-8">Batal</button>
                    <button type="submit" disabled={loading || uploadingImage} className="btn-clay-primary px-10">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] bg-zinc-50/50 dark:bg-zinc-800/50">
                <th className="p-6">Produk</th>
                <th className="p-6">Kategori</th>
                <th className="p-6">Harga</th>
                <th className="p-6">Stok</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredProducts.map((product) => (
                <motion.tr 
                  layout
                  key={product.id} 
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-zinc-800 clay-icon flex-shrink-0">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                            <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{product.name}</p>
                        {product.description && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium line-clamp-1">{product.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="clay-badge bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 w-fit">
                      <Tag className="w-3 h-3" />
                      {product.category}
                    </span>
                  </td>
                  <td className="p-6">
                    <p className="font-black text-zinc-900 dark:text-white">{formatRupiah(product.price)}</p>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((product.stock / 50) * 100, 100)}%` }}
                          className={`h-full ${product.stock > 5 ? 'bg-blue-600' : 'bg-red-500'}`}
                        />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        product.stock > 5 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {product.stock} Tersisa
                      </span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`clay-badge ${
                      product.is_active 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {product.is_active ? 'Tersedia' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleToggleActive(product.id, product.is_active)}
                        className={`w-10 h-10 clay-icon bg-white dark:bg-zinc-800 transition-all ${
                          product.is_active 
                            ? "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white" 
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                        title={product.is_active ? "Tandai Tidak Tersedia" : "Tandai Tersedia"}
                      >
                        {product.is_active ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => setEditingProduct(product)}
                        className="w-10 h-10 clay-icon bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                        title="Edit Produk"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="w-10 h-10 clay-icon bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-all"
                        title="Hapus Produk"
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
          {filteredProducts.map((product) => (
            <div key={product.id} className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white dark:bg-zinc-800 clay-icon flex-shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-zinc-900 dark:text-white text-base leading-tight mb-1">{product.name}</p>
                  <p className="text-blue-600 dark:text-blue-400 font-black text-lg mb-2">{formatRupiah(product.price)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="clay-badge bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {product.category}
                    </span>
                    <span className={`clay-badge ${
                      product.stock > 5 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    }`}>
                      Stok: {product.stock}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-zinc-50 dark:border-zinc-800/50">
                <span className={`clay-badge ${
                  product.is_active 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {product.is_active ? 'Tersedia' : 'Nonaktif'}
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleToggleActive(product.id, product.is_active)}
                    className="w-10 h-10 clay-icon bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                  >
                    {product.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setEditingProduct(product)}
                    className="w-10 h-10 clay-icon bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="w-10 h-10 clay-icon bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-20 text-center">
            <div className="flex flex-col items-center gap-4 text-zinc-300 dark:text-zinc-600">
              <Package className="w-16 h-16 stroke-[1]" />
              <p className="font-bold text-zinc-400 dark:text-zinc-500">Tidak ada produk ditemukan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
