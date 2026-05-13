import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Store, 
  ShieldCheck, 
  ShoppingBag,
  CreditCard,
  Smartphone,
  PlayCircle
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

const faqs = [
  {
    question: "Bagaimana cara mendaftar sebagai Penjual (Seller)?",
    answer: "Saat ini, pendaftaran penjual dilakukan melalui Admin. Silakan hubungi Admin melalui halaman Kontak untuk mengajukan diri sebagai penjual di SPS Corner."
  },
  {
    question: "Berapa lama proses penarikan dana (Withdrawal) penjual?",
    answer: "Proses penarikan dana biasanya memakan waktu 1-2 hari kerja setelah diajukan melalui dashboard penjual dan disetujui oleh Admin."
  },
  {
    question: "Metode pembayaran apa saja yang didukung?",
    answer: "Kami mendukung pembayaran melalui QRIS (langsung diproses otomatis) dan Transfer Bank manual. Untuk produk digital, pembayaran menggunakan saldo atau metode yang tersedia."
  },
  {
    question: "Bagaimana jika transaksi produk digital (pulsa/token) gagal?",
    answer: "Jika transaksi gagal dari pihak provider (Digiflazz), dana akan dikembalikan atau Anda dapat menghubungi Admin dengan menyertakan ID Transaksi untuk pengecekan lebih lanjut."
  },
  {
    question: "Apakah saya bisa membatalkan pesanan?",
    answer: "Pesanan yang sudah dibayar dan diproses tidak dapat dibatalkan. Pastikan Anda memeriksa kembali keranjang belanja sebelum melakukan pembayaran."
  }
];

const tutorials = {
  admin: [
    {
      title: "Mengelola Pengguna & Penjual",
      content: "Di menu 'Kelola Penjual', Anda dapat menambahkan penjual baru, mengedit informasi mereka, atau menonaktifkan akun penjual yang melanggar aturan."
    },
    {
      title: "Menyetujui Penarikan Dana",
      content: "Buka menu 'Penarikan Dana'. Anda akan melihat daftar permintaan penarikan dari penjual. Pastikan Anda telah mentransfer dana ke rekening penjual sebelum mengubah status menjadi 'Selesai'."
    },
    {
      title: "Memantau Transaksi",
      content: "Menu 'Semua Transaksi' memungkinkan Anda melihat seluruh aliran transaksi di aplikasi, baik produk fisik maupun digital. Anda dapat memfilter berdasarkan status pembayaran."
    }
  ],
  seller: [
    {
      title: "Menambahkan Produk Baru",
      content: "Masuk ke menu 'Produk Saya', klik tombol 'Tambah Produk'. Isi nama, deskripsi, harga, stok, dan unggah foto produk yang menarik. Pastikan memilih kategori yang sesuai."
    },
    {
      title: "Memantau Penjualan",
      content: "Di halaman utama Dashboard Penjual, Anda dapat melihat ringkasan pendapatan, total pesanan, dan grafik penjualan bulanan Anda."
    },
    {
      title: "Menarik Saldo Pendapatan",
      content: "Buka menu 'Penarikan Dana'. Masukkan jumlah yang ingin ditarik dan detail rekening bank Anda. Tunggu persetujuan dan transfer dari Admin."
    }
  ],
  buyer: [
    {
      title: "Cara Berbelanja",
      content: "Pilih produk dari Katalog, masukkan ke Keranjang. Setelah selesai, buka Keranjang dan klik 'Checkout'. Isi data diri dan pilih metode pembayaran (QRIS disarankan untuk proses instan)."
    },
    {
      title: "Membeli Produk Digital",
      content: "Buka menu 'Produk Digital'. Pilih jenis produk (Pulsa, Token Listrik, dll), masukkan nomor tujuan, pilih nominal, dan lakukan pembayaran."
    },
    {
      title: "Mengecek Status Pesanan",
      content: "Gunakan menu 'Riwayat Pesanan' dan masukkan ID Transaksi Anda untuk melihat status pesanan secara real-time."
    }
  ]
};

