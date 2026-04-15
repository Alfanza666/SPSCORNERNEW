import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, Wifi, Zap, Gamepad2, Wallet,
  ArrowLeft, Search, Loader2, ShoppingCart,
  Droplets, Activity, Tv, Info, CheckCircle2
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
  { id: 'pln', name: 'Token & Tagihan PLN', icon: Zap, description: 'Listrik prabayar & pascabayar', color: 'bg-amber-500', apiCategory: 'PLN' },
  { id: 'game', name: 'Voucher Game', icon: Gamepad2, description: 'Top up game favorit', color: 'bg-purple-500', apiCategory: 'Games' },
  { id: 'e-money', name: 'E-Money', icon: Wallet, description: 'Top up saldo dompet digital', color: 'bg-indigo-500', apiCategory: 'E-Money' },
  { id: 'pdam', name: 'PDAM', icon: Droplets, description: 'Bayar tagihan air', color: 'bg-cyan-500', apiCategory: 'PDAM' },
  { id: 'bpjs', name: 'BPJS', icon: Activity, description: 'Bayar iuran kesehatan', color: 'bg-red-500', apiCategory: 'BPJS' },
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
  if (['0895', '0896', '0897', '0898', '0899'].includes(prefix)) return 'THREE'; // Digiflazz uses THREE
  return '';
};

