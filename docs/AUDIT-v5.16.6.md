# AUDIT v5.16.6 — Alur Pembelian, Stock, Loyalty Point & Hidden Bugs

## 1. RINGKASAN AUDIT

| Item | Keterangan |
|------|-----------|
| Scope | Alur checkout, payment, stock management, loyalty point, seller balance, race conditions |
| Metode | Full code review — server.ts, payments.ts, transactions.ts, stock.js, payment.js, background-jobs.js, Checkout.tsx |
| Temuan | 14 bugs (2 Critical, 3 High, 6 Medium, 3 Low) |
| Status | **AUDIT COMPLETE — NO CHANGES MADE** |

---

## 2. CRITICAL BUG — Double Payment Loyalty Point

### 2.1 Kronologi

| Step | Lokasi | Apa yang Terjadi |
|------|--------|-----------------|
| 1 | `Checkout.tsx:486-535` | User klik "Pakai" → `handleApplyPoints()` membuat transaksi + panggil partial-pay |
| 2 | `payments.ts:662` | Partial-pay potong point, **TIDAK ubah `total_amount`** |
| 3 | `payments.ts:671` | Simpan `metadata.remaining_amount` — **TAPI TIDAK PERNAH DIBACA payment endpoint** |
| 4 | `Checkout.tsx:301-313` | User pilih QRIS → kirim `amount: grandTotal` (Rp 50.000 penuh!) |
| 5 | `payments.ts:743` | Backend iPaymu pakai `transaction.total_amount` = Rp 50.000 |

### 2.2 Contoh Skenario

| Item | Nilai |
|------|-------|
| Total belanja | Rp 50.000 |
| Point dipakai | 5.000 (Rp 5.000) |
| Seharusnya bayar | Rp 45.000 |
| **Yang terjadi** | **Bayar Rp 50.000 via QRIS** |
| **Total terpotong** | **Rp 55.000** |
| **Rugi user** | **Rp 5.000** |

### 2.3 Semua Payment Method Terdampak

| Payment Method | Lokasi Bug | Amount yang Dikirim |
|---|---|---|
| QRIS Dynamic | `Checkout.tsx:301` | `grandTotal` (penuh) |
| VA BCA | `Checkout.tsx:301` | `grandTotal` (penuh) |
| VA Mandiri | `Checkout.tsx:301` | `grandTotal` (penuh) |
| Manual QRIS | `Checkout.tsx:661` | `expected_amount: grandTotal` |
| Transfer Koperasi | `Checkout.tsx:711` | `total_amount: grandTotal` |
| Redirect iPaymu | `Checkout.tsx:782` | `getTotal()` (penuh) |

### 2.4 Root Cause Analysis (5 Whys)

```
Why 1: User bayar full + point terpotong?
→ Semua payment endpoint charge transaction.total_amount (penuh).

Why 2: Kenapa charge penuh?
→ partial-pay TIDAK ubah total_amount (untuk akurasi laporan).

Why 3: Kenapa payment endpoint tidak cek sisa?
→ Tidak ada mekanisme. metadata.remaining_amount disimpan TAPI TIDAK DIBACA.

Why 4: Kenapa arsitektur begini?
→ Komentar di payments.ts:662: "JANGAN ubah total_amount agar laporan akurat"
   → niat bagus, implementasi tidak lengkap.

Why 5: Kenapa lolos testing?
→ Flow partial-pay → method selection → actual payment tidak diuji end-to-end.
```

---

## 3. CRITICAL BUG #2 — Point Tidak Direfund Saat Cancel

### 3.1 Lokasi

`transactions.ts:638-697` — `POST /api/transactions/cancel`

### 3.2 Masalah

Saat user cancel transaksi:
- ✅ Stock dikembalikan (`restoreTransactionStock`)
- ❌ **Point TIDAK dikembalikan** — tidak ada pengecekan `metadata.point_payment`

### 3.3 Skenario

1. User pakai 5.000 point (langsung dipotong)
2. Sebelum bayar sisa, user cancel
3. **5.000 point hilang permanen**

### 3.4 Juga Terjadi di iPaymu Failure

`payments.ts:850-883` — Saat iPaymu callback status "failed", point juga **tidak direfund**.

---

## 4. HIGH BUG #3 — Points Payment Race Condition

### 4.1 Lokasi

`payments.ts:557-586` — `POST /api/payment/points/pay`

### 4.2 Urutan Operasi Berbahaya

```
1. Point dipotong dulu (line 558-563)
2. Lalu update status transaksi (line 578-586)
3. Jika step 2 gagal → point hilang, transaksi masih pending
4. User bisa bayar lagi dengan method lain → DOUBLE PAY
```

