# System Audit Report — SPS Corner v5.16.2
**Tanggal:** 2026-07-21  
**Scope:** Full-stack audit (Frontend, Backend, Database, Security, Performance)  
**Status:** 68 temuan ditemukan

---

## RINGKASAN

| Severity | Jumlah |
|----------|--------|
| CRITICAL | 15 |
| MAJOR | 23 |
| MINOR | 20 |
| SILENT | 10 |
| **Total** | **68** |

## 1. CRITICAL

| ID | File | Masalah | Dampak | Fix |
|----|------|---------|--------|-----|
| C01 | `src/routes/payments.ts:623-637` | iPaymu Callback Signature Tidak Diverifikasi | Attacker bisa memalsukan konfirmasi pembayaran | Reject callback yang tidak punya signature |
| C02 | `server.ts:327-349` | XSS via Product Names di OG Tags | Stored XSS — malicious script executes di browser user | Sanitize semua input yang di-inject ke HTML |
| C03 | `server.ts:69` | dangerouslyAllowBrowser: true di Groq SDK | API key exposure risk + disabled security checks | Hapus flag |
| C04 | `src/routes/payments.ts:62,146,389,468,552` | Payment Endpoints Tanpa Auth | Siapapun bisa buat pembayaran, verify receipt, habiskan points | Tambahkan requireAuth + requireRole |
| C05 | `src/routes/transactions.ts:641-697` | Transaction Cancel Tanpa Auth (IDOR) | Siapapun bisa cancel transaksi pending | Tambahkan auth check |
| C06 | `src/routes/diagnostics.ts:112` | Auth Bypass di Diagnostics Route | Admin endpoint bisa diakses publik | Import requireAuth dari middleware |
| C07 | `src/routes/payments.ts` | Non-Atomic Payment Flows | Jika crash antara status update dan stock deduction | Gabungkan ke satu operasi atomic |
| C08 | `src/routes/payments.ts:267` | Manual Verify Tidak Memanggil Stock Deduction | Stock tidak terpotong untuk pembayaran manual | Tambahkan commitTransactionStock() call |
| C09 | `supabase-schema.sql` | Schema Drift | Developer baru bisa deploy schema yang salah | Regenerate schema dari deployed state |
| C10 | `.env (commit 5b5e51d)` | .env Ter-commit ke Git History | Semua production secrets ter-expose | Rotate semua keys + clean git history |
| C11 | `src/routes/digital.ts:713-714` | Expected HMAC Signature Logged | Attacker bisa forge valid webhook | Log hanya invalid, jangan log expected value |
| C12 | `src/routes/admin.ts:52` | Weak Temp Password (Math.random) | Password bisa di-brute force | Gunakan crypto.randomBytes() |
| C13 | `src/services/payment.js:34-36` | Non-Atomic Points Update | Concurrent requests bisa overwrite points | Gunakan atomic increment |
| C14 | `src/pages/portal/PortalPengumuman.tsx:348` | XSS via dangerouslySetInnerHTML | Script execution di browser user | Gunakan sanitizeRichTextHtml() |
| C15 | `src/routes/digital.ts:706-738` | Digiflazz Callback Signature Bypass | Callback diterima tanpa valid signature | Reject callback tanpa valid signature |

## 2. MAJOR

| ID | File | Masalah | Fix |
|----|------|---------|-----|
| M01 | `src/pages/kiosk/Checkout.tsx:46,213` | Checkout Mutex Tidak di-Reset | Tambahkan finally { isCreatingTx.current = false; } |
| M02 | `src/store/useCartStore.ts:46-89` | Stale Cart Stock | Re-validate stock sebelum checkout |
| M03 | `src/pages/dashboard/DashboardLayout.tsx:156` | Seller Phone Input Kosong | Gunakan useEffect untuk sync |
| M04 | `src/pages/dashboard/admin/AdminScanner.tsx:168-198` | AdminScanner Lock Permanen | Tambahkan finally { isLocked = false; } |
| M05 | `src/pages/kiosk/Profile.tsx:53-56` | Profile Input Reset | Gunakan local state |
| M06 | `src/services/email.js:26-31` | Email Transport Leak | Reuse transport |
| M07 | `src/services/background-jobs.js:340` | Memory Leak di notifiedProgramStarts | Batasi ukuran atau gunakan TTL |
| M08 | `src/services/digiflazz.js:59-65` | writeFileSync Blocking Event Loop | Gunakan async write |
| M09 | `src/routes/auth.ts:199` | Weak Password Policy | Minimum 8 karakter + complexity |
| M10 | `Multiple routes` | Verbose Error Messages | Return generic error |
| M11 | `server.ts` | Missing Compression | Tambahkan compression middleware |
| M12 | `src/routes/portal.ts:458` | Portal Checkout No Auth | Ambil userId dari token |
| M13 | `Database` | Missing Composite Indexes | Tambahkan index via migration |
| M14 | `src/services/background-jobs.js` | N+1 Queries di Background Jobs | Batch queries + Promise.all |
| M15 | `src/services/stock.js:392-397` | N+1 di Stock Reconciliation | Single query + group in memory |
| M16 | `Multiple endpoints` | Missing Caching | In-memory cache dengan TTL |
| M17 | `76 instances` | .select(*) Overfetching | Explicit column selection |
| M18 | `portal.ts, admin.ts` | Unbounded Queries | Tambahkan pagination |
| M19 | `src/routes/misc.ts:576` | Missing Auth on /api/reports | Tambahkan requireAuth |
| M20 | `src/routes/withdrawals.ts:27` | Seller Balance Restoration Non-Atomic | Fetch current balance |
| M21 | `100+ <img> tags` | Missing Image Lazy Loading | Tambahkan loading="lazy" |
| M22 | `src/App.tsx:162-175` | Auth State Stale | Hapus isAuthInit gate |
| M23 | `Multiple components` | Z-index Conflicts | Standardisasi z-index scale |

