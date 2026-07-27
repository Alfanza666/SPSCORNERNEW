# Gangguan Intermiten Auth, iPaymu, Failover API, dan Notifikasi Mobile — v5.16.5

> **Status dokumen:** IMPLEMENTED DAN DEPLOYED — MONITORING
> **Tanggal audit:** 28 Juli 2026 (WITA)
> **Scope:** Hotfix runtime tanpa migration database dan tanpa perubahan settlement stock/balance/points.

## 1. RINGKASAN INSIDEN

| Item | Keterangan |
|------|-----------|
| Insiden | Pengguna mengalami `Invalid IP`/`Unauthorized` saat pembayaran iPaymu, notifikasi `Unauthorized` saat membuka dashboard, logout yang tampak acak, dan tombol notifikasi mobile yang tidak bereaksi |
| Dampak | Pembayaran dapat gagal atau meninggalkan transaksi pending; dashboard dapat menampilkan data sebagian lalu gagal pada endpoint ber-auth; pengguna harus login ulang; notifikasi mobile tidak dapat dibuka |
| Kerugian | Belum dihitung. Ada risiko operasional berupa transaksi pending/orphan dan risiko pembayaran ganda bila pengguna melakukan retry tanpa rekonsiliasi |
| Durasi | Intermiten; bukti log dan laporan pengguna ditemukan pada periode audit 27–28 Juli 2026 |
| Status | **DEPLOYED / MONITORING** |
| Outage total | Tidak. VPS dan Vercel sama-sama merespons HTTP 200 saat audit |

### 1.1 Arti “intermittent failure / degraded service”

| Istilah | Arti dalam insiden ini |
|---------|------------------------|
| Intermittent failure | Gangguan muncul sesekali, bukan terus-menerus. Request A dapat berhasil, tetapi request B beberapa detik/menit kemudian dapat timeout atau Unauthorized |
| Degraded service | Sistem masih hidup dan sebagian fitur bekerja, tetapi kualitas layanan menurun: auth tidak konsisten, sebagian API gagal, atau UI tidak merespons normal |
| Bukan outage total | Halaman dan health check masih dapat dibuka; gangguan berada pada jalur tertentu seperti verifikasi sesi, payment egress, atau bundle frontend |

Contoh alur yang sesuai dengan laporan:

```text
Dashboard berhasil dibuka
        ↓
Request data admin memerlukan verifikasi token
        ↓
Backend gagal menghubungi Supabase Auth / token tidak sinkron
        ↓
API membalas Unauthorized atau Internal Server Error
        ↓
Setelah reload, sesi lokal kosong dan user diarahkan ke login
```

## 2. ARSITEKTUR YANG DIHARAPKAN

Konsep dua backend adalah desain yang disengaja, bukan kesalahan:

```text
PRIMARY
Browser → api.spscorner.store → VPS (IP tetap 45.158.126.76) → iPaymu

FALLBACK
Browser → www.spscorner.store/api → Vercel Serverless → Fixie (IP statis) → iPaymu
```

| Komponen | Peran |
|----------|-------|
| VPS | Server utama untuk request API |
| Vercel | Serverless fallback jika VPS tidak dapat digunakan |
| Fixie | Memberikan static egress IP untuk request Vercel ke provider yang memakai IP whitelist |
| `src/lib/api.ts` | Helper failover dan global fetch wrapper untuk memilih VPS lalu fallback ke Vercel |

Temuan utama bukan “ada dua server” dan bukan karena failover belum diaktifkan. `patchGlobalFetch()` dipanggil dari `src/main.tsx:6-8`, sehingga relative API fetch memang diarahkan ke VPS terlebih dahulu. Titik rawannya berada pada keputusan failover:

- Sebagian besar frontend memanggil URL relatif `/api/...` dan secara global diintersep oleh `patchGlobalFetch()`.
- Jika health check VPS gagal sekali, `usePrimary` menjadi `false` dan keputusan itu di-cache selama 30 detik.
- Selama periode tersebut, relative API fetch langsung menggunakan Vercel fallback.
- Jika request ke VPS menghasilkan network error atau HTTP 5xx, global wrapper dapat mengirim request yang sama ke Vercel.
- Static IP fallback hanya terjamin bila `FIXIE_URL` benar-benar tersedia dan request iPaymu benar-benar melewati Fixie.

