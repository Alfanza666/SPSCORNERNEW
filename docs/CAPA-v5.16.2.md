# CAPA — Corrective & Preventive Action
## SPS Corner v5.16.2 | 21 Juli 2026

---

## 1. RINGKASAN INSIDEN

| Item | Keterangan |
|------|-----------|
| **Insiden** | Transaksi paid/success lolos tanpa stock terpotong dan saldo seller tidak ter-settle |
| **Dampak** | 34 transaksi (19-20 Juli 2026) + 88 transaksi historis (Juni 2026) terdampak |
| **Kerugian Finansial** | Rp 8.260 (hanya 2 transaksi historis yang benar-benar belum di-settle) |
| **Kerugian Operasional** | Stock sistem tidak akurat, seller tidak melihat pesanan masuk |
| **Durasi Terjadi** | ~2 hari (19-20 Juli 2026) |
| **Status** | RESOLVED — v5.16.2 |

---

## 2. ROOT CAUSE ANALYSIS (RCA)

### 2.1 Bug Utama: PostgREST `.or()` + `metadata->>` Crash

| Item | Keterangan |
|------|-----------|
| **Apa yang terjadi** | Query Supabase di `stock.js` menggunakan `.or()` dengan `metadata->>` JSONB arrow syntax |
| **Error** | `column transactions.metadata does not exist` |
| **Lokasi** | `src/services/stock.js` — 4 fungsi: `restoreTransactionStock`, `deductTransactionStock`, `commitTransactionStock` |
| **Versi PostgREST** | `@supabase/postgrest-js@2.104.1` |

**Mekanisme Crash:**
```
.or('and(metadata->>stock_restored.is.null,...)')
        ↓
PostgREST query builder
        ↓
Generasi SQL WHERE: transactions.metadata->>'stock_restored' IS NULL
        ↓
PostgreSQL: ERROR — "column transactions.metadata does not exist"
        ↓
Fungsi stock GAGAL total — tidak ada stock yang dipotong/dikembalikan
```

**Kenapa bisa terjadi:**
- PostgREST `.or()` parser tidak menangani kombinasi `and()` groups + `metadata->>` JSONB extraction dengan benar
- Query sederhana (tanpa `.or()`) menggunakan `.filter("metadata->>'key'", "eq", value)` → **berhasil**
- Query kompleks (dengan `.or()` + nested `and()`) → **crash**

**Fixed di commit:** `8dcfef4`

**Solusi:** Ganti `.or()` + `metadata->>` dengan `.not('metadata', 'cs', ...)` yang menggunakan operator JSONB `@>` (contains) — lebih sederhana dan dihandle dengan benar oleh PostgREST.

---

### 2.2 Bug Turunan: Forced-to-Paid Path Skip Stock/Balance

| Item | Keterangan |
|------|-----------|
| **Apa yang terjadi** | iPaymu callback "failed" dengan delivered digital items → status dipaksa "paid" → early return SEBELUM stock/balance diproses |
| **Lokasi** | `src/routes/payments.ts:702-734` |
| **Dampak** | Transaksi status "paid" tapi stock tidak dipotong, saldo tidak masuk |

**Mekanisme:**
```
iPaymu callback: status = "failed"
  ↓
Cek: ada digital items delivered? → YA
  ↓
txStatus = "paid" (forced)
  ↓
return res.json({ success: true }) ← RETURN DI SINI
  ↓
Stock/balance processing (line 754-815) TIDAK PERNAH DIJALANKAN
```

**Fixed di commit:** `8dcfef4`

**Solusi:** Guard tambahan + pastikan semua payment path selalu memanggil stock/balance processing.

---

### 2.3 Bug Turunan: QRIS Pending + Auto-Cleanup Race Condition

| Item | Keterangan |
|------|-----------|
| **Apa yang terjadi** | QRIS transaction dibuat "pending" → auto-cleanup kembalikan stock → callback iPaymu datang → `deductTransactionStock()` return early karena `stock_deducted=false` |
| **Lokasi** | `src/services/stock.js` — `deductTransactionStock()` |
| **Dampak** | Stock tidak di-re-deduct setelah callback |

**Mekanisme:**
```
QRIS transaction created → status: "pending", stock_deducted: false
  ↓
Auto-cleanup (3 menit): restoreTransactionStock() → skip (stock_deducted=false) ✓
  ↓
iPaymu callback: status → "paid"
  ↓
deductTransactionStock() → cek stock_deducted === false → RETURN EARLY
  ↓
Stock tidak dipotong!
```

