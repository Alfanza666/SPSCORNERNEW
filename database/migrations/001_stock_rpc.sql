-- =============================================================
-- Migration 001: Atomic stock operations + traceability
-- =============================================================
-- Cara pakai: Buka Supabase Dashboard → SQL Editor → paste & run
-- =============================================================

-- ── 1. Tambah kolom transaction_id untuk traceability ────────
ALTER TABLE public.stock_adjustments ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_transaction_id ON public.stock_adjustments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON public.stock_adjustments(product_id);

-- ── 2. Fungsi atomic stock adjustment ─────────────────────────
-- Parameter:
--   p_product_id       UUID       — produk
--   p_delta            INTEGER    — + untuk nambah, - untuk kurangi
--   p_user_id          UUID       — admin/seller yg melakukan
--   p_adjustment_type  TEXT       — sale / restock / correction / manual_update
--   p_notes            TEXT       — catatan
--   p_min_stock        INTEGER    — default NULL (tanpa batas bawah)
--   p_transaction_id   UUID       — default NULL, untuk traceability
-- =============================================================

CREATE OR REPLACE FUNCTION public.adjust_stock_rpc(
  p_product_id UUID,
  p_delta INTEGER,
  p_user_id UUID,
  p_adjustment_type TEXT,
  p_notes TEXT,
  p_min_stock INTEGER DEFAULT NULL,
  p_transaction_id UUID DEFAULT NULL
) RETURNS TABLE (success BOOLEAN, new_stock INTEGER, error_message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock INTEGER;
  v_result_stock INTEGER;
BEGIN
  -- SELECT ... FOR UPDATE mengunci ROW sehingga transaksi lain harus antri
  SELECT stock INTO v_current_stock
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  v_result_stock := v_current_stock + p_delta;

  -- Cek minimum stock (misal: tidak boleh negatif untuk deduction)
  IF p_min_stock IS NOT NULL AND v_result_stock < p_min_stock THEN
    success := false;
    new_stock := v_current_stock;
    error_message := 'Stock not sufficient: current ' || v_current_stock::TEXT || 
                     ', needed delta ' || p_delta::TEXT || 
                     ', min allowed ' || p_min_stock::TEXT;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Update stock (operasi atomik karena row sudah di-lock)
  UPDATE public.products SET stock = v_result_stock WHERE id = p_product_id;

  -- Catat adjustment dengan transaction_id (untuk traceability)
  INSERT INTO public.stock_adjustments (product_id, user_id, previous_stock, new_stock, adjustment_type, notes, transaction_id)
  VALUES (p_product_id, p_user_id, v_current_stock, v_result_stock, p_adjustment_type, p_notes, p_transaction_id);

  success := true;
  new_stock := v_result_stock;
  error_message := NULL;
  RETURN NEXT;
END;
$$;