## 3. ROOT CAUSE ANALYSIS (RCA)

### 3.1 Bug A — Keputusan failover dapat mengalihkan traffic ke Vercel tanpa observability

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Satu kegagalan health check dapat mengalihkan relative API fetch ke Vercel selama TTL 30 detik |
| Error | iPaymu dapat menampilkan `Invalid IP` atau `Unauthorized` |
| Lokasi | `src/main.tsx:6-8`; `src/lib/api.ts:1-59`; `src/pages/kiosk/Checkout.tsx:251`, `:295`, `:758` |
| Mekanisme | `patchGlobalFetch()` aktif; `checkPrimary()` menyimpan hasil health selama 30 detik dan fallback tidak terlihat oleh UI |
| Kenapa bisa terjadi | Tidak ada klasifikasi request, target-runtime logging, atau verifikasi bahwa Vercel payment selalu melewati Fixie |

#### 5 Whys

| Why | Jawaban |
|-----|---------|
| 1 | iPaymu menolak request karena sumber IP tidak sesuai whitelist atau proxy fallback tidak aktif |
| 2 | Failover aktif mengalihkan request ke Vercel ketika VPS dianggap tidak sehat |
| 3 | Status unhealthy disimpan selama TTL 30 detik |
| 4 | Payment fallback bergantung pada `FIXIE_URL` dan perilaku proxy runtime Vercel |
| 5 | Tidak ada automated test dan logging yang membuktikan target VPS/Vercel serta direct/Fixie untuk setiap payment request |

### 3.2 Bug B — Failover mutating request berisiko blind replay

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Helper existing dapat mencoba fallback ketika primary menghasilkan network error atau HTTP 5xx |
| Risiko | POST dapat diproses di VPS tetapi respons terputus, lalu request yang sama dikirim kembali ke Vercel |
| Lokasi | `src/lib/api.ts:20-34` dan `:38-59` |
| Mekanisme | Sistem tidak dapat membedakan “request belum sampai” dengan “request sudah diproses tetapi respons hilang” |
| Dampak | Potensi dua payment session, double mutation, atau dua notifikasi |

**Keputusan CAPA:** `patchGlobalFetch()` tetap aktif karena merupakan bagian arsitektur existing, tetapi semantics fallback harus diklasifikasikan. GET/HEAD boleh auto-fallback; POST pembayaran tidak boleh blind replay.

### 3.3 Bug C — Auth state frontend dan sesi Supabase dapat berbeda

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Zustand masih menyimpan user, tetapi sesi Supabase dapat expired, hilang, atau gagal refresh |
| Error | Dashboard tampil tetapi API membalas `Unauthorized`; setelah reload user diarahkan ke login |
| Lokasi | `src/App.tsx:156-179`, khususnya `src/App.tsx:167` |
| Mekanisme | Semua event `onAuthStateChange` setelah inisialisasi pertama diabaikan |
| Kenapa bisa terjadi | Workaround untuk mencegah re-render ikut memblokir `TOKEN_REFRESHED` dan `SIGNED_OUT` yang sah |

#### 5 Whys

| Why | Jawaban |
|-----|---------|
| 1 | API melihat token tidak ada/invalid atau tidak dapat memverifikasinya |
| 2 | UI masih memakai profil user lama dari Zustand |
| 3 | Perubahan sesi tidak disinkronkan setelah startup |
| 4 | Listener memakai `if (isAuthInit.current) return` untuk semua event |
| 5 | Tidak ada test lifecycle sesi: refresh token, background/foreground, dan sign-out lintas tab |

### 3.4 Bug D — Timeout Supabase Auth disamarkan sebagai auth failure umum

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Log VPS menunjukkan beberapa `ConnectTimeoutError` 10 detik ke Supabase Auth |
| Error | `fetch failed`, `UND_ERR_CONNECT_TIMEOUT`, atau respons auth generik |
| Lokasi | `src/middleware/auth.ts:20`, helper `requireUser()` di `src/routes/payments.ts:13-20` |
| Mekanisme | Invalid token dan kegagalan upstream belum diklasifikasikan konsisten |
| Dampak | User dapat menerima pesan seolah kredensial salah, padahal dependency sedang timeout |

