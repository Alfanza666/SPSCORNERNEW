export function registerProductReturnRoutes(app: any, deps: { supabase: any; sendNotification: any; getAdminIds: any; getToken: any; resolveUser: any; atomicAdjustStock: any }) {
  const { supabase, sendNotification, getAdminIds, getToken, resolveUser, atomicAdjustStock } = deps;

  app.post("/api/product-returns/create", async (req: any, res: any) => {
    try {
      const token = getToken(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const user = await resolveUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { product_id, quantity, reason } = req.body;
      if (quantity <= 0) return res.status(400).json({ error: "Quantity must be > 0" });

      await supabase.from("product_returns").insert({ product_id, seller_id: user.id, quantity: Number(quantity), reason, status: "pending", initiated_by: user.id });

      const adminIds = await getAdminIds();
      await Promise.allSettled(adminIds.map((id: string) => sendNotification(id, {
        type: "system",
        title: "Permintaan Retur Baru",
        message: `Seller meminta retur ${quantity} item. Alasan: ${reason || "-"}`,
        path: "/dashboard/admin/returns"
      })));

      res.json({ success: true });
    } catch (err: any) {
      console.error("Product return error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/product-returns/buyer-request", async (req: any, res: any) => {
    try {
      const token = getToken(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const user = await resolveUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { product_id, seller_id, quantity, reason, transaction_id } = req.body;
      if (quantity <= 0) return res.status(400).json({ error: "Quantity must be > 0" });

      const { data: existing } = await supabase
        .from("product_returns")
        .select("id")
        .eq("product_id", product_id)
        .eq("initiated_by", user.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) return res.status(409).json({ error: "Anda sudah memiliki permintaan retur pending untuk produk ini" });

      await supabase.from("product_returns").insert({
        product_id,
        seller_id,
        quantity: Number(quantity),
        reason: `[Dari Pembeli] ${reason} (Transaksi: ${transaction_id || "-"})`,
        status: "pending",
        initiated_by: user.id
      });

      const adminIds = await getAdminIds();
      await Promise.allSettled(adminIds.map((id: string) => sendNotification(id, {
        type: "system",
        title: "Permintaan Retur dari Pembeli",
        message: `Pembeli meminta retur ${quantity} item. Alasan: ${reason || "-"}`,
        path: "/dashboard/admin/returns"
      })));

      res.json({ success: true });
    } catch (err: any) {
      console.error("Buyer product return error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/product-returns/my", async (req: any, res: any) => {
    try {
      const token = getToken(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const user = await resolveUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { data } = await supabase
        .from("product_returns")
        .select(`*, products (name)`)
        .eq("initiated_by", user.id)
        .order("created_at", { ascending: false });

      res.json(data || []);
    } catch (err: any) {
      console.error("Get my returns error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/product-returns/process", async (req: any, res: any) => {
    try {
      const token = getToken(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const user = await resolveUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (adminProfile?.role !== "admin" && adminProfile?.role !== "superadmin") return res.status(403).json({ error: "Forbidden" });

      const { id, status } = req.body;
      const { data: returnReq } = await supabase.from("product_returns").select("*").eq("id", id).single();
      if (!returnReq) return res.status(404).json({ error: "Return request not found" });

      await supabase.from("product_returns").update({ status, admin_id: user.id, updated_at: new Date().toISOString() }).eq("id", id);

      if (status === "approved") {
        const result = await atomicAdjustStock(
          returnReq.product_id, -returnReq.quantity,
          user.id, 'correction',
          `Retur disetujui dari request ID: ${id}`, 0
        );
        if (!result || !result.success) {
          console.error(`[Retur] Atomic adjust failed for product ${returnReq.product_id}:`, result?.error_message);
        }
      }

      const statusLabels: Record<string, string> = { approved: "disetujui", rejected: "ditolak" };
      const recipientId = returnReq.initiated_by || returnReq.seller_id;
      await sendNotification(recipientId, {
        type: "system",
        title: status === "approved" ? "Retur Disetujui" : "Retur Ditolak",
        message: `Permintaan retur ${returnReq.quantity} item telah ${statusLabels[status] || status} oleh admin.`,
        path: returnReq.initiated_by !== returnReq.seller_id ? "/kiosk/history" : "/dashboard/seller/products"
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Product return process error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}
