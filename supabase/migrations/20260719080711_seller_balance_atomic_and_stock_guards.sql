-- Atomic seller balance settlement and bounded stock reservation guards.
-- This migration is intentionally limited to financial/stock invariants.

create table if not exists public.seller_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  balance_delta numeric not null,
  sales_delta numeric not null,
  fee_delta numeric not null,
  created_at timestamptz not null default now(),
  unique (transaction_id, seller_id)
);

alter table public.seller_balance_adjustments enable row level security;
revoke all on public.seller_balance_adjustments from public, anon, authenticated;
grant all on public.seller_balance_adjustments to service_role;

create or replace function public.apply_seller_balance_for_transaction(p_transaction_id uuid)
returns table(success boolean, seller_count integer, balance_delta numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction public.transactions%rowtype;
  v_seller record;
  v_seller_count integer := 0;
  v_balance_delta numeric := 0;
  v_inserted integer := 0;
begin
  if p_transaction_id is null then
    raise exception 'transaction_id is required';
  end if;

  select *
  into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'transaction % not found', p_transaction_id;
  end if;

  if v_transaction.status not in ('paid', 'success') then
    return query select false, 0, 0::numeric;
    return;
  end if;

  if coalesce(v_transaction.metadata->>'balances_updated', 'false') = 'true' then
    return query select false, 0, 0::numeric;
    return;
  end if;

  for v_seller in
    select seller_id,
           coalesce(sum(subtotal), 0)::numeric as balance_delta,
           coalesce(sum(price * quantity), 0)::numeric as sales_delta,
           coalesce(sum((price * quantity) - subtotal), 0)::numeric as fee_delta
    from public.transaction_items
    where transaction_id = p_transaction_id
      and seller_id is not null
    group by seller_id
  loop
    insert into public.seller_balance_adjustments (
      transaction_id, seller_id, balance_delta, sales_delta, fee_delta
    ) values (
      p_transaction_id, v_seller.seller_id, v_seller.balance_delta,
      v_seller.sales_delta, v_seller.fee_delta
    ) on conflict (transaction_id, seller_id) do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted = 1 then
      update public.profiles
      set balance = coalesce(balance, 0) + v_seller.balance_delta,
          total_sales = coalesce(total_sales, 0) + v_seller.sales_delta,
          total_fee_paid = coalesce(total_fee_paid, 0) + v_seller.fee_delta,
          updated_at = now()
      where id = v_seller.seller_id;

      if not found then
        raise exception 'seller profile % not found', v_seller.seller_id;
      end if;
      v_balance_delta := v_balance_delta + v_seller.balance_delta;
    end if;

    v_seller_count := v_seller_count + 1;
  end loop;

  update public.transactions
  set metadata = jsonb_set(
    jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{balances_updated}',
      'true'::jsonb
    ),
    '{balances_settled_at}',
    to_jsonb(now())
  )
  where id = p_transaction_id;

  return query select true, v_seller_count, v_balance_delta;
end;
$$;

revoke all on function public.apply_seller_balance_for_transaction(uuid) from public, anon, authenticated;
grant execute on function public.apply_seller_balance_for_transaction(uuid) to service_role;

create or replace function public.reserve_stock(p_product_id uuid, p_quantity integer, p_expires_in_minutes integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_reserved integer;
  v_reservation_id uuid;
begin
  if p_product_id is null or p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'Invalid reservation quantity';
  end if;
  if p_expires_in_minutes is null or p_expires_in_minutes < 1 or p_expires_in_minutes > 30 then
    raise exception 'Invalid reservation expiry';
  end if;

  select stock into v_stock
  from public.products
  where id = p_product_id and is_active = true
  for update;

  if not found then
    raise exception 'Product not found or inactive';
  end if;

  select coalesce(sum(quantity), 0)::integer into v_reserved
  from public.stock_reservations
  where product_id = p_product_id and expires_at > now();

  if v_stock - v_reserved < p_quantity then
    raise exception 'Insufficient stock for product %', p_product_id;
  end if;

  insert into public.stock_reservations (product_id, quantity, expires_at)
  values (p_product_id, p_quantity, now() + make_interval(mins => p_expires_in_minutes))
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

create or replace function public.release_stock(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reservation_id is null then
    return;
  end if;
  delete from public.stock_reservations where id = p_reservation_id;
end;
$$;

revoke all on function public.reserve_stock(uuid, integer, integer) from public;
revoke all on function public.release_stock(uuid) from public;
grant execute on function public.reserve_stock(uuid, integer, integer) to anon, authenticated, service_role;
grant execute on function public.release_stock(uuid) to anon, authenticated, service_role;

-- Direct clients must never be able to call the stock mutation RPC.
revoke all on function public.adjust_stock_rpc(uuid, integer, uuid, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.adjust_stock_rpc(uuid, integer, uuid, text, text, integer, uuid) to service_role;
