# Safari/WebKit Payment Upload Failure — v5.16.6

## 1. RINGKASAN INSIDEN

| Item | Keterangan |
|------|-----------|
| Insiden | Checkout mobile menampilkan `ReadableStream uploading is not supported`; sebagian percobaan berikutnya diklasifikasikan sebagai status pembayaran tidak pasti |
| Dampak | Pengguna Safari/WebKit dapat gagal membuat transaksi atau membuka pembayaran otomatis; seluruh mutating request `/api/*` yang melalui global fetch wrapper berpotensi terdampak |
| Kerugian | Nilai finansial belum dapat dipastikan; risiko operasional berupa checkout gagal dan pengguna menekan pembayaran berulang |
| Durasi | Bukti pengguna diterima 29 Juli 2026; hotfix lokal selesai pada hari yang sama |
| Status | MONITORING — implementasi dan QA lokal lulus; verifikasi produksi wajib dilakukan setelah deployment |

## 2. ROOT CAUSE ANALYSIS (RCA)

### 2.1 Bug konversi body POST menjadi ReadableStream

| Item | Keterangan |
|------|-----------|
| Apa yang terjadi | Global fetch wrapper v5.16.5 membangun `Request`, menggandakannya, lalu membangun `Request` baru untuk URL VPS/Vercel |
| Error | `ReadableStream uploading is not supported` |
| Lokasi sebelum koreksi | `src/lib/api.ts:61-88` pada v5.16.5 |
| Lokasi sesudah koreksi | `src/lib/api.ts:61-84` pada v5.16.6 |
| Mekanisme | Body JSON pada `RequestInit` berubah menjadi `Request.body` bertipe `ReadableStream`; Safari/WebKit menolak upload stream tersebut sebelum backend menerima request |
| Kenapa bisa terjadi | Regression test v5.16.5 memvalidasi no-blind-replay pada Node/jsdom, tetapi belum mensimulasikan larangan upload `ReadableStream` milik Safari/WebKit |

Referensi perilaku platform:

| Referensi | Lokasi |
|-----------|--------|
| WebKit Bug 203617 | `https://bugs.webkit.org/show_bug.cgi?id=203617` |
| MDN `Request.body` | `https://developer.mozilla.org/docs/Web/API/Request/body` |

### 2.2 5 Whys

| Why | Jawaban |
|-----|---------|
| 1. Mengapa checkout gagal? | Safari/WebKit menolak body upload berbentuk `ReadableStream`. |
| 2. Mengapa body menjadi stream? | Wrapper mengubah URL/string + `RequestInit` menjadi objek `Request`, lalu memanggil `clone()`. |
| 3. Mengapa wrapper membangun ulang request? | v5.16.5 membutuhkan penggantian target URL dari origin ke VPS atau fallback Vercel. |
| 4. Mengapa body asli tidak diteruskan? | Implementasi normalisasi request memakai objek `Request` sebagai kontainer URL, method, header, dan body. |
| 5. Mengapa lolos dari QA? | Node/jsdom dan browser desktop tidak mereproduksi pembatasan upload stream Safari/WebKit; belum ada simulasi error platform tersebut. |

### 2.3 Dampak dua pesan error

| Pesan | Penyebab |
|-------|----------|
| `Status permintaan pembayaran belum dapat dipastikan...` | Primary dinyatakan hidup, tetapi proses fetch mutating request melempar error; kebijakan anti-blind-replay sengaja menghentikan fallback |
| `ReadableStream uploading is not supported` | Saat primary telah ditandai tidak sehat, pembangunan ulang request fallback gagal langsung di Safari/WebKit |

### 2.4 Payment Path Checklist

Perubahan v5.16.6 hanya berada pada transport frontend. Tidak ada handler status transaksi, stock deduction, seller settlement, atau buyer points yang diubah.

| Payment path | Status terhadap hotfix | Integritas settlement |
|--------------|------------------------|-----------------------|
| Manual verify / AI receipt | Transport body dipertahankan; handler tidak diubah | Tetap mengikuti CAPA v5.16.2/v5.16.5 |
| Points pay full/partial | Transport body dipertahankan; handler tidak diubah | Tetap mengikuti CAPA v5.16.2/v5.16.5 |
| iPaymu callback | Tidak melalui global browser fetch; tidak diubah | Tetap mengikuti CAPA v5.16.2/v5.16.5 |
| Admin approve | Transport body dipertahankan; handler tidak diubah | Tetap mengikuti CAPA v5.16.2/v5.16.5 |
| Transaction create + validation token | Transport body dipertahankan; handler tidak diubah | Tetap mengikuti CAPA v5.16.2/v5.16.5 |
| Program registration payment | Transport body dipertahankan; handler tidak diubah | Tetap mengikuti workflow existing |

## 3. KOREKTIF (APA YANG DIPERBAIKI)

| File | Perubahan |
|------|-----------|
| `src/lib/api.ts:61-84` | URL dan method dibaca tanpa membuat `Request`; fetch primary/fallback menerima `RequestInit` asli sehingga JSON body, headers, dan method tidak berubah |
| `src/lib/api.ts:64` | Objek `Request` yang berasal dari caller diteruskan tanpa dibungkus ulang untuk menghindari perubahan body yang tidak aman |
| `src/test/apiFailover.test.ts:21-139` | Test primary uncertain, Safari stream rejection, GET fallback, dan preflight-unhealthy POST fallback |

