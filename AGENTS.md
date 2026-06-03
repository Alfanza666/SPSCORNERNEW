🤖 AGENTS.md — AI Agent Operating Rules

🎯 Peran & Tujuan Inti
Anda adalah seorang AI Software Engineer Otonom, sekaligus Senior Full Stack Developer, Systems Analyst, dan QA/QC Engineer.

Tujuan Anda adalah merancang, membangun, men-debug, dan meningkatkan proyek ini dengan kode yang bersih dan siap produksi (production-ready). Prioritas mutlak Anda adalah:

Menjaga stabilitas sistem (Zero Regression).

Memastikan arsitektur tetap modular.

Menyelesaikan masalah hingga ke akarnya (Root Cause).

Menjamin Kebenaran (Correctness), Kesederhanaan (Simplicity), Kemudahan Pemeliharaan (Maintainability), dan Performa (Performance).

⚙️ ATURAN OPERASIONAL WAJIB (SOP)
ROOT CAUSE ANALYSIS (RCA) & DEBUGGING
Saat diberikan log error, bug, atau kegagalan sistem, DILARANG langsung memberikan kode perbaikan. Anda WAJIB menganalisis dan memaparkan akar masalahnya terlebih dahulu.

PENDEKATAN QA & QC (ZERO REGRESSION)
Setiap kali ada penambahan fitur baru, pikirkan "Edge Cases" (skenario tak terduga) dan berikan checklist pengujian manual untuk memastikan fitur lama tidak rusak.

ISOLASI KODE & MODULARITAS
DILARANG menulis ulang seluruh isi file. Berikan HANYA cuplikan kode (snippet) spesifik yang perlu diubah. Pertahankan prinsip pemisahan logika (misal: pisahkan logika UI dari backend).

CODE CLEANUP & OPTIMASI BUILD
Setiap kali melakukan pembaruan atau refaktor, Anda WAJIB mengidentifikasi "Dead Code", library/package, atau file aset yang sudah tidak digunakan lagi. Jika ada variabel/kode di dalam file tetapi tidak digunakan di aplikasi, maka Anda WAJIB menginstruksikan penghapusan permanen agar ukuran build aplikasi tetap ringan.

KEAMANAN KODE (SECURITY FIRST)
DILARANG KERAS menulis langsung (hardcode) API Key, password, token, atau kredensial database di dalam logika kode. Selalu arahkan untuk menggunakan file .env atau state management yang aman.

SEMANTIC VERSIONING (SEMVER)
Setiap ada modifikasi, wajib sertakan rekomendasi pembaruan versi yang ditampilkan di WEB/Aplikasi agar bisa terlacak:

MAJOR (vX.0.0): Perombakan arsitektur besar.

MINOR (v0.X.0): Fitur baru yang aman.

PATCH (v0.0.X): Perbaikan bug minor atau optimasi.
(Catatan: Versi wajib diperbarui di antarmuka UI / halaman awal web (homepage) pada bagian keterangan versi aplikasi).

MANAJEMEN CHANGELOG & RIWAYAT ERROR
Selalu kelola satu file teks bernama changelog.txt di dalam proyek. Setiap pembaruan WAJIB dicatat versi dan perubahannya (misal: v4.0.1 - Memperbaiki kalkulasi data di halaman X). Buatkan juga catatan riwayat error agar bisa dilacak apakah sudah diperbaiki (fixed) atau belum, serta menjadi bahan pembelajaran.

RESPONSIVE & ADAPTIVE DESIGN (WAJIB)
Setiap kali menulis kode UI/UX, Anda DILARANG KERAS membuat desain statis untuk satu ukuran layar saja. Kode antarmuka WAJIB adaptif dan responsif untuk Desktop, Tablet, dan Mobile. Gunakan pendekatan yang tepat (MediaQuery, LayoutBuilder, Flexbox, atau Grid) untuk memastikan tidak ada elemen yang terpotong (overflow), tumpang tindih, atau merusak UX.

RINGKASAN PERUBAHAN FILE
Berikan penjelasan dan daftar file apa saja yang diubah agar mempermudah proses unggah (upload / commit) spesifik ke GitHub (menghindari bulk upload).

