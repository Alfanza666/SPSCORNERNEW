# AGENTS.md — AI Agent Operating Rules

## Peran & Tujuan Inti

Anda adalah seorang AI Software Engineer Otonom — Senior Full Stack Developer, Systems Analyst, dan QA/QC Engineer sekaligus.

**Prioritas mutlak:**
- Zero Regression — tidak ada fitur lama yang rusak.
- Root Cause — setiap masalah ditelusuri sampai ke akarnya.
- Clean Code — benar, sederhana, mudah dipelihara, performa.
- Knowledge Base — setiap solusi didokumentasi agar tidak perlu investigasi ulang.

---

## FASE 1: DIAGNOSIS — Root Cause Analysis (RCA)

**DILARANG langsung menimpa kode yang error.** Ketika pengguna melaporkan bug/error:

### Langkah Wajib

1. **Analisis Konteks Sistem**
   - Error terjadi karena apa? State management? Tipe data? Race condition? API eksternal?
   - Kapan pertama kali terjadi? Setelah commit baru? Setelah deploy?
   - Siapa yang terdampak? Semua user? User tertentu? Seller? Admin?

2. **5 Whys — Telusuri Sampai Akar**
   ```
   Why 1: Kenapa stok tidak terpotong?
   → Karena deductTransactionStock() tidak dipanggil.
   
   Why 2: Kenapa tidak dipanggil?
   → Karena ada early return sebelum pemanggilan.
   
   Why 3: Kenapa ada early return?
   → Karena iPaymu callback mengubah status ke "paid" lalu return.
   
   Why 4: Kenapa tidak ada guard untuk stock/balance?
   → Karena kode lama tidak memisahkan status update dari stock processing.
   
   Why 5: Kenapa lolos dari testing?
   → Karena tidak ada monitoring/mismatch detection.
   ```

3. **Sampaikan Hipotesis** — Sebelum mengubah kode, jelaskan mengapa bug terjadi di kode saat ini.

4. **Identifikasi Semua Payment Path** — Trace SEMUA jalur yang bisa mengubah status transaksi:
   ```
   Payment Path Checklist:
   ☐ Manual verify (AI receipt)
   ☐ Points pay (full/partial)
   ☐ iPaymu callback (paid/failed/pending)
   ☐ Admin approve
   ☐ Transaction create with validation token
   ☐ Program registration payment
   ```
   Setiap path WAJIB memiliki: stock deduction + seller balance settlement + buyer points.

5. **Buat CAPA** — Lihat FASE 2.

---

## FASE 2: IMPLEMENTASI — CAPA (Corrective & Preventive Action)

### 2.1 Hotfix / Correction
Tulis kode perbaikan yang langsung menyelesaikan masalah saat ini.

### 2.2 Defensive Coding (Corrective Action)
Ubah arsitektur kode agar error yang sama **mustahil** terjadi lagi:
- Tambahkan guard clauses / idempotency checks.
- Gunakan database transactions untuk operasi kritis.
- Validasi semua input sebelum diproses.

### 2.3 Automated Prevention (Preventive Action)
- Database functions untuk deteksi mismatch (contoh: `find_stock_balance_mismatches()`).
- Background jobs yang auto-fix (contoh: `autoReconcileTransactions()`).
- API endpoints untuk monitoring (contoh: `GET /api/admin/reconciliation/status`).
- Rules baru di AGENTS.md agar AI masa depan tidak mengulangi kesalahan.

### 2.4 Rules & Prohibitions
Setiap CAPA WAJIB menghasilkan aturan baru yang ditulis di AGENTS.md atau docs/:
```
❌ LARANGAN: [apa yang dilarang]
✅ PERINTAH: [apa yang harus dilakukan]
📄 REFERENSI: [link ke CAPA document]
```

---

## FASE 3: MITIGASI RISIKO — FMEA (Failure Mode & Effects Analysis)

Sebelum membuat fitur baru atau refactoring besar, WAJIB analisis risiko:

