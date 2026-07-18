# Testing Checklist — SPS Corner

Jalankan checklist ini setiap ada rilis baru untuk memastikan zero regression.

## Release Evidence

- [ ] Catat commit, versi, tanggal/waktu, environment, tester, dan data program pilot
- [ ] `git status --short` hanya memuat perubahan yang memang masuk scope
- [ ] `git diff --check` lulus
- [ ] `npm run lint` lulus
- [ ] `npm test` lulus dan jumlah file/test dicatat
- [ ] `npm run build` lulus; warning ukuran chunk dicatat terpisah
- [ ] Migration staging dijalankan dua kali untuk membuktikan idempotency
- [ ] Backup dan rollback point tersedia sebelum migration production

## Auth Flow

- [ ] Login via Google (redirect + callback)
- [ ] Login via NIK + password manual
- [ ] Register akun baru (NIK, nama, HP tersimpan)
- [ ] Lupa password → reset link email
- [ ] Guest checkout tanpa login

## Kiosk (Buyer)

- [ ] Katalog: filter kategori, search, debounce
- [ ] Katalog: tab Pre-Order cutoff time
- [ ] Keranjang: tambah item, update qty, hapus item
- [ ] Keranjang: floating bottom bar muncul
- [ ] Checkout: payment method QRIS/Cash/Poin
- [ ] Checkout: prevent double-click (mutex)
- [ ] Payment iPaymu: redirect + callback success
- [ ] Payment manual: upload receipt → AI verify
- [ ] History: list transaksi, filter status/tanggal
- [ ] History: detail modal status konsisten
- [ ] History: upload ulang receipt untuk pending/failed
- [ ] History: cancel order
- [ ] Profile: edit nama, NIK, HP, alamat

## Admin Dashboard

- [ ] Dashboard: ringkasan statistik
- [ ] Transaksi list: tab Sukses & Gagal
- [ ] Transaksi detail: status badge sesuai `tx.status` (bukan `activeTab`)
- [ ] Transaksi detail: produk fisik status "Selesai" jika sudah paid
- [ ] Seller management: tambah, edit, nonaktifkan
- [ ] Produk: CRUD, upload gambar
- [ ] Kategori: CRUD
- [ ] Laporan: stok, transaksi, error reports
- [ ] Export Excel: transaksi, laporan stok
- [ ] Flash Sale: jadwal, aset, countdown
- [ ] Announcements: buat, publish
- [ ] Doorprize: spin wheel
- [ ] Form Builder: buat pertanyaan, lihat respon

## Seller Dashboard

- [ ] Dashboard: ringkasan penjualan hari ini
- [ ] Produk: tambah, edit, stok
- [ ] Pre-Order: atur cutoff, upload gambar
- [ ] Transaksi: list penjualan
- [ ] Withdrawal: ajukan penarikan saldo

## Portal Serikat

- [ ] Dashboard: statistik anggota
- [ ] Program: lihat program aktif, tukar kupon
- [ ] Pengumuman: baca notifikasi
- [ ] Pengaduan & Kritik: kirim laporan
- [ ] Profile: ganti password

## Employee Gathering v5.9 — Publish & Eligibility

- [ ] Publish gathering tanpa form RSVP valid ditolak
- [ ] Publish tanpa deadline RSVP ditolak
- [ ] Deadline setelah waktu mulai acara ditolak
- [ ] Publish dengan snapshot penerima kosong ditolak
- [ ] Preview filter NIK menghasilkan daftar dan jumlah yang benar tanpa menulis snapshot
- [ ] Preview filter departemen menghasilkan daftar dan jumlah yang benar
- [ ] Preview filter tanggal masuk kerja menghasilkan daftar dan jumlah yang benar
- [ ] Kombinasi filter mengikuti operator/aturan yang ditampilkan admin
- [ ] Publish valid membuat tepat satu snapshot penerima dan config version aktif
- [ ] Perubahan master karyawan setelah publish tidak mengubah snapshot
- [ ] Edit snapshot setelah ada RSVP ditolak dari jalur edit biasa
- [ ] Rekonsiliasi snapshot hanya dapat dilakukan admin/superadmin dengan alasan dan audit
- [ ] Publish gagal di salah satu tahap tidak meninggalkan form/config/program/snapshot parsial
- [ ] Program non-gathering tetap dapat disimpan tanpa form wajib

