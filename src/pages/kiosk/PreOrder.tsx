import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatRupiah } from '../../lib/utils';
import { Search, Loader2, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addDays } from 'date-fns';
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
    const { data } = await supabase
      .from('pre_order_configs')
      .select('*, products(id, name, price, image_url, category, description, is_active), profiles:seller_id(name)')
      .eq('is_active', true);
    
    setConfigs((data || []).filter(c => c.products?.is_active));
    setLoading(false);
  };

  const handleCheckoutPO = async () => {
    if (!buyerName || !buyerPhone) {
      toast.error('Nama dan Nomor HP wajib diisi');
      return;
    }
    setProcessing(true);
    try {
      const pickupDate = addDays(new Date(), selectedProduct.pickup_type === 'next_day' ? 1 : (selectedProduct.custom_days || 0));

      // STRUKTUR DATA LENGKAP UNTUK MENGHINDARI ERROR NOT-NULL
      const poData = {
        product_id: selectedProduct.product_id,
        seller_id: selectedProduct.seller_id,
        buyer_id: user?.id || null,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        quantity: quantity,
        unit_price: selectedProduct.products.price, // FIXED: unit_price
        total_price: selectedProduct.products.price * quantity,
        pickup_date: pickupDate.toISOString(),
        order_date: new Date().toISOString(),
        created_at: new Date().toISOString(), // FIXED: seringkali required di DB
        status: 'pending',
        notes: `PO dari Kiosk. Tipe: ${PICKUP_TYPE_LABELS[selectedProduct.pickup_type]}`,
        po_config_id: selectedProduct.id // FIXED: po_config_id
      };

      const { data: poRes, error: poErr } = await supabase.from('pre_orders').insert([poData]).select().single();
      if (poErr) {
        console.error("DB Error:", poErr);
        throw new Error(poErr.message);
      }

      const txData = {
        buyer_name: buyerName,
        buyer_id: user?.id || null,
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
      toast.error('Gagal: ' + e.message);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8ebf0] pb-24">
      <div className="bg-white p-6 shadow-sm"><h1 className="text-xl font-black">Pre-Order</h1></div>
      <div className="max-w-7xl mx-auto px-4 mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {configs.map((config) => (
          <div key={config.id} onClick={() => { setSelectedProduct(config); setQuantity(config.min_order || 1); }}
            className="bg-white p-4 rounded-2xl shadow-sm cursor-pointer border hover:shadow-lg transition-all">
            <img src={config.products.image_url} className="w-full aspect-square object-cover rounded-xl mb-3" />
            <h3 className="font-bold text-sm">{config.products.name}</h3>
            <p className="text-amber-600 font-black">{formatRupiah(config.products.price)}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}>
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-black mb-4">Pesan {selectedProduct.products.name}</h2>
              <div className="space-y-3">
                <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Nama Anda" />
                <input type="tel" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Nomor HP" />
              </div>
              <button onClick={handleCheckoutPO} disabled={processing} className="w-full mt-6 bg-amber-500 text-white font-black py-4 rounded-xl flex justify-center items-center gap-2">
                {processing ? <Loader2 className="animate-spin" /> : <CreditCard />} Bayar {formatRupiah(selectedProduct.products.price * quantity)}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
