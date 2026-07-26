// @ts-nocheck
let supabaseInstance = null;
let nodemailerInstance = null;
let transporter = null;
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const APP_URL = process.env.APP_URL || 'https://spscorner.store';

export function initEmailService(supabase, nodemailer) {
  supabaseInstance = supabase;
  nodemailerInstance = nodemailer;
  if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    transporter = nodemailerInstance.createTransport({
      service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
}

export async function sendSarirotiEmailInternal(to, subject, html) {
  const gmailUser = process.env.GMAIL_USER || GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.error("GMAIL_USER or GMAIL_APP_PASSWORD not set.");
    return { success: false, error: "GMAIL_USER atau GMAIL_APP_PASSWORD belum diatur." };
  }
  try {
    if (!transporter) {
      transporter = nodemailerInstance.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
        connectionTimeout: 5e3, greetingTimeout: 5e3, socketTimeout: 5e3,
      });
    }
    const info = await transporter.sendMail({ from: `"SPS Corner" <${gmailUser}>`, to, subject, html });
    return { success: true, data: info };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.message || "Unknown email error" };
  }
}

// ─── Shared Email Template ────────────────────────────────────────────────────
// Consistent responsive wrapper for all SPS Corner emails.
// Usage: emailTemplate({ title, subtitle, badge, content, cta, footer })
//   badge   = { text, color } e.g. { text: 'Pesanan Baru', color: '#1d4ed8' }
//   cta     = { text, url }   e.g. { text: 'Lihat Detail', url: 'https://...' }
//   footer  = override footer text (optional)
// ───────────────────────────────────────────────────────────────────────────────
export function emailTemplate({ title, subtitle, badge, content, cta, footer }) {
  const badgeHtml = badge
    ? `<div style="background:#eff6ff;border-left:4px solid ${badge.color || '#3b82f6'};padding:14px 32px;"><p style="margin:0;color:#1e40af;font-size:13px;font-weight:600;">${badge.text}</p></div>`
    : '';
  const ctaHtml = cta
    ? `<div style="text-align:center;margin:28px 0 8px;"><a href="${cta.url}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#fff;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">${cta.text}</a></div>`
    : '';
  const footerText = footer || 'SPS Corner — Koperasi Karyawan SPS';
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} - SPS Corner</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><div style="max-width:620px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#1e40af,#1d4ed8);padding:32px 32px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;line-height:1.3;">${title}</h1><p style="margin:8px 0 0;color:#bfdbfe;font-size:13px;">${subtitle || 'SPS Corner — Koperasi Karyawan'}</p></div>${badgeHtml}<div style="padding:28px 32px;">${content}</div>${ctaHtml}<div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;"><p style="margin:0;font-size:11px;color:#9ca3af;">${footerText} | <a href="${APP_URL}" style="color:#6b7280;">${APP_URL}</a></p></div></div></body></html>`;
}

// ─── Item Table Builder ───────────────────────────────────────────────────────
// Builds a styled item table for transaction emails.
// items = [{ name, quantity, price }]
// opts  = { showSubtotal, showTotal, total, columns: ['name','qty','price','subtotal'] }
// ───────────────────────────────────────────────────────────────────────────────
export function buildItemTable(items, opts = {}) {
  const { showSubtotal = true, showTotal = true, total = 0 } = opts;
  const rows = items.map((item) => {
    const name = item.name || 'Produk';
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const subtotal = price * qty;
    return `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:12px 16px;color:#111827;font-weight:500;font-size:13px;">${name}</td><td style="padding:12px 16px;text-align:center;color:#374151;font-weight:600;font-size:13px;">${qty}</td><td style="padding:12px 16px;text-align:right;color:#374151;font-size:13px;">Rp ${price.toLocaleString('id-ID')}</td>${showSubtotal ? `<td style="padding:12px 16px;text-align:right;color:#1d4ed8;font-weight:700;font-size:13px;">Rp ${subtotal.toLocaleString('id-ID')}</td>` : ''}</tr>`;
  }).join('');
  const totalRow = showTotal
    ? `<tfoot><tr style="background:#f3f4f6;"><td colspan="${showSubtotal ? 3 : 2}" style="padding:12px 16px;font-weight:700;font-size:14px;">Total</td><td style="padding:12px 16px;text-align:right;font-weight:700;font-size:14px;color:#1d4ed8;">Rp ${Number(total).toLocaleString('id-ID')}</td></tr></tfoot>`
    : '';
  return `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><thead><tr style="background:#eff6ff;"><th style="padding:10px 16px;text-align:left;font-size:11px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Produk</th><th style="padding:10px 16px;text-align:center;font-size:11px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Qty</th><th style="padding:10px 16px;text-align:right;font-size:11px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Harga</th>${showSubtotal ? `<th style="padding:10px 16px;text-align:right;font-size:11px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Subtotal</th>` : ''}</tr></thead><tbody>${rows}</tbody>${totalRow}</table>`;
}

