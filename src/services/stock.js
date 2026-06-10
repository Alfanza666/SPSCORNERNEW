// @ts-nocheck
let supabaseInstance = null;
let sendNotificationFn = null;
let sendWANotificationFn = null;
const LOW_STOCK_THRESHOLD = 5;

export function initStockService(supabase, sendNotif, sendWA) {
  supabaseInstance = supabase;
  sendNotificationFn = sendNotif;
  sendWANotificationFn = sendWA;
}

export async function restoreTransactionStock(transactionId) {
  try {
    const { data: tx } = await supabaseInstance.from("transactions").select("metadata").eq("id", transactionId).single();
    if (!tx?.metadata?.stock_deducted) return;
    if (tx?.metadata?.stock_restored) return;
    const { data: items } = await supabaseInstance.from("transaction_items").select("product_id, quantity, seller_id").eq("transaction_id", transactionId);
    if (!items || items.length === 0) return;
    for (const item of items) {
      if (!item.product_id) continue;
      const { data: product } = await supabaseInstance.from("products").select("stock").eq("id", item.product_id).single();
      if (product) {
        await supabaseInstance.from("products").update({ stock: product.stock + item.quantity }).eq("id", item.product_id);
        if (item.seller_id) {
          await supabaseInstance.from("stock_adjustments").insert({
            product_id: item.product_id, user_id: item.seller_id, previous_stock: product.stock, new_stock: product.stock + item.quantity, adjustment_type: "correction", notes: `Stock restored — transaction ${transactionId} cancelled/failed`,
          });
        }
      }
    }
    await supabaseInstance.from("transactions").update({ metadata: { ...(tx.metadata || {}), stock_restored: true } }).eq("id", transactionId);
  } catch (e) {
    console.error(`restoreTransactionStock error for ${transactionId}:`, e);
  }
}

export async function checkLowStockAndNotify(items) {
  try {
    for (const item of items) {
      if (!item.product_id) continue;
      const { data: product } = await supabaseInstance.from("products").select("name, stock, seller_id").eq("id", item.product_id).single();
      if (product && product.stock < LOW_STOCK_THRESHOLD && product.seller_id) {
        const { data: seller } = await supabaseInstance.from("profiles").select("name, email").eq("id", product.seller_id).single();
        const sellerName = seller?.name || "Penjual";
        if (sendNotificationFn) {
          await sendNotificationFn(product.seller_id, {
            type: "system", title: "⚠️ Stok Menipis!",
            message: `Produk "${product.name}" tersisa ${product.stock}. Segera lakukan restock.`,
            path: "/dashboard/seller/products",
          });
        }
        if (sendWANotificationFn) {
          await sendWANotificationFn(product.seller_id, 'low_stock_admin', {
            product_name: product.name, stock: product.stock,
          });
        }
        // Log to notification_logs
        await supabaseInstance.from("notification_logs").insert({
          user_id: product.seller_id, type: 'low_stock',
          title: `Stok ${product.name} menipis`,
          message: `Tersisa ${product.stock} dari ${LOW_STOCK_THRESHOLD} threshold`,
          metadata: { product_id: item.product_id, stock: product.stock },
        });
      }
    }
  } catch (e) {
    console.error("checkLowStockAndNotify error:", e);
  }
}
