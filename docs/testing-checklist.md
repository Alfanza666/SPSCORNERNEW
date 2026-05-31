# Testing Checklist — SPS Corner

Jalankan checklist ini setiap ada rilis baru untuk memastikan zero regression.

## Auth Flow

- [ ] Login via Google (redirect + callback)
- [ ] Login via NIK + password manual
- [ ] Register akun baru (NIK, nama, HP tersimpan)
- [ ] Lupa password → reset link email
- [ ] Guest checkout tanpa login

## Kiosk (Buyer)

- [ ] Katalog: filter kategori, search, debounce
- [ ] Katalog: tab Pre-Order cutoff time
- [ ] Keranjang: tambah item, update qty, hapus item
- [ ] Keranjang: floating bottom bar muncul
- [ ] Checkout: payment method QRIS/Cash/Poin
- [ ] Checkout: prevent double-click (mutex)
- [ ] Payment iPaymu: redirect + callback success
- [ ] Payment manual: upload receipt → AI verify
- [ ] History: list transaksi, filter status/tanggal
- [ ] History: detail modal status konsisten
- [ ] History: upload ulang receipt untuk pending/failed
- [ ] History: cancel order
- [ ] Profile: edit nama, NIK, HP, alamat

## Admin Dashboard

- [ ] Dashboard: ringkasan statistik
- [ ] Transaksi list: tab Sukses & Gagal
- [ ] Transaksi detail: status badge sesuai `tx.status` (bukan `activeTab`)
- [ ] Transaksi detail: produk fisik status "Selesai" jika sudah paid
- [ ] Seller management: tambah, edit, nonaktifkan
- [ ] Produk: CRUD, upload gambar
- [ ] Kategori: CRUD
- [ ] Laporan: stok, transaksi, error reports
- [ ] Export Excel: transaksi, laporan stok
- [ ] Flash Sale: jadwal, aset, countdown
- [ ] Announcements: buat, publish
- [ ] Doorprize: spin wheel
- [ ] Form Builder: buat pertanyaan, lihat respon

## Seller Dashboard

- [ ] Dashboard: ringkasan penjualan hari ini
- [ ] Produk: tambah, edit, stok
- [ ] Pre-Order: atur cutoff, upload gambar
- [ ] Transaksi: list penjualan
- [ ] Withdrawal: ajukan penarikan saldo

## Portal Serikat

- [ ] Dashboard: statistik anggota
- [ ] Program: lihat program aktif, tukar kupon
- [ ] Pengumuman: baca notifikasi
- [ ] Pengaduan & Kritik: kirim laporan
- [ ] Profile: ganti password

## Push Notification

- [ ] Subscribe: browser minta izin, subscription tersimpan
- [ ] Push dari server: notifikasi muncul di HP (app tertutup)
- [ ] Push dari server: notifikasi muncul di HP (app terbuka)
- [ ] Notifikasi in-app: panel bell berisi
- [ ] Klik notifikasi → navigasi ke halaman tujuan
- [ ] Unsubscribe: tombol nonaktifkan bekerja

## Stock & Transaksi

- [ ] Checkout: stock terpotong di server (double-check DB)
- [ ] Auto-cleanup: transaksi pending >5min → failed → stock restore 1x
- [ ] iPaymu callback gagal: stock restore 1x (tidak double)
- [ ] Cancel order: stock restore
- [ ] Tidak ada stock_inflasi setelah 3x auto-cleanup cycle

## PWA & Mobile

- [ ] Install banner muncul di Chrome Android
- [ ] Service worker terdaftar (devtools → Application)
- [ ] Halaman offline menampilkan fallback
- [ ] Bottom nav mobile: 5 tab navigasi
- [ ] Scan QR: kamera berfungsi (Chrome Android)
- [ ] Layout tidak overflow/terpotong di viewport 375px - 1920px

## Keamanan

- [ ] Endpoint admin return 401 tanpa token
- [ ] Endpoint admin return 403 untuk role non-admin
- [ ] .env tidak tercommit (cek git status)
- [ ] Tidak ada console.error leak di production
