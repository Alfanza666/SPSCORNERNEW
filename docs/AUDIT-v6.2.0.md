# System & UX Audit Report — SPS Corner v6.2.0

**Tanggal:** 2026-10-21
**Scope:** Audit menyeluruh — Fungsional (API, error handling, race condition, a11y) + UI/UX (konsistensi design system, tipografi, mobile, bahasa)
**Metode:** Pemeriksaan statis kode (189 file frontend, 22 file backend), 129 endpoint terdaftar vs ~95 referensi `/api/...` frontend, lint + 137 unit test sebagai baseline hijau
**Status:** 61 temuan terdokumentasi (7 kritis, 19 sedang, 35 pola minor/UX)

---

## RINGKASAN

| Severity | Jumlah | Domains |
|----------|--------|---------|
| CRITICAL | 7 | Fitur rusak total, crash/corrupt data, silent failure |
| MAJOR | 19 | Race condition, error tertelan, konsistensi design system, a11y mobile |
| MINOR | 35 | Tipografi, radius, label, empty state, bahasa campur |
| **Total** | **61** | |

Baseline kualitas saat audit: `tsc` 0 error · 137/137 test lolos · build sukses · anti-pattern AI turun dari 46 → 7.

---

## BAGIAN A — AUDIT SISTEM / FUNGSIONAL

### A. CRITICAL (7 temuan)

#### A1: Endpoint tidak ada — fitur notifikasi Pre-Order rusak total

| | |
|---|---|
| **Lokasi** | `src/pages/dashboard/seller/SellerPreOrders.tsx:237` → `POST /api/pre-orders/notify-ready` |
| **Masalah** | Route `/api/pre-orders/*` tidak terdaftar di mana pun (server.ts maupun `src/routes/**`). Request jatuh ke catch-all 404 `server.ts:323`. `.catch(console.error)` di baris 241 hanya menangkap network error — respons 404 diabaikan diam-diam. |
| **Dampak** | Saat seller menandai Pre-Order "siap diambil", pembeli **tidak pernah** menerima notifikasi, tanpa error apa pun yang terlihat oleh seller. |
| **Perbaikan** | Tambah route `POST /api/pre-orders/notify-ready` (pola sama dengan `POST /api/admin/transactions/notify-ready` di `src/routes/transactions.ts:303`), ATAU hapus pemanggilannya + tampilkan feedback jujur ke seller. |

#### A2: Polling loop abadi setelah unmount (Success.tsx)

| | |
|---|---|
| **Lokasi** | `src/pages/kiosk/Success.tsx:56-90` |
| **Masalah** | `fetchTransaction` menjadwalkan ulang dirinya via `setTimeout(fetchTransaction, 3000)` (baris 75). Cleanup (baris 87-89) hanya `clearTimeout(pollTimeout)` pada timer yang *sudah terjadwal*. Jika unmount terjadi saat fetch sedang in-flight (baris 61), timer baru dibuat **setelah** cleanup → polling `transactions/:id` berjalan selamanya di background + `setTransaction` (baris 68) dipanggil setelah unmount. |
| **Dampak** | Memory leak + request API terus-menerus setiap 3 detik selama sesi browser; state update setelah unmount. |
| **Perbaikan** | Tambah flag `cancelled` pada effect (`let cancelled = false; ... return () => { cancelled = true; clearTimeout(...) }`), cek `if (cancelled) return` sebelum `setTransaction` & sebelum menjadwalkan timer berikutnya. |

#### A3: Race condition antar-fetch — respons lama menimpa data baru

| | |
|---|---|
| **Lokasi** | `src/pages/dashboard/admin/AdminDashboard.tsx:142-146, 254` (ganti periode); `src/pages/portal/PortalProgram.tsx:263-283` (klik program) |
| **Masalah** | Fetch tanpa penomoran request/abort. Respons lama yang lambat menimpa `setOverview`/`setMyCoupons` milik permintaan baru. |
| **Dampak** | Angka dashboard bisa menampilkan data periode yang salah; kupon program lain muncul di program yang dipilih. |
| **Perbaikan** | Pola guard: `const reqId = ++fetchSeq.current; ... if (reqId !== fetchSeq.current) return;` sebelum set state, atau `AbortController`. |

#### A4: Push notification "berhasil" padahal gagal

