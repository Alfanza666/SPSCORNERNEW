-- One-time, idempotent reconciliation for the three additional paid iPaymu
-- transactions found by the full settled-ledger vs profile audit.
begin;
select pg_advisory_xact_lock(hashtextextended('sps-seller-balance-reconcile-20260718-followup', 0));

with target(id) as (
  values
    ('6a3e7e77-32a1-4e4a-b45b-4dcd4c838fcc'::uuid),
    ('a844a3a0-d17f-469c-9140-28fe91e2c973'::uuid),
    ('1dfb06db-6d54-45ed-9773-89b7766aec43'::uuid)
),
eligible as (
  select t.id
  from public.transactions t
  join target on target.id = t.id
  where t.status in ('paid', 'success')
    and coalesce(t.metadata->>'balances_updated', 'false') <> 'true'
),
seller_totals as (
  select i.seller_id,
         sum(i.subtotal)::numeric as balance_delta,
         sum(i.price * i.quantity)::numeric as sales_delta,
         sum((i.price * i.quantity) - i.subtotal)::numeric as fee_delta
  from public.transaction_items i
  join eligible e on e.id = i.transaction_id
  where i.seller_id is not null
  group by i.seller_id
)
update public.profiles p
set balance = coalesce(p.balance, 0) + s.balance_delta,
    total_sales = coalesce(p.total_sales, 0) + s.sales_delta,
    total_fee_paid = coalesce(p.total_fee_paid, 0) + s.fee_delta
from seller_totals s
where p.id = s.seller_id;

update public.transactions t
set metadata = jsonb_set(
  jsonb_set(
    jsonb_set(coalesce(t.metadata, '{}'::jsonb), '{balances_updated}', 'true'::jsonb),
    '{balances_reconciled_at}', to_jsonb(now())
  ),
  '{balances_reconciled_source}', '"manual-reconciliation-20260718-followup"'::jsonb
)
where t.id in (
  '6a3e7e77-32a1-4e4a-b45b-4dcd4c838fcc'::uuid,
  'a844a3a0-d17f-469c-9140-28fe91e2c973'::uuid,
  '1dfb06db-6d54-45ed-9773-89b7766aec43'::uuid
)
and t.status in ('paid', 'success')
and coalesce(t.metadata->>'balances_updated', 'false') <> 'true';

commit;
