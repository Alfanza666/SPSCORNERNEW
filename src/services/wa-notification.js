// @ts-nocheck
// WhatsApp notification service using wa.me links (free, manual click)
// Upgrade path: replace with WhatsApp Cloud API or Fonnte for auto-send
let supabaseInstance = null;
const WA_ADMIN_NUMBER = process.env.WA_ADMIN_NUMBER || '62818222604';
const APP_URL = process.env.APP_URL || 'https://spscorner.store';

export function initWANotification(supabase) {
  supabaseInstance = supabase;
}

export function waLink(phone, text) {
  const encoded = encodeURIComponent(text);
  return `https://wa.me/${phone}?text=${encoded}`;
}

export async function sendWANotification(userId, type, data = {}) {
  try {
    const { data: profile } = await supabaseInstance
      .from("profiles")
      .select("phone, wa_notification_enabled, name")
      .eq("id", userId)
      .single();

    const phone = profile?.phone;
    const enabled = profile?.wa_notification_enabled !== false;

    if (!phone || !enabled) return;

    let message = '';
    let txShortId = (data.transaction_id || '').slice(0, 8).toUpperCase();

    switch (type) {
      case 'payment_confirmed':
        message = `✅ *Pembayaran Dikonfirmasi!*\n\nHalo ${profile.name || 'Kak'},\n\nPembayaran Anda untuk transaksi #${txShortId} telah dikonfirmasi.\n\nDetail: ${APP_URL}/kiosk/history?id=${data.transaction_id}`;
        break;
      case 'order_processed':
        message = `📦 *Pesanan Diproses*\n\nHalo ${profile.name || 'Kak'},\n\nPesanan Anda #${txShortId} sedang diproses oleh penjual.\n\nDetail: ${APP_URL}/kiosk/history?id=${data.transaction_id}`;
        break;
      case 'order_ready':
        message = `🟢 *Pesanan Siap Diambil!*\n\nHalo ${profile.name || 'Kak'},\n\nPesanan Anda #${txShortId} sudah siap diambil.\n\nDetail: ${APP_URL}/kiosk/history?id=${data.transaction_id}`;
        break;
      case 'order_completed':
        message = `🎉 *Pesanan Selesai!*\n\nHalo ${profile.name || 'Kak'},\n\nPesanan Anda #${txShortId} telah selesai. Terima kasih sudah berbelanja di SPS Corner!\n\nDetail: ${APP_URL}/kiosk/history?id=${data.transaction_id}`;
        break;
      case 'digital_delivered':
        message = `📱 *Produk Digital Terkirim!*\n\nHalo ${profile.name || 'Kak'},\n\n${data.product_name || 'Produk digital'} Anda untuk ${data.target_number || ''} telah terkirim.\n\nDetail: ${APP_URL}/kiosk/history?id=${data.transaction_id}`;
        break;
      case 'low_stock_admin':
        message = `⚠️ *Stok Menipis!*\n\nProduk *${data.product_name}* tersisa ${data.stock}.\n\nSegera lakukan restock.\n\nDashboard: ${APP_URL}/dashboard/seller/products`;
        break;
      default:
        return;
    }

    await supabaseInstance.from("notification_logs").insert({
      user_id: userId,
      type: 'wa_' + type,
      title: `WA: ${type}`,
      message,
      wa_link: waLink(phone, message),
      metadata: { phone, transaction_id: data.transaction_id },
    });
  } catch (e) {
    console.error("sendWANotification error:", e);
  }
}