### 3.5 Bug E — Payment lock dan pending transaction saat gateway gagal

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Transaksi dibuat dan `paymentLocked` diset sebelum permintaan iPaymu selesai |
| Error | Setelah iPaymu gagal, catch menampilkan toast tetapi lock tidak dibuka |
| Lokasi | `src/pages/kiosk/Checkout.tsx:251-278`, `:295-335` |
| Dampak | Pending transaction tertinggal; retry user menjadi tidak jelas; berpotensi membuat transaksi baru setelah reload |

### 3.6 Bug F — Dropdown notifikasi mobile memiliki tinggi efektif 2 px

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Klik bell terlihat tidak bereaksi pada mobile |
| Lokasi | `src/pages/dashboard/DashboardLayout.tsx:626-664`; `src/pages/dashboard/PortalLayout.tsx` |
| Mekanisme | `backdrop-filter` dari `backdrop-blur-xl` membuat header menjadi containing block bagi dropdown `position: fixed`. Pada viewport 301×663, kombinasi `top` dan `bottom` dihitung terhadap tinggi header 64 px sehingga dropdown hanya setinggi sekitar 2 px |
| Kenapa fix v5.16.3 belum cukup | Penghapusan `overflow` mencegah clipping ancestor, tetapi tidak menghilangkan containing block yang dibuat oleh `backdrop-filter` |
| Corrective code | Blur header dibatasi mulai breakpoint `sm`, sehingga dropdown mobile kembali menggunakan viewport sebagai containing block; desktop tetap memakai blur dan posisi `absolute` |
| Bukti | Browser QA authenticated: tinggi dropdown berubah dari sekitar 2 px menjadi sekitar 499 px pada viewport 301×663; desktop tetap sekitar 627 px |

### 3.7 Bug G — Deployment drift VPS

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Git HEAD VPS masih `9bef9cf`, sedangkan beberapa file runtime identik dengan repo terbaru karena kemungkinan disalin manual |
| Error | Auto-deploy `git pull` abort akibat modified/untracked files |
| Dampak | Versi yang berjalan tidak dapat ditentukan hanya dari Git commit; rollback dan audit menjadi berisiko |
| Catatan | File manual tidak boleh dihapus/reset sebelum backup dan diff |

## 4. BUKTI AUDIT READ-ONLY

| Bukti | Hasil |
|-------|-------|
| Health VPS | `https://api.spscorner.store/api/test-ping` → HTTP 200, runtime `vps`, iPaymu transport `direct` |
| Health Vercel | `https://spscorner.store/api/test-ping` → HTTP 200, runtime `vercel`, iPaymu transport `fixie` |
| PM2 | `sps-backend` online; uptime sekitar 17 jam saat audit |
| VPS uptime | Sekitar 65 hari |
| Supabase connectivity | Beberapa `ConnectTimeoutError` ke endpoint Supabase Auth, timeout 10 detik |
| iPaymu callback | Beberapa callback berhasil diverifikasi melalui signature |
| Git lokal | `main` bersih pada awal audit |
| Git VPS | HEAD lama dan worktree dirty/untracked |
| File backend kritis VPS | Hash `server.ts`, `payments.ts`, dan `ipaymu/client.ts` sama dengan lokal |
| DashboardLayout VPS | Hash berbeda dari lokal |
| Global Supabase status | Operational saat audit; tidak membuktikan koneksi individual VPS/Vercel selalu sehat |

## 5. FMEA — FAILURE MODE & EFFECTS ANALYSIS

| Failure Mode | Severity | Efek | Pencegahan |
|--------------|----------|------|------------|
| Vercel tidak melewati Fixie | HIGH | iPaymu Invalid IP/Unauthorized | Runtime egress guard + verifikasi Fixie |
| Blind replay POST ke fallback | CRITICAL | Payment/mutation ganda | Idempotency + no automatic replay untuk ambiguous failure |
| Supabase Auth timeout | HIGH | Unauthorized palsu / dashboard gagal | Error classification, bounded retry hanya pada verifikasi aman |
| Auth store split-brain | HIGH | UI login tetapi API Unauthorized | Event-aware session synchronization |
| Payment lock tidak dipulihkan | MEDIUM | User terjebak / pending transaction | State machine minimal + reconciliation |
| PWA bundle lama | MEDIUM | Fix UI tidak dirasakan | Version verification + controlled SW update |
| VPS worktree drift | HIGH | Deploy/rollback tidak deterministik | Backup, diff, reconcile, clean deployment source |

