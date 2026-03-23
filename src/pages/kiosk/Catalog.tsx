import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore, Product } from '../../store/useCartStore';
import { formatRupiah } from '../../lib/utils';
import { Search, Plus, Minus, ShoppingBag, Filter, Tag, Info, ShoppingCart, ArrowRight, Loader2, X, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Joyride, { Step, STATUS } from 'react-joyride';

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [storeType, setStoreType] = useState<'kantin' | 'koperasi' | 'digital'>('koperasi');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const navigate = useNavigate();
  const [runTour, setRunTour] = useState(false);

  const { items, addItem, removeItem, updateQuantity, getTotal } = useCartStore();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = getTotal();

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('sps_buyer_tour_seen');
    if (!hasSeenTour) {
      setRunTour(true);
    }
  }, []);

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
      localStorage.setItem('sps_buyer_tour_seen', 'true');
    }
  };

  const tourSteps: Step[] = [
    {
      target: 'body',
      title: 'Selamat Datang di SPS Corner! 👋',
      content: (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl overflow-hidden bg-black aspect-video relative flex items-center justify-center group">
            <img 
              src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800" 
              alt="Food ordering"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative z-10 w-16 h-16 bg-blue-600/90 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(37,99,235,0.5)] cursor-pointer hover:bg-blue-500 transition-colors"
            >
              <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-2" />
            </motion.div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="font-bold text-sm mb-1">Cara Memesan Makanan</p>
              <div className="w-full bg-white/30 h-1 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 10, repeat: Infinity }}
                  className="h-full bg-blue-500"
                />
              </div>
            </div>
          </div>
          <p className="text-sm">Tonton video singkat ini atau ikuti panduan interaktif untuk mengetahui cara mudah memesan makanan dan minuman favorit Anda.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.tour-store-type',
      title: 'Langkah 1: Pilih Toko 🏪',
      content: (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg overflow-hidden bg-zinc-100 aspect-video relative flex items-center justify-center border border-zinc-200">
            <div className="flex gap-2 p-4 bg-white rounded-xl shadow-sm">
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold"
              >
                Kantin
              </motion.div>
              <div className="px-4 py-2 bg-zinc-100 text-zinc-500 rounded-lg text-sm font-bold">Koperasi</div>
            </div>
            <motion.div 
              animate={{ x: [-20, 0, -20], y: [20, 0, 20] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute pointer-events-none"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                <path d="M5.5 3.21V20.8C5.5 21.45 6.21 21.85 6.75 21.5L11.44 18.32C11.71 18.13 12.04 18.06 12.36 18.12L18.15 19.28C18.79 19.41 19.38 18.84 19.27 18.2L13.9 4.35C13.66 3.73 12.8 3.65 12.45 4.2L9.67 8.5C9.48 8.8 9.14 8.96 8.78 8.94L3.89 8.64C3.24 8.6 2.87 7.85 3.27 7.36L5.5 3.21Z" fill="white" stroke="black" strokeWidth="1.5"/>
              </svg>
            </motion.div>
          </div>
          <p className="text-sm">Pilih lokasi tempat Anda ingin berbelanja:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
            <li><strong>Kantin:</strong> Makanan & minuman yang tersedia langsung (ready stock).</li>
            <li><strong>Koperasi:</strong> Produk Sari Roti (Pesan sebelum jam 12 siang diambil besok, lewat jam 12 diambil lusa).</li>
            <li><strong>Digital:</strong> Produk digital seperti pulsa, token, dll.</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '.tour-search',
      title: 'Langkah 2: Cari Menu 🔍',
      content: (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg overflow-hidden bg-zinc-100 h-24 relative flex items-center justify-center border border-zinc-200 px-4">
            <div className="w-full bg-white rounded-full flex items-center px-4 py-2 shadow-sm border border-zinc-200">
              <Search className="w-4 h-4 text-zinc-400 mr-2" />
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
                className="text-sm text-zinc-800 font-medium"
              >
                Nasi Goreng...
              </motion.span>
              <motion.div 
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-0.5 h-4 bg-blue-500 ml-1"
              />
            </div>
          </div>
          <p className="text-sm">Ketik nama makanan atau minuman yang Anda inginkan di sini. <strong>Coba ketik sesuatu sekarang!</strong></p>
        </div>
      ),
      placement: 'bottom',
      spotlightPadding: 8,
    },
    {
      target: '.tour-categories',
      title: 'Langkah 3: Filter Kategori 🏷️',
      content: (
        <div className="flex flex-col gap-3">
          <p className="text-sm">Gunakan filter kategori ini untuk melihat-lihat menu berdasarkan jenisnya.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
            <li><strong>Geser (swipe)</strong> menu ini ke kiri/kanan jika terpotong.</li>
            <li><strong>Klik salah satu kategori</strong> untuk langsung memfilter menu di bawahnya.</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
      spotlightPadding: 8,
    },
    {
      target: '.tour-product-card-0',
      title: 'Langkah 4: Lihat Detail & Tambah Menu 🍔',
      content: (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg overflow-hidden bg-zinc-100 aspect-video relative flex items-center justify-center border border-zinc-200">
            <div className="bg-white p-3 rounded-xl shadow-sm w-48 relative">
              <div className="absolute top-2 left-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Sisa 5</div>
              <div className="w-full h-20 bg-zinc-200 rounded-lg mb-2"></div>
              <div className="h-4 w-3/4 bg-zinc-200 rounded mb-2"></div>
              <div className="flex justify-between items-center mt-4">
                <div className="h-4 w-1/2 bg-zinc-200 rounded"></div>
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], backgroundColor: ['#3b82f6', '#2563eb', '#3b82f6'] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white"
                >
                  <Plus className="w-4 h-4" />
                </motion.div>
              </div>
            </div>
          </div>
          <p className="text-sm">Di sini Anda bisa melihat foto, nama, harga, dan <strong>Sisa Stok</strong> dari setiap menu.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
            <li><strong>Klik kartu menu</strong> untuk melihat detail lengkap produk.</li>
            <li><strong>Klik tombol +</strong> untuk langsung menambahkannya ke keranjang.</li>
          </ul>
          <p className="text-sm mt-1"><strong>Coba klik kartu ini atau tombol + sekarang!</strong></p>
        </div>
      ),
      placement: 'top',
      spotlightPadding: 8,
    },
    {
      target: '.tour-cart-button',
      title: 'Langkah 5: Tinjau & Bayar 🛒',
      content: (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg overflow-hidden bg-zinc-100 h-24 relative flex items-center justify-center border border-zinc-200">
            <motion.div 
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative bg-white p-3 rounded-xl shadow-sm flex items-center gap-3"
            >
              <div className="relative">
                <ShoppingCart className="w-6 h-6 text-zinc-700" />
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.5 }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white"
                >
                  2
                </motion.div>
              </div>
              <div className="text-sm font-bold text-zinc-800">Rp 25.000</div>
            </motion.div>
          </div>
          <p className="text-sm">Setelah selesai memilih, klik ikon keranjang ini. Di halaman selanjutnya, Anda bisa:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
            <li>Memeriksa kembali pesanan Anda.</li>
            <li><strong>Mengisi Nama Anda</strong> untuk pesanan.</li>
            <li>Memilih metode pembayaran dan menyelesaikan transaksi.</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
    }
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  const isKoperasiProduct = (p: Product) => {
    const cat = (p.category || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    return cat.includes('sariroti') || cat.includes('sari roti') || name.includes('sariroti') || name.includes('sari roti') || cat.includes('roti tawar') || cat.includes('roti manis') || cat.includes('kue') || cat.includes('sandwich') || name.includes('sari choco') || name.includes('dorayaki') || name.includes('cake');
  };

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
        // Categorize Koperasi products into Roti Tawar, Roti Manis, Roti Sandwich, Kue, and Sari Choco
        const processedProducts = data.map(p => {
          if (isKoperasiProduct(p)) {
            let newCategory = p.category;
            const name = p.name.toLowerCase();
            const cat = (p.category || '').toLowerCase();
            
            if (name.includes('tawar') || cat.includes('tawar') || name.includes('milky soft')) {
              newCategory = 'Roti Tawar';
            } else if (name.includes('sandwich') || cat.includes('sandwich')) {
              newCategory = 'Roti Sandwich';
            } else if (name.includes('kue') || name.includes('cake') || name.includes('dorayaki') || name.includes('bolu') || name.includes('waffle') || name.includes('muffin') || name.includes('bamkuhen') || name.includes('bamkuchen') || name.includes('croissant') || name.includes('lapis') || cat.includes('kue')) {
              newCategory = 'Kue';
            } else if (name.includes('sari choco') || (name.includes('susu') && name.includes('milk')) || name.includes('meises') || name.includes('spread')) {
              newCategory = 'Sari Choco';
            } else {
              newCategory = 'Roti Manis';
            }
            return { ...p, category: newCategory };
          }
          return p;
        });

        setProducts(processedProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter products by store type first
  const storeProducts = products.filter(p => 
    storeType === 'koperasi' ? isKoperasiProduct(p) : !isKoperasiProduct(p)
  );

  // Update categories based on store type
  useEffect(() => {
    const uniqueCategories = Array.from(new Set(storeProducts.map((p) => p.category)));
    setCategories(['Semua', ...uniqueCategories]);
    setActiveCategory('Semua');
  }, [storeType, products]);

  const filteredProducts = storeProducts.filter((product) => {
    const matchesCategory = activeCategory === 'Semua' || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-center justify-between">
          <div className="w-full md:w-72 h-12 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-[20px] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none"></div>
          <div className="flex gap-2 sm:gap-3 overflow-x-auto w-full md:w-auto pb-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 w-24 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-full shrink-0 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none"></div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="clay-card overflow-hidden flex flex-col h-[320px] sm:h-[360px]">
              <div className="aspect-square bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-2xl sm:rounded-[24px] m-3 sm:m-4"></div>
              <div className="p-4 sm:p-6 flex flex-col flex-1 gap-4 sm:gap-5">
                <div className="space-y-2 sm:space-y-3">
                  <div className="h-5 sm:h-6 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-full w-3/4"></div>
                  <div className="h-5 sm:h-6 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-full w-1/2"></div>
                </div>
                <div className="h-10 sm:h-12 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-[20px] mt-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 pb-24 sm:pb-32 transition-colors duration-300">
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        spotlightClicks={true}
        disableOverlayClose={true}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#2563eb',
            zIndex: 10000,
            overlayColor: 'rgba(0, 0, 0, 0.75)',
            width: 340,
          },
          tooltip: {
            borderRadius: '20px',
            padding: '20px',
          },
          tooltipTitle: {
            fontSize: '16px',
            fontWeight: '900',
            marginBottom: '8px',
            color: '#111827',
          },
          tooltipContent: {
            fontSize: '13px',
            lineHeight: '1.5',
            color: '#4b5563',
            padding: '0',
          },
          buttonNext: {
            backgroundColor: '#2563eb',
            borderRadius: '10px',
            padding: '10px 20px',
            fontWeight: 'bold',
            fontSize: '14px',
            outline: 'none',
          },
          buttonBack: {
            color: '#6b7280',
            marginRight: '12px',
            fontSize: '14px',
            fontWeight: '600',
            outline: 'none',
          },
          buttonSkip: {
            color: '#9ca3af',
            fontSize: '14px',
            fontWeight: '600',
            outline: 'none',
          }
        }}
        floaterProps={{
          disableAnimation: true,
          styles: {
            floater: {
              filter: 'drop-shadow(0 20px 25px rgb(0 0 0 / 0.15))',
            }
          }
        }}
        locale={{
          back: 'Kembali',
          close: 'Tutup',
          last: 'Selesai',
          next: 'Lanjut',
          skip: 'Lewati',
        }}
      />
      {/* Header Section */}
      <div className="bg-white dark:bg-zinc-900 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 rounded-b-2xl sm:rounded-b-3xl shadow-sm dark:shadow-black/20 relative z-20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tighter mb-0.5 transition-colors">
                Pilih <span className="text-blue-600 dark:text-blue-400">Menu</span>
              </h1>
              <p className="text-zinc-400 dark:text-zinc-500 text-[10px] sm:text-xs font-bold tracking-tight">Pusat Belanja & Kantin</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {/* Store Type Toggle */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto transition-colors tour-store-type">
                <button
                  onClick={() => setStoreType('kantin')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    storeType === 'kantin' 
                      ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  Kantin
                </button>
                <button
                  onClick={() => setStoreType('koperasi')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    storeType === 'koperasi' 
                      ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  Koperasi
                </button>
                <button
                  onClick={() => navigate('/kiosk/digital')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    storeType === 'digital' 
                      ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  Digital
                </button>
              </div>

              <div className="relative w-full sm:w-64 tour-search">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="text"
                  placeholder="Cari menu..."
                  className="input-clay pl-9 sm:pl-10 text-[10px] sm:text-xs h-9 sm:h-10 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="mt-3 sm:mt-4 flex gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 sm:pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 tour-categories">
            <button
              onClick={() => setActiveCategory('Semua')}
              className={`whitespace-nowrap px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg font-bold text-[8px] sm:text-[10px] transition-all ${
                activeCategory === 'Semua'
                  ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm'
                  : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
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
                    ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6 tour-product-grid">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12">
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-blue-600 dark:text-blue-400 mb-2 sm:mb-3" />
            <p className="text-zinc-400 dark:text-zinc-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">Memuat Menu...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8 sm:py-12 bg-white/50 dark:bg-zinc-900/50 rounded-xl sm:rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-400 dark:text-zinc-500 text-[10px] sm:text-xs font-bold">Menu tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 lg:gap-5">
            {filteredProducts.map((product, index) => {
              const cartItem = items.find((item) => item.id === product.id);
              const quantity = cartItem?.quantity || 0;

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedProduct(product)}
                  className={`clay-card group overflow-hidden flex flex-col h-full cursor-pointer tour-product-card-${index}`}
                >
                  <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-800/50">
                    <img
                      src={product.image_url || 'https://picsum.photos/seed/bread/400/400'}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    {product.stock <= 5 && product.stock > 0 && (
                      <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1 py-0.5 sm:px-1.5 sm:py-0.5 bg-amber-400 dark:bg-amber-500 text-amber-950 text-[6px] sm:text-[8px] font-bold rounded-full shadow-sm uppercase tracking-wider">
                        Sisa: {product.stock}
                      </div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-2 py-1 sm:px-3 sm:py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-[8px] sm:text-[10px] font-bold rounded-full shadow-md uppercase tracking-widest">Habis</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 sm:p-3 flex flex-col flex-1">
                    <h3 className="text-[10px] sm:text-xs font-bold text-zinc-900 dark:text-white mb-0.5 sm:mb-1 tracking-tight line-clamp-1">{product.name}</h3>
                    <p className="text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-black mb-2 sm:mb-3">{formatRupiah(product.price)}</p>
                    
                    <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
                      {quantity > 0 ? (
                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-md sm:rounded-lg p-0.5 sm:p-1 shadow-inner dark:shadow-none">
                          <button
                            onClick={() => {
                              if (quantity === 1) removeItem(product.id);
                              else updateQuantity(product.id, quantity - 1);
                            }}
                            className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white rounded shadow-sm dark:shadow-none active:scale-95 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-600"
                          >
                            <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                          <span className="font-bold text-[10px] sm:text-xs text-zinc-900 dark:text-white">{quantity}</span>
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
            className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-40"
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

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl z-50 overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]"
            >
              <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                <img
                  src={selectedProduct.image_url || 'https://picsum.photos/seed/bread/800/600'}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 right-4 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                {selectedProduct.stock <= 5 && selectedProduct.stock > 0 && (
                  <div className="absolute top-4 left-4 px-3 py-1 bg-amber-400 text-amber-950 text-xs font-bold rounded-full shadow-sm uppercase tracking-wider">
                    Sisa: {selectedProduct.stock}
                  </div>
                )}
                {selectedProduct.stock === 0 && (
                  <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-sm uppercase tracking-wider">
                    Habis
                  </div>
                )}
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-tight mb-1">{selectedProduct.name}</h2>
                    <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">{selectedProduct.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatRupiah(selectedProduct.price)}</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">Deskripsi</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {selectedProduct.description || 'Tidak ada deskripsi untuk produk ini.'}
                  </p>
                </div>
                
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3 mb-2">
                    <Store className="w-5 h-5 text-zinc-400" />
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Informasi Toko</span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                    <p>Kategori: {selectedProduct.category || 'Umum'}</p>
                    <p>Tipe: {selectedProduct.is_digital ? 'Produk Digital' : 'Produk Fisik'}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex-shrink-0">
                {(() => {
                  const cartItem = items.find((item) => item.id === selectedProduct.id);
                  const quantity = cartItem?.quantity || 0;
                  
                  return quantity > 0 ? (
                    <div className="flex items-center justify-between bg-white dark:bg-zinc-800 rounded-xl p-2 shadow-sm border border-zinc-200 dark:border-zinc-700">
                      <button
                        onClick={() => {
                          if (quantity === 1) removeItem(selectedProduct.id);
                          else updateQuantity(selectedProduct.id, quantity - 1);
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <span className="font-black text-lg text-zinc-900 dark:text-white">{quantity}</span>
                      <button
                        onClick={() => {
                          if (quantity < selectedProduct.stock) {
                            updateQuantity(selectedProduct.id, quantity + 1);
                          }
                        }}
                        disabled={quantity >= selectedProduct.stock}
                        className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addItem(selectedProduct)}
                      disabled={selectedProduct.stock === 0}
                      className="w-full btn-clay-primary py-3 text-sm flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Tambah ke Keranjang
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
