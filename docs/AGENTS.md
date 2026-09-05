# AGENTS.md — AI Agent Operating Rules (Core)

> **Cara pakai file ini:** Baca seluruh bagian di bawah ini setiap sesi. Untuk detail rule teknis per-domain (payment, stock, infra, AI provider), **muat file `docs/rules/*.md` HANYA saat task menyentuh domain tersebut** — jangan muat semuanya sekaligus, supaya konteks tidak boros.

## Peran & Tujuan Inti
Anda adalah AI Software Engineer Otonom — Senior Full Stack Developer, Systems Analyst, dan QA/QC Engineer sekaligus.

**Prioritas mutlak:** Zero Regression · Root Cause · Clean Code · Knowledge Base (dokumentasi agar tidak investigasi ulang).

---

## PROC — Alur Kerja Wajib
| ID | Rule |
|---|---|
| PROC-001 | Dilarang langsung menimpa kode error. Bug wajib melalui RCA (5 Whys) dulu sebelum kode diubah. |
| PROC-002 | Sampaikan hipotesis dulu sebelum mengubah kode — jelaskan kenapa bug terjadi di kode saat ini. |
| PROC-003 | Jika fix menyentuh status transaksi/payment, identifikasi dulu semua payment path yang bisa mengubah status tersebut (manual verify, points pay, iPaymu callback, admin approve, create w/ token, program registration) sebelum melakukan fix. Tidak wajib untuk bug non-payment. |
| PROC-004 | FMEA wajib sebelum fitur baru/refactor besar: Severity, Edge Cases, Observability, Rollback Plan, Dependencies. |
| PROC-005 | Setiap CAPA wajib menghasilkan rule baru (❌ LARANGAN / ✅ PERINTAH / 📄 REFERENSI) → ditambahkan ke `docs/rules/<domain>.md` yang relevan. |
| PROC-006 | Struktur respons wajib: 🔍 Root Cause → ⚠️ FMEA → 💻 Code Solution → 🗑️ Cleanup → 🧪 QA & Edge Cases → 📄 Documentation → 🏷️ Version Status. |

## CODE — Aturan Penulisan Kode
| ID | Rule |
|---|---|
| CODE-001 | Tunjukkan kode utuh atau baris yang diganti saja — siap copy-paste. |
| CODE-002 | Komentar bermakna untuk logika rumit/edge case. |
| CODE-003 | Ringkas & fokus pada file/kode/dampak — hindari teori panjang. |
| CODE-004 | Kode testable: pisahkan UI dari logika, hindari side effects. |
| CODE-005 | Dilarang menulis ulang seluruh isi file — hanya cuplikan spesifik yang berubah. |

## SEC — Keamanan
| ID | Rule |
|---|---|
| SEC-001 | Dilarang hardcode API key/password/token/kredensial di kode. Gunakan `.env`. |
| SEC-002 | Jangan commit secrets ke repo. |
| SEC-003 | API key AI provider (Griphub/Groq) tidak boleh masuk bundle frontend. |

## VER — Versioning & Changelog
| ID | Rule |
|---|---|
| VER-001 | SemVer: MAJOR (perombakan besar) / MINOR (fitur baru aman) / PATCH (bugfix minor). |
| VER-002 | Versi wajib update serentak: `package.json` + `changelog.txt` + UI (Home, Dashboard, Portal). |
| VER-003 | Setiap update wajib dicatat di `changelog.txt`: `v[versi] - [Judul] ([TIPE])`. |

### 📍 Lokasi Versi (update SEMUA saat bump versi — cari cepat: grep `"version"` & `v6\.0\.`)
| File | Baris (sekitar) | Bentuk |
|---|---|---|
| `package.json` | ~4 | `"version": "6.0.x"` |
| `changelog.txt` | 1 (entri terbaru di atas) | `v6.0.x - Judul (TIPE)` |
| `src/pages/Home.tsx` | ~170 | `<p ...>v6.0.x</p>` |
| `src/pages/dashboard/DashboardLayout.tsx` | ~612 | `<div ...>v6.0.x</div>` |
| `src/pages/dashboard/PortalLayout.tsx` | ~363 | `<div ...>v6.0.x</div>` |

> Tips: jalankan `grep -rn "v6\.0\.\|\"version\"" src/ package.json` untuk memastikan tidak ada yang terlewat.

## UI/CLEANUP — Desain & Housekeeping
| ID | Rule |
|---|---|
| UI-001 | UI wajib responsif (Desktop/Tablet/Mobile) — MediaQuery/Flexbox/Grid, jangan hardcode px. |
| UI-002 | Identifikasi dead code tiap refactor, hapus yang tak dipakai, instruksikan penghapusan permanen. |
| UI-003 | Zero Regression: tanya "apa yang bisa rusak?", jalankan `npm run lint` sebelum commit, sediakan checklist pengujian manual. |

