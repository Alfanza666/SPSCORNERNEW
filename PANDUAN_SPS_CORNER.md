# 📘 PANDUAN PENGGUNAAN LENGKAP SPS CORNER

---

## DAFTAR ISI

1. [Gambaran Umum](#1-gambaran-umum)
2. [Role & Hak Akses](#2-role--hak-akses)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Flow Pembelian](#4-flow-pembelian)
5. [Panduan per Role](#5-panduan-per-role)
6. [Metode Pembayaran](#6-metode-pembayaran)
7. [Panduan Lengkap per Fitur](#7-panduan-lengkap-per-fitur)
8. [Business Rules](#8-business-rules)
9. [Panduan Teknis](#9-panduan-teknis)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Gambaran Umum

### Apa itu SPS Corner?

SPS Corner adalah platform e-commerce untuk **Koperasi Karyawan** yang mengintegrasikan penjualan produk fisik dan digital dalam satu sistem.

### Jenis Produk

| Jenis | Contoh | Keterangan |
|-------|--------|-------------|
| **Kantin** | Makanan, Minuman, Snack | Langsung ambil setelah bayar |
| **Koperasi** | Roti, Kue, Sariroti | Produk Sariroti/bengkel roti, perlu diambil nanti (bisa Pre-Order) |
| **Digital** | Pulsa, PLN, Game, E-wallet | Instant delivery via Digiflazz |
| **Pre-Order** | Semua produk | Pesan dulu, ambil sesuai jadwal kesiapan seller |

### Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19 + Vite (SPA), Tailwind CSS, Zustand |
| Backend | Express.js (server.ts), Node.js |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + Google OAuth) |
| Payment | iPaymu (QRIS, VA) |
| Digital | Digiflazz (PPOB) |
| Email | Gmail SMTP (Nodemailer) |
| AI | Google Gemini (verifikasi receipt) |
| Deployment | Vercel (SPA rewrites) |

### Struktur Folder

```
SPSCORNERNEW/
├── src/
│   ├── pages/
│   │   ├── kiosk/          # Halaman pembeli
│   │   ├── dashboard/
│   │   │   ├── admin/      # Dashboard Admin
│   │   │   └── seller/     # Dashboard Seller
│   │   └── portal/         # Halaman Portal
│   ├── store/              # Zustand state management
│   ├── lib/                # Utilities (supabase, utils)
│   └── services/           # iPaymu, Digiflazz clients
├── server.ts               # Backend Express server
├── vercel.json             # Vercel deployment config
├── supabase-schema.sql     # Database schema
└── .env                    # Environment variables
```

---

## 2. Role & Hak Akses

### Tabel Role

| Role | Deskripsi | Fitur Utama |
|------|-----------|-------------|
| **Admin** | Superadmin/Operasional | Kelola semua produk, approve transaksi, manage seller, approve withdrawal, laporan, settings |
| **Seller** | Penjual produk | Kelola produk & stok sendiri, lihat penjualan, request withdrawal |
| **Buyer** | Pembeli (karyawan) | Browse katalog, beli produk, pre-order, lihat history |

### Alur Login

```
Pengguna membuka /login
     │
     ├─ Login dengan NIK + Password
     │     └── Cek profiles table → redirect sesuai role
     │
     ├─ Login dengan Google OAuth
     │     ├── Redirect ke Google
     │     ├── Callback ke /auth/callback
     │     ├── Ambil profil dari Supabase
     │     └── Redirect sesuai role
     │
     └─ Guest (tanpa login)
           └── Bisa checkout, tapi tidak earn points
```

### Redirect Berdasarkan Role

| Role | Redirect ke |
|------|-------------|
| buyer | /portal atau /kiosk |
| seller | /dashboard/seller |
| admin | /dashboard/admin |

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
   │     └── /kiosk, /dashboard/admin, dll
   │
   └─ API Calls
         │
         ├─ /api/payment/*      → server.ts
         ├─ /api/digital/*      → server.ts
         ├─ /api/admin/*        → server.ts
         └─ /api/transactions/*  → server.ts
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

### Struktur Database (Tabel Utama)

#### profiles — Data pengguna

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| role | string | superadmin/admin/seller/buyer |
| name | string | Nama lengkap |
| nik | string | NIK unik (untuk login) |
| phone | string | Nomor HP |
| balance | numeric | Saldo seller (92% penjualan) |
| total_sales | numeric | Total penjualan |
| total_withdrawn | numeric | Total yang sudah di-withdraw |
| total_fee_paid | numeric | Total fee yang sudah dibayar |
| loyalty_points | numeric | Poin loyalty buyer (1% transaksi) |
| is_active | boolean | Status aktif |
| created_at | timestamptz | Timestamp creation |

#### products — Katalog produk

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| seller_id | uuid | FK ke profiles.id |
| name | string | Nama produk |
| description | string | Deskripsi |
| price | numeric | Harga |
| stock | integer | Stok tersedia |
| category | string | Kategori (Sariroti, Roti Tawar, dll) |
| image_url | string | URL gambar |
| is_active | boolean | Status aktif |
| is_digital | boolean | Apakah produk digital |
| created_at | timestamptz | Timestamp creation |

#### transactions — Transaksi utama

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| buyer_name | string | Nama pembeli |
| buyer_id | uuid | FK ke profiles.id (nullable untuk guest) |
| buyer_phone | string | Nomor HP |
| buyer_email | string | Email (di payment_details JSONB) |
| total_amount | numeric | Total transaksi |
| status | string | pending/success/failed/paid |
| payment_method | string | qris/ipaymu/manual/points |
| payment_details | jsonb | Data payment (email, trx_id, dll) |
| receipt_image | string | URL gambar bukti transfer |
| metadata | jsonb | Data tambahan (sariroti status, dll) |
| created_at | timestamptz | Timestamp creation |

#### transaction_items — Item dalam transaksi

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| transaction_id | uuid | FK ke transactions.id |
| product_id | uuid | FK ke products.id (nullable untuk digital) |
| quantity | integer | Jumlah item |
| price | numeric | Harga per item |
| subtotal | numeric | quantity × price |
| seller_id | uuid | FK ke profiles.id |
| metadata | jsonb | Data digital (target_number, sku, sn, status) |

#### stock_reservations — Reserved stock saat checkout

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| product_id | uuid | FK ke products.id |
| quantity | integer | Jumlah di-reserve |
| expires_at | timestamptz | Waktu kedaluwarsa (3 menit) |
| created_at | timestamptz | Timestamp creation |

#### notifications — Notifikasi dalam aplikasi

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| id | uuid | Primary Key |
| user_id | uuid | FK ke profiles.id |
| type | string | transaction/system/announcement |
| title | string | Judul notifikasi |
| message | string | Isi pesan |
| path | string | URL redirect saat diklik |
| is_read | boolean | Sudah dibaca |
| created_at | timestamptz | Timestamp creation |

#### settings — Konfigurasi aplikasi

| Column | Tipe | Deskripsi |
|--------|------|-----------|
| key | string | Primary Key |
| value | text | Nilai konfigurasi |

Key penting di settings:
- `loyalty_enabled`: true/false
- `qris_image_url`: URL gambar QRIS
- `payment_method_qris_dynamic`: true/false
- `payment_method_qris_manual`: true/false
- `contact_info_content`: JSON object

### Database Functions (PL/pgSQL)

```sql
-- Reserve stock saat checkout (hold 3 menit)
reserve_stock(p_product_id, p_quantity, p_expires_in_minutes)
  → Returns reservation_id atau throw error jika stock kurang

-- Release stock saat cancel/expired
release_stock(p_reservation_id)
  → Menghapus reservation

-- Konfirmasi stock deduction setelah payment sukses
confirm_stock_deduction(p_reservation_id)
  → Mengurangi stock produk, buat stock_adjustment record

-- RPC untuk manipulasi stock langsung
decrement_stock(p_id, p_amount)
increment_stock(p_id, p_amount)
```

---

## 4. Flow Pembelian

### 4.1 Flow Kantin (Pembelian Biasa)

```
┌─────────────────────────────────────────────────────────────┐
│  FLOW KANTIN                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [BUYER]                                                    │
│     │                                                       │
│     ▼                                                       │
│  1. BROWSE KATALOG                                          │
│     - Buka /kiosk                                           │
│     - Pilih tab "Kantin"                                    │
│     │  Kategori: Semua, Makanan, Minuman, Snack             │
│     ▼                                                       │
│  2. PILIH PRODUK                                            │
│     - Lihat harga & stock real-time                         │
│     - Klik produk → Modal detail                            │
│     - Atur jumlah → "Tambah ke Keranjang"                   │
│     ▼                                                       │
│  3. KERANJANG (/kiosk/cart)                                 │
│     - Review item                                           │
│     - Ubah jumlah jika perlu                                │
│     - Hapus item jika tidak jadi                            │
│     ▼                                                       │
│  4. CHECKOUT (/kiosk/checkout)                              │
│     - Pilih metode pembayaran:                              │
│     │  ├── QRIS (iPaymu) → bayar sekarang                   │
│     │  ├── Upload Bukti → Gemini AI verify                  │
│     │  └── Points (loyalty)                                 │
│     ▼                                                       │
│  5. BAYAR SEKARANG                                          │
│     │                                                       │
│     ▼                                                       │
│  [SISTEM - OTOMATIS]                                       │
│     │                                                       │
│     ├─ Update status: pending → paid/success                │
│     ├─ Release stock (kurangi dari DB)                      │
│     ├─ Seller balance += 92%                                 │
│     └─ Buyer loyalty points += 1%                           │
│                                                             │
│     ▼                                                       │
│  6. AMBIL DI KANTIN                                         │
│     - Langsung ambil barang                                 │
│     - Tunjukkan receipt / Order ID                           │
│     ▼                                                       │
│  SELESAI ✓                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Flow Kopian (Sariroti)

```
┌─────────────────────────────────────────────────────────────┐
│  FLOW ROTI (SARIROTI)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [BUYER]                                                    │
│     │                                                       │
│     ▼                                                       │
│  1. BROWSE KATALOG                                          │
│     - Buka /kiosk                                           │
│     - Pilih tab "Koperasi"                                      │
│     │  Kategori: Semua, Roti Tawar, Roti Manis,            │
│     │          Roti Sandwich, Kue, Sari Choco               │
│     ▼                                                       │
│  2. PILIH PRODUK                                            │
│     - Lihat harga & stock                                   │
│     - Tambah ke cart                                        │
│     │  → Stock di-HOLD 3 menit                              │
│     ▼                                                       │
│  3. CHECKOUT & BAYAR                                        │
│     - Pilih metode pembayaran                               │
│     - Selesaikan pembayaran                                 │
│     ▼                                                       │
│  [SISTEM - OTOMATIS]                                       │
│     │                                                       │
│     ├─ Update status: pending → paid                        │
│     ├─ Release stock (kurangi dari DB)                     │
│     ├─ Seller balance += 92%                                │
│     ├─ Buyer loyalty points += 1%                           │
│     └─ EMAIL ke Admin Sariroti                             │
│        (Sales.Adm.bjm@sariroti.com)                        │
│        → Subject: "[SPS Corner] Pesanan Baru dari Kiosk"   │
│        → Isi: Detail pesanan, perlu produksi!              │
│                                                             │
│     ▼                                                       │
│  [ADMIN SARIROTI]                                           │
│     │                                                       │
│     ├─ Terima notifikasi email                             │
│     ├─ Produksi roti sesuai pesanan                        │
│     ├─ Konfirmasi "Siap Diambil" via Admin Dashboard       │
│     │     → /dashboard/admin/transactions                  │
│     │     → Klik "Confirm Sariroti"                        │
│     │     → Klik "Notify Ready"                            │
│     └─ Buyer terima notifikasi "Siap Diambil"              │
│                                                             │
│     ▼                                                       │
│  [BUYER]                                                    │
│     │                                                       │
│     ├─ Terima notifikasi "Siap Diambil"                   │
│     ├─ Buka /kiosk/history → Pilih transaksi               │
│     ├─ Klik "Cetak Delivery Note" (tombol di halaman sukses)│
│     └─ Ambil di lokasi Sariroti                            │
│             Tunjukkan Delivery Note                         │
│                                                             │
│     ▼                                                       │
│  SELESAI ✓                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Perbedaan Utama Kantin vs Roti:**

| Aspek | Kantin | Roti (Sariroti) |
|-------|--------|-----------------|
| Ambil barang | Sekarang | Nanti (setelah produksi) |
| Stock | Real-time | Hold 3 menit saat di-cart |
| Email trigger | Tidak | Ya (ke admin Sariroti) |
| Pre-Order | Tidak | Ya (jadwal tertentu) |
| Kategori | Makanan, Minuman, Snack | Roti Tawar, Roti Manis, Kue |
| Proses setelah bayar | Langsung ambil | Tunggu produksi |
| Delivery Note | Tidak perlu | Perlu (cetak untuk pengambilan) |

### 4.3 Flow Produk Digital (PPOB)

```
┌─────────────────────────────────────────────────────────────┐
│  FLOW PRODUK DIGITAL (PPOB)                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [BUYER]                                                    │
│     │                                                       │
│     ▼                                                       │
│  1. BUKA HALAMAN DIGITAL                                    │
│     - Buka /kiosk/digital                                  │
│     ▼                                                       │
│  2. PILIH KATEGORI                                          │
│     │  ├── Pulsa        → Pulsa internet HP                 │
│     │  ├── Paket Data   → Paket data internet               │
│     │  ├── Token PLN    → Token PLN pra-bayar               │
│     │  ├── Tagihan PLN  → Tagihan PLN pascabayar           │
│     │  ├── Voucher Game → Mobile Legends, Free Fire, dll   │
│     │  ├── E-Money      → Top up GoPay, OVO, dll           │
│     │  ├── PDAM         → Tagihan air                      │
│     │  ├── BPJS         → Iuran BPJS                       │
│     │  └── Internet/TV  → WiFi, TV kabel                   │
│     ▼                                                       │
│  3. INPUT NOMOR/ID TARGET                                   │
│     │  → Sistem auto-detect provider (untuk Pulsa/Data)     │
│     │     Contoh: 0812xxx → Telkomsel                       │
│     ▼                                                       │
│  4. PILIH PRODUK & HARGA                                    │
│     │  → Tambah markup Rp 2.000                           │
│     ▼                                                       │
│  5. ADD TO CART                                             │
│     │  → TIDAK ada stock reservation                        │
│     │  → Langsung proses                                    │
│     ▼                                                       │
│  6. CHECKOUT & BAYAR                                        │
│     │  Pilih metode: QRIS / Upload Bukti / Points           │
│     ▼                                                       │
│  [SISTEM - OTOMATIS]                                       │
│     │                                                       │
│     ├─ Cek saldo Digiflazz (sufficient untuk HPP?)          │
│     │     Jika tidak cukup → Error, tidak bisa checkout    │
│     ├─ Update status: paid                                 │
│     └─ Kirim order ke Digiflazz API                       │
│                                                             │
│     ▼                                                       │
│  [DIGIFLAZZ]                                                │
│     │                                                       │
│     ├─ Terima order                                        │
│     ├─ Proses (langsung/instant)                          │
│     ├─ Delivery: SN/Token/Receipt                          │
│     └─ Webhook ke /api/digital/callback                   │
│        → Update transaction_items.metadata.status          │
│        → Status: processing → delivered / failed           │
│                                                             │
│     ▼                                                       │
│  [BUYER]                                                    │
│     │                                                       │
│     ├─ Lihat SN/Token di halaman Sukses (/kiosk/success)   │
│     ├─ Polling status (jika masih processing)               │
│     │     → Auto-refresh setiap 3 detik                   │
│     ├─ Konfirmasi sudah terima                             │
│     └─ Simpan SN/Token                                     │
│                                                             │
│     ▼                                                       │
│  SELESAI ✓                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Input per Kategori Digital:**

| Kategori | Input yang Dibutuhkan |
|----------|----------------------|
| Pulsa | Nomor HP → auto-detect provider dari prefix |
| Paket Data | Nomor HP → auto-detect provider |
| Token PLN | ID Meter (10-12 digit) |
| Tagihan PLN | ID Meter + Nama |
| Mobile Legends | User ID + Zone ID |
| Free Fire | Player ID |
| Genshin | User ID + Server (os_asia/os_usa/os_eu) |
| Valorant | Riot ID |
| E-Money | Nomor HP (untuk top up) |
| PDAM | Nomor pelanggan |
| BPJS | Nomor BPJS |

### 4.4 Flow Pre-Order

```
┌─────────────────────────────────────────────────────────────┐
│  FLOW PRE-ORDER                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [SELLER - Konfigurasi Pre-Order]                          │
│     │                                                       │
│     ▼                                                       │
│  1. BUKA /dashboard/seller/pre-orders                      │
│  2. DI TAB "KONFIGURASI":                                   │
│     - Pilih produk untuk Pre-Order                         │
│     - Set tipe pengambilan:                                │
│     │    ├── same_day    → Ambil hari ini                  │
│     │    ├── next_day    → Ambil besok                     │
│     │    └── custom_days → Ambil X hari dari sekarang      │
│     - Set cutoff time (batas jam order)                   │
│     - Aktifkan/nonaktifkan                                 │
│                                                             │
│  [BUYER]                                                    │
│     │                                                       │
│     ▼                                                       │
│  1. BUKA HALAMAN PRE-ORDER                                │
│     - Buka /kiosk/preorder                                 │
│     ▼                                                       │
│  2. BROWSE PRODUK                                          │
│     - Filter kategori & cari                               │
│     ▼                                                       │
│  3. KLIK PRODUK → MODAL CHECKOUT                           │
│     │                                                       │
│     ▼                                                       │
│  4. ISI DATA:                                               │
│     │  ├── Jumlah pesanan                                   │
│     │  ├── Nama pengambil                                   │
│     │  ├── Nomor HP                                         │
│     │  └── Tipe pengambilan:                                │
│     │       ├── Hari Ini → Ambil hari ini                   │
│     │       ├── Besok → Ambil besok                         │
│     │       └── Kustom (pilih X hari dari sekarang)         │
│     ▼                                                       │
│  5. BAYAR SEKARANG                                          │
│     │  → Via iPaymu                                        │
│     ▼                                                       │
│  [SISTEM - OTOMATIS]                                       │
│     │                                                       │
│     ├─ Buat Pre-Order record di tabel pre_orders           │
│     ├─ Buat Transaction                                     │
│     ├─ Proses payment                                       │
│     └─ Email notifikasi ke admin                           │
│                                                             │
│     ▼                                                       │
│  [ADMIN]                                                    │
│     │                                                       │
│     ├─ Lihat di /dashboard/seller/pre-orders               │
│     ├─ Update status: pending → confirmed → ready           │
│     └─ Notify buyer                                        │
│                                                             │
│     ▼                                                       │
│  [BUYER]                                                    │
│     │                                                       │
│     ├─ Terima notifikasi                                   │
│     └─ Ambil sesuai jadwal di lokasi                       │
│                                                             │
│     ▼                                                       │
│  SELESAI ✓                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Catatan:** Pre-Order bukan hanya untuk roti. Semua produk bisa di-pre-order selama seller mengkonfigurasiinya. Pembeli bisa pesan beberapa hari sebelum jadwal pengambilan.

### 4.5 Flow Pembayaran

```
[CHECKOUT] → [PILIH METODE]
     │
     ├─[QRIS iPaymu Direct]──────────────────────────┐
     │   POST /api/payment/ipaymu/direct             │
     │   → Generate QRIS code                        │
     │   → Buyer scan via m-banking                  │
     │   → Bayar (timeout 15 menit)                  │
     │   → iPaymu webhook ke /api/payment/ipaymu/callback│
     │   → Status: pending → paid                    │
     │                                               │
     ├─[QRIS iPaymu Redirect]────────────────────┐   │
     │   POST /api/payment/ipaymu/create          │   │
     │   → Redirect ke halaman iPaymu             │   │
     │   → Buyer bayar di sana                    │   │
     │   → Redirect back ke /kiosk/success         │   │
     │   → iPaymu webhook callback                │   │
     │                                            │   │
     ├─[Upload Bukti Manual]─────────────────┐   │   │
     │   Buyer transfer ke rekening            │   │   │
     │   Upload bukti → POST /api/payment/manual/verify│
     │   → Gemini AI verifikasi receipt         │   │   │
     │   → Match amount?                        │   │   │
     │   │   ├─ Ya → Approved, proses            │   │   │
     │   │   └─ Tidak → Manual review oleh admin│   │   │
     │                                        │   │   │
     └─[Loyalty Points]────────────────────┐   │   │   │
         Cek saldo points (≥ total?)       │   │   │   │
         POST /api/payment/points/pay       │   │   │   │
         → Langsung potong points           │   │   │   │
         → Langsung proses                  │   │   │   │
                                       │   │   │   │
                                       ▼   ▼   ▼   │
                                 [POST-PAYMENT]    │
                                       │           │
         ┌─────────────────────────────┼───────────┘
         │                             │
         ├─ Release stock (kurangi dari products.stock)
         ├─ Seller balance += 92%
         ├─ Buyer loyalty points += 1%
         ├─ Check low stock (< 5) → Email seller
         ├─ Check Sariroti item → Email admin
         └─ Process digital items (call Digiflazz)
```

---

## 5. Panduan per Role

### 5.1 BUYER (Pembeli)

#### 5.1.1 Login & Registrasi

**Metode 1: Login dengan NIK**

```
1. Buka /login
2. Pilih tab "Masuk"
3. Masukkan:
   - NIK (Nomor Induk Karyawan)
   - Password
4. Klik "Masuk"
5. Jika berhasil → Redirect ke /portal atau /kiosk
```

**Metode 2: Login dengan Google**

```
1. Buka /login
2. Klik "Masuk dengan Google"
3. Redirect ke Google OAuth
4. Setuju akses
5. Callback ke /auth/callback → Ambil profil → Redirect sesuai role
```

**Metode 3: Registrasi (untuk member baru)**

```
1. Buka /login
2. Pilih tab "Daftar"
3. Masukkan:
   - NIK
   - Nama Lengkap
   - Email
   - Password
   - Nomor HP
4. Klik "Daftar"
5. Verifikasi email (jika diperlukan)
6. Login dengan NIK/password
```

#### 5.1.2 Cara Belanja di Kantin

```
LANGKAH 1: Browse Produk
   - Buka /kiosk
   - Pilih tab "Kantin"
   - Cari/browse produk
   - Klik produk → Modal detail
   - Atur jumlah → "Tambah ke Keranjang"

LANGKAH 2: Review Keranjang
   - Klik icon Keranjang (pojok kanan atas)
   - Ubah jumlah jika perlu
   - Hapus item jika tidak jadi
   - Input nama & nomor HP (wajib)

LANGKAH 3: Checkout
   - Klik "Checkout"
   - Pilih metode pembayaran:
     ├── QRIS (paling cepat & direkomendasikan)
     ├── Upload Bukti (transfer manual)
     └── Points (jika cukup saldo points)
   - Selesaikan pembayaran

LANGKAH 4: Ambil Barang
   - Setelah payment confirmed
   - Langsung ambil barang di Kantin
   - Tunjukkan receipt / Order ID

LANGKAH 5: Selesai ✓
   - Notifikasi sukses
   - bisa lihat di /kiosk/history
```

#### 5.1.3 Cara Belanja Produk Kopian (Sariroti)

```
LANGKAH 1: Browse Produk
   - Buka /kiosk
   - Pilih tab "Koperasi"
   - Cari/browse produk Sariroti (roti, kue, dll)
   - Kategori: Roti Tawar, Roti Manis, Kue, Sari Choco
   - Tambah ke Keranjang

LANGKAH 2: Checkout & Bayar
   - Sama seperti Kantin
   - Pilih metode pembayaran
   - Selesaikan pembayaran

LANGKAH 3: Tunggu Produksi (jika tidak ready stock)
   - Sistem kirim EMAIL ke Admin Sariroti (jika applicable)
   - Admin produksi roti sesuai pesanan

LANGKAH 4: Terima Notifikasi
   - Anda terima notifikasi "Siap Diambil"
   - Bisa juga cek manual di /kiosk/history

LANGKAH 5: Cetak Delivery Note (jika produk Sariroti)
   - Buka /kiosk/success atau /kiosk/history
   - Klik transaksi
   - Klik "Cetak Delivery Note"

LANGKAH 6: Ambil di Lokasi
   - Datang ke lokasi Sariroti
   - Tunjukkan Delivery Note
   - Ambil barang

LANGKAH 7: Selesai ✓
```

#### 5.1.4 Cara Belanja Produk Digital

```
LANGKAH 1: Pilih Kategori
   - Buka /kiosk/digital
   - Pilih kategori: Pulsa, Data, PLN, Game, dll

LANGKAH 2: Input Nomor/ID
   - Masukkan nomor HP / ID pelanggan / User ID
   - Untuk Pulsa/Data: sistem auto-detect provider
   - Contoh: 0812xxx → Telkomsel

LANGKAH 3: Pilih Produk
   - Lihat daftar produk & harga
   - Harga sudah termasuk markup Rp 2.000
   - Pilih produk yang diinginkan

LANGKAH 4: Add to Cart
   - Klik "Beli" atau "Tambah ke Keranjang"

LANGKAH 5: Checkout & Bayar
   - Sama seperti sebelumnya

LANGKAH 6: Tunggu Proses
   - Untuk prepaid (pulsa, game): biasanya instant
   - Tampilkan "Sedang Diproses..."
   - Auto-refresh status setiap 3 detik

LANGKAH 7: Terima SN/Token
   - SN/Token muncul di halaman sukses
   - Jika status "processing" lama, klik "Cek Paksa"
   - Konfirmasi sudah terima

LANGKAH 8: Selesai ✓
```

#### 5.1.5 Cara Pre-Order

```
LANGKAH 1: Buka Pre-Order
   - Buka /kiosk/preorder

LANGKAH 2: Pilih Produk
   - Browse produk yang tersedia untuk Pre-Order
   - Filter kategori & cari
   - Klik produk → Modal checkout

LANGKAH 3: Isi Data
   - Jumlah pesanan
   - Nama pengambil
   - Nomor HP
   - Tipe pengambilan:
     ├── Hari Ini → Ambil hari ini (jika seller ready)
     ├── Besok → Ambil besok
     └── Kustom → Pilih X hari dari sekarang

LANGKAH 4: Bayar Sekarang
   - Klik "Bayar"
   - Proses via iPaymu

LANGKAH 5: Tunggu Konfirmasi
   - Sistem buat jadwal pengambilan
   - Seller prepare produk sesuai jadwal

LANGKAH 6: Ambil Sesuai Jadwal
   - Datang ke lokasi di tanggal yang ditentukan
   - Tunjukkan receipt

LANGKAH 7: Selesai ✓
```

**Catatan:** Pre-Order bisa untuk semua jenis produk (makanan, minuman, roti, dll), bukan hanya roti. Pembeli bisa pesan beberapa hari sebelum jadwal pengambilan sesuai kesiapan seller.

#### 5.1.6 Cek Riwayat & Status Pesanan

```
1. Klik icon Clock (Riwayat) di /kiosk
2. Lihat daftar transaksi
3. Filter:
   - Semua / Pending / Sukses / Gagal
4. Klik transaksi untuk lihat detail
5. Untuk produk roti:
   - Lihat status: "Diproses" / "Siap Diambil"
   - Cetak Delivery Note jika sudah "Siap"
6. Untuk produk digital:
   - Lihat SN/Token
   - Jika belum masuk, klik "Cek Paksa"
7. Untuk cancel:
   - Hanya bisa untuk status "pending"
   - Klik "Batalkan Pesanan"
```

#### 5.1.7 Menggunakan Loyalty Points

```
Earn Points:
   - Setiap transaksi sukses → dapat 1% dari total
   - Contoh: Belanja Rp 100.000 → dapat 1.000 points

Gunakan Points:
   - Saat checkout, pilih "Points"
   - Pastikan saldo points >= total belanja
   - Jika cukup → langsung potong points
   - Jika tidak cukup → pilih metode lain

Cek Saldo Points:
   - Buka /kiosk/profile
   - Lihat "Poin Loyalitas" di profil

Catatan:
   - Points tidak bisa di-transfer
   - Points hangus jika akun dinonaktifkan
   - 1 point = Rp 1
```

---

### 5.2 SELLER (Penjual)

#### 5.2.1 Login

```
1. Buka /login
2. Login dengan NIK/Google
3. Sistem auto-detect role
4. Redirect ke /dashboard/seller
```

#### 5.2.2 Overview Dashboard

```
Di halaman /dashboard/seller Anda melihat:
   - Total Products → Jumlah produk yang Anda jual
   - Total Sales → Total penjualan Anda
   - Balance → Saldo yang bisa di-withdraw
   - Total Withdrawn → Total yang sudah di-withdraw
   - Low Stock Warnings → Produk dengan stock < 5
   - Recent Transactions → 5 transaksi terbaru
```

#### 5.2.3 Kelola Produk

```
TAMBAH PRODUK BARU:
   1. Buka /dashboard/seller/products
   2. Klik "Tambah Produk" atau tombol +
   3. Isi formulir:
      - Nama Produk
      - Deskripsi (opsional)
      - Harga
      - Stok
      - Kategori: Sariroti, Kantin, Makanan, Minuman, dll
      - Gambar (upload atau URL)
   4. Klik "Simpan"

EDIT PRODUK:
   1. Cari produk di daftar
   2. Klik icon edit (pensil)
   3. Ubah data yang perlu
   4. Klik "Update"

NONAKTIFKAN PRODUK:
   1. Cari produk di daftar
   2. Klik toggle on/off
   3. Produk nonaktif tidak terlihat di katalog

IMPORT BULK (CSV):
   1. Klik "Import CSV"
   2. Download template
   3. Isi template:
      - name, price, stock, category
   4. Upload file CSV
   5. Sistem import data

UPDATE STOCK:
   1. Dari daftar produk
   2. Klik icon edit
   3. Ubah jumlah stock
   4. Klik "Update"
```

#### 5.2.4 Kelola Pre-Order (Jika seller Sariroti)

```
1. Buka /dashboard/seller/pre-orders

TAB "KONFIGURASI":
   - Lihat produk yang bisa di-Pre-Order
   - Untuk tambah/edit konfigurasi:
     1. Pilih produk
     2. Set pickup_type:
        - same_day → Ambil hari ini
        - next_day → Ambil besok
        - custom_days → Ambil X hari lagi
     3. Set order_cutoff_time (batas jam order, misal 14:00)
     4. Aktifkan/nonaktifkan

TAB "PESANAN":
   - Lihat daftar Pre-Order dari buyer
   - Filter: pending, confirmed, ready
   - Update status pesanan:
     1. Klik pesanan
     2. Update status:
        - pending → confirmed (dikonfirmasi, akan diproduksi)
        - confirmed → ready (siap diambil)
     3. Sistem notify buyer
```

#### 5.2.5 Lihat Transaksi

```
1. Buka /dashboard/seller/transactions
2. Lihat transaksi yang mengandung produk Anda
3. Filter:
   - Tanggal (start/end date)
   - Status: all, pending, success, failed
4. Search by transaction ID atau nama produk
5. Klik transaksi untuk lihat detail:
   - Item yang Anda jual
   - Jumlah
   - Harga
   - Subtotal
   - Status pembayaran
6. Export laporan:
   - Klik "Export Excel"
   - Download file Excel
```

#### 5.2.6 Request Withdrawal

```
1. Buka /dashboard/seller/withdrawals
2. Lihat saldo tersedia
3. Klik "Request Penarikan"
4. Isi formulir:
   - Jumlah penarikan (maksimal = saldo)
   - Bank: Bank Merah Putih
   - Nomor Rekening
   - Nama Penerima (sesuai rekening)
5. Klik "Ajukan"
6. Menunggu approval dari Admin
   → Status: pending → approved / rejected
7. Jika approved:
   - Saldo otomatis dikurangi
   - Transfer dilakukan manual oleh Admin
8. Jika rejected:
   - Saldo tetap sama
   - Dapat melihat alasan penolakan
```

**Fee Withdrawal:**

```
Biaya 8% dari jumlah penarikan:
   - 2.5% → Biaya transfer antarbank
   - 3% → Operasional platform SPS Corner
   - 1.5% → Cadangan dana darurat
   - 1% → Maintenance web & domain

Contoh:
   Request: Rp 1.000.000
   Fee: Rp 80.000
   Diterima: Rp 920.000
```

---

### 5.3 ADMIN

#### 5.3.1 Login

```
1. Buka /login
2. Login dengan akun admin (NIK/Google)
3. Redirect ke /dashboard/admin
```

#### 5.3.2 Overview Dashboard

```
Di halaman /dashboard/admin Anda melihat:

STATISTIK:
   - Total Sales → Semua transaksi sukses
   - Total Transactions → Semua transaksi
   - Failed Transactions → Transaksi yang gagal/expired
   - Digiflazz Balance → Saldo untuk produk digital
   - Total Sellers / Active Sellers
   - Total Fees → Fee dari withdrawals

TRANSAKSI:
   - Recent Transactions → 5 transaksi terbaru
   - Pending Transactions → Butuh approve (manual/pending)
   - Failed Transactions → Perlu dicek

REQUEST:
   - Password Reset Requests → User minta reset password

QUICK ACTIONS:
   - Quick approve transaksi
   - Upload QRIS image untuk payment manual
```

#### 5.3.3 Kelola Transaksi

```
BUKA /dashboard/admin/transactions

TAB TRANSAKSI:
   - Success → Transaksi berhasil
   - Failed → Transaksi gagal/expired

SEARCH & FILTER:
   - Search by transaction ID
   - Filter: tanggal, seller, status, payment method

DETAIL TRANSAKSI:
   - Klik transaksi untuk lihat detail
   - Item list
   - Receipt image (jika upload bukti)
   - Payment details

ACTIONS:

   1. APPROVE (untuk manual payment):
      - Klik "Approve"
      → Sistem proses:
         - Update status: pending → success
         - Seller balance += 92%
         - Buyer loyalty points += 1%
         - Trigger Sariroti email jika ada

   2. CONFIRM SARIROTI:
      - Klik "Confirm Sariroti"
      → Update metadata: sariroti_confirmed = true
      → Buyer bisa cetak Delivery Note

   3. NOTIFY READY:
      - Klik "Notify Ready"
      → Buyer terima notifikasi "Siap Diambil"
      → Update metadata: sariroti_order_status = "ready"

EXPORT LAPORAN:
   - Klik "Export Excel"
   - Download file Excel dengan semua transaksi

CANCEL TRANSAKSI:
   - Jika needed, bisa cancel transaksi
   - Stock dikembalikan
   - Status = "failed"
```

#### 5.3.4 Kelola Produk

```
BUKA /dashboard/admin/products

TAMBAH PRODUK:
   1. Klik "Tambah Produk"
   2. Pilih seller (dropdown)
   3. Isi: Nama, Deskripsi, Harga, Stok, Kategori, Gambar
   4. Klik "Simpan"

EDIT PRODUK:
   1. Klik icon edit pada produk
   2. Ubah data
   3. Klik "Update"

DELETE PRODUK:
   1. Klik icon trash
   2. Konfirmasi hapus

IMPORT BULK (CSV):
   1. Klik "Import CSV"
   2. Format: name, price, stock, category
   3. Upload file
   4. Sistem import & buat category jika belum ada

SET KATEGORI:
   1. Pastikan kategori ada di /dashboard/admin/categories
   2. Kategori menentukan:
      - Apakah produk digital (is_digital)
      - Filter di kiosk
      - Trigger Sariroti email (jika mengandung 'roti', 'koperasi')
```

#### 5.3.5 Kelola Seller

```
BUKA /dashboard/admin/sellers

LIHAT DAFTAR SELLER:
   - Nama, NIK, Total Sales, Balance, Status

ACTIONS:
   1. Reset Password:
      - Klik icon key
      - Password di-reset ke default "123456"
      - User harus ganti password setelah login

   2. View Performance:
      - Lihat total sales
      - Lihat produk yang dijual

   3. Deactivate/Activate:
      - Klik toggle
      - Seller nonaktif tidak bisa login

ADD SELLER BARU:
   1. Dari Supabase Dashboard
   2. Insert ke tabel profiles dengan role = 'seller'
   3. Atau dari halaman ini (jika ada fitur)
```

#### 5.3.6 Approve Withdrawal

```
BUKA /dashboard/admin/withdrawals

LIHAT REQUEST:
   - User yang request
   - Jumlah
   - Bank tujuan
   - Waktu request
   - Status: pending / completed / rejected

ACTIONS:
   1. APPROVE:
      - Klik "Approve"
      - DB: seller.balance -= amount
      - Status = "completed"
      - Catatan: Transfer bank dilakukan manual di luar sistem

   2. REJECT:
      - Klik "Reject"
      - Beri alasan penolakan
      - Status = "rejected"
      - Saldo seller tetap

LIHAT HISTORY:
   - Tab "Completed"
   - Tab "Rejected"
   - Tab "All"
```

#### 5.3.7 Kelola Loyalty Program

```
BUKA /dashboard/admin/loyalty

ENABLE/DISABLE:
   - Toggle "loyalty_enabled" di settings
   - Jika disable: buyer tidak bisa earn/use points

LIHAT MEMBER:
   - Daftar user dengan loyalty points
   - Urutkan berdasarkan points tertinggi

POINTS SYSTEM:
   - 1% dari transaction amount = earned points
   - 1 point = Rp 1
   - Points digunakan saat checkout
```

#### 5.3.8 Kelola Kategori

```
BUKA /dashboard/admin/categories

LIHAT KATEGORI:
   - Nama kategori
   - Apakah digital (is_digital flag)
   - Jumlah produk

TAMBAH KATEGORI:
   1. Klik "Tambah Kategori"
   2. Isi nama
   3. Set is_digital (jika produk digital)
   4. Klik "Simpan"

EDIT KATEGORI:
   1. Klik edit
   2. Ubah nama / is_digital
   3. Klik "Update"

HAPUS KATEGORI:
   1. Klik delete
   2. Konfirmasi
   - Note: Tidak bisa hapus jika masih ada produk
```

#### 5.3.9 Settings

```
BUKA /dashboard/admin/settings

PAYMENT METHODS:
   - QRIS Dynamic (Direct) → enable/disable
   - QRIS Manual (Upload Bukti) → enable/disable
   - VA BCA → enable/disable
   - VA Mandiri → enable/disable
   - Redirect Payment → enable/disable

QRIS IMAGE:
   - Upload gambar QRIS untuk manual payment
   - Buyer lihat ini saat pilih "Upload Bukti"

CONTACT INFO:
   - Edit konten info kontak
   - Tampil di halaman Contact (/contact)

LAINNYA:
   - Konfigurasi lain sesuai kebutuhan
```

#### 5.3.10 Kelola Scanner

```
BUKA /dashboard/admin/scanner

FUNGSI:
   - Scan Order ID / Receipt untuk validasi
   - Admin/petugas scan QR code saat pengambilan

CARA PAKAI:
   1. Buka halaman scanner
   2. Aktifkan kamera / input manual
   3. Scan atau masukkan Order ID
   4. Sistem tampilkan detail order
   5. Validasi: cocok → konfirmasi ambil
```

---

## 6. Metode Pembayaran

### 6.1 QRIS iPaymu (Direkomendasikan)

**Mode Direct (QR Code langsung):**

```
1. Pilih "QRIS" saat checkout
2. Sistem generate payment via iPaymu
3. Tampilkan QR code di layar
4. Buyer scan via aplikasi m-banking
5. Bayar (timeout 15 menit)
6. iPaymu kirim webhook ke /api/payment/ipaymu/callback
7. Sistem update status: pending → paid
8. Buyer bisa ambil barang

Keunggulan:
   - Instan (tanpa redirect)
   - Multi-bank (bisa dari mana saja)
   - Terbaca langsung setelah bayar
```

**Mode Redirect:**

```
1. Pilih "QRIS" saat checkout
2. Sistem redirect ke halaman iPaymu
3. Buyer login ke iPaymu & bayar di sana
4. Setelah selesai, redirect back ke /kiosk/success
5. iPaymu kirim webhook callback
6. Sistem proses

Keunggulan:
   - Tidak perlu scan manual
   - Ada receipt dari iPaymu
```

### 6.2 Upload Bukti Transfer (Manual)

```
1. Pilih "Upload Bukti" saat checkout
2. Lihat nomor rekening / QRIS untuk transfer
3. Transfer ke rekening yang tertera
4. Screenshot bukti transfer
5. Upload gambar di halaman checkout
   - Format: JPG, PNG
   - Max size: 5MB
6. Submit
7. AI (Gemini) verifikasi:
   - Cek apakah receipt valid
   - Bandingkan amount dengan expected
   - Jika match → Approved otomatis
   - Jika tidak match → Manual review oleh Admin
8. Jika approved:
   - Update status: pending → success
   - Proses pesanan
   - Buyer bisa ambil barang

Jika perlu review manual:
   - Admin buka /dashboard/admin/transactions
   - Lihat transaksi dengan receipt
   - Approve atau reject manual
```

### 6.3 Loyalty Points

```
Syarat:
   - Harus login (guest tidak bisa pakai points)
   - Saldo points >= total belanja

Cara Pakai:
   1. Pilih "Points" saat checkout
   2. Sistem cek saldo points Anda
   3. Jika cukup:
      - Langsung potong points
      - Pesanan diproses
      - Status: success
   4. Jika tidak cukup:
      - Tampilkan error
      - Pilih metode lain

Earn Points:
   - Setiap transaksi sukses: dapat 1% dari total
   - Contoh: Belanja Rp 100.000 → dapat 1.000 points
   - 1 point = Rp 1
   - Points masuk otomatis setelah transaction success

Cek Saldo:
   - Buka /kiosk/profile
   - Lihat "Poin Loyalitas"
```

### 6.4 Perbandingan Metode

| Metode | Kecepatan | Verifikasi | Syarat | Fee MDR |
|--------|----------|------------|--------|---------|
| QRIS Direct | Instant | Auto (webhook) | - | ~0.7% |
| QRIS Redirect | Instant | Auto (webhook) | - | ~0.7% |
| Upload Bukti | Lama (upload+verify) | AI + Manual | Harus upload receipt | 0% |
| Points | Instant | Auto (DB check) | Login + cukup balance | 0% |

---

## 7. Panduan Lengkap per Fitur

### 7.1 Katalog (`/kiosk`)

**Fitur:**

| Fitur | Deskripsi |
|-------|-----------|
| Toggle Toko | Kantin / **KOPERASI** / Digital / Pre-Order |
| Filter Kategori | Klik tab kategori untuk filter |
| Pencarian | Ketik nama produk untuk cari |
| Tambah ke Cart | Klik produk → atur jumlah → tambah |
| Indikator Stock | Tampilkan "Tersisa X pcs" jika < 5 |

**Auto-categorization Produk Kopian (Sariroti):**

| Keyword di Nama | Kategori |
|-----------------|----------|
| tawar, milky soft, gandum | Roti Tawar |
| sandwich | Roti Sandwich |
| kue, cake, dorayaki, bolu, waffle, muffin, croissant, lapis | Kue |
| sari choco, meises, spread | Sari Choco |
| Lainnya (roti, manis) | Roti Manis |

**Catatan:**
- Produk dengan category/name mengandung 'sariroti', 'roti', 'koperasi' → trigger email ke admin Sariroti
- Produk non-roti masuk ke kategori Kantin

### 7.2 Keranjang (`/kiosk/cart`)

**Fitur:**

| Fitur | Deskripsi |
|-------|-----------|
| List Item | Tampilkan semua item yang dipilih |
| Quantity Controls | +/- untuk ubah jumlah |
| Remove Item | Hapus item dari cart |
| Input Buyer Info | Nama & nomor HP (wajib) |
| Summary | Subtotal, estimasi MDR, total |
| Checkout Button | Proses ke checkout |

**Stock Reservation:**

```
Saat klik "Checkout":
   1. Sistem loop setiap item
   2. Call supabase.rpc('reserve_stock', { product_id, quantity, 3 })
   3. Jika gagal (stock kurang) → release semua, error
   4. Jika sukses → save reservation IDs

Saat cancel/timeout:
   1. Call supabase.rpc('release_stock', { reservation_id })
   2. Stock dikembalikan

Reservation expires: 3 menit
   - Jika tidak checkout dalam 3 menit
   - Reservation auto-release
```

### 7.3 Checkout (`/kiosk/checkout`)

**Fitur:**

| Fitur | Deskripsi |
|-------|-----------|
| Payment Methods | QRIS, Upload Bukti, Points (dari settings) |
| Countdown Timer | 15 menit untuk QRIS direct |
| Buyer Info | Nama, HP, Email |
| Digital Items | Handle tanpa stock reservation |
| Receipt Upload | Untuk manual payment |

**Flow:**

```
1. Load payment methods dari settings
2. Show buyer info form (pre-filled jika login)
3. User pilih metode pembayaran
4. Klik "Bayar"
5. Loading state
6. Create transaction via API
7. Handle sesuai metode:
   - QRIS: Show QR / redirect
   - Upload: Show upload form
   - Points: Check & deduct
8. Simpan transaction ID ke localStorage
```

### 7.4 Halaman Sukses (`/kiosk/success`)

**Fitur:**

| Fitur | Deskripsi |
|-------|-----------|
| Confetti | Animasi confetti celebration |
| Transaction Summary | ID, total, item list |
| Digital SN/Token | Tampilkan untuk produk digital |
| Cetak Delivery Note | Tombol untuk Sariroti |
| Auto-refresh | Polling setiap 3 detik untuk digital |
| Actions | Lihat detail, history, continue shopping |

**Sariroti Items:**

```
Jika transaction mengandung produk Sariroti:
   1. Tampilkan tombol "Cetak Delivery Note"
   2. Tombol "Cetak Struk" (optional)
   3. Info: "Pesanan akan diproses oleh Sariroti"
   4. Status tracking: Diproses → Siap Diambil
```

### 7.5 History (`/kiosk/history`)

**Fitur:**

| Fitur | Deskripsi |
|-------|-----------|
| List Transactions | Semua transaksi user |
| Filter | Tanggal, status (all/pending/success/failed) |
| Search | By transaction ID atau nama produk |
| Detail Modal | Item list, status, receipt |
| Cancel Order | Untuk status pending |
| Cek Paksa | Manual check untuk digital |
| Cetak | Delivery Note / Struk |

**Status Transaksi:**

| Status | Arti |
|--------|------|
| pending | Menunggu pembayaran |
| paid | Sudah dibayar, sedang diproses |
| success | Selesai, sukses |
| failed | Gagal/expired/cancel |

**Sariroti Status (di metadata):**

| Status | Arti |
|--------|------|
| (kosong) | Belum diproses Sariroti |
| confirmed | Sariroti sudah terima & produksi |
| ready | Siap diambil |

### 7.6 Digital Products (`/kiosk/digital`)

**Categories:**

| Kategori | Input | Notes |
|----------|-------|-------|
| Pulsa | Nomor HP | Auto-detect provider dari prefix |
| Paket Data | Nomor HP | Auto-detect provider |
| Token PLN | ID Meter (10-12 digit) | Prabayar |
| Tagihan PLN | ID Meter | Pascabayar, ada inquiry |
| Mobile Legends | User ID + Zone ID | Format: 123456789(1234) |
| Free Fire | Player ID | |
| Genshin | User ID + Server | Server: os_asia, os_usa, os_eu |
| Valorant | Riot ID | |
| E-Money | Nomor HP | Top up only |
| PDAM | Nomor pelanggan | |
| BPJS | Nomor BPJS | |
| Internet/TV | Nomor langganan | |

**Provider Detection (Pulsa/Data):**

```
0812, 0813, 0821, 0822, 0852, 0853 → Telkomsel
0895, 0896, 0897, 0898, 0899 → Three
0851, 0853, 0852 → Indosat (ada overlap)
0814, 0815, 0816, 0855, 0856, 0857, 0858 → XL (ada overlap)

Note: Beberapa prefix overlap, sistemambil yang paling umum
```

### 7.7 Pre-Order (`/kiosk/preorder`)

**Fitur:**

| Fitur | Deskripsi |
|-------|-----------|
| Browse PO Products | Produk dengan konfigurasi pre-order |
| Filter & Search | Cari produk |
| Modal Checkout | Input data pesanan |
| Pickup Type | Hari Ini / Besok / Kustom |
| Payment | Via iPaymu |

**Pickup Type:**

| Type | Arti | Contoh |
|------|------|--------|
| same_day | Ambil hari ini | Order 09:00, ambil 09:30 |
| next_day | Ambil besok | Order 09:00, ambil besok 09:00 |
| custom_days | Ambil X hari lagi | Order 09:00, ambil 3 hari lagi |

---

## 8. Business Rules

### 8.1 Distribusi Saldo Seller

```
Rumus:
   Total Transaksi = Rp 100.000

   ┌─────────────────────────────────────┐
   │ Seller Balance      = 92% = Rp 92.000 │
   │ Admin Fee           = 8%  = Rp  8.000 │
   └─────────────────────────────────────┘

Update dilakukan saat transaction status = success/paid
Fungsi: updateSellerBalances() di server.ts
```

### 8.2 Loyalty Points

```
Rumus Earn:
   Transaction Amount = Rp 100.000
   Earn Points = 1% = 100 points

   1 point = Rp 1

Update dilakukan saat transaction success
Fungsi: updateBuyerPoints() di server.ts
```

### 8.3 Stock Reservation

```
Durasi: 3 menit

Trigger release:
   1. User cancel checkout
   2. Idle timeout 2 menit di kiosk
   3. Payment failed
   4. Reservation expired (3 menit)

Confirm (kurangi stock):
   Saat payment berhasil dibuat (sebelum webhook)
   Fungsi: confirmStockDeduction() di server.ts
```

### 8.4 Auto-Cancel Pending

```
Rule:
   Transaction dengan status 'pending' > 5 menit → Auto-cancel

Aksi:
   1. Update status = 'failed'
   2. Release stock reservations
   3. Tidak ada refund process (otomatis)

Trigger:
   - /api/admin/transactions/cleanup endpoint
   - Dijalankan saat ada transaksi baru atau manual
```

### 8.5 Low Stock Alert

```
Rule:
   Jika stock < 5 setelah transaction success

Aksi:
   1. Kirim email ke seller
   2. Subject: "[SPS Corner] Peringatan: Stok {product.name} Menipis"
   3. Isi: Nama produk, stock tersisa

Catatan:
   - Email diambil dari auth.users berdasarkan seller_id
   - Fungsi: checkAndNotifyLowStock() di server.ts
```

### 8.6 Sariroti Special Flow

```
Trigger:
   Produk dengan category/name mengandung:
   - 'sariroti'
   - 'roti'
   - 'koperasi'

Flow:
   1. Transaction status = success/paid
   2. Sistem deteksi item Sariroti
   3. Kirim email ke Sales.Adm.bjm@sariroti.com
      - Subject: "[SPS Corner] Pesanan Baru dari Kiosk"
      - Isi: Detail pesanan, jumlah, waktu
   4. Admin produksi roti
   5. Admin confirm via /dashboard/admin/transactions:
      - Klik "Confirm Sariroti" → sariroti_confirmed = true
      - Klik "Notify Ready" → sariroti_order_status = "ready"
   6. Buyer terima notifikasi
   7. Buyer cetak Delivery Note
   8. Buyer ambil di lokasi

Fungsi: sendSarirotiEmail() di server.ts
```

### 8.7 Rate Limiting

```
/api/payment/*     → 10 request/menit/IP
/api/auth/*         → 20 request/15 menit/IP

Jika exceeded:
   - Return 429 Too Many Requests
   - Tunggu sampai window reset
```

### 8.8 Digital Product Processing

```
Prepaid (pulsa, data, game):
   1. Transaction success
   2. Cek Digiflazz balance >= total HPP
   3. POST /api/digital/order → Digiflazz API
   4. Update item metadata: status = "processing"
   5. Tunggu webhook dari Digiflazz
   6. Webhook → /api/digital/callback
   7. Update metadata: status = "delivered" / "failed"

Postpaid (PLN tagihan, PDAM, BPJS):
   1. User input nomor pelanggan
   2. Call inquiry API → dapat tagihan
   3. Add to cart dengan inquiry data
   4. Checkout & bayarkan tagihan
   5. Proses sama seperti prepaid

Error Handling:
   - Insufficient balance → Error saat checkout
   - Digiflazz down → Show error, retry later
   - Processing timeout → Manual "Cek Paksa" button
```

---

## 9. Panduan Teknis

### 9.1 Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# VAPID (Push Notifications)
VITE_VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
VAPID_SUBJECT=mailto:admin@spscorner.id

# iPaymu Payment
IPAYMU_VA=xxx
IPAYMU_API_KEY=xxx
IPAYMU_PRODUCTION=true

# Digiflazz PPOB
DIGIFLAZZ_USERNAME=xxx
DIGIFLAZZ_API_KEY=xxx

# Gmail SMTP
GMAIL_USER=xxx@gmail.com
GMAIL_APP_PASSWORD=xxx

# App Config
APP_URL=https://spscorner.store
SARIROTI_ADMIN_EMAIL=Sales.Adm.bjm@sariroti.com

# Static IP (untuk whitelist Digiflazz/iPaymu)
FIXIE_URL=http://xxx:xxx@proxy.xxx.com
```

### 9.2 API Endpoints

#### Health & Debug

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/health` | GET | Health check |
| `/api/debug-schema` | GET | Get schema info |
| `/api/debug/ip` | GET | Get server outbound IP |

#### Digital Products (Digiflazz)

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/digital/prices` | POST | Get price list (cached 12 jam) |
| `/api/digital/inquiry-pln` | POST | PLN postpaid inquiry |
| `/api/digital/inquiry-pasca` | POST | General postpaid inquiry |
| `/api/digital/inquiry-ewallet` | POST | E-wallet balance check |
| `/api/digital/check-status` | POST | Manual status check |
| `/api/digital/cek-saldo` | GET | Digiflazz balance |
| `/api/digital/order` | POST | Place order (internal) |
| `/api/digital/callback` | POST | Webhook untuk update status |

#### Payment (iPaymu)

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/payment/ipaymu/create` | POST | Create payment (redirect) |
| `/api/payment/ipaymu/direct` | POST | Create direct payment (QRIS/VA) |
| `/api/payment/ipaymu/callback` | POST | Payment webhook |
| `/api/payment/ipaymu/status/:reference_id` | GET | Check status |
| `/api/payment/ipaymu/methods` | GET | Get available methods |

#### Manual Payment

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/payment/manual/verify` | POST | Verify receipt image (AI) |

#### Points Payment

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/payment/points/pay` | POST | Pay with loyalty points |

#### Transactions

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/transactions/create` | POST | Create transaction |
| `/api/transactions/pay` | POST | Mark as paid (manual) |
| `/api/transactions/cancel` | POST | Cancel pending transaction |
| `/api/transactions/:id` | GET | Get transaction detail |
| `/api/transactions/seller/:sellerId` | GET | Seller's transactions |

#### Admin Actions

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/admin/transactions/approve` | POST | Approve & process |
| `/api/admin/transactions/confirm-sariroti` | POST | Confirm Sariroti order |
| `/api/admin/transactions/notify-ready` | POST | Notify ready for pickup |
| `/api/admin/transactions/cleanup` | POST | Auto-cancel expired (5 min) |

#### Password Reset

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/auth/reset-password-request` | POST | Request reset |
| `/api/admin/password-resets` | GET | Admin view requests |
| `/api/admin/password-resets/complete` | POST | Complete reset |

#### Reports & Notifications

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/report` | POST | Submit error/issue report |
| `/api/reports` | GET | View all reports |
| `/api/push/subscribe` | POST | Subscribe to push notifications |

### 9.3 Database Schema (SQL Summary)

```sql
-- Profiles (users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'seller', 'buyer')),
  name TEXT NOT NULL,
  nik TEXT UNIQUE,
  phone TEXT,
  balance NUMERIC DEFAULT 0,
  total_sales NUMERIC DEFAULT 0,
  total_withdrawn NUMERIC DEFAULT 0,
  total_fee_paid NUMERIC DEFAULT 0,
  loyalty_points NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  stock INTEGER DEFAULT 0,
  category TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_digital BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_name TEXT NOT NULL,
  buyer_id UUID REFERENCES profiles(id),
  buyer_phone TEXT,
  buyer_email TEXT,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  payment_details JSONB,
  receipt_image TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transaction Items
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  seller_id UUID REFERENCES profiles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Reservations
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  type TEXT,
  title TEXT NOT NULL,
  message TEXT,
  path TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  is_digital BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Withdrawals
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  amount NUMERIC NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 9.4 Deployment

**Development:**

```bash
npm run dev     # Start dev server (tsx + Vite)
npm run build   # Vite build → dist/
```

**Production (Vercel):**

```bash
vercel deploy   # Deploy to Vercel
```

**vercel.json rewrites:**

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

SPA rewrite: Semua route → `/index.html` (untuk React Router)
API rewrite: `/api/*` → `/api/index` (Vercel serverless)

---

## 10. Troubleshooting

### 10.1 Common Issues

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| **Tidak bisa checkout** | Stock habis | Tunggu restock atau pilih produk lain |
| **Reservation expired** | Timeout 3 menit | Keranjang di-reset, mulai ulang checkout |
| **QRIS tidak bisa di-scan** | Session expired | Buat transaksi baru |
| **Digital product belum masuk** | Processing Digiflazz | Tunggu atau klik "Cek Paksa" |
| **Tidak bisa login** | NIK/password salah | Reset password atau hubungi admin |
| **Saldo seller tidak masuk** | Transaksi belum approved | Hubungi admin untuk approve |
| **Low stock warning terus** | Stock < 5 | Restock produk |

### 10.2 Error Messages

| Error | Arti | Solusi |
|-------|------|--------|
| "Gagal memuat produk" | Fetch dari Supabase gagal | Refresh halaman atau cek koneksi |
| "Stok tidak mencukupi" | Stock tidak cukup | Kurangi jumlah atau pilih produk lain |
| "Gagal membuat pembayaran" | iPaymu API error | Hubungi admin / coba lagi nanti |
| "Verifikasi gagal" | Receipt tidak cocok | Upload ulang bukti transfer yang jelas |
| "Saldo Digiflazz tidak cukup" | Balance HPP habis | Hubungi admin untuk top up |
| "Reservation gagal" | Stock habis saat checkout | Refresh, kurangi jumlah, atau pilih produk lain |
| "Points tidak cukup" | Saldo points kurang dari total | Pilih metode pembayaran lain |

### 10.3 Kontak Bantuan

| Metode | Detail |
|--------|--------|
| Email | Hubungi administrator |
| Halaman | /contact |
| Report Bug | /dashboard/admin/reports (submit issue) |

---

## Lampiran: Path URL Lengkap

### Pembeli (Kiosk)

| Halaman | URL | Deskripsi |
|---------|-----|-----------|
| Katalog | `/kiosk` | Browse produk fisik (Kantin/KOPERASI) |
| Keranjang | `/kiosk/cart` | Review item sebelum checkout |
| Checkout | `/kiosk/checkout` | Pilih metode bayar |
| Validasi | `/kiosk/validate` | Konfirmasi pembayaran |
| Sukses | `/kiosk/success` | Tampilan setelah transaksi berhasil |
| Riwayat | `/kiosk/history` | Riwayat transaksi |
| Profil | `/kiosk/profile` | Profil & keamanan |
| Digital | `/kiosk/digital` | Produk digital (PPOB) |
| Pre-Order | `/kiosk/preorder` | Pre-order roti jadwal tertentu |

### Admin

| Halaman | URL | Deskripsi |
|---------|-----|-----------|
| Overview | `/dashboard/admin` | Stats & ringkasan |
| Transaksi | `/dashboard/admin/transactions` | Kelola transaksi |
| Produk | `/dashboard/admin/products` | Kelola produk |
| Seller | `/dashboard/admin/sellers` | Kelola seller |
| Kategori | `/dashboard/admin/categories` | Kelola kategori |
| Withdrawals | `/dashboard/admin/withdrawals` | Approve penarikan |
| Loyalty | `/dashboard/admin/loyalty` | Program loyalitas |
| Scanner | `/dashboard/admin/scanner` | Scan validasi order |
| Flash Sale | `/dashboard/admin/flashsale` | Kelola flash sale |
| Gathering | `/dashboard/admin/gathering` | Event gathering |
| Programs | `/dashboard/admin/programs` | Program serikat |
| Doorprize | `/dashboard/admin/doorprize` | Undian doorprize |
| Reports | `/dashboard/admin/reports` | Laporan/error |
| Settings | `/dashboard/admin/settings` | Konfigurasi sistem |

### Seller

| Halaman | URL | Deskripsi |
|---------|-----|-----------|
| Overview | `/dashboard/seller` | Stats & ringkasan |
| Produk | `/dashboard/seller/products` | Kelola produk sendiri |
| Transaksi | `/dashboard/seller/transactions` | Lihat penjualan |
| Withdrawals | `/dashboard/seller/withdrawals` | Request penarikan |
| Pre-Orders | `/dashboard/seller/pre-orders` | Kelola konfigurasi PO |

### Public

| Halaman | URL | Deskripsi |
|---------|-----|-----------|
| Home | `/` | Landing page |
| Login | `/login` | Login/registrasi |
| Register | `/register` | Registrasi |
| Forgot Password | `/forgot-password` | Reset password |
| Auth Callback | `/auth/callback` | OAuth callback |
| Portal | `/portal` | Dashboard buyer |
| Terms | `/terms` | Syarat & ketentuan |
| Contact | `/contact` | Hubungi kami |
| Help | `/help` | Pusat bantuan |
| FAQ | `/faq` | FAQ |
| Refund | `/refund` | Kebijakan refund |

---

*Panduan ini dibuat berdasarkan kode aplikasi SPS Corner.*
*Untuk update atau perubahan fitur, silakan merujuk ke dokumentasi terbaru atau hubungi developer.*