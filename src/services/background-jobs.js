// @ts-nocheck
let supabaseInstance = null;
let sendNotif = null;
let restoreStock = null;
let sendSarirotiEmail = null;
let reconcileStock = null;

export function initBackgroundJobs(supabase, sendNotification, restoreTransactionStock, sendSarirotiEmailInternal, reconcileStockFn) {
  supabaseInstance = supabase;
  sendNotif = sendNotification;
  restoreStock = restoreTransactionStock;
  sendSarirotiEmail = sendSarirotiEmailInternal;
  reconcileStock = reconcileStockFn;

  if (typeof process !== 'undefined' && process.env && process.env.VERCEL) return;

  // ── Auto-cleanup expired transactions every 3 minutes ─────────────────
  autoCleanup();
  setInterval(autoCleanup, 3 * 60 * 1e3);

  // ── Daily report (push notification) every 60 seconds ─────────────────
  setInterval(dailyReport, 60 * 1e3);

  // ── Stock reconciliation every 30 minutes ──────────────────────────
  runReconciliation();
  setInterval(runReconciliation, 30 * 60 * 1e3);

  // ── Program start notifications every 30 seconds ─────────────────────
  checkProgramStartNotifications();
  setInterval(checkProgramStartNotifications, 30 * 1e3);

  // ── Email-based daily report (scheduled) ─────────────────────────────
  scheduleDailyEmailReport();
}

let lastReconNotif = null; // deduplikasi notifikasi gap yang sama

async function runReconciliation() {
  if (!reconcileStock) return;
  try {
    const discrepancies = await reconcileStock();
    if (!discrepancies || discrepancies.length === 0) return;

    const significant = discrepancies.filter(d => Math.abs(d.gap) >= 5);
    if (significant.length === 0) return;

    // Deduplikasi: hanya notifikasi kalau ada perubahan (gap baru atau membesar)
    const sigKey = significant.map(d => `${d.product_id}:${d.gap}`).sort().join('|');
    if (sigKey === lastReconNotif) return;
    lastReconNotif = sigKey;

    console.warn(`[Reconciliation] ${discrepancies.length} product(s) with stock drift detected`);
    if (sendNotif) {
      const { data: admins } = await supabaseInstance.from('profiles').select('id').in('role', ['admin', 'superadmin']);
      if (admins) {
        const msg = significant.slice(0, 5).map(d => `${d.product_name}: sistem=${d.current_stock}, expected=${d.expected_stock}`).join('\n');
        for (const admin of admins) {
          await sendNotif(admin.id, {
            type: 'system',
            title: `⚠️ ${significant.length} Produk Stok Tidak Sinkron`,
            message: `Detected ${discrepancies.length} discrepancies (${significant.length} >= 5 unit gap).\nLakukan Opname untuk reset.\n${msg}${discrepancies.length > 5 ? `\n...dan ${discrepancies.length - 5} lainnya` : ''}`,
            path: '/dashboard/admin/stock-opname',
          });
        }
      }
    }
  } catch (e) {
    console.error('[Reconciliation] Error:', e);
  }
}

