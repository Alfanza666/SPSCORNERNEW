-- fix_lost_stock.sql
-- RECOVERY: Kembalikan stock untuk transaksi yang stock-nya terpotong tapi tidak pernah di-restore
-- Penyebab: auto-cleanup dulu pakai .is("receipt_image", null) → transaksi dengan receipt skip cleanup
-- Cara pakai: jalankan di Supabase SQL Editor (satu kali saja)

-- =============================================================
-- LANGKAH 1: Cek daftar transaksi bermasalah
-- =============================================================
-- Transaksi status pending/failed/cancelled yang stock_deducted = true
-- TAPI stock_restored tidak true (null atau false)
SELECT 
  t.id,
  t.status,
  t.created_at,
  t.metadata->>'stock_deducted' AS stock_deducted,
  t.metadata->>'stock_restored' AS stock_restored,
  t.metadata->>'cancel_reason' AS cancel_reason,
  (t.metadata->>'deducted_products')::text AS deducted_products
FROM transactions t
WHERE 
  t.status IN ('pending', 'failed', 'cancelled')
  AND (t.metadata->>'stock_deducted')::text = 'true'
  AND ((t.metadata->>'stock_restored') IS NULL OR (t.metadata->>'stock_restored')::text = 'false')
  AND t.created_at < NOW() - INTERVAL '1 hour'
ORDER BY t.created_at DESC;

-- =============================================================
-- LANGKAH 2: Restore stock untuk satu transaksi tertentu
-- =============================================================
-- Ganti 'TRANSACTION_ID_HERE' dengan ID dari hasil query LANGKAH 1
-- Jalankan satu per satu untuk setiap transaksi bermasalah

-- Cara 1: Pakai RPC (rekomendasi)
-- SELECT restore_transaction_stock('TRANSACTION_ID_HERE');

-- Cara 2: Manual (jika RPC tidak tersedia)
-- Cari item yang di-deduct:
-- WITH tx_data AS (
--   SELECT id, metadata FROM transactions WHERE id = 'TRANSACTION_ID_HERE'
-- ),
-- deducted AS (
--   SELECT 
--     (jsonb_each.text->>'quantity')::int AS qty,
--     (jsonb_each.text->>'seller_id')::uuid AS seller_id,
--     jsonb_each.key AS product_id
--   FROM tx_data, jsonb_each(tx_data.metadata->'deducted_products')
-- )
-- UPDATE products p
-- SET stock = stock + d.qty
-- FROM deducted d
-- WHERE p.id = d.product_id::uuid
-- RETURNING p.id, p.name, p.stock;

-- =============================================================
-- LANGKAH 3: Tandai transaksi sudah di-restore (setelah verifikasi)
-- =============================================================
-- UPDATE transactions
-- SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{stock_restored}', 'true')
-- WHERE id = 'TRANSACTION_ID_HERE';