## Employee Gathering v5.9 — RSVP, Pricing & Payment

- [ ] Karyawan di luar snapshot tidak dapat membuka workflow, RSVP, atau memperoleh QR
- [ ] Draft/autosave dapat dilanjutkan sebelum deadline
- [ ] RSVP tidak hadir selesai tanpa item biaya atau entitlement aktif
- [ ] RSVP hadir langsung mengaktifkan attendance dan meal karyawan
- [ ] Biaya tambahan ukuran/family tidak menahan entitlement dasar karyawan
- [ ] Ukuran S, M, L, dan XL menghasilkan surcharge nol
- [ ] XXL dan XXXL memakai harga config version yang benar
- [ ] Tidak camping melewati pertanyaan keluarga dan mengabaikan jawaban keluarga lama
- [ ] Camping tanpa keluarga menghasilkan family count nol
- [ ] Data keluarga hanya berupa jumlah; UI/API tidak meminta nama atau identitas
- [ ] Family count nol tidak menghasilkan item atau QR keluarga
- [ ] Family count N menghasilkan tepat satu family package item × N
- [ ] Total browser yang dimodifikasi diabaikan dan dihitung ulang server
- [ ] Registrasi lama mempertahankan snapshot harga setelah config baru diterbitkan
- [ ] Seluruh rekening aktif dapat dipilih; rekening nonaktif/tidak dikenal ditolak
- [ ] Transfer bank dan QRIS manual mengikuti instruksi serta total server
- [ ] Proof hanya menerima tipe, ukuran, bucket/path, dan URL display yang diizinkan
- [ ] Bukti ditolak menampilkan alasan dan dapat diganti
- [ ] Family count dapat dikoreksi sebelum review/paid sesuai state guard
- [ ] Perubahan setelah paid memerlukan reopen/correction/refund yang teraudit
- [ ] Perubahan setelah deadline, attendance scan, atau admin lock ditolak
- [ ] Retry submit/proof/approve dan callback ganda tidak membuat payment/item/QR duplikat

## Employee Gathering v5.9 — Entitlement, Scanner & Doorprize

- [ ] QR memakai opaque random token tanpa NIK atau data pribadi
- [ ] Tab Tiket Masuk dan Kupon Makan memisahkan employee dan `Keluarga N`
- [ ] Family entitlement berstatus reserved/belum aktif sampai pembayaran paid
- [ ] Setelah paid, family count N menghasilkan tepat N attendance dan N meal QR
- [ ] Lifecycle active, redeemed, expired, dan revoked ditampilkan konsisten
- [ ] Scanner mewajibkan program dan gate sebelum scan
- [ ] QR program lain ditolak dan attempt dicatat
- [ ] Attendance QR pada gate meal ditolak; meal QR pada gate attendance ditolak
- [ ] Scan pertama yang valid melakukan redeem dan mencatat success atomik
- [ ] Scan kedua ditolak sebagai duplicate dan tetap dicatat
- [ ] QR reserved, expired, revoked, atau tidak dikenal ditolak dengan alasan
- [ ] Reversal menambah audit baru dan tidak menghapus success lama
- [ ] Scan employee attendance membuat satu peserta eligible doorprize
- [ ] Scan employee meal tidak membuat peserta doorprize
- [ ] Scan family attendance/meal tidak membuat peserta doorprize
- [ ] RSVP hadir yang belum check-in tidak termasuk doorprize
- [ ] Override attendance tanpa role admin/superadmin ditolak
- [ ] Override tanpa alasan bermakna ditolak
- [ ] Override valid menghasilkan eligibility dan audit permanen tanpa peserta ganda
- [ ] Draw doorprize hanya menerima daftar attendance aktual dan mencegah pemenang ganda sesuai aturan program