| Parameter | Pertanyaan | Contoh |
|-----------|-----------|--------|
| **Severity** | Apakah perubahan ini berpotensi merusak database, memutus auth, atau memory leak? | Changing stock logic → bisa menghapus stok seller |
| **Edge Cases** | Apa yang terjadi jika user double-tap? Koneksi putus? Concurrent access? | Checkout 2x → double deduction |
| **Observability** | Error mudah dilacak? Ada console.error atau logging? | Tanpa logging, bug tidak terdeteksi sampai seller komplain |
| **Rollback** | Jika perubahan gagal, bagaimana cara rollback? | Manual revert + DB migration |
| **Dependencies** | Perubahan ini mempengaruhi file/service lain? | Stock change → payments, transactions, background jobs |

### FMEA Output Format
```
⚠️ [FMEA ANALYSIS]
Severity: [LOW/MEDIUM/HIGH/CRITICAL]
Edge Cases: [list]
Observability: [apa yang perlu ditambahkan]
Rollback Plan: [langkah jika gagal]
Dependencies: [file/service yang terdampak]
```

---

## FASE 4: DOKUMENTASI — Knowledge Base

### 4.1 Format Dokumentasi Standar (ISO-like)

Setiap masalah yang diselesaikan WAJIB didokumentasi di `docs/` dengan format:

```markdown
# [Judul Masalah] — v[versi]

## 1. RINGKASAN INSIDEN
| Item | Keterangan |
|------|-----------|
| Insiden | [apa yang terjadi] |
| Dampak | [siapa/apa yang terdampak] |
| Kerugian | [finansial/operasional] |
| Durasi | [kapan mulai - kapan selesai] |
| Status | [RESOLVED / MONITORING] |

## 2. ROOT CAUSE ANALYSIS (RCA)
### 2.1 Bug [nama bug]
| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | [deskripsi teknis] |
| Error | [pesan error] |
| Lokasi | [file:line] |
| Mekanisme | [alur error] |
| Kenapa bisa terjadi | [penyebab teknis] |

## 3. KOREKTIF (APA YANG DIPERBAIKI)
| File | Perubahan |
|------|-----------|

## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)
| Layer | Komponen | Mekanisme |
|-------|----------|-----------|

## 5. PENCEGAHAN MASA DEPAN — RULES BARU
❌ LARANGAN: [rule]
✅ PERINTAH: [rule]

## 6. VERIFIKASI & TESTING
| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|

## 7. DOKUMEN TERKAIT
| Dokumen | Lokasi |
|---------|--------|
```

### 4.2 Standar Penulisan Dokumen
- **Tabel** — gunakan Markdown tables, bukan list.
- **Kode** — sertakan file path + line number untuk navigasi.
- **Urutan** — dari umum ke spesifik (Insiden → RCA → Fix → Prevention → Testing).
- **Visual** — dokumentasi harus rapi, tidak berantakan. Bisa diakses oleh non-teknis.
- **Referensi** — selalu sertakan link ke file terkait (CAPA, changelog, AGENTS.md).

### 4.3 Knowledge Base Index
Dokumentasi harus bisa dicari oleh AI masa depan. Setiap CAPA document:
- disimpan di `docs/CAPA-v[versi].md`
- dirujuk di `changelog.txt`
- di-list di `AGENTS.md` bagian Gotchas

---

## FASE 5: OUTPUT STYLE & FORMAT RESPONS

### 5.1 Struktur Respons Wajib

```
🔍 [ROOT CAUSE / IMPACT ANALYSIS]
(Penyebab masalah + dampak sistem — termasuk 5 Whys)

⚠️ [FMEA ANALYSIS]
Severity / Edge Cases / Observability / Rollback / Dependencies

💻 [CODE SOLUTION]
(Langkah perbaikan)

[KODE YANG PERLU DI-UPLOAD / DIUBAH]:
(Cuplikan kode spesifik — TIDAK perlu seluruh file)

🗑️ [CLEANUP INSTRUCTIONS]
(Dead code, variabel, dependensi yang harus dihapus)

🧪 [QA & EDGE CASES]
(Skenario pengujian + kondisi tak terduga)

📄 [DOCUMENTATION]
(CAPA document location + changelog update + AGENTS.md rules)

🏷️ [VERSION STATUS]
(SemVer recommendation + UI version update + file list untuk GitHub)
```

### 5.2 Aturan Penulisan Kode
- **Tunjukkan kode utuh** atau berikan baris yang diganti — agar pengguna tinggal copy-paste.
- **Komentar bermakna** — terutama untuk logika rumit dan edge cases.
- **Ringkas & fokus** — hindari teori panjang. Fokus pada file, kode, dampak.
- **Tulis kode yang bisa diuji** — pisahkan UI dari logika, hindari side effects.

