# Implementation Plan v5.16.5 — Safe Failover, iPaymu, Auth, dan Notifikasi Mobile

> **Status:** APPROVED, EXECUTED, AND DEPLOYED — MONITORING
> **Runtime change:** Implementasi mengikuti scope minimum; tidak ada migration atau dependency baru
> **Target version setelah seluruh gate lulus:** v5.16.5 PATCH
> **Prinsip:** Perbaiki hanya yang terbukti perlu. Tidak melakukan refactor besar.

## 1. TUJUAN

| Tujuan | Hasil yang diharapkan |
|--------|-----------------------|
| Mempertahankan arsitektur existing | VPS tetap primary; Vercel + Fixie tetap fallback |
| Mengamankan failover | Request baca dapat fallback; request mutasi/payment tidak blind replay |
| Memulihkan iPaymu | VPS memakai IP tetap langsung; Vercel memakai Fixie static egress |
| Menstabilkan auth | Zustand dan Supabase session tetap sinkron |
| Memulihkan bell mobile | Memastikan fix existing benar-benar aktif sebelum mengubah CSS lagi |
| Menjaga zero regression | Stock, balance, points, callback, program payment, dan database schema tidak disentuh tanpa bukti kebutuhan |

## 2. KONDISI KODE SAAT INI

| Komponen | Kondisi |
|----------|---------|
| `src/main.tsx` | Memanggil `patchGlobalFetch()` saat aplikasi dimulai |
| `src/lib/api.ts` | Health-check VPS, cache keputusan 30 detik, lalu fallback ke relative path/Vercel |
| GET/POST API frontend | Mayoritas memakai `/api/...` dan diintersep global wrapper |
| Mutating request | Saat primary network error/HTTP 5xx, dapat dikirim lagi ke fallback |
| iPaymu VPS | Direct IPv4 melalui IP tetap VPS |
| iPaymu Vercel | Direct-first, kemudian retry Fixie pada error tertentu jika `FIXIE_URL` tersedia |
| Auth frontend | Semua auth event setelah initial load diabaikan |
| Notification fix | Perubahan overflow sudah ada di repo, tetapi deployment/cache mobile belum terbukti |
| VPS Git | Worktree drift; tidak aman dibersihkan bersama hotfix |

## 3. BATAS PERUBAHAN

### 3.1 Wajib diperbaiki pada hotfix awal

| Prioritas | Perbaikan | Alasan |
|-----------|-----------|--------|
| P0 | Hentikan blind replay mutating request lintas VPS/Vercel | Mencegah payment/mutation ganda |
| P0 | Pastikan iPaymu dari Vercel memakai Fixie sejak request pertama | Menghindari Invalid IP dari dynamic egress Vercel |
| P0 | Validasi ownership, status, dan amount transaksi di server | Endpoint payment saat ini terlalu percaya request client |
| P0 | Tangani payment failure/ambiguous result tanpa membuat transaksi baru | Mencegah pending/orphan dan retry berbahaya |
| P1 | Sinkronkan auth event secara selektif | Mengurangi Unauthorized dan logout yang tampak acak |
| P1 | Bedakan invalid token dari Supabase timeout | Mencegah Unauthorized palsu |
| P2 | Verifikasi deployment/cache notification fix | Jangan mengubah CSS bila akar masalah hanya bundle stale |

### 3.2 Bukan scope hotfix awal

| Tidak dikerjakan | Alasan |
|------------------|--------|
| Rewrite seluruh `fetch()` menjadi helper baru | Terlalu luas dan berisiko regresi |
| Menghapus `patchGlobalFetch()` | Arsitektur primary/fallback sudah bergantung padanya |
| Service/gateway baru | Over-engineering |
| Dependency baru | Tidak diperlukan |
| Database migration baru | Belum diperlukan untuk corrective patch awal |
| Mengubah callback settlement, stock, balance, atau points | Jalur tersebut sensitif dan tidak menjadi akar error routing/auth saat ini |
| Rewrite service worker/PWA | Hanya dilakukan jika bukti menunjukkan cache update rusak |
| Membersihkan VPS dengan reset/delete | Berisiko menghapus hotfix manual |
| Refactor `server.ts` | Tidak diperlukan untuk hotfix |

## 4. DESAIN MINIMUM YANG DISETUJUI

### 4.1 Keputusan routing