| | |
|---|---|
| **Lokasi** | `src/hooks/useNotifications.ts:258-267` (subscribe) & `:288-297` (unsubscribe) |
| **Masalah** | `await fetch('/api/push/subscribe', ...)` tanpa cek `res.ok`, lalu `setPushSubscribed(true)` + log sukses dijalankan unconditional. |
| **Dampak** | Jika server menolak (401/500), UI mengklaim push aktif padahal subscription tidak tersimpan — user tidak akan pernah menerima push notification. |
| **Perbaikan** | `if (!res.ok) throw new Error(...)` sebelum set state sukses; tampilkan toast error ke user. |

#### A5: Toggle admin tanpa cek respons (AdminMoments)

| | |
|---|---|
| **Lokasi** | `src/pages/dashboard/admin/AdminMoments.tsx:179-183` (featured), `:197-201` (hide), `:217-222` (delete — cek `data.success` tapi tanpa feedback saat `false`) |
| **Masalah** | `await fetch(...)` tanpa cek `res.ok`; `loadData()` tetap jalan sehingga admin tidak tahu update gagal (mis. token expired). |
| **Dampak** | Konten publik (foto SPS Moments) bisa tetap tampil/tersembunyi berbeda dari yang admin kira. |
| **Perbaikan** | Cek `res.ok`, tampilkan toast sukses/gagal, jangan refresh data seolah berhasil. |

#### A6: Broadcast pengumuman gagal senyap

| | |
|---|---|
| **Lokasi** | `src/pages/dashboard/admin/AdminAnnouncements.tsx:777-788` (`POST /api/notifications/broadcast`) |
| **Masalah** | Tanpa cek respons; admin tetap melihat "Dipublikasikan!" (baris 771) meski push broadcast gagal. |
| **Dampak** | Ribuan anggota bisa tidak menerima pengumuman penting, admin tidak tahu. |
| **Perbaikan** | Cek `res.ok` + laporkan jumlah notifikasi terkirim/gagal pada toast. |

#### A7: `useMomentsStore` bisa crash render galeri

| | |
|---|---|
| **Lokasi** | `src/store/useMomentsStore.ts:112-114` (`set({ photos: data.photos })` tanpa `\|\| []`); consumer `src/pages/moments/MomentsGallery.tsx:97,113` |
| **Masalah** | Jika server mengirim `{success:true}` tanpa field `photos`, state `photos` menjadi `undefined` → `photos.length`/`photos.map` crash. |
| **Dampak** | Halaman galeri moments putih (React crash boundary). |
| **Perbaikan** | `set({ photos: Array.isArray(data.photos) ? data.photos : [] })`. |

### B. MAJOR — fungsional (10 temuan)

