# System Audit Report — SPS Corner v5.16.2
**Tanggal:** 21 Juli 2026  
**Scope:** Full-stack audit (Frontend, Backend, Database, Security, Performance)  
**Status:** 48 temuan ditemukan, 15 CRITICAL/MAJOR perlu perbaikan segera

---

## RINGKASAN EKSEKUTIF

| Severity | Jumlah | Keterangan |
|----------|--------|------------|
| **CRITICAL** | 15 | Harus diperbaiki SEKARANG — data loss, security breach, crash |
| **MAJOR** | 23 | Harus diperbaiki minggu ini — feature broken, wrong data |
| **MINOR** | 20 | Perbaikan bertahap — cosmetic, UX, optimasi |
| **SILENT** | 10 | Tersembunyi — tidak ada error tapi data salah/lost |
| **Total** | **68** | |

---

## DAFTAR ISI

1. [CRITICAL — Perlu Perbaikan Segera](#1-critical)
2. [MAJOR — Perlu Perbaikan Minggu Ini](#2-major)
3. [MINOR — Perbaikan Bertahap](#3-minor)
4. [SILENT — Bug Tersembunyi](#4-silent)
5. [Prioritas Perbaikan](#5-prioritas)
6. [File yang Perlu Diubah](#6-files)

---

## 1. CRITICAL

### C01 — iPaymu Callback Signature Tidak Diverifikasi
- **File:** `src/routes/payments.ts:623-637`
- **Masalah:** Jika iPaymu mengirim callback tanpa signature, callback diterima tanpa verifikasi
- **Dampak:** Attacker bisa memalsukan konfirmasi pembayaran
- **Fix:** Reject callback yang tidak punya signature

### C02 — XSS via Product Names di Pre-Order OG Tags
- **File:** `server.ts:327-349`
- **Masalah:** `product.name` di-inject ke HTML tanpa sanitasi lengkap (hanya `"` yang di-escape)
- **Dampak:** Stored XSS — malicious script executes di browser user
- **Fix:** Sanitize semua input yang di-inject ke HTML

### C03 — `dangerouslyAllowBrowser: true` di Groq SDK
- **File:** `server.ts:69`
- **Masalah:** Flag ini tidak perlu di server-side, bisa leak API key
- **Fix:** Hapus flag

### C04 — Payment Endpoints Tanpa Auth
- **File:** `src/routes/payments.ts:62,146,389,468,552`
- **Masalah:** 5 endpoint pembayaran tidak punya auth middleware
- **Dampak:** Siapapun bisa buat pembayaran, verify receipt, habiskan points
- **Fix:** Tambahkan `requireAuth` + `requireRole` ke semua endpoint

### C05 — Transaction Cancel Tanpa Auth (IDOR)
- **File:** `src/routes/transactions.ts:641-697`
- **Masalah:** Cancel transaction tidak perlu auth jika `buyer_id` null
- **Dampak:** Siapapun bisa cancel transaksi pending dengan menebak ID
- **Fix:** Tambahkan auth check

### C06 — Auth Bypass di Diagnostics Route
- **File:** `src/routes/diagnostics.ts:112`
- **Masalah:** `requireAuth` tidak dipanggil sebagai function (tanpa supabase)
- **Dampak:** Admin reconciliation endpoint bisa diakses publik
- **Fix:** Import `requireAuth` dari middleware dan gunakan dengan benar

### C07 — Non-Atomic Payment Flows
- **File:** `src/routes/payments.ts` (semua payment path)
- **Masalah:** Status update, stock deduction, seller balance settlement = operasi terpisah, tidak atomic
- **Dampak:** Jika crash antara status update dan stock deduction, transaksi "paid" tapi stock tidak dipotong
- **Fix:** Gabungkan ke satu operasi atomic atau tambahkan idempotency check yang lebih kuat

### C08 — Manual Verify Tidak Memanggil Stock Deduction
- **File:** `src/routes/payments.ts:267`
- **Masalah:** `manual/verify` memanggil `updateSellerBalances` tapi TIDAK memanggil `commitTransactionStock`
- **Dampak:** Stock tidak terpotong untuk pembayaran manual
- **Fix:** Tambahkan `commitTransactionStock()` call

### C09 — Schema Drift
- **File:** `supabase-schema.sql` vs actual deployed schema
- **Masalah:** Base CREATE TABLE statements sudah stale, kolom ditambah via ALTER TABLE tapi tidak di-sync ke base schema
- **Dampak:** Developer baru bisa deploy schema yang salah
- **Fix:** Regenerate schema dari deployed state

### C10 — `.env` Ter-commit ke Git History
- **File:** `.env` (commit `5b5e51d`)
- **Masalah:** Semua production secrets ter-expose di git history
- **Dampak:** Siapapun dengan repo access bisa extract secrets
- **Fix:** Rotate semua keys, gunakan BFG Repo-Cleaner

### C11 — Groq SDK Log Expected HMAC Signature
- **File:** `src/routes/digital.ts:713-714`
- **Masalah:** Expected HMAC signature di-log ke console
- **Dampak:** Attacker bisa forge valid webhook
- **Fix:** Log hanya "invalid", jangan log expected value

### C12 — Weak Temp Password (Math.random)
- **File:** `src/routes/admin.ts:52`
- **Masalah:** `Math.random()` bukan cryptographically secure
- **Fix:** Gunakan `crypto.randomBytes()`

### C13 — Non-Atomic Points Update (Race Condition)
- **File:** `src/services/payment.js:34-36`
- **Masalah:** Read-then-update pattern untuk loyalty points
- **Dampak:** Concurrent requests bisa overwrite points
- **Fix:** Gunakan atomic increment

### C14 — XSS via dangerouslySetInnerHTML
- **File:** `src/pages/portal/PortalPengumuman.tsx:348`
- **Masalah:** Announcement content di-render tanpa sanitasi
- **Fix:** Gunakan `sanitizeRichTextHtml()` untuk semua HTML rendering

### C15 — Digiflazz Callback Signature Bypass
- **File:** `src/routes/digital.ts:706-738`
- **Masalah:** Callback diterima tanpa signature jika tidak ada secret
- **Fix:** Reject callback tanpa valid signature

---

## 2. MAJOR

### M01 — Checkout Mutex Tidak di-Reset
- **File:** `src/pages/kiosk/Checkout.tsx:46,213`
- **Masalah:** `isCreatingTx.current = true` tidak di-reset jika gagal
- **Fix:** Tambahkan `finally { isCreatingTx.current = false; }`

### M02 — Stale Cart Stock
- **File:** `src/store/useCartStore.ts:46-89`
- **Masalah:** Stock di cart tidak update dari server
- **Fix:** Re-validate stock sebelum checkout

### M03 — Seller Phone Input Kosong
- **File:** `src/pages/dashboard/DashboardLayout.tsx:156`
- **Masalah:** `useState(user?.phone || '')` hanya evaluate sekali
- **Fix:** Gunakan useEffect untuk sync dengan user data

### M04 — AdminScanner Lock Permanen
- **File:** `src/pages/dashboard/admin/AdminScanner.tsx:168-198`
- **Masalah:** `isLocked` tidak di-reset jika error
- **Fix:** Tambahkan `finally { isLocked = false; }`

### M05 — Profile Input Reset
- **File:** `src/pages/kiosk/Profile.tsx:53-56,102-109`
- **Masalah:** User input di-overwrite oleh store refresh
- **Fix:** Gunakan local state yang tidak di-sync dari store

### M06 — Email Transport Leak
- **File:** `src/services/email.js:26-31`
- **Masalah:** Setiap email buat SMTP transport baru
- **Fix:** Reuse transport yang sudah dibuat

### M07 — Background Jobs Memory Leak
- **File:** `src/services/background-jobs.js:340`
- **Masalah:** `notifiedProgramStarts` Set tidak pernah di-clear
- **Fix:** Batasi ukuran Set atau gunakan TTL

### M08 — writeFileSync Blocking Event Loop
- **File:** `src/services/digiflazz.js:59-65`
- **Masalah:** File cache ditulis synchronous
- **Fix:** Gunakan `fs.writeFile` async

### M09 — Weak Password Policy
- **File:** `src/routes/auth.ts:199`
- **Masalah:** Minimum 6 karakter, tidak ada complexity check
- **Fix:** Minimum 8 karakter + letter + number

### M10 — Verbose Error Messages
- **File:** Multiple routes
- **Masalah:** Internal error messages dikembalikan ke client
- **Fix:** Return generic error, log detail server-side

### M11 — Missing Compression
- **File:** `server.ts`
- **Masalah:** Tidak ada gzip compression middleware
- **Fix:** Tambahkan `app.use(compression())`

### M12 — Portal Checkout No Auth
- **File:** `src/routes/portal.ts:458`
- **Masalah:** `userId` diambil dari request body, bukan auth
- **Fix:** Ambil userId dari token

### M13 — Missing Composite Indexes
- **File:** Database
- **Masalah:** Index缺失：`stock_adjustments(transaction_id, product_id, adjustment_type)`, `transactions(buyer_id)`, `transaction_items(product_id)`
- **Fix:** Tambahkan index via migration

### M14 — N+1 Queries di Background Jobs
- **File:** `src/services/background-jobs.js`
- **Masalah:** `dailyReport()`, `autoCleanup()`, `autoReconcileTransactions()` — semua loop dengan sequential DB calls
- **Fix:** Batch queries + Promise.all

### M15 — N+1 di Stock Reconciliation
- **File:** `src/services/stock.js:392-397`
- **Masalah:** Loop per product query stock_adjustments
- **Fix:** Single query + group in memory

### M16 — Missing Caching
- **File:** Multiple endpoints
- **Masalah:** Analytics, stock report, points history — tidak ada caching
- **Fix:** In-memory cache dengan TTL

### M17 — .select('*') Overfetching
- **File:** 76 instances across routes
- **Masalah:** Fetch semua kolom padahal butuh beberapa saja
- **Fix:** Explicit column selection

### M18 — Unbounded Queries
- **File:** `portal.ts`, `admin.ts`
- **Masalah:** Query tanpa limit
- **Fix:** Tambahkan pagination

### M19 — Missing Auth on /api/reports
- **File:** `src/routes/misc.ts:576`
- **Masalah:** Admin reports endpoint tanpa auth
- **Fix:** Tambahkan requireAuth + requireRole

### M20 — Seller Balance Restoration Non-Atomic
- **File:** `src/routes/withdrawals.ts:27`
- **Masalah:** Rollback pakai stale balance value
- **Fix:** Fetch current balance sebelum rollback

### M21 — Missing Image Lazy Loading
- **File:** 100+ `<img>` tags
- **Masalah:** Semua gambar load sekaligus
- **Fix:** Tambahkan `loading="lazy"`

### M22 — Auth State Stale di App.tsx
- **File:** `src/App.tsx:162-175`
- **Masalah:** Auth listener hanya handle event pertama
- **Fix:** Hapus `isAuthInit` gate

### M23 — Z-index Conflicts
- **File:** Multiple components
- **Masalah:** Z-index values overlap (9999, 10000, 99998)
- **Fix:** Standardisasi z-index scale

---

## 3. MINOR

| # | File | Masalah | Fix |
|---|------|---------|-----|
| m01 | Multiple | Missing `aria-label` | Tambahkan a11y attributes |
| m02 | `server.ts:102` | CSP allows unsafe-inline/eval | Hapus unsafe directives |
| m03 | `server.ts:74` | trust proxy = 1 | Verify di belakang proxy |
| m04 | `src/middleware/auth.ts:20` | getUser DB call setiap request | Cache session |
| m05 | `src/services/stock.js:48` | Silent error catch | Tambahkan logging |
| m06 | `src/routes/misc.ts:546` | Log injection | Sanitize log input |
| m07 | `src/services/email.js:82` | HTML injection di email | Escape HTML |
| m08 | `src/routes/transactions.ts:699-725` | IDOR seller data | Tambahkan auth check |
| m09 | `server.ts:249-256` | VA number logged | Hapus dari log |
| m10 | `src/services/payment.js:32` | NaN handling | Tambahkan Number.isNaN check |
| m11 | Multiple | Duplicate routes (trailing slash) | Hapus duplikat |
| m12 | `DashboardLayout.tsx:277-420` | Nav recreate setiap render | Memoize |
| m13 | `DashboardLayout.tsx:145` | Hardcoded SARIROTI_EMAILS | Pindah ke constant |
| m14 | `src/routes/admin.ts:6-15` | Redundant auth check | Konsolidasi ke global middleware |
| m15 | `src/routes/diagnostics.ts:67-109` | Debug routes leak data | Hapus di production |
| m16 | `background-jobs.js:26` | dailyReport 60s interval | Kurangi ke 5 menit |
| m17 | `App.tsx:120-130` | Reload loop risk | Tambahkan max retry |
| m18 | `server.ts:276-278` | Interval pileup risk | Tambahkan guard |
| m19 | Multiple | Missing Suspense boundaries | Tambahkan fallback |
| m20 | `src/routes/portal.ts:16` | Missing points_history index | Tambahkan index |

---

## 4. SILENT

| # | File | Masalah | Dampak |
|---|------|---------|--------|
| s01 | `KioskLayout.tsx:64-77` | Error swallowed tanpa feedback | User tidak tahu API error |
| s02 | `AdminDashboard.tsx:183-184` | Promise.all catch = null | Dashboard kosong tanpa penjelasan |
| s03 | `PortalFormView.tsx:212-215` | Registration check gagal silent | Bisa daftar duplikat |
| s04 | `useCartStore.ts:71-78` | updateQuantity(0) tidak remove | Zombie items, cart count salah |
| s05 | `History.tsx:67-82` | Polling timeout setelah unmount | State update on unmounted |
| s06 | `App.tsx:120-130` | Reload loop pada chunk error | Infinite reload |
| s07 | `stock.ts:14` | Insert error tidak di-handle | Stock request gagal silent |
| s08 | `withdrawals.ts:62` | Balance restore error tidak di-handle | Seller rugi tanpa trace |
| s09 | `payments.ts:92` | API key missing → empty string | Groq calls gagal unhelpful |
| s10 | Multiple | @ts-nocheck disables type safety | Null checks terlewat |

---

## 5. PRIORITAS PERBAIKAN

### Priority 1 — Minggu Ini (CRITICAL + Security)
| # | Temuan | Estimasi |
|---|--------|----------|
| C04 | Auth ke payment endpoints | 2 jam |
| C05 | Auth ke transaction cancel | 30 menit |
| C06 | Fix diagnostics.ts auth | 15 menit |
| C01 | Reject unsigned iPaymu callback | 1 jam |
| C02 | Sanitize OG tag HTML | 1 jam |
| C03 | Hapus dangerouslyAllowBrowser | 5 menit |
| C10 | Rotate secrets + clean git history | 2 jam |
| C13 | Atomic points update | 1 jam |
| C14 | Sanitize dangerouslySetInnerHTML | 1 jam |
| C08 | Tambahkan stock deduction ke manual verify | 30 menit |

### Priority 2 — 2 Minggu (MAJOR)
| # | Temuan | Estimasi |
|---|--------|----------|
| M01 | Fix checkout mutex finally block | 15 menit |
| M06 | Reuse email transport | 1 jam |
| M07 | Clear notifiedProgramStarts Set | 30 menit |
| M08 | Async file write | 30 menit |
| M11 | Tambahkan compression | 30 menit |
| M13 | Tambahkan DB indexes | 1 jam |
| M14 | Fix N+1 di background jobs | 3 jam |
| M16 | Tambahkan caching | 2 jam |
| M17 | Replace .select('*') | 3 jam |

### Priority 3 — Bulanan (MINOR + SILENT)
| # | Temuan | Estimasi |
|---|--------|----------|
| Semua MINOR | Bug cosmetic + UX | Seiring waktu |
| Semua SILENT | Tambahkan error handling | Seiring waktu |

---

## 6. FILE YANG PERLU DIUBAH

| File | Temuan | Priority |
|------|--------|----------|
| `src/routes/payments.ts` | C01, C04, C07, C08 | P1 |
| `src/routes/transactions.ts` | C05, M08 | P1 |
| `src/routes/diagnostics.ts` | C06 | P1 |
| `server.ts` | C02, C03, M11 | P1 |
| `src/services/email.js` | M06 | P2 |
| `src/services/background-jobs.js` | M07, M14 | P2 |
| `src/services/stock.js` | M15 | P2 |
| `src/services/payment.js` | C13 | P1 |
| `src/routes/digital.ts` | C15 | P1 |
| `src/routes/portal.ts` | M12 | P2 |
| `src/store/useCartStore.ts` | M02, s04 | P2 |
| `src/pages/kiosk/Checkout.tsx` | M01 | P2 |
| `src/pages/dashboard/admin/AdminScanner.tsx` | M04 | P2 |
| `src/pages/portal/PortalPengumuman.tsx` | C14 | P1 |
| `src/App.tsx` | M22, s06 | P2 |
| `src/routes/admin.ts` | C12 | P1 |
| `src/routes/misc.ts` | M19 | P2 |
| `src/routes/withdrawals.ts` | M20 | P2 |
| Database migration | M13 | P2 |

---

*Audit ini dibuat pada 21 Juli 2026 oleh AI Agent (opencode)*  
*Untuk pertanyaan: admin@spscorner.store*
