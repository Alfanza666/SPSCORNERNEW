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

// ── Retry wrapper ──────────────────────────────────────────────
// Kalau fn() return null/undefined, diulang maxRetries kali
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await fn();
    if (result !== null && result !== undefined) return result;
    if (i < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 150 * (i + 1)));
    }
  }
  return null;
}

// ── Atomic stock adjustment (RPC → optimistic fallback) ──────
// panggil dengan delta positif (restock/restore) atau negatif (sale/retur)
// return: { success: bool, new_stock: int, error_message: string|null }
async function atomicAdjustStock(productId, delta, userId, adjType, notes, minStock = null, transactionId = null) {
  // Priority 1: pakai RPC (row-level locking via FOR UPDATE)
  try {
    const { data, error } = await supabaseInstance.rpc('adjust_stock_rpc', {
      p_product_id: productId,
      p_delta: delta,
      p_user_id: userId,
      p_adjustment_type: adjType,
      p_notes: notes,
      p_min_stock: minStock,
      p_transaction_id: transactionId,
    });
    if (!error && data && data.length > 0) {
      return data[0];
    }
    // Kalau error karena function not found, fallback
    if (error && error.code !== 'PGRST202') {
      console.error(`[atomicAdjustStock] RPC error for ${productId}:`, error);
    }
  } catch (_) {
    // RPC not available — fallback to optimistic locking
  }

  // Priority 2: optimistic locking + retry
  return await withRetry(async () => {
    const { data: product } = await supabaseInstance
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    if (!product) return { success: false, new_stock: 0, error_message: 'Product not found' };

    const newStock = product.stock + delta;

    if (minStock !== null && newStock < minStock) {
      return {
        success: false,
        new_stock: product.stock,
        error_message: `Stock not sufficient: current ${product.stock}, delta ${delta}, min ${minStock}`,
      };
    }

    const { data: updated } = await supabaseInstance
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId)
      .eq('stock', product.stock)
      .select('id');

    if (!updated || updated.length === 0) return null; // conflict → retry

    if (userId) {
      const insertPayload = {
        product_id: productId, user_id: userId,
        previous_stock: product.stock, new_stock: newStock,
        adjustment_type: adjType, notes,
      };
      if (transactionId) insertPayload.transaction_id = transactionId;
      await supabaseInstance.from('stock_adjustments').insert(insertPayload);
    }

    return { success: true, new_stock: newStock, error_message: null };
  }, 3);
}

