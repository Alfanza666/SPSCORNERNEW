# CAPA — Corrective & Preventive Action
## SPS Corner v5.16.2 | 2026-07-21

---

## 1. RINGKASAN INSIDEN

| Item | Keterangan |
|------|-----------|
| **Insiden** | Transaksi paid/success lolos tanpa stock terpotong dan saldo seller tidak ter-settle |
| **Dampak** | 34 transaksi (19-20 Juli 2026) + 88 transaksi historis (Juni 2026) terdampak |
| **Kerugian Finansial** | Rp 8.260 (hanya 2 transaksi historis) |
| **Kerugian Operasional** | Stock sistem tidak akurat, seller tidak melihat pesanan masuk |
| **Durasi** | ~2 hari (19-20 Juli 2026) |
| **Status** | RESOLVED |

## 2. ROOT CAUSE ANALYSIS (RCA)

### 2.1 PostgREST `.or()` + `metadata->>` Crash

| Item | Keterangan |
|------|-----------|
| **Apa yang terjadi** | Query Supabase di stock.js menggunakan .or() dengan metadata->> JSONB arrow syntax |
| **Error** | `column transactions.metadata does not exist` |
| **Lokasi** | `src/services/stock.js — 4 fungsi: restoreTransactionStock, deductTransactionStock, commitTransactionStock` |
| **Root Cause** | PostgREST .or() parser tidak menangani kombinasi and() groups + metadata->> JSONB extraction |
| **Fix** | Ganti .or() + metadata->> dengan .not('metadata', 'cs', ...) yang menggunakan operator JSONB @> |

### 2.2 Forced-to-Paid Path Skip Stock/Balance

| Item | Keterangan |
|------|-----------|
| **Apa yang terjadi** | iPaymu callback "failed" dengan delivered digital items → status dipaksa "paid" → early return SEBELUM stock/balance diproses |
| **Error** | `Tidak ada error — silent failure` |
| **Lokasi** | `src/routes/payments.ts:702-734` |
| **Root Cause** | Early return di path digital items sebelum pemanggilan stock/balance processing |
| **Fix** | Guard tambahan + pastikan semua payment path selalu memanggil stock/balance processing |

### 2.3 QRIS Pending + Auto-Cleanup Race Condition

| Item | Keterangan |
|------|-----------|
| **Apa yang terjadi** | QRIS transaction dibuat "pending" → auto-cleanup kembalikan stock → callback iPaymu datang → deductTransactionStock() return early karena stock_deducted=false |
| **Error** | `Tidak ada error — stock tidak di-re-deduct` |
| **Lokasi** | `src/services/stock.js — deductTransactionStock()` |
| **Root Cause** | deductTransactionStock() return early jika stock_deducted=false tanpa fallback ke commitTransactionStock() |
| **Fix** | deductTransactionStock() sekarang handle kasus stock_deducted=false dengan fallback ke commitTransactionStock() |

### 2.4 iPaymu Status Mapping Hilang

| Item | Keterangan |
|------|-----------|
| **Apa yang terjadi** | Status iPaymu "berhasil"/"gagal" tidak di-mapping ke "paid"/"failed" |
| **Error** | `Tidak ada error — callback jatuh ke "pending"` |
| **Lokasi** | `src/routes/payments.ts — iPaymu callback handler` |
| **Root Cause** | Pemetaan status iPaymu yang sebelumnya dihapus |
| **Fix** | Kembalikan pemetaan status "berhasil"/"gagal" di callback iPaymu |

## 3. KOREKTIF (APA YANG DIPERBAIKI)

| File | Perubahan |
|------|----------|
| `src/services/stock.js` | Ganti 4 query .or() + metadata->> → .not('metadata', 'cs', ...) |
| `src/services/stock.js` | Tambah koperasi fallback di commitTransactionStock() |
| `src/routes/payments.ts` | Tambah stock_deducted guard (line 311, 755) |
| `src/routes/payments.ts` | Fix iPaymu status mapping (line 653-659) |
| `src/routes/payments.ts` | Hapus early return di forced-to-paid path (line 705-710) |
| `src/routes/transactions.ts` | Tambah commitTransactionStock fallback di admin approve |
| `src/pages/kiosk/History.tsx` | Sembunyikan tombol "Upload Ulang" untuk QRIS otomatis |

## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)

| Layer | Komponen | Mekanisme |
|-------|----------|-----------|
| Detection | `find_stock_balance_mismatches()` | DB function — query mismatch kapan saja |
| Auto-Fix | `autoReconcileTransactions()` | Background job — fix otomatis tiap 5 menit |
| Monitoring | `GET /api/admin/reconciliation/status` | API endpoint — dashboard admin |

## 5. PENCEGAHAN MASA DEPAN — RULES BARU

❌ **LARANGAN:** DILARANG gunakan .or() + metadata->> di Supabase query
✅ **PERINTAH:** Gunakan .not('metadata', 'cs', JSON.stringify({key: value})) sebagai pengganti
📄 **REFERENSI:** docs/CAPA-v5.16.2.md

❌ **LARANGAN:** DILARANG ada early return SEBELUM stock deduction + seller balance settlement
✅ **PERINTAH:** Setiap payment path WAJIB panggil stock + balance processing
📄 **REFERENSI:** docs/CAPA-v5.16.2.md section 5.2

❌ **LARANGAN:** DILARANG nonaktifkan background job autoReconcileTransactions()
✅ **PERINTAH:** Jika perlu dinonaktifkan, WAJIB ada pengganti
📄 **REFERENSI:** docs/CAPA-v5.16.2.md

## 6. VERIFIKASI & TESTING

| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| TC-01 | Checkout produk fisik via QRIS | Stock terpotong, seller balance masuk | PASS |
| TC-02 | Checkout produk fisik via manual transfer | Stock terpotong, seller balance masuk | PASS |
| TC-03 | Checkout produk fisik via loyalty points | Stock terpotong, seller balance masuk | PASS |
| TC-04 | iPaymu callback "paid" | Stock terpotong, seller balance masuk | PASS |
| TC-05 | iPaymu callback "failed" (tanpa digital) | Stock dikembalikan, status "failed" | PASS |
| TC-06 | iPaymu callback "failed" (dengan digital delivered) | Status tetap "paid", stock tetap dipotong | PASS |
| TC-07 | Admin approve transaksi manual | Stock terpotong, seller balance masuk | PASS |
| TC-08 | Auto-cleanup transaksi expired | Stock dikembalikan, status "failed" | PASS |
| TC-09 | Late callback setelah auto-cleanup | Stock di-re-deduct, seller balance masuk | PASS |
| TC-10 | Checkout koperasi (seller_id = null) | Stock terpotong, admin dapat notifikasi | PASS |
| TC-11 | GET /api/admin/reconciliation/status | Return status "healthy" | PASS |
| TC-12 | Background job auto-reconcile | Mismatch terdeteksi dan fix otomatis | PASS |

## 7. FILES YANG DIUBAH

- `src/services/stock.js`
- `src/routes/payments.ts`
- `src/routes/transactions.ts`
- `src/services/background-jobs.js`
- `src/routes/diagnostics.ts`
- `src/pages/kiosk/History.tsx`
- `server.ts`
- `package.json`
- `changelog.txt`
- `AGENTS.md`
- `docs/CAPA-v5.16.2.md`
- `scripts/reconcile_fn.sql`

---

*Dokumen ini dibuat pada 2026-07-21 oleh AI Agent (opencode)*
