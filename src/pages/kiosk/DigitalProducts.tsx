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
  ShoppingCart,
  Droplets,
  HeartPulse,
  Tv
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
  { id: 'pdam', name: 'PDAM', icon: Droplets, description: 'Bayar tagihan air', color: 'bg-cyan-500', apiCategory: 'PDAM' },
  { id: 'bpjs', name: 'BPJS', icon: HeartPulse, description: 'Bayar iuran kesehatan', color: 'bg-red-500', apiCategory: 'BPJS' },
  { id: 'internet', name: 'Internet & TV', icon: Tv, description: 'Indihome, CBN, dll', color: 'bg-orange-500', apiCategory: 'Internet' },
];

const getProviderFromNumber = (number: string): string => {
  if (!number || number.length < 4) return '';
  
  const prefix = number.substring(0, 4);
  
  if (['0811', '0812', '0813', '0821', '0822', '0823', '0852', '0853', '0851'].includes(prefix)) return 'TELKOMSEL';
  if (['0814', '0815', '0816', '0855', '0856', '0857', '0858'].includes(prefix)) return 'INDOSAT';
  if (['0817', '0818', '0819', '0859', '0877', '0878'].includes(prefix)) return 'XL';
  if (['0831', '0832', '0833', '0838'].includes(prefix)) return 'AXIS';
  if (['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'].includes(prefix)) return 'SMARTFREN';
  if (['0895', '0896', '0897', '0898', '0899'].includes(prefix)) return 'TRI';
  
  return '';
};

const getProductLogo = (brand: string, category: string) => {
  const b = brand.toLowerCase();
  if (b.includes('telkomsel')) return 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Telkomsel_2021_icon.svg';
  if (b.includes('indosat')) return 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Logo_Indosat_Ooredoo_Hutchison.svg';
  if (b.includes('xl')) return 'https://upload.wikimedia.org/wikipedia/commons/9/9a/XL_Axiata_logo_2016.svg';
  if (b.includes('axis')) return 'https://upload.wikimedia.org/wikipedia/commons/8/83/Axis_logo_2015.svg';
  if (b.includes('smartfren')) return 'https://upload.wikimedia.org/wikipedia/commons/1/14/Smartfren_Logo.svg';
  if (b.includes('tri') || b.includes('three')) return 'https://upload.wikimedia.org/wikipedia/commons/4/40/Tiga_logo.svg';
  if (b.includes('pln')) return 'https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_PLN.png';
  if (b.includes('gopay')) return 'https://upload.wikimedia.org/wikipedia/commons/8/86/Gopay_logo.svg';
  if (b.includes('ovo')) return 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Logo_ovo_purple.svg';
  if (b.includes('dana')) return 'https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg';
  if (b.includes('shopee')) return 'https://upload.wikimedia.org/wikipedia/commons/f/fe/ShopeePay_Logo.png';
  if (b.includes('linkaja')) return 'https://upload.wikimedia.org/wikipedia/commons/8/85/LinkAja.svg';
  
  if (category === 'Pulsa' || category === 'Data') return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=400';
  if (category === 'Games') return 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=400';
  if (category === 'PLN') return 'https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_PLN.png';
  
  return 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=400';
};

export default function DigitalProducts() {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  
  const [selectedCategory, setSelectedCategory] = useState<DigitalCategory | null>(null);
  const [targetNumber, setTargetNumber] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inquiryResult, setInquiryResult] = useState<any>(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);

  const fetchProducts = async (categoryName: string) => {
    setLoading(true);
    setInquiryResult(null);
    try {
      const response = await axios.post('/api/digital/prices', {
        category: categoryName,
        type: ['PDAM', 'BPJS', 'Internet'].includes(categoryName) ? 'postpaid' : 'prepaid'
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

  const handleInquiry = async () => {
    if (!targetNumber) {
      toast.error('Masukkan nomor tujuan/ID pelanggan');
      return;
    }

    setInquiryLoading(true);
    setInquiryResult(null);
    try {
      let endpoint = '';
      let payload = {};

      if (selectedCategory?.id === 'pln') {
        endpoint = '/api/digital/inquiry-pln';
        payload = { customer_no: targetNumber };
      } else if (['pdam', 'bpjs', 'internet'].includes(selectedCategory?.id || '')) {
        // For postpaid, we might need a specific SKU to inquire
        // But usually we inquire first to get the bill
        // For now let's just support PLN inquiry as it's explicitly in the PDF
        endpoint = '/api/digital/inquiry-pln'; // Fallback or placeholder
        payload = { customer_no: targetNumber };
      }

      if (endpoint) {
        const response = await axios.post(endpoint, payload);
        if (response.data.success) {
          setInquiryResult(response.data.data);
          toast.success('Data pelanggan ditemukan');
        } else {
          toast.error(response.data.error || 'Data tidak ditemukan');
        }
      }
    } catch (error: any) {
      console.error('Inquiry Error:', error);
      toast.error(error.response?.data?.error || 'Gagal melakukan pengecekan');
    } finally {
      setInquiryLoading(false);
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
      image_url: getProductLogo(product.brand, selectedCategory?.name || ''),
      is_digital: true,
      target_number: targetNumber,
      sku: product.buyer_sku_code,
      category: selectedCategory?.name,
      metadata: {
        is_digital: true,
        is_postpaid: ['PDAM', 'BPJS', 'Internet'].includes(selectedCategory?.name || ''),
        sku: product.buyer_sku_code,
        target_number: targetNumber,
        customer_name: inquiryResult?.name || null,
        segment_power: inquiryResult?.segment_power || null
      }
    });

    toast.success(`${product.product_name} ditambahkan ke keranjang`);
    navigate('/kiosk/cart');
  };

  const detectedProvider = (selectedCategory?.id === 'pulsa' || selectedCategory?.id === 'data') 
    ? getProviderFromNumber(targetNumber) 
    : '';

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.brand.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (detectedProvider) {
      return p.brand.toUpperCase().includes(detectedProvider) && matchesSearch;
    }
    
    return matchesSearch;
  });

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
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Nomor Tujuan / ID Pelanggan
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={targetNumber}
                        onChange={(e) => setTargetNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Contoh: 081234567890"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white text-lg tracking-wide"
                      />
                      {detectedProvider && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <img 
                            src={getProductLogo(detectedProvider, selectedCategory?.name || '')} 
                            alt={detectedProvider} 
                            className="h-6 object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                    {['pln', 'pdam', 'bpjs', 'internet'].includes(selectedCategory?.id || '') && (
                      <button
                        onClick={handleInquiry}
                        disabled={inquiryLoading || !targetNumber}
                        className="px-6 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                      >
                        {inquiryLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cek'}
                      </button>
                    )}
                  </div>
                </div>

                {inquiryResult && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl"
                  >
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">Data Pelanggan</div>
                    <div className="text-lg font-black text-emerald-900 dark:text-emerald-100">{inquiryResult.name}</div>
                    {inquiryResult.segment_power && (
                      <div className="text-sm text-emerald-700 dark:text-emerald-300">{inquiryResult.segment_power}</div>
                    )}
                  </motion.div>
                )}
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
                        <div className="flex items-center gap-3 mb-2">
                          <img 
                            src={getProductLogo(product.brand, selectedCategory?.name || '')} 
                            alt={product.brand} 
                            className="w-8 h-8 object-contain rounded-md"
                            referrerPolicy="no-referrer"
                          />
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
