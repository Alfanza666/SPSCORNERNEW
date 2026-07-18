-- SPS Corner v5.13.0
-- Supporting indexes for canonical transaction history and dashboard reports.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_transactions_status_created_at
  ON public.transactions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
  ON public.transaction_items (transaction_id);

CREATE INDEX IF NOT EXISTS idx_failed_transactions_created_at
  ON public.failed_transactions (created_at DESC);

COMMIT;