// ── Restore stock untuk transaction ──────────────────────────
export async function restoreTransactionStock(transactionId) {
  let claimAcquired = false;
  let claimMetadata = null;
  try {
    const { data: tx } = await supabaseInstance
      .from('transactions')
      .select('id, metadata')
      .eq('id', transactionId)
      .single();
    // Guard: skip HANYA jika stock_deducted EXPLICITLY false (digital-only).
    // undefined = metadata mungkin gagal di-set → tetap proceed & fallback ke transaction_items
    if (tx?.metadata?.stock_deducted === false) return;

    // Atomic conditional update — claim the restore slot (cegah TOCTOU double-restore)
    // neq uses IS DISTINCT FROM, which treats NULL as comparable: null IS DISTINCT FROM 'true' = TRUE ✓
    claimMetadata = { ...(tx.metadata || {}), stock_restore_claimed: true };
    const { data: claimed, error: claimError } = await supabaseInstance
      .from('transactions')
      .update({ metadata: claimMetadata })
      .eq('id', transactionId)
      // `neq` alone does not match a missing JSON key (NULL). Include both
      // NULL and non-true values so the first restore is actually claimed.
      .or('and(metadata->>stock_restored.is.null,metadata->>stock_restore_claimed.is.null),and(metadata->>stock_restored.is.null,metadata->>stock_restore_claimed.eq.false),and(metadata->>stock_restored.neq.true,metadata->>stock_restore_claimed.is.null),and(metadata->>stock_restored.neq.true,metadata->>stock_restore_claimed.eq.false)')
      .select('id');
    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) return;
    claimAcquired = true;

    const items = await getDeductedItems(tx);
    if (items.length === 0) {
      await supabaseInstance.from('transactions').update({
        metadata: { ...claimMetadata, stock_restored: true, stock_restore_claimed: false }
      }).eq('id', transactionId);
      return { success: true, restored: 0 };
    }

    const results = [];
    for (const { productId, quantity, sellerId } of items) {
      // Item-level guard: if a prior attempt restored this item but failed on
      // a later item, retry only the missing items.
      const { data: existingCorrection, error: correctionLookupError } = await supabaseInstance
        .from('stock_adjustments')
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('product_id', productId)
        .eq('adjustment_type', 'correction')
        .limit(1);
      if (correctionLookupError) throw correctionLookupError;
      if (existingCorrection?.length) {
        results.push({ success: true, skipped: true });
        continue;
      }
      const result = await atomicAdjustStock(
        productId, +quantity, sellerId || null, 'correction',
        `Stock restored — transaction ${transactionId} cancelled/failed`, null, transactionId
      );
      results.push(result);
    }

    const failed = results.filter(r => r && !r.success);
    if (failed.length > 0) {
      console.error(`[restoreTransactionStock] ${failed.length} item(s) failed for ${transactionId}:`, failed);
      throw new Error(`Stock restore failed for ${failed.length} item(s)`);
    }
    await supabaseInstance.from('transactions').update({
      metadata: { ...claimMetadata, stock_restored: true, stock_restore_claimed: false }
    }).eq('id', transactionId);
    return { success: true, restored: results.length };
  } catch (e) {
    if (claimAcquired) {
      await supabaseInstance.from('transactions').update({
        metadata: { ...(claimMetadata || {}), stock_restore_claimed: false }
      }).eq('id', transactionId)
        .or('metadata->>stock_restored.is.null,metadata->>stock_restored.neq.true');
    }
    console.error(`restoreTransactionStock error for ${transactionId}:`, e);
    throw e;
  }
}

// ── Re-deduct stock (iPaymu success after auto-cleanup) ──────
export async function deductTransactionStock(transactionId) {
  const errors = [];
  let claimAcquired = false;
  let claimMetadata = null;
  try {
    const { data: tx } = await supabaseInstance
      .from('transactions')
      .select('id, metadata')
      .eq('id', transactionId)
      .single();
    if (!tx?.metadata?.stock_deducted) return;
    if (!tx?.metadata?.stock_restored && !tx?.metadata?.stock_rededuct_pending) return;

    // Claim the re-deduction once; item-level sale guards make retries safe.
    claimMetadata = { ...(tx.metadata || {}), stock_restored: false, stock_rededuct_claimed: true };
    const { data: updatedTx, error: updateMetaError } = await supabaseInstance
      .from('transactions')
      .update({ metadata: claimMetadata })
      .eq('id', transactionId)
      .or('and(metadata->>stock_restored.eq.true,metadata->>stock_rededuct_claimed.is.null),and(metadata->>stock_restored.eq.true,metadata->>stock_rededuct_claimed.eq.false),and(metadata->>stock_rededuct_pending.eq.true,metadata->>stock_rededuct_claimed.is.null),and(metadata->>stock_rededuct_pending.eq.true,metadata->>stock_rededuct_claimed.eq.false)')
      .select('id');
    if (updateMetaError || !updatedTx || updatedTx.length === 0) {
      console.log(`[deductTransactionStock] Skipped ${transactionId}: stock_restored already changed by another process`);
      return;
    }
    claimAcquired = true;

    const items = await getDeductedItems(tx);
    if (items.length === 0) {
      await supabaseInstance.from('transactions').update({
        metadata: { ...claimMetadata, stock_rededuct_claimed: false, stock_rededuct_pending: false }
      }).eq('id', transactionId);
      return;
    }

    for (const { productId, quantity, sellerId } of items) {
      const { data: existingSale, error: saleLookupError } = await supabaseInstance
        .from('stock_adjustments')
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('product_id', productId)
        .eq('adjustment_type', 'sale')
        .limit(1);
      if (saleLookupError) throw saleLookupError;
      if (existingSale?.length) continue;
      const result = await atomicAdjustStock(
        productId, -quantity, sellerId || null, 'sale',
        `Stock re-deducted — transaction ${transactionId} paid after auto-cleanup`, null, transactionId
      );
      if (!result || !result.success) {
        errors.push({ productId, quantity, error: result?.error_message || 'Unknown' });
      }
    }

    if (errors.length > 0) {
      console.error(`[deductTransactionStock] ${errors.length} item(s) failed for ${transactionId}:`, errors);
      // Notify admins about the deduc failure
      const { data: admins } = await supabaseInstance
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'superadmin']);
      if (admins && sendNotificationFn) {
        for (const admin of admins) {
          await sendNotificationFn(admin.id, {
            type: 'system',
            title: '⚠️ Stok Gagal Re-deduct',
            message: `Transaksi ${transactionId} berhasil dibayar setelah auto-cleanup, tapi ${errors.length} item gagal re-deduct stok. Periksa stok manual.`,
            path: `/dashboard/admin/transactions?id=${transactionId}`,
          });
        }
      }
      throw new Error(`Stock re-deduct failed for ${errors.length} item(s)`);
    }
    if (claimAcquired) {
      await supabaseInstance.from('transactions').update({
        metadata: { ...claimMetadata, stock_rededuct_claimed: false, stock_rededuct_pending: false }
      }).eq('id', transactionId);
    }
  } catch (e) {
    if (claimAcquired) {
      await supabaseInstance.from('transactions').update({
        metadata: { ...(claimMetadata || {}), stock_rededuct_claimed: false, stock_rededuct_pending: true }
      }).eq('id', transactionId);
    }
    console.error(`deductTransactionStock error for ${transactionId}:`, e);
    throw e;
  }
}

