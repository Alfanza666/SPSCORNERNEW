# SPSCORNERNEW v5.11.0 — Form Pricing & Add-on Checkout

## Status

- Perubahan disiapkan dari branch `main` terbaru yang diperiksa pada 13 Juli 2026.
- Tidak ada write ke database produksi dan belum ada push/deploy ke GitHub.
- Tidak memerlukan migrasi database; konfigurasi harga tambahan disimpan dalam workflow JSON yang sudah ada.

## Setelah kode di-deploy

1. Buka **Admin → Form Studio** dan edit formulir Employee Gathering.
2. Isi harga pada opsi ukuran baju yang dikenai surcharge, misalnya XXL/XXXL.
3. Isi **harga per orang** pada field jumlah anggota keluarga.
4. Bila diperlukan, tambahkan field **Add-on checkout**, lalu isi nama fasilitas (tenda, matras, dan sebagainya), harga per unit, serta jumlah maksimum.
5. Klik **Terbitkan**. Menyimpan draft saja belum menyinkronkan harga ke workflow program.
6. Uji dua jalur: peserta camping dan peserta tidak camping. Keduanya sekarang tetap mendapat pertanyaan membawa keluarga.

Harga pada konfigurasi produksi yang diperiksa masih bernilai `0`, sehingga nilai rupiah yang sebenarnya tetap perlu ditentukan panitia melalui Form Studio. Kode sengaja tidak menebak nominal tersebut.

## Verifikasi

- Production build Vite + PWA/service worker: lulus.
- 4 test files terkait formulir/workflow: 21 tests lulus.
- Targeted TypeScript check untuk file yang berubah: lulus.
- Full suite lokal: 58 tests lulus; 1 suite integrasi transaksi tidak dapat mulai karena `VITE_SUPABASE_URL` tidak tersedia di workspace lokal.

## File yang berubah

- `changelog.txt`
- `error_history.txt`
- `package.json`
- `package-lock.json`
- `src/components/form-builder/FieldPalette.tsx`
- `src/components/form-builder/FieldSettingsPanel.tsx`
- `src/components/forms/PremiumFormExperience.tsx`
- `src/pages/dashboard/admin/AdminFormBuilder.tsx`
- `src/pages/dashboard/DashboardLayout.tsx`
- `src/pages/dashboard/PortalLayout.tsx`
- `src/pages/Home.tsx`
- `src/routes/eventWorkflow.ts`
- `src/routes/programRegistrationWorkflow.ts`
- `src/test/formTemplates.test.ts`
- `src/test/programRegistrationWorkflowRoute.test.ts`
- `src/test/programWorkflowConfig.test.ts`
- `src/types/form.ts`
- `src/types/qr-js.d.ts`
- `src/utils/formTemplates.ts`
- `src/utils/programWorkflowConfig.ts`
