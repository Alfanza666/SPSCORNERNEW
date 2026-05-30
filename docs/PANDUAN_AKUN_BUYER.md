# 📘 PANDUAN PENGGUNAAN AKUN BUYER - SPS CORNER

---

## 1. LOGIN DAN REGISTRASI

### 1.1 Login dengan NIK

**Langkah-langkah:**
1. Buka halaman `/login`
2. Pilih tab **"Masuk"**
3. Masukkan **NIK** (Nomor Induk Karyawan) Anda
4. Masukkan **Password**
5. Klik tombol **"Masuk"**
6. Sistem akan mendeteksi role Anda dan mengarahkan ke `/kiosk`

### 1.2 Login dengan Google

**Langkah-langkah:**
1. Klik tombol **"Masuk dengan Google"**
2. Anda akan diarahkan ke halaman login Google
3. Pilih akun Google Anda dan berikan izin akses
4. Setelah login, sistem akan mengarahkan ke `/kiosk`

### 1.3 Registrasi Akun Baru

**Langkah-langkah:**
1. Buka halaman `/login`
2. Pilih tab **"Daftar"**
3. Isi formulir registrasi:
   - **NIK** (Nomor Induk Karyawan)
   - **Nama Lengkap**
   - **Email**
   - **Password**
   - **Nomor HP**
4. Klik tombol **"Daftar"**
5. Verifikasi email jika diperlukan
6. Login dengan NIK dan password yang sudah dibuat

---

## 2. BELANJA DI KIOSK

**URL:** `/kiosk`

### 2.1 Cara Belanja Produk Kantin/Kopi

**Langkah-langkah:**
1. Di halaman Kiosk, pilih tab kategori yang diinginkan:
   - **Kantin** → Makanan, Minuman, Snack
   - **Kopi** → Produk kopi/Sariroti
2. Browse produk dengan:
   - Klik tab kategori untuk filter
   - Ketik nama produk di pencarian
3. Klik pada produk yang diinginkan
4. Di modal detail produk:
   - Lihat harga dan ketersediaan stock
   - Atur jumlah dengan tombol **+** dan **-**
   - Klik **"Tambah ke Keranjang"**
5. Klik icon **Keranjang** di pojok kanan atas
6. Di halaman keranjang:
   - Review item yang dipilih
   - Ubah jumlah jika perlu dengan **+** dan **-**
   - Hapus item jika tidak jadi (klik icon trash)
   - Isi **Nama** dan **Nomor HP** (wajib diisi)
7. Klik tombol **"Checkout"**
8. Di halaman checkout:
   - Pilih metode pembayaran:
     - **QRIS** (scan QR code)
     - **Upload Bukti** (transfer manual)
     - **Points** (jika saldo cukup)
   - Klik **"Bayar Sekarang"**
9. Ikuti instruksi sesuai metode pembayaran
10. Setelah payment confirmed:
    - **Kantin** → Ambil langsung di Kantin, tunjukkan receipt/Order ID
    - **Kopi/Roti** → Cetak Delivery Note, ambil sesuai jadwal

---

## 3. PEMBAYARAN

### 3.1 Pembayaran dengan QRIS

**Langkah-langkah:**
1. Saat checkout, pilih **"QRIS"** sebagai metode pembayaran
2. Klik **"Bayar Sekarang"**
3. Sistem akan menampilkan **QR Code** di layar
4. Buka aplikasi **m-banking** di HP Anda
5. Pilih menu **Scan QR** atau **Bayar QRIS**
6. Scan QR code yang ditampilkan di layar
7. Masukkan nominal yang sesuai dan lakukan pembayaran
8. Pembayaran akan terkonfirmasi otomatis (max 15 menit)
9. Status berubah menjadi **success**
10. Ambil barang sesuai petunjuk

### 3.2 Pembayaran dengan Upload Bukti

**Langkah-langkah:**
1. Saat checkout, pilih **"Upload Bukti"** sebagai metode pembayaran
2. Klik **"Bayar Sekarang"**
3. Lihat informasi **nomor rekening** atau **QRIS** untuk transfer
4. Transfer ke rekening yang tertera sesuai nominal
5. Screenshot bukti transfer
6. Upload gambar bukti:
   - Klik **"Upload Bukti"**
   - Pilih file gambar (JPG/PNG, max 5MB)
   - Klik **"Submit"**
7. Sistem akan melakukan verifikasi:
   - **Match** → Approved otomatis
   - **Tidak Match** → Manual review oleh admin
8. Jika approved, status berubah menjadi **success**
9. Ambil barang sesuai petunjuk

### 3.3 Pembayaran dengan Loyalty Points

**Langkah-langkah:**
1. Pastikan Anda sudah login
2. Saat checkout, pilih **"Points"** sebagai metode pembayaran
3. Sistem akan mengecek saldo points Anda
4. Jika saldo cukup (>= total belanja):
   - Klik **"Bayar Sekarang"**
   - Points langsung dipotong
   - Status menjadi **success**
5. Jika saldo tidak cukup:
   - Akan muncul pesan error
   - Pilih metode pembayaran lain

---

## 4. BELANJA PRODUK DIGITAL

**URL:** `/kiosk/digital`

### 4.1 Cara Membeli Pulsa/Data

**Langkah-langkah:**
1. Buka `/kiosk/digital`
2. Pilih kategori **"Pulsa"** atau **"Paket Data"**
3. Masukkan **nomor HP** di field yang tersedia
   - Sistem akan auto-detect provider (Telkomsel, XL, dll)
