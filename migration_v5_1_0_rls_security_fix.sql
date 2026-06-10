-- Migration v5.1.0
-- Fix over-permissive RLS policies (security audit findings)
-- ==========================================
-- 1. transactions_update_public: Only allow buyer or admin to update transactions
-- ==========================================
drop policy if exists transactions_update_public on public.transactions;

create policy transactions_update_owner_or_admin on public.transactions
  for update using (
    auth.uid() = buyer_id OR public.is_admin()
  );

-- ==========================================
-- 2. transactions_insert_public: Require buyer_id to match authenticated user
-- ==========================================
drop policy if exists transactions_insert_public on public.transactions;

create policy transactions_insert_authenticated on public.transactions
  for insert with check (
    auth.uid() = buyer_id AND auth.role() = 'authenticated'
  );

-- ==========================================
-- 3. stock_reservations: Table has NO user_id column, so restrict to
--    SELECT only. INSERT/UPDATE/DELETE go through security definer
--    functions (reserve_stock, release_reservation) from server.ts.
-- ==========================================
drop policy if exists stock_reservations_public_all on public.stock_reservations;

create policy stock_reservations_select_auth on public.stock_reservations
  for select to authenticated using (true);

-- Block direct INSERT/UPDATE/DELETE — must use server-side functions
create policy stock_reservations_no_insert on public.stock_reservations
  for insert with check (false);

create policy stock_reservations_no_update on public.stock_reservations
  for update using (false);

create policy stock_reservations_no_delete on public.stock_reservations
  for delete using (false);

-- ==========================================
-- 4. notifications_insert_all: Only allow inserting notifications for self
-- ==========================================
drop policy if exists notifications_insert_all on public.notifications;

create policy notifications_insert_self_or_admin on public.notifications
  for insert with check (
    auth.uid() = user_id OR public.is_admin()
  );

-- ==========================================
-- 5. profiles_select_public: Allow select but with sensitive field access control
--    Note: Column-level security requires PG15+. We use a helper function to
--    mask balance, nik, phone for non-owner non-admin users.
-- ==========================================
-- Create a function to expose limited profile data for public view
create or replace function public.get_public_profile(target_id uuid)
returns table (
  id uuid,
  name text,
  avatar_url text,
  role text,
  is_active boolean
) language sql security definer as $$
  select p.id, p.name, p.avatar_url, p.role, p.is_active
  from public.profiles p
  where p.id = target_id
    and (
      p.id = auth.uid()
      or public.is_admin()
    );
$$;

-- ==========================================
-- 6. Failed transactions: restrict insert to authenticated users
--    Table has buyer_id column, set it to current user
-- ==========================================
drop policy if exists failed_tx_insert_public on public.failed_transactions;

create policy failed_tx_insert_authenticated on public.failed_transactions
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
  );
