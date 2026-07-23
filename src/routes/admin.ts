// @ts-nocheck
import { __name } from "./route-utils.js";
import crypto from "crypto";

export function registerAdminRoutes(app, { supabase, sendNotification, sendSarirotiEmailInternal }) {

app.get("/api/admin/password-resets", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return res.status(403).json({ error: "Forbidden: Admin only" });

    const { data: resets, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(resets || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/password-resets/complete", async (req, res) => {
  try {
    const { id } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return res.status(403).json({ error: "Forbidden: Admin only" });

    const { data: request, error: reqError } = await supabase
      .from('password_reset_requests')
      .select('user_id')
      .eq('id', id)
      .single();

    if (reqError || !request) {
      return res.status(404).json({ error: "Permintaan reset password tidak ditemukan." });
    }

    const tempPassword = crypto.randomBytes(4).toString('hex') + "A1!";
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(request.user_id, {
      password: tempPassword
    });

    if (updateAuthError) throw updateAuthError;

    const { error } = await supabase
      .from('password_reset_requests')
      .update({ status: 'completed' })
      .eq('id', id);

    const { data: userProfile } = await supabase.from('profiles').select('email').eq('id', request.user_id).single();
    if (userProfile?.email) {
      sendSarirotiEmailInternal(
        userProfile.email,
        'Password Baru - SPS Corner',
        `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2>Password Anda Telah DiReset</h2>
          <p>Berikut password sementara Anda:</p>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;text-align:center;font-size:24px;font-family:monospace;letter-spacing:4px;margin:16px 0;">${tempPassword}</div>
          <p style="color:#ef4444;font-weight:bold;">Segera ganti password Anda setelah login.</p>
          <p style="color:#6b7280;font-size:12px;">Abaikan email ini jika Anda tidak meminta reset password.</p>
        </div>`
      ).catch(e => console.warn("[Email] Gagal kirim password reset:", e.message));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/stock-report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return res.status(403).json({ error: "Forbidden: Admin only" });

    const sellerFilter = req.query.seller_id;
    const dateStart = req.query.date_start;
    const dateEnd = req.query.date_end;
    const categoryFilter = req.query.category;

    // 1. Get all products (tidak filter created_at — produk dari luar periode tetap muncul)
    let query = supabase
      .from("products")
      .select("id, name, stock, seller_id, created_at, category");
    if (sellerFilter) query = query.eq("seller_id", sellerFilter);
    if (categoryFilter) query = query.eq("category", categoryFilter);
    const { data: products, error: productsError } = await query;
    if (productsError) throw productsError;

    const productIds = products.map(p => p.id);

    // 2a. Get ALL stock adjustments (no date filter) — untuk initialStock yang akurat
    let allAdjQuery = supabase
      .from("stock_adjustments")
      .select("product_id, adjustment_type, previous_stock, new_stock")
      .in("product_id", productIds);
    const { data: allAdjustments, error: allAdjError } = await allAdjQuery;
    if (allAdjError) throw allAdjError;

    // 2b. Get stock adjustments within date range (untuk kolom pergerakan periode)
    let periodAdjQuery = supabase
      .from("stock_adjustments")
      .select("product_id, adjustment_type, previous_stock, new_stock, created_at")
      .in("product_id", productIds);
    if (dateStart) periodAdjQuery = periodAdjQuery.gte("created_at", dateStart + "T00:00:00+07:00");
    if (dateEnd) periodAdjQuery = periodAdjQuery.lte("created_at", dateEnd + "T23:59:59+07:00");
    periodAdjQuery = periodAdjQuery.order("created_at", { ascending: true });
    const { data: periodAdjustments, error: periodAdjError } = await periodAdjQuery;
    if (periodAdjError) throw periodAdjError;

    // 3. Helper: group adjustments into movements
    const groupAdjustments = (adjustments) => {
      const grouped = {};
      for (const adj of adjustments || []) {
        const id = adj.product_id;
        if (!grouped[id]) grouped[id] = { restock: 0, sold: 0, returned: 0, restored: 0, manualUpdate: 0 };
        const g = grouped[id];
        if (adj.adjustment_type === "restock") {
          g.restock += (adj.new_stock - adj.previous_stock);
        } else if (adj.adjustment_type === "sale") {
          g.sold += (adj.previous_stock - adj.new_stock);
        } else if (adj.adjustment_type === "correction") {
          const diff = adj.new_stock - adj.previous_stock;
          if (diff > 0) { g.restored += diff; } else { g.returned += Math.abs(diff); }
        } else if (adj.adjustment_type === "manual_update") {
          g.manualUpdate += (adj.new_stock - adj.previous_stock);
        }
      }
      return grouped;
    };

    const allGrouped = groupAdjustments(allAdjustments);
    const periodGrouped = groupAdjustments(periodAdjustments);

    // 4. Build report
    //    initialStock dihitung dari ALL adjustments (seluruh riwayat)
    //    kolom Restock/Terjual/Retur/Restore/Manual dari periode terpilih
    const report = products.map(product => {
      const allD = allGrouped[product.id] || { restock: 0, sold: 0, returned: 0, restored: 0, manualUpdate: 0 };
      const periodD = periodGrouped[product.id] || { restock: 0, sold: 0, returned: 0, restored: 0, manualUpdate: 0 };
      const netChangeAll = allD.restock - allD.sold - allD.returned + allD.restored + allD.manualUpdate;
      const initialStock = product.stock - netChangeAll;

      return {
        id: product.id,
        name: product.name,
        seller_id: product.seller_id,
        createdAt: product.created_at,
        initialStock,
        totalRestock: periodD.restock,
        totalSold: periodD.sold,
        totalReturned: periodD.returned,
        totalRestored: periodD.restored,
        totalManualUpdate: periodD.manualUpdate,
        currentStock: product.stock
      };
    });

    // 5. Get sellers info
    const sellerIds = [...new Set(products.map(p => p.seller_id).filter(Boolean))];
    let sellersMap = {};
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase.from("profiles").select("id, name").in("id", sellerIds);
      for (const s of sellers || []) sellersMap[s.id] = s.name;
    }

    // 6. Get all categories for filter
    let allCategories = [];
    try {
      const { data: categoryRows } = await supabase.from("products").select("category");
      allCategories = [...new Set((categoryRows || []).map(c => c.category).filter(Boolean))];
    } catch (e) {
      // categories column may not exist — ignore
    }

    res.json({ report, sellers: sellersMap, categories: allCategories });
  } catch (err) {
    console.error("Stock report error:", err);
    res.status(500).json({ error: err.message });
  }
});

}
