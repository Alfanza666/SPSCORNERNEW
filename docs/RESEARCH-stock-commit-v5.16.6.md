# RESEARCH 2 — Stock Commit Failure setelah Status "Paid"

## 1. RINGKASAN

| Item | Keterangan |
|------|-----------|
| Bug | Status transaksi di-set "paid" SEBELUM `commitTransactionStock` — jika stock commit gagal, status sudah "paid" tapi stok tidak terpotong |
| Severity | HIGH (dimitigasi auto-reconcile, tapi ada window oversell) |
| Lokasi | `payments.ts:420-449` (manual verify), `payments.ts:886-909` (iPaymu callback) |

---

## 2. ALUR MANUAL VERIFY — Urutan Eksekusi

### Sequence Diagram (Teks)

```
Admin                   Backend (payments.ts)              Supabase DB
 │                          │                                  │
 │  1. Upload bukti         │                                  │
 │  + transaction_id        │                                  │
 │ ────────────────────────>│                                  │
 │                          │  2. Upload receipt image          │
 │                          │ ────────────────────────────────>│
 │                          │                                  │
 │                          │  3. AI verify (Griphub vision)   │
 │                          │ ────────────────────────────────>│
 │                          │                                  │
 │                          │  4. VALID?                       │
 │                          │     NO → return error             │
 │                          │     YES ↓                        │
 │                          │                                  │
 │                          │  5. UPDATE status = "paid"  ◄───  │ ◄── STATUS SUDAH "PAID"
 │                          │ ────────────────────────────────>│     SEBELUM STOCK DIPOTONG!
 │                          │                                  │
 │                          │  6. commitTransactionStock()      │
 │                          │     ↳ atomicAdjustStock()        │
 │                          │ ────────────────────────────────>│
 │                          │                                  │
 │                          │     GAGAL? ↓                     │
 │                          │     Error di-throw                │
 │                          │     TAPI STATUS SUDAH "PAID"     │
 │                          │                                  │
 │                          │  7. updateSellerBalances()        │
 │                          │ ────────────────────────────────>│
 │                          │                                  │
 │                          │  8. updateBuyerPoints()           │
 │                          │ ────────────────────────────────>│
 │                          │                                  │
 │  9. Return success       │                                  │
 │ <────────────────────────│                                  │
```

### Kode Spesifik — Urutan Operasi

| Step | Baris | Operasi | Status di DB |
|------|-------|---------|-------------|
| 1 | `payments.ts:420-432` | `UPDATE transactions SET status = 'paid'` | **"paid"** |
| 2 | `payments.ts:435-439` | Fetch transaction data | — |
| 3 | `payments.ts:445-446` | `deductTransactionStock()` (jika re-deduct) | — |
| 4 | `payments.ts:448` | `commitTransactionStock()` | — |
| 5 | `payments.ts:449` | **Jika gagal: `throw new Error(...)`** | **Status "paid", stock TIDAK dipotong** |
| 6 | `payments.ts:451` | `updateSellerBalances()` | — |
| 7 | `payments.ts:453` | `updateBuyerPoints()` | — |

**KRITIS:** Baris 420 meng-update status ke "paid" SEBELUM baris 448 commit stock. Jika baris 448 gagal:
- Status = "paid" ✅
- Stock = **tidak terpotong** ❌
- Seller balance = **tidak di-update** ❌ (karena throw di baris 449, baris 451 tidak jalan)
- Buyer points = **tidak di-update** ❌

---

## 3. SIAPA YANG RUGI — Severity Matrix

### Skenario: Stock commit GAGAL setelah status "paid"

| Pihak | Dampak | Severity | Penjelasan |
|-------|--------|----------|------------|
| **Buyer** | ✅ Tidak rugi langsung | LOW | Sudah bayar, status "paid", akan dapat produk (seller kirim) |
| **Seller** | ❌ **TIDAK DAPAT SALDO** | **HIGH** | `updateSellerBalances()` tidak jalan karena throw di baris 449 |
| **SPS Corner** | ❌ **OVERSELL** | **HIGH** | Stock tidak terpotong → produk bisa kejual lebih dari stok |
| **SPS Corner** | ❌ **Poin tidak di-earn** | MEDIUM | `updateBuyerPoints()` tidak jalan |

### Skenario: Berhasil (stock commit OK)

| Pihak | Status | Normal? |
|-------|--------|---------|
| Buyer | Dapat produk, point di-earn | ✅ |
| Seller | Dapat saldo | ✅ |
| Stock | Terpotong | ✅ |

### Skenario Lengkap — Semua Kemungkinan

| # | Skenario | Buyer | Seller | Stock | Point | Severity |
|---|----------|-------|--------|-------|-------|----------|
| 1 | Stock commit OK | ✅ | ✅ | ✅ | ✅ | — |
| 2 | Stock commit GAGAL | ✅ paid | ❌ no saldo | ❌ oversell | ❌ no earn | **HIGH** |
| 3 | Auto-reconcile fix (≤5 menit) | ✅ | ✅ | ✅ | ✅ | **MEDIUM** (delay) |
| 4 | Auto-reconcile juga GAGAL | ✅ | ❌ | ❌ | ❌ | **CRITICAL** |

---

## 4. ANALISIS AUTO-RECONCILE

### 4.1 Apa yang Dilakukan Auto-Reconcile?

**Lokasi:** `background-jobs.js:89-154`

```javascript
// Tiap 5 menit
async function autoReconcileTransactions() {
    const { data: mismatches } = await supabase.rpc('find_stock_balance_mismatches');
    for (const tx of mismatches) {
        // Fix stock jika belum di-deduct
        if (!tx.stock_deducted) {
            await commitStock(tx.transaction_id);  // ← idempotent
        }
        // Fix balance jika belum di-settle
        if (!tx.balances_updated) {
            await supabase.rpc('apply_seller_balance_for_transaction', { p_transaction_id: tx.transaction_id });
        }
    }
}
```

