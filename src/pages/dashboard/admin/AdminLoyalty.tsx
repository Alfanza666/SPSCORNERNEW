import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/useAuthStore';
import { motion } from 'motion/react';

export default function AdminLoyalty() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .in('key', ['loyalty_enabled']);

      if (error) throw error;

      const loyaltyData = data?.find((d: { key: string; value: any }) => d.key === 'loyalty_enabled');
      if (loyaltyData) {
        setLoyaltyEnabled(loyaltyData.value === 'true');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    setSaving(true);
    try {
      const newValue = !loyaltyEnabled;
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'loyalty_enabled', value: newValue.toString() });

      if (error) throw error;
      setLoyaltyEnabled(newValue);
      toast.success(newValue ? 'Loyalty point diaktifkan' : 'Loyalty point dinonaktifkan');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'superadmin') {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-500">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-zinc-500 mt-4">Memuat pengaturan...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Tag className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Pengaturan Loyalty Point</h1>
              <p className="text-sm text-zinc-500">Aktifkan atau nonaktifkan program loyalty point</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">Program Loyalty Point</p>
              <p className="text-xs text-zinc-500 mt-1">Setiap transaksi akan memberikan 1% poin loyalty</p>
            </div>
            <button
              onClick={handleToggle}
              disabled={saving}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                loyaltyEnabled ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            >
              <motion.div
                animate={{ x: loyaltyEnabled ? 28 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md"
              />
            </button>
          </div>

          {loyaltyEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30"
            >
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Info:</strong> Loyalty point sudah aktif. Setiap transaksi akan memberikan 1% dari total belanja sebagai poin yang dapat ditukar dengan merchandise.
              </p>
            </motion.div>
          )}

          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Perhatian:</strong> Mengubah pengaturan ini akan langsung mempengaruhi sistem loyalty point di Kiosk. Pastikan database sudah dimigrasi dengan benar sebelum mengaktifkan.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}