**Fixed di commit:** `8dcfef4`

**Solusi:** `deductTransactionStock()` sekarang handle kasus `stock_deducted=false` dengan fallback ke `commitTransactionStock()`.

---

### 2.4 Bug Turunan: iPaymu Status Mapping Hilang

| Item | Keterangan |
|------|-----------|
| **Apa yang terjadi** | Status iPaymu "berhasil"/"gagal" tidak di-mapping ke "paid"/"failed" |
| **Lokasi** | `src/routes/payments.ts` — iPaymu callback handler |
| **Dampak** | Callback jatuh ke "pending" — tidak trigger stock/balance |

**Fixed di commit:** `8dcfef4`

---

## 3. KOREKTIF (APA YANG SUDAH DIPERBAIKI)

### 3.1 Fix Kode (Commit `8dcfef4`)

| File | Perubahan |
|------|-----------|
| `src/services/stock.js` | Ganti 4 query `.or()` + `metadata->>` → `.not('metadata', 'cs', ...)` |
| `src/services/stock.js` | Tambah koperasi fallback di `commitTransactionStock()` |
| `src/routes/payments.ts` | Tambah `stock_deducted` guard (line 311, 755) |
| `src/routes/payments.ts` | Fix iPaymu status mapping (line 653-659) |
| `src/routes/payments.ts` | Hapus early return di forced-to-paid path (line 705-710) |
| `src/routes/transactions.ts` | Tambah `commitTransactionStock` fallback di admin approve |
| `src/pages/kiosk/History.tsx` | Sembunyikan tombol "Upload Ulang" untuk QRIS otomatis |

### 3.2 Reconciliasi Database (21 Juli 2026)

| Aksi | Jumlah | Detail |
|------|--------|--------|
| Stock deduction | 43 item | `products.stock` dikurangi sesuai quantity terjual |
| Stock adjustments audit trail | 43 record | Insert ke `stock_adjustments` dengan type `sale` |
| Transaction metadata fix | 34 transaksi | `stock_deducted: true` |
| Seller balance settlement | 21 transaksi | 19 dari fix Juli + 2 dari Juni historis |
| Balance flag fix | 88 transaksi | `balances_updated: true` |

---

## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)

### 4.1 Defense Layer 1: Database Function

```sql
find_stock_balance_mismatches()
```

**Tujuan:** Mendeteksi transaksi paid/success yang lolos tanpa stock/balance.

**Cara kerja:**
- Query semua transaksi `paid/success` 30 hari terakhir
- Cek apakah `stock_deducted=true` DAN `balances_updated=true`
- Cek apakah ada `stock_adjustments` record untuk setiap item fisik
- Cek apakah ada `seller_balance_adjustments` record untuk setiap seller
- Return list mismatch

### 4.2 Defense Layer 2: Auto-Reconcile Background Job

```js
autoReconcileTransactions() // tiap 5 menit
```

**Tujuan:** Fix otomatis mismatch tanpa intervensi manual.

**Cara kerja:**
1. Panggil `find_stock_balance_mismatches()`
2. Untuk setiap mismatch:
   - Jika stock belum dipotong → panggil `commitTransactionStock()`
   - Jika balance belum di-settle → panggil `apply_seller_balance_for_transaction` RPC
3. Log hasilnya
4. Jika auto-fix gagal → notifikasi admin untuk intervensi manual

**Impact:** Seller tidak pernah tahu ada masalah. Sistem fix sendiri dalam ≤5 menit.

### 4.3 Defense Layer 3: Monitoring API Endpoint

```
GET /api/admin/reconciliation/status
```

**Tujuan:** Dashboard monitoring untuk admin.

**Response:**
```json
{
  "status": "healthy" | "warning",
  "mismatches": 0,
  "missing_stock": 0,
  "missing_balance": 0,
  "stock_drifts": 0,
  "details": [],
  "checked_at": "2026-07-21T19:00:00Z"
}
```

---

## 5. PENCEGAHAN MASA DEPAN — RULES BARU

### 5.1 Aturan Kode: Dilarang Gunakan `.or()` + `metadata->>` di Supabase

```
❌ LARANGAN:
.or('and(metadata->>key.is.null,...)')

✅ PERINTAH:
.not('metadata', 'cs', JSON.stringify({key: value}))
```