```text
Sebelum request dikirim:
  VPS healthy  → pilih VPS
  VPS unhealthy → pilih Vercel

Setelah mutating request sudah dikirim:
  Response sukses → selesai
  Response 4xx    → kembalikan error asli, jangan fallback
  Response 5xx    → jangan replay otomatis
  Network timeout → status ambiguous, jangan replay otomatis
```

| Jenis request | Auto fallback | Catatan |
|---------------|---------------|---------|
| GET / HEAD | Boleh | Tidak mengubah state |
| POST / PUT / PATCH / DELETE | Tidak setelah primary dicoba | Hindari double mutation |
| Payment create/direct | Tidak setelah request dikirim | Gunakan `transaction_id/referenceId` untuk verifikasi |
| Callback iPaymu | Tidak memakai frontend failover | Provider mengirim ke callback URL yang ditentukan |

### 4.2 Keputusan iPaymu egress

| Runtime | Transport |
|---------|-----------|
| VPS | Direct IPv4 melalui `45.158.126.76` |
| Vercel + `FIXIE_URL` valid | Fixie sejak request pertama |
| Vercel tanpa `FIXIE_URL` | Fail fast HTTP 503; jangan mencoba dynamic direct egress |

### 4.3 Keputusan auth

| Auth event | Perilaku |
|------------|----------|
| `INITIAL_SESSION` | Set/fetch profil sekali |
| `SIGNED_IN` | Fetch profil hanya jika user berbeda atau store kosong |
| `TOKEN_REFRESHED` | Pertahankan user; jangan fetch profil berulang |
| `USER_UPDATED` | Refresh profil secara terkontrol |
| `SIGNED_OUT` | Bersihkan store dan arahkan login melalui route guard |
| Upstream Auth timeout | Jangan dianggap invalid credentials; balas 503 |

## 5. RENCANA PERUBAHAN PER FILE

### 5.1 Patch A — Safe API failover

| Item | Detail |
|------|--------|
| File | `src/lib/api.ts` |
| Perubahan | Pertahankan global wrapper; cek `healthResponse.ok`; tentukan HTTP method; hanya GET/HEAD yang boleh replay ke fallback setelah primary gagal |
| Tidak diubah | `PRIMARY_API`, konsep TTL, dan relative Vercel fallback |
| Untuk apa | Menjaga failover tanpa menggandakan POST |
| Impact | Mutating request tidak otomatis tersedia lewat fallback jika kegagalan terjadi setelah request dikirim—ini disengaja demi konsistensi |
| Jika tidak dikerjakan | Payment/admin action dapat diproses dua kali |
| Rollback | Revert satu file |

Acceptance criteria:

| Skenario | Expected |
|----------|----------|
| VPS health 200 | Request menuju VPS |
| VPS health timeout sebelum GET | GET menuju Vercel |
| VPS GET menghasilkan 500 | GET boleh mencoba Vercel |
| VPS POST menghasilkan 500 | Respons/error dikembalikan; tidak ada request kedua |
| VPS POST network timeout | Error ambiguous; tidak ada request kedua |

### 5.2 Patch B — Static egress iPaymu di Vercel

| Item | Detail |
|------|--------|
| File | `server.ts`, `src/services/ipaymu/client.ts` |
| Perubahan | Pass runtime mode ke client; pada Vercel gunakan Fixie agent sejak request pertama; pada VPS pertahankan direct IPv4 |
| Guard | Jika runtime Vercel tetapi `FIXIE_URL` kosong, payment endpoint gagal sebelum menghubungi iPaymu |
| Logging | Hanya `runtime=vps/vercel` dan `transport=direct/fixie`; jangan log proxy URL, key, token, atau credential |
| Untuk apa | Menjamin IP yang dilihat iPaymu sesuai whitelist |
| Impact | Fallback payment bergantung secara eksplisit pada Fixie, sesuai desain awal |
| Jika tidak dikerjakan | Invalid IP/Unauthorized dapat berulang ketika traffic fallback ke Vercel |
| Rollback | Revert client wiring; VPS path tidak berubah |

Precondition:

| Pemeriksaan | Wajib |
|-------------|-------|
| `FIXIE_URL` tersedia di Vercel | Ya, tanpa menampilkan nilainya |
| Static IP Fixie sudah di-whitelist iPaymu | Ya |
| IP VPS `45.158.126.76` masih di-whitelist | Ya |

