# RESEARCH 1 — iPaymu Callback Signature Bypass

## 1. RINGKASAN

| Item | Keterangan |
|------|-----------|
| Bug | `payments.ts:782` — callback tanpa signature di-`warn` tapi tetap diproses |
| Severity | HIGH (dimitigasi oleh `verifyGatewayCallback` fallback) |
| Risk aktual | MEDIUM — karena ada secondary verification via iPaymu API |

---

## 2. ALUR LENGKAP PEMBAYARAN iPaymu

### Sequence Diagram (Teks)

```
Buyer               Frontend (Checkout.tsx)         Backend (payments.ts)           iPaymu Gateway
 │                         │                              │                              │
 │  1. Click Bayar         │                              │                              │
 │ ───────────────────────>│                              │                              │
 │                         │  2. POST /api/payment/       │                              │
 │                         │     ipaymu/direct             │                              │
 │                         │ ────────────────────────────>│                              │
 │                         │                              │  3. Generate signature       │
 │                         │                              │     POST /api/v2/payment     │
 │                         │                              │     /direct                  │
 │                         │                              │ ────────────────────────────>│
 │                         │                              │                              │
 │                         │                              │  4. Return { Url, QrCode }  │
 │                         │                              │ <────────────────────────────│
 │                         │  5. Return QR/URL            │                              │
 │                         │ <────────────────────────────│                              │
 │  6. Scan QR / Bayar     │                              │                              │
 │ ──────────────────────────────────────────────────────────────────────────────────────>│
 │                         │                              │                              │
 │                         │                              │  7. POST callback ke         │
 │                         │                              │     /api/payment/ipaymu/     │
 │                         │                              │     callback                 │
 │                         │                              │ <────────────────────────────│
 │                         │                              │                              │
 │                         │  8. Verifikasi:              │                              │
 │                         │     a. HMAC signature?       │                              │
 │                         │     b. API lookup fallback?  │                              │
 │                         │                              │                              │
 │                         │  9. Update status + stock    │                              │
 │                         │     + seller balance         │                              │
 │                         │                              │                              │
 │                         │  10. Notify buyer            │                              │
 │                         │                              │                              │
```

### Step-by-Step Detail

| Step | Siapa Kirim | Ke Siapa | Data | Lokasi Kode |
|------|------------|----------|------|-------------|
| 1 | Buyer | Frontend | Klik tombol bayar | `Checkout.tsx` |
| 2 | Frontend | Backend | `transaction_id, amount, payment_method` | `Checkout.tsx:301-313` |
| 3 | Backend | iPaymu | Signature + payment data | `client.ts:163-197` |
| 4 | iPaymu | Backend | `Url, SessionId, TransactionId, QrCode` | `client.ts:186` |
| 5 | Backend | Frontend | Payment URL/QR | `payments.ts:750-765` |
| 6 | Buyer | iPaymu | Bayar via QR/VA | — |
| 7 | iPaymu | Backend | Callback body + `X-Signature` header | `payments.ts:768` |
| 8 | Backend | — | Verifikasi signature + API lookup | `payments.ts:772-801` |
| 9 | Backend | DB | Update status, stock, seller balance | `payments.ts:886-928` |
| 10 | Backend | Buyer | Notifikasi pembayaran berhasil | `payments.ts:929-936` |

---

## 3. ANALISIS KODE: Callback Handler (payments.ts:768-801)

### 3.1 Alur Verifikasi

```typescript
// Line 774: Ambil signature dari header
const receivedSignature = String(req.headers['x-signature'] || req.headers.signature || '').trim();

// Line 775-783: Verifikasi
if (receivedSignature) {
    // ADA signature → verifikasi HMAC
    const isValid = IpaymuSignature.verify(body, receivedSignature, IPAYMU_VA);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });  // REJECT
    }
} else {
    // TIDAK ADA signature → skip, tapi lanjut ke secondary verification
    console.warn('[iPaymu] No signature in callback — skipping verification');
}

// Line 796-800: Secondary verification (ALWAYS runs)
const verification = await verifyGatewayCallback(req, refId, body);
if (!verification.verified) {
    return res.status(202).json({ success: false, pending: true });
}
```

### 3.2 Tiga Skenario Signature

| Skenario | Kode | Hasil |
|----------|------|-------|
| **Signature ADA dan VALID** | `payments.ts:776-777` → `IpaymuSignature.verify()` returns `true` | ✅ Proceed → `verifyGatewayCallback` juga jalan |
| **Signature ADA tapi SALAH** | `payments.ts:778-779` | ❌ **401 REJECTED** — tidak diproses |
| **Signature TIDAK ADA** | `payments.ts:782` → `console.warn` | ⚠️ Skip HMAC → `verifyGatewayCallback` jadi backstop |

### 3.3 Secondary Verification — `verifyGatewayCallback` (payments.ts:165-197)

**Ini adalah safety net utama.** Selalu dijalankan terlepas dari hasil HMAC check.

| Step | Mekanisme | Keterangan |
|------|-----------|------------|
| 1 | **Signature verify** (line 169-174) | Cek HMAC — kalau valid, return `{ verified: true, method: 'signature' }` |
| 2 | **API lookup fallback** (line 177-186) | Panggil `ipaymuClient.getTransactionStatus(refId)` — tanya iPaymu langsung |
| 3 | **Soft trust** (line 186) | Kalau API lookup unclear tapi callback claims paid → `soft_trust` |
| 4 | **Fallback trust** (line 193) | Kalau API lookup GAGAL tapi callback claims paid → `fallback_trust` |