| # | Temuan | Lokasi | Dampak |
|---|--------|--------|--------|
| B1 | ~32 route backend mati (tidak dipanggil frontend), termasuk `draw-doorprize` (`src/routes/portal.ts:247`) — AdminDoorprize menulis pemenang langsung via Supabase client tanpa validasi server | `src/routes/portal.ts`, `eventWorkflow.ts`, `digital.ts` (6 endpoint legacy) | Kode mati menambah beban audit; doorprize tanpa validasi server = risiko integritas |
| B2 | 30 blok `catch {}` kosong di frontend (±20 menyembunyikan error nyata) — contoh: `PortalFormView.tsx:266,330` (parse gagal → konfigurasi form ter-reset diam-diam), `AdminFormBuilder.tsx:652,903` | tersebar di `src/pages/**` | Kegagalan senyap, user kehilangan data tanpa tahu |
| B3 | 6 call site `fetch` tanpa cek `res.ok` berdampak nyata (lihat A4-A6 + `useMomentsStore.ts:146` likePhoto optimistik walau gagal) | `src/hooks`, `src/store`, `src/pages/admin` | State UI tidak jujur |
| B4 | 3 titik risiko null: `PortalProgram.tsx:315` (`selectedProgram?.id` bisa undefined → request ke `/programs/undefined/checkout-family`), `useMomentsStore.ts:112`, `AdminSettings.tsx:118,124` (`JSON.parse` tanpa guard lokal) | `src/pages/portal`, `src/store` | Error 404/parse → field kosong senyap |
| B5 | Race condition tambahan: `useMomentsStore.ts:65-116` (1 flag `isLoading` untuk 3 fetch → loading hilang terlalu cepat), `SellerPreOrders.tsx:222,248` (`fetchAll()` tanpa guard antar-mutasi) | `src/store`, `src/pages/seller` | UI menampilkan state tidak konsisten |
| B6 | Proteksi unmount minim: dari 139 `useEffect`, hanya 10 dengan guard pembatalan (8 `cancelled`, 1 AbortController, 1 `isMounted`) | seluruh `src` | Stale-overwrite potensial di banyak halaman |
| B7 | A11y: 6 `<img>` tanpa `alt` (`AdminFlashsale.tsx:464,481,528`, `SellerPreOrders.tsx:330,412`, `SellerProducts.tsx:1191`) | `src/pages` | Screen reader tidak bisa membaca gambar |
| B8 | A11y: ~54 tombol icon-only tanpa `aria-label` (contoh `Catalog.tsx:496,531,754`, `AdminMoments.tsx:251,268,285`, `KioskLayout.tsx:157`, `Login.tsx:224,245`) | `src/pages` | Tombol tidak teridentifikasi oleh assistive tech |
| B9 | A11y: ~189 input tanpa label/aria/placeholder; komponen `src/components/ui/Input.tsx` tidak merender `<label>` | `src/components/form-builder/FieldSettingsPanel.tsx` (±25 input) | Form tidak aksesibel |
| B10 | `KioskLayout.tsx:55-78` effect `[]` membaca `location.pathname` — pending-tx check hanya jalan di mount pertama | `src/pages/kiosk/KioskLayout.tsx` | Transaksi pending bisa tidak terdeteksi saat navigasi berikutnya |

---

## BAGIAN B — AUDIT UI / UX

### C. MAJOR — konsistensi & mobile (9 temuan)

| # | Temuan | Bukti statistik | Dampak |
|---|--------|-----------------|--------|
| C1 | **Design system tidak diadopsi** — 7 kelas inti 0 pemakaian (`page-title`, `page-subtitle`, `meta-label`, `clay-card-lg`, `clay-card-amber`, `btn-clay-primary-lg`); 56/87 halaman (64%) tidak memakai satu pun kelas design system; 208 kartu ad-hoc (`bg-white rounded-* border shadow-*` manual) | `src/index.css:175-191` vs scan seluruh `src/pages` | Setiap halaman terlihat dibuat terpisah → kesan "website buatan AI/template" |
| C2 | **711 teks ≤10px** (`text-[8px]` 64×, `[9px]` 61×, `[10px]` 586×) — di bawah batas keterbacaan mobile 360px | `History.tsx` (38), `Profile.tsx` (35), `AdminTransactions.tsx` (34), `DashboardLayout.tsx` (34) | Teks tak terbaca di HP |
| C3 | **31 tombol < 44px** (`h-6/h-7/h-8`, `w-8 h-8`) — kontradiksi dengan janji `src/index.css:108-109` ("minimum touch target 44px") | `KioskLayout.tsx:157,172,179,189` (4 tombol nav mobile!), `AdminIntegrasi.tsx:212,217`, `Catalog.tsx:644` | Salah tekan di HP |
| C4 | **328 label `uppercase tracking-widest` kecil** — pola "tiny tracked caps" yang dilarang komentar di `src/index.css:166` | `History.tsx` (30 combo), `Checkout.tsx` (20), `AdminIntegrasi.tsx` (20), `AdminTransactions.tsx` (20) | Ciri template AI paling terlihat |
| C5 | Hierarki font terbalik: `font-black` 726× (31%) dipakai pada label kecil (331× di teks ≤11px), `font-semibold` nyaris mati (112×) | `RegisterSeller.tsx:219-272`, `ResetPasswordPage.tsx:146,170` | Semua teks "teriak" — hierarki hilang |
| C6 | `EmptyState` hanya dipakai 2/87 halaman; 4 list punya empty state teks polos (`SellerTransactions.tsx:139-144`, `SellerProducts.tsx:1208`, `AdminStockRequests.tsx:117-120`, `AdminReturns.tsx:111-114`); 8 halaman loading spinner-only/teks polos (`AdminSettings.tsx:222-224` = teks "Memuat pengaturan..." saja) | `src/components/ui/EmptyState.tsx` | Pengalaman kosong terasa kosong, tidak menuntun |
| C7 | **Tablet/mobile**: tabel `AdminStandbySchedule.tsx:184-185` di `overflow-hidden` (terpotong, tidak bisa discroll) | `src/pages/dashboard/admin/AdminStandbySchedule.tsx` | Data tidak terjangkau di layar kecil |
| C8 | Radius tak seragam: 95× `rounded-[custom]` dengan 14 varian (8 level gradasi rem + 6 nilai px duplikat, mis. `[2rem]`≈`[32px]`) | `DigitalProducts.tsx:775`, `Login.tsx:163`, `TicketQrFrame.tsx:36` | Ritme visual kacau |
| C9 | `shadow-xl/2xl` pada ±15 elemen statis (bukan modal): `Login.tsx:163`, `Success.tsx:292`, `AdminProgramRegistrationsV2.tsx:532` (header!), `FormSkeleton.tsx:6` | `src/pages`, `src/components` | Tidak ada hierarki kedalaman |

