# CAPA v6.0.5 - iPaymu Paid Callback Stuck Pending

## 1. RINGKASAN INSIDEN

| Item | Keterangan |
|------|-----------|
| Insiden | Transaksi yang sudah dibayar di iPaymu tetap tampil sebagai `Menunggu Pembayaran` di riwayat SPS Corner. |
| Dampak | Transaksi QRIS/VA iPaymu yang callback-nya masuk dapat tetap `pending`; settlement seller, reward point, dan proses digital tidak berjalan. |
| Kerugian | Risiko operasional: pembayaran sudah diterima tetapi pesanan terlihat belum lunas. |
| Durasi | Setelah perubahan callback pada v6.0.4 sampai hotfix v6.0.5 terdeploy. |
| Status | **MONITORING** - callback sudah diperbaiki; data lama sudah direkonsiliasi dan satu transaksi tetap pending secara benar. |

## 2. ROOT CAUSE ANALYSIS (RCA)

### 2.1 Bug Callback ReferenceError

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Route callback iPaymu melempar `ReferenceError: receivedSignature is not defined`. |
| Error | Variabel masih dipakai pada `src/routes/payments.ts:1016` dan `src/routes/payments.ts:1044`, tetapi deklarasinya terhapus pada commit v6.0.4. |
| Lokasi | `src/routes/payments.ts` pada handler `/api/payment/ipaymu/callback`. |
| Mekanisme | Callback lolos `verifyGatewayCallback`, lalu gagal saat audit signature sebelum update status transaksi. HTTP 500 membuat iPaymu dapat melakukan retry, tetapi setiap retry gagal di titik yang sama. |
| Kenapa bisa terjadi | Penghapusan validasi signature strict tidak dipisahkan dari kebutuhan membaca signature untuk audit trail; `server.ts` dan `payments.ts` juga menggunakan `// @ts-nocheck`, sehingga compiler tidak menangkap variabel yang hilang. |

### 2.2 Bug Mapping Status Paid

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Status callback literal `paid`, atau callback tanpa status top-level yang sudah dikonfirmasi lewat API iPaymu, dipetakan menjadi `pending`. |
| Error | Mapping hanya memasukkan `berhasil`, `success`, `sukses`, `completed`, dan `settlement`; hasil `verification.method = api_lookup` tidak mempengaruhi `txStatus`. |
| Lokasi | `src/routes/payments.ts:977-984` pada konversi `statusRaw` menjadi `txStatus`. |
| Mekanisme | Database tetap menerima `status = pending`, sehingga blok settlement `txStatus === "paid"` tidak dipanggil. |
| Kenapa bisa terjadi | Status verifikasi dan status bisnis transaksi diproses sebagai dua keputusan terpisah tanpa kontrak status gateway terpusat. |

### 2.3 Urutan 5 Whys

| Why | Jawaban |
|-----|---------|
| 1 | Mengapa riwayat masih menunggu? Karena kolom `transactions.status` tidak berubah ke `paid`. |
| 2 | Mengapa tidak berubah? Handler callback berhenti karena `receivedSignature` tidak ada, atau mapping jatuh ke `pending`. |
| 3 | Mengapa handler tidak terdeteksi? Backend memakai `// @ts-nocheck` dan belum ada test callback runtime. |
| 4 | Mengapa transaksi tertentu sudah terbayar? Sebagian transaksi diproses manual melalui script rekonsiliasi; transaksi lain tetap menunggu callback yang gagal. |
| 5 | Mengapa pencegahan belum menangkapnya? Auto-reconcile hanya memperbaiki transaksi yang sudah `paid`, bukan transaksi `pending` yang punya referensi iPaymu. |

### 2.4 Verifikasi Data Aktual

| Kelompok | Hasil |
|----------|-------|
| Pending dengan referensi iPaymu sebelum repair | 10 transaksi |
| Confirmed paid di gateway dan berhasil diproses ulang | 9 transaksi, total Rp39.150 |
| Tetap pending secara benar | `c6386131`, Rp10.250; `Status: 0`, `StatusDesc: Menunggu Pembayaran`, `PaidStatus: unpaid` |
| Settlement repair | Stock, seller balance, buyer points selesai untuk 9 transaksi paid |

