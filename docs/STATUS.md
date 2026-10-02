# Status Infrastruktur & Operasional Saat Ini

> ⚠️ Isi file ini adalah **kondisi saat ini**, bukan rule permanen. Bisa berubah — cek ulang saat deploy atau saat ada laporan mencurigakan. Terakhir diverifikasi: lihat `changelog.txt` versi terbaru.

| Item | Status Saat Ini | Catatan |
|---|---|---|
| Origin production | `103.193.179.217` | IP lama `45.158.126.76` **tidak boleh** dipakai lagi tanpa verifikasi eksplisit. Jika migrasi IP terjadi, update Cloudflare Worker, iPaymu whitelist, deploy script, dan PM2 host secara konsisten. |
| CI/CD | GitHub Actions terkendala billing | Alternatif: `.\scripts\deploy-vps.ps1` (lint → build → SCP → restart → verify). Auto-deploy tetap jalan via VPS cron `*/5 * * * *` (`scripts/auto-deploy.sh`). |
| Dependency check | `@sentry/node` sering hilang di VPS | Cek dependency baru setiap kali update `server.ts`. |
| Digiflazz background cache | Di-skip di Vercel | Guard: `if (!process.env.VERCEL)`. |
| Versi proyek saat ini | `v6.0.23` | Sinkronkan dengan `package.json` + `changelog.txt` + UI (5 lokasi — lihat tabel di `AGENTS.md` § VER). |

## Catatan Environment (jarang berubah, tapi bukan "rule")
- `server.ts` pakai `// @ts-nocheck` — TypeScript tidak menangkap error backend.
- `.npmrc` punya `legacy-peer-deps=true`.
- `tsconfig.json`: `allowImportingTsExtensions: true` — ekstensi `.ts` wajib disertakan saat import.
- `scripts/` mungkin berisi utility scripts aktif — cek dulu sebelum asumsi dead code.

## Dead Code Candidates (perlu verifikasi sebelum hapus)
| File | Catatan |
|---|---|
| `supabase-schema.sql` | Masih dirujuk oleh `AdminSellers.tsx` & `Register.tsx`. |
| `AdminScanner.tsx` (root) | Duplikat, tidak di-import `src/App.tsx`. Hapus pada cleanup terpisah setelah pastikan tidak ada consumer eksternal. |
