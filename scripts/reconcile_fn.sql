CREATE OR REPLACE FUNCTION find_stock_balance_mismatches()
RETURNS TABLE (
  transaction_id UUID,
  buyer_name TEXT,
  total_amount NUMERIC,
  tx_status TEXT,
  tx_created TIMESTAMPTZ,
  stock_deducted BOOLEAN,
  balances_updated BOOLEAN,
  missing_stock_count BIGINT,
  missing_balance_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.buyer_name,
    t.total_amount,
    t.status,
    t.created_at,
    COALESCE((t.metadata->>'stock_deducted')::boolean, false),
    COALESCE((t.metadata->>'balances_updated')::boolean, false),
    (SELECT COUNT(*) FROM transaction_items ti2
      LEFT JOIN stock_adjustments sa ON sa.transaction_id = t.id AND sa.product_id = ti2.product_id AND sa.adjustment_type = 'sale'
      WHERE ti2.transaction_id = t.id AND ti2.product_id IS NOT NULL
        AND (ti2.metadata->>'is_digital' IS DISTINCT FROM 'true') AND sa.id IS NULL
    ),
    (SELECT COUNT(*) FROM transaction_items ti3
      WHERE ti3.transaction_id = t.id AND ti3.seller_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM seller_balance_adjustments sba WHERE sba.transaction_id = t.id AND sba.seller_id = ti3.seller_id)
    )
  FROM transactions t
  WHERE t.status IN ('paid', 'success')
    AND t.created_at > NOW() - INTERVAL '30 days'
    AND (
      COALESCE((t.metadata->>'stock_deducted')::boolean, false) = false
      OR COALESCE((t.metadata->>'balances_updated')::boolean, false) = false
    );
END;
$$;
