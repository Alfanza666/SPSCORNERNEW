// @ts-nocheck
let supabaseInstance = null;
let sendNotif = null;
let restoreStock = null;
let sendSarirotiEmail = null;
let reconcileStock = null;
let commitStock = null;
let deductStock = null;
let buildDailyReportEmailFn = null;
let refundPointsFn = null;
let updateBuyerPointsFn = null;

export function initBackgroundJobs(supabase, sendNotification, restoreTransactionStock, sendSarirotiEmailInternal, reconcileStockFn, commitTransactionStockFn, deductTransactionStockFn, buildDailyReportEmail, refundTransactionPointsFn, updateBuyerPointsFnParam) {
  supabaseInstance = supabase;
  sendNotif = sendNotification;
  restoreStock = restoreTransactionStock;
  sendSarirotiEmail = sendSarirotiEmailInternal;
  reconcileStock = reconcileStockFn;
  commitStock = commitTransactionStockFn;
  deductStock = deductTransactionStockFn;
  buildDailyReportEmailFn = buildDailyReportEmail || null;
  refundPointsFn = refundTransactionPointsFn || null;
  updateBuyerPointsFn = updateBuyerPointsFnParam || null;

  if (typeof process !== 'undefined' && process.env && process.env.VERCEL) return;

  // ── Auto-cleanup expired transactions every 3 minutes ─────────────────
  autoCleanup();
  setInterval(autoCleanup, 3 * 60 * 1e3);

  // ── Daily report (push notification) every 10 minutes ────────────────
  setInterval(dailyReport, 10 * 60 * 1e3);

  // ── Stock reconciliation every 30 minutes ──────────────────────────
  runReconciliation();
  setInterval(runReconciliation, 30 * 60 * 1e3);

  // ── Auto-reconcile broken transactions every 5 minutes ──────────────
  autoReconcileTransactions();
  setInterval(autoReconcileTransactions, 5 * 60 * 1e3);

  // ── Program start notifications every 30 seconds ─────────────────────
  checkProgramStartNotifications();
  setInterval(checkProgramStartNotifications, 30 * 1e3);

  // ── Email-based daily report (scheduled) ─────────────────────────────
  scheduleDailyEmailReport();

  // ── Stale pending transactions scan every 10 minutes ───────────────
  scanStalePendingTransactions();
  setInterval(scanStalePendingTransactions, 10 * 60 * 1e3);
}

