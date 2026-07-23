-- Composite indexes for performance (M13)
-- Run these in Supabase SQL Editor

-- Transactions: buyer lookups + status filtering
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_status ON transactions (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions (status, created_at DESC);

-- Transaction items: seller + product lookups
CREATE INDEX IF NOT EXISTS idx_transaction_items_seller ON transaction_items (seller_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items (product_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_tx_seller ON transaction_items (transaction_id, seller_id);

-- Stock adjustments: product history
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product ON stock_adjustments (product_id, created_at DESC);

-- Points history: user + type lookups
CREATE INDEX IF NOT EXISTS idx_points_history_user ON points_history (user_id, earned_at DESC);

-- Withdrawals: seller + status
CREATE INDEX IF NOT EXISTS idx_withdrawals_seller_status ON withdrawals (seller_id, status);

-- Seller balance adjustments: seller history
CREATE INDEX IF NOT EXISTS idx_seller_balance_adjustments_seller ON seller_balance_adjustments (seller_id, created_at DESC);

-- Program coupons: program + user lookups
CREATE INDEX IF NOT EXISTS idx_program_coupons_program ON program_coupons (program_id, user_id);
