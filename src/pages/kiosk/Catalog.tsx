import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore, Product } from '../../store/useCartStore';
import { formatRupiah } from '../../lib/utils';
import { Search, Plus, Minus, ShoppingBag, Filter, Tag, Info, ShoppingCart, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-center justify-between">
          <div className="w-full md:w-72 h-12 bg-zinc-200 animate-pulse rounded-[20px] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)]"></div>
          <div className="flex gap-2 sm:gap-3 overflow-x-auto w-full md:w-auto pb-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 w-24 bg-zinc-200 animate-pulse rounded-full shrink-0 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)]"></div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="clay-card overflow-hidden flex flex-col h-[320px] sm:h-[360px]">
              <div className="aspect-square bg-zinc-200 animate-pulse rounded-2xl sm:rounded-[24px] m-3 sm:m-4"></div>
              <div className="p-4 sm:p-6 flex flex-col flex-1 gap-4 sm:gap-5">
                <div className="space-y-2 sm:space-y-3">
                  <div className="h-5 sm:h-6 bg-zinc-200 animate-pulse rounded-full w-3/4"></div>
                  <div className="h-5 sm:h-6 bg-zinc-200 animate-pulse rounded-full w-1/2"></div>
                </div>
                <div className="h-10 sm:h-12 bg-zinc-200 animate-pulse rounded-[20px] mt-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e8ebf0] pb-24 sm:pb-32">
      {/* Header Section */}
      <div className="bg-white px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 rounded-b-2xl sm:rounded-b-3xl shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tighter mb-0.5">
                Pilih <span className="text-blue-600">Menu</span>
              </h1>
              <p className="text-zinc-400 text-[10px] sm:text-xs font-bold tracking-tight">Kantin Digital Sariroti</p>
            </div>
            
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari roti atau minuman..."
                className="input-clay pl-9 sm:pl-10 text-[10px] sm:text-xs h-9 sm:h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Categories */}
          <div className="mt-3 sm:mt-4 flex gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 sm:pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveCategory('Semua')}
              className={`whitespace-nowrap px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg font-bold text-[8px] sm:text-[10px] transition-all ${
                activeCategory === 'Semua'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              Semua Menu
            </button>
            {categories.filter(c => c !== 'Semua').map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg font-bold text-[8px] sm:text-[10px] transition-all flex items-center gap-1 sm:gap-1.5 ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12">
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-blue-600 mb-2 sm:mb-3" />
            <p className="text-zinc-400 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">Memuat Menu...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8 sm:py-12 bg-white/50 rounded-xl sm:rounded-2xl border border-dashed border-zinc-200">
            <p className="text-zinc-400 text-[10px] sm:text-xs font-bold">Menu tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {filteredProducts.map((product) => {
              const cartItem = items.find((item) => item.id === product.id);
              const quantity = cartItem?.quantity || 0;

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -2 }}
                  className="clay-card group overflow-hidden flex flex-col h-full"
                >
                  <div className="relative aspect-square overflow-hidden bg-zinc-50">
                    <img
                      src={product.image_url || 'https://picsum.photos/seed/bread/400/400'}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    {product.stock <= 5 && product.stock > 0 && (
                      <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1 py-0.5 sm:px-1.5 sm:py-0.5 bg-amber-400 text-amber-950 text-[6px] sm:text-[8px] font-bold rounded-full shadow-sm uppercase tracking-wider">
                        Sisa: {product.stock}
                      </div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-2 py-1 sm:px-3 sm:py-1 bg-white text-zinc-900 text-[8px] sm:text-[10px] font-bold rounded-full shadow-md uppercase tracking-widest">Habis</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 sm:p-3 flex flex-col flex-1">
                    <h3 className="text-[10px] sm:text-xs font-bold text-zinc-900 mb-0.5 sm:mb-1 tracking-tight line-clamp-1">{product.name}</h3>
                    <p className="text-blue-600 text-xs sm:text-sm font-black mb-2 sm:mb-3">{formatRupiah(product.price)}</p>
                    
                    <div className="mt-auto">
                      {quantity > 0 ? (
                        <div className="flex items-center justify-between bg-zinc-50 rounded-md sm:rounded-lg p-0.5 sm:p-1 shadow-inner">
                          <button
                            onClick={() => {
                              if (quantity === 1) removeItem(product.id);
                              else updateQuantity(product.id, quantity - 1);
                            }}
                            className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center bg-white text-zinc-900 rounded shadow-sm active:scale-95 transition-all"
                          >
                            <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                          <span className="font-bold text-[10px] sm:text-xs text-zinc-900">{quantity}</span>
                          <button
                            onClick={() => {
                              if (quantity < product.stock) {
                                updateQuantity(product.id, quantity + 1);
                              }
                            }}
                            disabled={quantity >= product.stock}
                            className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center bg-blue-600 text-white rounded shadow-sm active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addItem(product)}
                          disabled={product.stock === 0}
                          className="w-full btn-clay-primary py-1 sm:py-1.5 text-[8px] sm:text-[10px] flex items-center justify-center gap-1 sm:gap-1.5"
                        >
                          <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          Tambah
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Bar */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-50"
          >
            <div className="max-w-3xl mx-auto clay-card-blue p-2.5 sm:p-3 flex items-center justify-between gap-2.5 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-md rounded-md sm:rounded-lg flex items-center justify-center relative shadow-inner">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 bg-amber-400 text-amber-950 text-[8px] sm:text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border border-blue-600">
                    {totalItems}
                  </span>
                </div>
                <div>
                  <p className="text-[6px] sm:text-[8px] font-bold text-blue-100 uppercase tracking-widest mb-0.5">Total Pesanan</p>
                  <p className="text-sm sm:text-base font-black text-white tracking-tighter">{formatRupiah(totalAmount)}</p>
                </div>
              </div>
              
              <button
                onClick={() => navigate('/kiosk/cart')}
                className="btn-clay-secondary px-2.5 py-1 sm:px-4 sm:py-1.5 text-[8px] sm:text-[10px] flex items-center gap-1 sm:gap-1.5 shadow-sm"
              >
                Lihat Keranjang
                <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
