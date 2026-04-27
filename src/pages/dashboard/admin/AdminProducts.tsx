import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { formatRupiah } from '../../../lib/utils';
import { useAuthStore } from '../../../store/useAuthStore';
import Papa from 'papaparse';
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
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  Database
} from 'lucide-react';
import { Skeleton, TableRowSkeleton, ProductSkeleton } from '../../../components/ui/Skeleton';

export default function AdminProducts() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [importingCSV, setImportingCSV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            seller_id: user.id, // Admin acts as seller for these products
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

  const handleSeedSariroti = async () => {
    setLoading(true);
    try {
      const sarirotiProducts = [
        { name: 'ROTI TAWAR SPECIAL II', price: 16500 },
        { name: 'ROTI JUMBO TAWAR SPECIAL II', price: 19000 },
        { name: 'ROTI TAWAR DOUBLE SOFT II', price: 22500 },
        { name: 'SANDWICH COKLAT II', price: 7000 },
        { name: 'SANDWICH KRIM KEJU II', price: 6500 },
        { name: 'ROTI SOBEK COKLAT COKLAT II', price: 21000 },
        { name: 'ROTI SOBEK COKLAT KEJU II', price: 21000 },
        { name: 'ROTI SOBEK COKLAT SARIKAYA II', price: 20000 },
        { name: 'ROTI TAWAR KUPAS', price: 20500 },
        { name: 'Dorayaki Isi Coklat', price: 7000 },
        { name: 'ROTI TAWAR GANDUM II', price: 22500 },
        { name: 'Bamkuchen Original', price: 12500 },
        { name: 'Bamkuchen Coklat', price: 12500 },
        { name: 'Cheese Cake Original', price: 9500 },
        { name: 'Cheese Cake Coffee Mocca', price: 9500 },
        { name: 'ROTI KASUR KEJU', price: 17000 },
        { name: 'ROTI SISIR MENTEGA II', price: 13500 },
        { name: 'ROTI KASUR SUSU', price: 14000 },
        { name: 'ROTI KLASIK KASUR KRIM MESSES', price: 13500 },
        { name: 'Roti Duo Sobek Coklat Coklat', price: 12000 },
        { name: 'Roti Duo Sobek Coklat Keju', price: 12500 },
        { name: 'Roti Duo Sobek Coklat Sarikaya', price: 12500 },
        { name: 'Steam Cheese Cake Original', price: 11000 },
        { name: 'Lapis Surabaya Premium Original', price: 14500 },
        { name: 'Sobek Duo Strawberry', price: 12500 },
        { name: 'Sobek Duo Blueberry', price: 12500 },
        { name: 'ROTI SOBEK COKLAT STRAWBERRY II 5S', price: 20000 },
        { name: 'ROTI SOBEK COKLAT BLUEBERRY II 5S', price: 20000 },
        { name: 'Kasur Duo Krim Meses', price: 10500 },
        { name: 'Dorayaki Chesse Hokkaido', price: 7500 },
        { name: 'Steam Cheese Cake Cokelat', price: 11000 },
        { name: 'Dorayaki Honey Flavour', price: 7000 },
        { name: 'Sandwich Margarin Gula', price: 6500 },
        { name: 'Sandwich Krim Peanut', price: 6500 },
        { name: 'Dorayaki Choco Peanut', price: 7500 },
        { name: 'Roti Jumbo Milky Soft', price: 21500 },
        { name: 'Soft Cake Putu Pandan', price: 11500 },
        { name: 'Choco Bun', price: 5500 },
        { name: 'Choco Cheese Bun', price: 6500 },
        { name: 'Zupper Sandwich Krim Cokelat', price: 5500 },
        { name: 'Zupper Sandwich Creamy Sweet', price: 5500 },
        { name: 'Zupper Sandwich Cream Strawberry', price: 5500 },
        { name: 'Sandwich Sarikaya Medan', price: 6500 },
        { name: 'Dorayaki Strawberry', price: 7000 },
        { name: 'Roti Jumbo Tawar Kupas', price: 22000 },
        { name: 'Steam Cheese Cake', price: 11500 },
        { name: 'Steam Cheese Cake Cokelat', price: 11500 },
        { name: 'Sandroll Zupper Creamy Cheese', price: 7000 },
        { name: 'Sandroll Zupper Creamy Choco', price: 7000 },
        { name: 'Sandroll Zupper Creamy Mocha', price: 7000 },
        { name: 'Roti Milky Soft', price: 18000 },
        { name: 'Steam Cheese Cake Strawberry', price: 11500 },
        { name: 'Dorayaki Martabak', price: 7000 },
        { name: 'Steam Cheese Cake Red Velvet', price: 11500 },
        { name: 'Soft Cake Pisang Ijo', price: 11500 },
        { name: 'Sandwich Choco Blast', price: 7000 },
        { name: 'Zupper Creamy Choco Double Choco', price: 7000 },
        { name: 'Zupper Creamy Choco Banana', price: 7000 },
        { name: 'Dorayaki Pandan Sarikaya', price: 7000 },
        { name: 'Zupper Creamy Choco Berry', price: 7000 },
        { name: 'Steam Cheese Cake Duo Cheese', price: 10000 },
        { name: 'Waffle Original', price: 6500 }
      ];

      // Ensure category exists
      const { error: catError } = await supabase.from('categories').insert({ name: 'Sariroti', slug: 'sariroti' });
      if (catError) {
        // If it fails because slug doesn't exist, try without slug
        if (catError.code === '42703') {
          try {
            await supabase.from('categories').insert({ name: 'Sariroti' });
          } catch (e) {}
        } else if (catError.code !== '23505') { // Ignore unique violation (already exists)
          console.warn('Category insert warning:', catError);
        }
      }

      // Fetch existing products to prevent duplicates
      const { data: existingProducts } = await supabase
        .from('products')
        .select('name');
        
      const existingNames = new Set((existingProducts || []).map(p => p.name.toLowerCase().trim()));

      // Find Sariroti Seller Profile
      const { data: sarirotiSeller } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'seller')
        .ilike('name', '%sariroti%')
        .single();

      if (!sarirotiSeller) {
        toast.error('Akun Seller Sariroti belum ditemukan. Silakan buat akun dengan nama mengandung "Sariroti" terlebih dahulu.');
        setLoading(false);
        return;
      }

      const productsToInsert = sarirotiProducts
        .filter(p => !existingNames.has(p.name.toLowerCase().trim()))
        .map(p => {
          const discountedPrice = p.price * 0.75; // 25% discount
          return {
            seller_id: sarirotiSeller.id,
            name: p.name,
            description: `Produk Sariroti - ${p.name}`,
            price: discountedPrice,
            stock: 50,
            category: 'Sariroti',
            image_url: `https://tse2.mm.bing.net/th?q=${encodeURIComponent(p.name + ' sariroti')}&w=250&h=250&c=7&rs=1`,
            is_active: true
          };
        });

      if (productsToInsert.length === 0) {
        toast.success('Semua produk Sariroti sudah ada di database.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('products').insert(productsToInsert);
      if (error) throw error;

      toast.success(`Berhasil menambahkan ${productsToInsert.length} produk Sariroti!`);
      fetchProducts();
    } catch (error: any) {
      console.error('Error seeding products:', error);
      toast.error(`Gagal menambahkan produk: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

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

  const cleanupDuplicates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock');
        
      if (error) throw error;
      if (!data) return;

      const uniqueProductsMap = new Map<string, any>();
      const idsToDelete: string[] = [];

      data.forEach(p => {
        const normalizedName = p.name.trim().toLowerCase();
        if (!uniqueProductsMap.has(normalizedName)) {
          uniqueProductsMap.set(normalizedName, p);
        } else {
          const existing = uniqueProductsMap.get(normalizedName);
          // Keep the one with more stock, delete the other
          if (existing.stock < p.stock) {
            idsToDelete.push(existing.id);
            uniqueProductsMap.set(normalizedName, p);
          } else {
            idsToDelete.push(p.id);
          }
        }
      });

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('products')
          .delete()
          .in('id', idsToDelete);
          
        if (deleteError) throw deleteError;
        toast.success(`Berhasil menghapus ${idsToDelete.length} produk duplikat!`);
        fetchProducts();
      } else {
        toast.success('Tidak ada produk duplikat ditemukan.');
      }
    } catch (error: any) {
      console.error('Error cleaning up duplicates:', error);
      toast.error(`Gagal membersihkan duplikat: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editingProduct.name || !editingProduct.price || editingProduct.stock === '' || editingProduct.stock === undefined || !editingProduct.category) {
      toast.error('Mohon lengkapi semua field yang diperlukan (Nama, Harga, Stok, Kategori)');
      return;
    }

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

      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Ukuran file terlalu besar. Maksimal 2MB.');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${editingProduct.seller_id}/${fileName}`;

      setUploadingImage(true);
      setImageError(null);

      // Check if supabase is reachable
      try {
        const { error: pingError } = await supabase.from('products').select('id').limit(1);
        if (pingError && pingError.message.includes('fetch')) {
          throw new Error('Koneksi ke server gagal. Periksa koneksi internet Anda atau hubungi admin.');
        }
      } catch (e) {
        console.warn('Ping check failed:', e);
      }

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        if (uploadError.message.includes('fetch') || uploadError.message.includes('NetworkError')) {
          throw new Error('Gagal mengunggah karena masalah jaringan atau bucket storage belum siap. Pastikan bucket "products" sudah dibuat di Supabase.');
        }
        throw uploadError;
      }

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
    try {
      const { data, error } = await supabase.from('products').delete().eq('id', id).select('id');
      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error('Produk tidak ditemukan atau Anda tidak memiliki akses untuk menghapusnya. Pastikan RLS policy sudah diperbarui.');
      }
      
      fetchProducts();
      toast.success('Produk berhasil dihapus');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(`Gagal menghapus produk: ${error.message}`);
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
            Katalog Produk
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Total {products.length} produk dari semua penjual
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
            onClick={cleanupDuplicates} 
            disabled={loading}
            className="btn-clay-secondary h-12 px-6 flex items-center gap-3 text-red-600 hover:text-red-700"
            title="Hapus Produk Duplikat"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            <span className="hidden sm:inline font-bold">Bersihkan Duplikat</span>
          </button>
          <button 
            onClick={handleSeedSariroti} 
            disabled={loading}
            className="btn-clay-secondary h-12 px-6 flex items-center gap-3"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
            <span className="hidden sm:inline">Seed Data Sariroti</span>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={importingCSV}
            className="btn-clay-secondary h-12 px-6 flex items-center gap-3"
          >
            {importingCSV ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
            <span className="hidden sm:inline">Import CSV Sariroti</span>
          </button>
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
            className="fixed inset-0 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Edit Produk (Admin)</h2>
                  <button onClick={() => setEditingProduct(null)} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
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
                          <div className="flex bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none transition-all focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500/50 hover:bg-white dark:hover:bg-zinc-800 h-12">
                            <button 
                              type="button" 
                              onClick={() => setEditingProduct({...editingProduct, stock: Math.max(0, Number(editingProduct.stock) - 1)})}
                              className="px-4 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            >
                              -
                            </button>
                            <input 
                              required 
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={editingProduct.stock}
                              onChange={(e) => setEditingProduct({...editingProduct, stock: e.target.value.replace(/[^0-9]/g, '')})}
                              className="w-full text-center bg-transparent border-x border-zinc-200 dark:border-zinc-700 outline-none focus:ring-0 font-bold text-zinc-900 dark:text-white"
                            />
                            <button 
                              type="button" 
                              onClick={() => setEditingProduct({...editingProduct, stock: Number(editingProduct.stock) + 1})}
                              className="px-4 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            >
                              +
                            </button>
                          </div>
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
                      <label className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Gambar Produk</label>
                      <div className={`relative aspect-square rounded-[2.5rem] border-4 border-dashed ${imageError ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50'} flex flex-col items-center justify-center overflow-hidden group shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05)] dark:shadow-none`}>
                        {editingProduct.image_url ? (
                          <>
                            <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-zinc-900/40 dark:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label htmlFor="admin-edit-product-image" className="btn-clay-secondary h-12 px-6 cursor-pointer flex items-center gap-2">
                                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {uploadingImage ? 'Mengunggah...' : 'Ganti Gambar'}
                                <input id="admin-edit-product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                              </label>
                            </div>
                          </>
                        ) : (
                          <label htmlFor="admin-edit-product-image-empty" className="cursor-pointer flex flex-col items-center gap-4 p-6 md:p-10 text-center w-full h-full justify-center">
                            <div className={`w-16 h-16 rounded-2xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center transition-colors ${imageError ? 'text-red-400 dark:text-red-500 group-hover:text-red-600 dark:group-hover:text-red-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                              {uploadingImage ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                            </div>
                            <div className="space-y-1">
                              <p className={`font-semibold ${imageError ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                {uploadingImage ? 'Mengunggah...' : 'Klik untuk unggah gambar'}
                              </p>
                              <p className="text-xs text-zinc-400 dark:text-zinc-500">JPG, PNG, WEBP (Maks. 5MB)</p>
                            </div>
                            <input id="admin-edit-product-image-empty" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                          </label>
                        )}
                      </div>
                      {imageError && (
                        <div className="flex items-start gap-2 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800/30">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p className="text-sm font-medium">{imageError}</p>
                        </div>
                      )}
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
                <th className="p-6">Seller Name</th>
                <th className="p-6">Kategori</th>
                <th className="p-6">Harga</th>
                <th className="p-6">Stok</th>
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
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                            <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{product.name}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1">
                          ID: {product.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300 font-bold text-sm">
                      <Store className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      {product.profiles?.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="clay-badge bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 w-fit">
                      <Tag className="w-3 h-3" />
                      {product.category}
                    </span>
                  </td>
                  <td className="p-6">
                    <p className="font-black text-zinc-900 dark:text-white">{formatRupiah(product.price)}</p>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] dark:shadow-none">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((product.stock / 50) * 100, 100)}%` }}
                          className={`h-full ${product.stock > 5 ? 'bg-blue-600 dark:bg-blue-500' : 'bg-red-500 dark:bg-red-500'}`}
                        />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        product.stock > 5 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {product.stock} Tersisa
                      </span>
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
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
                      Seller: {product.profiles?.name || 'Unknown'}
                    </span>
                    <span className={`clay-badge ${
                      product.stock > 5 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
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
                  className="w-12 h-12 clay-icon bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
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
