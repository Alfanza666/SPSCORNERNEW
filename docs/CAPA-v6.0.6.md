# CAPA v6.0.6 - Payment Method Switch and Failed Transaction Audit

## 1. RINGKASAN INSIDEN

| Item | Keterangan |
|------|-----------|
| Insiden | User memulai iPaymu lalu beralih ke QRIS manual; transaksi tetap tercatat sebagai `qris` dan bukti manual ditolak. Transaksi yang ditinggalkan juga dapat tetap pending sampai auto-expire. |
| Dampak | User tidak bisa menyelesaikan pembayaran manual pada transaksi lama; pending rows menambah noise pada riwayat. |
| Kerugian | Audit tidak menemukan saldo seller negatif atau seller settlement dari transaksi failed. |
| Durasi | Sebelum v6.0.6. |
| Status | **RESOLVED** untuk alur baru; satu bukti manual lama perlu review operasional. |

## 2. ROOT CAUSE ANALYSIS (RCA)

### 2.1 Reuse Transaction ID Lintas Metode

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | `handleManualQris()` dan handler metode lain melewati pembuatan transaksi ketika `transactionId` sudah ada. |
| Error | Row tetap memiliki `payment_method = qris`, sehingga `/api/payment/manual/verify` menolak karena hanya menerima `manual_qris` atau `transfer_koperasi`. |
| Lokasi | `src/pages/kiosk/Checkout.tsx` pada handler metode pembayaran dan state `transactionId`. |
| Mekanisme | Transaksi lama dibuat untuk iPaymu, lalu UI berpindah ke layar manual tanpa update/cancel row lama. |
| Kenapa bisa terjadi | `transactionId` awalnya dibuat sebagai lock anti-duplikasi, tetapi tidak dibedakan dari pilihan metode pembayaran. |

### 2.2 Tidak Ada Cancel Saat Keluar dari Checkout

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Tombol kembali/breadcrumb hanya meninggalkan halaman atau melepas reservation; transaksi yang sudah dibuat tetap pending. |
| Lokasi | `src/pages/kiosk/Checkout.tsx` sebelum v6.0.6. |
| Mekanisme | Backend cleanup baru mengubah status setelah threshold, sehingga riwayat menampilkan pending terlalu lama. |
| Solusi | Minta konfirmasi, panggil `/api/transactions/cancel`, lalu reset state sebelum navigasi/metode baru. |

### 2.3 Audit Transaksi Failed

| Item | Keterangan |
|------|-----------|
| Populasi | 474 transaksi `status = failed`. |
| Gateway | 134 memiliki referensi iPaymu; seluruhnya dikonfirmasi `failed/expired`, tidak ada `paid`/pending. |
| Seller balance | 0 baris `seller_balance_adjustments` terkait transaksi failed; tidak ada saldo seller yang ter-settle dari transaksi failed. |
| Stok | 154 transaksi memiliki `stock_deducted = true`; seluruhnya memiliki restore dan net adjustment 0. Tidak ada sale tanpa correction. |
| Seller negatif | 0 dari 8 seller memiliki `profiles.balance < 0`. |
| Kandidat review | `325eca93` memiliki receipt tersimpan tetapi tidak memiliki hasil verifikasi AI; jangan ubah status tanpa mencocokkan bukti bank. |

### 2.4 Urutan 5 Whys

| Why | Jawaban |
|-----|---------|
| 1 | Mengapa bukti manual ditolak? Karena metode pada row masih `qris`. |
| 2 | Mengapa masih `qris`? Karena `transactionId` lama dipakai ulang saat pindah layar. |
| 3 | Mengapa transaksi lama tertinggal? Karena keluar/ganti metode tidak memanggil cancel. |
| 4 | Mengapa pending menunggu auto-expire? Cleanup berjalan berdasarkan timer, bukan aksi eksplisit user. |
| 5 | Mengapa tidak ada indikasi seller minus? Karena failed path tidak memiliki ledger balance dan stok berhasil direstore. |

## 3. KOREKTIF (APA YANG DIPERBAIKI)

| File | Perubahan |
|------|-----------|
| `src/pages/kiosk/Checkout.tsx` | Tambah konfirmasi dan cancel untuk `Kembali`, breadcrumb `Menu/Keranjang`, serta `Ganti Metode Pembayaran`. |
| `src/pages/kiosk/Checkout.tsx` | Reset `transactionId`, lock, receipt, payment data, dan pilihan poin setelah cancel. |
| `src/pages/kiosk/Checkout.tsx` | Metode baru membuat transaksi baru dengan `payment_method` yang benar, bukan reuse row iPaymu. |
| `scripts/verify-pending-ipaymu.ts` | Repair pending gateway dibuat stock-first dan parser status tidak salah membaca `ExpiredDate` sebagai status expired. |
| `AdminScanner.tsx` (root) | Import dead-copy diperbaiki agar `npm run lint` kembali bersih; file tetap kandidat cleanup terpisah karena tidak dipakai `src/App.tsx`. |

## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)

| Layer | Komponen | Mekanisme |
|-------|----------|-----------|
| UI | Confirmation before switch/back | User menyetujui pembatalan sebelum transaksi lama ditutup. |
| Backend | Existing cancel endpoint | Status pending dibatalkan dan stock restore tetap dipanggil melalui jalur terpusat. |
| State | Payment state reset | ID transaksi lama tidak terbawa ke metode pembayaran baru. |
| Audit | Gateway and ledger reconciliation | Failed transaction tidak dipercaya hanya dari status lokal; gateway, balance ledger, dan stock ledger dicocokkan. |

## 5. PENCEGAHAN MASA DEPAN - RULES BARU

❌ **LARANGAN:** Reuse `transactionId` ketika metode pembayaran berubah.

✅ **PERINTAH:** Cancel transaksi pending terlebih dahulu, reset state, lalu create transaksi baru dengan metode pilihan.

❌ **LARANGAN:** Membiarkan user keluar dari checkout setelah transaksi dibuat tanpa keputusan cancel/continue.

✅ **PERINTAH:** Semua tombol keluar dari layar pembayaran wajib melewati handler cancel yang sama.

## 6. VERIFIKASI & TESTING

| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | Buat iPaymu lalu klik `Ganti Metode` dan pilih QRIS manual | Konfirmasi muncul, transaksi lama failed, transaksi baru method `manual_qris` | REQUIRED MANUAL |
| 2 | Buat QRIS manual lalu klik `Kembali` | Konfirmasi muncul, pending row dibatalkan, reservation dilepas | REQUIRED MANUAL |
| 3 | Cancel gagal karena transaksi sudah paid | Tidak pindah metode; user mendapat error dan transaksi tidak ditimpa | Covered by backend guard |
| 4 | Audit 474 failed transactions | 134 gateway failed/expired, 0 balance ledger, stok net 0 | PASS |
| 5 | Full test suite | 122 tests pass | PASS |
| 6 | Lint and production build | Lint pass, build pass with existing CSS/chunk warnings | PASS |

## 7. DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| CAPA callback fix | `docs/CAPA-v6.0.5.md` |
| Changelog | `changelog.txt` |
| Checkout flow | `src/pages/kiosk/Checkout.tsx` |
| Failed transaction verifier | `scripts/verify-pending-ipaymu.ts` |