## Employee Gathering v5.9 — Form Studio & AI

- [ ] Desktop menampilkan library, canvas, dan inspector tanpa overflow
- [ ] Tablet memakai panel collapsible; mobile memakai canvas penuh dan drawer/bottom sheet
- [ ] Field dapat ditambah, dipilih, dipindah, diduplikasi, dikonfigurasi, dan dihapus
- [ ] Save Draft tidak mempublikasikan form atau workflow
- [ ] Publish menjalankan validasi form, workflow, deadline, dan eligibility
- [ ] Undo/redo memulihkan perubahan manual secara berurutan
- [ ] Classic renderer menampilkan seluruh active path
- [ ] Card renderer menampilkan satu langkah dengan progress dan navigasi yang valid
- [ ] Conditional target hilang, cycle, dan dead end yang tidak disengaja memblokir publish
- [ ] Preview builder dan portal menghasilkan active path, validasi, harga, dan outcome yang sama
- [ ] Review dan autosave mengikuti toggle konfigurasi
- [ ] AI structured action menampilkan diff add/change/delete/logic/pricing sebelum apply
- [ ] Chat AI tanpa action ditandai sebagai saran dan tidak mengubah canvas
- [ ] Schema AI invalid ditolak tanpa merusak form
- [ ] Apply AI mengubah canvas hanya setelah konfirmasi
- [ ] Satu undo membatalkan satu batch perubahan AI

## Employee Gathering v5.9 — Dashboard & Export

- [ ] Dashboard memakai filter program yang sedang dibuka
- [ ] Snapshot, RSVP hadir/tidak hadir/belum isi, ukuran, camping, dan family count konsisten
- [ ] Billed, pending, review, paid, dan rejected sesuai ledger pembayaran
- [ ] Entitlement active/redeemed/expired/revoked sesuai data QR
- [ ] Attendance/no-show dan pengambilan meal employee/family konsisten
- [ ] Doorprize eligible dan winners sesuai attendance audit
- [ ] Excel berisi sheet Summary, RSVP, Payments, Entitlements, Scans, dan Doorprize
- [ ] PDF memakai logo/kop serikat, identitas program, filter, waktu ekspor, metrik, dan tabel
- [ ] Angka dashboard, Excel, dan PDF identik untuk filter yang sama

## Employee Gathering v5.12 — Deadline, Pricing & Ticket Recovery

