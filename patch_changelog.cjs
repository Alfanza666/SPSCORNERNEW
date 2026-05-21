const fs = require('fs');

const changelogPath = 'changelog.txt';
const newEntry = `
v4.8.3 - System Stabilization & UI/UX Enhancements
--------------------------------------------------
### Fitur Baru & Optimasi:
- **[NEW] Form Builder Customization:** Menambahkan pengaturan Tema Warna (Hex) dan Banner URL pada Admin Form Builder. Pengaturan ini otomatis diterapkan pada Portal Form tanpa mengubah skema database.
- **[NEW] Manual Receipt Upload:** Menambahkan tombol unggah bukti transfer manual di halaman Riwayat Transaksi (History) Kiosk khusus untuk transaksi yang berstatus Pending atau Gagal.
- **[FIX] Kiosk Redirect Bug:** Memperbaiki "race condition" pada keranjang belanja (Checkout) yang sebelumnya menyebabkan pembeli dilempar kembali ke halaman beranda sebelum sempat melihat halaman sukses.
- **[FIX] Admin Form Builder Crash:** Memperbaiki masalah \`ReferenceError: MoreHorizontal is not defined\` yang menyebabkan layar putih (crash) saat Admin mencoba membuat form baru.
- **[MAINTENANCE] Code Audit & TypeScript Fixes:** Melakukan audit menyeluruh dan memperbaiki berbagai error kompilasi pada file React, Service Worker PWA, dan konfigurasi Vite untuk menjamin Zero Regression.
`;

fs.appendFileSync(changelogPath, newEntry);
console.log('Changelog updated.');

const packageJsonPath = 'package.json';
let packageJson = fs.readFileSync(packageJsonPath, 'utf8');
packageJson = packageJson.replace(/"version": ".*"/, '"version": "4.8.3"');
fs.writeFileSync(packageJsonPath, packageJson);
console.log('package.json updated.');