async function autoCleanup() {
  try {
    // ── Kirim pengingat untuk transaksi yang sudah 10 menit ──
    const reminderThreshold = new Date(Date.now() - 10 * 60 * 1e3).toISOString();
    const elevenMinAgo = new Date(Date.now() - 11 * 60 * 1e3).toISOString();
    const { data: toRemind } = await supabaseInstance
      .from("transactions")
      .select("id, buyer_id, metadata")
      .in("status", ["pending"])
      .is("receipt_image", null)
      .lt("created_at", reminderThreshold)
      .gt("created_at", elevenMinAgo);
    if (toRemind) {
      for (const tx of toRemind) {
        if (tx.metadata?.reminder_sent) continue;
        const { error: metaErr } = await supabaseInstance
          .from("transactions")
          .update({ metadata: { ...(tx.metadata || {}), reminder_sent: true } })
          .eq("id", tx.id);
        if (metaErr) continue;
        if (tx.buyer_id && sendNotif) {
          await sendNotif(tx.buyer_id, {
            type: "transaction",
            title: "⏳ Segera Selesaikan Pembayaran",
            message: `Pesanan #${tx.id.slice(0, 8)} akan dibatalkan otomatis dalam 5 menit.`,
            path: `/kiosk/success?id=${tx.id}`,
          });
        }
      }
    }

    // ── Cancel transaksi expired (> 15 menit) ──
    const expiredThreshold = new Date(Date.now() - 15 * 60 * 1e3).toISOString();
    // Ambil ALL pending expired — termasuk yang punya receipt_image (AI tolak dll)
    const { data: expired } = await supabaseInstance
      .from("transactions")
      .select("id, buyer_id, metadata, payment_details, receipt_image")
      .in("status", ["pending"])
      .lt("created_at", expiredThreshold);
    if (!expired || expired.length === 0) return;
    for (const tx of expired) {
      // Lewati transaksi yang punya receipt_image DAN belum pernah gagal verifikasi
      // (tunggu admin verifikasi manual, jangan auto-cancel)
      const receiptUploaded = tx.receipt_image || tx.payment_details?.receipt_uploaded;
      const verificationFailed = tx.payment_details?.verification_failed;
      if (receiptUploaded && !verificationFailed) continue;

      // Restore stock DULU, baru update status.
      // Urutan ini penting: kalau restore gagal, status tetap "pending" → retry 3 menit berikutnya
      if (restoreStock) {
        try {
          await restoreStock(tx.id);
        } catch (restoreError) {
          // Keep the transaction pending so the next cleanup cycle can retry.
          console.error(`[AutoCleanup] Stock restore failed for ${tx.id}; keeping transaction pending`, restoreError);
          continue;
        }
      }

      await supabaseInstance
        .from("transactions")
        .update({
          status: "failed",
          metadata: { ...(tx.metadata || {}), cancel_reason: "Auto-cancelled: Unpaid > 15 menit" },
        })
        .eq("id", tx.id);
      if (tx.buyer_id && sendNotif) {
        await sendNotif(tx.buyer_id, {
          type: "transaction",
          title: "⏰ Waktu Pembayaran Habis",
          message: `Transaksi #${tx.id.slice(0, 8)} dibatalkan karena waktu habis.`,
          path: `/kiosk/history?id=${tx.id}`,
        });
      }
    }
    if (expired.length > 0) {
      console.log(`[AutoCleanup] Cancelled ${expired.length} expired transaction(s) + stock restored`);
    }
  } catch (e) {
    console.error("[AutoCleanup] Error:", e);
  }
}

let lastDailyReportDate = "";

async function dailyReport() {
  try {
    const now = new Date();
    const witaOffset = 8 * 60;
    const wita = new Date(now.getTime() + witaOffset * 60 * 1000);
    const todayStr = wita.toISOString().slice(0, 10);
    if (lastDailyReportDate === todayStr) return;
    const hourWITA = wita.getUTCHours();
    const minWITA = wita.getUTCMinutes();
    if (hourWITA !== 20 || minWITA > 5) return;

    lastDailyReportDate = todayStr;
    console.log(`[DailyReport] Sending daily report for ${todayStr}`);

    const { data: sellers } = await supabaseInstance.from("profiles").select("id").eq("role", "seller");
    if (!sellers || sellers.length === 0) return;

    const dayStart = new Date(Date.UTC(wita.getUTCFullYear(), wita.getUTCMonth(), wita.getUTCDate(), 0, 0, 0) - witaOffset * 60 * 1000).toISOString();

    for (const seller of sellers) {
      try {
        const { data: items } = await supabaseInstance
          .from("transaction_items")
          .select("id, transaction_id, quantity, subtotal, transactions!inner(id, total_amount, status, created_at)")
          .eq("seller_id", seller.id)
          .gte("transactions.created_at", dayStart);

        if (!items || items.length === 0) continue;

        const txMap = new Map();
        for (const item of items) {
          const tx = item.transactions;
          if (!txMap.has(tx.id)) {
            txMap.set(tx.id, { ...tx, itemCount: 0, itemRevenue: 0 });
          }
          const entry = txMap.get(tx.id);
          entry.itemCount += item.quantity;
          entry.itemRevenue += Number(item.subtotal || 0);
        }
        const txns = Array.from(txMap.values());
        const settledTxns = txns.filter(t => t.status === "paid" || t.status === "success");
        const totalCount = settledTxns.length;
        // Laporan penjual harus memakai nilai item milik penjual ini, bukan
        // total order penuh yang dapat berisi item dari beberapa penjual.
        const totalRevenue = settledTxns.reduce((s, t) => s + Number(t.itemRevenue || 0), 0);
        const pendingCount = txns.filter(t => t.status === "pending").length;
        const failedCount = txns.filter(t => t.status === "failed").length;

        const revFormatted = totalRevenue.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        if (sendNotif) {
          await sendNotif(seller.id, {
            type: "system",
            title: "Laporan Harian",
            message: `Ringkasan hari ini: ${totalCount} transaksi lunas, pendapatan bersih item Rp${revFormatted}. ${pendingCount} menunggu dan ${failedCount} gagal tidak dihitung.`,
            path: "/dashboard/seller/dashboard"
          });
        }
      } catch (e) {
        console.error(`[DailyReport] Error for seller ${seller.id}:`, e);
      }
    }
  } catch (e) {
    console.error("[DailyReport] Error:", e);
  }
}