### 5.3 Patch C — Payment request integrity

| Item | Detail |
|------|--------|
| File | `src/routes/payments.ts` |
| Endpoint | `/api/payment/ipaymu/create` dan `/api/payment/ipaymu/direct` |
| Perubahan | Setelah auth, baca transaksi dari database; verifikasi `buyer_id`, status pending, metode payment, dan existing iPaymu reference |
| Amount | Gunakan `total_amount` dari database; jangan percaya `amount` dari body |
| Duplicate guard | Jika `payment_details.ipaymu_trx_id` sudah ada, jangan membuat gateway request baru |
| Tidak diubah | Callback paid flow, stock deduction, seller settlement, buyer points |
| Untuk apa | Mencegah user membuat payment untuk transaksi lain atau amount berbeda |
| Impact | Request client invalid akan ditolak lebih awal |
| Jika tidak dikerjakan | Ada risiko IDOR/integrity mismatch dan payment session duplikat |
| Rollback | Revert dua handler payment saja |

### 5.4 Patch D — Checkout failure state

| Item | Detail |
|------|--------|
| File | `src/pages/kiosk/Checkout.tsx` |
| Perubahan | Pertahankan `isCreatingTx`; bedakan definitive failure dan ambiguous failure |
| Definitive failure | Request terbukti ditolak sebelum payment dibuat; lock boleh dipulihkan |
| Ambiguous failure | Timeout/5xx setelah request dikirim; jangan membuat transaksi/payment baru; tampilkan pesan cek Riwayat/hubungi admin |
| Tidak dibuat | State machine/library baru |
| Untuk apa | Mencegah user blind retry |
| Impact | Pada kegagalan ambigu, UX lebih konservatif tetapi finansial lebih aman |
| Jika tidak dikerjakan | Pending transaction, lock tidak jelas, atau retry ganda terus terjadi |
| Rollback | Revert handler Checkout |

### 5.5 Patch E — Auth lifecycle synchronization

| Item | Detail |
|------|--------|
| File | `src/App.tsx`, `src/store/useAuthStore.ts` bila benar-benar diperlukan |
| Perubahan | Hapus early return global; proses event berdasarkan jenis; fetch profil hanya jika diperlukan |
| Tidak diubah | Supabase storage format, login form, OAuth flow, RLS |
| Untuk apa | Menyatukan sesi SDK dan profil Zustand |
| Impact | Token refresh tidak memicu reload/fetch profil berulang; sign-out valid tetap tersinkron |
| Jika tidak dikerjakan | UI dapat menganggap login saat API menolak token |
| Rollback | Revert effect auth |

### 5.6 Patch F — Auth error classification

| Item | Detail |
|------|--------|
| File | `src/middleware/auth.ts`, helper auth di `src/routes/payments.ts` |
| Perubahan | Invalid/missing token → 401; Supabase network/timeout → 503; unexpected error → 500 |
| Logging | Error type + route, tanpa bearer token/PII |
| Untuk apa | Membedakan masalah user dan masalah dependency |
| Impact | Frontend tidak selalu menampilkan Unauthorized untuk gangguan sementara |
| Jika tidak dikerjakan | User terus dipaksa login ulang pada timeout upstream |
| Rollback | Revert middleware/helper |

### 5.7 Patch G — Notification mobile

| Tahap | Tindakan |
|-------|----------|
| 1 | Cocokkan commit/bundle Vercel dengan source yang memiliki fix `overflow` |
| 2 | Uji authenticated viewport 301×663, 360×800, 390×844, dan desktop |
| 3 | Periksa hit target dan element at point pada tombol bell |
| 4 | Jika bundle stale, redeploy tanpa perubahan CSS |
| 5 | Hanya jika bug tetap reproducible pada bundle terbaru, buat satu perubahan CSS/stacking yang paling kecil |

| Item | Detail |
|------|--------|
| File potensial | `src/pages/dashboard/DashboardLayout.tsx`, `src/pages/dashboard/PortalLayout.tsx` |
| Untuk apa | Memastikan akar masalah deployment/cache atau layout |
| Impact | Tidak menambah patch CSS bila sebenarnya tidak diperlukan |
| Jika tidak dikerjakan | Bell mobile tetap tidak dapat digunakan |
| Rollback | Revert maksimal satu perubahan layout |

