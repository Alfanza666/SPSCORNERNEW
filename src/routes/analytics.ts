// @ts-nocheck
import { __name } from "./route-utils.js";

export function registerAnalyticsRoutes(app, { supabase }) {

  app.get("/api/analytics/overview", __name(async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
      const { data: profile } = await supabase.from("profiles").select("role, id").eq("id", user.id).single();
      if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

      const [monthTx, totalTx, totalRevenue, sellerCount, productCount, dailyTx, topProducts, categorySales] = await Promise.all([
        supabase.from("transactions").select("total_amount", { count: "exact" }).eq("status", "paid").gte("created_at", startOfMonth),
        supabase.from("transactions").select("total_amount", { count: "exact" }).eq("status", "paid"),
        supabase.from("transactions").select("total_amount").eq("status", "paid"),
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "seller"),
        supabase.from("products").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("transactions").select("total_amount, created_at").eq("status", "paid").gte("created_at", startOfWeek),
        supabase.from("transaction_items").select("products(name), quantity, price").gte("created_at", startOfMonth).limit(10),
        supabase.from("transaction_items").select("products(category), quantity").gte("created_at", startOfYear),
      ]);

      const monthRevenue = (monthTx.data || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);
      const totalRev = (totalRevenue.data || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);
      const dailyRev = (dailyTx.data || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);

      // Daily breakdown
      const dailyMap = {};
      for (const tx of (dailyTx.data || [])) {
        const day = new Date(tx.created_at).toISOString().split('T')[0];
        dailyMap[day] = (dailyMap[day] || 0) + Number(tx.total_amount || 0);
      }
      const dailyBreakdown = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));

      // Top products
      const topProductsData = (topProducts.data || []).slice(0, 10).reduce((acc, item) => {
        const name = item.products?.name || "Unknown";
        const existing = acc.find(p => p.name === name);
        if (existing) { existing.quantity += (item.quantity || 0); existing.revenue += (item.quantity || 0) * (item.price || 0); }
        else acc.push({ name, quantity: item.quantity || 0, revenue: (item.quantity || 0) * (item.price || 0) });
        return acc;
      }, []).sort((a, b) => b.revenue - a.revenue);

      // Category breakdown
      const categoryMap = {};
      for (const item of (categorySales.data || [])) {
        const cat = item.products?.category || "Uncategorized";
        categoryMap[cat] = (categoryMap[cat] || 0) + (item.quantity || 0);
      }
      const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

      res.json({
        monthTx: monthTx.count || 0,
        totalTx: totalTx.count || 0,
        monthRevenue,
        totalRevenue: totalRev,
        sellerCount: sellerCount.count || 0,
        productCount: productCount.count || 0,
        dailyRevenue: dailyRev,
        dailyBreakdown,
        topProducts: topProductsData.slice(0, 5),
        categoryData,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }, "/api/analytics/overview"));

  app.get("/api/analytics/seller", __name(async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
      const { data: profile } = await supabase.from("profiles").select("role, id").eq("id", user.id).single();
      if (!profile || (profile.role !== "seller" && profile.role !== "admin" && profile.role !== "superadmin")) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const sellerId = profile.role === "seller" ? user.id : null;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      let txQuery = supabase.from("transactions").select("total_amount, created_at, transaction_items(product_id, quantity, price, products(name))", { count: "exact" }).eq("status", "paid");
      let countQuery = supabase.from("transactions").select("id", { count: "exact" }).eq("status", "paid");
      if (sellerId) {
        txQuery = txQuery.filter("transaction_items.seller_id", "eq", sellerId);
        countQuery = countQuery.filter("transaction_items.seller_id", "eq", sellerId);
      }

      const [allTx, monthTx, allTime] = await Promise.all([
        txQuery.gte("created_at", startOfMonth),
        txQuery.gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("profiles").select("balance, total_sales").eq("id", user.id).single(),
      ]);

      const monthRevenue = (allTx.data || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);
      const totalOrders = allTx.count || 0;

      const weeklyTx = (monthTx.data || []).reduce((acc, tx) => {
        const day = new Date(tx.created_at).toISOString().split('T')[0];
        acc[day] = (acc[day] || 0) + Number(tx.total_amount || 0);
        return acc;
      }, {});
      const weeklyBreakdown = Object.entries(weeklyTx).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));

      // Product performance
      const productPerformance = {};
      for (const tx of (allTx.data || [])) {
        for (const item of (tx.transaction_items || [])) {
          const name = item.products?.name || "Unknown";
          productPerformance[name] = (productPerformance[name] || 0) + (item.quantity || 0);
        }
      }
      const productData = Object.entries(productPerformance).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, quantity]) => ({ name, quantity }));

      res.json({
        monthRevenue,
        totalOrders,
        balance: (allTime.data?.balance || 0),
        totalSales: (allTime.data?.total_sales || 0),
        weeklyBreakdown,
        productData,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }, "/api/analytics/seller"));
}