function scheduleDailyEmailReport() {
  const target = new Date();
  target.setHours(17, 0, 0, 0);
  if (new Date() > target) target.setDate(target.getDate() + 1);
  setTimeout(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: recipients } = await supabaseInstance.from("profiles").select("id, name, email, role").in("role", ["seller", "admin", "superadmin"]);
    if (!recipients) { scheduleDailyEmailReport(); return; }
    for (const person of recipients) {
      const query = supabaseInstance
        .from("transactions")
        .select("id, total_amount, created_at, transaction_items(seller_id, subtotal)")
        .in("status", ["paid", "success"]);
      query.gte("created_at", today);
      const { data: txns } = await query;
      const scopedTxns = person.role === 'seller'
        ? (txns || []).flatMap(t => {
            const sellerItems = (t.transaction_items || []).filter(item => item.seller_id === person.id);
            if (sellerItems.length === 0) return [];
            return [{ ...t, sellerTotal: sellerItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0) }];
          })
        : (txns || []);
      const total = scopedTxns.reduce((sum, t) => sum + Number(person.role === 'seller' ? t.sellerTotal : t.total_amount || 0), 0);
      const count = scopedTxns.length;
      const subject = `📊 Laporan Harian SPS Corner - ${today}`;
      const html = `<h2>Laporan Penjualan Lunas ${today}</h2><p>Total Transaksi Lunas: ${count}</p><p>${person.role === 'seller' ? 'Pendapatan Bersih Item' : 'Omzet Lunas'}: Rp ${total.toLocaleString("id-ID")}</p><p>Transaksi pending dan gagal tidak dihitung.</p>`;
      if (person.email && sendSarirotiEmail) await sendSarirotiEmail(person.email, subject, html);
    }
    scheduleDailyEmailReport();
  }, target - new Date());
}

let notifiedProgramStarts = new Set();

async function checkProgramStartNotifications() {
  try {
    const now = new Date().toISOString();
    const { data: programs } = await supabaseInstance
      .from("union_programs")
      .select("id, name")
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("start_date", new Date(Date.now() - 120 * 1e3).toISOString());

    if (!programs || programs.length === 0) return;
    for (const prog of programs) {
      if (notifiedProgramStarts.has(prog.id)) continue;
      notifiedProgramStarts.add(prog.id);
      const { data: couponHolders } = await supabaseInstance
        .from("program_coupons")
        .select("user_id")
        .eq("program_id", prog.id)
        .not("user_id", "is", null);
      if (!couponHolders || couponHolders.length === 0) continue;
      const uniqueUserIds = [...new Set(couponHolders.map(c => c.user_id))];
      for (const userId of uniqueUserIds) {
        if (sendNotif) {
          await sendNotif(userId, {
            type: "system",
            title: `🎫 Program Dimulai: ${prog.name}`,
            message: `Program "${prog.name}" telah dimulai! Segera tukarkan kupon Anda dan hadiri acaranya. Cek detail & kupon di menu Program.`,
            path: "/portal/program"
          });
        }
      }
      console.log(`[ProgramStartNotif] Sent to ${uniqueUserIds.length} users for "${prog.name}"`);
    }
  } catch (e) {
    console.error("[ProgramStartNotif] Error:", e);
  }
}