## 6. URUTAN EKSEKUSI DAN APPROVAL GATE

| Gate | Pekerjaan | Output untuk direview | Boleh lanjut jika |
|------|-----------|-----------------------|-------------------|
| G0 | Baseline read-only | Hash, health, current deploy, daftar file dirty VPS | Bukti tersimpan |
| G1 | Verifikasi Fixie/iPaymu | Status SET/UNSET dan kecocokan whitelist, tanpa secret | Kedua static IP valid |
| G2 | Patch A–D payment | Diff terbatas pada failover/iPaymu/payment/Checkout + tests | User menyetujui diff dan QA lokal lulus |
| G3 | Deploy payment terkontrol | Satu smoke payment dengan reference unik | Tidak ada duplicate dan callback normal |
| G4 | Patch E–F auth | Diff auth terpisah + lifecycle tests | Login/refresh/logout lulus |
| G5 | Notification verification | Bukti bundle + hasil mobile/desktop | Edit UI hanya bila masih reproducible |
| G6 | Release v5.16.5 | Lint, test, build, changelog, UI versions | Semua gate lulus |
| G7 | VPS reconciliation terpisah | Backup + diff manual vs Git | Persetujuan eksplisit sebelum cleanup |

**Stop condition:** Jika satu gate gagal, berhenti. Jangan menumpuk fix baru di atas hasil yang belum stabil.

## 7. TEST PLAN

### 7.1 Automated tests yang harus ditambah

| Test | Fokus |
|------|-------|
| `src/test/apiFailover.test.ts` | GET fallback dan larangan POST replay |
| Payment route tests | Ownership, DB amount, duplicate iPaymu reference, Vercel-without-Fixie guard |
| Auth lifecycle component/store tests | `INITIAL_SESSION`, `TOKEN_REFRESHED`, `SIGNED_OUT` |
| Auth middleware tests | 401 vs 503 vs 500 |

Tidak membuat test framework baru; repo sudah mempunyai Vitest.

### 7.2 Commands

```text
npm run lint
npm run test
npm run build
```

### 7.3 Manual zero-regression checklist

| Area | Skenario |
|------|----------|
| Login | NIK/password dan Google |
| Session | Refresh halaman, tab background/foreground, token refresh |
| Dashboard | Admin dan seller overview |
| Payment | iPaymu direct/redirect, manual QRIS, transfer koperasi, points full/partial |
| Callback | pending → paid, duplicate callback |
| Ledger | Stock, seller balance, buyer points tetap satu kali |
| Notification | Bell dashboard/portal mobile dan desktop |
| Fallback | VPS available dan simulated unavailable |
| PWA | Existing install dan fresh browser |

## 8. OBSERVABILITY MINIMUM

Log baru hanya untuk kejadian kritis:

```text
[ApiFailover] target=vps|vercel method=GET|POST path=/api/... reason=health|primary_error
[iPaymu] runtime=vps|vercel transport=direct|fixie reference_id=<uuid>
[Auth] result=invalid_token|upstream_timeout route=/api/...
```

Larangan:

- Jangan log bearer token.
- Jangan log API key, Fixie URL, proxy credential, email, telepon, atau receipt.
- Jangan membuat dashboard monitoring baru pada hotfix ini.

## 9. ROLLBACK

| Deploy | Rollback |
|--------|----------|
| Payment | Revert Patch A–D sebagai satu commit; callback/DB tidak berubah |
| Auth | Revert Patch E–F tanpa menyentuh payment |
| Notification | Rollback deployment frontend atau satu CSS commit |
| Release version | Kembalikan package/UI version hanya bila seluruh release di-rollback |
| VPS | Restore backup; jangan reset/delete tanpa approval |

Setelah rollback:

1. Restart PM2 bila backend berubah.
2. Verifikasi `/api/test-ping`.
3. Periksa PM2 error log.
4. Verifikasi satu read-only dashboard request.
5. Jangan melakukan payment retry sampai reference terdampak direkonsiliasi.

## 10. DAMPAK JIKA PLAN TIDAK DIKERJAKAN