// ─── Info Row Builder ─────────────────────────────────────────────────────────
// Builds a key-value info row for email details sections.
// rows = [{ label, value, bold?, color?, mono? }]
// ───────────────────────────────────────────────────────────────────────────────
export function buildInfoRows(rows) {
  return `<table style="width:100%;">${rows.map(r => `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%;">${r.label}</td><td style="padding:6px 0;color:${r.color || '#111827'};font-size:13px;font-weight:${r.bold ? '700' : '600'}${r.mono ? ';font-family:monospace' : ''};">: ${r.value}</td></tr>`).join('')}</table>`;
}

// ─── Template: Sariroti Order Notification (Admin Sales) ──────────────────────
export async function triggerSarirotiEmail(tx_id, buyerName, totalAmount) {
  const txShortId = tx_id.slice(0, 8).toUpperCase();
  try {
    // 1. Fetch transaction_items with products join
    const { data: items, error } = await supabaseInstance
      .from("transaction_items")
      .select("*, products(name, category, price, seller_id)")
      .eq("transaction_id", tx_id);
    if (error) throw error;

    if (!items || items.length === 0) {
      console.warn(`[SarirotiEmail] No items found for tx ${txShortId} — skipping`);
      return;
    }

    // 2. Detect koperasi/sariroti items via name/category keywords
    const KEYWORDS = ["sariroti", "sari roti", "roti", "koperasi", "bakery", "bread"];
    const sarirotiItems = items.filter((item) => {
      const name = (item.products?.name || item.metadata?.product_name || "").toLowerCase();
      const category = (item.products?.category || item.metadata?.category || "").toLowerCase();
      return KEYWORDS.some(kw => name.includes(kw) || category.includes(kw));
    });

    // 3. Fallback: if no keyword match, check if seller is a koperasi seller
    //    (seller name contains "sariroti" or "koperasi")
    if (sarirotiItems.length === 0) {
      const sellerIds = [...new Set(items.map(i => i.seller_id).filter(Boolean))];
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabaseInstance
          .from("profiles")
          .select("id, name")
          .in("id", sellerIds);
        const isKoperasiSeller = (s) => {
          const n = (s?.name || "").toLowerCase();
          return KEYWORDS.some(kw => n.includes(kw));
        };
        if (sellers && sellers.some(isKoperasiSeller)) {
          // All items from koperasi sellers → treat as sariroti items
          sarirotiItems.push(...items);
        }
      }
    }

    if (sarirotiItems.length === 0) {
      console.log(`[SarirotiEmail] No sariroti items in tx ${txShortId} — skipping`);
      return;
    }

    // 4. Resolve target email
    let targetEmail = process.env.SARIROTI_ADMIN_EMAIL || "";
    try {
      const { data: settings } = await supabaseInstance
        .from("settings").select("value").eq("key", "sariroti_email").single();
      if (settings?.value) targetEmail = settings.value;
    } catch (e) { /* use default */ }

    if (!targetEmail || !targetEmail.includes("@")) {
      console.error(`[SarirotiEmail] No valid target email for tx ${txShortId}. Set SARIROTI_ADMIN_EMAIL env or settings.sariroti_email.`);
      return;
    }

    // 5. Build email
    const orderDate = new Date().toLocaleString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const itemList = sarirotiItems.map(item => ({
      name: item.products?.name || item.metadata?.product_name || "Produk Koperasi",
      quantity: item.quantity || 1,
      price: item.price || 0,
    }));
    const sarirotiSubtotal = sarirotiItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

    const content = `
      <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;">Informasi Pemesan</h2>
      ${buildInfoRows([
        { label: 'Nama Pemesan', value: buyerName, bold: true },
        { label: 'ID Transaksi', value: '#' + txShortId, bold: true, color: '#1d4ed8', mono: true },
        { label: 'Tanggal & Waktu', value: orderDate },
      ])}
      <h2 style="margin:24px 0 12px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;">Daftar Item Roti</h2>
      ${buildItemTable(itemList, { showSubtotal: true, showTotal: true, total: sarirotiSubtotal })}
    `;

    const emailHtml = emailTemplate({
      title: 'Pesanan Roti Koperasi',
      subtitle: 'SPS Corner — Koperasi Karyawan',
      badge: { text: 'Ada pesanan baru yang membutuhkan konfirmasi dari Admin Sales Sariroti.', color: '#3b82f6' },
      content,
      cta: { text: 'Buka Dashboard & Konfirmasi', url: `${APP_URL}/dashboard/seller/transactions?id=${tx_id}` },
    });

    // 6. Send email with retry
    let result = await sendSarirotiEmailInternal(targetEmail, `[SPS Corner] Pesanan Roti Baru #${txShortId} dari ${buyerName}`, emailHtml);
    if (!result.success) {
      console.warn(`[SarirotiEmail] First attempt failed for ${txShortId}, retrying in 3s...`, result.error);
      await new Promise(r => setTimeout(r, 3000));
      result = await sendSarirotiEmailInternal(targetEmail, `[SPS Corner] Pesanan Roti Baru #${txShortId} dari ${buyerName}`, emailHtml);
    }
    if (result.success) {
      console.log(`[SarirotiEmail] Sent to ${targetEmail} for tx ${txShortId}`);
    } else {
      console.error(`[SarirotiEmail] FAILED for tx ${txShortId} after retry:`, result.error);
    }
  } catch (e) {
    console.error(`[SarirotiEmail] Error for tx ${txShortId}:`, e);
  }
}

