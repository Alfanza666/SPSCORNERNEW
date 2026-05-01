import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Store, Plus, Minus } from 'lucide-react';
import { formatRupiah } from '../../lib/utils';
import { useCartStore } from '../../store/useCartStore';

interface ProductDetailModalProps {
  selectedProduct: any;
  setSelectedProduct: (product: any | null) => void;
}

export default function ProductDetailModal({ selectedProduct, setSelectedProduct }: ProductDetailModalProps) {
  const { items, addItem, removeItem, updateQuantity } = useCartStore();

  if (!selectedProduct) return null;

  const cartItem = items.find((item) => item.id === selectedProduct.id);
  const quantity = cartItem?.quantity || 0;

  return (
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
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-3xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl z-50 overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row max-h-[90vh]"
      >
        <div className="relative w-full md:w-1/2 aspect-square md:aspect-auto md:h-auto bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
          <img
            src={selectedProduct.image_url || 'https://picsum.photos/seed/bread/800/600'}
            alt={selectedProduct.name}
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            fetchPriority="high"
          />
          <button
            onClick={() => setSelectedProduct(null)}
            className="absolute top-4 right-4 w-8 h-8 md:hidden bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          {selectedProduct.stock <= 5 && selectedProduct.stock > 0 && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-amber-400 text-amber-950 text-xs font-bold rounded-full shadow-sm uppercase tracking-wider z-10">
              Sisa: {selectedProduct.stock}
            </div>
          )}
          {selectedProduct.stock === 0 && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-sm uppercase tracking-wider z-10">
              Habis
            </div>
          )}
        </div>
        
        <div className="flex flex-col w-full md:w-1/2 min-h-0">
          <div className="hidden md:flex justify-end p-4 pb-0 items-center border-b border-zinc-100 dark:border-zinc-800/0">
            <button
              onClick={() => setSelectedProduct(null)}
              className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 md:pt-4 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-zinc-400 dark:text-zinc-600 mb-2 mt-4 md:mt-0 uppercase tracking-widest">
              <span>Menu</span>
              <span className="opacity-50">/</span>
              <span>Katalog</span>
              <span className="opacity-50">/</span>
              <span className="text-blue-600 dark:text-blue-400 leading-none truncate max-w-[200px]">{selectedProduct.name}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-tight mb-2">{selectedProduct.name}</h2>
                <div className="inline-block px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                  {selectedProduct.category}
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1">{formatRupiah(selectedProduct.price)}</h3>
            </div>
            
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                 <FileText className="w-4 h-4 text-zinc-400" />
                 Deskripsi Produk
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                {selectedProduct.description || 'Tidak ada deskripsi untuk produk ini.'}
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-3 mb-3">
                <Store className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Informasi Penjual</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 dark:text-zinc-500 mb-1">Nama Toko</p>
                  <p className="font-bold text-zinc-800 dark:text-zinc-300">{selectedProduct.profiles?.name || 'SPS Corner'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 dark:text-zinc-500 mb-1">Tipe Produk</p>
                  <p className="font-bold text-zinc-800 dark:text-zinc-300">{selectedProduct.is_digital ? 'Produk Digital' : 'Produk Fisik'}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 md:bg-zinc-50/50 md:dark:bg-zinc-800/30 flex-shrink-0">
            {quantity > 0 ? (
              <div className="flex items-center justify-between bg-white dark:bg-zinc-800 rounded-xl p-2 shadow-sm border border-zinc-200 dark:border-zinc-700 w-full md:w-auto">
                <button
                  onClick={() => {
                    if (quantity === 1) removeItem(selectedProduct.id);
                    else updateQuantity(selectedProduct.id, quantity - 1);
                  }}
                  className="w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors shrink-0"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="font-black text-lg text-zinc-900 dark:text-white px-6 w-full text-center">{quantity}</span>
                <button
                  onClick={() => {
                    if (quantity < selectedProduct.stock) {
                      updateQuantity(selectedProduct.id, quantity + 1);
                    }
                  }}
                  disabled={quantity >= selectedProduct.stock}
                  className="w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => addItem(selectedProduct)}
                disabled={selectedProduct.stock === 0}
                className="w-full btn-clay-primary py-4 text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Tambah ke Keranjang
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
