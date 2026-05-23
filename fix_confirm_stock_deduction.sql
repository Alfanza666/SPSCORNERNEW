-- Fix: confirm_stock_deduction should THROW when reservation not found (silent bypass causes stock inflation)
-- Previously: `if found then ... end if` — silently returned success even if reservation expired
-- After fix: `if not found then raise exception` — forces user to restart from cart

create or replace function public.confirm_stock_deduction(p_reservation_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_product_id uuid;
  v_quantity integer;
  v_seller_id uuid;
  v_old_stock integer;
begin
  -- Get reservation
  select product_id, quantity
  into v_product_id, v_quantity
  from public.stock_reservations
  where id = p_reservation_id;

  -- CRITICAL FIX: Raise error instead of silently returning
  if not found then
    raise exception 'Sesi reservasi telah habis. Silakan mulai dari keranjang.';
  end if;

  -- Get current stock
  select seller_id, stock
  into v_seller_id, v_old_stock
  from public.products
  where id = v_product_id;

  -- Deduct stock
  update public.products
  set stock = stock - v_quantity
  where id = v_product_id;

  -- Log adjustment
  insert into public.stock_adjustments (product_id, user_id, previous_stock, new_stock, adjustment_type, notes)
  values (v_product_id, v_seller_id, v_old_stock, v_old_stock - v_quantity, 'sale', 'Stock deducted from sale');

  -- Clean up reservation
  delete from public.stock_reservations where id = p_reservation_id;
end;
$$;
