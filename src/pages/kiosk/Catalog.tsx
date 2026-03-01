import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore, Product } from '../../store/useCartStore';
import { formatRupiah } from '../../lib/utils';
import { Search, Plus, Minus, ShoppingBag, Filter, Tag, Info, ShoppingCart, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const { items, addItem, removeItem, updateQuantity, getTotal } = useCartStore();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = getTotal();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .gt('stock', 0);

      if (error) throw error;

      if (data) {
        setProducts(data);
        const uniqueCategories = Array.from(new Set(data.map((p) => p.category)));
        setCategories(['Semua', ...uniqueCategories]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === 'Semua' || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="w-full md:w-96 h-14 bg-zinc-200 animate-pulse rounded-2xl"></div>
          <div className="flex gap-3 overflow-x-auto w-full md:w-auto pb-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 w-28 bg-zinc-200 animate-pulse rounded-full shrink-0"></div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="glass-card overflow-hidden flex flex-col h-[400px]">
              <div className="aspect-square bg-zinc-200 animate-pulse"></div>
              <div className="p-6 flex flex-col flex-1 gap-4">
                <div className="space-y-2">
                  <div className="h-6 bg-zinc-200 animate-pulse rounded w-3/4"></div>
                  <div className="h-6 bg-zinc-200 animate-pulse rounded w-1/2"></div>
                </div>
                <div className="h-12 bg-zinc-200 animate-pulse rounded-xl mt-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Search and Filter Section */}
      <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
        <div className="relative w-full lg:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
          <input
            placeholder="Cari menu favoritmu..."
            className="input-field pl-12 h-14 text-lg shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto pb-2 w-full lg:w-auto no-scrollbar">
          <div className="flex items-center gap-2 text-zinc-400 mr-2 shrink-0">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Kategori:</span>
          </div>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap border ${
                activeCategory === category 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' 
                  : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300 hover:text-emerald-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-32 glass-card"
        >
          <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-zinc-300" />
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 mb-2">Menu tidak ditemukan</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">Coba cari dengan kata kunci lain atau pilih kategori yang berbeda.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => {
              const cartItem = items.find((item) => item.id === product.id);
              const quantity = cartItem?.quantity || 0;

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="glass-card overflow-hidden flex flex-col group hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300 border-zinc-200/60"
                >
                  <div className="aspect-square bg-zinc-100 relative overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <ShoppingBag className="w-16 h-16 stroke-[1.5]" />
                      </div>
                    )}
                    
                    {/* Floating Badges */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-900 shadow-sm border border-zinc-200/50 flex items-center gap-1.5 uppercase tracking-wider">
                        <Tag className="w-3 h-3 text-emerald-500" />
                        {product.category}
                      </div>
                    </div>

                    <div className="absolute top-4 right-4">
                      <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm border backdrop-blur-md flex items-center gap-1.5 uppercase tracking-wider ${
                        product.stock < 5 
                          ? 'bg-red-50/90 border-red-100 text-red-600' 
                          : 'bg-white/90 border-zinc-200 text-zinc-600'
                      }`}>
                        <Info className="w-3 h-3" />
                        Sisa {product.stock}
                      </div>
                    </div>

                    {/* Quick Add Overlay */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                       {quantity === 0 && (
                         <motion.button
                           whileHover={{ scale: 1.05 }}
                           whileTap={{ scale: 0.95 }}
                           onClick={() => addItem(product)}
                           className="bg-white text-zinc-900 px-6 py-3 rounded-xl font-bold shadow-xl flex items-center gap-2"
                         >
                           <Plus className="w-5 h-5" />
                           Tambah ke Keranjang
                         </motion.button>
                       )}
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1 justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-zinc-900 leading-snug mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-emerald-600 font-extrabold text-2xl">
                          {formatRupiah(product.price)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      {quantity === 0 ? (
                        <button
                          onClick={() => addItem(product)}
                          className="btn-secondary w-full py-3 flex items-center justify-center gap-2 border-zinc-200 hover:border-emerald-500 hover:text-emerald-600"
                        >
                          <Plus className="w-5 h-5" /> Tambah
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-zinc-100 rounded-xl p-1.5 border border-zinc-200">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              if (quantity === 1) removeItem(product.id);
                              else updateQuantity(product.id, quantity - 1);
                            }}
                            className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-zinc-500 hover:text-red-600 transition-colors"
                          >
                            <Minus className="w-5 h-5" />
                          </motion.button>
                          <span className="font-bold text-lg w-10 text-center text-zinc-900">
                            {quantity}
                          </span>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              if (quantity < product.stock) {
                                updateQuantity(product.id, quantity + 1);
                              }
                            }}
                            disabled={quantity >= product.stock}
                            className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-zinc-500 hover:text-emerald-600 disabled:opacity-50 transition-colors"
                          >
                            <Plus className="w-5 h-5" />
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      {/* Floating Cart Bar */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-2xl z-50"
          >
            <button
              onClick={() => navigate('/kiosk/cart')}
              className="w-full bg-zinc-900 text-white p-4 rounded-3xl shadow-2xl shadow-zinc-900/40 flex items-center justify-between group overflow-hidden relative"
            >
              {/* Shine effect */}
              <motion.div 
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
              />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center relative shadow-lg shadow-emerald-500/20">
                  <ShoppingCart className="w-6 h-6 text-white" />
                  <span className="absolute -top-2 -right-2 bg-white text-emerald-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 border-zinc-900">
                    {totalItems}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Pesanan</p>
                  <p className="text-xl font-black tracking-tight">{formatRupiah(totalAmount)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 relative z-10 bg-white/10 px-6 py-3 rounded-2xl group-hover:bg-emerald-500 transition-colors">
                <span className="text-xs font-black uppercase tracking-widest">Checkout</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
