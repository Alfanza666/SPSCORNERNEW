import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/FEDERASI RIKAT PEKERJ SUKSES.png';

export default function Terms() {
  const navigate = useNavigate();

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
              className="h-8 w-auto object-contain drop-shadow-sm transition-transform group-hover:scale-105" 
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
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white mb-8 tracking-tight">Syarat & Ketentuan</h1>
          
          <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-black prose-p:text-zinc-600 dark:prose-p:text-zinc-400">
            <h2>1. Pendahuluan</h2>
            <p>
              Selamat datang di SPS Corner. Syarat & Ketentuan ini mengatur penggunaan layanan dan platform e-commerce kami. Dengan mengakses atau menggunakan platform ini, Anda setuju untuk terikat oleh Syarat & Ketentuan ini.
            </p>

            <h2>2. Layanan Kami</h2>
            <p>
              SPS Corner menyediakan platform pusat belanja digital (kiosk & marketplace) yang memungkinkan karyawan untuk melihat, memesan, dan membayar berbagai produk, termasuk namun tidak terbatas pada makanan, minuman, produk Sariroti, serta produk digital yang disediakan oleh penjual terdaftar di lingkungan kami.
            </p>

            <h2>3. Ketentuan Pengguna</h2>
            <ul>
              <li>Pengguna wajib memberikan informasi yang akurat saat melakukan transaksi.</li>
              <li>Pengguna bertanggung jawab atas keamanan akun dan setiap aktivitas yang terjadi di bawah akun mereka.</li>
              <li>Sistem pembayaran menggunakan metode non-tunai (QRIS) yang diproses melalui pihak ketiga.</li>
            </ul>

            <h2>4. Kebijakan Transaksi & Pembayaran</h2>
            <ul>
              <li>Semua harga yang tercantum sudah termasuk pajak yang berlaku kecuali dinyatakan lain.</li>
              <li>Pembayaran harus diselesaikan dalam batas waktu yang ditentukan setelah kode QRIS dibuat.</li>
              <li>Transaksi yang telah berhasil dibayar tidak dapat dibatalkan atau di-refund kecuali ada kesalahan dari pihak penjual atau kegagalan sistem pada pengiriman produk digital.</li>
            </ul>

            <h2>5. Pengambilan & Pengiriman Barang</h2>
            <p>
              Untuk produk fisik di area SPS Corner, beroperasi dengan sistem kejujuran (honesty system). Pembeli wajib mengambil barang sesuai dengan pesanan dan jumlah yang telah dibayarkan. Area pengambilan diawasi oleh CCTV untuk memastikan keamanan dan ketertiban. Untuk produk digital, pengiriman akan dilakukan secara otomatis atau manual oleh penjual melalui sistem atau kontak yang terdaftar.
            </p>

            <h2>6. Penafian (Disclaimer)</h2>
            <p>
              SPS Corner tidak bertanggung jawab atas kerugian tidak langsung, insidental, khusus, atau konsekuensial yang timbul dari penggunaan platform ini. Kami berusaha memastikan semua informasi produk akurat, namun tidak menjamin ketersediaan produk secara real-time setiap saat.
            </p>

            <h2>7. Perubahan Syarat & Ketentuan</h2>
            <p>
              Kami berhak untuk mengubah Syarat & Ketentuan ini kapan saja. Perubahan akan berlaku segera setelah dipublikasikan di halaman ini. Pengguna disarankan untuk memeriksa halaman ini secara berkala.
            </p>

            <p className="mt-8 text-sm text-zinc-500">
              Pembaruan Terakhir: 17 Maret 2026
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
