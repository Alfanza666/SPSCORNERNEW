export function registerStockRoutes(app: any, deps: { supabase: any; sendNotification: any; getAdminIds: any; getUserId: any; resolveUser: any }) {
  const { supabase, sendNotification, getAdminIds, getUserId, resolveUser } = deps;

  app.post("/api/stock-requests/create", async (req: any, res: any) => {
    try {
      const token = getUserId(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const user = await resolveUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { product_id, requested_quantity, notes } = req.body;
      if (requested_quantity <= 0) return res.status(400).json({ error: "Quantity must be > 0" });

      await supabase.from("stock_requests").insert({ product_id, seller_id: user.id, requested_quantity: Number(requested_quantity), notes, status: "pending" });

      const adminIds = await getAdminIds();
      await Promise.allSettled(adminIds.map((id: string) => sendNotification(id, {
        type: "system",
        title: "📦 Permintaan Restock Baru",
        message: `Seller meminta restock ${requested_quantity} item.`,
        path: "/dashboard/admin/stock-requests"
      })));

      res.json({ success: true });
    } catch (err: any) {
      console.error("Stock request error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/stock-requests/process", async (req: any, res: any) => {
    try {
      const token = getUserId(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const user = await resolveUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (adminProfile?.role !== "admin" && adminProfile?.role !== "superadmin") return res.status(403).json({ error: "Forbidden" });

      const { id, status } = req.body;
      const { data: request } = await supabase.from("stock_requests").select("*").eq("id", id).single();
      if (!request) return res.status(404).json({ error: "Request not found" });

      await supabase.from("stock_requests").update({ status, admin_id: user.id, updated_at: new Date().toISOString() }).eq("id", id);

      if (status === "approved") {
        const { data: product } = await supabase.from("products").select("stock").eq("id", request.product_id).single();
        if (product) {
          const newStock = product.stock + request.requested_quantity;
          await supabase.from("products").update({ stock: newStock }).eq("id", request.product_id);
          await supabase.from("stock_adjustments").insert({
            product_id: request.product_id, user_id: user.id,
            previous_stock: product.stock, new_stock: newStock,
            adjustment_type: "restock", notes: `Restock disetujui dari request ID: ${id}`
          });
        }
      }

      const statusLabels: Record<string, string> = { approved: "disetujui", rejected: "ditolak" };
      await sendNotification(request.seller_id, {
        type: "system",
        title: status === "approved" ? "✅ Restock Disetujui" : "❌ Restock Ditolak",
        message: `Permintaan restock ${request.requested_quantity} item telah ${statusLabels[status] || status} oleh admin.`,
        path: "/dashboard/seller/products"
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Stock request process error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}