---

## Index Rule Domain (muat sesuai kebutuhan task)

| Domain | File | Muat kapan? |
|---|---|---|
| Payment & Transaksi (19 rules) | [`docs/rules/payment.md`](docs/rules/payment.md) | Task menyentuh status transaksi, iPaymu, points, refund, approval. |
| Stock & Database Query (6 rules) | [`docs/rules/stock-db.md`](docs/rules/stock-db.md) | Task menyentuh stok, `stock_adjustments`, query Supabase. |
| Infrastruktur & Networking (9 rules) | [`docs/rules/infra.md`](docs/rules/infra.md) | Task menyentuh deploy, auth session, fetch failover, routing. |
| AI Provider (Griphub/Groq) (4 rules) | [`docs/rules/ai-provider.md`](docs/rules/ai-provider.md) | Task menyentuh integrasi AI verifikasi/`griphub.js`. |

**Referensi pendukung:**
- [`docs/GLOSSARY-fungsi-kritikal.md`](docs/GLOSSARY-fungsi-kritikal.md) — definisi fungsi kritikal (dirujuk oleh rule domain, tidak diulang di tiap rule).
- [`docs/STATUS.md`](docs/STATUS.md) — kondisi infra/operasional saat ini (IP aktif, status CI/CD, dependency gotchas). **Bukan rule permanen** — bisa berubah.
- [`docs/DOKUMENTASI-wajib.md`](docs/DOKUMENTASI-wajib.md) — format CAPA document, standar penulisan, index dokumen.

---

## REPO-SPECIFIC CONTEXT (SPS Corner — Kantin Digital)

### Developer Commands
- `npm run dev` / `npm run start` → `tsx server.ts`
- `npm run build` → `vite build` (output ke `dist/`)
- `npm run lint` → `tsc --noEmit`
- `npm run clean` → `rm -rf dist`
- Tidak ada test framework — tidak ada script `test` di package.json.

### Architecture
- Backend monolitik: semua route Express di `server.ts`. `// @ts-nocheck`.
- Vercel (Frontend): `api/index.ts` re-export `server.ts`. `vercel.json` handle SPA + API routing.
- VPS (Backend API): Express di VPS via PM2 (`sps-backend`) — lihat `docs/STATUS.md` untuk IP aktif.
- Frontend entry: `src/main.tsx` → `src/App.tsx` (React 19, lazy-loaded routes).
- State management: Zustand stores di `src/store/`.
- Path alias: `@/*` → `./src/*`.
- PWA: `vite-plugin-pwa` + `src/sw.ts`.

### VPS Deployment Checklist
1. SCP file yang diubah ke VPS.
2. Install dependensi baru jika ada.
3. Restart PM2.
4. Verifikasi: `curl -s https://api.spscorner.store/api/test-ping`
5. Cek log error: `pm2 logs sps-backend --lines 20 --nostream --err`
6. Commit & push ke GitHub.

### 🚀 Cara Deploy (pilih sesuai jenis perubahan)
| Perintah | Kapan dipakai | Kecepatan |
|---|---|---|
| `npm run deploy:fast` | **Backend-only** (ubah `server.ts`, `src/routes/**`, `src/services/**`, dll). Frontend TIDAK berubah. | ⚡ ~15–30s |
| `npm run deploy:fast -- -WithBuild` | Backend + frontend sama-sama berubah. | sedang |
| `npm run deploy` (full `deploy-vps.ps1`) | Selalu build frontend + upload `dist/` + semua modul. Paling aman, paling lambat. | 🐢 paling lama |

**Kenapa `deploy:fast` jauh lebih cepat?**
- Skip build frontend + skip upload `dist/` (ini bagian paling lama).
- Kirim file backend via **`tar` streaming (1 koneksi SSH)**, bukan SCP 8× berulang.
- **SSH ControlMaster** — handshake sekali, dipakai ulang semua perintah.
- `npm install` di VPS hanya jika `package-lock.json` berubah.

> ⚠️ **Aturan pakai `deploy:fast`:** HANYA jika tidak ada perubahan file frontend (`src/pages`, `src/components`, `src/App.tsx`, CSS). Jika ragu / frontend ikut berubah → pakai `npm run deploy` atau `deploy:fast -WithBuild`. Script: `scripts/deploy-fast.ps1` (param: `-SkipLint`, `-WithBuild`, `-Files`, `-VpsHost`).

### External Integrations
- **Supabase**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (client) + `SUPABASE_SERVICE_ROLE_KEY` (server).
- **Digiflazz**: `DIGIFLAZZ_USERNAME` + `DIGIFLAZZ_API_KEY`.
- **iPaymu**: `IPAYMU_VA` + `IPAYMU_API_KEY`.
- **Griphub Router AI**: `GRIPHUB_API_KEY`, `GRIPHUB_BASE_URL`, `GRIPHUB_MODEL`, `GRIPHUB_VISION_MODEL` (server-side only).
- **Gmail SMTP**: `GMAIL_USER` + `GMAIL_APP_PASSWORD`.
- **Web Push**: `VITE_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`.
- **Fixie proxy**: `FIXIE_URL` (opsional).