4. Pilih nominal pulsa/data yang diinginkan
5. Klik **"Beli"** atau **"Tambah ke Keranjang"**
6. lanjut ke checkout dan pembayaran seperti biasa
7. Setelah payment success:
   - SN/Token akan muncul di halaman sukses
   - Untuk pulsa: biasanya instant
   - Jika status "processing", tunggu sebentar atau klik **"Cek Paksa"**

### 4.2 Cara Membeli Token PLN

**Langkah-langkah:**
1. Buka `/kiosk/digital`
2. Pilih kategori **"Token PLN"**
3. Masukkan **ID Meter** (10-12 digit)
4. Pilih nominal token yang diinginkan
5. Klik **"Beli"** → Checkout → Bayar
6. Token akan muncul di halaman sukses

### 4.3 Cara Membeli Voucher Game

**Langkah-langkah:**
1. Buka `/kiosk/digital`
2. Pilih kategori game (Mobile Legends, Free Fire, Genshin, dll)
3. Masukkan:
   - **User ID** (untuk Mobile Legends, juga Zone ID)
   - **Player ID** (untuk Free Fire)
   - Server untuk Genshin
4. Pilih nominal voucher
5. Klik **"Beli"** → Checkout → Bayar
6. SN game akan muncul di halaman sukses

---

## 5. PRE-ORDER

**URL:** `/kiosk/preorder`

**Langkah-langkah:**
1. Buka `/kiosk/preorder`
2. Browse produk yang tersedia untuk Pre-Order
3. Gunakan filter kategori atau pencarian untuk memudahkan
4. Klik pada produk yang diinginkan
5. Di modal checkout, isi data:
   - **Jumlah Pesanan**
   - **Nama Pengambil**
   - **Nomor HP**
   - **Tipe Pengambilan**:
     - **Hari Ini** → Ambil hari ini
     - **Besok** → Ambil besok
     - **Kustom** → Pilih X hari dari sekarang
6. Klik **"Bayar Sekarang"**
7. Pilih metode pembayaran dan selesaikan pembayaran
8. Sistem akan membuat jadwal pengambilan
9. Saat tanggal pengambilan tiba, datang ke lokasi dengan menunjukkan receipt

---

## 6. RIWAYAT PESANAN

**URL:** `/kiosk/history`

### 6.1 Melihat Riwayat Transaksi

**Langkah-langkah:**
1. Klik icon **Clock** (Riwayat) di halaman Kiosk
2. Daftar transaksi akan ditampilkan
3. Filter berdasarkan status: **Semua** / **Pending** / **Sukses** / **Gagal**
4. Gunakan pencarian dengan Order ID jika perlu

### 6.2 Melihat Detail Transaksi

**Langkah-langkah:**
1. Klik pada transaksi yang ingin dilihat
2. Detail transaksi akan menampilkan:
   - Order ID
   - Item yang dipesan
   - Total amount
   - Status pembayaran
   - Waktu transaksi

### 6.3 Mencetak Delivery Note (Untuk Produk Roti/Kopi)

**Langkah-langkah:**
1. Klik pada transaksi produk roti/kopi
2. Jika status sudah **"Siap Diambil"**:
   - Klik tombol **"Cetak Delivery Note"**
   - Print atau screenshot untuk pengambilan

### 6.4 Melihat SN/Token (Untuk Produk Digital)

**Langkah-langkah:**
1. Klik pada transaksi produk digital
2. SN/Token akan ditampilkan di detail
3. Jika belum masuk, klik tombol **"Cek Paksa"**

### 6.5 Membatalkan Pesanan

**Langkah-langkah:**
1. Cari transaksi dengan status **"Pending"**
2. Klik tombol **"Batalkan Pesanan"**
3. Konfirmasi pembatalan
4. Stock akan dikembalikan

---

## 7. LOYALTY POINTS

### 7.1 Mendapatkan Points (Earn)

```
Setiap transaksi sukses → dapat 1% dari total belanja
Contoh: Belanja Rp 100.000 = 1.000 points (1 point = Rp 1)
```

### 7.2 Menggunakan Points

**Langkah-langkah:**
1. Saat checkout, pilih metode pembayaran **"Points"**
2. Pastikan saldo points >= total belanja
3. Klik **"Bayar Sekarang"**
4. Points langsung dipotong
5. Pesanan diproses

### 7.3 Mengecek Saldo Points

**Langkah-langkah:**
1. Buka `/kiosk/profile`
2. Cari bagian **"Poin Loyalitas"** atau **"Loyalty Points"**
3. Saldo points Anda akan ditampilkan

---

## 8. AKSES PORTAL

Sebagai buyer, Anda juga bisa mengakses Portal Serikat:

**URL:** `/portal`

**Langkah-langkah:**
1. Klik menu **Portal** di sidebar atau akses langsung `/portal`
2. Menu yang tersedia:
   - **Dashboard** - Stats anggota, program, pengumuman
   - **Pengaduan & Pembelaan** - Sampaikan masalah dengan aman
   - **Pengumuman Serikat** - Info terbaru dari manajemen SP
   - **Program Serikat** - Kupon, Kurban, Gathering, dll
   - **Kritik & Saran** - Masukan untuk meeting bipartit
   - **Formulir** - Isi formulir yang tersedia
   - **Profil** - Edit data diri

---

## CATATAN PENTING

- Transaksi yang pending akan otomatis dibatalkan setelah **5 menit**
- Stock produk di-hold selama **3 menit** saat Anda klik checkout
- Simpan receipt/Order ID untuk pengambilan barang
- Untuk produk digital, pastikan nomor HP/ID sudah benar sebelum checkout