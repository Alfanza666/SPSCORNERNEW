-- One-time, idempotent reconciliation for the three paid iPaymu transactions
-- that were reported paid without seller balance credit.
begin;
select pg_advisory_xact_lock(hashtextextended('sps-seller-balance-reconcile-20260718', 0));

with target(id) as (
  values
    ('e1b98db9-b431-4b79-ba71-5fd7455f1937'::uuid),
    ('78619cbb-af75-4f0f-9526-7272e3764603'::uuid),
    ('ea448b86-2bd7-4935-bfe0-ca2ea27bbc27'::uuid)
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
  '{balances_reconciled_source}', '"manual-reconciliation-20260718"'::jsonb
)
where t.id in (
  'e1b98db9-b431-4b79-ba71-5fd7455f1937'::uuid,
  '78619cbb-af75-4f0f-9526-7272e3764603'::uuid,
  'ea448b86-2bd7-4935-bfe0-ca2ea27bbc27'::uuid
)
and t.status in ('paid', 'success')
and coalesce(t.metadata->>'balances_updated', 'false') <> 'true';

commit;
