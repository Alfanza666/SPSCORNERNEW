// @ts-nocheck
// FIX H: Valid points_history types (DB constraint enforced):
//   'earned', 'spent', 'expired', 'refund', 'compensation'
// DILARANG insert type selain di atas — DB CHECK constraint akan reject.

let supabaseInstance = null;

export function initPaymentService(supabase) {
  supabaseInstance = supabase;
}

/**
 * Refund loyalty points when a transaction is cancelled/failed.
 * Idempotent: checks metadata.point_refunded before processing.
 * Returns { refunded: boolean, amount: number } or null on error.
 */
export async function refundTransactionPoints(transactionId) {
  try {
    const { data: tx, error: txError } = await supabaseInstance
      .from('transactions')
      .select('id, buyer_id, metadata')
      .eq('id', transactionId)
      .single();
    if (txError || !tx) return null;

    const meta = tx.metadata || {};
    const pointsUsed = Number(meta.points_used) || 0;
    const pointPayment = meta.point_payment;
    const alreadyRefunded = meta.point_refunded;

    // Skip jika tidak ada point yang dipakai atau sudah direfund
    if (!pointPayment || pointsUsed <= 0 || alreadyRefunded) {
      return { refunded: false, amount: 0 };
    }
    if (!tx.buyer_id) return { refunded: false, amount: 0 };

    // Atomic increment — kembalikan point ke buyer
    const { error: incrErr } = await supabaseInstance.rpc('increment_loyalty_points', {
      p_user_id: tx.buyer_id,
      p_amount: pointsUsed,
    });
    if (incrErr) {
      // FIX E: Fallback — read-then-write dengan GTE guard (anti race condition)
      const { data: profile } = await supabaseInstance
        .from('profiles')
        .select('loyalty_points')
        .eq('id', tx.buyer_id)
        .single();
      if (profile) {
        const currentPoints = Number(profile.loyalty_points) || 0;
        await supabaseInstance
          .from('profiles')
          .update({ loyalty_points: currentPoints + pointsUsed })
          .eq('id', tx.buyer_id)
          .gte('loyalty_points', currentPoints);
      }
    }

    // Record refund di points_history
    await supabaseInstance.from('points_history').insert({
      user_id: tx.buyer_id,
      transaction_id: transactionId,
      points: pointsUsed,
      type: 'refund',
      description: `Refund point dari transaksi #${transactionId.slice(0, 8)} yang dibatalkan`,
    });

    // Mark sebagai sudah direfund (idempotency)
    await supabaseInstance
      .from('transactions')
      .update({
        metadata: {
          ...meta,
          point_refunded: true,
          point_refund_amount: pointsUsed,
          point_refunded_at: new Date().toISOString(),
        }
      })
      .eq('id', transactionId);

    console.log(`[PointsRefund] Refunded ${pointsUsed} points for tx ${transactionId.slice(0, 8)}`);
    return { refunded: true, amount: pointsUsed };
  } catch (e) {
    console.error(`[PointsRefund] Error refunding points for ${transactionId}:`, e);
    // Jangan throw — cancel transaksi tetap jalan meski refund gagal
    return null;
  }
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
    const numAmount = Number(total_amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    const pointsEarned = Math.floor(numAmount * 0.008);
    if (pointsEarned < 1) return;

    let source = null;

    // FIX D: Atomic increment — only record history if this succeeds
    const { error: incrErr } = await supabaseInstance.rpc('increment_loyalty_points', {
      p_user_id: buyer_id,
      p_amount: pointsEarned,
    });
    if (!incrErr) {
      source = 'rpc';
    } else {
      // FIX D: Fallback — read-then-write with GTE guard
      const { data: profile } = await supabaseInstance.from("profiles").select("loyalty_points").eq("id", buyer_id).single();
      if (profile) {
        const { error: fallbackErr } = await supabaseInstance
          .from("profiles")
          .update({ loyalty_points: (Number(profile.loyalty_points) || 0) + pointsEarned })
          .eq("id", buyer_id)
          .gte("loyalty_points", Number(profile.loyalty_points) || 0);
        if (!fallbackErr) {
          source = 'fallback';
        }
      }
    }

    // FIX D: Only insert history if points were actually added
    if (source) {
      await supabaseInstance.from("points_history").insert({
        user_id: buyer_id, transaction_id: tx_id, amount: pointsEarned, type: 'earned',
        description: `Poin dari transaksi #${tx_id.slice(0,8)} (via ${source})`,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } else {
      console.error(`[updateBuyerPoints] Both RPC and fallback failed for ${tx_id} — no phantom record created`);
    }
  } catch (e) { console.error("updateBuyerPoints error:", e); }
}