### Edge Cases wajib

| Edge Case | Perilaku yang diwajibkan |
|-----------|--------------------------|
| VPS down sebelum POST dikirim | Pilih Vercel/Fixie satu kali |
| VPS memproses POST tetapi respons timeout | Jangan replay otomatis; cek status dengan reference ID |
| User double-tap | Hanya satu request aktif dan satu idempotency key |
| Callback iPaymu dua kali | Settlement tetap satu kali |
| Browser kembali dari background | Token direfresh dan UI tetap sinkron |
| Supabase timeout | Tampilkan “layanan autentikasi sementara bermasalah”, bukan menyuruh login ulang tanpa dasar |

## 6. CORRECTIVE & PREVENTIVE ACTION

### 6.1 Prinsip anti-over-engineering

| Prinsip | Batasan |
|---------|---------|
| Reuse | Gunakan `src/lib/api.ts`; jangan membuat gateway/service baru |
| Scope kecil | Ubah payment path terlebih dahulu, bukan seluruh `fetch()` dalam satu refactor |
| Tanpa migration awal | Hotfix routing/auth tidak membutuhkan schema baru |
| Tanpa dependency baru | Gunakan fetch, Supabase client, dan infrastruktur existing |
| Tanpa mengganti mekanisme global | Pertahankan `patchGlobalFetch()` existing; ubah hanya policy fallback yang terbukti berisiko |
| Tanpa blind retry | Mutating request tidak boleh otomatis dikirim ke server kedua |
| Satu concern per deploy | Payment routing, auth lifecycle, UI notification, dan VPS reconciliation dipisahkan |

### 6.2 Implementation plan

| Fase | Pekerjaan | Untuk apa | Impact positif | Jika tidak dikerjakan | Risiko perubahan | Rollback |
|------|-----------|-----------|----------------|----------------------|------------------|----------|
| 0 — Baseline | Simpan bukti versi, hash file, health, dan daftar transaksi terdampak | Memastikan sebelum/sesudah dapat dibandingkan | Mencegah salah diagnosis dan kehilangan hotfix manual | Perubahan berikutnya tidak dapat diaudit | LOW | Tidak ada perubahan runtime |
| 1 — Verify infrastructure | Verifikasi whitelist IP VPS, static IP Fixie, dan keberadaan `FIXIE_URL` pada Vercel tanpa mencetak secret | Memastikan kedua jalur memang sah di iPaymu | Menghilangkan tebakan tentang Invalid IP | Fallback tetap dapat gagal meski kode diperbaiki | LOW | Tidak ada perubahan kode |
| 2 — Safe routing core | Pertahankan global patch, tetapi perbaiki `checkPrimary()` agar memeriksa status HTTP dan larang replay mutating request setelah primary sudah dicoba | Menjadikan failover existing aman tanpa mengganti arsitektur | VPS tetap primary; fallback tetap tersedia tanpa blind replay | POST dapat dikirim dua kali pada ambiguous failure | MEDIUM | Revert `src/lib/api.ts` |
| 3 — Payment routing | Ganti hanya call iPaymu di Checkout agar memilih VPS terlebih dahulu dan Vercel/Fixie hanya sebelum POST dikirim | Memulihkan desain primary/fallback untuk payment | IP whitelist konsisten | Invalid IP/Unauthorized terus muncul | HIGH | Revert call site ke relative path |
| 4 — Payment idempotency | Gunakan `transaction_id/referenceId` existing sebagai idempotency identity; pada ambiguous timeout lakukan status check, bukan replay | Mencegah gateway request ganda | Retry aman dan pending dapat direkonsiliasi | Risiko pembayaran/transaksi ganda tetap ada | HIGH | Feature flag kembali ke single-attempt VPS |
| 5 — Payment UI recovery | Pulihkan lock hanya untuk failure yang dipastikan belum membuat payment; tampilkan status “sedang diverifikasi” untuk ambiguous failure | User tidak terjebak dan tidak blind retry | UX lebih aman | Pending transaction dan kebingungan user berulang | MEDIUM | Revert state handling |
| 6 — Auth lifecycle | Proses `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`, dan `SIGNED_OUT` secara selektif; hindari fetch profile berulang jika user ID sama | Menyatukan Zustand dengan sesi Supabase | Mengurangi logout acak/Unauthorized split-brain | Dashboard tetap dapat memakai state basi | HIGH | Revert hanya handler auth |
| 7 — Auth error semantics | Bedakan invalid token (401) dari upstream timeout (503); tambahkan log correlation tanpa token/PII | Pesan error dan diagnosis akurat | User tidak dipaksa login saat dependency timeout | Unauthorized palsu terus terjadi | MEDIUM | Revert middleware classification |
| 8 — Notification verification | Verifikasi bundle Vercel, SW version, hit-area, dan dropdown pada viewport mobile; deploy ulang fix existing bila bundle stale | Memastikan fix v5.16.3 benar-benar aktif | Bell mobile kembali berfungsi | User mobile tetap tidak bisa membuka notifikasi | LOW–MEDIUM | Revert frontend deployment |
| 9 — VPS reconciliation | Backup file dirty/untracked, diff terhadap main, pindahkan hotfix valid ke Git, lalu deploy dari commit bersih | Mengembalikan deployment deterministik | Auto-deploy dan rollback dapat dipercaya | VPS terus drift dan pull terus gagal | HIGH | Restore backup dan PM2 process sebelumnya |
| 10 — Monitoring | Tambahkan metrik ringan: selected runtime, upstream auth timeout count, payment ambiguity count, tanpa secrets | Insiden dapat dideteksi lebih awal | RCA lebih cepat | Insiden baru baru diketahui dari keluhan user | LOW | Hapus log/metric tambahan |

