// @ts-nocheck
let supabaseInstance = null;
let sendNotif = null;
let restoreStock = null;
let sendSarirotiEmail = null;
let notifiedProgramStarts = new Set();

export function initBackgroundJobs(supabase, sendNotification, restoreTransactionStock, sendSarirotiEmailInternal) {
  supabaseInstance = supabase;
  sendNotif = sendNotification;
  restoreStock = restoreTransactionStock;
  sendSarirotiEmail = sendSarirotiEmailInternal;
}

export function autoCleanup() {
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: staleTx } = await supabaseInstance.from("transactions").select("id, buyer_id, total_amount, status").in("status", ["pending", "expired"]).lt("created_at", cutoff);
      if (!staleTx || staleTx.length === 0) return;
      for (const tx of staleTx) {
        await supabaseInstance.from("transactions").update({ status: "failed", metadata: { ...(tx.metadata || {}), auto_cleanup: true } }).eq("id", tx.id);
        await restoreStock(tx.id);
        if (tx.buyer_id && sendNotif) {
          await sendNotif(tx.buyer_id, { type: "transaction", title: "⏰ Waktu Pembayaran Habis", message: `Transaksi #${tx.id.slice(0,8)} dibatalkan karena waktu habis.`, path: `/kiosk/history?id=${tx.id}` });
        }
      }
    } catch (e) { console.error("[Cleanup] Error:", e); }
  }, 60 * 1000);
}

export function dailyReport() {
  const scheduleDaily = () => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
    if (now > target) target.setDate(target.getDate() + 1);
    setTimeout(async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data: sellers } = await supabaseInstance.from("profiles").select("id, name, email, role").in("role", ["seller", "admin", "superadmin"]);
      if (!sellers) return;
      for (const seller of sellers) {
        const query = supabaseInstance.from("transactions").select("total_amount, created_at").eq("status", "paid");
        if (seller.role === 'seller') query.eq("seller_id", seller.id);
        query.gte("created_at", today);
        const { data: txns } = await query;
        const total = (txns || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
        const count = (txns || []).length;
        const subject = `📊 Laporan Harian SPS Corner - ${today}`;
        const html = `<h2>Laporan Penjualan ${today}</h2><p>Total Transaksi: ${count}</p><p>Total Pendapatan: Rp ${total.toLocaleString("id-ID")}</p>`;
        if (seller.email && sendSarirotiEmail) await sendSarirotiEmail(seller.email, subject, html);
      }
      scheduleDaily();
    }, target - now);
  };
  scheduleDaily();
}

export function checkProgramStartNotifications() {
  setInterval(async () => {
    try {
      const now = new Date().toISOString();
      const { data: programs } = await supabaseInstance.from("union_programs").select("id, name").eq("is_active", true).lte("start_date", now).gte("start_date", new Date(Date.now() - 120 * 1e3).toISOString());
      if (!programs || programs.length === 0) return;
      for (const prog of programs) {
        if (notifiedProgramStarts.has(prog.id)) continue;
        notifiedProgramStarts.add(prog.id);
        const { data: couponHolders } = await supabaseInstance.from("program_coupons").select("user_id").eq("program_id", prog.id).not("user_id", "is", null);
        if (!couponHolders || couponHolders.length === 0) continue;
        const uniqueUserIds = [...new Set(couponHolders.map(c => c.user_id))];
        for (const userId of uniqueUserIds) {
          if (sendNotif) await sendNotif(userId, { type: "system", title: `🎫 Program Dimulai: ${prog.name}`, message: `Program "${prog.name}" telah dimulai!`, path: "/portal/program" });
        }
      }
    } catch (e) { console.error("[ProgramStartNotif] Error:", e); }
  }, 30 * 1e3);
}