### 4.2 coverage Auto-Reconcile

| Komponen | Auto-Fix? | Keterangan |
|----------|-----------|------------|
| Stock deduction | ✅ Ya | Via `commitStock()` (idempotent) |
| Seller balance | ✅ Ya | Via RPC `apply_seller_balance_for_transaction` (idempotent) |
| Buyer points | ❌ **TIDAK** | **Tidak ada fix untuk missing buyer points** |
| Status consistency | ✅ Ya | Status sudah "paid" dari awal |

### 4.3 Evaluasi

**Auto-reconcile SUDAH cukup sebagai mitigasi untuk:**
- ✅ Stock oversell — terdeteksi + auto-fix
- ✅ Seller balance — terdeteksi + auto-fix

**Auto-reconcile TIDAK cukup untuk:**
- ❌ Buyer points — tidak ada auto-fix
- ⏱️ **Window 5 menit** — selama window ini, stock bisa oversell
- 📊 Monitoring — hanya notify admin jika auto-fix gagal

### 4.4 Residual Risk

| Risk | Mitigation | Residual |
|------|-----------|----------|
| Oversell selama 5 menit window | Cart reservation (`reserve_stock` RPC) | **RENDAH** — reservation hold stock |
| Seller tidak dapat saldo > 5 menit | Auto-reconcile | **RENDAH** |
| Buyer tidak dapat points | Tidak ada | **MEDIUM** |
| Auto-reconcile gagal | Admin notification | **RENDAH** |

---

## 5. REKOMENDASI SOLUSI

### Option 1: Commit Stock SEBELUM Update Status (Reorder)

**Konsep:** Pindahkan `commitTransactionStock()` ke SEBELUM `UPDATE status = 'paid'`.

```
SEKARANG:   Status="paid" → commitStock → updateBalance → updatePoints
REKOMENDASI: commitStock → Status="paid" → updateBalance → updatePoints
```

| Pro | Con |
|-----|-----|
| Jika stock commit gagal, status tetap "pending" → bisa retry | Perlu reorder semua payment paths |
| Tidak ada window oversell | Jika status update gagal setelah stock commit → stock terpotong tapi status "pending" |
| Seller balance dan points tetap jalan | — |

**Complexity: Medium** — perlu ubah urutan di 4+ lokasi

### Option 2: Compensation Pattern (Saga)

**Konsep:** Jika langkah N gagal, rollback langkah N-1.

```javascript
try {
    status = "paid";
    await updateStatus();
    try {
        await commitStock();
    } catch {
        await rollbackStatus(); // ← rollback ke "pending"
        throw;
    }
} catch {
    // handle
}
```

| Pro | Con |
|-----|-----|
| Status dan stock selalu konsisten | Lebih kompleks |
| Retry otomatis via status "pending" | Perlu rollback logic di setiap payment path |

**Complexity: High** — perlu rollback logic di banyak tempat

### Option 3: Atomic RPC (Status + Stock dalam 1 Call)

**Konsep:** Buat Supabase RPC baru yang atomic — update status DAN commit stock dalam 1 database transaction.

| Pro | Con |
|-----|-----|
| **Paling aman** — atomic guarantee | Perlu buat RPC baru di DB |
| Tidak ada window inkonsistensi | Migrasi database |
| Tidak ada rollback logic | RPC harus handle semua edge case |

**Complexity: High** — perlu DB migration + RPC function

### Option 4: Hybrid — Reorder + Enhanced Auto-Reconcile

**Konsep:**
1. Reorder operasi (Option 1) — commit stock dulu
2. Tambah buyer points fix di auto-reconcile
3. Tambah monitoring

| Pro | Con |
|-----|-----|
| Mengurangi window risiko | Tidak menghilangkan sepenuhnya |
| Relatively simple | Auto-reconcile tetap jadi safety net |
| Buyer points juga di-fix | — |

**Complexity: Low-Medium** — perlu reorder + tambah logic di background job

---

## 6. REKOMENDASI FINAL

### Gunakan Option 4 (Hybrid) + Monitoring

**Alasan:**
1. **Option 4 paling practical** — tidak perlu RPC baru, tidak perlu rollback logic kompleks
2. **Reorder operasi** di manual verify: commit stock dulu, baru update status
3. **Tambah buyer points fix** di auto-reconcile
4. **Tambahan monitoring:** alert jika status "paid" tapi stock tidak committed > 1 menit

### Risk Assessment

| Parameter | Sebelum | Sesudah (Option 4) |
|-----------|---------|---------------------|
| Window oversell | 0 detik (status di-set dulu) | **~0 detik** (stock commit dulu) |
| Status konsistensi | Status "paid" tapi stock belum | Stock committed sebelum status |
| Buyer points | Tidak di-fix oleh auto-reconcile | **Di-fix** oleh auto-reconcile |
| Complexity | — | Low-Medium |
| Rollback need | — | Tidak perlu (stock commit lebih dulu) |

---

## 7. KESIMPULAN

**Severity aktual: MEDIUM** (dimitigasi auto-reconcile + cart reservation)

**Tindakan yang diperlukan:**
1. ✅ Reorder operasi di manual verify: commit stock → update status
2. ✅ Reorder operasi di iPaymu callback: commit stock → update status
3. ✅ Tambah buyer points fix di `autoReconcileTransactions()`
4. ✅ Tambah monitoring: alert jika stock tidak committed > 1 menit setelah status "paid"
5. ✅ Tidak perlu RPC baru atau rollback logic kompleks
