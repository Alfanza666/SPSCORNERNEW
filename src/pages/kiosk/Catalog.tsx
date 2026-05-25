import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore, Product } from '../../store/useCartStore';
import { formatRupiah } from '../../lib/utils';
import { Search, Plus, Minus, ShoppingBag, Filter, Tag, Info, ShoppingCart, ArrowRight, Loader2, X, Store, FileText, Clock, CalendarDays, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { Suspense } from 'react';
import toast from 'react-hot-toast';

const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const PICKUP_TYPE_LABELS: Record<string, string> = {
  same_day: 'Ready Hari Ini',
  next_day: 'Ready H+1 (Besok)',
  custom_days: 'Ready Kustom',
};

interface PoConfig {
  id: string;
  product_id: string;
  seller_id: string;
  is_active: boolean;
  pickup_type: string;
  custom_days?: number;
  order_cutoff_time?: string;
  po_stock: number;
  min_order: number;
  max_order: number;
  pickup_notes?: string;
  open_days?: number[];
  products: {
    id: string;
    name: string;
    price: number;
    image_url: string;
    category?: string;
    description?: string;
    is_active: boolean;
  };
  profiles?: { name: string };
}


export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [storeType, setStoreType] = useState<'kantin' | 'koperasi' | 'digital' | 'preorder'>('kantin');
  const [poConfigs, setPoConfigs] = useState<PoConfig[]>([]);
  const [poProducts, setPoProducts] = useState<Product[]>([]);
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const navigate = useNavigate();

  const { items, addItem, removeItem, updateQuantity, getTotal } = useCartStore();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = getTotal();

  const renderDate = useMemo(() => new Date(), []);

  useEffect(() => {
    fetchProducts();
    fetchPoProducts();
  }, []);

  // Handle navigation from PreOrder redirect or direct URL with tab param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'preorder') {
      setStoreType('preorder');
    }
  }, [location.search]);

  // Debounce search query 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isKoperasiProduct = (p: Product) => {
    const cat = (p.category || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    return cat.includes('sariroti') || cat.includes('sari roti') || name.includes('sariroti') || name.includes('sari roti') || cat.includes('roti tawar') || cat.includes('roti manis') || cat.includes('kue') || cat.includes('sandwich') || name.includes('sari choco') || name.includes('dorayaki') || name.includes('cake');
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);

      // Get closed sellers (fault-tolerant: skip filter if store_open column doesn't exist)
      let closedSellerIds: string[] = [];
      try {
        const { data: closedSellers } = await supabase
          .from('profiles')
          .select('id')
          .eq('store_open', false);
        if (closedSellers) {
          closedSellerIds = closedSellers.map((s: any) => s.id);
        }
      } catch {
        // store_open column not available — show all products
      }

      let query = supabase
        .from('products')
        .select('id, name, price, stock, category, seller_id, is_active, description, image_url, profiles:seller_id(name)')
        .eq('is_active', true)
        .gt('stock', 0);

      if (closedSellerIds.length > 0) {
        const idList = closedSellerIds.map(id => `"${id}"`).join(',');
        query = query.filter('seller_id', 'not.in', `(${idList})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // Categorize Koperasi products into Roti Tawar, Roti Manis, Roti Sandwich, Kue, and Sari Choco
        const processedProducts = data.map(p => {
          if (isKoperasiProduct(p as any as Product)) {
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

        setProducts(processedProducts as any as Product[]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPoProducts = async () => {
    try {
      const { data } = await supabase
        .from('pre_order_configs')
        .select('*, products(id, name, price, image_url, category, description, is_active), profiles:seller_id(name)')
        .eq('is_active', true);

      const activeConfigs = (data || []).filter((c: any) => c.products?.is_active) as PoConfig[];
      setPoConfigs(activeConfigs);

      // Convert PO configs to Product-compatible items for display
      const poProds: Product[] = activeConfigs.map(cfg => ({
        id: cfg.products.id,
        seller_id: cfg.seller_id,
        name: cfg.products.name,
        price: cfg.products.price,
        stock: cfg.po_stock,
        category: cfg.products.category || 'Pre-Order',
        image_url: cfg.products.image_url,
        description: cfg.products.description,
        is_preorder: true,
        po_config_id: cfg.id,
        po_seller_id: cfg.seller_id,
        pickup_notes: cfg.pickup_notes,
        po_pickup_type: cfg.pickup_type,
        po_open_days: cfg.open_days,
        po_cutoff_time: cfg.order_cutoff_time?.slice(0, 5),
        po_stock: cfg.po_stock,
        po_min_order: cfg.min_order,
        po_max_order: cfg.max_order,
        profiles: cfg.profiles,
      }));
      setPoProducts(poProds);
    } catch (error) {
      console.error('Error fetching PO configs:', error);
    }
  };

  // Check if PO ordering is within cutoff time
  const isWithinCutoff = (product: Product, now?: Date): boolean => {
    if (!product.po_cutoff_time) return true;
    const current = now || new Date();
    const [hours, minutes] = product.po_cutoff_time.split(':').map(Number);
    const cutoff = new Date(current);
    cutoff.setHours(hours, minutes, 0, 0);
    return current <= cutoff;
  };

  // Check if today is an open day for PO
  const isTodayOpenDay = (product: Product, now?: Date): boolean => {
    if (!product.po_open_days || product.po_open_days.length === 0) return true;
    const current = now || new Date();
    return product.po_open_days.includes(current.getDay());
  };

  // Get ready label for PO product
  const getPoReadyLabel = (product: Product): string => {
    if (!product.po_pickup_type) return '';
    if (product.po_pickup_type === 'custom_days') {
      const cfg = poConfigs.find(c => c.id === product.po_config_id);
      return `Ready H+${cfg?.custom_days || '?'}`;
    }
    return PICKUP_TYPE_LABELS[product.po_pickup_type] || '';
  };

  // Get open days text
  const getOpenDaysText = (days?: number[]): string => {
    if (!days || days.length === 0 || days.length === 7) return 'Setiap Hari';
    return days.map(d => DAYS_SHORT[d]).join(', ');
  };

  // Handle adding PO item to cart with validation
  const handleAddPoItem = (product: Product) => {
    if (!isTodayOpenDay(product)) {
      toast.error(`Pre-Order ini hanya buka di hari ${getOpenDaysText(product.po_open_days)}`);
      return;
    }
    if (!isWithinCutoff(product)) {
      toast.error(`Batas pemesanan sudah lewat (cutoff ${product.po_cutoff_time} WITA)`);
      return;
    }
    // Check min order
    const existingItem = items.find(i => i.id === product.id);
    const currentQty = existingItem?.quantity || 0;
    if (currentQty === 0 && product.po_min_order && product.po_min_order > 1) {
      // Add with minimum order quantity
      addItem({ ...product, stock: product.po_stock || 999 });
      if (product.po_min_order > 1) {
        updateQuantity(product.id, product.po_min_order);
        toast.success(`Minimum order ${product.po_min_order} pcs`);
      }
      return;
    }
    // Check max order
    if (product.po_max_order && currentQty >= product.po_max_order) {
      toast.error(`Maksimum order ${product.po_max_order} pcs`);
      return;
    }
    addItem({ ...product, stock: product.po_max_order || product.po_stock || 999 });
  };

  // Filter products by store type first
  const storeProducts = storeType === 'preorder'
    ? poProducts
    : products.filter(p =>
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
    const matchesSearch = product.name.toLowerCase().includes(debouncedQuery.toLowerCase());
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
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 pb-24 sm:pb-32 transition-colors duration-300 tour-kiosk-catalog">
      {/* Header Section */}
      <div className="bg-white dark:bg-zinc-900 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 rounded-b-2xl sm:rounded-b-3xl shadow-sm dark:shadow-black/20 relative z-20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-zinc-400 dark:text-zinc-600 mb-3 sm:mb-4 uppercase tracking-widest">
            <span>Menu</span>
            <span className="opacity-50">/</span>
            <span className="text-blue-600 dark:text-blue-400">Katalog Produk</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tighter mb-0.5 transition-colors">
                Pilih <span className="text-blue-600 dark:text-blue-400">Menu</span>
              </h1>
              <p className="text-zinc-400 dark:text-zinc-500 text-[10px] sm:text-xs font-bold tracking-tight">Pusat Belanja & Kantin</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {/* Store Type Toggle */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto transition-colors guide-store-toggle">
                <button
                  onClick={() => setStoreType('kantin')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${storeType === 'kantin'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                >
                  Kantin
                </button>
                <button
                  onClick={() => setStoreType('koperasi')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${storeType === 'koperasi'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                >
                  Koperasi
                </button>
                <button
                  onClick={() => navigate('/kiosk/digital')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${storeType === 'digital'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                >
                  Digital
                </button>
                <button
                  onClick={() => setStoreType('preorder')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${storeType === 'preorder'
                    ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400'
                    }`}
                >
                  Pre-Order
                  {poProducts.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[8px] font-black bg-amber-500 text-white rounded-full">{poProducts.length}</span>
                  )}
                </button>
              </div>

              <div className="relative w-full sm:w-64 guide-search">
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

          <div className="mt-4 sm:mt-5 flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:pb-3 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 guide-category-filters">
            <button
              onClick={() => setActiveCategory('Semua')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm ${activeCategory === 'Semua'
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
            >
              Semua Menu
            </button>
            {categories.filter(c => c !== 'Semua').map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-sm ${activeCategory === cat
                  ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-500/20'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6 guide-product-grid">
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
            {filteredProducts.map((product, index) => {
              const cartItem = items.find((item) => item.id === product.id);
              const quantity = cartItem?.quantity || 0;

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedProduct(product)}
                  className={`bg-white dark:bg-zinc-900 rounded-[1.5rem] border ${product.is_preorder ? 'border-amber-200/80 dark:border-amber-900/50' : 'border-zinc-100/80 dark:border-zinc-800'} shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-none group overflow-hidden flex flex-col h-full cursor-pointer ${index === 0 ? 'guide-product-card' : ''} transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]`}
                >
                  <div className="p-2 sm:p-2.5 pb-0">
                    <div className="relative aspect-[4/3] sm:aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                      <img
                        src={product.image_url || 'https://picsum.photos/seed/bread/400/400'}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 no-download"
                        draggable="false"
                        onContextMenu={(e) => e.preventDefault()}
                        referrerPolicy="no-referrer"
                        loading={index < 8 ? "eager" : "lazy"}
                        decoding="async"
                        {...(index < 4 ? { fetchPriority: "high" } : {})}
                      />
                      {product.is_preorder && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500/90 backdrop-blur-md text-white text-[8px] font-black rounded-lg shadow-sm uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Pre-Order
                        </div>
                      )}
                      {!product.is_preorder && product.stock <= 5 && product.stock > 0 && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-amber-400/90 backdrop-blur-md text-amber-950 text-[9px] font-black rounded-lg shadow-sm uppercase tracking-wider">
                          Sisa {product.stock}
                        </div>
                      )}
                      {!product.is_preorder && product.stock === 0 && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
                          <span className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-black rounded-xl shadow-lg uppercase tracking-widest">Habis</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 flex flex-col flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mb-1 tracking-tight line-clamp-2 leading-snug">{product.name}</h3>
                    <p className="text-blue-600 dark:text-blue-400 text-sm sm:text-base font-black tracking-tight">{formatRupiah(product.price)}</p>
                    {product.is_preorder && (
                      <p className="text-amber-600 dark:text-amber-400 text-[9px] sm:text-[10px] font-bold mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {getPoReadyLabel(product)}
                      </p>
                    )}
                    <div className="mb-3 sm:mb-4" />

                    <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
                      {product.is_preorder ? (
                        /* Pre-Order Add Button */
                        (() => {
                          const poQty = cartItem?.quantity || 0;
                          const maxOrder = product.po_max_order || product.po_stock || 999;
                          const canOrder = isTodayOpenDay(product, renderDate) && isWithinCutoff(product, renderDate);
                          return poQty > 0 ? (
                            <div className="flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-1 shadow-sm">
                              <button
                                onClick={() => {
                                  const minOrder = product.po_min_order || 1;
                                  if (poQty <= minOrder) removeItem(product.id);
                                  else updateQuantity(product.id, poQty - 1);
                                }}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all"
                              >
                                <Minus className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
                              </button>
                              <span className="font-black text-xs sm:text-sm text-amber-700 dark:text-amber-300 w-6 text-center">{poQty}</span>
                              <button
                                onClick={() => {
                                  if (poQty < maxOrder) updateQuantity(product.id, poQty + 1);
                                  else toast.error(`Maks. order ${maxOrder} pcs`);
                                }}
                                disabled={poQty >= maxOrder}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-amber-500 text-white rounded-lg shadow-sm hover:bg-amber-600 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                              >
                                <Plus className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddPoItem(product)}
                              disabled={!canOrder}
                              className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed guide-product-add"
                            >
                              <Plus className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
                              {!canOrder ? (isTodayOpenDay(product, renderDate) ? 'Cutoff Lewat' : 'Tutup Hari Ini') : 'Pre-Order'}
                            </button>
                          );
                        })()
                      ) : quantity > 0 ? (
                        <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-1 shadow-sm">
                          <button
                            onClick={() => {
                              if (quantity === 1) removeItem(product.id);
                              else updateQuantity(product.id, quantity - 1);
                            }}
                            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all"
                          >
                            <Minus className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
                          </button>
                          <span className="font-black text-xs sm:text-sm text-blue-700 dark:text-blue-300 w-6 text-center">{quantity}</span>
                          <button
                            onClick={() => {
                              if (quantity < product.stock) {
                                updateQuantity(product.id, quantity + 1);
                              }
                            }}
                            disabled={quantity >= product.stock}
                            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                          >
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addItem(product)}
                          disabled={product.stock === 0}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:hover:bg-blue-600 guide-product-add"
                        >
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
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
            className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-40 safe-area-bottom"
          >
            <div className="max-w-3xl mx-auto clay-card-blue p-2.5 sm:p-3 flex items-center justify-between gap-2.5 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-11 sm:h-11 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center relative shadow-[0_4px_12px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.2)] border border-white/30 transition-transform">
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
                  <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-[20px] px-1 bg-amber-400 text-amber-950 text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-blue-600 z-10">
                    {totalItems}
                  </div>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto"
            >
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
              </div>

              {/* Product Image */}
              <div className="relative aspect-video sm:aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-800 mx-4 mt-2 rounded-2xl">
                <img
                  src={selectedProduct.image_url || 'https://picsum.photos/seed/bread/400/400'}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover no-download"
                  draggable="false"
                  onContextMenu={e => e.preventDefault()}
                />
                {selectedProduct.stock <= 5 && selectedProduct.stock > 0 && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-amber-400/90 backdrop-blur-md text-amber-950 text-[10px] font-black rounded-lg uppercase tracking-wider">
                    Sisa {selectedProduct.stock}
                  </div>
                )}
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-snug mb-1">
                      {selectedProduct.name}
                    </h2>
                    {(selectedProduct as any).profiles?.name && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                        Oleh: {(selectedProduct as any).profiles.name}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                      {formatRupiah(selectedProduct.price)}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium">per item</p>
                  </div>
                </div>

                {selectedProduct.category && (
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      <Tag className="w-3 h-3" />
                      {selectedProduct.category}
                    </span>
                  </div>
                )}

                {(selectedProduct as any).description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mb-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                    {(selectedProduct as any).description}
                  </p>
                )}

                {/* PO Info Section */}
                {selectedProduct.is_preorder && (
                  <div className="mb-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">Info Pre-Order</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold text-[10px] mb-0.5">Jadwal Ready</p>
                        <p className="font-black text-zinc-900 dark:text-white">{getPoReadyLabel(selectedProduct)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold text-[10px] mb-0.5">Cutoff Pesan</p>
                        <p className="font-black text-zinc-900 dark:text-white">{selectedProduct.po_cutoff_time || '-'} WITA</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold text-[10px] mb-0.5">Hari Buka</p>
                        <p className="font-black text-zinc-900 dark:text-white text-[11px]">{getOpenDaysText(selectedProduct.po_open_days)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold text-[10px] mb-0.5">Min/Maks Order</p>
                        <p className="font-black text-zinc-900 dark:text-white">{selectedProduct.po_min_order || 1} - {selectedProduct.po_max_order || '∞'} pcs</p>
                      </div>
                    </div>
                    {selectedProduct.pickup_notes && (
                      <div className="mt-2 pt-2 border-t border-amber-200/30 dark:border-amber-800/20">
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold text-[10px] mb-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Catatan Pengambilan
                        </p>
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{selectedProduct.pickup_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {!selectedProduct.is_preorder && (
                  <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 font-medium mb-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <span>Stok tersedia</span>
                    <span className={`font-black ${selectedProduct.stock < 5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {selectedProduct.stock} pcs
                    </span>
                  </div>
                )}
                {selectedProduct.is_preorder && (
                  <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 font-medium mb-5 pb-4 border-b border-amber-100 dark:border-amber-900/30">
                    <span>Kuota PO</span>
                    <span className="font-black text-amber-600 dark:text-amber-400">
                      {selectedProduct.po_stock || '∞'} pcs
                    </span>
                  </div>
                )}

                {/* Add to cart controls */}
                {(() => {
                  const cartItem = items.find(i => i.id === selectedProduct.id);
                  const qty = cartItem?.quantity || 0;

                  if (selectedProduct.is_preorder) {
                    const maxOrder = selectedProduct.po_max_order || selectedProduct.po_stock || 999;
                    const minOrder = selectedProduct.po_min_order || 1;
                    const canOrder = isTodayOpenDay(selectedProduct, renderDate) && isWithinCutoff(selectedProduct, renderDate);

                    return qty > 0 ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-2 flex-1">
                          <button
                            onClick={() => {
                              if (qty <= minOrder) removeItem(selectedProduct.id);
                              else updateQuantity(selectedProduct.id, qty - 1);
                            }}
                            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all"
                          >
                            <Minus className="w-5 h-5" strokeWidth={3} />
                          </button>
                          <span className="flex-1 text-center font-black text-lg text-amber-700 dark:text-amber-300">{qty}</span>
                          <button
                            onClick={() => {
                              if (qty < maxOrder) updateQuantity(selectedProduct.id, qty + 1);
                              else toast.error(`Maks. order ${maxOrder} pcs`);
                            }}
                            disabled={qty >= maxOrder}
                            className="w-10 h-10 flex items-center justify-center bg-amber-500 text-white rounded-xl shadow-sm hover:bg-amber-600 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Plus className="w-5 h-5" strokeWidth={3} />
                          </button>
                        </div>
                        <button
                          onClick={() => navigate('/kiosk/cart')}
                          className="h-14 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm flex items-center gap-2 transition-colors shadow-md shadow-emerald-600/20"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Ke Keranjang
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddPoItem(selectedProduct)}
                        disabled={!canOrder}
                        className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-5 h-5" strokeWidth={3} />
                        {!canOrder ? (isTodayOpenDay(selectedProduct, renderDate) ? `Cutoff Lewat (${selectedProduct.po_cutoff_time})` : 'Tutup Hari Ini') : 'Pre-Order Sekarang'}
                      </button>
                    );
                  }

                  return qty > 0 ? (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-2 flex-1">
                        <button
                          onClick={() => {
                            if (qty === 1) removeItem(selectedProduct.id);
                            else updateQuantity(selectedProduct.id, qty - 1);
                          }}
                          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all"
                        >
                          <Minus className="w-5 h-5" strokeWidth={3} />
                        </button>
                        <span className="flex-1 text-center font-black text-lg text-blue-700 dark:text-blue-300">{qty}</span>
                        <button
                          onClick={() => { if (qty < selectedProduct.stock) updateQuantity(selectedProduct.id, qty + 1); }}
                          disabled={qty >= selectedProduct.stock}
                          className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <Plus className="w-5 h-5" strokeWidth={3} />
                        </button>
                      </div>
                      <button
                        onClick={() => navigate('/kiosk/cart')}
                        className="h-14 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm flex items-center gap-2 transition-colors shadow-md shadow-emerald-600/20"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Ke Keranjang
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { addItem(selectedProduct); }}
                      disabled={selectedProduct.stock === 0}
                      className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" strokeWidth={3} />
                      {selectedProduct.stock === 0 ? 'Stok Habis' : 'Tambah ke Keranjang'}
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}