### D. MINOR — bahasa & detail (35 temuan, 20 terburuk dicatat)

Bahasa campur Inggris-Indonesia pada teks user-facing. **20 contoh terburuk:**

| # | Lokasi | Teks | Masalah |
|---|--------|------|---------|
| D1 | `AdminMoments.tsx:85,107,112,141,164,254` | "Missing Fields", "Frame Uploaded", "Upload Failed", "Prompt Generated", "Frame Deleted", "Link copied to clipboard" | **Seluruh toast halaman ini Inggris** |
| D2 | `MomentsLive.tsx:110-111` | "Waiting for photos..." | Empty state publik full Inggris |
| D3 | `MomentsPreview.tsx:104,151,194` | "Your Moment Has Been Captured", "Share" | Halaman publik campur |
| D4 | `MomentsGallery.tsx:101` | "No photos yet" | Empty state Inggris |
| D5 | `AdminMoments.tsx:267` | "Gallery (Login Required)" | Label pengaturan Inggris |
| D6 | `AdminSellers.tsx:129` | toast "Database Error" | Error teknis mentah ke user |
| D7 | `AdminProducts.tsx:742` | header tabel "Seller Name" | Kolom tabel campur |
| D8 | `AdminIntegrasi.tsx:184,245,322` | "Amount", "Status DB", "Paid Status" | Jargon teknis |
| D9 | `AdminProgramRegistrationsV2.tsx:535,194` | "Payment control center", "Status workflow" | Judul section Inggris |
| D10 | `SellerProducts.tsx:1048,1113`, `History.tsx:968` | "Request Retur", "Request Restock" | Hibrida; "Retur" vs "Pengembalian" tidak konsisten |
| D11 | `Profile.tsx:288,296` | label "Role", "Points" | Label profil Inggris |
| D12 | `Validate.tsx:274` | "AI SCANNING" | Fitur konsumen Inggris |
| D13 | `History.tsx:809,833` | "Target No", "SN / TOKEN / REFERENSI" | Label teknis tidak jelas |
| D14 | `Success.tsx:187,209` | "Delivery Note - Sariroti" | Nota cetak Inggris (vs "NOTA PEMBELIAN" di `History.tsx:380`) |
| D15 | `AdminWithdrawals.tsx:165`, `History.tsx:540` | filter "Pending" | UI lain "Menunggu"/"Diproses" |
| D16 | `PortalProgram.tsx:959` | "Kupon Expired" | Harusnya "Kupon Kedaluwarsa" |
| D17 | `AdminFlashsale.tsx:340,457` | "Bulk Import Flash Sale", "UPLOAD" | Modal & tombol Inggris |
| D18 | `SellerProducts.tsx:674` | "PNG, JPG up to 5MB" | Bantuan upload Inggris |
| D19 | `InspectorPanel.tsx:80,393,484`, `FieldSettingsPanel.tsx:522` | "Inspector", "Welcome screen", "Glass surface" | Istilah builder campur |
| D20 | `AdminDoorprize.tsx:548`, `AdminProducts.tsx:555` | "Upload .xlsx", "Import CSV Sariroti" | Aksi admin campur |

---

## PRIORITAS PERBAIKAN

