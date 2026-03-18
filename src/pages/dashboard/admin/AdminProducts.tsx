import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../lib/supabase';
import { formatRupiah } from '../../../lib/utils';
import { 
  Package, 
  Trash2, 
  Edit,
  X,
  Upload,
  Image as ImageIcon, 
  Search, 
  Filter, 
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Store,
  Tag,
  Loader2
} from 'lucide-react';
import { Skeleton, TableRowSkeleton, ProductSkeleton } from '../../../components/ui/Skeleton';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

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
        .select('*, profiles(name)')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
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
      alert(`Gagal memperbarui produk: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setImageError(null);
      if (!e.target.files || e.target.files.length === 0 || !editingProduct) return;
      
      const file = e.target.files[0];
      
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setImageError('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.');
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setImageError('Ukuran file terlalu besar. Maksimal 5MB.');
        return;
      }

      // Create local preview immediately
      const objectUrl = URL.createObjectURL(file);
      setEditingProduct((prev: any) => ({ ...prev, image_url: objectUrl }));

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${editingProduct.seller_id}/${fileName}`;

      setUploadingImage(true);

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setEditingProduct((prev: any) => ({ ...prev, image_url: publicUrl }));
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setImageError(`Gagal mengunggah gambar: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;
    
    try {
      const { data, error } = await supabase.from('products').delete().eq('id', id).select('id');
      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error('Produk tidak ditemukan atau Anda tidak memiliki akses untuk menghapusnya. Pastikan RLS policy sudah diperbarui.');
      }
      
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert(`Gagal menghapus produk: ${error.message}`);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.profiles?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && products.length === 0) {
    return (
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <Skeleton className="h-12 w-full md:w-96 rounded-2xl" />
          <Skeleton className="h-12 w-40 rounded-2xl" />
        </div>

        <div className="clay-card overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
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
          <div className="md:hidden divide-y divide-zinc-100">
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
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight mb-2">
            Katalog Produk
          </h1>
          <p className="text-zinc-500 font-medium flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            Total {products.length} produk dari semua penjual
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari produk atau penjual..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-clay pl-12 h-12"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="btn-clay-secondary h-12 px-6 flex-1 md:flex-none flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter Kategori
          </button>
        </div>
      </div>

      <AnimatePresence>
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
              className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Edit Produk (Admin)</h2>
                  <button onClick={() => setEditingProduct(null)} className="p-2 text-zinc-400 hover:text-zinc-900">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <form onSubmit={handleUpdateProduct} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Nama Produk</label>
                        <input 
                          required 
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                          className="input-clay"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Kategori</label>
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
                          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Stok</label>
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
                        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Harga (Rp)</label>
                        <input 
                          required 
                          type="number"
                          value={editingProduct.price}
                          onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})}
                          className="input-clay"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Deskripsi</label>
                        <textarea 
                          value={editingProduct.description || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                          className="input-clay min-h-[100px] py-4"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Gambar Produk</label>
                      <div className={`relative aspect-square rounded-[2.5rem] border-4 border-dashed ${imageError ? 'border-red-300 bg-red-50' : 'border-zinc-100 bg-zinc-50'} flex flex-col items-center justify-center overflow-hidden group shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05)]`}>
                        {editingProduct.image_url ? (
                          <>
                            <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label htmlFor="admin-edit-product-image" className="btn-clay-secondary h-12 px-6 cursor-pointer flex items-center gap-2">
                                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {uploadingImage ? 'Mengunggah...' : 'Ganti Gambar'}
                                <input id="admin-edit-product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                              </label>
                            </div>
                          </>
                        ) : (
                          <label htmlFor="admin-edit-product-image-empty" className="cursor-pointer flex flex-col items-center gap-4 p-6 md:p-10 text-center w-full h-full justify-center">
                            <div className={`w-16 h-16 rounded-2xl bg-white clay-icon flex items-center justify-center transition-colors ${imageError ? 'text-red-400 group-hover:text-red-600' : 'text-zinc-400 group-hover:text-blue-600'}`}>
                              {uploadingImage ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                            </div>
                            <div className="space-y-1">
                              <p className={`font-semibold ${imageError ? 'text-red-600' : 'text-zinc-600'}`}>
                                {uploadingImage ? 'Mengunggah...' : 'Klik untuk unggah gambar'}
                              </p>
                              <p className="text-xs text-zinc-400">JPG, PNG, WEBP (Maks. 5MB)</p>
                            </div>
                            <input id="admin-edit-product-image-empty" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                          </label>
                        )}
                      </div>
                      {imageError && (
                        <div className="flex items-start gap-2 text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p className="text-sm font-medium">{imageError}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-zinc-100">
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

      <div className="clay-card overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] bg-zinc-50/50">
                <th className="p-6">Produk</th>
                <th className="p-6">Penjual</th>
                <th className="p-6">Kategori</th>
                <th className="p-6">Harga</th>
                <th className="p-6">Stok</th>
                <th className="p-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.map((product) => (
                <motion.tr 
                  layout
                  key={product.id} 
                  className="hover:bg-zinc-50/50 transition-colors group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white clay-icon flex-shrink-0">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300">
                            <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">{product.name}</p>
                        <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                          ID: {product.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2 text-zinc-600 font-bold text-sm">
                      <Store className="w-4 h-4 text-blue-500" />
                      {product.profiles?.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="clay-badge bg-zinc-100 text-zinc-600 flex items-center gap-1.5 w-fit">
                      <Tag className="w-3 h-3" />
                      {product.category}
                    </span>
                  </td>
                  <td className="p-6">
                    <p className="font-black text-zinc-900">{formatRupiah(product.price)}</p>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((product.stock / 50) * 100, 100)}%` }}
                          className={`h-full ${product.stock > 5 ? 'bg-blue-600' : 'bg-red-500'}`}
                        />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        product.stock > 5 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {product.stock} Tersisa
                      </span>
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setEditingProduct(product)}
                        className="w-10 h-10 clay-icon bg-white text-zinc-400 hover:text-blue-600 transition-all"
                        title="Edit Produk"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="w-10 h-10 clay-icon bg-white text-zinc-400 hover:text-red-600 transition-all"
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
        <div className="md:hidden divide-y divide-zinc-100">
          {filteredProducts.map((product) => (
            <div key={product.id} className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white clay-icon flex-shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-zinc-900 text-base leading-tight mb-1">{product.name}</p>
                  <p className="text-blue-600 font-black text-lg mb-2">{formatRupiah(product.price)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="clay-badge bg-zinc-100 text-zinc-500">
                      {product.profiles?.name}
                    </span>
                    <span className={`clay-badge ${
                      product.stock > 5 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                    }`}>
                      Stok: {product.stock}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setEditingProduct(product)}
                  className="flex-1 btn-clay-secondary py-3 text-xs"
                >
                  Edit Produk
                </button>
                <button 
                  onClick={() => handleDeleteProduct(product.id)}
                  className="w-12 h-12 clay-icon bg-red-50 text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-20 text-center">
            <div className="flex flex-col items-center gap-4 text-zinc-300">
              <Package className="w-16 h-16 stroke-[1]" />
              <p className="font-bold text-zinc-400">Tidak ada produk ditemukan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