// ─── Template: Buyer Receipt (Nota Pembelian) ────────────────────────────────
export async function sendBuyerReceiptEmail(tx_id, email, name, items, total) {
  if (!email) return;
  try {
    const txShortId = tx_id.slice(0, 8).toUpperCase();
    const orderDate = new Date().toLocaleString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const itemList = (items || []).map(i => ({
      name: i.name || i.product_name || 'Produk',
      quantity: i.quantity || 1,
      price: i.price || 0,
    }));

    const content = `
      <p style="margin:0 0 16px;color:#374151;font-size:14px;">Halo <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Terima kasih telah berbelanja. Berikut detail pesanan Anda:</p>
      <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;">Detail Pesanan</h2>
      ${buildItemTable(itemList, { showSubtotal: true, showTotal: true, total })}
      <div style="margin-top:16px;">
        ${buildInfoRows([
          { label: 'ID Transaksi', value: '#' + txShortId, bold: true, color: '#1d4ed8', mono: true },
          { label: 'Tanggal', value: orderDate },
        ])}
      </div>
      <p style="margin:16px 0 0;color:#6b7280;font-size:12px;text-align:center;">Pertanyaan? <a href="https://wa.me/62818222604" style="color:#1d4ed8;font-weight:600;">WhatsApp Admin</a></p>
    `;

    const emailHtml = emailTemplate({
      title: 'Nota Pembelian',
      subtitle: 'SPS Corner — Koperasi Karyawan',
      badge: { text: 'Pembayaran telah diterima. Berikut detail pesanan Anda.', color: '#16a34a' },
      content,
      cta: { text: 'Lihat Riwayat Pesanan', url: `${APP_URL}/kiosk/history?id=${tx_id}` },
    });

    await sendSarirotiEmailInternal(email, `Nota Pembelian SPS Corner #${txShortId}`, emailHtml);
  } catch (e) { console.error("sendBuyerReceiptEmail error:", e); }
}

// ─── Template: Buyer Payment Confirmation (Admin Approve) ────────────────────
export function buildBuyerConfirmationEmail(transaction, transaction_id, itemRows) {
  const txShortId = transaction_id.slice(0, 8).toUpperCase();
  const witaTime = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar", dateStyle: "long", timeStyle: "short" });
  const buyerName = transaction.buyer_name || 'Pelanggan';
  const itemList = (transaction.transaction_items || []).map(it => ({
    name: it.name || it.product_name || 'Produk',
    quantity: it.quantity || 1,
    price: (it.price || 0),
  }));

  const content = `
    <p style="margin:0 0 16px;color:#374151;font-size:14px;">Halo <strong>${buyerName}</strong>! Pembayaran Anda telah dikonfirmasi.</p>
    <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;">Detail Pesanan</h2>
    ${buildItemTable(itemList, { showSubtotal: true, showTotal: true, total: transaction.total_amount || 0 })}
    <div style="margin-top:16px;">
      ${buildInfoRows([
        { label: 'ID Transaksi', value: '#' + txShortId, bold: true, color: '#1d4ed8', mono: true },
        { label: 'Waktu', value: witaTime + ' WITA' },
      ])}
    </div>
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px;text-align:center;">Pertanyaan? <a href="https://wa.me/62818222604" style="color:#1d4ed8;font-weight:600;">WhatsApp Admin</a></p>
  `;

  return emailTemplate({
    title: 'Pembayaran Dikonfirmasi',
    subtitle: 'SPS Corner — Koperasi Karyawan',
    badge: { text: 'Pembayaran Anda telah berhasil dikonfirmasi oleh admin.', color: '#16a34a' },
    content,
    cta: { text: 'Lihat Detail Pesanan', url: `${APP_URL}/kiosk/history?id=${transaction_id}` },
  });
}

