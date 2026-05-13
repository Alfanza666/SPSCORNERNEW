import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatRupiah } from '../../lib/utils';
import { Search, ShoppingBag, Package, Calendar, Clock, ArrowRight, ShieldCheck, CreditCard, ChevronRight, Loader2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';

const PICKUP_TYPE_LABELS: Record<string, string> = {
  same_day: 'Hari Ini',
  next_day: 'Besok',
  custom_days: 'Kustom',
};

export default function PreOrder() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [buyerName, setBuyerName] = useState(user?.name || '');
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || '');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pre_order_configs')
        .select('*, products(id, name, price, image_url, category, description, is_active), profiles:seller_id(name)')
        .eq('is_active', true);

      if (error) throw error;
      
      // Filter only where product is active
      const validConfigs = (data || []).filter(c => c.products?.is_active);
      setConfigs(validConfigs);
    } catch (error: any) {
      toast.error('Gagal memuat produk Pre-Order: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutPO = async () => {
    if (!buyerName || !buyerPhone) {
      toast.error('Nama dan Nomor HP wajib diisi');
      return;
    }
    setProcessing(true);
    try {
      // 1. Calculate pickup date based on config
      let pickupDate = new Date();
      if (selectedProduct.pickup_type === 'next_day') {
        pickupDate = addDays(pickupDate, 1);
      } else if (selectedProduct.pickup_type === 'custom_days') {
        pickupDate = addDays(pickupDate, selectedProduct.custom_days || 1);
      }

      // 2. Create Pre-Order record first
      const poData = {
        product_id: selectedProduct.product_id,
        seller_id: selectedProduct.seller_id,
        buyer_id: user?.id || null,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        quantity: quantity,
        total_price: selectedProduct.products.price * quantity,
        pickup_date: pickupDate.toISOString(),
        order_date: new Date().toISOString(),
        status: 'pending',
        notes: `PO dari Kiosk. Tipe: ${PICKUP_TYPE_LABELS[selectedProduct.pickup_type]}`
      };

      const { data: poRes, error: poErr } = await supabase.from('pre_orders').insert(poData).select().single();
      if (poErr) throw poErr;

      // For direct PO, we might want to integrate IPaymu or just consider it cash/transfer manual.
      // Since Kiosk Checkout goes to IPaymu, let's create a generic transaction for this.
      const txData = {
        buyer_name: buyerName,
        buyer_id: user?.id || null,
        buyer_email: user?.email || null,
        total_amount: poData.total_price,
        status: 'pending',
        items: [{
          id: selectedProduct.products.id,
          name: `[PO] ${selectedProduct.products.name}`,
          price: selectedProduct.products.price,
          quantity: quantity,
          is_po: true,
          po_id: poRes.id,
          seller_id: selectedProduct.seller_id
        }]
      };

      const createRes = await fetch('/api/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      if (!createRes.ok) throw new Error('Gagal membuat transaksi');
      const createData = await createRes.json();
      
      const ipaymuRes = await fetch('/api/payment/ipaymu/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: createData.transaction.id,
          amount: poData.total_price,
          buyer_name: buyerName,
          buyer_email: user?.email || 'guest@spscorner.id',
          buyer_phone: buyerPhone,
          items: txData.items
        })
      });

      if (!ipaymuRes.ok) throw new Error('Gagal membuat link pembayaran');
      const ipaymuData = await ipaymuRes.json();
      
      window.location.href = ipaymuData.payment_url;
    } catch (e: any) {
      toast.error('Terjadi kesalahan: ' + e.message);
      setProcessing(false);
    }
  };

  const filteredConfigs = configs.filter(c => 
    c.products.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 pb-24 sm:pb-32 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 rounded-b-2xl sm:rounded-b-3xl shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tighter mb-0.5">
                Produk <span className="text-amber-500">Pre-Order</span>
              </h1>
              <p className="text-zinc-400 dark:text-zinc-500 text-[10px] sm:text-xs font-bold tracking-tight">Pesan sekarang, ambil sesuai jadwal</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto transition-colors">
                <button onClick={() => navigate('/kiosk')} className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-700">Kantin</button>
                <button onClick={() => navigate('/kiosk')} className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-700">Koperasi</button>
                <button onClick={() => navigate('/kiosk/digital')} className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-700">Digital</button>
                <button className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold bg-white text-amber-600 shadow-sm">Pre-Order</button>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
                <input type="text" placeholder="Cari produk PO..." className="input-clay pl-9 text-xs h-10 w-full" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500 mb-3" />
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Memuat Menu PO...</p>
          </div>
        ) : filteredConfigs.length === 0 ? (
          <div className="text-center py-12 bg-white/50 rounded-2xl border border-dashed border-zinc-200">
            <p className="text-zinc-400 text-xs font-bold">Tidak ada produk PO saat ini</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredConfigs.map((config) => (
              <motion.div key={config.id} whileHover={{ y: -4 }} onClick={() => { setSelectedProduct(config); setQuantity(config.min_order || 1); }}
                className="bg-white dark:bg-zinc-900 rounded-[1.5rem] border border-zinc-100 shadow-sm cursor-pointer group flex flex-col h-full overflow-hidden hover:shadow-lg transition-all">
                <div className="p-2 pb-0 relative">
                  <div className="aspect-square bg-zinc-50 rounded-2xl overflow-hidden relative">
                    <img src={config.products.image_url || 'https://picsum.photos/400'} alt={config.products.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-amber-400/90 text-amber-950 text-[9px] font-black rounded-lg uppercase tracking-wider backdrop-blur-md">
                      PRE-ORDER
                    </div>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-sm font-bold text-zinc-900 line-clamp-2 leading-snug mb-1">{config.products.name}</h3>
                  <p className="text-amber-600 font-black mb-3">{formatRupiah(config.products.price)}</p>
                  <div className="mt-auto space-y-1.5 text-[10px] font-bold text-zinc-500">
                    <p className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Ambil: {PICKUP_TYPE_LABELS[config.pickup_type]}</p>
                    <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Cutoff: {config.order_cutoff_time?.slice(0,5)} WITA</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !processing && setSelectedProduct(null)}>
            <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="p-6">
                <h2 className="text-xl font-black mb-1 text-zinc-900">Pesan Pre-Order</h2>
                <p className="text-sm text-zinc-500 font-medium mb-4">{selectedProduct.products.name}</p>
                
                <div className="bg-amber-50 rounded-xl p-3 mb-5 border border-amber-100 flex items-start gap-2 text-amber-800 text-xs font-medium">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <p>Ini adalah produk Pre-Order. Pembayaran harus diselesaikan sekarang, dan produk diambil pada jadwal yang telah ditentukan: <strong className="font-bold">{PICKUP_TYPE_LABELS[selectedProduct.pickup_type]}</strong>.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-zinc-500 uppercase">Jumlah Pesanan</label>
                    <div className="flex items-center gap-3 bg-zinc-50 rounded-xl p-2 border border-zinc-200 w-32">
                      <button onClick={() => setQuantity(q => Math.max(selectedProduct.min_order || 1, q - 1))} className="w-8 h-8 flex justify-center items-center bg-white rounded-lg shadow-sm font-bold text-zinc-600">-</button>
                      <span className="flex-1 text-center font-black text-zinc-900">{quantity}</span>
                      <button onClick={() => setQuantity(q => Math.min(selectedProduct.max_order || 99, q + 1))} className="w-8 h-8 flex justify-center items-center bg-white rounded-lg shadow-sm font-bold text-zinc-600">+</button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-zinc-500 uppercase">Nama Pengambil</label>
                    <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)} className="input-clay" placeholder="Nama Anda" />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-black text-zinc-500 uppercase">Nomor HP</label>
                    <input type="tel" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} className="input-clay" placeholder="08..." />
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Harga</p>
                    <p className="text-2xl font-black text-amber-600">{formatRupiah(selectedProduct.products.price * quantity)}</p>
                  </div>
                  <button onClick={handleCheckoutPO} disabled={processing} className="btn-clay-primary bg-amber-500 hover:bg-amber-600 px-6 py-3 shadow-amber-500/20 flex items-center gap-2 text-sm">
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    Bayar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