### 6.3 Urutan deploy yang disarankan

| Deploy | Scope | Alasan pemisahan | Gate lanjut |
|--------|-------|------------------|-------------|
| A | Safe routing + payment call site | Memulihkan jalur bisnis paling kritis | iPaymu sandbox/dry verification dan production smoke test satu transaksi terkontrol |
| B | Auth lifecycle + error classification | Tidak mencampur risiko payment dan session | Login, refresh, background/foreground, dashboard API lulus |
| C | Notification mobile + PWA verification | Perubahan UI terisolasi | Mobile 301 px, 360 px, 390 px dan desktop lulus |
| D | VPS Git reconciliation | Operasi deployment berisiko dipisah dari code fix | Backup terverifikasi dan diff manual disetujui |

### 6.4 Perubahan yang diimplementasikan

| File | Perubahan aktual | Dampak |
|------|------------------|--------|
| `src/lib/api.ts` | Health check memeriksa HTTP status, concurrent health check didedup, dan hanya GET/HEAD yang boleh replay ke fallback | POST/payment tidak dikirim ulang setelah primary sudah dicoba |
| `src/services/ipaymu/client.ts` | Vercel memakai Fixie sejak request pertama; tanpa Fixie fail-fast 503; retry lintas transport dihapus | Tidak ada direct dynamic egress Vercel dan tidak ada blind replay di client iPaymu |
| `server.ts` | Memilih transport berdasarkan runtime dan menampilkan runtime/transport pada health endpoint tanpa secret | Jalur VPS/Vercel dapat diverifikasi secara aman |
| `src/routes/payments.ts` | Memvalidasi pemilik, status pending, nominal, item, dan existing reference dari database; reference iPaymu di-merge tanpa menghapus email | Client tidak dapat memalsukan nominal/item dan satu transaksi tidak membuat payment kedua |
| `src/pages/kiosk/Checkout.tsx` | Membedakan definitive dan ambiguous failure; retry definitive memakai transaksi existing | User tidak terjebak, tetapi juga tidak blind retry saat hasil gateway belum pasti |
| `src/App.tsx` | Menangani lifecycle auth secara selektif tanpa profile fetch berulang saat token refresh | Zustand tetap sinkron dengan sesi Supabase |
| `src/middleware/auth.ts` | Invalid credential tetap 401; timeout/connectivity upstream menjadi 503 | Gangguan dependency tidak lagi disamarkan sebagai Unauthorized |
| `src/store/useAuthStore.ts` | Logout UI memakai scope lokal | Logout satu perangkat tidak memutus semua sesi perangkat lain |
| `src/main.tsx` | Menghapus unregister service worker tanpa seleksi versi | PWA/web push tidak terus-menerus kehilangan service worker aktif |
| `DashboardLayout.tsx`, `PortalLayout.tsx` | Blur header hanya mulai `sm`; button mendapat type dan accessible label | Dropdown mobile terlihat dan area tap 40×40 px; desktop tetap normal |
| `test-proxy.ts`, `test-proxy.js` | Kredensial Fixie hardcoded diganti `FIXIE_URL` | Secret tidak lagi berada di working tree |