// ─── Template: Password Reset ────────────────────────────────────────────────
export function buildPasswordResetEmail(userName, resetLink) {
  const content = `
    <p style="margin:0 0 12px;color:#374151;font-size:14px;">Halo <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Anda meminta reset password untuk akun SPS Corner Anda. Klik tombol di bawah untuk membuat password baru.</p>
  `;
  return emailTemplate({
    title: 'Reset Password',
    subtitle: 'SPS Corner — Koperasi Karyawan',
    badge: { text: 'Permintaan reset password untuk akun Anda.', color: '#f59e0b' },
    content,
    cta: { text: 'Reset Password', url: resetLink },
    footer: 'Link ini berlaku selama 1 jam. Jika Anda tidak meminta reset password, abaikan email ini.',
  });
}

// ─── Template: Temporary Password ────────────────────────────────────────────
export function buildTempPasswordEmail(userName, tempPassword) {
  const content = `
    <p style="margin:0 0 12px;color:#374151;font-size:14px;">Halo <strong>${userName}</strong>,</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Password Anda telah direset oleh admin. Berikut password sementara Anda:</p>
    <div style="background:#f3f4f6;padding:20px;border-radius:12px;text-align:center;margin:16px 0;border:1px dashed #d1d5db;">
      <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;letter-spacing:1px;">Password Sementara</p>
      <p style="margin:8px 0 0;font-size:28px;font-family:monospace;font-weight:700;color:#1d4ed8;letter-spacing:4px;">${tempPassword}</p>
    </div>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin-top:16px;">
      <p style="margin:0;color:#dc2626;font-size:13px;font-weight:600;">Segera ganti password Anda setelah login untuk keamanan akun.</p>
    </div>
  `;
  return emailTemplate({
    title: 'Password Telah Direset',
    subtitle: 'SPS Corner — Koperasi Karyawan',
    badge: { text: 'Admin telah mereset password akun Anda.', color: '#ef4444' },
    content,
    footer: 'Abaikan email ini jika Anda tidak meminta reset password.',
  });
}

// ─── Template: Test Email ────────────────────────────────────────────────────
export function buildTestEmail(targetEmail) {
  const content = `
    <p style="margin:0 0 12px;color:#374151;font-size:14px;">Halo Admin,</p>
    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Ini adalah email percobaan untuk memastikan sistem notifikasi SPS Corner berfungsi dengan baik.</p>
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:14px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
      <table style="width:100%;">
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;width:40%;">Status</td><td style="padding:4px 0;color:#16a34a;font-size:13px;font-weight:700;">: Aktif</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Waktu</td><td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;">: ${new Date().toLocaleString("id-ID")}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Target</td><td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;">: ${targetEmail}</td></tr>
      </table>
    </div>
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Jika Anda menerima email ini, berarti konfigurasi Gmail Nodemailer sudah benar.</p>
  `;
  return emailTemplate({
    title: 'Test Email SPS Corner',
    subtitle: 'SPS Corner — Koperasi Karyawan',
    badge: { text: 'Email percobaan dari sistem notifikasi.', color: '#22c55e' },
    content,
  });
}

// ─── Template: Daily Report ──────────────────────────────────────────────────
export function buildDailyReportEmail(date, count, total, role) {
  const content = `
    <p style="margin:0 0 12px;color:#374151;font-size:14px;">Berikut ringkasan transaksi harian untuk akun Anda.</p>
    <div style="display:flex;gap:12px;margin:20px 0;">
      <div style="flex:1;background:#eff6ff;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:24px;font-weight:800;color:#1d4ed8;">${count}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Transaksi Lunas</p>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:16px;font-weight:800;color:#16a34a;">Rp ${total.toLocaleString("id-ID")}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">${role === 'seller' ? 'Pendapatan Bersih' : 'Omzet Lunas'}</p>
      </div>
    </div>
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Transaksi pending dan gagal tidak dihitung dalam laporan ini.</p>
  `;
  return emailTemplate({
    title: `Laporan Harian — ${date}`,
    subtitle: 'SPS Corner — Koperasi Karyawan',
    badge: { text: `Ringkasan penjualan ${role === 'seller' ? 'produk Anda' : 'hari ini'}.`, color: '#3b82f6' },
    content,
    cta: { text: 'Lihat Dashboard', url: `${APP_URL}/dashboard/${role === 'seller' ? 'seller' : 'admin'}` },
  });
}
