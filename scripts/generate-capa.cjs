// @ts-nocheck
/**
 * CAPA Document Generator
 * Generates documentation in 3 formats:
 * - Markdown (.md) — for AI agents + developers
 * - Word (.docx) — for non-technical stakeholders
 * - Excel (.xlsx) — for tracking checklist + test cases
 *
 * Usage: node scripts/generate-capa.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel } = require('docx');

// ═══════════════════════════════════════════════════════════════
// CAPA DATA — Edit this section for each new incident
// ═══════════════════════════════════════════════════════════════

const CAPA_DATA = {
  version: '5.16.2',
  title: 'Fix Lengkap: Stock Deduction, Seller Balance, iPaymu Callback + Auto-Reconcile',
  date: '2026-07-21',

  // Ringkasan Insiden
  incident: {
    summary: 'Transaksi paid/success lolos tanpa stock terpotong dan saldo seller tidak ter-settle',
    impact: '34 transaksi (19-20 Juli 2026) + 88 transaksi historis (Juni 2026) terdampak',
    financial_loss: 'Rp 8.260 (hanya 2 transaksi historis)',
    operational_loss: 'Stock sistem tidak akurat, seller tidak melihat pesanan masuk',
    duration: '~2 hari (19-20 Juli 2026)',
    status: 'RESOLVED',
  },

  // Root Cause Analysis
  rca: [
    {
      id: 'RCA-1',
      name: 'PostgREST `.or()` + `metadata->>` Crash',
      what_happened: 'Query Supabase di stock.js menggunakan .or() dengan metadata->> JSONB arrow syntax',
      error: 'column transactions.metadata does not exist',
      location: 'src/services/stock.js — 4 fungsi: restoreTransactionStock, deductTransactionStock, commitTransactionStock',
      root_cause: 'PostgREST .or() parser tidak menangani kombinasi and() groups + metadata->> JSONB extraction',
      fix: 'Ganti .or() + metadata->> dengan .not(\'metadata\', \'cs\', ...) yang menggunakan operator JSONB @>',
    },
    {
      id: 'RCA-2',
      name: 'Forced-to-Paid Path Skip Stock/Balance',
      what_happened: 'iPaymu callback "failed" dengan delivered digital items → status dipaksa "paid" → early return SEBELUM stock/balance diproses',
      error: 'Tidak ada error — silent failure',
      location: 'src/routes/payments.ts:702-734',
      root_cause: 'Early return di path digital items sebelum pemanggilan stock/balance processing',
      fix: 'Guard tambahan + pastikan semua payment path selalu memanggil stock/balance processing',
    },
    {
      id: 'RCA-3',
      name: 'QRIS Pending + Auto-Cleanup Race Condition',
      what_happened: 'QRIS transaction dibuat "pending" → auto-cleanup kembalikan stock → callback iPaymu datang → deductTransactionStock() return early karena stock_deducted=false',
      error: 'Tidak ada error — stock tidak di-re-deduct',
      location: 'src/services/stock.js — deductTransactionStock()',
      root_cause: 'deductTransactionStock() return early jika stock_deducted=false tanpa fallback ke commitTransactionStock()',
      fix: 'deductTransactionStock() sekarang handle kasus stock_deducted=false dengan fallback ke commitTransactionStock()',
    },
    {
      id: 'RCA-4',
      name: 'iPaymu Status Mapping Hilang',
      what_happened: 'Status iPaymu "berhasil"/"gagal" tidak di-mapping ke "paid"/"failed"',
      error: 'Tidak ada error — callback jatuh ke "pending"',
      location: 'src/routes/payments.ts — iPaymu callback handler',
      root_cause: 'Pemetaan status iPaymu yang sebelumnya dihapus',
      fix: 'Kembalikan pemetaan status "berhasil"/"gagal" di callback iPaymu',
    },
  ],

  // Corrective Actions
  corrective: [
    { file: 'src/services/stock.js', change: 'Ganti 4 query .or() + metadata->> → .not(\'metadata\', \'cs\', ...)' },
    { file: 'src/services/stock.js', change: 'Tambah koperasi fallback di commitTransactionStock()' },
    { file: 'src/routes/payments.ts', change: 'Tambah stock_deducted guard (line 311, 755)' },
    { file: 'src/routes/payments.ts', change: 'Fix iPaymu status mapping (line 653-659)' },
    { file: 'src/routes/payments.ts', change: 'Hapus early return di forced-to-paid path (line 705-710)' },
    { file: 'src/routes/transactions.ts', change: 'Tambah commitTransactionStock fallback di admin approve' },
    { file: 'src/pages/kiosk/History.tsx', change: 'Sembunyikan tombol "Upload Ulang" untuk QRIS otomatis' },
  ],

  // Preventive Actions
  preventive: [
    { layer: 'Detection', component: 'find_stock_balance_mismatches()', mechanism: 'DB function — query mismatch kapan saja' },
    { layer: 'Auto-Fix', component: 'autoReconcileTransactions()', mechanism: 'Background job — fix otomatis tiap 5 menit' },
    { layer: 'Monitoring', component: 'GET /api/admin/reconciliation/status', mechanism: 'API endpoint — dashboard admin' },
  ],

  // Rules & Prohibitions
  rules: [
    {
      prohibition: 'DILARANG gunakan .or() + metadata->> di Supabase query',
      instruction: 'Gunakan .not(\'metadata\', \'cs\', JSON.stringify({key: value})) sebagai pengganti',
      reference: 'docs/CAPA-v5.16.2.md',
    },
    {
      prohibition: 'DILARANG ada early return SEBELUM stock deduction + seller balance settlement',
      instruction: 'Setiap payment path WAJIB panggil stock + balance processing',
      reference: 'docs/CAPA-v5.16.2.md section 5.2',
    },
    {
      prohibition: 'DILARANG nonaktifkan background job autoReconcileTransactions()',
      instruction: 'Jika perlu dinonaktifkan, WAJIB ada pengganti',
      reference: 'docs/CAPA-v5.16.2.md',
    },
  ],

  // Test Cases
  test_cases: [
    { id: 'TC-01', scenario: 'Checkout produk fisik via QRIS', expected: 'Stock terpotong, seller balance masuk', status: 'PASS' },
    { id: 'TC-02', scenario: 'Checkout produk fisik via manual transfer', expected: 'Stock terpotong, seller balance masuk', status: 'PASS' },
    { id: 'TC-03', scenario: 'Checkout produk fisik via loyalty points', expected: 'Stock terpotong, seller balance masuk', status: 'PASS' },
    { id: 'TC-04', scenario: 'iPaymu callback "paid"', expected: 'Stock terpotong, seller balance masuk', status: 'PASS' },
    { id: 'TC-05', scenario: 'iPaymu callback "failed" (tanpa digital)', expected: 'Stock dikembalikan, status "failed"', status: 'PASS' },
    { id: 'TC-06', scenario: 'iPaymu callback "failed" (dengan digital delivered)', expected: 'Status tetap "paid", stock tetap dipotong', status: 'PASS' },
    { id: 'TC-07', scenario: 'Admin approve transaksi manual', expected: 'Stock terpotong, seller balance masuk', status: 'PASS' },
    { id: 'TC-08', scenario: 'Auto-cleanup transaksi expired', expected: 'Stock dikembalikan, status "failed"', status: 'PASS' },
    { id: 'TC-09', scenario: 'Late callback setelah auto-cleanup', expected: 'Stock di-re-deduct, seller balance masuk', status: 'PASS' },
    { id: 'TC-10', scenario: 'Checkout koperasi (seller_id = null)', expected: 'Stock terpotong, admin dapat notifikasi', status: 'PASS' },
    { id: 'TC-11', scenario: 'GET /api/admin/reconciliation/status', expected: 'Return status "healthy"', status: 'PASS' },
    { id: 'TC-12', scenario: 'Background job auto-reconcile', expected: 'Mismatch terdeteksi dan fix otomatis', status: 'PASS' },
  ],

  // Files Changed
  files_changed: [
    'src/services/stock.js',
    'src/routes/payments.ts',
    'src/routes/transactions.ts',
    'src/services/background-jobs.js',
    'src/routes/diagnostics.ts',
    'src/pages/kiosk/History.tsx',
    'server.ts',
    'package.json',
    'changelog.txt',
    'AGENTS.md',
    'docs/CAPA-v5.16.2.md',
    'scripts/reconcile_fn.sql',
  ],
};

// ═══════════════════════════════════════════════════════════════
// GENERATOR — Don't edit below this line
// ═══════════════════════════════════════════════════════════════

function generateMarkdown(data) {
  let md = `# CAPA — Corrective & Preventive Action\n`;
  md += `## SPS Corner v${data.version} | ${data.date}\n\n`;
  md += `---\n\n`;

  // 1. Ringkasan Insiden
  md += `## 1. RINGKASAN INSIDEN\n\n`;
  md += `| Item | Keterangan |\n|------|-----------|\n`;
  md += `| **Insiden** | ${data.incident.summary} |\n`;
  md += `| **Dampak** | ${data.incident.impact} |\n`;
  md += `| **Kerugian Finansial** | ${data.incident.financial_loss} |\n`;
  md += `| **Kerugian Operasional** | ${data.incident.operational_loss} |\n`;
  md += `| **Durasi** | ${data.incident.duration} |\n`;
  md += `| **Status** | ${data.incident.status} |\n\n`;

  // 2. Root Cause Analysis
  md += `## 2. ROOT CAUSE ANALYSIS (RCA)\n\n`;
  for (const rca of data.rca) {
    md += `### 2.${data.rca.indexOf(rca) + 1} ${rca.name}\n\n`;
    md += `| Item | Keterangan |\n|------|-----------|\n`;
    md += `| **Apa yang terjadi** | ${rca.what_happened} |\n`;
    md += `| **Error** | \`${rca.error}\` |\n`;
    md += `| **Lokasi** | \`${rca.location}\` |\n`;
    md += `| **Root Cause** | ${rca.root_cause} |\n`;
    md += `| **Fix** | ${rca.fix} |\n\n`;
  }

  // 3. Corrective Actions
  md += `## 3. KOREKTIF (APA YANG DIPERBAIKI)\n\n`;
  md += `| File | Perubahan |\n|------|----------|\n`;
  for (const fix of data.corrective) {
    md += `| \`${fix.file}\` | ${fix.change} |\n`;
  }
  md += `\n`;

  // 4. Preventive Actions
  md += `## 4. PENCEGAHAN (APA YANG DITAMBAHKAN)\n\n`;
  md += `| Layer | Komponen | Mekanisme |\n|-------|----------|-----------|\n`;
  for (const prev of data.preventive) {
    md += `| ${prev.layer} | \`${prev.component}\` | ${prev.mechanism} |\n`;
  }
  md += `\n`;

  // 5. Rules & Prohibitions
  md += `## 5. PENCEGAHAN MASA DEPAN — RULES BARU\n\n`;
  for (const rule of data.rules) {
    md += `❌ **LARANGAN:** ${rule.prohibition}\n`;
    md += `✅ **PERINTAH:** ${rule.instruction}\n`;
    md += `📄 **REFERENSI:** ${rule.reference}\n\n`;
  }

  // 6. Test Cases
  md += `## 6. VERIFIKASI & TESTING\n\n`;
  md += `| # | Skenario | Expected Result | Status |\n|---|----------|-----------------|--------|\n`;
  for (const tc of data.test_cases) {
    md += `| ${tc.id} | ${tc.scenario} | ${tc.expected} | ${tc.status} |\n`;
  }
  md += `\n`;

  // 7. Files Changed
  md += `## 7. FILES YANG DIUBAH\n\n`;
  for (const file of data.files_changed) {
    md += `- \`${file}\`\n`;
  }
  md += `\n---\n\n`;
  md += `*Dokumen ini dibuat pada ${data.date} oleh AI Agent (opencode)*\n`;

  return md;
}

function generateWord(data) {
  const headerStyle = { bold: true, size: 28, font: 'Calibri' };
  const cellStyle = { size: 22, font: 'Calibri' };
  const boldCellStyle = { ...cellStyle, bold: true };

  function makeRow(cells, isHeader = false) {
    return new TableRow({
      children: cells.map(cell => new TableCell({
        width: { size: isHeader ? 2500 : 7500 / cells.length, type: WidthType.DXA },
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
    // Title
    new Paragraph({
      children: [new TextRun({ text: `CAPA — v${data.version}`, bold: true, size: 36, font: 'Calibri' })],
      spacing: { after: 100 },
    }),
    makePara(data.date),
    makePara(''),

    // 1. Ringkasan Insiden
    makeHeading('1. RINGKASAN INSIDEN'),
    makeTable(
      ['Item', 'Keterangan'],
      [
        ['Insiden', data.incident.summary],
        ['Dampak', data.incident.impact],
        ['Kerugian Finansial', data.incident.financial_loss],
        ['Kerugian Operasional', data.incident.operational_loss],
        ['Durasi', data.incident.duration],
        ['Status', data.incident.status],
      ]
    ),

    // 2. Root Cause Analysis
    makeHeading('2. ROOT CAUSE ANALYSIS (RCA)'),
    ...data.rca.flatMap((rca, i) => [
      makeHeading(`2.${i + 1} ${rca.name}`, HeadingLevel.HEADING_3),
      makeTable(
        ['Item', 'Keterangan'],
        [
          ['Apa yang terjadi', rca.what_happened],
          ['Error', rca.error],
          ['Lokasi', rca.location],
          ['Root Cause', rca.root_cause],
          ['Fix', rca.fix],
        ]
      ),
    ]),

    // 3. Corrective Actions
    makeHeading('3. KOREKTIF (APA YANG DIPERBAIKI)'),
    makeTable(
      ['File', 'Perubahan'],
      data.corrective.map(f => [f.file, f.change])
    ),

    // 4. Preventive Actions
    makeHeading('4. PENCEGAHAN (APA YANG DITAMBAHKAN)'),
    makeTable(
      ['Layer', 'Komponen', 'Mekanisme'],
      data.preventive.map(p => [p.layer, p.component, p.mechanism])
    ),

    // 5. Rules
    makeHeading('5. RULES BARU'),
    ...data.rules.flatMap(rule => [
      makePara(`❌ LARANGAN: ${rule.prohibition}`, true),
      makePara(`✅ PERINTAH: ${rule.instruction}`),
      makePara(`📄 REFERENSI: ${rule.reference}`),
      makePara(''),
    ]),

    // 6. Test Cases
    makeHeading('6. VERIFIKASI & TESTING'),
    makeTable(
      ['#', 'Skenario', 'Expected Result', 'Status'],
      data.test_cases.map(tc => [tc.id, tc.scenario, tc.expected, tc.status])
    ),

    // 7. Files Changed
    makeHeading('7. FILES YANG DIUBAH'),
    ...data.files_changed.map(f => makePara(`• ${f}`)),
  ];

  return new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
  });
}

function generateExcel(data) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan
  const summaryData = [
    ['CAPA Ringkasan', `v${data.version}`, data.date],
    [''],
    ['Item', 'Keterangan'],
    ['Insiden', data.incident.summary],
    ['Dampak', data.incident.impact],
    ['Kerugian Finansial', data.incident.financial_loss],
    ['Durasi', data.incident.duration],
    ['Status', data.incident.status],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 60 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // Sheet 2: RCA
  const rcaData = [['ID', 'Nama Bug', 'Apa yang Terjadi', 'Error', 'Lokasi', 'Root Cause', 'Fix']];
  for (const rca of data.rca) {
    rcaData.push([rca.id, rca.name, rca.what_happened, rca.error, rca.location, rca.root_cause, rca.fix]);
  }
  const wsRca = XLSX.utils.aoa_to_sheet(rcaData);
  wsRca['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 50 }, { wch: 35 }, { wch: 40 }, { wch: 50 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsRca, 'RCA');

  // Sheet 3: Test Cases
  const tcData = [['ID', 'Skenario', 'Expected Result', 'Status']];
  for (const tc of data.test_cases) {
    tcData.push([tc.id, tc.scenario, tc.expected, tc.status]);
  }
  const wsTc = XLSX.utils.aoa_to_sheet(tcData);
  wsTc['!cols'] = [{ wch: 10 }, { wch: 45 }, { wch: 45 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsTc, 'Test Cases');

  // Sheet 4: Rules
  const rulesData = [['❌ LARANGAN', '✅ PERINTAH', '📄 REFERENSI']];
  for (const rule of data.rules) {
    rulesData.push([rule.prohibition, rule.instruction, rule.reference]);
  }
  const wsRules = XLSX.utils.aoa_to_sheet(rulesData);
  wsRules['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsRules, 'Rules');

  // Sheet 5: Files Changed
  const filesData = [['File yang Diubah']];
  for (const file of data.files_changed) {
    filesData.push([file]);
  }
  const wsFiles = XLSX.utils.aoa_to_sheet(filesData);
  wsFiles['!cols'] = [{ wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsFiles, 'Files Changed');

  return wb;
}

// ═══════════════════════════════════════════════════════════════
// MAIN — Generate all formats
// ═══════════════════════════════════════════════════════════════

async function main() {
  const outputDir = path.join(__dirname, '..', 'docs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const baseName = `CAPA-v${CAPA_DATA.version}`;

  // 1. Markdown
  const mdContent = generateMarkdown(CAPA_DATA);
  fs.writeFileSync(path.join(outputDir, `${baseName}.md`), mdContent);
  console.log(`✅ Generated: docs/${baseName}.md`);

  // 2. Word
  const doc = generateWord(CAPA_DATA);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(outputDir, `${baseName}.docx`), buffer);
  console.log(`✅ Generated: docs/${baseName}.docx`);

  // 3. Excel
  const wb = generateExcel(CAPA_DATA);
  XLSX.writeFile(wb, path.join(outputDir, `${baseName}.xlsx`));
  console.log(`✅ Generated: docs/${baseName}.xlsx`);

  console.log(`\n📄 All 3 formats generated in docs/`);
}

main().catch(console.error);
