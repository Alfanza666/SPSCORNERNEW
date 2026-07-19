-- One-time, idempotent recovery for failed transactions whose physical stock
-- was deducted but never restored by the expired-payment cleanup.
begin;
select pg_advisory_xact_lock(hashtextextended('sps-failed-stock-reconcile-20260719', 0));

do $$
declare
  tx record;
  item record;
  product_row record;
  audit_user_id uuid;
  missing_product_ids jsonb;
  next_metadata jsonb;
begin
  select p.id into audit_user_id
  from public.profiles p
  where p.role in ('superadmin', 'admin')
  order by case when p.role = 'superadmin' then 0 else 1 end, p.id
  limit 1;
  if audit_user_id is null then
    raise exception 'No admin profile available for stock adjustment audit';
  end if;

  for tx in
    select t.id, t.metadata
    from public.transactions t
    where t.status in ('failed', 'cancelled')
      and coalesce(t.metadata->>'stock_deducted', 'false') = 'true'
      and coalesce(t.metadata->>'stock_restored', 'false') <> 'true'
      and t.metadata->'deducted_products' is not null
      and t.metadata->'deducted_products' <> '{}'::jsonb
      and not exists (
        select 1
        from public.stock_adjustments sa
        where sa.transaction_id = t.id
          and sa.adjustment_type = 'correction'
      )
    order by t.created_at
    for update
  loop
    missing_product_ids := '[]'::jsonb;
    for item in
      select key::uuid as product_id,
             greatest(1, coalesce((value->>'quantity')::integer, 0)) as quantity
      from jsonb_each(tx.metadata->'deducted_products')
    loop
      select p.stock into product_row
      from public.products p
      where p.id = item.product_id
      for update;

      if not found then
        missing_product_ids := missing_product_ids || to_jsonb(item.product_id::text);
        continue;
      end if;

      update public.products
      set stock = coalesce(product_row.stock, 0) + item.quantity
      where id = item.product_id;

      insert into public.stock_adjustments (
        product_id, user_id, previous_stock, new_stock,
        adjustment_type, notes, transaction_id
      ) values (
        item.product_id, audit_user_id, coalesce(product_row.stock, 0),
        coalesce(product_row.stock, 0) + item.quantity,
        'correction',
        format('Stock restored for failed transaction %s (reconciliation 20260719)', tx.id),
        tx.id
      );
    end loop;

    next_metadata := jsonb_set(
      jsonb_set(coalesce(tx.metadata, '{}'::jsonb), '{stock_restored}', 'true'::jsonb),
      '{stock_restore_source}', '"failed-stock-reconciliation-20260719"'::jsonb
    );
    if jsonb_array_length(missing_product_ids) > 0 then
      next_metadata := jsonb_set(next_metadata, '{stock_restore_missing_products}', missing_product_ids);
    end if;
    update public.transactions
    set metadata = next_metadata
    where id = tx.id;
  end loop;
end $$;

-- These requests were caused by the same missing restore and must not create a
-- second stock increase after the correction above.
update public.stock_requests
set status = 'rejected',
    notes = concat_ws(' | ', notes, 'Ditolak otomatis: stok transaksi gagal sudah dipulihkan oleh sistem.'),
    updated_at = now()
where id in (
  '98ee98de-5205-4453-bab5-0d97f497bb98'::uuid,
  '8df9a66b-8ea8-43c8-9054-15644f423831'::uuid,
  'd829adba-2833-4f77-affa-a0b2632e8f45'::uuid
)
and status = 'pending';

commit;
