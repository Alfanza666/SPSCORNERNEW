# CAPA v5.16.7 — Critical Payment & Point Fix

## 1. RINGKASAN INSIDEN

| Item | Keterangan |
|------|-----------|
| Insiden | Double payment saat pakai loyalty point + point tidak direfund saat cancel + race condition points pay |
| Dampak | User rugi sejumlah point yang dipakai (double charge); point hilang permanen saat cancel |
| Kerugian | Finansial (user overpay) + reputasi (user complain) |
| Durasi | Sejak fitur loyalty point diterapkan |
| Status | **RESOLVED** |

---

## 2. ROOT CAUSE ANALYSIS (RCA)

### 2.1 Bug #1 — Double Payment Loyalty Point

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Semua payment method (QRIS, VA, Manual QRIS, Transfer Koperasi, iPaymu redirect) charge `total_amount` penuh meski user sudah pakai point |
| Error | Tidak ada error — user bayar full + point terpotong |
| Lokasi | `Checkout.tsx:306,661,711,793` + `payments.ts:743,267` |
| Mekanisme | `metadata.remaining_amount` disimpan di backend tapi TIDAK PERNAH dibaca oleh payment endpoint |
| Kenapa bisa terjadi | Niat baik: "JANGAN ubah total_amount agar laporan akurat" (payments.ts:662) tapi implementasi tidak lengkap |

### 2.2 Bug #2 — Point Tidak Dikembalikan Saat Cancel

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Semua cancel path restore stock dengan benar tapi TIDAK ada yang refund point |
| Error | Tidak ada error — point hilang permanen |
| Lokasi | `transactions.ts:676` (buyer cancel), `transactions.ts:173` (admin reject), `payments.ts:886` (iPaymu failed), `background-jobs.js:209` (auto-cleanup) |
| Mekanisme | Tidak ada fungsi `refundTransactionPoints` yang dipanggil di cancel path manapun |
| Kenapa bisa terjadi | Fokus awal hanya pada stock restore, point refund tidak terpikirkan |

### 2.3 Bug #3 — Race Condition Points Pay

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Point dipotong dulu, status update gagal → point hilang, transaksi masih pending → user bisa bayar lagi |
| Error | Transient database error pada status update |
| Lokasi | `payments.ts:583-612` |
| Mekanisme | Tidak ada idempotency guard dan tidak ada rollback mechanism |
| Kenapa bisa terjadi | Asumsi status update tidak akan gagal |

---

## 3. KOREKTIF (APA YANG DIPERBAIKI)

| File | Perubahan |
|------|-----------|
| `src/routes/payments.ts` | Tambah `getChargeableAmount(transaction)` helper — return `remaining_amount` jika ada, else `total_amount` |
| `src/routes/payments.ts` | Direct payment: gunakan `getChargeableAmount()` untuk amount iPaymu |
| `src/routes/payments.ts` | Redirect payment: gunakan `getChargeableAmount()` untuk amount iPaymu |
| `src/routes/payments.ts` | Manual verify: override `expected_amount` dengan `chargeableAmount` dari metadata |
| `src/routes/payments.ts` | `loadPayableTransaction`: tambahkan `metadata` ke select query |
| `src/routes/payments.ts` | iPaymu failed callback: tambahkan `refundTransactionPoints()` call |
| `src/routes/payments.ts` | Points pay: tambahkan idempotency guard + rollback on failure |
| `src/routes/payments.ts` | Partial pay: tambahkan idempotency guard |
| `src/routes/transactions.ts` | Buyer cancel: tambahkan `refundTransactionPoints()` call |
| `src/routes/transactions.ts` | Admin reject: tambahkan `refundTransactionPoints()` call |
| `src/services/payment.js` | Tambah `refundTransactionPoints(transactionId)` — atomic refund + idempotency via `point_refunded` flag |
| `src/services/background-jobs.js` | Auto-cleanup: tambahkan `refundPointsFn()` call setelah stock restore |
| `src/pages/kiosk/Checkout.tsx` | `handleDirectPayment`: kirim `remainingTotal` bukan `grandTotal` |
| `src/pages/kiosk/Checkout.tsx` | `handleManualQris`: tambahkan check `transactionId` (reuse existing) |
| `src/pages/kiosk/Checkout.tsx` | `handleTransferKoperasi`: tambahkan check `transactionId` (reuse existing) |
| `src/pages/kiosk/Checkout.tsx` | `handlePayment`: kirim `remainingTotal` bukan `getTotal()` |
| `src/pages/kiosk/Checkout.tsx` | `verifyReceipt`: kirim `remainingTotal` bukan `grandTotal` |
| `server.ts` | Import + pass `refundTransactionPoints` ke routes dan background jobs |