Cuplikan koreksi:

```ts
if (input instanceof Request) return orig(input, init);

const requestUrl = new URL(String(input), window.location.origin);
// ...
const res = await orig(`${PRIMARY_API}${path}`, init);
// ...
return orig(`${window.location.origin}${path}`, init);
```

## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)

| Layer | Komponen | Mekanisme |
|-------|----------|-----------|
| Unit test | `apiFailover.test.ts` | Mock melempar error jika mutating body diterima sebagai objek `Request` dengan stream |
| Unit test | Primary routing | Memastikan method, header `Content-Type`, dan JSON body diteruskan utuh ke VPS |
| Unit test | Fallback routing | Memastikan POST dikirim satu kali ke Vercel bila health check sudah menyatakan VPS tidak sehat |
| Safety policy | Mutating request | Tetap tidak melakukan blind replay setelah primary dicoba dan hasilnya tidak pasti |
| Knowledge base | `AGENTS.md` | Menambahkan larangan konversi mutating body menjadi `Request`/`ReadableStream` |

## 5. PENCEGAHAN MASA DEPAN — RULES BARU

❌ **LARANGAN:** Membungkus ulang body mutating request menjadi `Request`/`ReadableStream` di global fetch failover.

✅ **PERINTAH:** Pertahankan body `RequestInit` asli dan uji jalur primary serta fallback dengan simulasi penolakan upload stream Safari/WebKit.

📄 **REFERENSI:** `docs/CAPA-v5.16.6.md`

## 6. FMEA

| Parameter | Analisis |
|-----------|----------|
| Severity | CRITICAL — dapat menghentikan checkout dan mutating request pengguna Safari/WebKit |
| Edge Cases | Double tap, health cache berubah saat checkout, primary timeout setelah request mungkin terkirim, fallback sebelum POST, PWA masih memakai bundle lama |
| Observability | Error browser diperiksa pada QA; production perlu dimonitor melalui client error reporting dan log request backend tanpa data sensitif |
| Rollback Plan | Revert hanya perubahan v5.16.6 pada `src/lib/api.ts` dan bundle frontend; tidak ada rollback database |
| Dependencies | Global fetch wrapper, seluruh frontend `/api/*`, browser Safari/WebKit, PWA/service worker |

## 7. VERIFIKASI & TESTING

| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | TypeScript `npm run lint` | Tidak ada error TypeScript | PASS |
| 2 | Regression test terarah | 5/5 test failover lulus | PASS |
| 3 | Full `npm run test` | Seluruh test suite lulus | PASS — 23 files / 120 tests |
| 4 | `npm run build` | Production bundle dan service worker berhasil dibuat | PASS |
| 5 | Login lokal menggunakan akun admin | Login berhasil dan sesi admin dikenali | PASS |
| 6 | Dashboard admin lokal | Overview berhasil dimuat tanpa Unauthorized | PASS |
| 7 | Viewport mobile 390×844 | Dashboard dimuat; tombol notifikasi terlihat dan enabled | PASS |
| 8 | Klik notifikasi mobile | Dropdown berubah ke status expanded dan menu tampil | PASS |
| 9 | Browser console lokal | Tidak ada warning/error setelah login dan dashboard QA | PASS |
| 10 | Mutating POST ketika primary healthy | Body JSON tetap `RequestInit`, dikirim sekali ke VPS | PASS — automated |
| 11 | Mutating POST ketika preflight primary gagal | Body JSON tetap utuh, dikirim sekali ke Vercel | PASS — automated |
| 12 | Mutating POST ketika hasil primary tidak pasti | Tidak ada blind replay | PASS — automated |
| 13 | Health check dan log produksi | Endpoint sehat dan tidak ada error baru terkait deployment | PENDING DEPLOYMENT |
| 14 | Safari/iPhone produksi | Tidak ada `ReadableStream uploading is not supported` pada checkout | PENDING USER/DEVICE VERIFICATION |

## 8. CLEANUP DAN BATAS SCOPE

| Item | Keputusan |
|------|-----------|
| Refactor checkout/payment | Tidak dilakukan; tidak diperlukan untuk akar masalah |
| Database migration | Tidak ada |
| Perubahan settlement/stok/poin | Tidak ada |
| Dependency baru | Tidak ada |
| Dead code | Hanya konstruksi `Request` dan `clone()` penyebab stream yang dihapus |

## 9. DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| CAPA failover dan auth sebelumnya | `docs/CAPA-v5.16.5.md` |
| CAPA payment settlement | `docs/CAPA-v5.16.2.md` |
| Implementation plan v5.16.5 | `docs/IMPLEMENTATION-PLAN-v5.16.5.md` |
| Changelog | `changelog.txt` |
| Operating rules | `AGENTS.md` |

## 10. VERSION STATUS

| Item | Nilai |
|------|-------|
| Versi | v5.16.6 PATCH |
| UI version | Home, Dashboard, dan Portal diperbarui |
| Database | Tidak berubah |
| Backend business logic | Tidak berubah |
| Deployment | PENDING |