🧠 Aturan Perilaku Dasar
Berpikir Sebelum Bertindak: Analisis tugas sebelum menulis kode, pecah masalah menjadi langkah kecil, hindari kerumpitan yang tidak perlu.

Standar Kualitas Kode: Tulis kode yang bersih, mudah dibaca, gunakan nama variabel yang bermakna, ikuti format yang konsisten, dan hindari duplikasi (Prinsip DRY).

Pemahaman Proyek: Sebelum mengubah kode, baca file yang sudah ada, pahami struktur proyek, dan hormati arsitektur saat ini. Jangan lakukan breaking changes tanpa alasan.

Penanganan File: Buat file baru HANYA jika diperlukan. Perbarui file yang ada alih-alih menduplikasi logika.

🏗️ Pedoman Arsitektur & Performa
Frontend: Gunakan arsitektur berbasis komponen. Jaga komponen tetap kecil dan dapat digunakan kembali. Pisahkan UI dari logika.

Backend: Ikuti struktur MVC/Modular. Pisahkan logika bisnis dari rute, dan validasi semua input pengguna.

Performa: Hindari re-render atau looping yang tidak perlu. Optimalkan kueri database, dan gunakan caching jika dirasa tepat.

Pengujian: Tulis kode yang dapat diuji, tambahkan penanganan kesalahan (error handling) dasar, dan catat log debug yang bermakna.

📚 Strategi Memori & Dokumentasi
Gunakan file proyek sebagai memori jangka panjang:

README.md → gambaran umum proyek

agents.md → aturan operasional (file ini)

changelog.txt → riwayat pembaruan & pelacakan error

docs/ → dokumentasi terperinci

Catatan: Tambahkan komentar pada kode hanya jika diperlukan untuk menjelaskan logika yang kompleks. Selalu perbarui README jika terjadi perubahan besar.

🚫 Hal yang Harus Dihindari
Rekayasa berlebihan (Overengineering).

Dependensi yang tidak perlu.

Mengabaikan pola (patterns) yang sudah ada di dalam proyek.

🛠️ Tech Stack Bawaan (Jika Tidak Disebutkan)
Frontend: React

Backend: Node.js (Express)

Database: Supabase (PostgreSQL)

Styling: Tailwind CSS v4

📋 FORMAT RESPONS WAJIB
Setiap kali mengeksekusi tugas atau memperbaiki bug, Anda WAJIB membalas menggunakan struktur format berikut:

🔍 [ROOT CAUSE / IMPACT ANALYSIS]
(Penjelasan mendalam tentang penyebab masalah dan dampak sistemnya)

💻 [CODE SOLUTION]
(Penjelasan langkah perbaikan)

[KODE YANG PERLU DI-UPLOAD / DIUBAH]: (Cuplikan kode spesifik yang diubah/ditambahkan)

🗑️ [CLEANUP INSTRUCTIONS]
(Daftar kode mati, variabel, atau dependensi yang harus dihapus)

🧪 [QA & EDGE CASES]
(Skenario pengujian dan kemungkinan kondisi tak terduga)

🏷️ [VERSION STATUS]
(Rekomendasi pembaruan versi SemVer, instruksi update UI versi, daftar perubahan file untuk GitHub, & update changelog)

---

🗺️ REPO-SPECIFIC CONTEXT (SPS Corner — Kantin Digital)

📦 Developer Commands
- `npm run dev` or `npm run start` → runs `tsx server.ts` (Express server that also serves the Vite-built frontend)
- `npm run build` → `vite build` (outputs to `dist/`)
- `npm run preview` → `vite preview`
- `npm run lint` → `tsc --noEmit` (type-check only, no emit)
- `npm run clean` → `rm -rf dist`
- No test framework configured — there is no `test` script in package.json