---

## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)

| Layer | Komponen | Mekanisme |
|-------|----------|-----------|
| Backend | `getChargeableAmount()` | Helper function yang selalu cek `metadata.remaining_amount` sebelum charge ke payment gateway |
| Backend | `refundTransactionPoints()` | Fungsi refund point atomic + idempotency via `point_refunded` flag |
| Backend | Idempotency guard (points pay) | Cek `point_payment_processed` sebelum proses, rollback jika status update gagal |
| Backend | Idempotency guard (partial pay) | Cek `metadata.point_payment` sebelum deduct point |
| Frontend | `remainingTotal` | Semua payment handler kirim `remainingTotal` bukan `grandTotal` |
| Frontend | Transaction reuse | `handleManualQris` dan `handleTransferKoperasi` cek `transactionId` sebelum create baru |

---

## 5. PENCEGAHAN MASA DEPAN — RULES BARU

❌ **LARANGAN:** DILARANG hardcode `total_amount` atau `grandTotal` di payment endpoint tanpa cek `metadata.remaining_amount` terlebih dahulu.

✅ **PERINTAH:** Setiap payment endpoint WAJIB gunakan `getChargeableAmount(transaction)` untuk menentukan amount yang di-charge ke payment gateway.

✅ **PERINTAH:** Setiap cancel/reject path WAJIB panggil `refundTransactionPoints(transactionId)` setelah stock restore.

✅ **PERINTAH:** Setiap payment path yang deduct points harus ada idempotency guard (`point_payment_processed` atau `point_payment` flag) dan rollback mechanism.

---

## 6. VERIFIKASI & TESTING

| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | User belanja Rp 50.000, pakai 5.000 point → bayar via QRIS | iPaymu charge Rp 45.000 | ✅ |
| 2 | User belanja Rp 50.000, tidak pakai point → bayar via QRIS | iPaymu charge Rp 50.000 | ✅ |
| 3 | User pakai point senilai full amount | Tidak perlu payment gateway | ✅ |
| 4 | User pakai 5.000 point → cancel → cek point kembali +5.000 | Point refund + history type "refund" | ✅ |
| 5 | User pakai point → iPaymu failed callback → cek point kembali | Point refund | ✅ |
| 6 | Transaksi auto-expire 15 menit → cek point kembali | Point refund | ✅ |
| 7 | Double cancel → point hanya dikembalikan sekali | Idempotency check | ✅ |
| 8 | Hit points/pay endpoint dua kali bersamaan | Point hanya dipotong sekali | ✅ |
| 9 | Points pay: potong point berhasil tapi update status gagal | Point di-rollback | ✅ |
| 10 | Partial pay: hit dua kali | Idempotency guard, return success | ✅ |

---

## 7. DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| AUDIT v5.16.6 | `docs/AUDIT-v5.16.6.md` |
| RESEARCH iPaymu Signature | `docs/RESEARCH-ipaymu-signature-v5.16.6.md` |
| RESEARCH Stock Commit | `docs/RESEARCH-stock-commit-v5.16.6.md` |
| Changelog | `changelog.txt` |
| AGENTS.md | `AGENTS.md` |

---

## 8. EXTENDED FIXES (AUDIT v5.16.6 Continued)

### 8.1 FIX A — iPaymu Unverified Callback Monitoring

| Item | Keterangan |
|------|-----------|
| Masalah | Callback tanpa validasi signature hanya dilog tapi tidak ada alerting atau audit trail |
| Dampak | Potensi payment bypass tidak terdeteksi sampai seller komplain |
| Solusi | In-memory counter per hour + unverified flag disimpan ke `payment_details` |
| File | `payments.ts:5-11,835-852,1000-1011` |
| Mekanisme | Jika `receivedSignature !== validSignature`, counter += 1; jika counter > 5, log warning; flag `unverified_callback: true` + `unverified_at` disimpan ke DB |

### 8.2 FIX B — Stock Commit Reorder + Buyer Points Auto-Reconcile

