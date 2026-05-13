import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Plus, 
  Trash2, 
  Tag, 
  Search, 
  AlertCircle, 
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  created_at: string;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      toast.error('Gagal memuat data kategori');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsSubmitting(true);
    try {
      const name = newCategoryName.trim();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      const { error } = await supabase
        .from('categories')
        .insert({ name, slug });

      if (error) throw error;

      toast.success('Kategori berhasil ditambahkan');
      setNewCategoryName('');
      setIsAddModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      console.error('Error adding category:', err);
      toast.error(err.message || 'Gagal menambahkan kategori');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Kategori berhasil dihapus');
      fetchCategories();
    } catch (err: any) {
      console.error('Error deleting category:', err);
      toast.error('Gagal menghapus kategori. Pastikan tidak ada produk yang menggunakan kategori ini.');
    }
  };

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Manajemen Kategori</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm mt-1">Kelola kategori produk untuk seluruh sistem</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-clay-primary px-6 py-3 flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-5 h-5" />
          Tambah Kategori
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari kategori..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-clay pl-12 h-12"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
            <p className="text-zinc-500 dark:text-zinc-400 font-bold">Memuat data kategori...</p>
          </div>
        ) : filteredCategories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategories.map((category) => (
              <motion.div
                key={category.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-white dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-900/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                    <Tag className="w-5 h-5" />
                  </div>
                  <span className="font-black text-zinc-900 dark:text-white">{category.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <Tag className="w-16 h-16 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 font-bold">Tidak ada kategori ditemukan</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-zinc-100 dark:border-zinc-800"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Tambah Kategori</h2>
                <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm mt-1">Masukkan nama kategori baru</p>
              </div>

              <form onSubmit={handleAddCategory} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 mb-3 ml-2 uppercase tracking-widest">
                    Nama Kategori
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Contoh: Makanan, Minuman, Alat Tulis"
                    required
                    autoFocus
                    className="input-clay"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-black rounded-2xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Simpan'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