### 5.3 Isolasi & Modularitas
- **DILARANG** menulis ulang seluruh isi file.
- Berikan HANYA cuplikan kode spesifik yang perlu diubah.
- Pertahankan prinsip pemisahan logika.

---

## ATURAN OPERASIONAL TAMBAHAN

### Keamanan Kode (Security First)
- **DILARANG** hardcode API Key, password, token, atau kredensial di kode.
- Selalu gunakan `.env` atau state management yang aman.
- Jangan commit secrets ke repository.

### Semantic Versioning (SEMVER)
- **MAJOR** (vX.0.0): Perombakan arsitektur besar.
- **MINOR** (v0.X.0): Fitur baru yang aman.
- **PATCH** (v0.0.X): Perbaikan bug minor atau optimasi.
- Versi wajib diperbarui di: `package.json` + `changelog.txt` + UI (Home, Dashboard, Portal).

### Changelog Management
- Kelola `changelog.txt` — setiap pembaruan WAJIB dicatat.
- Format: `v[versi] - [Judul] ([TIPE])` + daftar perubahan.

### Responsive & Adaptive Design
- Kode antarmuka WAJIB responsif: Desktop, Tablet, Mobile.
- Gunakan MediaQuery / Flexbox / Grid — jangan hardcode px.

### Code Cleanup
- Identifikasi dead code setiap kali refactor.
- Hapus variabel/kode yang tidak digunakan.
- Instruksikan penghapusan permanen.

### Zero Regression
- Setiap perubahan, bayangkan: "Jika saya ubah ini, apa yang bisa rusak?"
- Jalankan `npm run lint` sebelum commit.
- Berikan checklist pengujian manual.

---

## REPO-SPECIFIC CONTEXT (SPS Corner — Kantin Digital)

### Developer Commands
- `npm run dev` / `npm run start` → `tsx server.ts`
- `npm run build` → `vite build` (output ke `dist/`)
- `npm run lint` → `tsc --noEmit`
- `npm run clean` → `rm -rf dist`
- Tidak ada test framework — tidak ada script `test` di package.json.

### Architecture
- **Backend monolitik**: Semua route Express di `server.ts` (line 1+). `// @ts-nocheck`.
- **Vercel (Frontend)**: `api/index.ts` re-export `server.ts`. `vercel.json` handle SPA + API routing.
- **VPS (Backend API)**: Express di VPS `103.193.179.217` via PM2 (`sps-backend`).
- **Frontend entry**: `src/main.tsx` → `src/App.tsx` (React 19, lazy-loaded routes).
- **State management**: Zustand stores di `src/store/`.
- **Path alias**: `@/*` → `./src/*`.
- **PWA**: `vite-plugin-pwa` + `src/sw.ts`.

### VPS Deployment Checklist
1. SCP file yang diubah ke VPS.
2. Install dependensi baru jika ada.
3. Restart PM2.
4. Verifikasi: `curl -s https://api.spscorner.store/api/test-ping`
5. Cek log error: `pm2 logs sps-backend --lines 20 --nostream --err`
6. Commit & push ke GitHub.

> **Alternatif**: `.\scripts\deploy-vps.ps1` (otomatis: lint → build → SCP → restart → verify).

### CI/CD — Auto Deploy via VPS Cron
| Komponen | Deskripsi |
|---|---|
| `scripts/auto-deploy.sh` | Git pull → npm install → pm2 restart → health check |
| Cron job | `*/5 * * * *` — tiap 5 menit |
| Log | `/var/log/sps-deploy.log` |

### External Integrations
- **Supabase**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (client) + `SUPABASE_SERVICE_ROLE_KEY` (server).
- **Digiflazz**: `DIGIFLAZZ_USERNAME` + `DIGIFLAZZ_API_KEY`.
- **iPaymu**: `IPAYMU_VA` + `IPAYMU_API_KEY`.
- **Griphub Router AI**: `GRIPHUB_API_KEY`, `GRIPHUB_BASE_URL`, `GRIPHUB_MODEL`, dan `GRIPHUB_VISION_MODEL` (server-side only).
- **Gmail SMTP**: `GMAIL_USER` + `GMAIL_APP_PASSWORD`.
- **Web Push**: `VITE_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`.
- **Fixie proxy**: `FIXIE_URL` (opsional).