## 3. MINOR

| ID | File | Masalah | Fix |
|----|------|---------|-----|
| m01 | `Multiple` | Missing aria-label | Tambahkan a11y attributes |
| m02 | `server.ts:102` | CSP allows unsafe-inline/eval | Hapus unsafe directives |
| m03 | `server.ts:74` | trust proxy = 1 | Verify di belakang proxy |
| m04 | `src/middleware/auth.ts:20` | getUser DB call setiap request | Cache session |
| m05 | `src/services/stock.js:48` | Silent error catch | Tambahkan logging |
| m06 | `src/routes/misc.ts:546` | Log injection | Sanitize log input |
| m07 | `src/services/email.js:82` | HTML injection di email | Escape HTML |
| m08 | `src/routes/transactions.ts:699-725` | IDOR seller data | Tambahkan auth check |
| m09 | `server.ts:249-256` | VA number logged | Hapus dari log |
| m10 | `src/services/payment.js:32` | NaN handling | Tambahkan Number.isNaN check |
| m11 | `Multiple` | Duplicate routes (trailing slash) | Hapus duplikat |
| m12 | `DashboardLayout.tsx:277-420` | Nav recreate setiap render | Memoize |
| m13 | `DashboardLayout.tsx:145` | Hardcoded SARIROTI_EMAILS | Pindah ke constant |
| m14 | `src/routes/admin.ts:6-15` | Redundant auth check | Konsolidasi ke global middleware |
| m15 | `src/routes/diagnostics.ts:67-109` | Debug routes leak data | Hapus di production |
| m16 | `background-jobs.js:26` | dailyReport 60s interval | Kurangi ke 5 menit |
| m17 | `App.tsx:120-130` | Reload loop risk | Tambahkan max retry |
| m18 | `server.ts:276-278` | Interval pileup risk | Tambahkan guard |
| m19 | `Multiple` | Missing Suspense boundaries | Tambahkan fallback |
| m20 | `src/routes/portal.ts:16` | Missing points_history index | Tambahkan index |

## 4. SILENT

| ID | File | Masalah | Dampak |
|----|------|---------|--------|
| s01 | `KioskLayout.tsx:64-77` | Error swallowed tanpa feedback | User tidak tahu API error |
| s02 | `AdminDashboard.tsx:183-184` | Promise.all catch = null | Dashboard kosong tanpa penjelasan |
| s03 | `PortalFormView.tsx:212-215` | Registration check gagal silent | Bisa daftar duplikat |
| s04 | `useCartStore.ts:71-78` | updateQuantity(0) tidak remove | Zombie items, cart count salah |
| s05 | `History.tsx:67-82` | Polling timeout setelah unmount | State update on unmounted |
| s06 | `App.tsx:120-130` | Reload loop pada chunk error | Infinite reload |
| s07 | `stock.ts:14` | Insert error tidak di-handle | Stock request gagal silent |
| s08 | `withdrawals.ts:62` | Balance restore error tidak di-handle | Seller rugi tanpa trace |
| s09 | `payments.ts:92` | API key missing → empty string | Groq calls gagal unhelpful |
| s10 | `Multiple` | @ts-nocheck disables type safety | Null checks terlewat |

## 5. PRIORITAS PERBAIKAN

### Priority 1 — Minggu Ini
- C04, C05, C06, C01, C02, C03, C10, C13, C14, C08

### Priority 2 — 2 Minggu
- M01, M06, M07, M08, M11, M13, M14, M16, M17

### Priority 3 — Bulanan
- Semua MINOR + SILENT

---

*Audit ini dibuat pada 2026-07-21 oleh AI Agent (opencode)*