export async function commitTransactionStock(transactionId) {
  let claimAcquired = false;
  let claimMetadata = null;
  try {
    const { data: tx } = await supabaseInstance.from('transactions').select('id, metadata').eq('id', transactionId).single();
    if (!tx || tx.metadata?.stock_deducted === true) return { success: true, alreadyCommitted: true };
    claimMetadata = { ...(tx.metadata || {}), stock_commit_claimed: true };
    const { data: claimed, error: claimError } = await supabaseInstance.from('transactions').update({ metadata: claimMetadata })
      .eq('id', transactionId)
      .or('and(metadata->>stock_deducted.is.null,metadata->>stock_commit_claimed.is.null),and(metadata->>stock_deducted.is.null,metadata->>stock_commit_claimed.eq.false),and(metadata->>stock_deducted.eq.false,metadata->>stock_commit_claimed.is.null),and(metadata->>stock_deducted.eq.false,metadata->>stock_commit_claimed.eq.false)')
      .select('id');
    if (claimError) throw claimError;
    if (!claimed?.length) return { success: true, alreadyCommitted: true };
    claimAcquired = true;
    const { data: items } = await supabaseInstance.from('transaction_items').select('product_id, quantity, seller_id, metadata').eq('transaction_id', transactionId);
    const physical = (items || []).filter(i => i.product_id && !i.metadata?.is_digital);
    const deducted = {};
    for (const item of physical) {
      const { data: existingSale, error: saleLookupError } = await supabaseInstance
        .from('stock_adjustments')
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('product_id', item.product_id)
        .eq('adjustment_type', 'sale')
        .limit(1);
      if (saleLookupError) throw saleLookupError;
      if (existingSale?.length) {
        deducted[item.product_id] = { quantity: item.quantity, seller_id: item.seller_id };
        continue;
      }
      const result = await atomicAdjustStock(item.product_id, -item.quantity, item.seller_id || null, 'sale', `Stock committed for paid transaction ${transactionId}`, null, transactionId);
      if (!result?.success) throw new Error(result?.error_message || 'Stock commit failed');
      deducted[item.product_id] = { quantity: item.quantity, seller_id: item.seller_id };
    }
    await supabaseInstance.from('transactions').update({ metadata: { ...claimMetadata, stock_deducted: physical.length > 0, stock_commit_claimed: false, stock_restored: false, deducted_products: deducted } }).eq('id', transactionId);
    return { success: true, alreadyCommitted: false };
  } catch (error) {
    if (claimAcquired) {
      await supabaseInstance.from('transactions').update({
        metadata: { ...(claimMetadata || {}), stock_commit_claimed: false }
      }).eq('id', transactionId);
    }
    console.error(`[commitTransactionStock] ${transactionId}:`, error);
    return { success: false, error: error?.message || 'Stock commit failed' };
  }
}

