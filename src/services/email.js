// @ts-nocheck
let supabaseInstance = null;
let nodemailerInstance = null;
let transporter = null;
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

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
    const transport = nodemailerInstance.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
      connectionTimeout: 5e3, greetingTimeout: 5e3, socketTimeout: 5e3,
    });
    const info = await transport.sendMail({ from: `"SPS Corner" <${gmailUser}>`, to, subject, html });
    return { success: true, data: info };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.message || "Unknown email error" };
  }
}

export async function triggerSarirotiEmail(tx_id, buyerName, totalAmount) {
  try {
    const { data: items, error } = await supabaseInstance
      .from("transaction_items")
      .select("*, products(name, category, price)")
      .eq("transaction_id", tx_id);
    if (error) throw error;
    const sarirotiItems = (items || []).filter((item) => {
      const name = (item.products?.name || item.metadata?.product_name || "").toLowerCase();
      const category = (item.products?.category || item.metadata?.category || "").toLowerCase();
      return name.includes("sariroti") || name.includes("roti") || name.includes("koperasi") ||
             category.includes("sariroti") || category.includes("roti") || category.includes("koperasi");
    });
    if (sarirotiItems.length === 0) return;
    const orderDate = new Date().toLocaleString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const itemRows = sarirotiItems.map((item) => {
      const name = item.products?.name || item.metadata?.product_name || "Produk Koperasi";
      const qty = item.quantity || 1;
      const price = item.price || 0;
      const subtotal = price * qty;
      return `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:12px 16px;color:#111827;font-weight:500;">${name}</td><td style="padding:12px 16px;text-align:center;color:#374151;font-weight:600;">${qty}</td><td style="padding:12px 16px;text-align:right;color:#374151;">Rp ${price.toLocaleString("id-ID")}</td><td style="padding:12px 16px;text-align:right;color:#1d4ed8;font-weight:700;">Rp ${subtotal.toLocaleString("id-ID")}</td></tr>`;
    }).join("");
    const sarirotiSubtotal = sarirotiItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const txShortId = tx_id.slice(0, 8).toUpperCase();
    const appUrl = process.env.APP_URL || "https://spscorner.store";
    let targetEmail = process.env.SARIROTI_ADMIN_EMAIL || "Sales.Adm.bjm@sariroti.com";
    try {
      const { data: settings } = await supabaseInstance.from("settings").select("value").eq("key", "sariroti_email").single();
      if (settings?.value) targetEmail = settings.value;
    } catch (e) { /* use default */ }
    const emailHtml = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Pesanan Roti Baru - SPS Corner</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:620px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#1e40af,#1d4ed8);padding:32px 40px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:24px;">Pesanan Roti Koperasi</h1><p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">SPS Corner — Koperasi Karyawan</p></div><div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 40px;"><p style="margin:0;color:#1e40af;font-size:13px;font-weight:600;">Ada pesanan baru yang membutuhkan konfirmasi dari Admin Sales Sariroti.</p></div><div style="padding:32px 40px;"><h2 style="margin:0 0 16px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;">Informasi Pemesan</h2><table style="width:100%;"><tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%;">Nama Pemesan</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:700;">: ${buyerName}</td></tr><tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">ID Transaksi</td><td style="padding:6px 0;color:#1d4ed8;font-size:13px;font-weight:700;font-family:monospace;">: #${txShortId}</td></tr><tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Tanggal & Waktu</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">: ${orderDate}</td></tr></table><h2 style="margin:24px 0 12px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;">Daftar Item Roti</h2><table style="width:100%;border-collapse:collapse;">${itemRows}</table><div style="background:#eff6ff;padding:14px 16px;border-radius:8px;margin-top:16px;text-align:right;"><span style="font-size:16px;font-weight:800;color:#1d4ed8;">Total: Rp ${sarirotiSubtotal.toLocaleString("id-ID")}</span></div><div style="text-align:center;margin:24px 0 8px;"><a href="${appUrl}/dashboard/seller/transactions?id=${tx_id}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#fff;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">Buka Dashboard & Konfirmasi</a></div></div><div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;"><p style="margin:0;font-size:12px;color:#9ca3af;">SPS Corner — Koperasi Karyawan SPS | ${appUrl}</p></div></div></body></html>`;
    const result = await sendSarirotiEmailInternal(targetEmail, `[SPS Corner] Pesanan Roti Baru #${txShortId} dari ${buyerName}`, emailHtml);
    if (result.success) console.log(`Sariroti email sent for transaction ${tx_id}`);
    else console.error(`Failed to send Sariroti email for ${tx_id}:`, result.error);
  } catch (e) { console.error("triggerSarirotiEmail error:", e); }
}

export async function sendBuyerReceiptEmail(tx_id, email, name, items, total) {
  if (!email) return;
  try {
    const itemRows = items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}x</td><td>Rp ${Number(i.price).toLocaleString("id-ID")}</td></tr>`).join('');
    const html = `<h2>Nota Pembelian SPS Corner</h2><p>Halo ${name},</p><p>Terima kasih telah berbelanja. Berikut detail pesanan Anda:</p><table border="1" cellpadding="8"><tr><th>Produk</th><th>Qty</th><th>Harga</th></tr>${itemRows}</table><h3>Total: Rp ${Number(total).toLocaleString("id-ID")}</h3><p>ID Transaksi: ${tx_id}</p>`;
    await sendSarirotiEmailInternal(email, `Nota Pembelian SPS Corner #${tx_id.slice(0,8)}`, html);
  } catch (e) { console.error("sendBuyerReceiptEmail error:", e); }
}