- [ ] Admin dapat memperpanjang deadline program published yang sudah memiliki RSVP
- [ ] Perubahan deadline memerlukan alasan, tampil kembali dalam waktu lokal, dan tidak mengubah `config_version`
- [ ] Edit deadline bersamaan dari dua admin menghasilkan konflik; perubahan admin pertama tidak tertimpa
- [ ] Update langsung `union_programs.rsvp_deadline` dari Data API ditolak; RPC deadline tetap berhasil dan membuat audit
- [ ] Retry RPC dengan target yang sudah tersimpan bersifat idempoten dan tidak membuat audit ganda
- [ ] Deadline kosong, invalid, lampau, setelah tanggal acara, atau program closed ditolak
- [ ] Deadline kedaluwarsa yang diperpanjang kembali langsung membuka submit RSVP tanpa republish
- [ ] Link form selalu menyertakan `programId`; link lama tanpa parameter me-resolve tepat satu gathering
- [ ] Relasi form ambigu diblok dan tidak masuk jalur response standalone
- [ ] Harga portal sama dengan workflow snapshot server untuk baju, keluarga, opsi, repeater, dan add-on
- [ ] Total browser yang stale ditolak sebelum registrasi/pembayaran ditulis
- [ ] Publish form linked tanpa RSVP membuat snapshot baru; dengan RSVP membuat versi future-only beralasan
- [ ] Save Draft form linked tidak mengubah pertanyaan yang sedang live sebelum publish/reconcile
- [ ] Perubahan target department/NIK dalam draft tidak memblok peserta pada frozen eligibility live
- [ ] Retry/edit RSVP lama tetap memakai schema, pricing, dan workflow version historis
- [ ] URL dengan `formId` dan `programId` yang tidak cocok gagal tertutup tanpa menulis response/registrasi
- [ ] Verifikasi RSVP membuka tab Semua, menyediakan status Tanpa pembayaran, filter program, dan pagination >100 data
- [ ] RSVP `not_required` dengan keluarga menerbitkan attendance + meal untuk setiap keluarga
- [ ] RSVP paid/not_required dengan QR kurang menampilkan warning dan tombol repair
- [ ] Retry repair dan reload portal tidak membuat QR ganda
- [ ] RSVP declined→attending memutar QR expired; membuka program closed tidak mengaktifkan QR kembali
- [ ] Upload atau approval payment setelah program closed ditolak tanpa mengubah payment/registration menjadi paid/confirmed
- [ ] Ganti filter/program dengan cepat tidak membiarkan respons lama menimpa tabel atau pagination terbaru
- [ ] Coupon schema current, legacy, dan dual tetap menampilkan QR attendance/meal di portal
- [ ] Riwayat registrasi lama tetap menunjuk workflow version lama setelah pricing direkonsiliasi

## Push Notification

- [ ] Subscribe: browser minta izin, subscription tersimpan
- [ ] Push dari server: notifikasi muncul di HP (app tertutup)
- [ ] Push dari server: notifikasi muncul di HP (app terbuka)
- [ ] Notifikasi in-app: panel bell berisi
- [ ] Klik notifikasi → navigasi ke halaman tujuan
- [ ] Unsubscribe: tombol nonaktifkan bekerja

## Stock & Transaksi

- [ ] Checkout: stock terpotong di server (double-check DB)
- [ ] Auto-cleanup: transaksi pending >5min → failed → stock restore 1x
- [ ] iPaymu callback gagal: stock restore 1x (tidak double)
- [ ] Cancel order: stock restore
- [ ] Tidak ada stock_inflasi setelah 3x auto-cleanup cycle

## PWA & Mobile

- [ ] Install banner muncul di Chrome Android
- [ ] Service worker terdaftar (devtools → Application)
- [ ] Halaman offline menampilkan fallback
- [ ] Bottom nav mobile: 5 tab navigasi
- [ ] Scan QR: kamera berfungsi (Chrome Android)
- [ ] Layout tidak overflow/terpotong di viewport 375px - 1920px
- [ ] Gathering diuji pada mobile, tablet, desktop, dark/light mode, dan orientasi landscape
- [ ] Loading, empty, error, offline, dan retry state dapat dipahami dan tidak menghapus draft
- [ ] Navigasi keyboard, focus state, label form, dialog, dan screen reader dasar berfungsi

## Keamanan

- [ ] Endpoint admin return 401 tanpa token
- [ ] Endpoint admin return 403 untuk role non-admin
- [ ] .env tidak tercommit (cek git status)
- [ ] Tidak ada console.error leak di production
- [ ] Harga, identity, NIK, eligibility, payment state, dan entitlement tidak dipercaya dari browser
- [ ] Upload proof tidak menerima executable, oversized file, base64 payload, atau path milik user lain
- [ ] QR/API/log tidak membocorkan NIK, service-role key, API key, token, atau credential
- [ ] API route yang tidak dikenal mengembalikan JSON 404 sebelum SPA fallback
- [ ] RLS membatasi employee ke registrasi sendiri dan admin route memverifikasi role
