import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, 
  Wifi, 
  Zap, 
  Gamepad2, 
  CreditCard,
  ArrowLeft,
  Search,
  Loader2,
  ShoppingCart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCartStore } from '../../store/useCartStore';
import toast from 'react-hot-toast';

interface DigitalCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
  apiCategory: string;
}

const categories: DigitalCategory[] = [
  { id: 'pulsa', name: 'Pulsa', icon: Smartphone, description: 'Isi ulang pulsa semua operator', color: 'bg-blue-500', apiCategory: 'Pulsa' },
  { id: 'data', name: 'Paket Data', icon: Wifi, description: 'Kuota internet hemat', color: 'bg-emerald-500', apiCategory: 'Data' },
  { id: 'pln', name: 'Token PLN', icon: Zap, description: 'Listrik prabayar', color: 'bg-amber-500', apiCategory: 'PLN' },
  { id: 'game', name: 'Voucher Game', icon: Gamepad2, description: 'Top up game favorit', color: 'bg-purple-500', apiCategory: 'Games' },
  { id: 'e-money', name: 'E-Money', icon: CreditCard, description: 'Top up saldo dompet digital', color: 'bg-indigo-500', apiCategory: 'E-Money' },
];

export default function DigitalProducts() {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  
  const [selectedCategory, setSelectedCategory] = useState<DigitalCategory | null>(null);
  const [targetNumber, setTargetNumber] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProducts = async (categoryName: string) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/digital/prices', {
        category: categoryName
      });
      if (response.data.success) {
        // Filter out inactive products and sort by price
        const activeProducts = response.data.data
          .filter((p: any) => p.buyer_product_status === true && p.seller_product_status === true)
          .sort((a: any, b: any) => a.price - b.price);
        setProducts(activeProducts);
      } else {
        toast.error('Gagal mengambil data produk');
      }
    } catch (error) {
      console.error('Error fetching digital products:', error);
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (cat: DigitalCategory) => {
    setSelectedCategory(cat);
    setTargetNumber('');
    setSearchQuery('');
    fetchProducts(cat.apiCategory);
  };

  const handleBack = () => {
    if (selectedCategory) {
      setSelectedCategory(null);
      setProducts([]);
    } else {
      navigate('/kiosk');
    }
  };

  const handleBuy = (product: any) => {
    if (!targetNumber) {
      toast.error('Masukkan nomor tujuan terlebih dahulu');
      return;
    }

    // Add markup price (e.g., 2000 IDR)
    const markup = 2000;
    const finalPrice = product.price + markup;

    addItem({
      id: `digital-${product.buyer_sku_code}-${Date.now()}`,
      seller_id: 'DIGIFLAZZ', // System seller
      name: product.product_name,
      price: finalPrice,
      stock: 999,
      image_url: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=400',
      is_digital: true,
      target_number: targetNumber,
      sku: product.buyer_sku_code,
      category: selectedCategory?.name
    });

    toast.success(`${product.product_name} ditambahkan ke keranjang`);
    navigate('/kiosk/cart');
  };

  const filteredProducts = products.filter(p => 
    p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-zinc-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {selectedCategory ? selectedCategory.name : 'Produk Digital'}
              </h1>
              <p className="text-slate-500 dark:text-zinc-500 text-sm">
                {selectedCategory ? 'Pilih produk dan masukkan nomor tujuan' : 'Pilih kategori layanan'}
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!selectedCategory ? (
            <motion.div 
              key="categories"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm text-left relative overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all group"
                >
                  <div className={`${cat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform`}>
                    <cat.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1">{cat.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">{cat.description}</p>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Nomor Tujuan / ID Pelanggan
                </label>
                <input
                  type="text"
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white text-lg tracking-wide"
                />
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nominal atau brand..."
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                />
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                  <p className="text-slate-500 dark:text-zinc-400">Memuat produk...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProducts.map((product) => (
                    <div 
                      key={product.buyer_sku_code}
                      className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-md">
                            {product.brand}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">
                          {product.product_name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                          {product.desc}
                        </p>
                        <div className="mt-2 font-bold text-blue-600 dark:text-blue-400">
                          Rp {(product.price + 2000).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleBuy(product)}
                        disabled={!targetNumber}
                        className="shrink-0 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 text-white rounded-xl transition-colors flex items-center justify-center"
                      >
                        <ShoppingCart className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  
                  {filteredProducts.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 text-slate-500 dark:text-zinc-400">
                      Tidak ada produk yang ditemukan
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