## 7. PAYMENT PATH CHECKLIST

Sebelum implementasi dinyatakan selesai, setiap path harus diverifikasi:

| Payment Path | Stock | Seller Balance | Buyer Points | Idempotency | Status |
|--------------|-------|----------------|--------------|-------------|--------|
| Manual verify / AI receipt | Wajib | Wajib | Sesuai rule | Wajib | Belum diverifikasi ulang |
| Points full | Wajib | Wajib | Debit/earn sesuai rule | Wajib | Belum diverifikasi ulang |
| Points partial | Wajib | Wajib | Debit/earn sesuai rule | Wajib | Belum diverifikasi ulang |
| iPaymu callback paid | Wajib | Wajib | Wajib | Wajib | Perlu regression test |
| Admin approve | Wajib | Wajib | Wajib | Wajib | Perlu regression test |
| Transaction create + validation token | Reserve/commit sesuai flow | Belum settlement sebelum paid | Belum earn sebelum paid | Wajib | Perlu regression test |
| Program registration payment | Sesuai entitlement | Sesuai ledger | Sesuai program | Wajib | Perlu regression test |

## 8. VERIFIKASI & TESTING

| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | VPS sehat, GET API | Request menuju VPS | PASS — automated |
| 2 | VPS down/5xx, GET API | Fallback ke Vercel | PASS — automated |
| 3 | VPS sehat, payment POST | Satu request melalui VPS | PASS — automated no-replay policy |
| 4 | VPS down sebelum payment POST | Satu request melalui Vercel; runtime wajib Fixie | PASS — automated transport guard |
| 5 | VPS memproses payment tetapi respons putus | Tidak replay; reference/pending dipertahankan untuk callback/reconcile | PASS — automated |
| 6 | Double-tap / payment existing | Satu transaction/reference aktif | PASS — mutex existing + route reference guard |
| 7 | Callback duplikat | Tidak double stock/balance/points | NOT CHANGED — dilindungi CAPA v5.16.2 |
| 8 | Supabase Auth timeout | HTTP 503 + pesan sementara | PASS — automated |
| 9 | Reload sesi admin | Dashboard tetap aktif tanpa error auth baru | PASS — browser authenticated |
| 10 | Session revoked | UI logout konsisten | NOT RUN — tidak mencabut sesi admin aktif secara destruktif |
| 11 | Bell mobile 301×663 | Dropdown terlihat dan menerima tap | PASS — browser authenticated; tinggi sekitar 499 px |
| 12 | Bell desktop | Tidak ada regresi | PASS — browser authenticated; tinggi sekitar 627 px |
| 13 | PWA build | Service worker aktif dibangun dan tidak di-unregister pada startup | PASS — build artifact |
| 14 | `npm run lint` | Lulus | PASS |
| 15 | `npm run test` | Seluruh regression suite lulus | PASS — 23 files / 119 tests |
| 16 | `npm run build` | Lulus | PASS — warning bundle/CSS existing dicatat |
| 17 | Health VPS produksi | Runtime `vps`, transport `direct` | PASS — HTTP 200 |
| 18 | Health Vercel produksi | Runtime `vercel`, transport `fixie` | PASS — HTTP 200 |
| 19 | Auth guard kedua backend | Request payment tanpa token berhenti sebelum gateway | PASS — VPS 401, Vercel 401 |
| 20 | Bundle Home produksi | Versi UI v5.16.5 tersedia pada origin | PASS — `Home-17RO0bJK.js` |
| 21 | Bundle Dashboard/Portal produksi | Fix bell mobile dan ARIA tersedia pada origin | PASS — kedua chunk memuat `sm:backdrop-blur-xl` dan `Buka notifikasi` |
| 22 | Bundle Checkout produksi | Ambiguous payment tidak membuka blind retry | PASS — chunk memuat `PRIMARY_API_REQUEST_UNCERTAIN` |