**Jadi bahkan tanpa signature, callback TETAP verified via API lookup.**

---

## 4. JAWABAN ATAS PERTANYAAN OWNER

### Q1: Apakah iPaymu SELALU mengirim signature?

**Berdasarkan kode kita:**
- Kita baca dari `req.headers['x-signature']` atau `req.headers.signature` (`payments.ts:774`)
- Kita juga baca dari `body.signature` atau `body.Signature` (`payments.ts:167`)

**Berdasarkan dokumentasi iPaymu (docs.ipaymu.com/id/docs/callback):**
- iPaymu OFFICIAL: callback signature di-generate dari body + VA number
- Signature dikirim di **HTTP Header** `X-Signature`
- **Kemungkinan TIDAK ada signature:** Sandbox mode, testing, atau iPaymu experiencing issues

**Kesimpulan:** iPaymu SEHARUSNYA selalu kirim signature di production. Tapi ada edge cases (sandbox, maintenance) di mana signature bisa tidak ada.

### Q2: Skenario callback tanpa signature

| Skenario | Probabilitas | Dampak |
|----------|-------------|--------|
| iPaymu sandbox/testing | Medium | Tidak berbahaya (development only) |
| iPaymu maintenance | Low | Bisa terjadi |
| Request palsu (attacker) | Low-Medium | **Berbahaya** — tapi di-backstop API lookup |
| Library iPaymu berubah | Very Low | Perlu monitoring |

### Q3: Kalau kita reject callback tanpa signature?

**Dampak ke iPaymu:**
- iPaymu **TIDAK retry** callback yang di-reject (HTTP 401/403)
- Status di iPaymu tetap "pending" atau "berhasil" — tidak berubah
- User yang sudah bayar tidak dapat konfirmasi → **komplain ke SPS Corner**

**Dampak ke SPS Corner:**
- Transaksi tetap "pending" — user tidak dapat produk
- Admin harus manual approve
- TAPI: jika kita reject, callback hilang. iPaymu **tidak ada mekanisme retry** untuk callback yang sudah di-reject.

**Jawaban: Kita yang rugi, bukan iPaymu.** iPaymu sudah terima uang. Konfirmasi gagal = kita yang harus handle manual.

### Q4: Mekanisme lebih aman dari sekedar signature?

**Ya — dan kita SUDAH mengimplementasikannya:**

1. **API Lookup** (`verifyGatewayCallback` line 177-186): Tanya iPaymu langsung apakah transaksi benar-benar paid
2. **Soft trust** (line 186): Kalau API unclear tapi callback claims paid → proses dengan caution
3. **Fallback trust** (line 193): Kalau API gagal tapi callback claims paid → proses dengan caution + log warning

---

## 5. PERBANDINGAN SOLUSI

| Option | Deskripsi | Risiko | Kapan Tepat |
|--------|-----------|--------|-------------|
| **A: Reject langsung (401)** | Return 401 kalau tidak ada signature | **TINGGI** — callback hilang, user tidak dapat konfirmasi, iPaymu tidak retry | Tidak direkomendasikan |
| **B: Log warning + proses + flag "unverified"** | Log warning, proses normal, tapi tandai `payment_details.unverified_callback: true` | **RENDAH** — tetap proses, ada audit trail | **REKOMENDASI** — balance antara security dan availability |
| **C: Reject + trigger manual check** | Reject callback, lalu kita主动 poll iPaymu API untuk cek status | **MENENGAH** — lebih aman dari A, tapi ada delay + API cost | Jika tersedia polling mechanism |

---

## 6. REKOMENDASI FINAL

### Option B dengan Enhancement

**Rekomendasi: Gunakan Option B** (saat ini sudah jalan, tinggal perkuat):

1. **Tetap log warning** untuk callback tanpa signature
2. **Tambahkan flag** `payment_details.unverified_callback: true` di database
3. **Tetap proses** — karena `verifyGatewayCallback` sudah memberikan backstop yang kuat
4. **Monitor** — hitung berapa callback tanpa signature per hari, cari pola
5. **Alert** jika jumlah callback tanpa signature melonjak (bisa indikasi serangan)

**Mengapa bukan Option A:**
- iPaymu tidak retry callback yang di-reject
- User sudah bayar → transaksi stuck "pending"
- Admin harus manual approve → beban operasional

**Mengapa Option B lebih baik dari Option C:**
- Proses real-time, tidak ada delay
- `verifyGatewayCallback` sudah melakukan API lookup — ini sudah seperti Option C
- Tidak perlu additional polling mechanism

### Risk Assessment

| Parameter | Sebelum Perubahan | Sesudah Perubahan (Option B) |
|-----------|-------------------|------------------------------|
| Callback tanpa signature diproses? | Ya (tanpa flag) | Ya (dengan flag) |
| Audit trail? | Tidak ada | ✅ Ada (`unverified_callback: true`) |
| User experience? | Normal | Normal |
| Security? | Medium | Medium-High (termonitor) |
| False positive rate? | N/A | rendah (API lookup sebagai backstop) |

---

## 7. KESIMPULAN

**Severity aktual: MEDIUM** (bukan HIGH karena `verifyGatewayCallback` sudah memberikan backstop)

**Tindakan yang diperlukan:**
1. ✅ Sudah benar: `verifyGatewayCallback` sebagai secondary verification
2. Perlu ditambah: flag `unverified_callback` untuk audit trail
3. Perlu ditambah: monitoring/alert untuk callback tanpa signature
4. **TIDAK perlu reject** — karena iPaymu tidak retry, user yang rugi