// ── Export atomicAdjustStock untuk digunakan routes lain ──────
export { atomicAdjustStock };

// ── Helper: ambil daftar item yang di-deduct ─────────────────
async function getDeductedItems(tx) {
  // New format: deducted_products stored in metadata
  if (tx.metadata?.deducted_products && Object.keys(tx.metadata.deducted_products).length > 0) {
    return Object.entries(tx.metadata.deducted_products).map(([productId, info]) => ({
      productId, quantity: info.quantity, sellerId: info.seller_id,
    }));
  }
  // Legacy fallback: query transaction_items directly
  const { data: items } = await supabaseInstance
    .from('transaction_items')
    .select('product_id, quantity, seller_id')
    .eq('transaction_id', tx.id);
  if (!items || items.length === 0) return [];
  return items.filter(i => i.product_id).map(i => ({
    productId: i.product_id, quantity: i.quantity, sellerId: i.seller_id,
  }));
}

// ── Low stock notification ────────────────────────────────────
export async function checkLowStockAndNotify(items) {
  try {
    for (const item of items) {
      if (!item.product_id) continue;
      const { data: product } = await supabaseInstance
        .from('products')
        .select('name, stock, seller_id')
        .eq('id', item.product_id)
        .single();
      if (product && product.stock < LOW_STOCK_THRESHOLD && product.seller_id) {
        const { data: seller } = await supabaseInstance
          .from('profiles')
          .select('name, email')
          .eq('id', product.seller_id)
          .single();
        const sellerName = seller?.name || 'Penjual';
        if (sendNotificationFn) {
          await sendNotificationFn(product.seller_id, {
            type: 'system', title: '⚠️ Stok Menipis!',
            message: `Produk "${product.name}" tersisa ${product.stock}. Segera lakukan restock.`,
            path: '/dashboard/seller/products',
          });
        }
        if (sendWANotificationFn) {
          await sendWANotificationFn(product.seller_id, 'low_stock_admin', {
            product_name: product.name, stock: product.stock,
          });
        }
        await supabaseInstance.from('notification_logs').insert({
          user_id: product.seller_id, type: 'low_stock',
          title: `Stok ${product.name} menipis`,
          message: `Tersisa ${product.stock} dari ${LOW_STOCK_THRESHOLD} threshold`,
          metadata: { product_id: item.product_id, stock: product.stock },
        });
      }
    }
  } catch (e) {
    console.error('checkLowStockAndNotify error:', e);
  }
}

// ── Reconciliation job ────────────────────────────────────────
// Bandingkan currentStock vs expectedStock dari adjustment trail
export async function reconcileStock(productIds = null) {
  try {
    let query = supabaseInstance.from('products').select('id, name, stock');
    if (productIds) query = query.in('id', productIds);
    const { data: products } = await query;
    if (!products || products.length === 0) return [];

    const discrepancies = [];
    for (const product of products) {
      const { data: adjustments } = await supabaseInstance
        .from('stock_adjustments')
        .select('new_stock, previous_stock, created_at')
        .eq('product_id', product.id)
        .order('created_at', { ascending: true });

      if (!adjustments || adjustments.length === 0) continue;

      const first = adjustments[0];
      const initialStock = first.previous_stock;

      // expectedStock = initialStock + sum(delta) = initialStock + (last.new_stock - first.previous_stock)
      // Actually: expectedStock = last recorded new_stock
      const last = adjustments[adjustments.length - 1];
      const expectedStock = last.new_stock;
      const gap = Math.abs(product.stock - expectedStock);

      if (gap > 0) {
        discrepancies.push({
          product_id: product.id,
          product_name: product.name,
          current_stock: product.stock,
          expected_stock: expectedStock,
          gap,
        });
      }
    }
    return discrepancies;
  } catch (e) {
    console.error('reconcileStock error:', e);
    return [];
  }
}