const getProductLogo = (brand: string, category: string) => {
  const b = (brand || '').toLowerCase();
  
  // Pulsa & Data
  if (b.includes('telkomsel')) return 'https://logo.clearbit.com/telkomsel.com';
  if (b.includes('indosat')) return 'https://logo.clearbit.com/indosatooredoo.com';
  if (b.includes('xl')) return 'https://logo.clearbit.com/xl.co.id';
  if (b.includes('axis')) return 'https://logo.clearbit.com/axis.co.id';
  if (b.includes('smartfren')) return 'https://logo.clearbit.com/smartfren.com';
  if (b.includes('tri') || b.includes('three')) return 'https://logo.clearbit.com/tri.co.id';
  if (b.includes('by.u') || b.includes('byu')) return 'https://logo.clearbit.com/byu.id';
  
  // PLN & Utilities
  if (b.includes('pln') || b.includes('listrik')) return 'https://logo.clearbit.com/pln.co.id';
  if (b.includes('pdam') || b.includes('air')) return 'https://logo.clearbit.com/pdamtirtanadi.co.id';
  if (b.includes('bpjs')) return 'https://logo.clearbit.com/bpjs-kesehatan.go.id';
  if (b.includes('indihome') || b.includes('telkom')) return 'https://logo.clearbit.com/indihome.co.id';
  
  // E-Wallet & E-Money
  if (b.includes('gopay') || b.includes('go-pay') || b.includes('gojek')) return 'https://logo.clearbit.com/gopay.co.id';
  if (b.includes('ovo')) return 'https://logo.clearbit.com/ovo.id';
  if (b.includes('dana')) return 'https://logo.clearbit.com/dana.id';
  if (b.includes('shopee')) return 'https://logo.clearbit.com/shopee.co.id';
  if (b.includes('linkaja')) return 'https://logo.clearbit.com/linkaja.id';
  if (b.includes('isaku') || b.includes('i.saku')) return 'https://logo.clearbit.com/klikindomaret.com';
  if (b.includes('brizzi')) return 'https://logo.clearbit.com/bri.co.id';
  if (b.includes('tapcash')) return 'https://logo.clearbit.com/bni.co.id';
  if (b.includes('flazz')) return 'https://logo.clearbit.com/bca.co.id';
  if (b.includes('emoney') || b.includes('e-money') || b.includes('mandiri')) return 'https://logo.clearbit.com/bankmandiri.co.id';
  if (b.includes('grab')) return 'https://logo.clearbit.com/grab.com';
  if (b.includes('maxim')) return 'https://logo.clearbit.com/taximaxim.com';
  
  // Games & Entertainment
  if (b.includes('mobile legends')) return 'https://logo.clearbit.com/mobilelegends.com';
  if (b.includes('free fire')) return 'https://logo.clearbit.com/ff.garena.com';
  if (b.includes('pubg')) return 'https://logo.clearbit.com/pubgmobile.com';
  if (b.includes('genshin')) return 'https://logo.clearbit.com/genshin.hoyoverse.com';
  if (b.includes('valorant')) return 'https://logo.clearbit.com/playvalorant.com';
  if (b.includes('point blank')) return 'https://logo.clearbit.com/pointblank.id';
  if (b.includes('call of duty') || b.includes('codm')) return 'https://logo.clearbit.com/callofduty.com';
  if (b.includes('arena of valor') || b.includes('aov')) return 'https://logo.clearbit.com/aov.garena.co.id';
  if (b.includes('steam')) return 'https://logo.clearbit.com/steampowered.com';
  if (b.includes('garena')) return 'https://logo.clearbit.com/garena.com';
  if (b.includes('google play')) return 'https://logo.clearbit.com/play.google.com';
  if (b.includes('spotify')) return 'https://logo.clearbit.com/spotify.com';
  if (b.includes('netflix')) return 'https://logo.clearbit.com/netflix.com';
  if (b.includes('vidio')) return 'https://logo.clearbit.com/vidio.com';
  
  // Fallbacks based on category
  if (category === 'Pulsa' || category === 'Data') return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=400';
  if (category === 'Games') return 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=400';
  if (category === 'PLN') return 'https://logo.clearbit.com/pln.co.id';
  if (category === 'E-Money') return 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=400';
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(brand || category || 'Produk')}&background=random&color=fff&rounded=true`;
};

const getGameInputFields = (brand: string) => {
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
  return [
    { id: 'phone', label: 'Nomor HP (Untuk pengiriman kode)', placeholder: 'Contoh: 081234567890', type: 'text' }
  ];
};

const getCombinedTargetNumber = (brand: string, inputs: Record<string, string>) => {
  const b = brand.toLowerCase();
  if (b.includes('mobile legends')) return `${inputs.userId || ''}${inputs.zoneId || ''}`;
  if (b.includes('genshin')) return `${inputs.userId || ''}${inputs.server || ''}`;
  if (b.includes('valorant')) return inputs.riotId || '';
  if (b.includes('free fire') || b.includes('pubg') || b.includes('point blank') || b.includes('call of duty')) return inputs.playerId || '';
  return inputs.phone || '';
};

export default function DigitalProducts() {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  
  const [selectedCategory, setSelectedCategory] = useState<DigitalCategory | null>(null);
  const [targetNumber, setTargetNumber] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [plnType, setPlnType] = useState<'prabayar' | 'pascabayar'>('prabayar');
  const [gameInputs, setGameInputs] = useState<Record<string, string>>({});
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [inquiryResult, setInquiryResult] = useState<any>(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);

  const fetchProducts = async (cat: DigitalCategory, type: 'prepaid' | 'postpaid' = 'prepaid') => {
    setLoading(true);
    try {
      const response = await axios.post('/api/digital/prices', {
        category: cat.apiCategory,
        type: type
      });
      if (response.data.success) {
        const activeProducts = response.data.data
          .filter((p: any) => p.buyer_product_status === true && p.seller_product_status === true)
          .map((p: any) => ({
            ...p,
            // Tambahkan margin keuntungan Rp 2.000 untuk setiap produk prabayar
            price: type === 'prepaid' ? p.price + 2000 : p.price
          }))
          .sort((a: any, b: any) => a.price - b.price);
        setProducts(activeProducts);
      } else {
        toast.error('Gagal mengambil data produk');
      }
    } catch (error: any) {
      console.error('Error fetching digital products:', error);
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (cat: DigitalCategory) => {
    setSelectedCategory(cat);
    setTargetNumber('');
    setSelectedBrand(null);
    setPlnType('prabayar');
    setGameInputs({});
    setInquiryResult(null);
    setProducts([]);
    setSearchQuery('');

    if (cat.id === 'pln') {
      fetchProducts(cat, 'prepaid');
    } else {
      fetchProducts(cat, ['pdam', 'bpjs', 'internet'].includes(cat.id) ? 'postpaid' : 'prepaid');
    }
  };

  const handleBack = () => {
    if (selectedCategory) {
      setSelectedCategory(null);
      setInquiryResult(null);
    } else {
      navigate('/kiosk');
    }
  };

  const handlePlnTypeChange = (type: 'prabayar' | 'pascabayar') => {
    setPlnType(type);
    setTargetNumber('');
    setInquiryResult(null);
    fetchProducts(selectedCategory!, type === 'prabayar' ? 'prepaid' : 'postpaid');
  };

  const handleInquiry = async () => {
    if (!targetNumber) {
      toast.error('Masukkan ID Pelanggan / No Meter');
      return;
    }

    setInquiryLoading(true);
    setInquiryResult(null);
    try {
      let endpoint = '/api/digital/inquiry-pasca';
      let payload: any = { customer_no: targetNumber, buyer_sku_code: selectedBrand };

      if (selectedCategory?.id === 'pln') {
        endpoint = '/api/digital/inquiry-pln';
        payload = { customer_no: targetNumber };
      }

      const response = await axios.post(endpoint, payload);
      if (response.data.success) {
        setInquiryResult(response.data.data);
      } else {
        toast.error(response.data.error || 'Data tidak ditemukan');
      }
    } catch (error) {
      toast.error('Gagal melakukan pengecekan tagihan');
    } finally {
      setInquiryLoading(false);
    }
  };

  const handleBuyPrepaid = (product: any) => {
    let finalTarget = targetNumber;
    if (selectedCategory?.id === 'game' && selectedBrand) {
      finalTarget = getCombinedTargetNumber(selectedBrand, gameInputs);
    }

    if (!finalTarget) {
      toast.error('Lengkapi data tujuan terlebih dahulu');
      return;
    }

    addItem({
      id: `digital-${product.buyer_sku_code}-${Date.now()}`,
      seller_id: 'DIGIFLAZZ',
      name: product.product_name,
      price: product.price,
      stock: 999,
      image_url: getProductLogo(product.brand, selectedCategory?.name || ''),
      is_digital: true,
      target_number: finalTarget,
      sku: product.buyer_sku_code,
      category: selectedCategory?.name,
      metadata: {
        is_digital: true,
        is_postpaid: false,
        sku: product.buyer_sku_code,
        target_number: finalTarget,
      }
    });

    toast.success(`${product.product_name} ditambahkan ke keranjang`);
    navigate('/kiosk/cart');
  };

  const handleBuyPostpaid = (totalAmount: number) => {
    if (!inquiryResult) return;
    
    let product = products.find(p => p.buyer_sku_code === selectedBrand);
    if (selectedCategory?.id === 'pln') {
       product = products.find(p => p.brand.toLowerCase().includes('pln'));
    }
    if (!product && products.length > 0) product = products[0];

    const sku = product ? product.buyer_sku_code : (selectedCategory?.id === 'pln' ? 'PLNPOST' : 'POSTPAID');
    const brand = product ? product.brand : selectedCategory?.name;

    addItem({
      id: `digital-post-${Date.now()}`,
      seller_id: 'DIGIFLAZZ',
      name: `Tagihan ${selectedCategory?.name} - ${targetNumber}`,
      price: totalAmount,
      stock: 999,
      image_url: getProductLogo(brand || '', selectedCategory?.name || ''),
      is_digital: true,
      target_number: targetNumber,
      sku: sku,
      category: selectedCategory?.name,
      metadata: {
        is_digital: true,
        is_postpaid: true,
        sku: sku,
        target_number: targetNumber,
        customer_name: inquiryResult.name || inquiryResult.customer_name,
        inquiry_data: inquiryResult
      }
    });

    toast.success(`Tagihan ditambahkan ke keranjang`);
    navigate('/kiosk/cart');
  };

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];
    let filtered = products;

    if (selectedCategory.id === 'pulsa' || selectedCategory.id === 'data') {
      if (targetNumber.length >= 4) {
        const provider = getProviderFromNumber(targetNumber);
        if (provider) {
          filtered = products.filter(p => {
            if (!p.brand) return false;
            const brandUpper = p.brand.toUpperCase();
            if (provider === 'THREE') {
              return brandUpper.includes('THREE') || brandUpper.includes('TRI');
            }
            return brandUpper.includes(provider);
          });
        } else {
          filtered = []; // Don't show products if provider is unknown
        }
      } else {
        filtered = []; // Don't show products until 4 digits are entered
      }
    } else if (selectedCategory.id === 'game' || selectedCategory.id === 'e-money') {
      if (selectedBrand) {
        filtered = products.filter(p => p.brand === selectedBrand);
      } else {
        filtered = [];
      }
    }

    // Filter out "Cek Nama" or Inquiry products
    filtered = filtered.filter(p => {
      const name = (p.product_name || '').toLowerCase();
      const sku = (p.buyer_sku_code || '').toUpperCase();
      // Exclude products that are just for checking names
      if (name.includes('cek nama') || name.includes('cek ') || name.startsWith('cek')) return false;
      if (sku.startsWith('CEK')) return false;
      return true;
    });

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.product_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [products, selectedCategory, targetNumber, selectedBrand, searchQuery]);

  const uniqueBrands = useMemo(() => {
    // Filter out brands that only have "Cek" products
    const validProducts = products.filter(p => {
      const name = (p.product_name || '').toLowerCase();
      const sku = (p.buyer_sku_code || '').toUpperCase();
      if (name.includes('cek nama') || name.includes('cek ') || name.startsWith('cek')) return false;
      if (sku.startsWith('CEK')) return false;
      return true;
    });
    return Array.from(new Set(validProducts.map(p => p.brand as string))).sort() as string[];
  }, [products]);

  const renderInputSection = () => {
    if (!selectedCategory) return null;

    if (selectedCategory.id === 'pulsa' || selectedCategory.id === 'data') {
      return (
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">
            Nomor HP
          </label>
          <input
            type="tel"
            value={targetNumber}
            onChange={(e) => setTargetNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="Contoh: 081234567890"
            className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl focus:border-blue-500 outline-none transition-all dark:text-white text-lg font-medium"
          />
          {targetNumber.length >= 4 && (
            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
              Provider terdeteksi: {getProviderFromNumber(targetNumber) || 'Tidak diketahui'}
            </p>
          )}
        </div>
      );
    }

    if (selectedCategory.id === 'pln') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handlePlnTypeChange('prabayar')}
              className={`p-4 rounded-2xl border-2 font-bold transition-all ${
                plnType === 'prabayar' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                  : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-blue-300'
              }`}
            >
              Token Listrik (Prabayar)
            </button>
            <button
              onClick={() => handlePlnTypeChange('pascabayar')}
              className={`p-4 rounded-2xl border-2 font-bold transition-all ${
                plnType === 'pascabayar' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                  : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-blue-300'
              }`}
            >
              Tagihan Listrik (Pascabayar)
            </button>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">
              ID Pelanggan / No Meter
            </label>
            <input
              type="text"
              value={targetNumber}
              onChange={(e) => setTargetNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="Masukkan ID Pelanggan"
              className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl focus:border-blue-500 outline-none transition-all dark:text-white text-lg font-medium"
            />
          </div>
          {plnType === 'pascabayar' && (
            <button
              onClick={handleInquiry}
              disabled={!targetNumber || inquiryLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 text-white rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              {inquiryLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Cek Tagihan'}
            </button>
          )}
        </div>
      );
    }

    if (selectedCategory.id === 'game' || selectedCategory.id === 'e-money') {
      if (!selectedBrand) {
        return (
          <div>
            <h3 className="font-bold text-slate-700 dark:text-zinc-300 mb-4">
              Pilih {selectedCategory.id === 'game' ? 'Game' : 'E-Money'}
            </h3>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {uniqueBrands.map(brand => (
                  <button
                    key={brand}
                    onClick={() => setSelectedBrand(brand)}
                    className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all text-center"
                  >
                    <div className="w-16 h-16 mx-auto mb-3 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center p-2">
                      <img 
                        src={getProductLogo(brand, selectedCategory.name)} 
                        alt={brand} 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(brand)}&background=random&color=fff&rounded=true` }}
                      />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">{brand}</h3>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <img 
              src={getProductLogo(selectedBrand, selectedCategory.name)} 
              alt={selectedBrand} 
              className="w-12 h-12 object-contain rounded-lg" 
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedBrand)}&background=random&color=fff&rounded=true` }}
            />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedBrand}</h2>
            <button onClick={() => setSelectedBrand(null)} className="ml-auto text-sm text-blue-600 hover:underline">Ubah</button>
          </div>
          
          {selectedCategory.id === 'game' ? (
            getGameInputFields(selectedBrand).map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={gameInputs[field.id] || ''}
                    onChange={(e) => setGameInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-blue-500 outline-none dark:text-white"
                  >
                    <option value="">Pilih Server</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={gameInputs[field.id] || ''}
                    onChange={(e) => setGameInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-blue-500 outline-none dark:text-white"
                  />
                )}
              </div>
            ))
          ) : (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">Nomor HP / ID</label>
              <input
                type="text"
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 081234567890"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white text-lg font-medium"
              />
            </div>
          )}
        </div>
      );
    }

    if (['pdam', 'bpjs', 'internet'].includes(selectedCategory.id)) {
      return (
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">Penyedia Layanan</label>
                <select
                  value={selectedBrand || ''}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white text-base font-medium"
                >
                  <option value="">Pilih Penyedia Layanan</option>
                  {products.map(p => (
                    <option key={p.buyer_sku_code} value={p.buyer_sku_code}>{p.product_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3">Nomor Pelanggan</label>
                <input
                  type="text"
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Masukkan Nomor Pelanggan"
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl focus:border-blue-500 outline-none dark:text-white text-lg font-medium"
                />
              </div>
              <button
                onClick={handleInquiry}
                disabled={!selectedBrand || !targetNumber || inquiryLoading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 text-white rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
              >
                {inquiryLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Cek Tagihan'}
              </button>
            </>
          )}
        </div>
      );
    }

    return null;
  };

  const renderProductsSection = () => {
    if (!selectedCategory) return null;

    // Postpaid Bill View
    if (inquiryResult) {
      // Add markup for postpaid (e.g., Rp 2.500 admin fee)
      const adminFee = 2500;
      const totalAmount = (inquiryResult.price || 0) + adminFee;

      return (
        <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2rem] shadow-sm space-y-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tagihan Ditemukan</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Periksa kembali detail tagihan Anda</p>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-6 space-y-4 border border-slate-100 dark:border-zinc-800">
            <div className="flex justify-between border-b border-slate-200 dark:border-zinc-700 pb-3">
              <span className="text-slate-500 dark:text-zinc-400">Nama Pelanggan</span>
              <span className="font-bold text-slate-900 dark:text-white text-right">{inquiryResult.name || inquiryResult.customer_name || '-'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-zinc-700 pb-3">
              <span className="text-slate-500 dark:text-zinc-400">No. Pelanggan</span>
              <span className="font-bold text-slate-900 dark:text-white text-right">{inquiryResult.customer_no || targetNumber}</span>
            </div>
            {inquiryResult.segment_power && (
              <div className="flex justify-between border-b border-slate-200 dark:border-zinc-700 pb-3">
                <span className="text-slate-500 dark:text-zinc-400">Tarif/Daya</span>
                <span className="font-bold text-slate-900 dark:text-white text-right">{inquiryResult.segment_power}</span>
              </div>
            )}
            <div className="flex justify-between border-b border-slate-200 dark:border-zinc-700 pb-3">
              <span className="text-slate-500 dark:text-zinc-400">Tagihan</span>
              <span className="font-bold text-slate-900 dark:text-white text-right">Rp {inquiryResult.price?.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-zinc-700 pb-3">
              <span className="text-slate-500 dark:text-zinc-400">Biaya Admin</span>
              <span className="font-bold text-slate-900 dark:text-white text-right">Rp {adminFee.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-700 dark:text-zinc-300 font-bold">Total Bayar</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 text-xl">Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={() => setInquiryResult(null)}
              className="flex-1 py-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-2xl font-bold transition-all"
            >
              Batal
            </button>
            <button
              onClick={() => handleBuyPostpaid(totalAmount)}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              Bayar Sekarang
            </button>
          </div>
        </div>
      );
    }

    // Prepaid Products View
    // Only show if it's a prepaid category and we have enough info
    const isPrepaidView = 
      (selectedCategory.id === 'pulsa' || selectedCategory.id === 'data') || 
      (selectedCategory.id === 'pln' && plnType === 'prabayar') ||
      ((selectedCategory.id === 'game' || selectedCategory.id === 'e-money') && selectedBrand);

    if (!isPrepaidView) return null;

    return (
      <div className="space-y-6 mt-6">
        <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Pilih Produk</p>
              <p className="font-bold text-slate-900 dark:text-white">
                {filteredProducts.length} produk tersedia
              </p>
            </div>
          </div>
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:border-blue-500 outline-none dark:text-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div key={product.buyer_sku_code} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug mb-2">{product.product_name}</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{product.desc || ''}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium mb-0.5">Harga</p>
                    <p className="font-black text-blue-600 dark:text-blue-400 text-lg">Rp {product.price.toLocaleString('id-ID')}</p>
                  </div>
                  <button
                    onClick={() => handleBuyPrepaid(product)}
                    className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <ShoppingCart className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl">
            <p className="text-slate-500 dark:text-zinc-400">
              {(selectedCategory.id === 'pulsa' || selectedCategory.id === 'data') && targetNumber.length < 4 
                ? 'Masukkan minimal 4 digit nomor HP untuk melihat produk' 
                : 'Tidak ada produk yang tersedia'}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <button 
              onClick={handleBack}
              className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all hover:-translate-x-1"
            >
              <ArrowLeft className="w-6 h-6 text-slate-700 dark:text-zinc-300" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                {selectedCategory ? selectedCategory.name : 'Produk Digital'}
              </h1>
              <p className="text-slate-500 dark:text-zinc-400 font-medium">
                {!selectedCategory && 'Pilih kategori layanan yang Anda butuhkan'}
                {selectedCategory && 'Lengkapi data tujuan Anda'}
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
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className="group relative bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400 shadow-sm text-left overflow-hidden transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative z-10 overflow-hidden ${cat.color}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                    <cat.icon className="w-7 h-7 text-white relative z-10" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="font-black text-lg text-slate-900 dark:text-white mb-1.5 tracking-tight group-hover:text-blue-600 transition-colors">{cat.name}</h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{cat.description}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2rem] shadow-sm">
                {renderInputSection()}
              </div>
              {renderProductsSection()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
