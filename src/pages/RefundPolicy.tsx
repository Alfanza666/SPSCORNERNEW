import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import Logo from '../components/ui/logo-utama.png';

export default function RefundPolicy() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'refund_policy_content')
          .single();

        if (error) throw error;
        if (data && data.value) {
          setContent(data.value);
        }
      } catch (error) {
        console.error('Error fetching refund policy:', error);
        // Fallback to default
        setContent(`
          <h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">1. Ketentuan Umum Pengembalian Dana</h3>
          <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            Pengembalian dana (refund) hanya dapat dilakukan dalam kondisi-kondisi tertentu yang sepenuhnya merupakan kesalahan dari pihak sistem atau penjual di SPS Corner.
          </p>

          <h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">2. Kondisi yang Memenuhi Syarat Refund</h3>
          <ul class="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-6">
            <li>Produk digital (seperti pulsa, token listrik) gagal dikirimkan atau transaksi dibatalkan oleh sistem setelah pembayaran berhasil.</li>
            <li>Produk fisik yang dipesan ternyata kehabisan stok setelah pembayaran berhasil dilakukan.</li>
            <li>Terjadi kesalahan sistem yang menyebabkan nominal pembayaran terpotong lebih dari yang seharusnya (double charge).</li>
          </ul>

          <h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">3. Kondisi yang Tidak Memenuhi Syarat Refund</h3>
          <ul class="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-6">
            <li>Kesalahan input nomor tujuan (untuk produk digital) oleh pembeli.</li>
            <li>Pembeli berubah pikiran setelah transaksi berhasil diproses.</li>
            <li>Keterlambatan pengiriman produk digital yang disebabkan oleh gangguan pada pihak operator atau provider.</li>
          </ul>

          <h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">4. Proses Pengajuan Refund</h3>
          <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            Untuk mengajukan pengembalian dana, pembeli harus menghubungi tim dukungan kami melalui halaman "Hubungi Kami" atau WhatsApp resmi dengan menyertakan:
          </p>
          <ul class="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-6">
            <li>ID Transaksi</li>
            <li>Bukti pembayaran yang sah</li>
            <li>Penjelasan singkat mengenai alasan pengajuan refund</li>
          </ul>

          <h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">5. Waktu Proses Refund</h3>
          <p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            Proses verifikasi dan pengembalian dana akan memakan waktu 1-3 hari kerja terhitung sejak laporan diterima dan disetujui oleh tim kami. Dana akan dikembalikan ke metode pembayaran awal atau ke saldo akun pengguna (jika disepakati).
          </p>
        `);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicy();
  }, []);

  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50 shadow-sm dark:shadow-black/20 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="clay-icon w-10 h-10 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <img 
              src={Logo} 
              alt="SPS Corner Logo" 
              className="h-12 w-auto object-contain drop-shadow-sm transition-transform group-hover:scale-105" 
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
              }} 
            />
            <div className="hidden clay-icon-amber w-8 h-8">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-black text-zinc-900 dark:text-white tracking-tighter leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                SPS <span className="text-blue-600 dark:text-blue-400">Corner</span>
              </h1>
            </div>
          </div>
          
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-card p-6 sm:p-10"
        >
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <RefreshCcw className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">Kebijakan Pengembalian Dana</h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Syarat dan ketentuan terkait pengembalian dana (Refund Policy) di SPS Corner.
            </p>
          </div>
          
          <div 
            className="prose prose-zinc dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </motion.div>
      </main>
    </div>
  );
}
