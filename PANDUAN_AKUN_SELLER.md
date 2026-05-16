# 📘 PANDUAN PENGGUNAAN AKUN SELLER - SPS CORNER

---

## 1. LOGIN

**Langkah-langkah:**
1. Buka halaman `/login`
2. Pada tab "Masuk", masukkan **NIK** dan **Password** Anda
3. Klik tombol **"Masuk"**
4. Sistem akan mendeteksi role Anda sebagai seller
5. Anda akan diarahkan ke `/dashboard/seller`

---

## 2. KELOLA PRODUK

**URL:** `/dashboard/seller/products`

### 2.1 Menambah Produk Baru

**Langkah-langkah:**
1. Di halaman produk, klik tombol **"Tambah Produk"** atau ikon **+**
2. Formulir produk akan muncul, isi data berikut:
   - **Nama Produk** (wajib diisi)
   - **Deskripsi** (opsional)
   - **Harga** (wajib, dalam Rupiah)
   - **Stok** (wajib, angka)
   - **Kategori** (pilih: Kantin / Kopi / Roti / Lainnya)
   - **Gambar** (upload file atau masukkan URL gambar)
3. Klik tombol **"Simpan"**
4. Produk baru akan muncul di daftar dan tersedia di Kiosk

### 2.2 Mengedit Produk

**Langkah-langkah:**
1. Cari produk yang ingin diedit di daftar produk
2. Klik ikon **edit** (pensil) pada baris produk tersebut
3. Formulir edit akan muncul, ubah data yang diperlukan
4. Klik tombol **"Update"** untuk menyimpan perubahan

### 2.3 Mengupdate Stok

**Langkah-langkah:**
1. Cari produk di daftar
2. Klik ikon **edit** (pensil)
3. Ubah angka pada field **Stok**
4. Klik **"Update"**

### 2.4 Mengaktifkan/Menonaktifkan Produk

**Langkah-langkah:**
1. Cari produk di daftar
2. Klik tombol **toggle on/off** pada produk tersebut
3. Produk yang dinonaktifkan tidak akan muncul di katalog Kiosk

### 2.5 Import Produk Bulk (CSV)

**Langkah-langkah:**
1. Klik tombol **"Import CSV"**
2. Download template CSV yang disediakan
3. Isi template dengan format: `name, price, stock, category`
4. Upload file CSV yang sudah diisi
5. Sistem akan mengimpor data produk

---

## 3. KELOLA PRE-ORDER

**URL:** `/dashboard/seller/pre-orders`

### 3.1 Konfigurasi Pre-Order

**Langkah-langkah:**
1. Buka tab **"Konfigurasi"**
2. Pilih produk yang ingin diaktifkan untuk Pre-Order dari dropdown
3. Pengaturan **Tipe Pengambilan**:
   - **same_day** → Pembeli ambil hari ini
   - **next_day** → Pembeli ambil besok
   - **custom_days** → Pembeli ambil X hari dari sekarang
4. Atur **Cutoff Time** (batas jam order, contoh: 14:00)
5. Aktifkan atau nonaktifkan dengan toggle
6. Klik **"Simpan"**

### 3.2 Mengelola Pesanan Pre-Order

**Langkah-langkah:**
1. Buka tab **"Pesanan"**
2. Daftar pesanan Pre-Order akan ditampilkan
3. Filter berdasarkan status: **pending** / **confirmed** / **ready**
4. Untuk mengubah status pesanan:
   - Klik pada pesanan
   - Ubah status:
     - `pending` → `confirmed` (dikonfirmasi, akan diproduksi)
     - `confirmed` → `ready` (siap diambil)
5. Sistem akan otomatis mengirim notifikasi ke pembeli

---

## 4. MELIHAT TRANSAKSI

**URL:** `/dashboard/seller/transactions`

### 4.1 Mencari dan Filter Transaksi

**Langkah-langkah:**
1. Di halaman transaksi, gunakan **Search** untuk mencari berdasarkan Transaction ID
2. Gunakan **Filter Tanggal** untuk memilih rentang tanggal
3. Filter berdasarkan status: **All** / **Pending** / **Success** / **Failed**
4. Filter berdasarkan metode pembayaran jika diperlukan

### 4.2 Melihat Detail Transaksi

**Langkah-langkah:**
1. Klik pada baris transaksi yang ingin dilihat
2. Detail transaksi akan muncul menampilkan:
   - Item yang Anda jual
   - Jumlah dan harga per item
   - Subtotal
   - Status pembayaran
   - Informasi pembeli
   - Waktu transaksi

### 4.3 Export Laporan

**Langkah-langkah:**
1. Atur filter tanggal yang diinginkan
2. Klik tombol **"Export Excel"**
3. File Excel akan terdownload

---

## 5. REQUEST WITHDRAWAL

**URL:** `/dashboard/seller/withdrawals`

### 5.1 Mengajukan Penarikan

**Langkah-langkah:**
1. Buka halaman Withdrawal
2. Periksa **Saldo Tersedia** (Balance)
3. Klik tombol **"Request Penarikan"**
4. Isi formulir penarikan:
   - **Jumlah Penarikan** (maksimal sesuai saldo)
   - **Bank Tujuan**: Bank Merah Putih
   - **Nomor Rekening**
   - **Nama Penerima** (harus sesuai dengan rekening)
5. Klik tombol **"Ajukan"**
6. Status akan berubah menjadi **"pending"** (menunggu persetujuan admin)

### 5.2 Biaya Penarikan (Fee)

```
Fee: 8% dari jumlah penarikan
Contoh:
  Request: Rp 1.000.000
  Fee:    Rp 80.000
  Diterima: Rp 920.000
```

### 5.3 Status Penarikan

| Status | Keterangan |
|--------|-------------|
| **pending** | Menunggu persetujuan admin |
| **completed** | Approved, saldo dikurangi, transfer dilakukan |
| **rejected** | Ditolak, saldo tetap sama |

---

## 6. AKSES PORTAL

Sebagai seller, Anda juga bisa mengakses Portal Serikat:

**URL:** `/portal`

**Langkah-langkah:**
1. Dari sidebar, klik menu **Portal** atau akses langsung `/portal`
2. Menu yang tersedia:
   - **Dashboard** - Stats portal
   - **Pengaduan & Pembelaan** - Sampaikan masalah
   - **Pengumuman Serikat** - Info dari manajemen
   - **Program Serikat** - Program yang tersedia
   - **Kritik & Saran** - Masukan untuk bipartit
   - **Profil** - Edit data diri

---

## CATATAN PENTING

- **92%** dari setiap transaksi sukses masuk ke saldo Anda
- **8%** sisanya untuk operasional platform
- Transaksi yang pending akan otomatis dibatalkan setelah **5 menit**
- Stock produk di-hold selama **3 menit** saat pembeli checkout