### 4.3 Dampak

- Point hilang permanen
- Transaksi bisa dibayar dua kali

---

## 5. HIGH BUG #4 — iPaymu Callback No Signature = Skip Verification

### 5.1 Lokasi

`payments.ts:782`

### 5.2 Masalah

Jika callback iPaymu tidak punya signature, verifikasi **dilewati**. Ini berarti request tidak terautentikasi bisa memicu pemrosesan pembayaran.

---

## 6. HIGH BUG #5 — Stock Commit Failure di Manual Verify

### 6.1 Lokasi

`payments.ts:448-449`

### 6.2 Masalah

Jika `commitTransactionStock` gagal setelah status diupdate ke "paid":
- Transaksi status = "paid"
- Stock TIDAK dipotong
- Error di-throw tapi status sudah terlanjur "paid"

---

## 7. MEDIUM BUG #6 — Seller Balance & Buyer Points Failure Silently Swallowed

### 7.1 Lokasi

`payments.ts:918-920` — iPaymu callback

### 7.2 Masalah

Kegagalan settlement seller balance dan buyer points **dilog tapi tidak di-throw**. Transaksi berhasil "paid" tapi seller tidak dapat saldo dan buyer tidak dapat point.

---

## 8. MEDIUM BUG #7 — Points History Diinsert Meski RPC + Fallback Gagal

### 8.1 Lokasi

`payment.js:48-51`

### 8.2 Masalah

`loyalty_points_history` diinsert di luar try-catch RPC. Jika RPC gagal DAN fallback gagal, history tetap terbuat — phantom point records.

---

## 9. MEDIUM BUG #8 — Points Earning Fallback Tidak Atomic

### 9.1 Lokasi

`payment.js:42-46`

### 9.2 Masalah

Fallback read-then-write tanpa `.gte()` guard. Di bawah race condition, point bisa terduplikasi.

---

## 10. MEDIUM BUG #9 — Manual Verify Tidak Ada Idempotency

### 10.1 Lokasi

`payments.ts:278-521`

### 10.2 Masalah

Tidak ada idempotency check beyond `previousStatus`. Parallel submission bisa memicu double processing.

---

## 11. MEDIUM BUG #10 — Admin Approve Tidak Ada Idempotency

### 11.1 Lokasi

`transactions.ts:43-147`

### 11.2 Masalah

Hanya check status guard. Double-approve bisa terjadi sebelum first request selesai.

---

## 12. MEDIUM BUG #11 — Point Earned on Full Amount

### 12.1 Lokasi

`payment.js:34`

### 12.2 Masalah

```javascript
const pointsEarned = Math.floor(numAmount * 0.008);
```

Point 0.8% dihitung dari `total_amount` penuh, termasuk bagian yang sudah dibayar pakai point. Financial leak kecil tapi akumulatif.

---

## 13. LOW BUG #12 — metadata.remaining_amount Tidak Pernah Dibaca

### 13.1 Lokasi

`payments.ts:671` (disimpan) — Tidak ada yang membaca

### 13.2 Masalah

Field `remaining_amount` ada di metadata tapi zero payment endpoint menggunakannya.

---

## 14. LOW BUG #13 — Idempotency Check Heuristic

### 14.1 Lokasi

`transactions.ts:458-471`

### 14.2 Masalah

Idempotency berdasarkan `total_amount + item_count`. Dua keranjang berbeda dengan total + jumlah item sama bisa salah dideduplikasi.

---

## 15. LOW BUG #14 — confirm_stock_deduction Dead Code

### 15.1 Lokasi

`supabase-schema.sql:149-176`

### 15.2 Masalah

DB function tidak pakai `FOR UPDATE`. TAPI function ini **tidak dipanggil dari aplikasi** — app pakai `atomicAdjustStock`. Hanya dead code.

---

## 16. AUDIT STOCK MANAGEMENT

### 16.1 Semua Stock Mutation Paths

| # | Trigger | Fungsi | File:Line |
|---|---------|--------|-----------|
| 1 | Transaksi paid langsung | `atomicAdjustStock` | `transactions.ts:567-599` |
| 2 | Transaksi pending → paid | `commitTransactionStock` | `stock.js:264-316` |
| 3 | Cancel/transaksi gagal | `restoreTransactionStock` | `stock.js:95-172` |
| 4 | iPaymu paid sesudah auto-cleanup | `deductTransactionStock` | `stock.js:175-262` |
| 5 | Auto-cleanup expired | `restoreTransactionStock` → status update | `background-jobs.js:206-228` |
| 6 | Restock approval (admin) | `atomicAdjustStock` (positive delta) | `stock.ts:48-56` |
| 7 | Product return approval | `atomicAdjustStock` (negative delta) | `productReturns.ts:108-117` |
| 8 | Stock opname (admin) | Optimistic locking manual | `AdminStockOpname.tsx:55-94` |
| 9 | Cart reservation | `reserve_stock` RPC | `Cart.tsx:140-144` |