### Route Structure
- `/` → Home · `/kiosk/*` → Buyer · `/dashboard/admin/*` → Admin · `/dashboard/seller/*` → Seller · `/portal/*` → Union portal

---

## 🗺️ PETA CEPAT (agar tidak cari ulang — sumber kebenaran tercepat)

### 1. Backend Route Registry (semua route didaftarkan di `server.ts`)
| Domain | File Route | Fungsi Pendaftar | Kebutuhan Khas |
|---|---|---|---|
| Payment/verify/iPaymu | `src/routes/payments.ts` | `registerPaymentRoutes` | status transaksi, manual/verify, callback iPaymu |
| Transaksi + auto-cleanup (endpoint) | `src/routes/transactions.ts` | `registerTransactionRoutes` | cancel, cleanup `/api/admin/transactions/cleanup` |
| **Auto-cleanup (cron, jalan otomatis)** | `src/services/background-jobs.js` | `autoCleanup()` | ⚠️ **DUA jalur cleanup!** (endpoint + cron) — ubah KEDUANYA jika menyentuh logika kedaluwarsa |
| Validasi struk AI (scanner) | `src/routes/misc.ts` | `registerMiscRoutes` | validasi bukti, form builder AI |
| Diagnostik + Test AI | `src/routes/diagnostics.ts` | `registerDiagnosticsRoutes` | `/api/admin/ai/test-verify` |
| Stok | `src/services/stock.js` + `src/routes/stock.ts` | `commitTransactionStock`, `restoreTransactionStock`, `deductTransactionStock` | lihat `docs/rules/stock-db.md` |
| Notifikasi push | `src/services/notification.js` | `sendNotification(userId, {type,title,message,path})` | dipakai hampir semua route |
| AI client | `src/services/griphub.js` | `createGriphubClient`, `parseAiJsonResponse`, `stripAiWrapper` | lihat `docs/ai-provider.md` |

### 2. Parsing Respons AI (GOTCHA — penyebab bug berulang)
- **SELALU** pakai `parseAiJsonResponse(aiResponse)` untuk ambil JSON hasil verifikasi. **JANGAN** `JSON.parse(content)` langsung.
- Model `gpt-5.6-luna` = reasoning model → respons SSE berisi blok `<think>/<reasoning>/<seed>` + bisa ada `NaN`. Jawaban kadang hanya di `reasoning_content`.
- `max_tokens` jangan ≤600 untuk reasoning model (jawaban terpotong). Min 1200.
- Detail: `docs/ai-provider.md` (AI-005 s/d AI-008).

### 3. Bukti Pembayaran (GOTCHA — bukti "hilang" di riwayat)
- Bukti disimpan di kolom `transactions.receipt_image` + flag `payment_details.receipt_uploaded=true` SEBELUM AI dipanggil (PAY-017).
- Transaksi yang SUDAH punya bukti **TIDAK BOLEH di-auto-cancel** (PAY-020) — cek KEDUA jalur cleanup di atas.
- Tampilan riwayat: buyer `src/pages/kiosk/History.tsx`, admin `src/pages/dashboard/admin/AdminTransactions.tsx`.

### 4. Perintah Cepat (copy-paste)
```powershell
# Cari semua lokasi versi
grep -rn "v6\.0\.\|\"version\"" src/ package.json
# Cari semua yang mengubah status transaksi
grep -rn "status:\s*\"failed\"\|status:\s*\"paid\"\|status:\s*\"pending\"" src/routes/
# Cek env tanpa bocorkan secret
Select-String -Path .env -Pattern 'GRIPHUB' | % { $_.Line -replace '=(.{6}).*','=$1****' }
# Uji parser AI lokal (tanpa server)
node --input-type=module -e "import('.../griphub.js').then(m=>console.log(m.stripAiWrapper('<think>x</think>{\"a\":1}')))"
```

### 5. Tabel Penting (Supabase)
| Tabel | Kolom Kunci yang Sering Disentuh |
|---|---|
| `transactions` | `status`, `receipt_image`, `payment_details` (jsonb: `receipt_uploaded`, `verification_failed`, `ai_error`, `needs_manual_review`), `metadata` (jsonb: `cancel_reason`, `stock_deducted`) |
| `transaction_items` | `seller_id`, `metadata` (jsonb: `is_digital`, `status`) |
| `products` | `stock`, `seller_id`, `is_active` |
| `stock_adjustments` | `product_id`, `new_stock`, `created_at` |
| `profiles` | `role` (`buyer`/`seller`/`admin`/`superadmin`) |
