-- Fix: Add missing increment_stock function (needed by auto-cleanup, cancel, failed payment)
-- Run this SQL in Supabase SQL Editor

create or replace function public.increment_stock(p_id uuid, p_amount integer)
returns void
language plpgsql
security definer
as $$
begin
  update public.products
  set stock = stock + p_amount
  where id = p_id;
end;
$$;