| Masalah | Dampak berkelanjutan |
|---------|----------------------|
| Blind POST replay | Risiko transaksi/payment/action ganda |
| Fixie tidak dipaksa di Vercel | Invalid IP/Unauthorized saat fallback |
| Client amount dipercaya | Payment dapat tidak sesuai transaksi database |
| Auth split-brain | Unauthorized di dashboard dan logout yang tampak acak |
| Timeout dianggap 401 | User terus login ulang tanpa menyelesaikan akar masalah |
| Bundle notification tidak diverifikasi | Patch CSS bertambah tetapi bell tetap rusak |
| VPS drift | Deploy dan rollback tidak deterministik |

## 11. FILE SCOPE FINAL

### Expected runtime files

| File | Kondisional |
|------|------------|
| `src/lib/api.ts` | Wajib |
| `server.ts` | Wajib |
| `src/services/ipaymu/client.ts` | Wajib |
| `src/routes/payments.ts` | Wajib |
| `src/pages/kiosk/Checkout.tsx` | Wajib |
| `src/App.tsx` | Wajib |
| `src/store/useAuthStore.ts` | Hanya jika handler App tidak cukup |
| `src/middleware/auth.ts` | Wajib |
| Dashboard/Portal layout | Hanya jika bug masih reproducible pada bundle terbaru |

### Release/documentation files

| File | Waktu perubahan |
|------|-----------------|
| `package.json` | Setelah semua QA lulus |
| `changelog.txt` | Saat release |
| `AGENTS.md` | Rules sudah didokumentasikan |
| Home/Dashboard/Portal version labels | Setelah release disetujui |
| `docs/CAPA-v5.16.5.md` | Update hasil aktual setelah implementasi |

## 12. CATATAN PERSETUJUAN DAN EKSEKUSI

| Item | Hasil |
|------|-------|
| Persetujuan runtime | Diberikan pengguna setelah implementation plan dibaca |
| Batas scope | Tidak ada migration, dependency baru, atau refactor settlement |
| Payment callback/stock/balance/points | Tidak diubah |
| Perubahan tambahan berbasis bukti | Header blur mobile dibatasi ke breakpoint `sm` setelah browser QA membuktikan dropdown hanya setinggi sekitar 2 px |
| Security cleanup | Hardcoded Fixie credential di `test-proxy.*` diganti environment variable |
| QA automated | `lint` lulus; 23 test files / 119 tests lulus; build lulus |
| QA browser | Login admin, dashboard reload, Portal, bell desktop, dan bell mobile 301×663 lulus |
| Health lokal source terbaru | `status=ok`, runtime `vps`, transport `direct`; unauthenticated payment POST ditolak 401 |
| Backup VPS | `/opt/backups/sps-backend-pre-v5.16.5-20260728-033909.*` terverifikasi checksum; drift juga disimpan di `stash@{0}` |
| Rekonsiliasi VPS | 12 modified files identik dengan Git setelah normalisasi CRLF/LF; tidak ada hotfix unik yang dibuang |
| Runtime commit | `4c6556955045baa37784227b481cb06cdcd2d9b2` |
| Deployment VPS | Fast-forward tanpa reset; PM2 online; health publik dan localhost lulus |
| Deployment Vercel | GitHub status success; runtime `vercel`, iPaymu transport `fixie` |
| Production auth guard | Payment POST tanpa token ditolak 401 pada VPS dan Vercel |
| Production bundle | Home v5.16.5, bell mobile Dashboard/Portal, dan Checkout ambiguous guard terverifikasi pada asset origin |
| Deployment | Selesai; status operasional `MONITORING` karena transaksi iPaymu riil sengaja tidak dibuat saat smoke test |

## 13. DEVIASI DARI PLAN DAN ALASAN

| Rencana awal | Implementasi aktual | Alasan |
|--------------|---------------------|--------|
| Verifikasi notification tanpa CSS change bila fix existing cukup | Mengubah satu utility class pada dua header | Fix overflow v5.16.3 belum cukup; `backdrop-filter` terbukti membuat fixed containing block |
| Status check otomatis setelah ambiguous payment | Menahan lock, menyimpan transaction reference, dan mengandalkan callback/reconciliation existing | Menghindari state machine baru dan request gateway tambahan pada hotfix |
| Deploy terpisah per concern | Satu release PATCH setelah seluruh concern lulus QA lokal | Scope file saling terkait dan user telah menyetujui eksekusi penuh; rollback tetap per file/commit |
