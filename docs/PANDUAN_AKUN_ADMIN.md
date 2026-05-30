# 📘 PANDUAN PENGGUNAAN AKUN ADMIN - SPS CORNER

---

## 1. LOGIN

**Langkah-langkah:**
1. Buka halaman `/login`
2. Masukkan **NIK** dan **Password** akun admin Anda
3. Klik tombol **"Masuk"**
4. Sistem mendeteksi role Anda sebagai admin
5. Anda akan diarahkan ke `/dashboard/admin`

---

## 2. KELOLA TRANSAKSI

**URL:** `/dashboard/admin/transactions`

### 2.1 Melihat Daftar Transaksi

**Langkah-langkah:**
1. Buka `/dashboard/admin/transactions`
2. Pilih tab: **Success** atau **Failed**
3. Gunakan filter:
   - **Search** → Cari berdasarkan Transaction ID
   - **Filter Tanggal** → Pilih start dan end date
   - **Filter Status** → All/Pending/Success/Failed
   - **Filter Payment** → QRIS/Manual/Points

### 2.2 Approve Transaksi Manual Payment

**Langkah-langkah:**
1. Klik pada transaksi yang statusnya **pending**
2. Klik tombol **"Approve"**
3. Sistem akan memproses:
   - Status berubah: pending → success
   - Seller mendapat 92%
   - Buyer mendapat 1% loyalty points
   - Trigger email jika produk Sariroti

### 2.3 Confirm Produk Sariroti (Siap Diambil)

**Langkah-langkah:**
1. Klik pada transaksi yang mengandung produk Sariroti
2. Klik tombol **"Confirm Sariroti"**
3. Status: `sariroti_confirmed = true`
4. Buyer sekarang bisa cetak Delivery Note

### 2.4 Notify Buyer (Siap Diambil)

**Langkah-langkah:**
1. Setelah produk siap diambil
2. Klik tombol **"Notify Ready"**
3. Buyer menerima notifikasi "Siap Diambil"
4. Status: `sariroti_order_status = "ready"`

### 2.5 Cancel Transaksi

**Langkah-langkah:**
1. Klik pada transaksi
2. Klik tombol **"Cancel"**
3. Konfirmasi pembatalan
4. Stock produk dikembalikan
5. Status menjadi **failed**

### 2.6 Export Laporan

**Langkah-langkah:**
1. Atur filter tanggal yang diinginkan
2. Klik tombol **"Export Excel"**
3. File Excel akan terdownload

---

## 3. KELOLA PRODUK

**URL:** `/dashboard/admin/products`

### 3.1 Menambah Produk

**Langkah-langkah:**
1. Klik tombol **"Tambah Produk"**
2. Pilih **Seller** dari dropdown
3. Isi formulir:
   - **Nama Produk**
   - **Deskripsi**
   - **Harga**
   - **Stok**
   - **Kategori**
   - **Gambar** (upload atau URL)
4. Klik **"Simpan"**

### 3.2 Mengedit Produk

**Langkah-langkah:**
1. Cari produk di daftar
2. Klik ikon **edit** (pensil)
3. Ubah data yang diperlukan
4. Klik **"Update"**

### 3.3 Menghapus Produk

**Langkah-langkah:**
1. Cari produk di daftar
2. Klik ikon **trash** (hapus)
3. Konfirmasi penghapusan
4. Produk dihapus dari sistem

### 3.4 Import Produk Bulk (CSV)

**Langkah-langkah:**
1. Klik tombol **"Import CSV"**
2. Download template CSV
3. Isi template dengan format: `name, price, stock, category`
4. Upload file CSV
5. Sistem import data dan buat category jika belum ada

---

## 4. KELOLA SELLER

**URL:** `/dashboard/admin/sellers`

### 4.1 Melihat Daftar Seller

**Langkah-langkah:**
1. Buka `/dashboard/admin/sellers`
2. Daftar seller ditampilkan dengan informasi:
   - Nama, NIK, Total Sales, Balance, Status

### 4.2 Reset Password Seller

**Langkah-langkah:**
1. Klik ikon **kunci** pada seller yang ingin di-reset
2. Password akan di-reset ke default: **"123456"**
3. User wajib ganti password setelah login

### 4.3 Activate/Deactivate Seller

**Langkah-langkah:**
1. Cari seller di daftar
2. Klik tombol **toggle on/off**
3. Seller yang dinonaktifkan tidak bisa login

---

## 5. KELOLA KATEGORI

**URL:** `/dashboard/admin/categories`

### 5.1 Menambah Kategori

**Langkah-langkah:**
1. Klik tombol **"Tambah Kategori"**
2. Isi **Nama Kategori**
3. Centang **"Digital"** jika kategori untuk produk digital
4. Klik **"Simpan"**

### 5.2 Mengedit Kategori

**Langkah-langkah:**
1. Klik ikon **edit** pada kategori
2. Ubah nama atau status digital
3. Klik **"Update"**

### 5.3 Menghapus Kategori

**Langkah-langkah:**
1. Klik ikon **hapus**
2. Konfirmasi penghapusan
3. Note: Tidak bisa hapus jika masih ada produk

---

## 6. KELOLA WITHDRAWAL

**URL:** `/dashboard/admin/withdrawals`

### 6.1 Melihat Request

**Langkah-langkah:**
1. Buka `/dashboard/admin/withdrawals`
2. Daftar request withdrawal ditampilkan
3. Info: User, Jumlah, Bank, Waktu, Status

### 6.2 Approve Withdrawal

**Langkah-langkah:**
1. Klik tombol **"Approve"** pada request
2. Sistem memproses:
   - `seller.balance -= amount`
   - Status = "completed"
3. Transfer dilakukan manual di luar sistem

### 6.3 Reject Withdrawal