// FIX G: Get correct chargeable amount for point calculation
function getAutoReconcileChargeableAmount(tx) {
  const pd = tx.payment_details || {};
  if (pd.loyalty_points_used && pd.loyalty_points_used > 0) {
    return Number(pd.paid_amount) || tx.total_amount;
  }
  return Number(tx.total_amount) || 0;
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

// ── Auto-reconcile: fix paid transactions with missing stock/balance ──
let lastReconcileLog = null;

async function autoReconcileTransactions() {
  if (!supabaseInstance) return;
  try {
    const { data: mismatches, error } = await supabaseInstance
      .rpc('find_stock_balance_mismatches');
    if (error || !mismatches || mismatches.length === 0) return;

    let fixedCount = 0;
    let failedCount = 0;

    for (const tx of mismatches) {
      try {
        // Fix stock if not deducted
        if (!tx.stock_deducted && commitStock) {
          const stockResult = await commitStock(tx.transaction_id);
          if (stockResult?.success) {
            fixedCount++;
            console.log(`[AutoReconcile] Stock fixed for tx ${tx.transaction_id.slice(0, 8)}`);
          } else {
            console.warn(`[AutoReconcile] Stock fix failed for tx ${tx.transaction_id.slice(0, 8)}:`, stockResult?.error);
            failedCount++;
          }
        }

        // Fix balance if not settled
        if (!tx.balances_updated) {
          const { error: balErr } = await supabaseInstance
            .rpc('apply_seller_balance_for_transaction', { p_transaction_id: tx.transaction_id });
          if (!balErr) {
            fixedCount++;
            console.log(`[AutoReconcile] Balance fixed for tx ${tx.transaction_id.slice(0, 8)}`);
          } else {
            console.warn(`[AutoReconcile] Balance fix failed for tx ${tx.transaction_id.slice(0, 8)}:`, balErr.message);
            failedCount++;
          }
        }
      } catch (fixErr) {
        console.error(`[AutoReconcile] Error fixing tx ${tx.transaction_id.slice(0, 8)}:`, fixErr);
        failedCount++;
      }
    }

    const logKey = `${mismatches.length}:${fixedCount}:${failedCount}`;
    if (logKey !== lastReconcileLog) {
      console.log(`[AutoReconcile] Processed ${mismatches.length} mismatches: ${fixedCount} fixed, ${failedCount} failed`);
      lastReconcileLog = logKey;
    }

    // ── FIX C: Retry failed seller balance & buyer points (flag-based) ──
    try {
      const { data: flaggedTx } = await supabaseInstance
        .from('transactions')
        .select('id, buyer_id, total_amount, payment_details')
        .eq('status', 'paid')
        .or('payment_details->>seller_balance_failed.eq.true,payment_details->>buyer_points_failed.eq.true')
        .limit(20);
      if (flaggedTx && flaggedTx.length > 0) {
        for (const ft of flaggedTx) {
          const pd = ft.payment_details || {};
          if (pd.seller_balance_failed) {
            try {
              const { error: retryErr } = await supabaseInstance.rpc('apply_seller_balance_for_transaction', { p_transaction_id: ft.id });
              if (!retryErr) {
                await supabaseInstance.from('transactions').update({
                  payment_details: { ...pd, seller_balance_failed: false, seller_balance_error: null }
                }).eq('id', ft.id);
                fixedCount++;
                console.log(`[AutoReconcile] Seller balance retry OK for ${ft.id.slice(0, 8)}`);
              }
            } catch (e) { console.warn(`[AutoReconcile] Seller balance retry fail for ${ft.id.slice(0, 8)}:`, e); }
          }
          if (pd.buyer_points_failed && updateBuyerPointsFn) {
            try {
              await updateBuyerPointsFn(ft.id, ft.buyer_id, getAutoReconcileChargeableAmount(ft));
              const { data: freshTx } = await supabaseInstance.from('transactions').select('payment_details').eq('id', ft.id).single();
              await supabaseInstance.from('transactions').update({
                payment_details: { ...(freshTx?.payment_details || pd), buyer_points_failed: false }
              }).eq('id', ft.id);
              fixedCount++;
              console.log(`[AutoReconcile] Buyer points retry OK for ${ft.id.slice(0, 8)}`);
            } catch (e) { console.warn(`[AutoReconcile] Buyer points retry fail for ${ft.id.slice(0, 8)}:`, e); }
          }
        }
      }
    } catch (flagErr) {
      console.error('[AutoReconcile] Error querying flagged transactions:', flagErr);
    }

    // ── FIX B-3: Fix missing buyer points ──
    if (updateBuyerPointsFn) {
      try {
        const { data: missingPoints, error: mpErr } = await supabaseInstance
          .from('transactions')
          .select('id, buyer_id, total_amount, payment_details')
          .eq('status', 'paid')
          .not('buyer_id', 'is', null)
          .limit(50);
        if (!mpErr && missingPoints && missingPoints.length > 0) {
          for (const tx of missingPoints) {
            try {
              // Check apakah sudah ada points_history untuk transaksi ini
              const { data: existing } = await supabaseInstance
                .from('points_history')
                .select('id')
                .eq('transaction_id', tx.id)
                .eq('type', 'earned')
                .limit(1);
              if (existing && existing.length > 0) continue; // sudah ada, skip

              await updateBuyerPointsFn(tx.id, tx.buyer_id, getAutoReconcileChargeableAmount(tx));
              console.log(`[AutoReconcile] Fixed missing buyer points for tx ${tx.id.slice(0, 8)}`);
            } catch (pointsErr) {
              console.error(`[AutoReconcile] Points fix failed for tx ${tx.id.slice(0, 8)}:`, pointsErr);
            }
          }
        }
      } catch (pointsQueryErr) {
        console.error('[AutoReconcile] Error querying missing buyer points:', pointsQueryErr);
      }
    }

    // Notify admins of persistent failures
    if (failedCount > 0 && sendNotif) {
      const { data: admins } = await supabaseInstance.from('profiles').select('id').in('role', ['admin', 'superadmin']);
      if (admins) {
        await Promise.all(admins.map(admin =>
          sendNotif(admin.id, {
            type: 'system',
            title: `⚠️ ${failedCount} Transaksi Gagal Auto-Reconcile`,
            message: `${failedCount} transaksi tidak bisa diperbaiki otomatis. Silakan cek manual.`,
            path: '/dashboard/admin/transactions',
          })
        ));
      }
    }
  } catch (e) {
    console.error('[AutoReconcile] Error:', e);
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

    // ── Cancel transaksi expired (> 15 menit / 60 menit untuk manual) ──
    const shortThreshold = new Date(Date.now() - 15 * 60 * 1e3).toISOString();
    const longThreshold = new Date(Date.now() - 60 * 60 * 1e3).toISOString();
    // QRIS Manual & Transfer Koperasi butuh waktu lebih lama untuk upload bukti
    const { data: expiredManual } = await supabaseInstance
      .from("transactions")
      .select("id, buyer_id, metadata, payment_details, receipt_image")
      .in("status", ["pending"])
      .in("payment_method", ["manual_qris", "transfer_koperasi"])
      .lt("created_at", longThreshold);
    const { data: expiredOthers } = await supabaseInstance
      .from("transactions")
      .select("id, buyer_id, metadata, payment_details, receipt_image")
      .in("status", ["pending"])
      .not("payment_method", "in", '("manual_qris","transfer_koperasi")')
      .lt("created_at", shortThreshold);
    const expired = [...(expiredManual || []), ...(expiredOthers || [])];
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

      // Refund loyalty points jika transaction pakai points
      if (refundPointsFn) {
        try { await refundPointsFn(tx.id); } catch (e) { console.error(`[AutoCleanup] Points refund failed for ${tx.id}:`, e); }
      }

      // Ambil metadata terbaru karena restoreStock mungkin telah memodifikasinya (misal: stock_restored: true)
      const { data: latestTx } = await supabaseInstance
        .from("transactions")
        .select("metadata")
        .eq("id", tx.id)
        .single();

      await supabaseInstance
        .from("transactions")
        .update({
          status: "failed",
          metadata: { ...(latestTx?.metadata || tx.metadata || {}), cancel_reason: "Auto-cancelled: Unpaid > 15 menit" },
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

    // Batch: fetch ALL items for ALL sellers in one query
    const sellerIds = sellers.map(s => s.id);
    const { data: allItems } = await supabaseInstance
      .from("transaction_items")
      .select("seller_id, transaction_id, quantity, subtotal, transactions!inner(id, total_amount, status, created_at)")
      .in("seller_id", sellerIds)
      .gte("transactions.created_at", dayStart);

    // Group by seller
    const itemsBySeller = new Map();
    for (const item of (allItems || [])) {
      if (!itemsBySeller.has(item.seller_id)) itemsBySeller.set(item.seller_id, []);
      itemsBySeller.get(item.seller_id).push(item);
    }

    for (const seller of sellers) {
      try {
        const items = itemsBySeller.get(seller.id) || [];
        if (items.length === 0) continue;

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
      const subject = `Laporan Harian SPS Corner - ${today}`;
      const html = buildDailyReportEmailFn
        ? buildDailyReportEmailFn(today, count, total, person.role)
        : `<h2>Laporan Penjualan Lunas ${today}</h2><p>Total Transaksi Lunas: ${count}</p><p>${person.role === 'seller' ? 'Pendapatan Bersih Item' : 'Omzet Lunas'}: Rp ${total.toLocaleString("id-ID")}</p><p>Transaksi pending dan gagal tidak dihitung.</p>`;
      if (person.email && sendSarirotiEmail) await sendSarirotiEmail(person.email, subject, html);
    }
    scheduleDailyEmailReport();
  }, target - new Date());
}

let notifiedProgramStarts = new Map(); // key: programId, value: timestamp

async function checkProgramStartNotifications() {
  try {
    // TTL: cleanup entries older than 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, ts] of notifiedProgramStarts) {
      if (ts < cutoff) notifiedProgramStarts.delete(key);
    }

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
      notifiedProgramStarts.set(prog.id, Date.now());
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

// ── Stale pending transactions: notify admins every 10 min ──────────
const STALE_PENDING_THRESHOLD_MS = 60 * 60 * 1000; // 1 jam
let lastStaleNotif = new Map(); // tx_id → timestamp (dedup 1 jam sekali)

async function scanStalePendingTransactions() {
  if (!supabaseInstance) return;
  try {
    const threshold = new Date(Date.now() - STALE_PENDING_THRESHOLD_MS).toISOString();
    const { data: staleTxns, error } = await supabaseInstance
      .from("transactions")
      .select("id, buyer_id, total_amount, created_at, receipt_image, payment_details")
      .in("status", ["pending"])
      .lt("created_at", threshold);
    if (error || !staleTxns || staleTxns.length === 0) return;

    const now = Date.now();
    const staleIds = staleTxns
      .filter(tx => {
        const lastNotif = lastStaleNotif.get(tx.id) || 0;
        return now - lastNotif > 60 * 60 * 1000; // dedup 1 jam
      });
    if (staleIds.length === 0) return;

    const { data: admins } = await supabaseInstance
      .from("profiles").select("id").in("role", ["admin", "superadmin"]);
    if (!admins || admins.length === 0) return;

    const summaryLines = staleIds.map(tx => {
      const age = Math.round((now - new Date(tx.created_at).getTime()) / 60000);
      const hasReceipt = tx.receipt_image ? "Ada bukti" : "Tanpa bukti";
      return `#${tx.id.slice(0, 8)} — Rp${Number(tx.total_amount || 0).toLocaleString("id-ID")} — ${age}m — ${hasReceipt}`;
    });

    for (const tx of staleIds) {
      lastStaleNotif.set(tx.id, now);
    }

    const msg = `${staleIds.length} transaksi pending >1 jam:\n${summaryLines.slice(0, 10).join("\n")}${staleIds.length > 10 ? `\n...dan ${staleIds.length - 10} lainnya` : ""}`;
    for (const admin of admins) {
      await sendNotif(admin.id, {
        type: "system",
        title: `⏳ ${staleIds.length} Transaksi Pending >1 Jam`,
        message: msg,
        path: "/dashboard/admin/transactions",
      });
    }
    console.log(`[StalePending] Notified admins of ${staleIds.length} stale pending transaction(s)`);
  } catch (e) {
    console.error("[StalePending] Error:", e);
  }
}