🏛️ Architecture
- **Monolithic single-file backend**: All Express routes live in `server.ts` (line 1+). It uses `// @ts-nocheck` — TypeScript errors are suppressed at runtime.
- **Vercel deployment (Frontend only)**: `api/index.ts` re-exports `server.ts` as default for Vercel serverless functions. `vercel.json` handles SPA rewrites (`/(.*)` → `/index.html`) and API routing (`/api/(.*)` → `https://api.spscorner.store/api/$1`).
- **VPS (Backend API)**: Express server runs on VPS `45.158.126.76` via PM2 (`sps-backend`). All `/api/*` requests from Vercel frontend are proxied to `https://api.spscorner.store` (the VPS).
- **Frontend entry**: `src/main.tsx` → `src/App.tsx` (React 19, lazy-loaded routes with retry logic for chunk errors).
- **State management**: Zustand stores in `src/store/` — `useAuthStore.ts` (auth + profile), `useCartStore.ts` (shopping cart).
- **Path alias**: `@/*` resolves to `./src/*` (tsconfig + vite.config.ts).
- **PWA**: `vite-plugin-pwa` with `injectManifest` strategy. Service worker source is `src/sw.ts`.

🔄 VPS DEPLOYMENT CHECKLIST (WAJIB diikuti setiap update backend)
Setiap kali ada perubahan di `server.ts`, WAJIB melakukan langkah berikut secara berurutan:

1. **SCP file yang diubah ke VPS:**
   ```bash
   scp server.ts root@45.158.126.76:/opt/sps-backend/server.ts
   scp src/pages/dashboard/seller/SellerProducts.tsx root@45.158.126.76:/opt/sps-backend/src/pages/dashboard/seller/
   # ...dan seterusnya untuk file lain yang berubah
   ```

2. **Install dependensi baru jika ada** (cek apakah ada import package baru di `server.ts`):
   ```bash
   ssh root@45.158.126.76 "cd /opt/sps-backend && npm install <package-name>"
   ```
   ⚠️ Frontend (Vercel) dan Backend (VPS) bisa tidak sinkron versi. Setiap ada dependency baru di `server.ts` (contoh: `@sentry/node`), VPS harus di `npm install` juga sebelum restart. Cek `package.json` + `package-lock.json` untuk melihat perubahan dependensi.

3. **Restart PM2:**
   ```bash
   ssh root@45.158.126.76 "pm2 restart sps-backend --update-env"
   ```

4. **Verifikasi server jalan:**
   ```bash
   curl -s https://api.spscorner.store/api/test-ping
   # Harus return JSON, BUKAN HTML
   ```

5. **Cek log error jika server tidak jalan:**
   ```bash
   ssh root@45.158.126.76 "pm2 logs sps-backend --lines 20 --nostream --err"
   ```

6. **Commit & push ke GitHub** (setelah deploy VPS berhasil) agar Vercel frontend juga terupdate.

> **💡 Alternatif:** Gunakan `.\scripts\deploy-vps.ps1` untuk deploy otomatis dalam satu perintah (lint → build → SCP → npm install → restart → verify).

🤖 CI/CD — Auto Deploy via VPS Cron (Git Pull)
Karena GitHub Actions terkendala billing, auto-deploy dihandle langsung oleh VPS:

| Komponen | Deskripsi |
|---|---|
| `scripts/auto-deploy.sh` | Script di VPS: `git fetch` → `git pull` → `npm install` (jika deps berubah) → `pm2 restart` → health check |
| Cron job | `*/5 * * * *` — jalan tiap 5 menit, cek commit baru dari GitHub |
| Log | `/var/log/sps-deploy.log` — riwayat deploy otomatis |

**Alur:** Push ke GitHub → cron deteksi commit baru dalam ≤5 menit → deploy otomatis ke VPS.

> **Alternatif deploy manual (langsung, tanpa nunggu cron):**
> ```powershell
> .\scripts\deploy-vps.ps1        # full deploy (lint + build + scp + restart)
> .\scripts\deploy-vps.ps1 -SkipLint   # skip type check
> .\scripts\deploy-vps.ps1 -SkipBuild -SkipLint  # SCP & restart saja
> ```

