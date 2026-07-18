// @ts-nocheck
import { __name } from "./route-utils.js";
import { fetchAllByRange } from "./adminReporting.js";

const SETTLED_STATUSES = ["paid", "success"];
const ANALYTICS_FETCH_CHUNK = 500;
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

function oneRelation(value) {
  return Array.isArray(value) ? (value[0] || null) : (value || null);
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAtOrAfter(value, lowerBoundIso) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= Date.parse(lowerBoundIso);
}

function witaDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + WITA_OFFSET_MS).toISOString().slice(0, 10);
}

function witaPeriodStart(now, period) {
  const shifted = new Date(now.getTime() + WITA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = period === "year" ? 0 : shifted.getUTCMonth();
  return new Date(Date.UTC(year, month, 1) - WITA_OFFSET_MS).toISOString();
}

function ensureResult(result, context) {
  if (result?.error) throw new Error(`${context}: ${result.error.message || result.error.code || "query failed"}`);
  return result;
}

function fetchAllRows(queryFactory) {
  return fetchAllByRange(queryFactory, ANALYTICS_FETCH_CHUNK);
}

export function buildSellerAnalyticsData({ monthItems, last30DayItems, profile }) {
  const monthRevenue = monthItems.reduce((sum, item) => sum + numeric(item.subtotal), 0);
  const totalOrders = new Set(monthItems.map(item => item.transaction_id).filter(Boolean)).size;

  const weeklyMap = {};
  for (const item of last30DayItems) {
    const transaction = oneRelation(item.transactions);
    const day = transaction?.created_at ? witaDateKey(transaction.created_at) : null;
    if (!day) continue;
    weeklyMap[day] = (weeklyMap[day] || 0) + numeric(item.subtotal);
  }
  const weeklyBreakdown = Object.entries(weeklyMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, revenue]) => ({ date, revenue }));

  const productPerformance = {};
  for (const item of monthItems) {
    const product = oneRelation(item.products);
    const name = product?.name || "Unknown";
    productPerformance[name] = (productPerformance[name] || 0) + numeric(item.quantity);
  }
  const productData = Object.entries(productPerformance)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 10)
    .map(([name, quantity]) => ({ name, quantity }));

  return {
    monthRevenue,
    totalOrders,
    balance: numeric(profile?.balance),
    totalSales: numeric(profile?.total_sales),
    weeklyBreakdown,
    productData,
  };
}

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
      const startOfMonth = witaPeriodStart(now, "month");
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const startOfYear = witaPeriodStart(now, "year");

      const [settledTransactions, sellerCountRaw, productCountRaw, monthItems, yearItems] = await Promise.all([
        fetchAllRows(() => supabase
          .from("transactions")
          .select("id,total_amount,created_at")
          .in("status", SETTLED_STATUSES)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "seller"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        fetchAllRows(() => supabase
          .from("transaction_items")
          .select("id,quantity,price,created_at,products(name),transactions!inner(status,created_at)")
          .in("transactions.status", SETTLED_STATUSES)
          .gte("transactions.created_at", startOfMonth)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })),
        fetchAllRows(() => supabase
          .from("transaction_items")
          .select("id,quantity,created_at,products(category),transactions!inner(status,created_at)")
          .in("transactions.status", SETTLED_STATUSES)
          .gte("transactions.created_at", startOfYear)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })),
      ]);
      const sellerCount = ensureResult(sellerCountRaw, "seller count");
      const productCount = ensureResult(productCountRaw, "product count");

      const monthTransactions = settledTransactions.filter(transaction => isAtOrAfter(transaction.created_at, startOfMonth));
      const dailyTransactions = settledTransactions.filter(transaction => isAtOrAfter(transaction.created_at, startOfWeek));
      const monthRevenue = monthTransactions.reduce((sum, transaction) => sum + numeric(transaction.total_amount), 0);
      const totalRevenue = settledTransactions.reduce((sum, transaction) => sum + numeric(transaction.total_amount), 0);
      const dailyRevenue = dailyTransactions.reduce((sum, transaction) => sum + numeric(transaction.total_amount), 0);

      // Daily breakdown
      const dailyMap = {};
      for (const tx of dailyTransactions) {
        const day = witaDateKey(tx.created_at);
        if (!day) continue;
        dailyMap[day] = (dailyMap[day] || 0) + numeric(tx.total_amount);
      }
      const dailyBreakdown = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));

      // Top products
      const topProductsData = monthItems.reduce((acc, item) => {
        const name = oneRelation(item.products)?.name || "Unknown";
        const existing = acc.find(p => p.name === name);
        if (existing) { existing.quantity += numeric(item.quantity); existing.revenue += numeric(item.quantity) * numeric(item.price); }
        else acc.push({ name, quantity: numeric(item.quantity), revenue: numeric(item.quantity) * numeric(item.price) });
        return acc;
      }, []).sort((a, b) => b.revenue - a.revenue);

      // Category breakdown
      const categoryMap = {};
      for (const item of yearItems) {
        const cat = oneRelation(item.products)?.category || "Uncategorized";
        categoryMap[cat] = (categoryMap[cat] || 0) + numeric(item.quantity);
      }
      const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

      res.json({
        monthTx: monthTransactions.length,
        totalTx: settledTransactions.length,
        monthRevenue,
        totalRevenue,
        sellerCount: sellerCount.count || 0,
        productCount: productCount.count || 0,
        dailyRevenue,
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
      const startOfMonth = witaPeriodStart(now, "month");
      const startOfLast30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sellerItemsQuery = (startIso) => {
        let query = supabase
          .from("transaction_items")
          .select("id,transaction_id,seller_id,quantity,subtotal,created_at,products(name),transactions!inner(id,status,created_at)")
          .in("transactions.status", SETTLED_STATUSES)
          .gte("transactions.created_at", startIso)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });
        if (sellerId) query = query.eq("seller_id", sellerId);
        return query;
      };

      // Each factory returns a fresh PostgREST builder. Reusing one builder would
      // append both date filters to the same URL and silently mix the periods.
      const [monthItems, last30DayItems, allTimeRaw] = await Promise.all([
        fetchAllRows(() => sellerItemsQuery(startOfMonth)),
        fetchAllRows(() => sellerItemsQuery(startOfLast30Days)),
        supabase.from("profiles").select("balance, total_sales").eq("id", user.id).single(),
      ]);
      const allTime = ensureResult(allTimeRaw, "seller profile totals");

      res.json(buildSellerAnalyticsData({
        monthItems,
        last30DayItems,
        profile: allTime.data,
      }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  }, "/api/analytics/seller"));
}
