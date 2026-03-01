import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatRupiah } from '../../../lib/utils';
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
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SellerProducts() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    category: '',
    image_url: ''
  });

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
      alert(`Gagal mengunggah gambar: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'seller') {
      fetchProducts();
    }
  }, [user]);

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
      alert(`Gagal menambahkan produk: ${error.message}`);
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

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const action = currentStatus ? 'menonaktifkan' : 'mengaktifkan';
    if (!confirm(`Yakin ingin ${action} ketersediaan produk ini?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', id);
        
      if (error) throw error;
      fetchProducts();
    } catch (error) {
      console.error('Error updating product status:', error);
      alert('Gagal mengubah status produk');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;
    
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Gagal menghapus produk');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight mb-2">
            Manajemen Produk
          </h1>
          <p className="text-zinc-500 font-medium flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-500" />
            Kelola stok dan harga produk jualan Anda
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(true)} 
          className="btn-primary h-14 px-8 flex items-center gap-3 shadow-emerald-600/20"
        >
          <Plus className="w-5 h-5" />
          Tambah Produk
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari produk Anda..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-12 h-14"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary h-14 px-6 flex items-center gap-2">
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
            <div className="glass-card p-8 border-emerald-200 bg-emerald-50/30 mb-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-zinc-900 tracking-tight">Tambah Produk Baru</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-400 hover:text-zinc-900">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddProduct} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Nama Produk</label>
                      <input 
                        required 
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                        placeholder="Contoh: Nasi Goreng Spesial"
                        className="input-field"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Kategori</label>
                        <input 
                          required 
                          value={newProduct.category}
                          onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                          placeholder="Makanan"
                          className="input-field"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Stok Awal</label>
                        <input 
                          required 
                          type="number"
                          value={newProduct.stock}
                          onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                          placeholder="20"
                          className="input-field"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Harga (Rp)</label>
                      <input 
                        required 
                        type="number"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                        placeholder="15000"
                        className="input-field"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Deskripsi (Opsional)</label>
                      <textarea 
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                        placeholder="Deskripsi singkat produk..."
                        className="input-field min-h-[100px] py-4"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Gambar Produk</label>
                    <div className="relative aspect-square rounded-2xl md:rounded-[2.5rem] border-2 border-dashed border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center overflow-hidden group">
                      {newProduct.image_url ? (
                        <>
                          <img src={newProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label htmlFor="new-product-image" className="btn-secondary h-12 px-6 cursor-pointer flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Ganti Gambar
                                <input 
                                  id="new-product-image" 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => handleImageUpload(e, false)} 
                                  className="hidden" 
                                />
                              </label>
                          </div>
                        </>
                      ) : (
                        <label htmlFor="new-product-image-empty" className="cursor-pointer flex flex-col items-center gap-4 p-6 md:p-10 text-center w-full h-full justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors">
                            {uploadingImage ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900">Klik untuk unggah foto</p>
                            <p className="text-xs text-zinc-400 mt-1">PNG, JPG up to 5MB</p>
                          </div>
                          <input 
                            id="new-product-image-empty" 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleImageUpload(e, false)} 
                            className="hidden" 
                            disabled={uploadingImage} 
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-zinc-200/60">
                  <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary px-8">Batal</button>
                  <button type="submit" disabled={loading || uploadingImage} className="btn-primary px-10 shadow-emerald-600/20">
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
              className="bg-white rounded-3xl md:rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-6 md:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Edit Produk</h2>
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
                          className="input-field"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Kategori</label>
                          <input 
                            required 
                            value={editingProduct.category}
                            onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                            className="input-field"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Stok</label>
                          <input 
                            required 
                            type="number"
                            value={editingProduct.stock}
                            onChange={(e) => setEditingProduct({...editingProduct, stock: e.target.value})}
                            className="input-field"
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
                          className="input-field"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Deskripsi</label>
                        <textarea 
                          value={editingProduct.description || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                          className="input-field min-h-[100px] py-4"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Gambar Produk</label>
                      <div className="relative aspect-square rounded-2xl md:rounded-[2.5rem] border-2 border-dashed border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center overflow-hidden group">
                        {editingProduct.image_url ? (
                          <>
                            <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label htmlFor="edit-product-image" className="btn-secondary h-12 px-6 cursor-pointer flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Ganti Gambar
                                <input 
                                  id="edit-product-image" 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => handleImageUpload(e, true)} 
                                  className="hidden" 
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                            <label htmlFor="edit-product-image-empty" className="cursor-pointer flex flex-col items-center gap-4 p-6 md:p-10 text-center w-full h-full justify-center">
                              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors">
                                {uploadingImage ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                              </div>
                              <div>
                                <p className="font-bold text-zinc-900">Klik untuk unggah foto</p>
                                <p className="text-xs text-zinc-400 mt-1">PNG, JPG up to 5MB</p>
                              </div>
                              <input 
                                id="edit-product-image-empty" 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleImageUpload(e, true)} 
                                className="hidden" 
                                disabled={uploadingImage} 
                              />
                            </label>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-6 border-t border-zinc-200/60">
                    <button type="button" onClick={() => setEditingProduct(null)} className="btn-secondary px-8">Batal</button>
                    <button type="submit" disabled={loading || uploadingImage} className="btn-primary px-10 shadow-emerald-600/20">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card overflow-hidden border-zinc-200/60 shadow-xl shadow-zinc-200/40">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] bg-zinc-50/50">
                <th className="p-6">Produk</th>
                <th className="p-6">Kategori</th>
                <th className="p-6">Harga</th>
                <th className="p-6">Stok</th>
                <th className="p-6">Status</th>
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
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200/50 flex-shrink-0 shadow-inner">
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
                        <p className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">{product.name}</p>
                        {product.description && <p className="text-[10px] text-zinc-400 font-medium line-clamp-1">{product.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-wider">
                      <Tag className="w-3 h-3" />
                      {product.category}
                    </span>
                  </td>
                  <td className="p-6">
                    <p className="font-black text-zinc-900">{formatRupiah(product.price)}</p>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((product.stock / 50) * 100, 100)}%` }}
                          className={`h-full ${product.stock > 5 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        product.stock > 5 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {product.stock} Tersisa
                      </span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {product.is_active ? 'Tersedia' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleToggleActive(product.id, product.is_active)}
                        className={`p-3 rounded-xl transition-all ${
                          product.is_active 
                            ? "text-zinc-400 hover:bg-zinc-100" 
                            : "text-emerald-500 hover:bg-emerald-50"
                        }`}
                        title={product.is_active ? "Tandai Tidak Tersedia" : "Tandai Tersedia"}
                      >
                        {product.is_active ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => setEditingProduct(product)}
                        className="p-3 text-zinc-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Edit Produk"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-3 text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/50 flex-shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-900 truncate">{product.name}</p>
                  <p className="text-emerald-600 font-black text-lg">{formatRupiah(product.price)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                      {product.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      product.stock > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      Stok: {product.stock}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {product.is_active ? 'Tersedia' : 'Nonaktif'}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleToggleActive(product.id, product.is_active)}
                    className="p-3 text-zinc-400 hover:text-emerald-500 transition-colors"
                  >
                    {product.is_active ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setEditingProduct(product)}
                    className="p-3 text-zinc-400 hover:text-emerald-500 transition-colors"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-3 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
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