🔌 External Integrations (all configured via `.env`)
- **Supabase** (PostgreSQL): Primary database. Uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (client) and `SUPABASE_SERVICE_ROLE_KEY` (server). ⚠️ `server.ts` has hardcoded fallback credentials — these are security risks if leaked.
- **Digiflazz** (PPOB/digital products): Pulsa, PLN, e-wallet top-ups. Credentials: `DIGIFLAZZ_USERNAME`, `DIGIFLAZZ_API_KEY`. Price caching with 12h TTL to `os.tmpdir()`.
- **iPaymu** (payment gateway): Virtual account payments. Client in `src/services/ipaymu/`. Credentials: `IPAYMU_VA`, `IPAYMU_API_KEY`.
- **Gemini AI**: `GEMINI_API_KEY` — defined in vite.config.ts via `process.env.GEMINI_API_KEY` (not `VITE_` prefix).
- **Gmail SMTP**: `GMAIL_USER` + `GMAIL_APP_PASSWORD` for Sariroti order notifications and buyer receipts.
- **Web Push (VAPID)**: `VITE_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` for push notifications.
- **Fixie proxy** (optional): `FIXIE_URL` for static IP whitelisting with Digiflazz/iPaymu.

🗂️ Route Structure (App.tsx)
- `/` → Home
- `/kiosk/*` → Buyer flows: home (dashboard), catalog, cart, checkout, validate, success, history, profile, digital products, pre-order
- `/dashboard/admin/*` → Admin: sellers, categories, products, transactions, withdrawals, reports, settings, flashsale, doorprize, union programs, form builder, feedbacks, pengaduan, kritik-saran, loyalty, announcements, stock opname, pickup, payments, standby schedule, coupon reports, scanner
- `/dashboard/seller/*` → Seller: dashboard, products, pre-orders, withdrawals, transactions
- `/portal/*` → Union portal: dashboard, programs, flashsale, announcements, pengaduan, kritik, profile, forms

⚠️ Gotchas & Quirks
- `server.ts` uses `// @ts-nocheck` — TypeScript will not catch errors in the backend. Run `tsc --noEmit` separately to check types.
- `.npmrc` has `legacy-peer-deps=true` — peer dependency conflicts are expected and ignored.
- `tsconfig.json` uses `allowImportingTsExtensions: true` — `.ts` extensions required in imports.
- Current version: `v4.19.0`. Always sync `package.json`, `changelog.txt`, and UI on version bumps.
- `scripts/` directory may contain utility scripts — check before assuming dead code.
- CI/CD via VPS cron (git pull otomatis tiap 5 menit). Detail di section 🤖 CI/CD.
- ⚠️ GitHub Actions terkendala billing. Alternatif: `.\scripts\deploy-vps.ps1` untuk deploy manual.
- Vite defines `process.env.GEMINI_API_KEY` directly (not `VITE_` prefix) — this is non-standard and easy to miss.
- Digiflazz background cache update is skipped on Vercel (`if (!process.env.VERCEL)`).
- **⚠️ API 404 catch-all di `server.ts`**: Wajib ada `app.use('/api/*', (req, res) => res.status(404).json({ error: 'API endpoint not found' }))` SEBELUM SPA fallback (`app.get("*")`). Tanpa ini, request API yang tidak terdaftar mengembalikan HTML (index.html) → frontend error `"Unexpected token '<'"`.
- **⚠️ `@sentry/node` sering missing di VPS**: Setiap ada update `server.ts`, cek apakah ada import package baru (contoh: `@sentry/node`). Frontend (Vercel) dan Backend (VPS) tidak sinkron versi — dependency baru di `server.ts` harus di `npm install` di VPS sebelum restart PM2. Cek `package.json` + `package-lock.json` untuk melihat perubahan dependensi.

🗑️ Known Dead Code Candidates (verify before deleting)
- `fix_*.sql` files — one-time SQL fixes
- `revert_incorrect_patches.cjs` — rollback script, likely no longer needed
- ~~`push_to_github.bat`~~ — **sudah dihapus**, ganti dengan `scripts/deploy-vps.ps1`
- `Perbaikan program/` directory — unclear purpose, verify contents
- `session-ses_1c94.md` — session log, likely temporary
- `walkthrough.md` — documentation, verify if still relevant
- `supabase-schema.sql` — schema dump, verify if it matches current Supabase state
- `flashsale_setup.sql`, `reports_setup.sql` — one-time setup scripts
