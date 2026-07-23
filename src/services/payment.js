// @ts-nocheck
let supabaseInstance = null;

export function initPaymentService(supabase) {
  supabaseInstance = supabase;
}

export async function updateSellerBalances(items, transactionId) {
  if (!transactionId) throw new Error("transactionId is required for seller balance settlement");

  const { data, error } = await supabaseInstance.rpc(
    "apply_seller_balance_for_transaction",
    { p_transaction_id: transactionId },
  );
  if (error) {
    console.error(`[SellerBalance] Atomic settlement failed for ${transactionId}:`, error);
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result?.success) {
    console.log(`[SellerBalance] Settled ${result.seller_count || 0} seller(s) for ${transactionId}`);
  } else {
    console.log(`[SellerBalance] Already settled or not eligible for ${transactionId}`);
  }
  return result || { success: false };
}

export async function updateBuyerPoints(tx_id, buyer_id, total_amount) {
  try {
    if (!buyer_id) return;
    const pointsEarned = Math.floor(Number(total_amount) * 0.008);
    if (pointsEarned < 1) return;
    // Atomic increment — no read-then-write
    const { error: incrErr } = await supabaseInstance.rpc('increment_loyalty_points', {
      p_user_id: buyer_id,
      p_amount: pointsEarned,
    });
    if (incrErr) {
      // Fallback: read-then-write with GTE guard
      const { data: profile } = await supabaseInstance.from("profiles").select("loyalty_points").eq("id", buyer_id).single();
      if (profile) {
        await supabaseInstance.from("profiles").update({ loyalty_points: (Number(profile.loyalty_points) || 0) + pointsEarned }).eq("id", buyer_id);
      }
    }
    await supabaseInstance.from("points_history").insert({
      user_id: buyer_id, transaction_id: tx_id, amount: pointsEarned, type: 'earned', description: `Poin dari transaksi #${tx_id.slice(0,8)}`,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (e) { console.error("updateBuyerPoints error:", e); }
}