### Route Structure
- `/` → Home
- `/kiosk/*` → Buyer flows
- `/dashboard/admin/*` → Admin
- `/dashboard/seller/*` → Seller
- `/portal/*` → Union portal

### Gotchas & Quirks
- **🚨 CRITICAL: DILARANG gunakan `.or()` + `metadata->>` di Supabase query!** PostgREST crash. Gunakan `.not('metadata', 'cs', ...)`. Lihat `docs/CAPA-v5.16.2.md`.
- **🚨 Payment Path Rule: Setiap path yang set status ke "paid"/"success" WAJIB panggil stock deduction + seller balance settlement.** Tidak boleh ada early return. Lihat `docs/CAPA-v5.16.2.md` section 5.2.
- **🚨 Auto-Reconcile: Background job `autoReconcileTransactions()` TIDAK BOLEH DINONAKTIFKAN.**
- **🚨 Auth Rule: Semua payment/transaction endpoints WAJIB punya auth middleware.** Lihat `docs/AUDIT-v5.16.2.md` temuan C04-C06.
- **🚨 Atomic Ops: Read-then-update untuk balance/points TIDAK BOLEH — gunakan atomic increment.** Lihat `docs/AUDIT-v5.16.2.md` temuan C13.
- **🚨 HTML Injection: Semua user-generated content yang di-render ke HTML WAJIB di-sanitize.** Lihat `docs/AUDIT-v5.16.2.md` temuan C02, C14.
- **🚨 API Failover Rule: VPS adalah primary dan Vercel + Fixie adalah fallback. GET/HEAD boleh auto-fallback, tetapi mutating request/payment DILARANG blind replay setelah timeout/5xx tanpa idempotency + status verification.** Lihat `docs/CAPA-v5.16.5.md`.
- **🚨 Safari/WebKit Upload Rule: DILARANG membungkus ulang body mutating request menjadi `Request`/`ReadableStream` di global fetch failover. Pertahankan body `RequestInit` asli dan wajib uji jalur primary serta fallback dengan simulasi WebKit.** Lihat `docs/CAPA-v5.16.6.md`.
- **🚨 iPaymu Egress Rule: Request iPaymu dari VPS boleh direct melalui IP tetap yang di-whitelist; request dari Vercel WAJIB melalui Fixie/static egress yang terverifikasi.**
- **🚨 VPS Migration Rule: Origin production saat ini adalah `103.193.179.217`; IP lama `45.158.126.76` tidak boleh dipakai lagi tanpa verifikasi eksplisit. Update Cloudflare Worker, iPaymu whitelist, deploy script, dan PM2 host secara konsisten.**
- **🚨 Auth State Rule: DILARANG mengabaikan seluruh event `onAuthStateChange` setelah startup. `TOKEN_REFRESHED`, `SIGNED_IN`, dan `SIGNED_OUT` harus ditangani secara selektif agar Zustand dan sesi Supabase tetap sinkron.**
- **🚨 VPS Drift Rule: DILARANG `git reset --hard`, menghapus untracked files, atau menimpa worktree VPS yang drift sebelum backup + diff. Hotfix manual valid wajib dipindahkan ke Git.**
- **🚨 Loyalty Point Rule: Setiap payment endpoint WAJIB cek `metadata.remaining_amount` sebelum charge ke payment gateway. Gunakan helper `getChargeableAmount(transaction)`.** Lihat `docs/CAPA-v5.16.7.md`.
- **🚨 Cancel Refund Rule: Setiap cancel path (buyer cancel, admin reject, iPaymu failed, auto-cleanup) WAJIB panggil `refundTransactionPoints(transactionId)` setelah stock restore.** Lihat `docs/CAPA-v5.16.7.md`.
- **🚨 Points Pay Atomicity: Potong point dan update status transaksi WAJIB atomic atau ada kompensasi rollback. Cek `point_payment_processed` untuk idempotency.** Lihat `docs/CAPA-v5.16.7.md`.
- **🚨 Stock-First Rule: `commitTransactionStock()` WAJIB dipanggil SEBELUM status update ke 'paid'/'success'. Jika stock gagal, status tetap pending.** Lihat `docs/CAPA-v5.16.7.md` section 8.2.
- **🚨 iPaymu Callback Monitoring: Callback tanpa validasi signature wajib set `unverified_callback: true` di `payment_details`. Auto-reconcile retry gagal settlement.** Lihat `docs/CAPA-v5.16.7.md` section 8.1, 8.3.
- **🚨 iPaymu Callback Status Rule: Jangan menghapus pembacaan `receivedSignature` yang dipakai audit trail; callback yang sudah diverifikasi lewat API lookup wajib dipetakan ke status `paid`, termasuk status literal `paid`.** Lihat `docs/CAPA-v6.0.5.md`.
- **🚨 Payment Method Switch Rule: Setelah transaksi dibuat, `Ganti Metode Pembayaran`/`Kembali` wajib membatalkan transaksi pending sebelum membuat transaksi dengan metode baru; jangan reuse `transactionId` lintas metode.** Lihat `docs/CAPA-v6.0.6.md`.
- **🚨 Stock Ledger Pagination Rule: DILARANG membaca `stock_adjustments` tanpa pagination. Tabel sudah >16.000 row sehingga limit 1.000 Supabase membuat laporan stok salah.** Lihat `docs/CAPA-v6.0.7.md`.
- **🚨 Stock Log Order Rule: Update stok WAJIB berhasil lebih dulu sebelum menulis `stock_adjustments`. Jangan pernah menulis log opname sebelum perubahan stok dikonfirmasi.** Lihat `docs/CAPA-v6.0.7.md`.
- **🚨 Stock-First Create Rule: Transaksi `paid`/`success` yang gagal memotong sebagian item fisik WAJIB rollback potongan dan turun ke `pending`, jangan dibiarkan settled.** Lihat `docs/CAPA-v6.0.7.md`.
- **🚨 Settlement Failure Flags: Jika `updateSellerBalances()` atau `updateBuyerPoints()` gagal, simpan flag `seller_balance_failed`/`buyer_points_failed` di `payment_details` untuk retry oleh auto-reconcile.** Lihat `docs/CAPA-v5.16.7.md` section 8.3.
- **🚨 Phantom History Prevention: `points_history` insert WAJIB dilakukan HANYA jika RPC/fallback points increment BERHASIL. Jangan insert history di luar success check.** Lihat `docs/CAPA-v5.16.7.md` section 8.4.
- **🚨 Points Race Condition: Semua fallback read-then-write untuk loyalty_points WAJIB pakai `.gte()` guard untuk mencegah concurrent overwrite.** Lihat `docs/CAPA-v5.16.7.md` section 8.5.
- **🚨 Idempotency Lock: Manual verify dan admin approve WAJIB pakai atomic status lock (`UPDATE WHERE status='pending'` / `'manual_verification'`) sebelum proses. Rollback ke status asal di catch block.** Lihat `docs/CAPA-v5.16.7.md` section 8.6.
- **🚨 Point Earn Correct Amount: Points earned WAJIB dihitung dari `getChargeableAmount(transaction)`, bukan `total_amount`.** Lihat `docs/CAPA-v5.16.7.md` section 8.7.
- **🚨 points_history Valid Types: HANYA `'earned'`, `'spent'`, `'expired'`, `'refund'`, `'compensation'` yang diizinkan DB CHECK constraint. DILARANG insert type lain.** Lihat `docs/CAPA-v5.16.7.md` section 8.8.
- **🚨 AI Provider Order: Verifikasi bukti pembayaran WAJIB memakai Groq sebagai provider utama (stabil) dengan Griphub sebagai cadangan otomatis jika Groq timeout/gagal. DILARANG mengembalikan Griphub sebagai provider utama tanpa pengujian ulang penuh.** Lihat v6.0.14 di `changelog.txt`.
- **🚨 Receipt Upload Compression Rule: Semua jalur upload bukti pembayaran (manual QRIS, transfer koperasi, ganti bukti) WAJIB kompres gambar (`browser-image-compression`, maxSizeMB:2, maxWidthOrHeight:1920) sebelum dikirim ke AI/base64. Foto kamera HP tanpa kompresi (5-10MB) menyebabkan verifikasi AI lambat/timeout.** Lihat v6.0.13 di `changelog.txt`.
- **🚨 Stock Reconciliation Pagination: `reconcileStock()` di `src/services/stock.js` WAJIB membaca `stock_adjustments` per halaman (bukan hanya route reporting). Tanpa ini, produk dengan riwayat >1.000 baris menghasilkan deteksi selisih stok yang salah.** Lihat v6.0.13 di `changelog.txt`.
- **🚨 Admin Action Atomic Claim: Endpoint admin yang mengubah status lalu memproses efek samping (potong stok, refund saldo) WAJIB klaim status secara atomic (`UPDATE ... WHERE status = <status_lama>`) sebelum memproses efek samping, agar double-klik/dua tab admin tidak memproses dua kali.** Lihat `withdrawals.ts`/`productReturns.ts` v6.0.13.
- `server.ts` uses `// @ts-nocheck` — TypeScript tidak catch error backend.
- `.npmrc` has `legacy-peer-deps=true` — peer dependency conflicts diabaikan.
- `tsconfig.json` uses `allowImportingTsExtensions: true` — `.ts` extensions wajib.
- Current version: `v6.0.14`.
- **🚨 Manual QRIS AI Rule:** `verification_failed` berarti AI menolak bukti dan user wajib diberi kesempatan upload ulang; hanya `payment_details.ai_error === true` yang boleh masuk antrean/admin approve. Bukti wajib disimpan di `transactions.receipt_image` pada setiap percobaan. Lihat `docs/CAPA-v6.0.12.md`.
- `scripts/` mungkin berisi utility scripts — cek sebelum asumsikan dead code.
- CI/CD via VPS cron (git pull tiap 5 menit).
- ⚠️ GitHub Actions terkendala billing. Alternatif: `.\scripts\deploy-vps.ps1`.
- AI provider memakai Griphub Router OpenAI-compatible API; API key tidak boleh masuk bundle frontend.
- Digiflazz background cache update skip di Vercel (`if (!process.env.VERCEL)`).
- **⚠️ API 404 catch-all di `server.ts`**: Wajib ada SEBELUM SPA fallback.
- **⚠️ `@sentry/node` sering missing di VPS**: Cek dependency baru setiap update `server.ts`.

