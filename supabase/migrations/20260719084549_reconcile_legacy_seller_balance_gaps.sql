-- One-time, guarded reconciliation of three legacy aggregate gaps found by
-- comparing settled transaction_items with seller profile aggregates.
create table if not exists public.seller_balance_reconciliations (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  source text not null,
  gross_delta numeric not null,
  net_delta numeric not null,
  fee_delta numeric not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (seller_id, source)
);

alter table public.seller_balance_reconciliations enable row level security;
revoke all on public.seller_balance_reconciliations from public, anon, authenticated;
grant all on public.seller_balance_reconciliations to service_role;

with expected(seller_id, expected_total_sales, expected_balance, expected_fee, gross_delta, net_delta, fee_delta) as (
  values
    ('cc4a7d0a-8020-4549-8e71-04bcbe673d1e'::uuid, 440625::numeric, 409305::numeric, 31320::numeric, 60000::numeric, 60000::numeric, 0::numeric),
    ('0926e43c-bc93-4e6e-b2ee-95583731af84'::uuid, 1399500::numeric, 31740::numeric, 106760::numeric, 1000::numeric, 920::numeric, 80::numeric),
    ('b1b09bca-e7e9-4440-8772-bbb7507b0cde'::uuid, 2116500::numeric, 48920::numeric, 162080::numeric, 1500::numeric, 1380::numeric, 120::numeric)
), inserted as (
  insert into public.seller_balance_reconciliations (seller_id, source, gross_delta, net_delta, fee_delta, reason)
  select e.seller_id, 'legacy-ledger-gap-20260719', e.gross_delta, e.net_delta, e.fee_delta,
         'Guarded correction: settled transaction aggregate exceeded profile aggregate'
  from expected e
  join public.profiles p on p.id=e.seller_id
  where p.total_sales=e.expected_total_sales
    and p.balance=e.expected_balance
    and p.total_fee_paid=e.expected_fee
  on conflict (seller_id, source) do nothing
  returning seller_id, gross_delta, net_delta, fee_delta
)
update public.profiles p
set balance = coalesce(p.balance, 0) + i.net_delta,
    total_sales = coalesce(p.total_sales, 0) + i.gross_delta,
    total_fee_paid = coalesce(p.total_fee_paid, 0) + i.fee_delta,
    updated_at = now()
from inserted i
where p.id=i.seller_id;
