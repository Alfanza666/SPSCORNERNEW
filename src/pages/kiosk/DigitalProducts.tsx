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
  Tv,
  Info
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
  
  if (b.includes('mobile legends')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/2/21/Mobile_Legends_Bang_Bang_logo.png/220px-Mobile_Legends_Bang_Bang_logo.png';
  if (b.includes('free fire')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/3/30/Free_Fire_logo.svg/220px-Free_Fire_logo.svg.png';
  if (b.includes('pubg')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/4/44/PlayerUnknown%27s_Battlegrounds_logo.svg/300px-PlayerUnknown%27s_Battlegrounds_logo.svg.png';
  if (b.includes('genshin')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5d/Genshin_Impact_logo.svg/300px-Genshin_Impact_logo.svg.png';
  if (b.includes('valorant')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo_-_pink_color_version.svg/250px-Valorant_logo_-_pink_color_version.svg.png';
  if (b.includes('steam')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/200px-Steam_icon_logo.svg.png';
  if (b.includes('garena')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/6/69/Garena_logo.svg/220px-Garena_logo.svg.png';
  if (b.includes('call of duty')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Call_of_Duty_Logo.svg/300px-Call_of_Duty_Logo.svg.png';
  
  if (category === 'Pulsa' || category === 'Data') return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=400';
  if (category === 'Games') return 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=400';
  if (category === 'PLN') return 'https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_PLN.png';
  
  return 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=400';
};

const getGameInputFields = (brand: string, categoryId?: string) => {
  const b = brand.toLowerCase();
  if (b.includes('mobile legends')) {
    return [
      { id: 'userId', label: 'User ID', placeholder: 'Contoh: 12345678', type: 'text' },
      { id: 'zoneId', label: 'Zone ID', placeholder: 'Contoh: 1234', type: 'text' }
    ];
  }
  if (b.includes('genshin')) {
    return [
      { id: 'userId', label: 'User ID', placeholder: 'Contoh: 800123456', type: 'text' },
      { id: 'server', label: 'Server', placeholder: 'Pilih Server', type: 'select', options: ['os_asia', 'os_usa', 'os_euro', 'os_cht'] }
    ];
  }
  if (b.includes('valorant')) {
    return [
      { id: 'riotId', label: 'Riot ID', placeholder: 'Contoh: Username#1234', type: 'text' }
    ];
  }
  if (b.includes('free fire') || b.includes('pubg') || b.includes('point blank') || b.includes('call of duty')) {
    return [
      { id: 'playerId', label: 'Player ID', placeholder: 'Masukkan Player ID', type: 'text' }
    ];
  }
  
  if (categoryId === 'e-money') {
    return [
      { id: 'phone', label: `Nomor HP / ID ${brand}`, placeholder: 'Contoh: 081234567890', type: 'text' }
    ];
  }

  // Default for vouchers
  return [
    { id: 'phone', label: 'Nomor HP (Untuk pengiriman kode)', placeholder: 'Contoh: 081234567890', type: 'text' }
  ];
};

const getCombinedTargetNumber = (brand: string, inputs: Record<string, string>) => {
  const b = brand.toLowerCase();
  if (b.includes('mobile legends')) {
    return `${inputs.userId || ''}${inputs.zoneId || ''}`;
  }
  if (b.includes('genshin')) {
    return `${inputs.userId || ''}${inputs.server || ''}`;
  }
  if (b.includes('valorant')) {
    return inputs.riotId || '';
  }
  if (b.includes('free fire') || b.includes('pubg') || b.includes('point blank') || b.includes('call of duty')) {
    return inputs.playerId || '';
  }
  return inputs.phone || '';
};

export default function DigitalProducts() {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  
  const [selectedCategory, setSelectedCategory] = useState<DigitalCategory | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [targetNumber, setTargetNumber] = useState('');
  const [gameInputs, setGameInputs] = useState<Record<string, string>>({});
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
    } catch (error: any) {
      console.error('Error fetching digital products:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Terjadi kesalahan jaringan';
      toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
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
      } else if (selectedCategory?.id === 'e-money' && selectedBrand) {
        endpoint = '/api/digital/inquiry-ewallet';
        payload = { customer_no: targetNumber, brand: selectedBrand };
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
          const errorMsg = response.data.error || 'Data tidak ditemukan';
          toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        }
      }
    } catch (error: any) {
      console.error('Inquiry Error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Gagal melakukan pengecekan';
      toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setInquiryLoading(false);
    }
  };

  const handleCategoryClick = (cat: DigitalCategory) => {
    setSelectedCategory(cat);
    setSelectedBrand(null);
    setTargetNumber('');
    setGameInputs({});
    setSearchQuery('');
    fetchProducts(cat.apiCategory);
  };

  const handleBack = () => {
    if (selectedBrand) {
      setSelectedBrand(null);
      setTargetNumber('');
      setGameInputs({});
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setProducts([]);
    } else {
      navigate('/kiosk');
    }
  };

  const handleBuy = (product: any) => {
    const isBrandCategory = ['game', 'e-money'].includes(selectedCategory?.id || '');
    let finalTargetNumber = isBrandCategory ? getCombinedTargetNumber(product.brand, gameInputs) : targetNumber;
    
    if (isBrandCategory) {
      if (!finalTargetNumber) {
        toast.error('Lengkapi data tujuan terlebih dahulu');
        return;
      }
      // Basic validation for ML
      if (product.brand.toLowerCase().includes('mobile legends')) {
        if (!gameInputs.userId || !gameInputs.zoneId) {
          toast.error('User ID dan Zone ID harus diisi');
          return;
        }
      }
      if (product.brand.toLowerCase().includes('genshin')) {
        if (!gameInputs.userId || !gameInputs.server) {
          toast.error('User ID dan Server harus diisi');
          return;
        }
      }
    } else {
      if (!targetNumber) {
        toast.error('Masukkan nomor tujuan terlebih dahulu');
        return;
      }
    }

    addItem({
      id: `digital-${product.buyer_sku_code}-${Date.now()}`,
      seller_id: 'DIGIFLAZZ', // System seller
      name: product.product_name,
      price: product.price,
      stock: 999,
      image_url: getProductLogo(product.brand, selectedCategory?.name || ''),
      is_digital: true,
      target_number: finalTargetNumber,
      sku: product.buyer_sku_code,
      category: selectedCategory?.name,
      metadata: {
        is_digital: true,
        is_postpaid: ['PDAM', 'BPJS', 'Internet'].includes(selectedCategory?.name || ''),
        sku: product.buyer_sku_code,
        target_number: finalTargetNumber,
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
    if (['game', 'e-money'].includes(selectedCategory?.id || '') && selectedBrand) {
      if (p.brand !== selectedBrand) return false;
    }
    
    const matchesSearch = p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.brand.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (detectedProvider && selectedCategory?.id !== 'game') {
      return p.brand.toUpperCase().includes(detectedProvider) && matchesSearch;
    }
    
    return matchesSearch;
  });

  const uniqueBrands = Array.from(new Set(products.map(p => p.brand as string))).sort() as string[];

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
                {['game', 'e-money'].includes(selectedCategory?.id || '') ? (
                  !selectedBrand ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {uniqueBrands.map(brand => (
                        <button
                          key={brand}
                          onClick={() => setSelectedBrand(brand)}
                          className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm text-center hover:ring-2 hover:ring-blue-500 transition-all"
                        >
                          <img src={getProductLogo(brand, selectedCategory?.apiCategory || '')} alt={brand} className="w-16 h-16 mx-auto mb-3 object-contain rounded-xl" referrerPolicy="no-referrer" />
                          <h3 className="font-bold text-slate-900 dark:text-white text-xs md:text-sm">{brand}</h3>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-4 mb-6">
                        <img src={getProductLogo(selectedBrand, selectedCategory?.apiCategory || '')} alt={selectedBrand} className="w-12 h-12 object-contain rounded-lg" referrerPolicy="no-referrer" />
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedBrand}</h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getGameInputFields(selectedBrand, selectedCategory?.id).map(field => (
                          <div key={field.id}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                              {field.label}
                            </label>
                            {field.type === 'select' ? (
                              <select
                                value={gameInputs[field.id] || ''}
                                onChange={(e) => setGameInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                              >
                                <option value="">Pilih Server</option>
                                {field.options?.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={gameInputs[field.id] || ''}
                                onChange={(e) => setGameInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                                placeholder={field.placeholder}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                      Nomor Tujuan / ID Pelanggan
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={targetNumber}
                          onChange={(e) => {
                            setTargetNumber(e.target.value.replace(/[^0-9]/g, ''));
                            setInquiryResult(null);
                          }}
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
                      {(['pln', 'pdam', 'bpjs', 'internet'].includes(selectedCategory?.id || '') || (selectedCategory?.id === 'e-money' && selectedBrand)) && (
                        <button
                          onClick={handleInquiry}
                          disabled={inquiryLoading || !targetNumber}
                          className="px-6 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 flex flex-col items-center justify-center whitespace-nowrap"
                        >
                          {inquiryLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <>
                              <span>Cek</span>
                              {selectedCategory?.id === 'e-money' && <span className="text-[10px] font-normal opacity-80">(Gratis)</span>}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {inquiryResult && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl"
                  >
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">Data Pelanggan</div>
                    <div className="text-lg font-black text-emerald-900 dark:text-emerald-100">
                      {typeof inquiryResult.name === 'string' ? inquiryResult.name : JSON.stringify(inquiryResult.name)}
                    </div>
                    {inquiryResult.segment_power && (
                      <div className="text-sm text-emerald-700 dark:text-emerald-300">
                        {typeof inquiryResult.segment_power === 'string' ? inquiryResult.segment_power : JSON.stringify(inquiryResult.segment_power)}
                      </div>
                    )}
                  </motion.div>
                )}

                {selectedCategory?.id === 'e-money' && selectedBrand && (selectedBrand.toLowerCase().includes('mandiri') || selectedBrand.toLowerCase().includes('e-toll') || selectedBrand.toLowerCase().includes('brizzi') || selectedBrand.toLowerCase().includes('tapcash')) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex gap-3 items-start"
                  >
                    <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <span className="font-bold block mb-1">Informasi Penting E-Toll</span>
                      Pembelian ini hanya mengisi <strong>saldo tertunda (pending balance)</strong>. Anda <strong>wajib</strong> melakukan update saldo dengan menempelkan kartu pada perangkat ber-NFC (seperti ATM, EDC, atau aplikasi mobile banking di HP ber-NFC) agar saldo masuk ke dalam kartu.
                    </div>
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
                (selectedCategory?.id !== 'game' || selectedBrand) && (
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
                          disabled={selectedCategory?.id === 'game' ? false : !targetNumber}
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
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
