# SPS Corner — Kantin Digital

Sistem kasir digital untuk Koperasi Karyawan SPS Corner. Melayani pembelian produk kantin, koperasi, digital (pulsa/PLN/e-wallet), dan pre-order.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS v4 |
| Backend | Express (Node.js), TypeScript |
| Database | Supabase (PostgreSQL) |
| State | Zustand 5 |
| Payment | iPaymu (VA) |
| PWA | vite-plugin-pwa + Workbox |
| AI | Google Gemini |
| Deploy | Vercel (frontend) + VPS/PM2 (backend API) |

## Development

```bash
# Install dependencies
npm install

# Start dev server (Express + Vite)
npm run dev

# Type check
npm run lint

# Run tests
npm test

# Build for production
npm run build
```

## Environment Variables

Salin `.env.example` ke `.env` dan isi kredensial yang diperlukan:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Deskripsi |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side) |
| `VITE_SUPABASE_ANON_KEY` | Anon key (client-side) |
| `DIGIFLAZZ_USERNAME` | Digiflazz username |
| `DIGIFLAZZ_API_KEY` | Digiflazz API key |
| `IPAYMU_VA` | iPaymu virtual account |
| `IPAYMU_API_KEY` | iPaymu API key |
| `GMAIL_USER` | Gmail SMTP email |
| `GMAIL_APP_PASSWORD` | Gmail App Password |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key (Web Push) |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `GEMINI_API_KEY` | Google Gemini API key |

## Form Studio & Event Workflow

`implementation-plan.md` adalah sumber keputusan produk dan engineering untuk target
Employee Gathering v5.9.0. `task.md` menyimpan status implementasi dan bukti
verifikasi. Dokumen V2 berikut dipertahankan sebagai riwayat implementasi v5.8.x:

- `docs/form-studio-v2-review-handoff.md`
- `docs/form-workflow-v2-schema.md`

Form Studio menyediakan builder tiga area (palette, canvas, inspector), AI schema
execution, conditional branches, terminal outcomes, pricing, serta renderer yang
digunakan bersama oleh preview dan portal. Template Employee Gathering v5.9 hanya
menyimpan **jumlah anggota keluarga**; nama atau identitas anggota keluarga tidak
dikumpulkan.

Workflow program RSVP menggunakan backend server-authoritative:

- penerima dipreview dari filter admin dan dibekukan sebagai snapshot saat publish;
- browser hanya mengirim jawaban dan bukti pembayaran, bukan identitas atau total tepercaya;
- server mengambil identitas/NIK dari sesi, memvalidasi eligibility/deadline, menghitung ulang harga, dan menyimpan snapshot audit;
- pembayaran manual mendukung transfer bank dan QRIS;
- RSVP hadir langsung mengaktifkan QR attendance dan meal karyawan, walaupun biaya tambahan masih pending;
- setiap anggota keluarga mendapat QR attendance dan meal terpisah setelah pembayaran paket keluarga disetujui;
- scan attendance karyawan, bukan scan meal atau keluarga, menjadi sumber eligibility doorprize.

Migration `006_program_registration_workflow_v2.sql` adalah fondasi historis v5.8
dan tidak boleh dianggap cukup untuk mengaktifkan workflow v5.9 di production.
Urutan aktivasi wajib:

1. backup dan audit schema production;
2. jalankan migration v5.9 yang idempotent di staging, termasuk rerun;
3. verifikasi constraint, RLS, RPC, dan kompatibilitas jalur legacy;
4. jalankan acceptance test pada satu program pilot;
5. terapkan migration production hanya dengan approval dan rollback point;
6. deploy backend, verifikasi health JSON/PM2 log, lalu deploy dan smoke-test frontend.

Jangan menjalankan migration production hanya berdasarkan README. Gunakan kontrak
dan status terbaru di `implementation-plan.md` serta `task.md`.

## Project Structure

```
src/
├── pages/           # Halaman berdasarkan domain
│   ├── kiosk/       # Buyer flow
│   ├── dashboard/   # Admin & Seller dashboard
│   ├── portal/      # Portal serikat pekerja
│   └── auth/        # Auth pages
├── components/      # UI komponen reusable
├── store/           # Zustand state management
├── services/        # External services (iPaymu)
├── middleware/      # Express auth middleware
├── routes/          # Modular Express route files
├── lib/             # Utilities & client config
└── hooks/           # Custom React hooks

server.ts            # Express composition root / server bootstrap
api/index.ts         # Vercel compatibility entry
```

Backend business routes berada di `src/routes/` dan logic domain bertahap
diisolasi di `src/services/`. `server.ts` memasang middleware, route modules, API
404 JSON, dan frontend fallback.

## Deployment

- Frontend production di-host di Vercel.
- Backend API berjalan di VPS melalui PM2 process `sps-backend` dan diakses melalui
  `https://api.spscorner.store`.
- Vercel meneruskan request `/api/*` ke backend tersebut.
- Supabase migration merupakan tahap terpisah dan tidak dijalankan oleh script
  deploy VPS.

Untuk perubahan backend, jalankan `npm run lint`, `npm test`, dan `npm run build`
sebelum `scripts/deploy-vps.ps1`. Script tersebut membantu SCP, dependency sync,
restart PM2, dan health check, tetapi tidak menggantikan backup/migration staging,
pengujian manual, pemeriksaan response JSON, commit/push, atau verifikasi Vercel.

## Versioning

Versi mengikuti [SemVer](https://semver.org/). Lihat `changelog.txt` untuk riwayat perubahan.
