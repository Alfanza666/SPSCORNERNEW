export function registerStockTraceRoutes(app, { supabase }) {
  // GET /api/stock-movements/:productId — riwayat mutasi stok per produk
  app.get("/api/stock-movements/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const { type, startDate, endDate, limit, offset } = req.query;

      if (!productId) return res.status(400).json({ error: "Product ID is required" });

      // ── Query stock_adjustments ────────────────────────────
      let query = supabase
        .from("stock_adjustments")
        .select(`
          *,
          transactions ( id, status, buyer_name, created_at )
        `)
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (type) query = query.eq("adjustment_type", type);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", endDate);
      if (limit) query = query.limit(parseInt(limit));
      if (offset) query = query.range(
        parseInt(offset),
        parseInt(offset) + (parseInt(limit) || 50) - 1
      );

      const { data: movements, error } = await query;
      if (error) throw error;

      // ── Hitung total untuk pagination ──────────────────────
      let countQuery = supabase
        .from("stock_adjustments")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId);
      if (type) countQuery = countQuery.eq("adjustment_type", type);
      if (startDate) countQuery = countQuery.gte("created_at", startDate);
      if (endDate) countQuery = countQuery.lte("created_at", endDate);
      const { count } = await countQuery;

      // ── Info produk ────────────────────────────────────────
      const { data: product } = await supabase
        .from("products")
        .select("id, name, stock, seller_id")
        .eq("id", productId)
        .single();

      res.json({
        product,
        movements: movements || [],
        total: count || 0,
      });
    } catch (error) {
      console.error("Stock movements error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
