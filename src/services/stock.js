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
  try {
    const { data: tx } = await supabaseInstance
      .from('transactions')
      .select('id, metadata')
      .eq('id', transactionId)
      .single();
    if (!tx?.metadata?.stock_deducted) return;
    if (tx?.metadata?.stock_restored) return;

    const items = await getDeductedItems(tx);
    if (items.length === 0) return;

    const results = [];
    for (const { productId, quantity, sellerId } of items) {
      const result = await atomicAdjustStock(
        productId, +quantity, sellerId || null, 'correction',
        `Stock restored — transaction ${transactionId} cancelled/failed`, null, transactionId
      );
      results.push(result);
    }

    await supabaseInstance
      .from('transactions')
      .update({ metadata: { ...(tx.metadata || {}), stock_restored: true } })
      .eq('id', transactionId);

    const failed = results.filter(r => r && !r.success);
    if (failed.length > 0) {
      console.error(`[restoreTransactionStock] ${failed.length} item(s) failed for ${transactionId}:`, failed);
    }
  } catch (e) {
    console.error(`restoreTransactionStock error for ${transactionId}:`, e);
  }
}

// ── Re-deduct stock (iPaymu success after auto-cleanup) ──────
export async function deductTransactionStock(transactionId) {
  const errors = [];
  try {
    const { data: tx } = await supabaseInstance
      .from('transactions')
      .select('id, metadata')
      .eq('id', transactionId)
      .single();
    if (!tx?.metadata?.stock_deducted) return;
    if (!tx?.metadata?.stock_restored) return;

    // Atomic conditional update — hanya proceed jika stock_restored masih true (cegah TOCTOU)
    const newMetadata = { ...(tx.metadata || {}), stock_restored: false };
    const { data: updatedTx, error: updateMetaError } = await supabaseInstance
      .from('transactions')
      .update({ metadata: newMetadata })
      .eq('id', transactionId)
      .filter('metadata->>stock_restored', 'eq', 'true')
      .select('id');
    if (updateMetaError || !updatedTx || updatedTx.length === 0) {
      console.log(`[deductTransactionStock] Skipped ${transactionId}: stock_restored already changed by another process`);
      return;
    }

    const items = await getDeductedItems(tx);
    if (items.length === 0) return;

    for (const { productId, quantity, sellerId } of items) {
      const result = await atomicAdjustStock(
        productId, -quantity, sellerId || null, 'sale',
        `Stock re-deducted — transaction ${transactionId} paid after auto-cleanup`, 0, transactionId
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
    }
  } catch (e) {
    console.error(`deductTransactionStock error for ${transactionId}:`, e);
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