| Prioritas | Item | Estimasi dampak |
|-----------|------|-----------------|
| P1 | A1 (route notify-ready), A2 (polling abadi), A4-A6 (silent failure) | Menghilangkan 1 fitur rusak + 3 kegagalan senyap |
| P2 | A3, A5, B3-B6 (race guard + `res.ok` + null guard) | Data UI selalu jujur & konsisten |
| P3 | C1 (adopsi design system ke 56 halaman), C4 (label uppercase), C5 (hierarki font) | Menghilangkan kesan "template AI" |
| P4 | C2, C3 (teks ≥11px, tombol ≥44px), C6 (EmptyState), C7 (tabel scroll) | UX mobile jauh lebih mudah |
| P5 | B7-B9 (a11y: alt, aria-label, label form) | Aksesibilitas |
| P6 | D1-D20 (glosarium bahasa Indonesia), C8-C9 (radius/shadow), B1 (bersihkan route mati) | Konsistensi & kebersihan |

---

## VERIFIKASI & TESTING (baseline saat audit)

| # | Skenario | Expected | Status |
|---|----------|----------|--------|
| 1 | `npm run lint` (tsc --noEmit) | 0 error | ✅ |
| 2 | `npm test` (vitest, 27 file) | 137/137 lolos | ✅ |
| 3 | `npm run build` | Build sukses, PWA precache | ✅ |
| 4 | Impeccable detector `npx impeccable detect src/` | Anti-pattern AI: 46 → 7 (sisa fitur fungsional: underline form, corner marker scanner, template email) | ✅ |
| 5 | Endpoint FE→BE mismatch | 1 (A1) — sisanya 0 method mismatch | ⚠️ tercatat |
| 6 | Screenshot lokal (home/kiosk/login, light+dark) | Tersedia di `.taste-skill/inspect/` | ✅ |

---

## PENCEGAHAN MASA DEPAN — RULES BARU

### ❌ LARANGAN
| ID | Rule |
|----|------|
| UI-00 | Dilarang menambah teks `text-[10px]` ke bawah untuk konten yang harus dibaca (floor: `text-[11px]`); pengecualian hanya badge angka superskrip. |
| UI-00 | Dilarang membuat tombol dengan tinggi < 44px di mobile (pakai `btn-clay-*` atau set `min-height: 44px`). |
| UI-00 | Dilarang memakai `uppercase` + `tracking-widest` pada label meta kecil — gunakan `meta-label` (sentence case). |
| CODE-006 | Dilarang `catch {}` kosong pada alur yang menyangkut data user — minimal `console.error` + feedback UI. |
| CODE-007 | Dilarang fetch tanpa cek `res.ok` sebelum mengubah state menjadi "sukses". |

### ✅ PERINTAH
| ID | Rule |
|----|------|
| UI-00 | Halaman list wajib memakai komponen `EmptyState` (`src/components/ui/EmptyState.tsx`) dengan ikon + judul + minimal 1 CTA. |
| UI-00 | Loading halaman list wajib pakai `Skeleton` (`src/components/ui/Skeleton.tsx`); spinner hanya untuk aksi inline. |
| CODE-008 | Setiap `useEffect` berisi fetch yang bisa panjang wajib punya guard pembatalan (`cancelled` flag / `AbortController`). |
| CODE-009 | Nilai dari API yang akan dipanggil method number (`toLocaleString`, `toFixed`, `.length`) wajib di-guard `Number(x ?? 0)` / `Array.isArray(x) ? x : []`. |

### 📄 REFERENSI
| Dokumen | Lokasi |
|---------|--------|
| Audit ini | `docs/AUDIT-v6.2.0.md` |
| Standar CAPA | `docs/DOKUMENTASI-wajib.md` |
| Rules UI | `docs/AGENTS.md` (UI-001..003) |
| Design system | `src/index.css` (bagian `@layer components`) |

---

## DOKUMEN TERKAIT

| Dokumen | Lokasi |
|---------|--------|
| Audit Report v6.2.0 (ini) | `docs/AUDIT-v6.2.0.md` |
| Changelog | `changelog.txt` |
| AGENTS.md (rules) | `docs/AGENTS.md` |
| Audit sebelumnya | `docs/AUDIT-v5.16.2.md` |