### 8.1 Traceability matrix

| ID | Keluhan / requirement | Root cause | Perubahan | Bukti test | Hasil |
|----|-----------------------|------------|------------|------------|-------|
| TR-01 | iPaymu `Invalid IP` / `Unauthorized` saat fallback | Vercel dapat melakukan direct-first sebelum Fixie | `server.ts:234-265`; `src/services/ipaymu/client.ts:86` | `src/test/ipaymuTransport.test.ts` | PASS — Vercel wajib Fixie sejak request pertama; tanpa Fixie berhenti 503 sebelum request |
| TR-02 | iPaymu mencatat request walau UI error | POST dapat direplay setelah primary timeout/5xx dan client iPaymu memiliki retry transport | `src/lib/api.ts:8-81`; interceptor retry iPaymu dihapus | `src/test/apiFailover.test.ts` | PASS — POST yang sudah dicoba hanya memiliki satu target |
| TR-03 | Nominal/item payment bergantung payload browser | Endpoint mempercayai amount, buyer, dan item dari client | `src/routes/payments.ts:51-146` | `src/test/paymentCreationRoute.test.ts` | PASS — gateway menerima data canonical dari transaksi database |
| TR-04 | Retry/double-tap dapat membuat payment kedua | Reference existing belum menjadi guard dan definitive/ambiguous error tidak dibedakan | `src/routes/payments.ts:51-146`; `src/pages/kiosk/Checkout.tsx:342,824` | Payment route duplicate-reference test + mutex existing | PASS — existing reference diblok 409; ambiguous failure tidak membuka retry |
| TR-05 | Dashboard menampilkan `Unauthorized` saat dependency timeout | Timeout Supabase Auth diperlakukan sama dengan token invalid | `src/middleware/auth.ts:9-49`; helper payment auth | `src/test/authMiddleware.test.ts` | PASS — invalid token 401; timeout/connectivity 503 |
| TR-06 | Akun tampak logout / state auth janggal | Semua event auth setelah startup diabaikan | `src/App.tsx:159-192`; `src/store/useAuthStore.ts:81` | Browser login admin + reload; tidak ada auth error baru | PASS |
| TR-07 | Bell desktop normal, mobile tidak bereaksi | `backdrop-filter` header membuat containing block; dropdown mobile hanya sekitar 2 px | `src/pages/dashboard/DashboardLayout.tsx:628`; `src/pages/dashboard/PortalLayout.tsx:383` | Browser viewport 301×663 dan desktop | PASS — mobile sekitar 499 px; desktop sekitar 627 px |
| TR-08 | PWA/push notification berisiko tidak konsisten | Startup meng-unregister setiap service worker bernama `sw.js`, termasuk worker aktif | `src/main.tsx` | Production build menghasilkan `dist/sw.js` | PASS — unregister loop dihapus |
| TR-09 | Secret tidak boleh berada di repository | Fixie credential pernah hardcoded pada utility test | `test-proxy.ts`; `test-proxy.js` | Working-tree secret scan | PASS — tidak ada credential Fixie plaintext; contoh placeholder dokumentasi bukan secret; credential lama wajib dirotasi |
| TR-10 | Zero regression | Perubahan menyentuh routing, payment, auth, dan responsive UI | Seluruh scope v5.16.5 | `lint`; 23 test files / 119 tests; build; authenticated browser QA; production smoke test | PASS lokal dan produksi |

### 8.2 Bukti deployment