### 16.2 Proteksi Race Condition

| Mekanisme | Lokasi |
|---|---|
| `SELECT ... FOR UPDATE` di RPC | `database/migrations/001_stock_rpc.sql` |
| Claim-based idempotency | `stock.js:108-119, 270-276` |
| Per-item guard (cek `stock_adjustments`) | `stock.js:134-145, 289-300` |
| Auto-reconcile tiap 5 menit | `background-jobs.js:89-154` |
| Stock drift detection tiap 30 menit | `stock.js:384-425` |

### 16.3 Potensi Masalah Stock

| # | Issue | Severity |
|---|---|---|
| 1 | `commitTransactionStock` tidak pakai `p_min_stock` → stock bisa negatif | MEDIUM |
| 2 | Tidak ada atomic transaction antara status update dan stock deduction | MEDIUM (dimitigasi auto-reconcile) |
| 3 | Stock opname: audit row diinsert SEBELUM optimistic lock check | LOW |

---

## 17. AUDIT CANCELLATION FLOW

### 17.1 Semua Cancel Paths

| # | Trigger | Lokasi | Urutan |
|---|---------|--------|--------|
| 1 | Auto-cleanup (15 menit) | `background-jobs.js:156-244` | Restore → Status update |
| 2 | Buyer cancel | `transactions.ts:638-697` | Restore → Status update |
| 3 | Admin reject | `transactions.ts:149-191` | Restore → Status update |
| 4 | iPaymu failed callback | `payments.ts:850-883` | Restore → Status update |

### 17.2 Evaluasi

- ✅ **Urutan benar** — restore SELALU sebelum status update
- ✅ **Auth check** — buyer cancel punya ownership check
- ✅ **Guard** — auto-cleanup skip transaksi dengan receipt_image
- ✅ **Re-deduct** — handle late iPaymu callback sesudah auto-cleanup
- ❌ **Tidak ada point refund** — di SEMUA cancel paths

---

## 18. AUDIT SELLER BALANCE

### 18.1 Settlement

| Item | Keterangan |
|------|-----------|
| Fungsi | `apply_seller_balance_for_transaction` (RPC) |
| Atomicity | ✅ Atomic — semua seller dalam 1 transaksi di-handle sekaligus |
| Idempotency | ✅ Idempotent |
| Dipanggil di | Manual verify, iPaymu callback, admin approve, points pay |

### 18.2 Masalah

- iPaymu callback (`payments.ts:918`): kegagalan settlement **disebut tapi tidak di-throw** — silent failure

---

## 19. YANG SUDAH BENAR ✅

| Area | Detail | Lokasi |
|------|--------|--------|
| Server-side price reconciliation | Harga dari DB, bukan dari client | `transactionCreationValidation.ts:195-207` |
| Receipt validation token | HMAC-SHA256 + atomic consumption | `receiptValidationToken.ts` |
| Stock restore before status update | Semua cancel/fail path | Multiple |
| Auto-reconcile | Background job tiap 5 menit | `background-jobs.js:89-154` |
| Atomic stock RPC | `SELECT ... FOR UPDATE` + optimistic fallback | `stock.js:29-92` |
| Claim/release pattern | Prevent double-restore/double-deduct | `stock.js:95-262` |
| Cart reservation | `reserve_stock` RPC + auto-expire 3 menit | `Cart.tsx:140-144` |
| Guard overwrite paid | iPaymu callback tidak overwrite paid/success | `payments.ts:840-843` |
| Re-deduct mechanism | Handle late iPaymu callback | `payments.ts:902-903` |
| Rate limiting | Semua payment/transaction endpoint | `server.ts:136-194` |
| Points atomic deduction | `.gte()` anti-double-spend | `payments.ts:557-566` |
| Transaction creation validation | Comprehensive input validation | `transactionCreationValidation.ts` |

---

## 20. DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| CAPA v5.16.2 | `docs/CAPA-v5.16.2.md` |
| CAPA v5.16.5 | `docs/CAPA-v5.16.5.md` |
| CAPA v5.16.6 | `docs/CAPA-v5.16.6.md` |
| Changelog | `changelog.txt` |
| AGENTS.md | `AGENTS.md` |

---

**Status:** AUDIT COMPLETE — NO CHANGES MADE
**Versi:** v5.16.6
**Tanggal:** 10 Agustus 2026
