// @ts-nocheck
import { __name } from "./route-utils.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export function registerDiagnosticsRoutes(app, { supabase, griphub }) {
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/config/public", (req, res) => {
    res.json({
      VITE_VAPID_PUBLIC_KEY: process.env.VITE_VAPID_PUBLIC_KEY || "",
      VAPID_SUBJECT: process.env.VAPID_SUBJECT || "",
    });
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/api/debug-schema", async (req, res) => {
      const { data, error } = await supabase.rpc("get_schema_info");
      const { data: cols } = await supabase.from("transaction_items").select("*").limit(1);
      res.json({ error: null, cols: cols ? Object.keys(cols[0] || {}) : [] });
    });
    app.get("/api/debug/ip", async (req, res) => {
      try {
        const response = await axios.get("https://ifconfig.me/ip");
        const ip = response.data.trim();
        let proxyIp = null;
        if (FIXIE_URL) {
          try {
            const proxyResponse = await axios.get("https://ifconfig.me/ip", getDigiflazzAxiosConfig());
            proxyIp = proxyResponse.data.trim();
          } catch (e) { proxyIp = "Error fetching proxy IP"; }
        }
        res.json({ outbound_ip: ip, proxy_ip: proxyIp, using_proxy: !!FIXIE_URL });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch outbound IP" });
      }
    });
  }

  app.get("/api/standby/check", async (req, res) => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const currentTime = now.toTimeString().split(" ")[0];
      const { data: schedule, error } = await supabase
        .from("standby_schedules")
        .select("*")
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true)
        .lte("start_time", currentTime)
        .gte("end_time", currentTime);
      if (error) throw error;
      res.json({
        is_standby: schedule && schedule.length > 0,
        schedule: schedule && schedule.length > 0 ? schedule[0] : null,
        current_time: currentTime,
        day: dayOfWeek,
      });
    } catch (error) {
      console.error("Error checking standby schedule:", error);
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/api/test-db4", async (req, res) => {
      try {
        const { data: items, error } = await supabase.from('transaction_items')
          .select(`*, products(name), transactions(id, buyer_id, buyer_name, status, created_at, payment_method)`)
          .eq('seller_id', 'cc4a7d0a-8020-4549-8e71-04bcbe673d1e')
          .order('created_at', { ascending: false });
        res.json({ count: items?.length, error: error?.message, items: items?.slice(0, 2) });
      } catch (e: any) { res.json({ error: e.message }); }
    });
    app.get("/api/test-db2", async (req, res) => {
      try {
        const { data } = await supabase.from('profiles').select('*')
          .in('id', ['0b11d7b5-d920-4c7b-bee0-472267ba92bc', 'cc4a7d0a-8020-4549-8e71-04bcbe673d1e']);
        res.json(data);
      } catch (e: any) { res.json({ error: e.message }); }
    });
    app.get("/api/test-db", async (req, res) => {
      try {
        const { data: sarirotiUsers } = await supabase.from("profiles").select("id, name")
          .eq("role", "seller").ilike("name", "%sariroti%");
        if (!sarirotiUsers || sarirotiUsers.length === 0) return res.json({ msg: "No sariroti seller" });
        const { data: items } = await supabase.from('transaction_items')
          .select(`id, seller_id, products ( name, category, seller_id )`)
          .order('created_at', { ascending: false }).limit(20);
        res.json({ users: sarirotiUsers, items });
      } catch (e: any) { res.json({ error: e.message }); }
    });
    app.get("/api/fix-sariroti", async (req, res) => {
      try {
        const { data: sarirotiUsers } = await supabase.from("profiles").select("id")
          .eq("role", "seller").ilike("name", "%sariroti%").limit(1);
        if (!sarirotiUsers || sarirotiUsers.length === 0) return res.json({ success: false, message: "Tidak ada admin sariroti" });
        const sarirotiId = sarirotiUsers[0].id;
        const { data: products } = await supabase.from("products").select("id")
          .or("category.eq.Sariroti,name.ilike.%roti%");
        if (products && products.length > 0) {
          const ids = products.map(p => p.id);
          await supabase.from("products").update({ seller_id: sarirotiId }).in("id", ids);
          await supabase.from("transaction_items").update({ seller_id: sarirotiId }).in("product_id", ids);
        }
        res.json({ success: true, message: "Berhasil mengaitkan Roti ke Admin Sariroti!", updatedProducts: (products || []).length });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });
  }

  // ── AI Test endpoint (admin only) — uji cepat verifikasi bukti bayar ──
  // Kirim gambar struk + nominal, lihat hasil AI langsung tanpa membuat transaksi nyata.
  // Read-only: tidak menyimpan/mengubah data apapun.
  app.post("/api/admin/ai/test-verify", async (req, res) => {
    try {
      const { image_base64, expected_amount } = req.body || {};
      if (!image_base64 || !expected_amount) {
        return res.status(400).json({ success: false, error: "image_base64 dan expected_amount wajib diisi" });
      }
      if (!griphub?.isConfigured) {
        return res.status(503).json({ success: false, error: "AI belum dikonfigurasi di server" });
      }

      const base64Data = String(image_base64).replace(/^data:image\/\w+;base64,/, "");
      const mimeType = String(image_base64).match(/data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
      const amountFormatted = Number(expected_amount).toLocaleString('id-ID');

      const prompt = [
        `Verifikasi bukti pembayaran kantin.`,
        `Harus dibayar: Rp ${amountFormatted}`,
        ``,
        `Aturan:`,
        `- VALID jika terlihat nominal ~Rp ${amountFormatted} (toleransi ±5%) DAN status berhasil ("Berhasil"/"Sukses"/centang hijau).`,
        `- Jangan tolak hanya karena gambar tidak ter-crop atau ada elemen lain di sekitar nota.`,
        `- TOLAK hanya jika: bukan bukti bayar, nominal JELAS beda jauh, atau status JELAS gagal/dibatalkan.`,
        ``,
        `Balas HANYA JSON tanpa markdown:`,
        `{"isValid": true/false, "amountFound": angka atau null, "reason": "alasan singkat Bahasa Indonesia"}`,
      ].join('\n');

      const visionModel = process.env.GRIPHUB_VISION_MODEL?.trim()
        || process.env.GRIPHUB_MODEL?.trim()
        || process.env.GROQ_VISION_MODEL?.trim();

      const startedAt = Date.now();
      const aiResponse = await griphub.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
            ],
          },
        ],
      });
      const durationMs = Date.now() - startedAt;

      const resultText = aiResponse.choices?.[0]?.message?.content;
      let parsed = null;
      let parseError = null;
      try {
        parsed = resultText
          ? JSON.parse(String(resultText).replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim())
          : null;
      } catch (e: any) {
        parseError = e?.message || 'Gagal parse JSON dari AI';
      }

      res.json({
        success: true,
        duration_ms: durationMs,
        model_used: visionModel,
        raw_response: resultText,
        parsed_result: parsed,
        parse_error: parseError,
      });
    } catch (error: any) {
      console.error("[AI Test] Error:", error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Gagal menjalankan test AI',
      });
    }
  });

  // ── Reconciliation status endpoint (admin only) ──────────────────
  app.get("/api/admin/reconciliation/status", async (req, res) => {
    try {
      const { data: mismatches, error } = await supabase.rpc('find_stock_balance_mismatches');
      if (error) throw error;

      const totalMismatches = mismatches?.length || 0;
      const missingStock = mismatches?.filter(m => !m.stock_deducted).length || 0;
      const missingBalance = mismatches?.filter(m => !m.balances_updated).length || 0;

      // Also check stock drift
      const { data: products } = await supabase.from('products').select('id, name, stock').eq('is_active', true);
      const { data: adjustments } = await supabase.from('stock_adjustments').select('product_id, new_stock').order('created_at', { ascending: false });

      let stockDrifts = 0;
      if (products && adjustments) {
        const latestStock = {};
        for (const adj of adjustments) {
          if (!latestStock[adj.product_id]) latestStock[adj.product_id] = adj.new_stock;
        }
        for (const p of products) {
          if (latestStock[p.id] !== undefined && latestStock[p.id] !== p.stock) {
            stockDrifts++;
          }
        }
      }

      res.json({
        status: totalMismatches === 0 && stockDrifts === 0 ? 'healthy' : 'warning',
        mismatches: totalMismatches,
        missing_stock: missingStock,
        missing_balance: missingBalance,
        stock_drifts: stockDrifts,
        details: mismatches?.slice(0, 20) || [],
        checked_at: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });
}
