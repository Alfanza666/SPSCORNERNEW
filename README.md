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
