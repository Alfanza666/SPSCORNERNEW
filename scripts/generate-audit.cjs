// @ts-nocheck
/**
 * Audit Document Generator
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
// AUDIT DATA — Edit this section for each new audit
// ═══════════════════════════════════════════════════════════════

const AUDIT_DATA = {
  version: '5.16.2',
  date: '2026-07-21',
  scope: 'Full-stack audit (Frontend, Backend, Database, Security, Performance)',

  summary: {
    critical: 15,
    major: 23,
    minor: 20,
    silent: 10,
    total: 68,
  },

  critical: [
    { id: 'C01', file: 'src/routes/payments.ts:623-637', title: 'iPaymu Callback Signature Tidak Diverifikasi', impact: 'Attacker bisa memalsukan konfirmasi pembayaran', fix: 'Reject callback yang tidak punya signature' },
    { id: 'C02', file: 'server.ts:327-349', title: 'XSS via Product Names di OG Tags', impact: 'Stored XSS — malicious script executes di browser user', fix: 'Sanitize semua input yang di-inject ke HTML' },
    { id: 'C03', file: 'server.ts:69', title: 'dangerouslyAllowBrowser: true di Groq SDK', impact: 'API key exposure risk + disabled security checks', fix: 'Hapus flag' },
    { id: 'C04', file: 'src/routes/payments.ts:62,146,389,468,552', title: 'Payment Endpoints Tanpa Auth', impact: 'Siapapun bisa buat pembayaran, verify receipt, habiskan points', fix: 'Tambahkan requireAuth + requireRole' },
    { id: 'C05', file: 'src/routes/transactions.ts:641-697', title: 'Transaction Cancel Tanpa Auth (IDOR)', impact: 'Siapapun bisa cancel transaksi pending', fix: 'Tambahkan auth check' },
    { id: 'C06', file: 'src/routes/diagnostics.ts:112', title: 'Auth Bypass di Diagnostics Route', impact: 'Admin endpoint bisa diakses publik', fix: 'Import requireAuth dari middleware' },
    { id: 'C07', file: 'src/routes/payments.ts', title: 'Non-Atomic Payment Flows', impact: 'Jika crash antara status update dan stock deduction', fix: 'Gabungkan ke satu operasi atomic' },
    { id: 'C08', file: 'src/routes/payments.ts:267', title: 'Manual Verify Tidak Memanggil Stock Deduction', impact: 'Stock tidak terpotong untuk pembayaran manual', fix: 'Tambahkan commitTransactionStock() call' },
    { id: 'C09', file: 'supabase-schema.sql', title: 'Schema Drift', impact: 'Developer baru bisa deploy schema yang salah', fix: 'Regenerate schema dari deployed state' },
    { id: 'C10', file: '.env (commit 5b5e51d)', title: '.env Ter-commit ke Git History', impact: 'Semua production secrets ter-expose', fix: 'Rotate semua keys + clean git history' },
    { id: 'C11', file: 'src/routes/digital.ts:713-714', title: 'Expected HMAC Signature Logged', impact: 'Attacker bisa forge valid webhook', fix: 'Log hanya invalid, jangan log expected value' },
    { id: 'C12', file: 'src/routes/admin.ts:52', title: 'Weak Temp Password (Math.random)', impact: 'Password bisa di-brute force', fix: 'Gunakan crypto.randomBytes()' },
    { id: 'C13', file: 'src/services/payment.js:34-36', title: 'Non-Atomic Points Update', impact: 'Concurrent requests bisa overwrite points', fix: 'Gunakan atomic increment' },
    { id: 'C14', file: 'src/pages/portal/PortalPengumuman.tsx:348', title: 'XSS via dangerouslySetInnerHTML', impact: 'Script execution di browser user', fix: 'Gunakan sanitizeRichTextHtml()' },
    { id: 'C15', file: 'src/routes/digital.ts:706-738', title: 'Digiflazz Callback Signature Bypass', impact: 'Callback diterima tanpa valid signature', fix: 'Reject callback tanpa valid signature' },
  ],

  major: [
    { id: 'M01', file: 'src/pages/kiosk/Checkout.tsx:46,213', title: 'Checkout Mutex Tidak di-Reset', impact: 'Setelah 1 gagal transaksi, tidak bisa buat transaksi lagi', fix: 'Tambahkan finally { isCreatingTx.current = false; }' },
    { id: 'M02', file: 'src/store/useCartStore.ts:46-89', title: 'Stale Cart Stock', impact: 'User bisa beli melebihi stock tersedia', fix: 'Re-validate stock sebelum checkout' },
    { id: 'M03', file: 'src/pages/dashboard/DashboardLayout.tsx:156', title: 'Seller Phone Input Kosong', impact: 'Phone tidak muncul meskipun sudah diisi', fix: 'Gunakan useEffect untuk sync' },
    { id: 'M04', file: 'src/pages/dashboard/admin/AdminScanner.tsx:168-198', title: 'AdminScanner Lock Permanen', impact: 'Scanner disabled permanen setelah error', fix: 'Tambahkan finally { isLocked = false; }' },
    { id: 'M05', file: 'src/pages/kiosk/Profile.tsx:53-56', title: 'Profile Input Reset', impact: 'User input di-overwrite saat mengetik', fix: 'Gunakan local state' },
    { id: 'M06', file: 'src/services/email.js:26-31', title: 'Email Transport Leak', impact: 'SMTP connection leak, Gmail rate limiting', fix: 'Reuse transport' },
    { id: 'M07', file: 'src/services/background-jobs.js:340', title: 'Memory Leak di notifiedProgramStarts', impact: 'Set grows unbounded, memory leak', fix: 'Batasi ukuran atau gunakan TTL' },
    { id: 'M08', file: 'src/services/digiflazz.js:59-65', title: 'writeFileSync Blocking Event Loop', impact: 'Server freeze saat write cache', fix: 'Gunakan async write' },
    { id: 'M09', file: 'src/routes/auth.ts:199', title: 'Weak Password Policy', impact: 'Password mudah di-brute force', fix: 'Minimum 8 karakter + complexity' },
    { id: 'M10', file: 'Multiple routes', title: 'Verbose Error Messages', impact: 'Internal errors ter-expose ke attacker', fix: 'Return generic error' },
    { id: 'M11', file: 'server.ts', title: 'Missing Compression', impact: 'Response 3-5x lebih besar dari necessary', fix: 'Tambahkan compression middleware' },
    { id: 'M12', file: 'src/routes/portal.ts:458', title: 'Portal Checkout No Auth', impact: 'Payment fraud via userId spoofing', fix: 'Ambil userId dari token' },
    { id: 'M13', file: 'Database', title: 'Missing Composite Indexes', impact: 'Query lambat', fix: 'Tambahkan index via migration' },
    { id: 'M14', file: 'src/services/background-jobs.js', title: 'N+1 Queries di Background Jobs', impact: '50+ DB calls per cycle', fix: 'Batch queries + Promise.all' },
    { id: 'M15', file: 'src/services/stock.js:392-397', title: 'N+1 di Stock Reconciliation', impact: 'Query per product', fix: 'Single query + group in memory' },
    { id: 'M16', file: 'Multiple endpoints', title: 'Missing Caching', impact: 'Analytics lambat', fix: 'In-memory cache dengan TTL' },
    { id: 'M17', file: '76 instances', title: '.select(*) Overfetching', impact: 'Payload besar', fix: 'Explicit column selection' },
    { id: 'M18', file: 'portal.ts, admin.ts', title: 'Unbounded Queries', impact: 'Query tanpa limit', fix: 'Tambahkan pagination' },
    { id: 'M19', file: 'src/routes/misc.ts:576', title: 'Missing Auth on /api/reports', impact: 'Data ter-expose', fix: 'Tambahkan requireAuth' },
    { id: 'M20', file: 'src/routes/withdrawals.ts:27', title: 'Seller Balance Restoration Non-Atomic', impact: 'Race condition', fix: 'Fetch current balance' },
    { id: 'M21', file: '100+ <img> tags', title: 'Missing Image Lazy Loading', impact: 'Slow initial load', fix: 'Tambahkan loading="lazy"' },
    { id: 'M22', file: 'src/App.tsx:162-175', title: 'Auth State Stale', impact: 'Cross-account data leakage', fix: 'Hapus isAuthInit gate' },
    { id: 'M23', file: 'Multiple components', title: 'Z-index Conflicts', impact: 'Visual overlap', fix: 'Standardisasi z-index scale' },
  ],

  minor: [
    { id: 'm01', file: 'Multiple', title: 'Missing aria-label', fix: 'Tambahkan a11y attributes' },
    { id: 'm02', file: 'server.ts:102', title: 'CSP allows unsafe-inline/eval', fix: 'Hapus unsafe directives' },
    { id: 'm03', file: 'server.ts:74', title: 'trust proxy = 1', fix: 'Verify di belakang proxy' },
    { id: 'm04', file: 'src/middleware/auth.ts:20', title: 'getUser DB call setiap request', fix: 'Cache session' },
    { id: 'm05', file: 'src/services/stock.js:48', title: 'Silent error catch', fix: 'Tambahkan logging' },
    { id: 'm06', file: 'src/routes/misc.ts:546', title: 'Log injection', fix: 'Sanitize log input' },
    { id: 'm07', file: 'src/services/email.js:82', title: 'HTML injection di email', fix: 'Escape HTML' },
    { id: 'm08', file: 'src/routes/transactions.ts:699-725', title: 'IDOR seller data', fix: 'Tambahkan auth check' },
    { id: 'm09', file: 'server.ts:249-256', title: 'VA number logged', fix: 'Hapus dari log' },
    { id: 'm10', file: 'src/services/payment.js:32', title: 'NaN handling', fix: 'Tambahkan Number.isNaN check' },
    { id: 'm11', file: 'Multiple', title: 'Duplicate routes (trailing slash)', fix: 'Hapus duplikat' },
    { id: 'm12', file: 'DashboardLayout.tsx:277-420', title: 'Nav recreate setiap render', fix: 'Memoize' },
    { id: 'm13', file: 'DashboardLayout.tsx:145', title: 'Hardcoded SARIROTI_EMAILS', fix: 'Pindah ke constant' },
    { id: 'm14', file: 'src/routes/admin.ts:6-15', title: 'Redundant auth check', fix: 'Konsolidasi ke global middleware' },
    { id: 'm15', file: 'src/routes/diagnostics.ts:67-109', title: 'Debug routes leak data', fix: 'Hapus di production' },
    { id: 'm16', file: 'background-jobs.js:26', title: 'dailyReport 60s interval', fix: 'Kurangi ke 5 menit' },
    { id: 'm17', file: 'App.tsx:120-130', title: 'Reload loop risk', fix: 'Tambahkan max retry' },
    { id: 'm18', file: 'server.ts:276-278', title: 'Interval pileup risk', fix: 'Tambahkan guard' },
    { id: 'm19', file: 'Multiple', title: 'Missing Suspense boundaries', fix: 'Tambahkan fallback' },
    { id: 'm20', file: 'src/routes/portal.ts:16', title: 'Missing points_history index', fix: 'Tambahkan index' },
  ],

  silent: [
    { id: 's01', file: 'KioskLayout.tsx:64-77', title: 'Error swallowed tanpa feedback', impact: 'User tidak tahu API error' },
    { id: 's02', file: 'AdminDashboard.tsx:183-184', title: 'Promise.all catch = null', impact: 'Dashboard kosong tanpa penjelasan' },
    { id: 's03', file: 'PortalFormView.tsx:212-215', title: 'Registration check gagal silent', impact: 'Bisa daftar duplikat' },
    { id: 's04', file: 'useCartStore.ts:71-78', title: 'updateQuantity(0) tidak remove', impact: 'Zombie items, cart count salah' },
    { id: 's05', file: 'History.tsx:67-82', title: 'Polling timeout setelah unmount', impact: 'State update on unmounted' },
    { id: 's06', file: 'App.tsx:120-130', title: 'Reload loop pada chunk error', impact: 'Infinite reload' },
    { id: 's07', file: 'stock.ts:14', title: 'Insert error tidak di-handle', impact: 'Stock request gagal silent' },
    { id: 's08', file: 'withdrawals.ts:62', title: 'Balance restore error tidak di-handle', impact: 'Seller rugi tanpa trace' },
    { id: 's09', file: 'payments.ts:92', title: 'API key missing → empty string', impact: 'Groq calls gagal unhelpful' },
    { id: 's10', file: 'Multiple', title: '@ts-nocheck disables type safety', impact: 'Null checks terlewat' },
  ],

  priority_fixes: [
    { priority: 1, items: ['C04', 'C05', 'C06', 'C01', 'C02', 'C03', 'C10', 'C13', 'C14', 'C08'], timeframe: 'Minggu Ini' },
    { priority: 2, items: ['M01', 'M06', 'M07', 'M08', 'M11', 'M13', 'M14', 'M16', 'M17'], timeframe: '2 Minggu' },
    { priority: 3, items: ['Semua MINOR + SILENT'], timeframe: 'Bulanan' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// GENERATORS
// ═══════════════════════════════════════════════════════════════

function generateMarkdown(data) {
  let md = `# System Audit Report — SPS Corner v${data.version}\n`;
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

  // Critical
  md += `## 1. CRITICAL\n\n`;
  md += `| ID | File | Masalah | Dampak | Fix |\n|----|------|---------|--------|-----|\n`;
  for (const item of data.critical) {
    md += `| ${item.id} | \`${item.file}\` | ${item.title} | ${item.impact} | ${item.fix} |\n`;
  }
  md += `\n`;

  // Major
  md += `## 2. MAJOR\n\n`;
  md += `| ID | File | Masalah | Fix |\n|----|------|---------|-----|\n`;
  for (const item of data.major) {
    md += `| ${item.id} | \`${item.file}\` | ${item.title} | ${item.fix} |\n`;
  }
  md += `\n`;

  // Minor
  md += `## 3. MINOR\n\n`;
  md += `| ID | File | Masalah | Fix |\n|----|------|---------|-----|\n`;
  for (const item of data.minor) {
    md += `| ${item.id} | \`${item.file}\` | ${item.title} | ${item.fix} |\n`;
  }
  md += `\n`;

  // Silent
  md += `## 4. SILENT\n\n`;
  md += `| ID | File | Masalah | Dampak |\n|----|------|---------|--------|\n`;
  for (const item of data.silent) {
    md += `| ${item.id} | \`${item.file}\` | ${item.title} | ${item.impact} |\n`;
  }
  md += `\n`;

  // Priority
  md += `## 5. PRIORITAS PERBAIKAN\n\n`;
  for (const p of data.priority_fixes) {
    md += `### Priority ${p.priority} — ${p.timeframe}\n`;
    md += `- ${p.items.join(', ')}\n\n`;
  }

  md += `---\n\n`;
  md += `*Audit ini dibuat pada ${data.date} oleh AI Agent (opencode)*\n`;

  return md;
}

function generateWord(data) {
  const headerStyle = { bold: true, size: 24, font: 'Calibri' };
  const cellStyle = { size: 20, font: 'Calibri' };

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
    return new Paragraph({ children: [new TextRun({ text, bold, size: 22, font: 'Calibri' })] });
  }

  const children = [
    new Paragraph({
      children: [new TextRun({ text: `System Audit Report — v${data.version}`, bold: true, size: 36, font: 'Calibri' })],
      spacing: { after: 100 },
    }),
    makePara(`Tanggal: ${data.date} | Scope: ${data.scope}`),
    makePara(''),

    // Summary
    makeHeading('RINGKASAN'),
    makeTable(
      ['Severity', 'Jumlah'],
      [
        ['CRITICAL', String(data.summary.critical)],
        ['MAJOR', String(data.summary.major)],
        ['MINOR', String(data.summary.minor)],
        ['SILENT', String(data.summary.silent)],
        ['Total', String(data.summary.total)],
      ]
    ),

    // Critical
    makeHeading('1. CRITICAL'),
    makeTable(
      ['ID', 'File', 'Masalah', 'Dampak', 'Fix'],
      data.critical.map(c => [c.id, c.file, c.title, c.impact, c.fix])
    ),

    // Major
    makeHeading('2. MAJOR'),
    makeTable(
      ['ID', 'File', 'Masalah', 'Fix'],
      data.major.map(m => [m.id, m.file, m.title, m.fix])
    ),

    // Silent
    makeHeading('4. SILENT'),
    makeTable(
      ['ID', 'File', 'Masalah', 'Dampak'],
      data.silent.map(s => [s.id, s.file, s.title, s.impact])
    ),
  ];

  return new Document({
    sections: [{ children }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });
}

function generateExcel(data) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['System Audit Report', `v${data.version}`, data.date],
    [''],
    ['Severity', 'Jumlah'],
    ['CRITICAL', data.summary.critical],
    ['MAJOR', data.summary.major],
    ['MINOR', data.summary.minor],
    ['SILENT', data.summary.silent],
    ['Total', data.summary.total],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Critical
  const criticalData = [['ID', 'File', 'Masalah', 'Dampak', 'Fix']];
  for (const item of data.critical) {
    criticalData.push([item.id, item.file, item.title, item.impact, item.fix]);
  }
  const wsCritical = XLSX.utils.aoa_to_sheet(criticalData);
  wsCritical['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 45 }, { wch: 50 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsCritical, 'Critical');

  // Sheet 3: Major
  const majorData = [['ID', 'File', 'Masalah', 'Fix']];
  for (const item of data.major) {
    majorData.push([item.id, item.file, item.title, item.fix]);
  }
  const wsMajor = XLSX.utils.aoa_to_sheet(majorData);
  wsMajor['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 45 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMajor, 'Major');

  // Sheet 4: Minor
  const minorData = [['ID', 'File', 'Masalah', 'Fix']];
  for (const item of data.minor) {
    minorData.push([item.id, item.file, item.title, item.fix]);
  }
  const wsMinor = XLSX.utils.aoa_to_sheet(minorData);
  wsMinor['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 45 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMinor, 'Minor');

  // Sheet 5: Silent
  const silentData = [['ID', 'File', 'Masalah', 'Dampak']];
  for (const item of data.silent) {
    silentData.push([item.id, item.file, item.title, item.impact]);
  }
  const wsSilent = XLSX.utils.aoa_to_sheet(silentData);
  wsSilent['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 45 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsSilent, 'Silent');

  // Sheet 6: Priority Fix
  const priorityData = [['Priority', 'Timeframe', 'Items']];
  for (const p of data.priority_fixes) {
    priorityData.push([String(p.priority), p.timeframe, p.items.join(', ')]);
  }
  const wsPriority = XLSX.utils.aoa_to_sheet(priorityData);
  wsPriority['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 80 }];
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
