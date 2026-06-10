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
    await supabaseInstance.from("notifications").insert({
      user_id: userId, type: payload.type, title: payload.title, message: payload.message, path: payload.path || "/", is_read: false,
    });
    const { data: subs } = await supabaseInstance.from("push_subscriptions").select("subscription").eq("user_id", userId);
    if (subs && subs.length > 0) {
      const pushPayload = JSON.stringify({ title: payload.title, body: payload.message, url: payload.path || "/", tag: `sps-${payload.type || 'notif'}` });
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
