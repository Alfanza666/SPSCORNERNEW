-- One-time server attestations for AI-validated payment receipts.
-- This table is intentionally inaccessible to browser roles. Only the backend
-- service-role client may issue and atomically consume an attestation.

create table if not exists public.receipt_validation_tokens (
  jti uuid primary key,
  amount bigint not null check (amount > 0),
  image_hash text not null check (length(image_hash) = 64),
  cart_digest text not null check (length(cart_digest) = 64),
  buyer_subject text not null check (length(buyer_subject) between 1 and 128),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint receipt_validation_tokens_expiry_check check (expires_at > issued_at)
);

alter table public.receipt_validation_tokens enable row level security;

revoke all on table public.receipt_validation_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.receipt_validation_tokens to service_role;

create index if not exists idx_receipt_validation_tokens_unconsumed_expiry
  on public.receipt_validation_tokens (expires_at)
  where consumed_at is null;

create or replace function public.consume_receipt_validation_token(
  p_jti uuid,
  p_amount bigint,
  p_image_hash text,
  p_cart_digest text,
  p_buyer_subject text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  with claimed as (
    update public.receipt_validation_tokens
       set consumed_at = now()
     where jti = p_jti
       and amount = p_amount
       and image_hash = p_image_hash
       and cart_digest = p_cart_digest
       and buyer_subject = p_buyer_subject
       and issued_at = p_issued_at
       and expires_at = p_expires_at
       and expires_at > now()
       and consumed_at is null
    returning jti
  )
  select exists(select 1 from claimed);
$$;

revoke all on function public.consume_receipt_validation_token(
  uuid, bigint, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.consume_receipt_validation_token(
  uuid, bigint, text, text, text, timestamptz, timestamptz
) to service_role;