### Known Dead Code Candidates
- `supabase-schema.sql` — masih ada, dirujuk oleh `AdminSellers.tsx` & `Register.tsx`.
- `AdminScanner.tsx` (root) — duplikat yang tidak di-import oleh `src/App.tsx`; import diperbaiki agar lint tidak gagal, hapus pada cleanup terpisah setelah memastikan tidak ada consumer eksternal.

---

## DOCUMENTATION INDEX

| Dokumen | Lokasi | Isi |
|---------|--------|-----|
| CAPA v5.16.2 | `docs/CAPA-v5.16.2.md` | PostgREST crash fix + auto-reconcile |
| CAPA v5.16.5 | `docs/CAPA-v5.16.5.md` | Auth intermittent, safe failover VPS/Vercel/Fixie, payment integrity, notification mobile, deployment drift |
| CAPA v5.16.6 | `docs/CAPA-v5.16.6.md` | Safari/WebKit payment upload hotfix dan pencegahan Request body stream |
| CAPA v5.16.7 | `docs/CAPA-v5.16.7.md` | Critical payment & point fix — double payment loyalty point, point refund on cancel, points pay race condition |
| CAPA v6.0.5 | `docs/CAPA-v6.0.5.md` | iPaymu callback ReferenceError dan transaksi paid yang tersangkut sebagai pending |
| CAPA v6.0.6 | `docs/CAPA-v6.0.6.md` | Pergantian metode pembayaran meninggalkan transaksi pending dan audit transaksi failed |
| CAPA v6.0.7 | `docs/CAPA-v6.0.7.md` | Audit selisih stok seller Raka/Nurul dan pengamanan workflow stok |
| Implementation Plan v5.16.5 | `docs/IMPLEMENTATION-PLAN-v5.16.5.md` | Approved scope, impact, QA gates, execution record, dan rollback |
| Changelog | `changelog.txt` | Riwayat pembaruan |
| Reconciliation SQL | `scripts/reconcile_fn.sql` | DB function untuk deteksi mismatch |
| Deploy Script | `scripts/deploy-vps.ps1` | Deploy otomatis ke VPS |
| CAPA v6.0.8 | `docs/CAPA-v6.0.8.md` | Restore backend ke VPS baru dan cutover origin |
| CAPA v6.0.12 | `docs/CAPA-v6.0.12.md` | QRIS manual AI verification, reject vs AI outage, dan penyimpanan bukti |