export default function HelpCenter() {
  const { user, isLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'tutorial' | 'faq'>('tutorial');
  const [activeRole, setActiveRole] = useState<'buyer' | 'seller' | 'admin'>('buyer');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Set default role based on user role
  useEffect(() => {
    if (user?.role) {
      setActiveRole(user.role);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role || 'buyer';
  
  // Determine which roles the current user can view
  const canViewRole = (role: string) => {
    if (userRole === 'admin') return true;
    if (userRole === 'seller' && (role === 'buyer' || role === 'seller')) return true;
    if (userRole === 'buyer' && role === 'buyer') return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Pusat Bantuan</h1>
          <p className="mt-4 text-lg text-gray-600">
            Temukan panduan penggunaan aplikasi dan jawaban untuk pertanyaan umum.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-sm p-1 inline-flex">
            <button
              onClick={() => setActiveTab('tutorial')}
              className={`flex items-center px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'tutorial' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Tutorial Aplikasi
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex items-center px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'faq' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Q&A (FAQ)
            </button>
          </div>
        </div>

        {/* Content Area */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        >
          {activeTab === 'tutorial' ? (
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Panduan Penggunaan</h2>
              
              {/* Role Selector */}
              <div className={`grid grid-cols-1 sm:grid-cols-${[canViewRole('buyer'), canViewRole('seller'), canViewRole('admin')].filter(Boolean).length} gap-4 mb-8`}>
                {canViewRole('buyer') && (
                  <button
                    onClick={() => setActiveRole('buyer')}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      activeRole === 'buyer' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <ShoppingBag className="w-6 h-6 mb-2" />
                    <span className="font-medium">Pembeli</span>
                  </button>
                )}
                {canViewRole('seller') && (
                  <button
                    onClick={() => setActiveRole('seller')}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      activeRole === 'seller' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <Store className="w-6 h-6 mb-2" />
                    <span className="font-medium">Penjual</span>
                  </button>
                )}
                {canViewRole('admin') && (
                  <button
                    onClick={() => setActiveRole('admin')}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      activeRole === 'admin' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <ShieldCheck className="w-6 h-6 mb-2" />
                    <span className="font-medium">Admin</span>
                  </button>
                )}
              </div>

              {/* Quick Guide Section */}
              <div className="mb-8 bg-blue-50 border border-blue-100 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-blue-900">Panduan Singkat {activeRole === 'buyer' ? 'Pembeli' : activeRole === 'seller' ? 'Penjual' : 'Admin'}</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {activeRole === 'buyer' && (
                    <>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold mb-3">1</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Pilih Produk</h4>
                        <p className="text-sm text-gray-600">Cari produk fisik atau digital di katalog, lalu masukkan ke keranjang.</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold mb-3">2</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Checkout</h4>
                        <p className="text-sm text-gray-600">Isi data diri dan pilih metode pembayaran (QRIS untuk otomatis).</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold mb-3">3</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Selesai</h4>
                        <p className="text-sm text-gray-600">Lakukan pembayaran dan tunggu pesanan Anda diproses.</p>
                      </div>
                    </>
                  )}
                  {activeRole === 'seller' && (
                    <>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold mb-3">1</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Tambah Produk</h4>
                        <p className="text-sm text-gray-600">Upload foto, isi detail dan harga produk di menu Produk Saya.</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold mb-3">2</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Pantau Pesanan</h4>
                        <p className="text-sm text-gray-600">Cek dashboard secara berkala untuk melihat pesanan masuk.</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold mb-3">3</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Tarik Saldo</h4>
                        <p className="text-sm text-gray-600">Ajukan penarikan dana dari hasil penjualan ke rekening Anda.</p>
                      </div>
                    </>
                  )}
                  {activeRole === 'admin' && (
                    <>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold mb-3">1</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Kelola Pengguna</h4>
                        <p className="text-sm text-gray-600">Setujui pendaftaran penjual baru dan pantau aktivitas mereka.</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold mb-3">2</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Pantau Transaksi</h4>
                        <p className="text-sm text-gray-600">Awasi semua transaksi fisik dan digital yang terjadi di sistem.</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                        <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold mb-3">3</div>
                        <h4 className="font-semibold text-gray-900 mb-1">Proses Penarikan</h4>
                        <p className="text-sm text-gray-600">Transfer dana ke penjual dan konfirmasi status penarikan.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Tutorial Content */}
              <div className="space-y-6">
                {tutorials[activeRole].map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm mr-3">
                        {index + 1}
                      </span>
                      {item.title}
                    </h3>
                    <p className="text-gray-600 ml-9 leading-relaxed">
                      {item.content}
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 text-center">
                <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center">
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Pertanyaan yang Sering Diajukan</h2>
              
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <div 
                    key={index} 
                    className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-gray-50"
                    >
                      <span className="font-medium text-gray-900">{faq.question}</span>
                      {openFaq === index ? (
                        <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      )}
                    </button>
                    
                    {openFaq === index && (
                      <div className="p-5 bg-gray-50 border-t border-gray-200 text-gray-600 leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-10 bg-blue-50 rounded-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Masih butuh bantuan?</h3>
                <p className="text-blue-700 mb-4">Tim support kami siap membantu Anda.</p>
                <Link 
                  to="/contact" 
                  className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                >
                  Hubungi Kami
                </Link>
              </div>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
