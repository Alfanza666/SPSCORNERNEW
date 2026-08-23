# CAPA v6.0.7 - Audit Selisih Stok Seller dan Pengamanan Workflow Stok

## 1. RINGKASAN INSIDEN

| Item | Keterangan |
|------|-----------|
| Insiden | Dua seller melaporkan selisih: Raka merasa uang/stok tidak sesuai catatan manual, Nurul melaporkan stok fisik 0 tetapi web menampilkan 4. |
| Dampak | Kepercayaan seller terhadap laporan stok dan saldo menurun; muncul dugaan kehilangan barang. |
| Kerugian | Tidak ditemukan kerugian akibat bug pada data aktual; selisih berasal dari perbedaan pencatatan harga dan stok fisik. |
| Durasi | Data diaudit penuh sejak Mei 2026 sampai 24 Agustus 2026. |
| Status | **RESOLVED** untuk analisis; perlu opname fisik untuk penutupan akhir. |

## 2. HASIL AUDIT DATA

### 2.1 Kasus Raka Wisnu Wardana

| Item | Sistem | Lampiran Seller |
|------|--------|-----------------|
| Susu UHT terjual | 44 unit | 41 unit |
| Susu Beruang terjual | 1 unit | 2 unit |
| Omzet kotor | Rp389.650 | Rp374.300 (seharusnya), Rp345.900 (aktual) |
| Harga Susu UHT | 25 unit @Rp8.500, 19 unit @Rp8.750 | Seluruhnya dihitung campuran 8.500/8.750 |

| Pemeriksaan | Hasil |
|-------------|-------|
| Baris paid tanpa log potong stok | 0 |
| Baris paid tanpa settlement saldo | 0 |
| Continuity break ledger stok | 0 |
| Stok sistem vs rekonstruksi ledger | Susu UHT 5 = 5, Susu Beruang 6 = 6 |
| Pasokan Susu UHT | 12 awal + 37 restock = 49; terjual 44; sisa 5 |

Kesimpulan: ledger Raka konsisten. Selisih Rp28.400 pada lampiran berasal dari perbedaan harga jual, bukan unit hilang. Sistem mencatat penjualan pada dua harga berbeda (Rp8.500 sebelum 6 Agustus, Rp8.750 sesudahnya), sedangkan lampiran memakai asumsi harga berbeda dan mencatat 2 unit Bearbrand padahal sistem hanya mencatat 1 unit terjual.

### 2.2 Kasus Nurul Hasanah

| Item | Keterangan |
|------|-----------|
| Stok sistem Keripik Singkong | 4 |
| Stok fisik dilaporkan | 0 |
| Continuity break sejak Juni 2026 | 0 |
| Pergerakan terakhir | Restock +10 pada 19 Agustus, lalu 8 penjualan sampai 20 Agustus |
| Penjualan paid setelah 20 Agustus | Tidak ada |
| Transaksi failed dengan potong stok tanpa restore | 0 |

Temuan tambahan: 37 item paid Mei-Juni tidak memiliki log `sale` ber-`transaction_id`. Setelah diperiksa per bulan, stok tetap terpotong pada periode itu (Mei 18 baris, Juni 68 baris), hanya saja kolom `transaction_id` baru ada sejak 11 Juni 2026 melalui migrasi `001_stock_rpc.sql`. Jadi ini keterbatasan pencatatan lama, bukan stok hilang.

Kesimpulan: sistem tidak menunjukkan bug yang mengurangi stok fisik. Selisih 4 unit tidak terjelaskan oleh ledger, sehingga kandidat penyebabnya adalah pengambilan fisik tanpa transaksi atau stok fisik yang tidak sesuai saat restock dicatat. Diperlukan opname fisik dan konfirmasi restock 19 Agustus.

### 2.3 Anomali Historis Lintas Seller

| Item | Nilai |
|------|-------|
| Total baris `stock_adjustments` | 16.801 |
| Correction duplikat | 13.985 baris dari 144 kombinasi transaksi-produk |
| Puncak kejadian | 23 Mei 2026 |
| Seller terdampak | Admin Sariroti, Hidayatullah, Muhammad Fauzan, Nurul, Akhmad Fiqri |

Duplikat ini berasal dari bug restore lama yang sudah diperbaiki pada v5.14.4 sampai v5.16.2. Baris tetap dipertahankan sebagai audit trail; stok akhir saat ini tidak terpengaruh karena rekonstruksi unik cocok dengan stok berjalan.

## 3. KOREKTIF

| File | Perubahan |
|------|-----------|
| `src/routes/admin.ts` | Laporan stok admin membaca `stock_adjustments` per halaman 500 row. Sebelumnya terpotong 1.000 row sehingga stok awal dan kolom pergerakan salah. |
| `src/routes/stock-trace.ts` | Timeline dan deteksi gap stok membaca seluruh adjustment per halaman. |
| `src/pages/dashboard/admin/AdminStockOpname.tsx` | Update stok dilakukan lebih dulu; log opname hanya ditulis setelah update berhasil, dan kegagalan log diberi peringatan eksplisit. |
| `src/routes/transactions.ts` | Transaksi berstatus settled yang gagal memotong sebagian stok kini di-rollback, diturunkan ke `pending`, dan menolak request dengan kode `STOCK_COMMIT_FAILED`. |

## 4. PENCEGAHAN

| Layer | Mekanisme |
|-------|-----------|
| Reporting | Semua pembacaan ledger stok memakai pagination, sehingga laporan tidak pernah dihitung dari data sebagian. |
| Opname | Log manual tidak dapat tercipta tanpa perubahan stok nyata. |
| Transaksi | Stock-First Rule ditegakkan pada jalur create; tidak ada transaksi lunas tanpa potongan stok lengkap. |
| Audit | Rekonstruksi ledger per produk dipakai sebagai dasar keputusan, bukan angka stok saja. |

## 5. RULES BARU

❌ **LARANGAN:** Membaca `stock_adjustments` tanpa pagination untuk laporan, timeline, atau rekonsiliasi.

✅ **PERINTAH:** Gunakan pembacaan per halaman 500 row pada seluruh query ledger stok.

❌ **LARANGAN:** Menulis log `stock_adjustments` sebelum perubahan stok dikonfirmasi berhasil.

✅ **PERINTAH:** Update stok dulu dengan optimistic guard, baru catat log.

❌ **LARANGAN:** Membiarkan transaksi `paid`/`success` berdiri ketika sebagian item fisik gagal dipotong stoknya.

✅ **PERINTAH:** Rollback potongan yang sudah terjadi dan turunkan status ke `pending`.

## 6. VERIFIKASI

| # | Item | Hasil |
|---|------|-------|
| 1 | `npm run lint` | PASS |
| 2 | `npm test` | PASS, 24 file, 122 test |
| 3 | `npm run build` | PASS |
| 4 | Audit ledger Raka | Konsisten, 0 anomali |
| 5 | Audit ledger Nurul sejak Juni | Konsisten, 0 continuity break |
| 6 | Opname fisik Nurul dan konfirmasi restock 19 Agustus | REQUIRED, tindakan operasional |

## 7. DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| CAPA callback iPaymu | `docs/CAPA-v6.0.5.md` |
| CAPA pergantian metode pembayaran | `docs/CAPA-v6.0.6.md` |
| Changelog | `changelog.txt` |
| Aturan agent | `AGENTS.md` |
