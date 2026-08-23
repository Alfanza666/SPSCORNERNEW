export function registerStockTraceRoutes(app, { supabase }) {
  // Supabase memotong hasil pada 1.000 row. Produk lama sudah punya ribuan
  // adjustment, jadi timeline dan deteksi gap WAJIB dibaca per halaman agar
  // stok awal dan selisih tidak dihitung dari data sebagian.
  const TRACE_PAGE_SIZE = 500;
  const fetchAllRows = async (queryFactory: () => any) => {
    const rows: any[] = [];
    for (let from = 0; ; from += TRACE_PAGE_SIZE) {
      const { data, error } = await queryFactory().range(from, from + TRACE_PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < TRACE_PAGE_SIZE) break;
    }
    return rows;
  };

  // GET /api/stock-movements/:productId — riwayat mutasi stok per produk
  app.get("/api/stock-movements/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const { type, startDate, endDate } = req.query;

      if (!productId) return res.status(400).json({ error: "Product ID is required" });

      // ── Info produk + seller ─────────────────────────────
      const { data: product } = await supabase
        .from("products")
        .select("id, name, stock, seller_id, created_at")
        .eq("id", productId)
        .single();

      if (!product) return res.status(404).json({ error: "Product not found" });

      let sellerName = null;
      if (product.seller_id) {
        const { data: seller } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", product.seller_id)
          .single();
        sellerName = seller?.name || null;
      }

      // ── Query stock_adjustments (ascending = oldest dulu) ──
      const adjustments = await fetchAllRows(() => {
        let query = supabase
          .from("stock_adjustments")
          .select(`*, transactions ( id, status, buyer_name, created_at )`)
          .eq("product_id", productId);

        if (type) query = query.eq("adjustment_type", type);
        if (startDate) query = query.gte("created_at", startDate);
        if (endDate) query = query.lte("created_at", endDate);

        return query
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });
      });

      // ── Synthetic event: awal produk dibuat ─────────────
      const events = [];
      let initialStock;

      if (!adjustments || adjustments.length === 0) {
        // Tidak ada adjustment sama sekali → stok saat ini = stok awal
        initialStock = product.stock;
        events.push({
          id: "creation",
          is_synthetic: true,
          created_at: product.created_at,
          adjustment_type: "initial",
          previous_stock: 0,
          new_stock: initialStock,
          delta: initialStock,
          notes: "Produk dibuat — stok awal",
          transactions: null,
        });
      } else {
        // Ambil previous_stock dari adjustment pertama sebagai stok awal
        const firstAdj = adjustments[0];
        initialStock = firstAdj.previous_stock;

        // Cek ada gap: bandingkan currentStock vs expected dari trail
        const lastAdj = adjustments[adjustments.length - 1];
        const expectedStock = lastAdj.new_stock;
        const gap = product.stock - expectedStock;

        events.push({
          id: "creation",
          is_synthetic: true,
          created_at: product.created_at,
          adjustment_type: "initial",
          previous_stock: 0,
          new_stock: initialStock,
          delta: initialStock,
          notes: "Produk dibuat — stok awal",
          transactions: null,
          gap: gap !== 0 ? { current: product.stock, expected: expectedStock, diff: gap } : null,
        });

        // Masukkan semua adjustment (konversi delta)
        for (const adj of adjustments) {
          events.push({
            ...adj,
            is_synthetic: false,
            delta: adj.new_stock - adj.previous_stock,
            gap: null,
          });
        }
      }

      // ── Filter setelahnya (utk synthetic event yg mungkin ter-filter) ──
      let filtered = events;
      if (type && type !== "initial") {
        filtered = filtered.filter(e => e.adjustment_type === type);
      }
      if (startDate) {
        filtered = filtered.filter(e => new Date(e.created_at) >= new Date(startDate));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(e => new Date(e.created_at) <= end);
      }

      res.json({
        product: {
          ...product,
          seller_name: sellerName,
          initial_stock: initialStock,
          total_adjustments: adjustments?.length || 0,
        },
        events: filtered,
        total: filtered.length,
      });
    } catch (error) {
      console.error("Stock movements error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
