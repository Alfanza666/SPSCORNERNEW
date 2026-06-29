export function registerWithdrawalRoutes(app: any, deps: { supabase: any; sendNotification: any; getAdminIds: any; getToken: any; resolveUser: any }) {
  const { supabase, sendNotification, getAdminIds, getToken, resolveUser } = deps;

  app.post("/api/withdrawals/request", async (req: any, res: any) => {
    try {
      const token = getToken(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const user = await resolveUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { amount, bank_name, account_number, account_name, fee = 0, net_amount } = req.body;
      if (amount < 50000) return res.status(400).json({ error: "Minimal penarikan Rp 50.000" });

      const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
      const currentBalance = profile?.balance || 0;
      if (currentBalance < amount) return res.status(400).json({ error: "Saldo tidak mencukupi" });

      const { error: deductErr } = await supabase.from("profiles").update({ balance: currentBalance - amount }).eq("id", user.id).gte("balance", amount);
      if (deductErr) return res.status(400).json({ error: "Gagal memotong saldo" });

      const { error: insertErr } = await supabase.from("withdrawals").insert({
        seller_id: user.id, amount, fee: fee || 0,
        net_amount: net_amount || amount,
        status: "pending", bank_name, account_number, account_name
      });
      if (insertErr) {
        await supabase.from("profiles").update({ balance: currentBalance }).eq("id", user.id);
        return res.status(500).json({ error: insertErr.message });
      }

      const adminIds = await getAdminIds();
      await Promise.allSettled(adminIds.map((id: string) => sendNotification(id, {
        type: "withdrawal",
        title: "💰 Permintaan Penarikan Baru",
        message: `Penarikan Rp ${Number(amount).toLocaleString("id-ID")} dari ${user.email || "seller"} menunggu persetujuan.`,
        path: "/dashboard/admin/withdrawals"
      })));

      res.json({ success: true });
    } catch (err: any) {
      console.error("Withdrawal request error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/withdrawals/process", async (req: any, res: any) => {
    try {
      const token = getToken(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const user = await resolveUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (adminProfile?.role !== "admin" && adminProfile?.role !== "superadmin") return res.status(403).json({ error: "Forbidden" });

      const { id, status } = req.body;
      const { data: withdrawal } = await supabase.from("withdrawals").select("*").eq("id", id).single();
      if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
      if (withdrawal.status !== "pending") return res.status(400).json({ error: "Withdrawal already processed" });

      if (status === "rejected") {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", withdrawal.seller_id).single();
        if (profile) await supabase.from("profiles").update({ balance: (profile.balance || 0) + withdrawal.amount }).eq("id", withdrawal.seller_id);
      }

      if (status === "paid") {
        const { data: profile } = await supabase.from("profiles").select("total_withdrawn, total_fee_paid").eq("id", withdrawal.seller_id).single();
        if (profile) await supabase.from("profiles").update({ total_withdrawn: (profile.total_withdrawn || 0) + withdrawal.amount }).eq("id", withdrawal.seller_id);
      }

      await supabase.from("withdrawals").update({ status }).eq("id", id);

      const statusLabels: Record<string, string> = { approved: "disetujui", rejected: "ditolak", paid: "dibayar" };
      await sendNotification(withdrawal.seller_id, {
        type: "withdrawal",
        title: status === "paid" ? "✅ Penarikan Dibayar" : status === "approved" ? "✅ Penarikan Disetujui" : "❌ Penarikan Ditolak",
        message: `Penarikan Rp ${Number(withdrawal.amount).toLocaleString("id-ID")} telah ${statusLabels[status] || status} oleh admin.`,
        path: "/dashboard/seller/withdrawals"
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Withdrawal process error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}
