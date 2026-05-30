# 📘 PANDUAN MENYELURUH SPS CORNER

## DAFTAR ISI

1. [Gambaran Umum](#1-gambaran-umum)
2. [Struktur Website & Login](#2-struktur-website--login)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Panduan per Role](#4-panduan-per-role)
   - [Buyer (Pembeli)](#buyer-pembeli)
   - [Seller (Penjual)](#seller-penjual)
   - [Admin](#admin)
   - [Portal Serikat Pekerja](#portal-serikat-pekerja)
5. [Fitur Lengkap](#5-fitur-lengkap)
6. [Metode Pembayaran](#6-metode-pembayaran)
7. [Business Rules](#7-business-rules)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Gambaran Umum

### Apa itu SPS Corner?

SPS Corner adalah platform e-commerce terintegrasi untuk **Koperasi Karyawan SP-FPS plant Banjarmasin** yang menggabungkan:

| Modul | Deskripsi |
|-------|-----------|
| **Kiosk** | E-commerce untuk membeli produk fisik (Kantin, Kopi, Pre-Order) dan digital (Pulsa, PLN, Game) |
| **Portal Serikat** | Portal untuk anggota serikat pekerja (pengaduan, pengumuman, program, formulir) |
| **Dashboard Seller** | Dashboard untuk seller mengelola produk dan pesanan |
| **Dashboard Admin** | Dashboard untuk admin mengelola seluruh sistem |

### Jenis Produk

| Jenis | Contoh | Karakteristik |
|-------|--------|---------------|
| **Kantin** | Makanan, Minuman, Snack | Ambil langsung setelah bayar |
| **Koperasi** | Roti, Kue, Sariroti | Perlu diproduksi/ditanam dulu (bisa Pre-Order) |
| **Digital** | Pulsa, PLN, Game, E-wallet | Instant delivery via Digiflazz |
| **Pre-Order** | Semua produk | Pesan dulu, ambil sesuai jadwal kesiapan seller |

### Teknologi yang Digunakan

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19 + Vite (SPA), Tailwind CSS, Zustand |
| Backend | Express.js (server.ts), Node.js |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + Google OAuth) |
| Payment | iPaymu (QRIS, VA, Direct) |
| Digital | Digiflazz (PPOB) |
| Email | Gmail SMTP (Nodemailer) |
| AI | Google Gemini (verifikasi receipt) |

---

## 2. Struktur Website & Login

### URL Utama

| Path | Deskripsi |
|------|-----------|
| `/` | Landing page utama |
| `/login` | Halaman login/registrasi |
| `/kiosk` | Halaman Kiosk (pembelian produk) |
| `/portal` | Portal Serikat Pekerja |
| `/dashboard` | Dashboard Admin/Seller |

### Cara Login

```
Pengguna membuka /login
     │
     ├─ Login dengan NIK + Password
     │     └── Cek profiles table → redirect sesuai role
     │
     ├─ Login dengan Google OAuth
     │     ├── Redirect ke Google
     │     ├── Callback ke /auth/callback
     │     └── Redirect ke halaman sesuai role
     │
     └─ Registrasi (untuk member baru)
           ├── Isi NIK, Nama, Email, Password, HP
           └── Setelah daftar, login dengan NIK/password
```

### Redirect Berdasarkan Role

| Role | Redirect ke | Akses ke |
|------|-------------|----------|
| **buyer** | `/kiosk` | Kiosk, Portal |
| **seller** | `/dashboard/seller` | Seller Dashboard, Kiosk, Portal |
| **admin** | `/dashboard/admin` | Semua dashboard, Kiosk, Portal |
| **superadmin** | `/dashboard/admin` | Semua dashboard, Kiosk, Portal |

---

## 3. Arsitektur Sistem

### Alur Request

```
Browser
   │
   ▼
┌─────────────────────────────────────────┐
│  Development: Vite Dev Server (port 3000) │
│  Production: dist/ (SPA static files)    │
└─────────────────────────────────────────┘
   │
   ├─ Halaman (React Router)
   │     └── /kiosk, /portal, /dashboard/*
   │
   └─ API Calls
         │
         ├─ /api/payment/*      → server.ts
         ├─ /api/digital/*      → server.ts
         ├─ /api/admin/*        → server.ts
         └─ /api/transactions/* → server.ts
               │
               ▼
         ┌─────────────────────────────────┐
         │       Express Server (server.ts) │
         └─────────────────────────────────┘
               │
               ├─ Supabase (Database + Auth)
               ├─ iPaymu (Payment Gateway)
               ├─ Digiflazz (PPOB Digital)
               ├─ Gmail SMTP (Email)
               └─ Gemini AI (Receipt Verification)
```

### Struktur Database Utama

#### profiles — Data pengguna

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| role | string | superadmin/admin/seller/buyer |
| name | string | Nama lengkap |
| nik | string | NIK unik (untuk login) |
| phone | string | Nomor HP |
| balance | numeric | Saldo seller (92% penjualan) |
| loyalty_points | numeric | Poin loyalty buyer (1% transaksi) |
| is_active | boolean | Status aktif |

#### products — Katalog produk

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| seller_id | uuid | FK ke profiles.id |
| name | string | Nama produk |
| price | numeric | Harga |
| stock | integer | Stok tersedia |
| category | string | Kategori |
| is_digital | boolean | Apakah produk digital |

#### transactions — Transaksi utama

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| buyer_id | uuid | FK ke profiles.id |
| total_amount | numeric | Total transaksi |
| status | string | pending/success/failed/paid |
| payment_method | string | qris/ipaymu/manual/points |
| receipt_image | string | URL bukti transfer |

---

## 4. Panduan per Role

### BUYER (Pembeli)

#### Akses ke Fitur:

1. **Kiosk** (`/kiosk`)
   - Belanja produk Kantin
   - Belanja produk Kopi/Sariroti
   - Belanja produk Digital
   - Pre-Order produk

2. **Portal Serikat** (`/portal`)
   - Dashboard
   - Pengaduan & Pembelaan
   - Pengumuman Serikat
   - Program Serikat
   - Kritik & Saran
   - Formulir
   - Profil

#### Cara Belanja:

```
LANGKAH 1: Browse Produk
   - Buka /kiosk
   - Pilih tab: Kantin / Kopi / Digital / Pre-Order

LANGKAH 2: Pilih Produk
   - Klik produk → Modal detail
   - Atur jumlah → "Tambah ke Keranjang"

LANGKAH 3: Keranjang
   - Review item
   - Ubah jumlah / hapus jika perlu
   - Isi nama & HP

LANGKAH 4: Checkout
   - Pilih metode pembayaran:
     ├── QRIS (direkomendasikan)
     ├── Upload Bukti Transfer
     └── Loyalty Points
   - Klik "Bayar Sekarang"

LANGKAH 5: Ambil Barang
   - Setelah payment confirmed:
     ├── Kantin → Ambil langsung
     ├── Kopi/Roti → Cetak Delivery Note, ambil sesuai jadwal
     ├── Digital → SN/Token muncul di halaman sukses
```

---

### SELLER (Penjual)

#### Akses ke Fitur:

1. **Seller Dashboard** (`/dashboard/seller`)
   - Dashboard overview
   - Kelola Produk
   - Kelola Pre-Order
   - Transaksi
   - Penarikan Dana (Withdrawal)

2. **Kiosk** (`/kiosk`) - sebagai buyer juga

3. **Portal Serikat** (`/portal`)

#### Cara Kelola Produk:

```
TAMBAH PRODUK BARU:
   1. Buka /dashboard/seller/products
   2. Klik "Tambah Produk"
   3. Isi: Nama, Deskripsi, Harga, Stok, Kategori, Gambar
   4. Klik "Simpan"

UPDATE STOCK:
   1. Cari produk di daftar
   2. Klik icon edit
   3. Ubah jumlah stock

NONAKTIFKAN PRODUK:
   - Klik toggle on/off
   - Produk nonaktif tidak terlihat di katalog
```

#### Request Withdrawal:

```
1. Buka /dashboard/seller/withdrawals
2. Lihat saldo tersedia
3. Klik "Request Penarikan"
4. Isi: Jumlah, Bank, Nomor Rekening, Nama Penerima
5. Klik "Ajukan"
6. Menunggu approval Admin
   - Fee: 8% dari jumlah penarikan
```

---

### ADMIN

#### Akses ke Fitur:

1. **Admin Dashboard** (`/dashboard/admin`)
   - Dashboard Overview
   - Kelola Seller
   - Kelola Kategori
   - Kelola Produk
   - Kelola Transaksi
   - Approve Withdrawal
   - Kelola Loyalty Program
   - Kelola Pengumuman
   - Kelola Scanner
   - Kelola Flashsale
   - Kelola Form Builder

2. **Portal Serikat** (`/portal`)

#### Fitur Utama:

| Fitur | URL | Deskripsi |
|-------|-----|-----------|
| Dashboard | /dashboard/admin | Statistik sistem |
| Sellers | /dashboard/admin/sellers | Kelola data seller |
| Products | /dashboard/admin/products | Kelola semua produk |
| Transactions | /dashboard/admin/transactions | Lihat & approve transaksi |
| Withdrawals | /dashboard/admin/withdrawals | Approve penarikan dana |
| Categories | /dashboard/admin/categories | Kelola kategori |
| Loyalty | /dashboard/admin/loyalty | Kelola program points |
| Announcements | /dashboard/admin/announcements | Kelola pengumuman |
| Flashsale | /dashboard/admin/flashsale | Kelola lelang/flashsale |
| Form Builder | /dashboard/admin/forms | Buat formulir dinamis |
| Form Responses | /dashboard/admin/forms/responses/:formId | Lihat respons formulir |
| Scanner | /dashboard/admin/scanner | Scan untuk validasi |

---

### PORTAL SERIKAT PEKERJA

#### Akses: Semua role (buyer, seller, admin)

#### Menu Utama di Portal:

| Menu | URL | Deskripsi |
|------|-----|-----------|
| Dashboard | /portal | Stats: Anggota, Program Aktif, Pengumuman |
| Pengaduan | /portal/pengaduan | Sampaikan masalah dengan aman & rahasia |
| Pengumuman | /portal/pengumuman | Info terbaru dari manajemen SP |
| Program | /portal/program | Kupon, Kurban, Gathering & lainnya |
| Kritik & Saran | /portal/kritik | Masukan untuk meeting bipartit |
| Formulir | /portal/forms | Daftar formulir yang tersedia |
| Profil | /portal/profile | Lihat & edit profil |

#### Fitur Khusus:

1. **Dashboard Portal**
   - Jumlah anggota terverifikasi
   - Jumlah program aktif
   - Jumlah pengumuman

2. **Pengaduan & Pembelaan**
   - Form pengaduan online
   - Data dijamin rahasia
   - Tindakan dari admin serikat

3. **Program Serikat**
   - Pendaftaran program (Kurban, Gathering, dll)
   - Dynamic form berdasarkan program

4. **Flashsale/Lelang**
   - Lihat aset yang dilelang
   - Ikut bidding (jika tersedia)
   - Lihat status menang/kalah

---

## 5. Fitur Lengkap

### 5.1 Kiosk - Katalog Produk

| Fitur | Deskripsi |
|-------|-----------|
| Tab Toggle | Kantin / Kopi / Digital / Pre-Order |
| Filter Kategori | Klik tab kategori untuk filter |
| Pencarian | Ketik nama produk untuk cari |
| Tambah ke Cart | Klik produk → atur jumlah → tambah |
| Indikator Stock | Tampilkan "Tersisa X pcs" jika < 5 |

### 5.2 Keranjang

| Fitur | Deskripsi |
|-------|-----------|
| List Item | Tampilkan semua item di cart |
| Quantity Controls | +/- untuk ubah jumlah |
| Remove Item | Hapus item |
| Input Buyer Info | Nama & HP wajib |
| Stock Reservation | Hold 3 menit saat checkout |

### 5.3 Checkout & Pembayaran

| Metode | Deskripsi |
|--------|-----------|
| QRIS iPaymu Direct | Scan QR code, instant confirmation |
| QRIS iPaymu Redirect | Redirect ke halaman iPaymu |
| Upload Bukti | Transfer manual, upload receipt, AI verify |
| Loyalty Points | Bayar dengan points (1 point = Rp 1) |

### 5.4 Dynamic Form System (BARU)

**Admin:**
- Buka `/dashboard/admin/forms`
- Buat formulir dengan field dinamis:
  - Text, Textarea, Number, Date, Select, Checkbox
- Atur required/optional per field
- Lihat response di `/dashboard/admin/forms/responses/:formId`

**User (Portal):**
- Buka `/portal/forms`
- Lihat daftar formulir yang tersedia
- Submit respons
- Lihat status submit

### 5.5 Flashsale System (BARU)

**Admin:**
- Buka `/dashboard/admin/flashsale`
- Tambah aset untuk dilelang
- Set harga taksiran, gambar
- Tutup lelang & tentukan pemenang

**User (Portal):**
- Buka `/portal/flashsale`
- Lihat aset yang tersedia
- Booking/mengikuti lelang
- Lihat status menang/kalah

---

## 6. Metode Pembayaran

### 6.1 QRIS (Direkomendasikan)

```
1. Pilih "QRIS" saat checkout
2. Sistem generate payment via iPaymu
3. Tampilkan QR code di layar
4. Buyer scan via m-banking
5. Bayar (timeout 15 menit)
6. iPaymu webhook → Status: pending → paid
7. Buyer bisa ambil barang
```

### 6.2 Upload Bukti Transfer

```
1. Pilih "Upload Bukti" saat checkout
2. Transfer ke rekening yang tertera
3. Upload screenshot bukti transfer
4. AI (Gemini) verifikasi:
   - Jika match → Approved otomatis
   - Jika tidak match → Manual review Admin
5. Jika approved → Pesanan diproses
```

### 6.3 Loyalty Points

```
Earn:
   - Setiap transaksi sukses → dapat 1% dari total
   - Contoh: Belanja Rp 100.000 → dapat 1.000 points

Use:
   - Saat checkout, pilih "Points"
   - Pastikan saldo points >= total belanja
   - Langsung potong points

Cek Saldo:
   - Buka /kiosk/profile
   - Lihat "Poin Loyalitas"
```

---

## 7. Business Rules

### Seller Share
- **92%** dari transaction amount masuk ke seller balance
- **8%** untuk operasional platform

### Loyalty Points
- **1%** dari transaction amount earned sebagai points
- **1 point = Rp 1**
- Tidak bisa di-transfer
- Hangus jika akun dinonaktifkan

### Sariroti Products
- Produk dengan nama/kategori mengandung "roti", "koperasi"
- Trigger email ke admin Sariroti saat transaksi berhasil
- Admin harus konfirmasi "Siap Diambil" di dashboard
- Buyer cetak Delivery Note untuk pengambilan

### Pending Transaction
- Auto-cancel setelah **5 menit** jika tidak ada payment
- Stock reservation expires dalam **3 menit**

### Withdrawal Fee
- **8%** dari jumlah penarikan:
  - 2.5% → Biaya transfer antarbank
  - 3% → Operasional platform
  - 1.5% → Cadangan dana darurat
  - 1% → Maintenance

---

## 8. Troubleshooting

### Masalah Umum & Solusi

| Masalah | Solusi |
|---------|--------|
| Tidak bisa login | Cek NIK & password, coba reset password |
| Stock tidak cukup | Hubungi seller untuk restock |
| Payment gagal | Coba metode lain atau hubungi admin |
| Digital tidak masuk | Klik "Cek Paksa" di halaman success |
| Points tidak masuk | Hubungi admin untuk konfirmasi |
| Form tidak submit | Cek semua field required sudah diisi |
| Flashsale error | Pastikan saldo Digiflazz cukup |

### Cara Hubungi Admin

- Buka `/contact`
- Atau dari Portal: `/portal/pengaduan`
- Atau Kirim email ke admin

---

**Dokumen ini terakhir diperbarui: Mei 2026**