// @ts-nocheck
import { __name } from "./route-utils.js";

export function registerPushRoutes(app, { supabase, webpush, sendNotification, sendPushToUser }) {
  __name(registerPushRoutes, "registerPushRoutes");

  app.post("/api/push/subscribe", async (req, res) => {
    const { user_id, subscription } = req.body;
    if (!user_id || !subscription) return res.status(400).json({ error: "Data tidak lengkap" });

    try {
      // Upsert: use endpoint as unique key to avoid duplicates
      const endpoint = subscription?.endpoint;
      if (endpoint) {
        const { data: existing } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user_id)
          .eq("subscription->endpoint", endpoint)
          .maybeSingle();

        if (!existing) {
          await supabase.from("push_subscriptions").insert({ user_id, subscription });
        }
      } else {
        await supabase.from("push_subscriptions").insert({ user_id, subscription });
      }
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Push subscribe error:", error);
      res.status(500).json({ error: "Gagal menyimpan langganan" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    const { user_id, endpoint } = req.body;
    if (!user_id || !endpoint) return res.status(400).json({ error: "Data tidak lengkap" });

    try {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user_id)
        .eq("subscription->endpoint", endpoint);
      res.json({ success: true });
    } catch (error) {
      console.error("Push unsubscribe error:", error);
      res.status(500).json({ error: "Gagal berhenti langganan" });
    }
  });

  // Test push endpoint (localhost only)
  app.post("/api/push/test", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress;
      if (clientIp !== "127.0.0.1" && clientIp !== "::1" && clientIp !== "::ffff:127.0.0.1") {
        return res.status(403).json({ error: "Localhost only" });
      }
      const { userId, title = "Test Push", message = "Test dari VPS", url = "/" } = req.body;
      if (!userId) return res.status(400).json({ error: "userId required" });

      await sendNotification(userId, { type: "system", title, message, path: url });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Test push error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
