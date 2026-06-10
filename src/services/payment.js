// @ts-nocheck
let supabaseInstance = null;

export function initPaymentService(supabase) {
  supabaseInstance = supabase;
}

export async function updateSellerBalances(items) {
  try {
    for (const item of items) {
      if (!item.seller_id) continue;
      const fee = Number(item.price) * 0.007;
      const netAmount = Number(item.price) - fee;
      const { data: seller } = await supabaseInstance.from("profiles").select("balance, total_sales, total_fee_paid").eq("id", item.seller_id).single();
      if (seller) {
        await supabaseInstance.from("profiles").update({
          balance: (Number(seller.balance) || 0) + netAmount,
          total_sales: (Number(seller.total_sales) || 0) + Number(item.price),
          total_fee_paid: (Number(seller.total_fee_paid) || 0) + fee,
        }).eq("id", item.seller_id);
      }
    }
  } catch (e) { console.error("updateSellerBalances error:", e); }
}

export async function updateBuyerPoints(tx_id, buyer_id, total_amount) {
  try {
    if (!buyer_id) return;
    const pointsEarned = Math.floor(Number(total_amount) * 0.008);
    if (pointsEarned < 1) return;
    const { data: profile } = await supabaseInstance.from("profiles").select("loyalty_points").eq("id", buyer_id).single();
    if (profile) {
      await supabaseInstance.from("profiles").update({ loyalty_points: (Number(profile.loyalty_points) || 0) + pointsEarned }).eq("id", buyer_id);
      await supabaseInstance.from("points_history").insert({
        user_id: buyer_id, transaction_id: tx_id, amount: pointsEarned, type: 'earned', description: `Poin dari transaksi #${tx_id.slice(0,8)}`,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  } catch (e) { console.error("updateBuyerPoints error:", e); }
}