**Alasan:** PostgREST `@supabase/postgrest-js@2.104.1` crash saat handle kombinasi `.or()` + `metadata->>` JSONB arrow syntax. Operator `@>` (contains) via `.not('column', 'cs', ...)` lebih aman dan lebih sederhana.

### 5.2 Aturan Kode: Setiap Payment Path WAJIB Panggil Stock + Balance

```
Payment Path Checklist:
☐ Status update ke "paid"/"success"
☐ Stock dipotong (commitTransactionStock / deductTransactionStock)
☐ Seller balance di-settle (updateSellerBalances / apply_seller_balance_for_transaction)
☐ Buyer points di-update (updateBuyerPoints)
☐ Digital items diproses (processDigitalItems)
☐ TIDAK ADA early return SEBELUM semua langkah di atas selesai
```

### 5.3 Aturan Kode: Gunakan Database Transaction untuk Operasi Kritis

```
❌ LARANGAN:
await updateStatus("paid");
await deductStock(); // Jika gagal, status sudah "paid" tapi stock tidak dipotong

✅ PERINTAH:
BEGIN TRANSACTION
  → deductStock()
  → updateStatus("paid")
COMMIT
// Jika gagal, semua rollback
```

### 5.4 Aturan Monitoring: Auto-Reconcile Wajib Aktif

- Background job `autoReconcileTransactions()` **TIDAK BOLEH DINONAKTIFKAN**
- Jika ada alasan untuk menonaktifkan, **WAJIB** ada pengganti (manual check atau alert lain)
- Admin **WAJIB** cek `/api/admin/reconciliation/status` minimal 1x sehari

---

## 6. VERIFIKASI & TESTING

### 6.1 Checklist Pengujian Manual

| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | Checkout produk fisik via QRIS | Stock terpotong, seller balance masuk | ✅ |
| 2 | Checkout produk fisik via manual transfer | Stock terpotong, seller balance masuk | ✅ |
| 3 | Checkout produk fisik via loyalty points | Stock terpotong, seller balance masuk | ✅ |
| 4 | iPaymu callback "paid" | Stock terpotong, seller balance masuk | ✅ |
| 5 | iPaymu callback "failed" (tanpa digital) | Stock dikembalikan, status "failed" | ✅ |
| 6 | iPaymu callback "failed" (dengan digital delivered) | Status tetap "paid", stock tetap dipotong | ✅ |
| 7 | Admin approve transaksi manual | Stock terpotong, seller balance masuk | ✅ |
| 8 | Auto-cleanup transaksi expired | Stock dikembalikan, status "failed" | ✅ |
| 9 | Late callback setelah auto-cleanup | Stock di-re-deduct, seller balance masuk | ✅ |
| 10 | Checkout koperasi (seller_id = null) | Stock terpotong, admin dapat notifikasi | ✅ |
| 11 | `GET /api/admin/reconciliation/status` | Return status "healthy" | ✅ |
| 12 | Background job auto-reconcile | Mismatch terdeteksi dan fix otomatis | ✅ |

### 6.2 Edge Cases

| # | Skenario | Expected Result |
|---|----------|-----------------|
| E1 | Checkout 0 stock produk | Gagal (constraint) |
| E2 | Double callback iPaymu | Idempotent — tidak double-deduct |
| E3 | Concurrent checkout same product | Stock aman (database-level locking) |
| E4 | Seller tidak ada di profiles | Error logged, tidak crash |
| E5 | Transaksi dengan 0 seller_id (koperasi) | Stock dipotong, admin notified |

---

## 7. DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| Changelog | `changelog.txt` |
| AGENTS.md | `AGENTS.md` |
| Reconciliation SQL | `scripts/reconcile_fn.sql` |
| Deploy Script | `scripts/deploy-vps.ps1` |

---

## 8. VERSI & REKOMENDASI

| Item | Versi |
|------|-------|
| **Versi Saat Ini** | v5.16.2 |
| **Tipe Perubahan** | MINOR (fitur baru: auto-reconcile + monitoring) + PATCH (bug fix) |
| **Rekomendasi** | v5.16.2 sudah mencakup semua fix dan pencegahan |

---

*Dokumen ini dibuat pada 21 Juli 2026 oleh AI Agent (opencode)*
*Untuk pertanyaan, hubungi: admin@spscorner.store*
