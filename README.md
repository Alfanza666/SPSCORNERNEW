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
| Deploy | Vercel (serverless) |

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

## Form Studio & Program Workflow V2

Dokumen review dan handoff lintas-agent:

```text
docs/form-studio-v2-review-handoff.md
```

Form Studio v2 menyediakan builder tiga area (palette, canvas, inspector), AI schema execution, conditional branches, terminal outcomes, pricing, repeater anggota keluarga, serta pengalaman Card Form premium yang sama pada preview dan portal.

Workflow program RSVP menggunakan backend server-authoritative:

- browser hanya mengirim jawaban dan bukti pembayaran;
- server mengambil identitas/NIK dari sesi, menghitung ulang harga, dan menyimpan snapshot audit;
- pembayaran manual mendukung transfer bank dan QRIS;
- QR attendance dan meal diterbitkan terpisah untuk karyawan serta setiap anggota keluarga;
- seluruh entitlement berbayar ditahan sampai admin menyetujui bukti.

Sebelum mengaktifkan workflow di production, jalankan migration berikut melalui Supabase SQL Editor:

```text
database/migrations/006_program_registration_workflow_v2.sql
```

Rancangan tabel, RLS, compatibility, serta urutan rollout dijelaskan di `docs/form-workflow-v2-schema.md`.

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

server.ts            # Express backend (monolith)
api/index.ts         # Vercel serverless entry
```

## Versioning

Versi mengikuti [SemVer](https://semver.org/). Lihat `changelog.txt` untuk riwayat perubahan.
