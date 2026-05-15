import { X, ChevronRight, ChevronLeft, Check, HelpCircle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export interface GuideStep {
  selector: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  optional?: boolean;
}

export interface PageGuide {
  page: string;
  steps: GuideStep[];
}

export const BUYER_GUIDES: PageGuide[] = [
  {
    page: '/kiosk',
    steps: [
      {
        selector: 'body',
        title: 'Selamat Datang di SPS Corner!',
        content: 'Halaman utama untuk membeli produk. Di sini Anda bisa memilih produk dari Kantin, Kopi (makanan & minuman siap saji), dan Produk Digital.',
        placement: 'center',
      },
      {
        selector: '.guide-store-toggle',
        title: 'Pilih Jenis Toko',
        content: 'Gunakan tombol tabs ini untuk switch antara Kantin, Kopi, dan produk Digital. Kantin untuk makanan/minuman segar yang langsung bisa diambil. Kopi untuk roti, kue, dan produk Sariroti.',
        placement: 'bottom',
      },
      {
        selector: '.guide-category-filters',
        title: 'Filter Kategori',
        content: 'Klik kategori untuk menampilkan produk sesuai pilihan. Pilihan: Semua, Makanan, Minuman, Snack untuk Kantin. Untuk Kopi: Roti Tawar, Roti Manis, Kue, dll.',
        placement: 'bottom',
      },
      {
        selector: '.guide-search',
        title: 'Cari Produk',
        content: 'Ketik nama produk untuk mencari dengan cepat. Fitur pencarian mendukung pencocokan sebagian nama.',
        placement: 'bottom',
      },
      {
        selector: '.guide-product-card',
        title: 'Kartu Produk',
        content: 'Setiap kartu menampilkan foto, nama, harga, dan stok produk. Klik kartu untuk melihat detail lengkap. Jika stock < 5, akan tampil peringatan.',
        placement: 'top',
      },
      {
        selector: '.guide-product-add',
        title: 'Tambah ke Keranjang',
        content: 'Tekan tombol "+" untuk menambah produk ke keranjang. Tekan "-" untuk mengurangi jumlah. Quantity langsung bisa diubah di kartu produk.',
        placement: 'top',
      },
      {
        selector: '.guide-cart-btn',
        title: 'Buka Keranjang',
        content: 'Klik ikon keranjang untuk melihat semua item yang dipilih, isi data pembeli, dan lanjut ke pembayaran. Badge merah menunjukkan jumlah item.',
        placement: 'bottom',
      },
      {
        selector: '.guide-history-btn',
        title: 'Riwayat Pesanan',
        content: 'Klik ikon jam untuk melihat semua pesanan Anda. Di sini Anda bisa lihat status: Pending, Sukses, atau Gagal. Untuk produk digital, SN akan muncul di sini.',
        placement: 'bottom',
      },
      {
        selector: '.guide-profile-btn',
        title: 'Profil & Pengaturan',
        content: 'Klik ikon user untuk melihat profil, saldo points, dan pengaturan akun. Anda juga bisa mengatur preferensi dark mode di sini.',
        placement: 'bottom',
      },
      {
        selector: '.guide-notif-btn',
        title: 'Notifikasi',
        content: 'Klik lonceng untuk melihat notifikasi terbaru, seperti status pesanan dan pengumuman. Badge merah menunjukkan jumlah notifikasi yang belum dibaca.',
        placement: 'bottom',
      },
    ],
  },
  {
    page: '/kiosk/cart',
    steps: [
      {
        selector: 'body',
        title: 'Halaman Keranjang',
        content: 'Di sini Anda bisa review semua item yang dipilih, ubah jumlah, atau hapus item yang tidak jadi dibeli. Pastikan semua data benar sebelum checkout.',
        placement: 'center',
      },
      {
        selector: '.guide-cart-items',
        title: 'Daftar Item',
        content: 'Lihat semua produk yang sudah dipilih. Gunakan tombol "+" dan "-" untuk ubah jumlah. Tekan tombol hapus jika ingin menghapus item dari keranjang.',
        placement: 'top',
      },
      {
        selector: '.guide-cart-buyer-info',
        title: 'Data Pembeli',
        content: 'Wajib diisi: Nama lengkap dan Nomor HP. Data ini digunakan untuk konfirmasi pesanan dan notifikasi. Jika sudah login, data akan terisi otomatis.',
        placement: 'top',
      },
      {
        selector: '.guide-cart-summary',
        title: 'Ringkasan Belanja',
        content: 'Lihat subtotal, estimasi MDR (biaya payment), dan total yang harus dibayar. MDR bersifat estimasi, total final mengikuti metode pembayaran.',
        placement: 'top',
      },
      {
        selector: '.guide-cart-checkout-btn',
        title: 'Lanjut ke Pembayaran',
        content: 'Klik tombol "Checkout" untuk melanjutkan ke pemilihan metode pembayaran. Pastikan semua data benar dan item sudah sesuai.',
        placement: 'bottom',
      },
    ],
  },
  {
    page: '/kiosk/checkout',
    steps: [
      {
        selector: 'body',
        title: 'Halaman Pembayaran',
        content: 'Pilih metode pembayaran yang diinginkan. Tersedia beberapa opsi: QRIS, Upload Bukti Transfer, dan Loyalty Points. Pilih yang paling nyaman untuk Anda.',
        placement: 'center',
      },
      {
        selector: '.guide-payment-methods',
        title: 'Metode Pembayaran',
        content: 'Tersedia 3 metode: (1) QRIS - scan kode QR via m-banking, paling cepat; (2) Upload Bukti - transfer lalu upload struk; (3) Points - gunakan saldo points Anda.',
        placement: 'top',
      },
      {
        selector: '.guide-payment-qris',
        title: 'Pembayaran QRIS',
        content: 'Pilih "QRIS" untuk pembayaran instan via scan. Sistem akan menampilkan QR code yang bisa di-scan dengan aplikasi m-banking apapun (BCA, Mandiri, BRI, dll).',
        placement: 'top',
      },
      {
        selector: '.guide-payment-upload',
        title: 'Upload Bukti Transfer',
        content: 'Pilih metode ini untuk transfer manual. Anda akan melihat nomor rekening tujuan. Setelah transfer, upload bukti transfer dan sistem akan verifikasi.',
        placement: 'top',
      },
      {
        selector: '.guide-payment-points',
        title: 'Bayar dengan Points',
        content: 'Jika Anda memiliki Loyalty Points yang cukup, pilih metode ini. 1 Point = Rp 1. Poin diperoleh dari setiap transaksi sukses (1% dari total).',
        placement: 'top',
      },
      {
        selector: '.guide-checkout-summary',
        title: 'Ringkasan Pembayaran',
        content: 'Lihat kembali total yang harus dibayar. Untuk QRIS Direct, ada countdown 15 menit sebelum expired. Jika expired, buat transaksi baru.',
        placement: 'top',
      },
      {
        selector: '.guide-checkout-pay-btn',
        title: 'Bayar Sekarang',
        content: 'Klik tombol "Bayar Sekarang" untuk memproses pembayaran. Jangan tutup halaman selama proses. Setelah sukses, Anda akan diarahkan ke halaman sukses.',
        placement: 'bottom',
      },
    ],
  },
  {
    page: '/kiosk/success',
    steps: [
      {
        selector: 'body',
        title: 'Transaksi Berhasil!',
        content: 'Selamat! Pembayaran Anda sudah diterima. Di halaman ini Anda akan melihat detail pesanan dan langkah selanjutnya sesuai jenis produk yang dibeli.',
        placement: 'center',
      },
      {
        selector: '.guide-success-summary',
        title: 'Ringkasan Pesanan',
        content: 'Lihat Order ID, total yang dibayar, dan daftar item. Simpan Order ID ini untuk referensi saat pengambilan barang.',
        placement: 'top',
      },
      {
        selector: '.guide-success-digital',
        title: 'Produk Digital',
        content: 'Untuk produk digital (Pulsa, PLN, Game), SN/Token akan muncul di sini setelah diproses oleh sistem. Tunggu beberapa saat jika masih "Processing".',
        placement: 'top',
      },
      {
        selector: '.guide-success-sariroti',
        title: 'Produk Roti (Sariroti)',
        content: 'Untuk produk roti Sariroti, pesanan Anda sedang diproses. Admin akan memproduksi roti dan menginformasikan ketika sudah siap diambil.',
        placement: 'top',
      },
      {
        selector: '.guide-success-print-delivery',
        title: 'Cetak Delivery Note',
        content: 'Untuk produk Sariroti, klik tombol "Cetak Delivery Note" untuk mencetak bukti pengambilan. Tunjukkan nota ini saat mengambil barang di lokasi Sariroti.',
        placement: 'top',
      },
      {
        selector: '.guide-success-continue',
        title: 'Lanjut Belanja',
        content: 'Klik "Lanjut Belanja" untuk kembali ke katalog. Pesanan Anda sudah tercatat dan bisa dilihat di halaman Riwayat.',
        placement: 'bottom',
      },
    ],
  },
  {
    page: '/kiosk/history',
    steps: [
      {
        selector: 'body',
        title: 'Riwayat Pesanan',
        content: 'Di halaman ini Anda bisa melihat semua transaksi yang pernah dilakukan. Filter berdasarkan status untuk memudahkan pencarian.',
        placement: 'center',
      },
      {
        selector: '.guide-history-filters',
        title: 'Filter Status',
        content: 'Pilih tab untuk filter: Semua, Pending (menunggu bayar), Sukses (berhasil), atau Gagal. Default menampilkan semua transaksi.',
        placement: 'top',
      },
      {
        selector: '.guide-history-search',
        title: 'Cari Transaksi',
        content: 'Ketik Order ID atau nama produk untuk mencari transaksi tertentu. Pencarian bersifat realtime.',
        placement: 'top',
      },
      {
        selector: '.guide-history-list',
        title: 'Daftar Transaksi',
        content: 'Setiap kartu menampilkan tanggal, Order ID, total, dan status. Klik kartu transaksi untuk melihat detail lengkap.',
        placement: 'top',
      },
      {
        selector: '.guide-history-detail',
        title: 'Detail Transaksi',
        content: 'Di modal detail, Anda bisa melihat: daftar item, receipt image (jika ada), status Sariroti, dan SN untuk produk digital. Klik "Cek Paksa" jika SN belum masuk.',
        placement: 'top',
      },
      {
        selector: '.guide-history-cancel',
        title: 'Batalkan Pesanan',
        content: 'Untuk transaksi dengan status "Pending", Anda bisa klik "Batalkan Pesanan" jika tidak jadi membeli. Stock akan dikembalikan secara otomatis.',
        placement: 'top',
      },
    ],
  },
  {
    page: '/kiosk/digital',
    steps: [
      {
        selector: 'body',
        title: 'Produk Digital (PPOB)',
        content: 'Halaman untuk membeli produk digital seperti Pulsa, Paket Data, Token PLN, Voucher Game, dan lainnya. Pembelian diproses instant oleh sistem Digiflazz.',
        placement: 'center',
      },
      {
        selector: '.guide-digital-categories',
        title: 'Pilih Kategori',
        content: 'Pilih kategori produk: Pulsa, Paket Data, Token PLN, Voucher Game (Mobile Legends, Free Fire, dll), E-Money, PDAM, BPJS, dan Internet/TV.',
        placement: 'bottom',
      },
      {
        selector: '.guide-digital-input',
        title: 'Input Nomor/ID',
        content: 'Setelah pilih kategori, masukkan nomor HP/ID pelanggan. Untuk Pulsa/Data, sistem akan auto-detect provider (Telkomsel, XL, dll) dari nomor yang dimasukkan.',
        placement: 'top',
      },
      {
        selector: '.guide-digital-products',
        title: 'Pilih Produk',
        content: 'Lihat daftar produk dan harga. Harga sudah termasuk markup Rp 2.000. Pilih produk yang sesuai dengan kebutuhan Anda.',
        placement: 'top',
      },
      {
        selector: '.guide-digital-buy-btn',
        title: 'Beli Sekarang',
        content: 'Klik tombol "Beli" pada produk yang dipilih. Anda akan langsung diarahkan ke halaman checkout untuk menyelesaikan pembayaran.',
        placement: 'top',
      },
      {
        selector: '.guide-digital-inquiry',
        title: 'Inquiry Tagihan',
        content: 'Untuk PLN Pascabayar, PDAM, dan BPJS: setelah masukkan nomor, klik "Cek Tagihan" untuk melihat nominal yang harus dibayar. Baru kemudian bisa checkout.',
        placement: 'top',
      },
    ],
  },
  {
    page: '/kiosk/preorder',
    steps: [
      {
        selector: 'body',
        title: 'Pre-Order Produk',
        content: 'Halaman untuk memesan produk yang belum ready - seller akan menyediakan sesuai jadwal yang mereka tentukan. Bisa untuk semua jenis produk: makanan, minuman, roti, dll.',
        placement: 'center',
      },
      {
        selector: '.guide-preorder-products',
        title: 'Pilih Produk Pre-Order',
        content: 'Lihat produk yang tersedia untuk Pre-Order. Setiap produk menampilkan info: nama, harga, tipe pengambilan (Hari Ini/Besok/Kustom), dan cutoff time order.',
        placement: 'top',
      },
      {
        selector: '.guide-preorder-modal',
        title: 'Form Pre-Order',
        content: 'Klik produk untuk membuka modal. Isi: Jumlah pesanan, Nama pengambil, Nomor HP, dan Tipe pengambilan. Untuk "Kustom", pilih tanggal pengambilan.',
        placement: 'top',
      },
      {
        selector: '.guide-preorder-pay',
        title: 'Bayar Sekarang',
        content: 'Setelah isi form, klik "Bayar" untuk memproses pembayaran via iPaymu. Pembayaran harus diselesaikan sekarang, pengambilan sesuai jadwal yang dipilih.',
        placement: 'bottom',
      },
      {
        selector: '.guide-preorder-pickup-info',
        title: 'Info Pengambilan',
        content: 'Setelah bayar, Anda akan mendapat notifikasi saat produk siap diambil. Datang ke lokasi sesuai jadwal yang dipilih, tunjukkan bukti order.',
        placement: 'top',
      },
    ],
  },
  {
    page: '/portal/profile',
    steps: [
      {
        selector: 'body',
        title: 'Profil & Pengaturan',
        content: 'Halaman untuk melihat dan mengelola data akun Anda. Sekarang terpusat di Portal untuk memudahkan pengaturan keamanan dan data diri.',
        placement: 'center',
      },
      {
        selector: '.guide-profile-info',
        title: 'Informasi Akun',
        content: 'Lihat data diri: Nama, NIK, Email, dan Nomor HP. Data ini digunakan untuk login dan notifikasi. Anda bisa mengubah nama dan WhatsApp di sini.',
        placement: 'top',
      },
      {
        selector: '.guide-profile-security',
        title: 'Keamanan Akun',
        content: 'Bagian untuk mengganti password Anda secara berkala demi keamanan akun anggota.',
        placement: 'top',
      },
      {
        selector: '.guide-profile-points',
        title: 'Loyalty Points',
        content: 'Lihat saldo Loyalty Points Anda. Poin diperoleh dari setiap transaksi sukses (1% dari total). 1 Point = Rp 1. Points bisa digunakan saat checkout.',
        placement: 'top',
      },
      {
        selector: '.guide-profile-darkmode',
        title: 'Pengaturan Tampilan',
        content: 'Aktifkan/nonaktifkan Dark Mode sesuai preferensi. Sistem juga bisa auto-switch ke dark mode berdasarkan waktu (18:00 - 06:00).',
        placement: 'top',
      },
      {
        selector: '.guide-profile-guide-btn',
        title: 'Panduan Interaktif',
        content: 'Klik tombol ini untuk memulai ulang Panduan Interaktif. Berguna jika Anda ingin mempelajari ulang cara penggunaan aplikasi.',
        placement: 'top',
      },
    ],
  },
];

export const SELLER_GUIDES: PageGuide[] = [
  {
    page: '/dashboard/seller',
    steps: [
      {
        selector: 'body',
        title: 'Dashboard Penjual',
        content: 'Selamat datang di Dashboard Penjual! Di halaman ini Anda bisa memantau performa toko, mengelola produk, dan menarik saldo.',
        placement: 'center',
      },
      {
        selector: '.guide-seller-stats',
        title: 'Statistik Toko',
        content: 'Lihat ringkasan: Total Produk yang dijual, Total Penjualan, Saldo Tersedia, dan Total Penarikan yang sudah dilakukan.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-lowstock',
        title: 'Peringatan Stok Menipis',
        content: 'Jika ada produk dengan stock < 5, akan tampil peringatan di sini. Segera restock untuk menghindari kehilangan penjualan.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-recent-tx',
        title: 'Transaksi Terbaru',
        content: 'Lihat 5 transaksi terbaru yang mengandung produk Anda. Setiap item menampilkan: nama produk, jumlah, dan status pembayaran.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-sidebar',
        title: 'Menu Navigasi',
        content: 'Gunakan sidebar untuk navigasi: Ringkasan, Produk, Transaksi, Penarikan, dan Pre-Order. Klik menu untuk berpindah halaman.',
        placement: 'right',
      },
    ],
  },
  {
    page: '/dashboard/seller/products',
    steps: [
      {
        selector: 'body',
        title: 'Kelola Produk',
        content: 'Halaman untuk mengelola semua produk yang Anda jual. Anda bisa menambah, mengedit, atau menonaktifkan produk.',
        placement: 'center',
      },
      {
        selector: '.guide-seller-add-product',
        title: 'Tambah Produk Baru',
        content: 'Klik tombol "Tambah Produk" untuk menambah produk baru. Isi: Nama, Deskripsi, Harga, Stok, Kategori, dan upload Gambar.',
        placement: 'bottom',
      },
      {
        selector: '.guide-seller-product-list',
        title: 'Daftar Produk',
        content: 'Lihat semua produk Anda dalam bentuk kartu. Setiap kartu menampilkan: foto, nama, harga, stock, dan status aktif/nonaktif.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-product-edit',
        title: 'Edit Produk',
        content: 'Klik icon edit (pensil) pada produk untuk mengubah data. Anda bisa ubah: nama, harga, stock, deskripsi, atau gambar produk.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-product-toggle',
        title: 'Aktif/Nonaktifkan',
        content: 'Gunakan toggle on/off pada produk untuk mengaktifkan atau menonaktifkan. Produk nonaktif tidak akan tampil di katalog pembeli.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-import-csv',
        title: 'Import CSV',
        content: 'Klik "Import CSV" untuk import banyak produk sekaligus. Download template, isi data (name, price, stock, category), lalu upload file.',
        placement: 'bottom',
      },
    ],
  },
  {
    page: '/dashboard/seller/transactions',
    steps: [
      {
        selector: 'body',
        title: 'Transaksi Penjualan',
        content: 'Lihat semua transaksi yang mengandung produk Anda. Filter berdasarkan tanggal dan status untuk memudahkan pencarian.',
        placement: 'center',
      },
      {
        selector: '.guide-seller-tx-filters',
        title: 'Filter Transaksi',
        content: 'Pilih rentang tanggal dan status (All, Pending, Success, Failed) untuk filter transaksi. Pencarian membantu Anda menemukan transaksi tertentu.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-tx-list',
        title: 'Daftar Transaksi',
        content: 'Setiap kartu menampilkan: tanggal, Order ID, item yang Anda jual, jumlah, subtotal, dan status. Total ditampilkan di bawah daftar.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-tx-detail',
        title: 'Detail Transaksi',
        content: 'Klik transaksi untuk melihat detail lengkap: daftar item yang Anda jual, data pembeli (nama, HP), dan status pembayaran.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-tx-export',
        title: 'Export Laporan',
        content: 'Klik "Export Excel" untuk mengunduh laporan transaksi dalam format Excel. Berguna untuk bookkeeping dan laporan harian.',
        placement: 'bottom',
      },
    ],
  },
  {
    page: '/dashboard/seller/withdrawals',
    steps: [
      {
        selector: 'body',
        title: 'Penarikan Saldo',
        content: 'Halaman untuk menarik saldo penjualan ke rekening bank Anda. Saldo diperoleh dari 92% setiap transaksi sukses (8% adalah fee untuk operasional).',
        placement: 'center',
      },
      {
        selector: '.guide-seller-withdraw-balance',
        title: 'Saldo Tersedia',
        content: 'Lihat saldo yang tersedia untuk penarikan. Nominal ini sudah bersih setelah dikurangi fee 8%. Maksimal penarikan = saldo tersedia.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-withdraw-request',
        title: 'Ajukan Penarikan',
        content: 'Klik tombol "Request Penarikan" untuk menarik saldo. Isi: Jumlah, Bank tujuan, Nomor Rekening, dan Nama Penerima. Pastikan data benar.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-withdraw-fee',
        title: 'Biaya Admin',
        content: 'Ada biaya admin 8% dari jumlah penarikan, mencakup: biaya transfer antarbank (2.5%), operasional platform (3%), cadangan dana darurat (1.5%), dan maintenance web (1%).',
        placement: 'top',
      },
      {
        selector: '.guide-seller-withdraw-history',
        title: 'Riwayat Penarikan',
        content: 'Lihat riwayat penarikan: Pending (menunggu approve), Completed (sudah ditransfer), Rejected (ditolak). Admin akan memproses request Anda.',
        placement: 'top',
      },
    ],
  },
  {
    page: '/dashboard/seller/pre-orders',
    steps: [
      {
        selector: 'body',
        title: 'Kelola Pre-Order',
        content: 'Halaman untuk mengatur produk yang bisa di-pre-order dan melihat pesanan pre-order dari pembeli. Pre-Order cocok untukpesanan besar.',
        placement: 'center',
      },
      {
        selector: '.guide-seller-po-config',
        title: 'Tab Konfigurasi',
        content: 'Di tab "Konfigurasi", Anda bisa mengatur: produk mana yang bisa di-pre-order, tipe pengambilan (Hari Ini/Besok/Kustom), dan cutoff time order.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-po-add-config',
        title: 'Tambah Konfigurasi',
        content: 'Klik "Tambah Konfigurasi" untuk membuat produk bisa di-pre-order. Pilih produk, set tipe pengambilan, set cutoff time, lalu aktifkan.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-po-orders',
        title: 'Tab Pesanan',
        content: 'Di tab "Pesanan", lihat semua pre-order dari pembeli. Setiap pesanan menampilkan: produk, jumlah, jadwal pengambilan, dan status.',
        placement: 'top',
      },
      {
        selector: '.guide-seller-po-update-status',
        title: 'Update Status',
        content: 'Klik pesanan untuk update status: Pending → Confirmed (sudah diterima) → Ready (siap diambil). Buyer akan mendapat notifikasi setiap perubahan.',
        placement: 'top',
      },
    ],
  },
];

export const ALL_GUIDES = [...BUYER_GUIDES, ...SELLER_GUIDES];

export function getGuideForPage(pathname: string, role?: string): PageGuide | null {
  const page = ALL_GUIDES.find(
    (g) => g.page === pathname
  );
  return page || null;
}

export function resetGuideProgress(page: string, userId: string, role: string) {
  localStorage.removeItem(`guide_${page}_${role}_${userId}`);
}

export function resetAllGuides(userId: string, role: string) {
  ALL_GUIDES.forEach((g) => {
    localStorage.removeItem(`guide_${g.page}_${role}_${userId}`);
  });
}