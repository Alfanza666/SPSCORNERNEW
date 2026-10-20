# DOKUMENTASI WAJIB (dari AGENTS.md)

## 1. Format Dokumentasi CAPA (per insiden/bug yang diselesaikan)
Disimpan di `docs/CAPA-v[versi].md`, dengan struktur wajib:
1. **Ringkasan Insiden** — tabel: Insiden, Dampak, Kerugian, Durasi, Status.
2. **Root Cause Analysis (RCA)** — tabel per bug: Apa yang terjadi, Error, Lokasi (file:line), Mekanisme, Kenapa bisa terjadi.
3. **Korektif** — tabel File → Perubahan.
4. **Pencegahan** — tabel Layer → Komponen → Mekanisme.
5. **Pencegahan Masa Depan — Rules Baru** — ❌ LARANGAN / ✅ PERINTAH.
6. **Verifikasi & Testing** — tabel # / Skenario / Expected Result / Status.
7. **Dokumen Terkait** — tabel Dokumen → Lokasi.

## 2. Standar Penulisan
- Gunakan tabel Markdown, bukan list, untuk data terstruktur.
- Sertakan file path + line number di setiap referensi kode.
- Urutan: umum → spesifik (Insiden → RCA → Fix → Prevention → Testing).
- Harus rapi & bisa dipahami non-teknis.
- Selalu sertakan link ke dokumen terkait (CAPA, changelog, AGENTS.md).

## 3. Kewajiban Indeks & Registrasi Dokumen
Setiap CAPA document wajib:
- Disimpan di `docs/CAPA-v[versi].md`.
- Dirujuk di `changelog.txt`.
- Di-list di bagian **Gotchas** pada `AGENTS.md`.

## 4. Changelog
- `changelog.txt` wajib dicatat setiap pembaruan.
- Format: `v[versi] - [Judul] ([TIPE])` + daftar perubahan.

## 5. Dokumen yang Sudah Ada (Documentation Index Existing)
| Dokumen | Lokasi | Isi |
|---|---|---|
| Audit v6.2.0 | `docs/AUDIT-v6.2.0.md` | Audit menyeluruh sistem + UI/UX: 61 temuan (7 kritis, 19 mayor, 35 minor), rules baru CODE-006..009 & UI-004..008 |
| CAPA v5.16.2 | `docs/CAPA-v5.16.2.md` | PostgREST crash fix + auto-reconcile |
| CAPA v5.16.5 | `docs/CAPA-v5.16.5.md` | Auth intermittent, safe failover VPS/Vercel/Fixie, payment integrity, notification mobile, deployment drift |
| CAPA v5.16.6 | `docs/CAPA-v5.16.6.md` | Safari/WebKit payment upload hotfix, pencegahan Request body stream |
| CAPA v5.16.7 | `docs/CAPA-v5.16.7.md` | Double payment loyalty point, point refund on cancel, points pay race condition |
| CAPA v6.0.5 | `docs/CAPA-v6.0.5.md` | iPaymu callback ReferenceError, transaksi paid tersangkut pending |
| CAPA v6.0.6 | `docs/CAPA-v6.0.6.md` | Ganti metode pembayaran meninggalkan transaksi pending |
| CAPA v6.0.7 | `docs/CAPA-v6.0.7.md` | Audit selisih stok seller, pengamanan workflow stok |
| CAPA v6.0.8 | `docs/CAPA-v6.0.8.md` | Restore backend ke VPS baru, cutover origin |
| CAPA v6.0.12 | `docs/CAPA-v6.0.12.md` | QRIS manual AI verification, reject vs AI outage, penyimpanan bukti |
| Implementation Plan v5.16.5 | `docs/IMPLEMENTATION-PLAN-v5.16.5.md` | Scope, impact, QA gates, execution record, rollback |
| Reconciliation SQL | `scripts/reconcile_fn.sql` | DB function deteksi mismatch |
| Deploy Script | `scripts/deploy-vps.ps1` | Deploy otomatis ke VPS |
| Changelog | `changelog.txt` | Riwayat pembaruan |

> Catatan: beberapa referensi Gotchas menyebut `docs/AUDIT-v5.16.2.md` (temuan C02, C04-C06, C13, C14) — dokumen ini belum tercantum di tabel Documentation Index asli, perlu ditambahkan agar konsisten.
