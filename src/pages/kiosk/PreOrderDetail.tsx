import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCartStore } from '../../store/useCartStore';
import { formatRupiah } from '../../lib/utils';
import { ArrowLeft, Plus, Minus, ShoppingCart, Clock, Store, Share2, Check } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function PreOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [copied, setCopied] = useState(false);
  const { items, addItem, updateQuantity, removeItem } = useCartStore();

  useEffect(() => {
    if (!id) return;
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data } = await supabase
        .from('pre_order_configs')
        .select('*, products!inner(id, name, price, image_url, description, category, is_active), profiles!seller_id(name)')
        .eq('id', id)
        .single();

      if (!data?.products) {
        toast.error('Produk tidak ditemukan');
        return;
      }

      setProduct({
        ...data.products,
        po_config_id: data.id,
        seller_name: data.profiles?.name || 'Seller',
        po_stock: data.po_stock,
        po_min_order: data.min_order || 1,
        po_max_order: data.max_order || 999,
        pickup_notes: data.pickup_notes,
        po_pickup_type: data.pickup_type,
      });
    } catch {
      toast.error('Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  };

  const cartItem = items.find(i => i.id === product?.id);
  const cartQty = cartItem?.quantity || 0;

  const handleShare = async () => {
    const url = `${window.location.origin}/kiosk/pre-order/${id}`;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Gagal copy link');
      }
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (cartQty > 0) {
      updateQuantity(product.id, cartQty + qty);
    } else {
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        stock: 999,
        is_preorder: true,
        po_config_id: product.po_config_id,
        seller_id: product.seller_id,
      });
      updateQuantity(product.id, qty);
    }
    toast.success('Ditambahkan ke keranjang');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-zinc-500">Produk tidak ditemukan</p>
        <button onClick={() => navigate('/kiosk?tab=preorder')} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm">Kembali ke Katalog</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={handleShare} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied ? 'Tersalin' : 'Bagikan'}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Image */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-700">
          <div className="aspect-square bg-zinc-50 dark:bg-zinc-800">
            <img
              src={product.image_url || 'https://picsum.photos/seed/bread/400/400'}
              alt={product.name}
              className="w-full h-full object-cover"
              draggable="false"
            />
          </div>
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-700 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-md uppercase tracking-wider">Pre-Order</span>
              <span className="text-xs text-zinc-400 flex items-center gap-1"><Store className="w-3 h-3" />{product.seller_name}</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{product.name}</h1>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{formatRupiah(product.price)}</p>
          </div>

          {product.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{product.description}</p>
          )}

          {product.pickup_notes && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-xs text-amber-700 dark:text-amber-300">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{product.pickup_notes}</span>
            </div>
          )}

          {/* Quantity Selector & Add to Cart */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Jumlah</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(Math.max(product.po_min_order || 1, qty - 1))}
                  disabled={qty <= (product.po_min_order || 1)}
                  className="w-9 h-9 flex items-center justify-center bg-zinc-100 dark:bg-zinc-700 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                >
                  <Minus className="w-4 h-4" strokeWidth={3} />
                </button>
                <span className="font-bold text-lg w-8 text-center tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty(Math.min(product.po_max_order || 999, qty + 1))}
                  disabled={qty >= (product.po_max_order || 999)}
                  className="w-9 h-9 flex items-center justify-center bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-30 transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={3} />
                </button>
              </div>
            </div>

            <button onClick={handleAddToCart} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3.5 font-bold text-sm shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all">
              <ShoppingCart className="w-4 h-4" />
              {cartQty > 0 ? 'Tambah Lagi ke Keranjang' : 'Masukkan ke Keranjang'}
            </button>

            {cartQty > 0 && (
              <button onClick={() => navigate('/kiosk/cart')} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-bold text-sm active:scale-[0.98] transition-all">
                <ShoppingCart className="w-4 h-4" />
                Lihat Keranjang ({cartQty})
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