| Item | Hasil |
|------|-------|
| Commit runtime | `4c6556955045baa37784227b481cb06cdcd2d9b2` |
| GitHub/Vercel status | `success` |
| VPS Git/PM2 | HEAD sesuai commit runtime, worktree bersih, `sps-backend` online |
| Warm-up | Health pertama sesaat setelah restart menangkap HTTP 502; health berikutnya dari localhost dan domain publik lulus HTTP 200 |
| VPS rollback artifact | `/opt/backups/sps-backend-pre-v5.16.5-20260728-033909.*` + `stash@{0}` |
| Browser cache observation | Tab lama sempat menampilkan v5.16.2, sedangkan asset origin sudah v5.16.5; ini cache/service-worker lama, bukan kegagalan build baru |
| Payment eksternal | Tidak dibuat pada smoke test agar tidak menciptakan transaksi iPaymu riil; transport dan guard diverifikasi tanpa side effect |

## 9. ROLLBACK PLAN

| Komponen | Rollback |
|----------|----------|
| Payment routing | Revert hanya perubahan call site dan helper policy; jangan mengubah callback/settlement |
| Auth lifecycle | Revert handler event tanpa menyentuh profil/database |
| Notification | Rollback ke deployment frontend sebelumnya |
| VPS reconciliation | Restore backup file dan PM2 process snapshot |
| Database | Tidak ada migration pada hotfix awal, sehingga tidak memerlukan rollback schema |

## 10. PENCEGAHAN MASA DEPAN — RULES BARU

❌ **LARANGAN:** Jangan mengirim mutating request secara otomatis ke backend kedua setelah network timeout/5xx tanpa idempotency dan status verification.
✅ **PERINTAH:** GET/HEAD boleh auto-fallback; payment/mutation harus memakai policy eksplisit dan tidak boleh blind replay.

❌ **LARANGAN:** Vercel tidak boleh menghubungi iPaymu langsung dengan dynamic egress IP.
✅ **PERINTAH:** Jalur Vercel → iPaymu wajib melalui Fixie/static egress yang terverifikasi.

❌ **LARANGAN:** Jangan mengabaikan seluruh event `onAuthStateChange` setelah startup.
✅ **PERINTAH:** Tangani event sesi secara selektif dan jaga Zustand tetap sinkron dengan Supabase session.

❌ **LARANGAN:** Jangan menjalankan `git reset --hard`, menghapus untracked files, atau menimpa worktree VPS yang drift tanpa backup dan diff.
✅ **PERINTAH:** Hotfix manual yang valid harus dipindahkan ke Git sebelum worktree produksi dibersihkan.

📄 **REFERENSI:** `docs/CAPA-v5.16.5.md`

## 11. CLEANUP INSTRUCTIONS

| Kandidat | Tindakan |
|----------|----------|
| `patchGlobalFetch()` | Jangan dihapus atau ditulis ulang; batasi perubahan pada klasifikasi method dan larangan blind replay |
| Fixie credential lama | Sudah dihapus dari `test-proxy.*`; wajib dirotasi pada provider karena pernah berada di Git history |
| VPS `_check.js` | Dipertahankan di backup dan `stash@{0}`; tidak dihapus permanen |
| Modified/untracked VPS files | Backup terverifikasi di `/opt/backups/sps-backend-pre-v5.16.5-20260728-033909.*`; diff normalisasi membuktikan file identik dengan Git lokal |
| Komentar “NUCLEAR OPTION” | Ganti hanya bersamaan dengan handler auth yang telah diuji |

## 12. VERSION STATUS

| Item | Status |
|------|--------|
| Versi runtime/repo saat diagnosis | v5.16.4 |
| Versi implementasi | v5.16.5 PATCH |
| Status v5.16.5 | Deployed; local QA dan production smoke test lulus; monitoring user flow berjalan |
| Update package/UI | `package.json`, lockfile, Home, Dashboard, dan Portal sudah v5.16.5 |

## 13. DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| CAPA stock/payment sebelumnya | `docs/CAPA-v5.16.2.md` |
| Audit keamanan | `docs/AUDIT-v5.16.2.md` |
| Changelog | `changelog.txt` |
| API failover helper | `src/lib/api.ts` |
| Implementation plan | `docs/IMPLEMENTATION-PLAN-v5.16.5.md` |
| VPS deployment script | `scripts/deploy-vps.ps1` |
| Agent rules | `AGENTS.md` |
