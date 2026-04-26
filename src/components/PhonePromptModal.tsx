import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface PhonePromptModalProps {
  onClose: () => void;
}

export default function PhonePromptModal({ onClose }: PhonePromptModalProps) {
  const { user, setUser } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length < 9 || cleaned.length > 15) {
      toast.error('Nomor HP tidak valid. Mohon masukkan nomor yang benar.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: cleaned })
        .eq('id', user!.id);

      if (error) throw error;

      // Update local auth store
      setUser({ ...user!, phone: cleaned });
      toast.success('Nomor HP berhasil disimpan!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan nomor HP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white relative">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-black tracking-tight">Satu Langkah Lagi!</h2>
            <p className="text-blue-100 text-xs font-medium mt-1">
              Lengkapi nomor HP Anda untuk menerima notifikasi pesanan.
            </p>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
                Nomor HP hanya digunakan untuk notifikasi status pesanan. Tidak akan dibagikan kepada pihak ketiga.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black text-zinc-400 mb-1.5 ml-1 uppercase tracking-widest">
                Nomor Handphone
              </label>
              <input
                id="phone-input"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Contoh: 08123456789"
                required
                className="input-clay w-full"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 font-bold text-xs uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors"
              >
                Nanti Saja
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-clay-primary flex-1 h-11 text-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : 'Simpan'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
