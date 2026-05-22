import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatRupiah } from '../../../lib/utils';
import {
  ClipboardList, Plus, X, Settings, Calendar, Clock, CheckCircle2,
  Package, ChevronDown, ChevronUp, AlertCircle, Users, Loader2,
  ShoppingBag, Check, XCircle, Eye, Upload, Trash2
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const PICKUP_TYPE_LABELS: Record<string, string> = {
  same_day: 'Hari Ini (Pesan & Ambil Hari Sama)',
  next_day: 'Besok (Ambil Hari Berikutnya)',
  custom_days: 'Kustom (X Hari Kemudian)',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  picked_up: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu', confirmed: 'Dikonfirmasi', ready: 'Siap Ambil',
  picked_up: 'Sudah Diambil', cancelled: 'Dibatalkan',
};

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function SellerPreOrders() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'orders' | 'configs'>('orders');
  const [products, setProducts] = useState<any[]>([]);
  const [poConfigs, setPoConfigs] = useState<any[]>([]);
  const [preOrders, setPreOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', price: '', category: '', description: '', image_url: '' });
  const [configForm, setConfigForm] = useState({
    pickup_type: 'next_day',
    custom_days: 1,
    order_cutoff_time: '10:00',
    po_stock: 20,
    min_order: 1,
    max_order: 20,
    pickup_notes: 'Ambil di loket Koperasi SPS, jam 07.00–11.00 WITA',
    open_days: [1, 2, 3, 4, 5],
  });

  useEffect(() => {
    if (user?.id) { fetchAll(); }
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prodRes, cfgRes, poRes, catRes] = await Promise.all([
        supabase.from('products').select('*, pre_order_configs(id)').eq('seller_id', user!.id).eq('is_active', true).order('name'),
        supabase.from('pre_order_configs').select('*').eq('seller_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('pre_orders').select('*, products(name,image_url), profiles!pre_orders_buyer_id_fkey(name)').eq('seller_id', user!.id).order('pickup_date', { ascending: true }),
        supabase.from('categories').select('*').order('name', { ascending: true })
      ]);
      
      const poProducts = (prodRes.data || []).filter(p => p.pre_order_configs && p.pre_order_configs.length > 0);
      setProducts(poProducts);
      setPoConfigs(cfgRes.data || []);
      setPreOrders(poRes.data || []);
      setCategories(catRes.data || []);
    } catch (e: any) {
      toast.error('Gagal memuat data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) throw new Error('Maksimal ukuran file 2MB.');

      setUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath);
      setProductForm(prev => ({ ...prev, image_url: publicUrl }));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const openNewPoForm = () => {
    setIsNewProduct(true);
    setProductForm({ name: '', price: '', category: '', description: '', image_url: '' });
    setConfigForm({ pickup_type: 'next_day', custom_days: 1, order_cutoff_time: '10:00', po_stock: 20, min_order: 1, max_order: 20, pickup_notes: 'Ambil di loket penjual, jam 07.00–11.00 WITA', open_days: [1,2,3,4,5] });
    setSelectedProduct({ name: 'Produk Baru', id: 'new' });
    setShowConfigForm(true);
  };

  const openConfigForm = (product: any) => {
    setIsNewProduct(false);
    const existing = poConfigs.find(c => c.product_id === product.id);
    if (existing) {
      setConfigForm({
        pickup_type: existing.pickup_type,
        custom_days: existing.custom_days || 1,
        order_cutoff_time: existing.order_cutoff_time?.slice(0, 5) || '10:00',
        po_stock: existing.po_stock,
        min_order: existing.min_order,
        max_order: existing.max_order,
        pickup_notes: existing.pickup_notes || '',
        open_days: existing.open_days || [1,2,3,4,5],
      });
    } else {
      setConfigForm({ pickup_type: 'next_day', custom_days: 1, order_cutoff_time: '10:00', po_stock: 20, min_order: 1, max_order: 20, pickup_notes: 'Ambil di loket Koperasi SPS, jam 07.00–11.00 WITA', open_days: [1,2,3,4,5] });
    }
    setProductForm({
      name: product.name,
      price: product.price.toString(),
      category: product.category || '',
      description: product.description || '',
      image_url: product.image_url || ''
    });
    setSelectedProduct(product);
    setShowConfigForm(true);
  };

  const saveConfig = async () => {
    if (!selectedProduct || !user) return;
    try {
      if (!productForm.name || !productForm.price || !productForm.category) {
        throw new Error('Nama, harga, dan kategori produk harus diisi!');
      }

      setLoading(true);
      let productId = selectedProduct.id;

      // 1. Save to products table first
      const productPayload = {
        seller_id: user.id,
        name: productForm.name,
        price: Number(productForm.price),
        category: productForm.category,
        description: productForm.description,
        image_url: productForm.image_url,
        is_active: true,
        stock: 0 // PO products don't use regular stock
      };

      if (isNewProduct) {
        const { data: newProd, error: prodErr } = await supabase.from('products').insert(productPayload).select().single();
        if (prodErr) throw prodErr;
        productId = newProd.id;
      } else {
        const { error: prodErr } = await supabase.from('products').update(productPayload).eq('id', productId);
        if (prodErr) throw prodErr;
      }

      // 2. Save config to pre_order_configs
      const configPayload = {
        product_id: productId,
        seller_id: user.id,
        is_active: true,
        pickup_type: configForm.pickup_type,
        custom_days: configForm.pickup_type === 'custom_days' ? configForm.custom_days : null,
        order_cutoff_time: configForm.order_cutoff_time + ':00',
        po_stock: Number(configForm.po_stock),
        min_order: Number(configForm.min_order),
        max_order: Number(configForm.max_order),
        pickup_notes: configForm.pickup_notes,
        open_days: configForm.open_days,
      };
      
      const { error: cfgErr } = await supabase.from('pre_order_configs').upsert(configPayload, { onConflict: 'product_id' });
      if (cfgErr) throw cfgErr;
      
      toast.success('Produk PO berhasil disimpan!');
      setShowConfigForm(false);
      fetchAll();
    } catch (e: any) {
      toast.error('Gagal menyimpan: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleConfig = async (configId: string, current: boolean) => {
    try {
      const { error } = await supabase.from('pre_order_configs').update({ is_active: !current }).eq('id', configId);
      if (error) throw error;
      toast.success(!current ? 'PO diaktifkan' : 'PO dinonaktifkan');
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk PO ini? Semua data pesanan terkait akan ikut terhapus atau kehilangan referensi.')) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      toast.success('Produk PO berhasil dihapus');
      fetchAll();
    } catch (e: any) {
      toast.error('Gagal menghapus produk: ' + e.message);
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'confirmed') updateData.confirmed_at = new Date().toISOString();
      if (newStatus === 'ready') {
        updateData.ready_at = new Date().toISOString();
        const order = preOrders.find((o: any) => o.id === orderId);
        if (order) {
            fetch('/api/pre-orders/notify-ready', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, buyer_id: order.buyer_id, buyer_name: order.buyer_name })
            }).catch(console.error);
        }
      }
      if (newStatus === 'picked_up') updateData.picked_up_at = new Date().toISOString();
      const { error } = await supabase.from('pre_orders').update(updateData).eq('id', orderId);
      if (error) throw error;
      toast.success(`Status diubah ke: ${STATUS_LABELS[newStatus]}`);
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleDay = (day: number) => {
    setConfigForm(prev => ({
      ...prev,
      open_days: prev.open_days.includes(day)
        ? prev.open_days.filter(d => d !== day)
        : [...prev.open_days, day].sort(),
    }));
  };

  const filteredOrders = preOrders.filter(o => filterStatus === 'all' || o.status === filterStatus);
  const pendingCount = preOrders.filter(o => o.status === 'pending').length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-1">
            Pre-Order (PO)
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-500" />
            Kelola sistem PO untuk produk basah & pesanan khusus
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{pendingCount} pesanan perlu dikonfirmasi</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-1 w-fit">
        {[['orders', 'Pesanan Masuk', ShoppingBag], ['configs', 'Pengaturan PO', Settings]].map(([key, label, Icon]: any) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === key ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
            <Icon className="w-4 h-4" />
            {label}
            {key === 'orders' && pendingCount > 0 && (
              <span className="w-5 h-5 bg-amber-500 text-white text-xs font-black rounded-full flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'confirmed', 'ready', 'picked_up', 'cancelled'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                {s === 'all' ? 'Semua' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
              <p className="font-bold text-zinc-900 dark:text-white mb-1">Belum ada pesanan PO</p>
              <p className="text-sm text-zinc-500">Pesanan akan muncul di sini setelah buyer melakukan pre-order</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(order => (
                <motion.div key={order.id} layout className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                      {order.products?.image_url ? <img src={order.products.image_url} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-zinc-400 m-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 dark:text-white truncate">{order.products?.name}</p>
                      <p className="text-xs text-zinc-500">{order.buyer_name} · {order.quantity} pcs · {formatRupiah(order.total_price)}</p>
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        Ambil: {format(new Date(order.pickup_date), 'EEEE, d MMM yyyy', { locale: localeId })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
                      {expandedOrder === order.id ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedOrder === order.id && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800">
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><p className="text-xs text-zinc-400 font-bold">HP Pembeli</p><p className="font-medium text-zinc-900 dark:text-white">{order.buyer_phone || '-'}</p></div>
                            <div><p className="text-xs text-zinc-400 font-bold">Tgl Pesan</p><p className="font-medium text-zinc-900 dark:text-white">{format(new Date(order.order_date), 'd MMM yyyy')}</p></div>
                            {order.notes && <div className="col-span-2"><p className="text-xs text-zinc-400 font-bold">Catatan</p><p className="font-medium text-zinc-900 dark:text-white">{order.notes}</p></div>}
                          </div>
                          {/* Action buttons */}
                          <div className="flex gap-2 flex-wrap">
                            {order.status === 'pending' && (
                              <>
                                <button onClick={() => updateOrderStatus(order.id, 'confirmed')} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700">
                                  <Check className="w-3.5 h-3.5" /> Konfirmasi
                                </button>
                                <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold hover:bg-red-200">
                                  <XCircle className="w-3.5 h-3.5" /> Tolak
                                </button>
                              </>
                            )}
                            {order.status === 'confirmed' && (
                              <button onClick={() => updateOrderStatus(order.id, 'ready')} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Siap Ambil
                              </button>
                            )}
                            {order.status === 'ready' && (
                              <button onClick={() => updateOrderStatus(order.id, 'picked_up')} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-white rounded-xl text-xs font-bold hover:bg-zinc-900">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Diambil
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Configs Tab */}
      {tab === 'configs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Kelola produk khusus Pre-Order (PO) Anda di sini.</p>
            <button onClick={openNewPoForm} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm">
              <Plus className="w-4 h-4" />
              Produk PO Baru
            </button>
          </div>
          {products.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-12 text-center">
              <Package className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="font-bold text-zinc-900 dark:text-white">Belum ada produk PO</p>
              <p className="text-sm text-zinc-500 mt-1">Klik tombol "Produk PO Baru" di atas untuk menambahkan produk Pre-Order pertama Anda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map(product => {
                const cfg = poConfigs.find(c => c.product_id === product.id);
                return (
                  <div key={product.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                        {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-zinc-400 m-2.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-zinc-900 dark:text-white truncate text-sm">{product.name}</p>
                        <p className="text-xs text-zinc-500">{formatRupiah(product.price)}</p>
                      </div>
                      {cfg && (
                        <button onClick={() => toggleConfig(cfg.id, cfg.is_active)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${cfg.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                          {cfg.is_active ? 'AKTIF' : 'NONAKTIF'}
                        </button>
                      )}
                    </div>
                    {cfg ? (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 mb-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
                        <p><span className="font-bold">Jadwal ambil:</span> {PICKUP_TYPE_LABELS[cfg.pickup_type]}</p>
                        <p><span className="font-bold">Cutoff order:</span> {cfg.order_cutoff_time?.slice(0,5)} WITA</p>
                        <p><span className="font-bold">Stok PO:</span> {cfg.po_stock} pcs</p>
                        <p><span className="font-bold">Catatan:</span> {cfg.pickup_notes || '-'}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic mb-3">Belum dikonfigurasi</p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => handleDeleteProduct(product.id)} className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-100 dark:border-red-900/50" title="Hapus Produk PO">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => openConfigForm(product)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-100 dark:border-blue-900/50">
                        <Settings className="w-3.5 h-3.5" />
                        {cfg ? 'Edit Konfigurasi' : 'Setup Pre-Order'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Config Form Modal */}
      <AnimatePresence>
        {showConfigForm && selectedProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white">Setup Pre-Order</h2>
                    <p className="text-sm text-zinc-500 font-medium">{selectedProduct.name}</p>
                  </div>
                  <button onClick={() => setShowConfigForm(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* Product Details Section */}
                <div className="space-y-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white mb-2">1. Detail Produk PO</h3>
                  
                  {/* Image Upload */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Gambar Produk</label>
                    <div className="relative aspect-video rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center overflow-hidden group">
                      {productForm.image_url ? (
                        <>
                          <img src={productForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="btn-clay-secondary h-10 px-4 cursor-pointer flex items-center gap-2 text-xs">
                              <Upload className="w-4 h-4" /> Ganti
                              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 p-4 text-center w-full h-full justify-center text-zinc-400 group-hover:text-blue-500 transition-colors">
                          {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                          <span className="text-xs font-bold mt-1">Upload Gambar</span>
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Name & Category */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Nama Produk</label>
                      <input type="text" required value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} className="input-clay" placeholder="Contoh: Brownies PO" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Kategori</label>
                      <select required value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))} className="input-clay appearance-none">
                        <option value="">Pilih...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Price & Desc */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Harga (Rp)</label>
                      <input type="number" required value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))} className="input-clay" placeholder="25000" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Deskripsi</label>
                      <textarea value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} className="input-clay h-[42px] py-2" placeholder="Detail produk..." />
                    </div>
                  </div>
                </div>

                <h3 className="text-sm font-black text-zinc-900 dark:text-white pt-2">2. Pengaturan PO</h3>

                {/* Pickup Type */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Jadwal Pengambilan</label>
                  {Object.entries(PICKUP_TYPE_LABELS).map(([val, label]) => (
                    <button key={val} onClick={() => setConfigForm(p => ({ ...p, pickup_type: val }))}
                      className={`w-full text-left p-3 rounded-xl border-2 text-sm font-medium transition-all ${configForm.pickup_type === val ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {configForm.pickup_type === 'custom_days' && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Berapa Hari Setelah Pesan?</label>
                    <input type="number" min={1} max={14} value={configForm.custom_days}
                      onChange={e => setConfigForm(p => ({ ...p, custom_days: Number(e.target.value) }))}
                      className="input-clay" />
                  </div>
                )}

                {/* Cutoff time */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Batas Waktu Pemesanan (WITA)</label>
                  <input type="time" value={configForm.order_cutoff_time}
                    onChange={e => setConfigForm(p => ({ ...p, order_cutoff_time: e.target.value }))}
                    className="input-clay" />
                  <p className="text-xs text-zinc-400">Pesanan setelah jam ini akan diproses untuk hari berikutnya</p>
                </div>

                {/* Open days */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Hari Buka PO</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((day, i) => (
                      <button key={i} onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${configForm.open_days.includes(i) ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stock & orders */}
                <div className="grid grid-cols-3 gap-3">
                  {[['po_stock', 'Stok PO'], ['min_order', 'Min Order'], ['max_order', 'Maks Order']].map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">{label}</label>
                      <input type="number" min={1} value={(configForm as any)[key]}
                        onChange={e => setConfigForm(p => ({ ...p, [key]: Number(e.target.value) }))}
                        className="input-clay" />
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Catatan Pengambilan</label>
                  <textarea value={configForm.pickup_notes}
                    onChange={e => setConfigForm(p => ({ ...p, pickup_notes: e.target.value }))}
                    placeholder="Contoh: Ambil di loket Koperasi SPS, jam 07.00–11.00 WITA"
                    className="input-clay min-h-[80px] py-3" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowConfigForm(false)} className="flex-1 btn-clay-secondary">Batal</button>
                  <button onClick={saveConfig} className="flex-1 btn-clay-primary">Simpan Konfigurasi</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
