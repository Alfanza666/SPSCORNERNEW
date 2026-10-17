// @ts-nocheck
let supabaseInstance = null;
let webpushInstance = null;

export function initNotificationService(supabase, webpush) {
  supabaseInstance = supabase;
  webpushInstance = webpush;
}

export async function sendPushToUser(userId, title, body, url = "/", tag = "sps-notif") {
  try {
    const { data: subs } = await supabaseInstance
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);
    if (!subs || subs.length === 0) return;
    const payload = JSON.stringify({ title, body, url, tag });
    const results = await Promise.allSettled(
      subs.map((row) => webpushInstance.sendNotification(row.subscription, payload, { urgency: 'high' }))
    );
    results.forEach(async (result, idx) => {
      if (result.status === "rejected") {
        const statusCode = result.reason?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabaseInstance.from("push_subscriptions").delete().eq("user_id", userId).eq("subscription->endpoint", subs[idx].subscription?.endpoint);
        }
      }
    });
  } catch (e) {
    console.error("sendPushToUser error:", e);
  }
}

export async function sendPushToAdmins(title, body, url = "/dashboard/admin") {
  try {
    const { data: admins } = await supabaseInstance.from("profiles").select("id").in("role", ["admin", "superadmin"]);
    if (!admins) return;
    await Promise.all(admins.map((a) => sendPushToUser(a.id, title, body, url)));
  } catch (e) {
    console.error("sendPushToAdmins error:", e);
  }
}

export async function createNotification(userId, type, title, message, path = "/") {
  try {
    await supabaseInstance.from("notifications").insert({ user_id: userId, type, title, message, path, is_read: false });
    await sendPushToUser(userId, title, message, path);
  } catch (e) {
    console.error("createNotification error:", e);
  }
}

export async function sendNotification(userId, payload) {
  try {
    // Dedup di level DB: jika notifikasi yang sama (user+type+title+path) sudah dibuat
    // dalam 60 detik terakhir, jangan insert & push ulang. Mencegah spam saat sebuah
    // event terpicu dari dua jalur (mis. callback gateway + manual verify).
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: dup } = await supabaseInstance
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", payload.type || "")
      .eq("title", payload.title)
      .eq("path", payload.path || "/")
      .gte("created_at", since)
      .limit(1);
    if (dup && dup.length > 0) return;

    await supabaseInstance.from("notifications").insert({
      user_id: userId, type: payload.type, title: payload.title, message: payload.message, path: payload.path || "/", is_read: false,
    });
    const { data: subs } = await supabaseInstance.from("push_subscriptions").select("subscription").eq("user_id", userId);
    if (subs && subs.length > 0) {
      // Tag unik per event: path biasanya memuat ID transaksi/tagihan → notifikasi
      // untuk kejadian yang sama menggantikan notifikasi lama, bukan menumpuk.
      const tag = `sps-${payload.type || 'notif'}-${(payload.path || '/').replace(/[^a-zA-Z0-9]/g, '_')}`;
      const pushPayload = JSON.stringify({ title: payload.title, body: payload.message, url: payload.path || "/", tag });
      await Promise.all(subs.map((sub, idx) =>
        webpushInstance.sendNotification(sub.subscription, pushPayload, { urgency: 'high' }).catch((err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            supabaseInstance.from("push_subscriptions").delete().eq("user_id", userId).eq("subscription->endpoint", subs[idx].subscription?.endpoint).then(() => {});
          }
        })
      ));
    }
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
}