**Langkah-langkah:**
1. Klik tombol **"Reject"**
2. Masukkan **alasan penolakan**
3. Status = "rejected"
4. Saldo seller tetap

### 6.4 Lihat History

**Langkah-langkah:**
1. Tab **"Completed"** → Riwayat approved
2. Tab **"Rejected"** → Riwayat ditolak
3. Tab **"All"** → Semua riwayat

---

## 7. KELOLA LOYALTY PROGRAM

**URL:** `/dashboard/admin/loyalty`

### 7.1 Enable/Disable Program

**Langkah-langkah:**
1. Toggle **"loyalty_enabled"** di settings
2. Jika disable → buyer tidak bisa earn/use points

### 7.2 Melihat Member

**Langkah-langkah:**
1. Daftar user dengan loyalty points ditampilkan
2. Urutkan berdasarkan points tertinggi

---

## 8. KELOLA PENGUMUMAN

**URL:** `/dashboard/admin/announcements`

### 8.1 Membuat Pengumuman

**Langkah-langkah:**
1. Klik tombol **"Tambah Pengumuman"**
2. Isi formulir:
   - **Judul**
   - **Konten** (text/HTML)
   - **Tanggal Publish**
   - **Prioritas** (high/normal/low)
3. Klik **"Simpan"**

### 8.2 Mengedit/Hapus Pengumuman

**Langkah-langkah:**
1. Klik ikon **edit** untuk mengubah
2. Klik ikon **hapus** untuk menghapus

---

## 9. KELOLA FLASHSALE

**URL:** `/dashboard/admin/flashsale`

### 9.1 Menambah Aset Lelang

**Langkah-langkah:**
1. Klik tombol **"Tambah Aset"**
2. Isi formulir:
   - **Judul Aset**
   - **Deskripsi**
   - **Harga Taksiran** (estimated_price)
   - **Gambar** (upload ke storage 'flashsale')
3. Klik **"Simpan"**
4. Status default: **"open"**

### 9.2 Menentukan Pemenang

**Langkah-langkah:**
1. Di halaman flashsale, cari aset yang sudah berakhir
2. Lihat daftar participant (booking)
3. Klik **"Tentukan Pemenang"**
4. Pilih winner → Status menjadi **"won"**
5. Participant lain status **"lost"**

### 9.3 Update Status Aset

**Langkah-langkah:**
1. Klik edit pada aset
2. Ubah status: **open** → **sold**
3. Update winner jika sudah ada

---

## 10. KELOLA FORM BUILDER

**URL:** `/dashboard/admin/forms`

### 10.1 Membuat Formulir Baru

**Langkah-langkah:**
1. Klik tombol **"Buat Formulir Baru"**
2. Isi **Judul Formulir** dan **Deskripsi**
3. Klik **"Tambah Field"** untuk menambahkan field:
   - **Text** → Input teks pendek
   - **Textarea** → Input teks panjang
   - **Number** → Input angka
   - **Date** → Input tanggal
   - **Select** → Pilihan satu opsi
   - **Checkbox** → Pilihan banyak opsi
4. Untuk setiap field, atur:
   - **Label** (nama field)
   - **Placeholder** (contoh input)
   - **Required** (wajib diisi atau tidak)
5. Klik **"Simpan"**

### 10.2 Melihat Response

**Langkah-langkah:**
1. Klik **"Lihat Response"** pada formulir
2. Atau akses langsung: `/dashboard/admin/forms/responses/:formId`
3. Daftar response user akan ditampilkan
4. Klik response untuk melihat detail

### 10.3 Export Response

**Langkah-langkah:**
1. Di halaman response, klik **"Export"**
2. Data response akan terdownload

---

## 11. SCANNER

**URL:** `/dashboard/admin/scanner`

### 11.1 Cara Menggunakan Scanner

**Langkah-langkah:**
1. Buka `/dashboard/admin/scanner`
2. Untuk **Scan QR**:
   - Aktifkan kamera
   - Arahkan ke QR code di receipt/Order ID
3. Untuk **Input Manual**:
   - Masukkan Order ID di field yang tersedia
4. Klik **"Cari"**
5. Sistem menampilkan detail order
6. Validasi: cocok → klik **"Konfirmasi Pengambilan"**

---

## 12. SETTINGS

**URL:** `/dashboard/admin/settings`

### 12.1 Mengatur Metode Pembayaran

**Langkah-langkah:**
1. Di bagian Payment Methods:
   - Toggle **QRIS Dynamic** → enable/disable
   - Toggle **QRIS Manual (Upload Bukti)** → enable/disable
   - Toggle **VA BCA** → enable/disable
   - Toggle **VA Mandiri** → enable/disable
   - Toggle **Redirect Payment** → enable/disable

### 12.2 Upload Gambar QRIS

**Langkah-langkah:**
1. Di bagian QRIS Image:
   - Upload gambar QRIS untuk manual payment
   - Buyer akan melihat ini saat pilih "Upload Bukti"

### 12.3 Edit Contact Info

**Langkah-langkah:**
1. Di bagian Contact Info:
   - Edit konten informasi kontak
   - Akan tampil di halaman `/contact`

---

## 13. AKSES PORTAL

Admin juga bisa akses `/portal` untuk mengelola:
- **Pengaduan** - Melihat dan menindaklanjuti pengaduan
- **Pengumuman** - Membuat dan mengelola pengumuman
- **Program** - Mengelola program serikat
- **Kritik** - Melihat kritik dan saran
- **Formulir** - Mengelola formulir

---

## CATATAN PENTING

- Review manual payment dengan teliti sebelum approve
- Cek saldo Digiflazz sebelum approve transaksi digital
- Fee withdrawal 8% sudah otomatis dipotong saat approve
- Status Sariroti harus dikonfirmasikan manual oleh admin