import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Store, ShoppingBag, ArrowRight, Search, X, Package, Plus, Minus, ShoppingCart } from 'lucide-react';
import { formatRupiah } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image_url: string;
  seller_id: string;
}

export default function PortalKantin() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('semua');
  const [categories, setCategories] = useState<string[]>([]);
  const [cart, setCart] = useState<{product: Product; quantity: number}[]>([]);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .gt('stock', 0)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setProducts(data || []);
      
      const cats = [...new Set(data?.map(p => p.category).filter(Boolean) || [])];
      setCategories(cats);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'semua' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.error('Stok tidak mencukupi');
        return;
      }
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    toast.success(`${product.name} ditambahkan`);
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find(item => item.product.id === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(item => 
        item.product.id === productId 
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ));
    } else {
      setCart(cart.filter(item => item.product.id !== productId));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const getCartCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="min-h-screen bg-[#e8ebf2] dark:bg-zinc-950 pb-20">
      {/* Header */}
      <div className="bg-green-600 dark:bg-green-700 px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">Kiosk</h1>
            <p className="text-green-100 text-xs">Belanja kebutuhan harian</p>
          </div>
          <button 
            onClick={() => navigate('/kiosk')}
            className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <ArrowRight className="w-4 h-4" />
            Buka Kiosk Penuh
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm border-0"
          />
        </div>

        {/* Categories */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory('semua')}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
              selectedCategory === 'semua' 
                ? 'bg-white text-green-600' 
                : 'bg-white/20 text-white'
            }`}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                selectedCategory === cat 
                  ? 'bg-white text-green-600' 
                  : 'bg-white/20 text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8 text-zinc-400">Memuat produk...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-xl">
            <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Tidak ada produk tersedia</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700"
              >
                {product.image_url && (
                  <div className="h-24 sm:h-32 bg-zinc-100 dark:bg-zinc-800">
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-bold text-zinc-900 dark:text-white text-sm line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-zinc-500 capitalize mt-1">{product.category}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {formatRupiah(product.price)}
                    </span>
                    <span className="text-xs text-zinc-400">
                      Stok: {product.stock}
                    </span>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className="w-full mt-2 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-zinc-300 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <ShoppingBag className="w-3 h-3" />
                    Tambah
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Floating Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 right-4 z-30">
          <button
            onClick={() => setShowCart(true)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {getCartCount()}
              </span>
            </div>
            <span className="font-bold">{formatRupiah(getCartTotal())}</span>
          </button>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setShowCart(false)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 rounded-t-2xl w-full max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-green-500 text-white p-4 flex items-center justify-between">
              <h2 className="font-black text-lg">Keranjang Belanja</h2>
              <button onClick={() => setShowCart(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-bold text-sm">{item.product.name}</h3>
                    <p className="text-xs text-zinc-500">{formatRupiah(item.product.price)} x {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold w-8 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => addToCart(item.product)}
                      disabled={item.quantity >= item.product.stock}
                      className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center disabled:bg-zinc-300"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-zinc-600 dark:text-zinc-400">Total</span>
                  <span className="font-black text-xl text-green-600">{formatRupiah(getCartTotal())}</span>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.setItem('portalCart', JSON.stringify(cart));
                    navigate('/kiosk/checkout');
                  }}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Lanjut ke Pembayaran
                </button>
                <button
                  onClick={() => navigate('/kiosk')}
                  className="w-full mt-2 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold"
                >
                  Buka Kiosk Penuh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}