| Item | Keterangan |
|------|-----------|
| Masalah | Seller balance + buyer points bisa terlewat jika `commitTransactionStock()` gagal sebelum status update |
| Dampak | Seller tidak dapat bayaran; buyer tidak dapat poin |
| Solusi | Pindahkan `commitTransactionStock()` SEBELUM status update; tambahkan auto-reconcile buyer points |
| File | `payments.ts:501-509,1041-1055` + `background-jobs.js:141-153,183-215` |
| Mekanisme | (1) Manual verify & iPaymu callback: stock diproses dulu, baru update status. (2) Auto-reconcile: query `transactions` where `status=paid` tanpa `points_history`, limit 50, periksa per tx apakah sudah ada points_history type='earned' |

### 8.3 FIX C — Silent Failure: Seller Balance & Buyer Points Failure Flags

| Item | Keterangan |
|------|-----------|
| Masalah | Jika `updateSellerBalances()` atau `updateBuyerPoints()` gagal, error di-log tapi tidak ada mekanisme retry |
| Dampak | Seller balance atau buyer points hilang permanen |
| Solusi | Simpan flag `seller_balance_failed`/`buyer_points_failed` di `payment_details`; auto-reconcile retry + clear flag |
| File | `payments.ts:505-515,1051-1066` + `background-jobs.js:141-168` |
| Mekanisme | Catch block di manual verify & iPaymu callback set flag di `payment_details`; auto-reconcile query flag-based dan retry, clear flag on success |

### 8.4 FIX D — Phantom Point History

| Item | Keterangan |
|------|-----------|
| Masalah | `points_history` insert dilakukan di luar success check — jika RPC & fallback gagal, phantom record terbuat |
| Dampak | Point history tidak akurat; user lihat poin di history tapi tidak ada di saldo |
| Solusi | Insert `points_history` hanya dilakukan JIKA RPC atau fallback berhasil (`source` variable) |
| File | `payment.js:105-150` |
| Mekanisme | Tambah variabel `source`; set ke `'rpc'` atau `'fallback'` hanya saat success; insert history di dalam `if (source)` block |

### 8.5 FIX E — Points Earning Race Condition

| Item | Keterangan |
|------|-----------|
| Masalah | Fallback read-then-write di `updateBuyerPoints()` dan `refundTransactionPoints()` tanpa `.gte()` guard |
| Dampak | Concurrent update bisa overwrite — point duplikat atau hilang |
| Solusi | Tambah `.gte('loyalty_points', currentPoints)` di semua fallback update |
| File | `payment.js:38-51,118-126` |
| Mekanisme | Baca `currentPoints`, lalu update dengan `.gte('loyalty_points', currentPoints)` — jika nilai berubah karena concurrent, update gagal |

### 8.6 FIX F — Idempotency Lock: Manual Verify & Admin Approve

| Item | Keterangan |
|------|-----------|
| Masalah | Double-click atau race condition bisa memicu proses ganda (double settlement) |
| Dampak | Double seller balance, double buyer points, stock double-deducted |
| Solusi | Atomic status lock: `UPDATE SET status='processing' WHERE status='pending'`; rollback ke asal di catch block |
| File | `payments.ts:316-323` + `transactions.ts:64-75,155-161` |
| Mekanisme | (1) Manual verify: `UPDATE status='processing' WHERE status='pending'` → jika gagal, return 409. (2) Admin approve: `UPDATE status='processing' WHERE status='manual_verification'` → jika gagal, return 409. (3) Catch block: rollback ke status asal |

### 8.7 FIX G — Point Reward Calculation: Correct Amount

| Item | Keterangan |
|------|-----------|
| Masalah | Points earned dihitung dari `total_amount` bukan `paid_amount` — user yang bayar parsial dapet poin berlebihan |
| Dampak | Loyalty point inflated untuk partial payments |
| Solusi | Gunakan `getChargeableAmount(transaction)` di semua `updateBuyerPoints()` calls |
| File | `payments.ts:508,1059` + `background-jobs.js:60-67,166,211` |
| Mekanisme | `getAutoReconcileChargeableAmount(tx)` cek `payment_details.loyalty_points_used`, return `paid_amount` jika pakai point |

### 8.8 FIX H — points_history Type Constraint Documentation

| Item | Keterangan |
|------|-----------|
| Masalah | Valid types tidak terdokumentasi di kode; developer bisa insert type yang ditolak DB |
| Dampak | DB CHECK constraint error jika type invalid |
| Solusi | Tambah komentar dokumentasi di `payment.js` dan `payments.ts` |
| File | `payment.js:1-4`, `payments.ts:1-6` |
| Valid Types | `'earned'`, `'spent'`, `'expired'`, `'refund'`, `'compensation'` |
