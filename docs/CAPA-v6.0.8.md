# Restore Backend ke VPS Baru — v6.0.8

## 1. RINGKASAN INSIDEN
| Item | Keterangan |
|------|-----------|
| Insiden | VPS backend lama `45.158.126.76` tidak tersedia; backend production perlu dipulihkan pada VPS baru. |
| Dampak | API, callback iPaymu, job rekonsiliasi, notifikasi, dan layanan Digiflazz tidak dapat bergantung pada VPS lama. |
| Kerugian | Risiko downtime transaksi dan callback tertunda; data utama tetap berada di Supabase. |
| Durasi | Migrasi darurat, mulai saat VPS lama dikonfirmasi mati. |
| Status | MONITORING: backend baru, DNS API, dan HTTPS production sudah aktif; lanjut smoke test pembayaran. |

## 2. ROOT CAUSE ANALYSIS (RCA)
### 2.1 Origin VPS tidak tersedia
| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Host backend lama tidak dapat digunakan. |
| Error | Tidak ada akses runtime ke VPS lama; detail provider belum tersedia. |
| Lokasi | `workers/failover.js`, `scripts/deploy-vps.ps1`, `scripts/deploy-vps.bat`, dan konfigurasi iPaymu. |
| Mekanisme | Worker dan script deploy masih menunjuk ke `45.158.126.76`. |
| Kenapa bisa terjadi | Origin IP sebelumnya tertanam di beberapa konfigurasi operasional dan whitelist provider. |

## 3. KOREKTIF (APA YANG DIPERBAIKI)
| File | Perubahan |
|------|-----------|
| `workers/failover.js` | Origin VPS diarahkan ke `103.193.179.217`; request mutating tidak di-replay setelah origin dicoba. |
| `scripts/deploy-vps.ps1` | Default host deploy diarahkan ke VPS baru dan dapat dioverride dengan `-VpsHost`. |
| `scripts/deploy-vps.bat` | Host deploy diarahkan ke VPS baru. |
| `package.json` dan UI | Versi dinaikkan ke `6.0.8`. |

## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)
| Layer | Komponen | Mekanisme |
|-------|----------|-----------|
| Routing | Cloudflare Worker | GET/HEAD boleh fallback; POST/PUT/PATCH/DELETE tidak blind replay setelah origin dicoba. |
| Payment | iPaymu | IP baru wajib di-whitelist sebelum transaksi production. |
| Deployment | Script PowerShell | Host dapat ditentukan eksplisit dengan `-VpsHost`. |
| Runtime | PM2 | Process `sps-backend` dan background jobs wajib aktif pada satu VPS primary. |

## 5. PENCEGAHAN MASA DEPAN — RULES BARU
❌ **LARANGAN:** Menyisakan IP origin production lama di Worker, script deploy, atau whitelist provider setelah cutover.

✅ **PERINTAH:** Setiap pergantian VPS wajib mengubah origin routing, host deploy, whitelist iPaymu, environment runtime, dan dokumen operasional dalam satu checklist cutover.

## 6. VERIFIKASI & TESTING
| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | `curl http://127.0.0.1:3000/api/test-ping` pada VPS baru | JSON `status=ok`, `runtime=vps` | PASS |
| 2 | `curl https://api.spscorner.store/api/test-ping` setelah DNS cutover | HTTP 200 dan runtime `vps` | PASS |
| 3 | Payment iPaymu sandbox/nominal kecil | Tidak `Invalid IP`/`Unauthorized`; transport `direct` | PENDING |
| 4 | Callback iPaymu | Callback masuk ke VPS baru dan transaksi direkonsiliasi | PENDING |
| 5 | Worker origin timeout pada GET | GET fallback ke Vercel | NOT RUN (production memakai DNS direct) |
| 6 | Worker origin timeout setelah POST dicoba | Tidak ada replay ke Vercel; response uncertain/502 | NOT RUN (production memakai DNS direct) |
| 7 | PM2 restart dan reboot VPS | `sps-backend` kembali online; job background aktif | PASS (PM2 startup enabled) |

Untuk first boot sebelum Worker Cloudflare dipublish, jalankan script dengan
`-HealthUrl http://103.193.179.217:3000/api/test-ping`. Setelah Worker aktif,
gunakan health URL default untuk memverifikasi routing production.

### Execution Record — 25 Agustus 2026

| Pemeriksaan | Hasil |
|-------------|-------|
| VPS | Ubuntu 24.04, Node.js 22.23.2, PM2 online |
| Backend direct | `http://103.193.179.217:3000/api/test-ping` HTTP 200, `runtime=vps`, `ipaymuTransport=direct` |
| Nginx | Reverse proxy port 80 ke Node port 3000, konfigurasi valid |
| Swap | 2 GiB aktif |
| Security | UFW aktif, Fail2ban aktif, root password login dinonaktifkan, SSH key aktif |
| `.env` | Permission `600`, tidak dicetak ke log |
| DNS | `api.spscorner.store` resolve ke `103.193.179.217` melalui Vercel DNS |
| HTTPS | Let’s Encrypt valid sampai 2026-11-23; HTTP redirect ke HTTPS aktif |
| Provider disk | Panel menunjukkan Root Disk 60 GB; OS saat ini melihat block device 25 GB dan filesystem 24 GB, sehingga perlu resize dari panel/provider bila kapasitas penuh diperlukan |

## 7. DOKUMEN TERKAIT
| Dokumen | Lokasi |
|---------|--------|
| Deployment script | `scripts/deploy-vps.ps1` |
| Cloudflare Worker | `workers/failover.js` |
| Environment template | `.env.example` |
| Operational rules | `AGENTS.md` |
| Changelog | `changelog.txt` |