## 3. KOREKTIF (APA YANG DIPERBAIKI)

| File | Perubahan |
|------|-----------|
| `src/routes/payments.ts` | Membaca kembali signature untuk audit trail tanpa mengaktifkan validasi strict yang sebelumnya false-reject. |
| `src/routes/payments.ts` | Menambahkan status gateway `paid`, serta memakai hasil `api_lookup` yang telah mengonfirmasi pembayaran untuk menetapkan `txStatus = paid`. |
| `src/routes/payments.ts` | Memakai satu payload payment-details dasar agar flag `unverified_callback` tidak tertimpa oleh update status berikutnya. |
| `src/test/ipaymuCallbackRoute.test.ts` | Menambahkan test callback tanpa signature dan callback literal `paid`. |
| `scripts/verify-pending-ipaymu.ts` | Mengubah repair menjadi stock-first dan membaca status failed/expired dari field status eksplisit, bukan pencarian teks mentah. |
| Database produksi | Memproses ulang 9 transaksi confirmed paid; membiarkan `c6386131` tetap pending karena belum dibayar. |

## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)

| Layer | Komponen | Mekanisme |
|-------|----------|-----------|
| Test | Callback route regression test | Memastikan callback terverifikasi API tidak menghasilkan 500 dan meng-update status menjadi `paid`. |
| Backend | Status gateway set terpusat | Status `paid`, `success`, `sukses`, `berhasil`, `completed`, dan `settlement` diproses konsisten. |
| Backend | API lookup decision | Jika iPaymu API mengonfirmasi paid, status bisnis tidak boleh jatuh ke pending hanya karena payload callback tidak memiliki status top-level. |
| Backend | Audit metadata preservation | Flag callback tanpa signature dipertahankan pada update status, sehingga dapat ditelusuri setelah settlement. |
| Operasional | Pending gateway reconciliation | Jalankan `scripts/verify-pending-ipaymu.ts` untuk memeriksa transaksi lama yang `pending` tetapi memiliki `ipaymu_trx_id`; jangan menandai paid tanpa konfirmasi gateway. |
| Operasional | Gateway status parser | Jangan gunakan `JSON.stringify(...).includes('expired')`; field seperti `ExpiredDate` bukan status pembayaran. |

## 5. PENCEGAHAN MASA DEPAN - RULES BARU

❌ **LARANGAN:** Menghapus variabel yang dipakai audit callback ketika menghapus validasi signature strict.

✅ **PERINTAH:** Setiap perubahan handler callback wajib diuji pada minimal tiga kondisi: signature valid, tanpa signature dengan API lookup paid, dan callback status `paid`.

❌ **LARANGAN:** Memetakan callback yang sudah dikonfirmasi API sebagai `pending` hanya karena `body.status` kosong atau memakai variasi status lain.

✅ **PERINTAH:** Gunakan `PAID_GATEWAY_STATUSES` dan hasil `verification.method` sebagai sumber keputusan status transaksi.

## 6. VERIFIKASI & TESTING

| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | Callback tanpa signature, API iPaymu mengembalikan status paid | HTTP 200, status transaksi `paid`, settlement berjalan | PASS |
| 2 | Callback memakai `status: paid` | HTTP 200, status transaksi `paid` | PASS |
| 3 | Callback status `berhasil` dari format resmi iPaymu | Status transaksi `paid` | Covered by shared status set |
| 4 | Callback gagal tanpa signature | Tetap `pending` dengan flag `unverified_failed_callback` | Existing guard |
| 5 | Transaksi lama `pending` dengan referensi iPaymu | 9 paid diproses; `c6386131` tetap pending/unpaid | PASS |
| 6 | Full TypeScript check dan test suite | Test suite lulus; TypeScript masih memiliki error pre-existing pada root `AdminScanner.tsx` | PARTIAL |

## 7. DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| Changelog | `changelog.txt` |
| Agent rules | `AGENTS.md` |
| Pending iPaymu verifier | `scripts/verify-pending-ipaymu.ts` |
| iPaymu callback source | `src/routes/payments.ts` |
