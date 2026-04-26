-- Safe, re-runnable Supabase Schema Setup for SPS Corner

-- 0. Ensure uuid_generate_v4 is available
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (Extends Supabase Auth)
create table if not exists public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  role text not null,
  name text not null,
  nik text unique,
  phone text,
  balance numeric not null default 0,
  total_sales numeric not null default 0,
  total_withdrawn numeric not null default 0,
  total_fee_paid numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure the role check constraint is correctly set and unique
do $$
begin
  -- Drop any existing check constraints on the role column to avoid conflicts
  -- We try to find constraints that check the 'role' column
  declare
    constraint_name text;
  begin
    for constraint_name in (
      select conname
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      join pg_namespace n on t.relnamespace = n.oid
      where n.nspname = 'public' 
        and t.relname = 'profiles' 
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%role%'
    ) loop
      execute 'alter table public.profiles drop constraint ' || constraint_name;
    end loop;
  end;

  -- Add the definitive constraint
  alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'seller', 'buyer'));
exception when others then
  raise log 'Error updating profiles_role_check: %', SQLERRM;
end;
$$;

-- Add new columns safely if they don't exist
do $$
begin
  alter table public.profiles add column if not exists nik text unique;
  alter table public.profiles add column if not exists total_sales numeric not null default 0;
  alter table public.profiles add column if not exists total_withdrawn numeric not null default 0;
  alter table public.profiles add column if not exists total_fee_paid numeric not null default 0;
  alter table public.profiles add column if not exists is_active boolean not null default true;
exception when duplicate_column then
  -- nothing
end;
$$;

-- 2. Products Table
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  stock integer not null check (stock >= 0),
  category text not null,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

do $$
begin
  alter table public.products add column if not exists description text;
  alter table public.products add column if not exists is_active boolean not null default true;
exception when duplicate_column then
  -- nothing
end;
$$;

-- 2.5 Stock Reservations Table (For 3-minute locking)
create table if not exists public.stock_reservations (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Stock Reservation Functions
create or replace function public.reserve_stock(p_product_id uuid, p_quantity integer, p_expires_in_minutes integer)
returns uuid language plpgsql security definer as $$
declare
  v_available_stock integer;
  v_reservation_id uuid;
begin
  -- Calculate available stock (total stock - active reservations)
  select p.stock - coalesce((
    select sum(quantity)
    from public.stock_reservations
    where product_id = p_product_id and expires_at > now()
  ), 0) into v_available_stock
  from public.products p
  where p.id = p_product_id;

  if v_available_stock >= p_quantity then
    insert into public.stock_reservations (product_id, quantity, expires_at)
    values (p_product_id, p_quantity, now() + (p_expires_in_minutes || ' minutes')::interval)
    returning id into v_reservation_id;
    
    return v_reservation_id;
  else
    raise exception 'Insufficient stock for product %', p_product_id;
  end if;
end;
$$;

create or replace function public.release_stock(p_reservation_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from public.stock_reservations where id = p_reservation_id;
end;
$$;

create or replace function public.confirm_stock_deduction(p_reservation_id uuid)
returns void language plpgsql security definer as $$
declare
  v_product_id uuid;
  v_quantity integer;
  v_seller_id uuid;
  v_old_stock integer;
begin
  select product_id, quantity into v_product_id, v_quantity
  from public.stock_reservations
  where id = p_reservation_id;

  if found then
    select seller_id, stock into v_seller_id, v_old_stock
    from public.products
    where id = v_product_id;

    update public.products
    set stock = stock - v_quantity
    where id = v_product_id;

    insert into public.stock_adjustments (product_id, user_id, previous_stock, new_stock, adjustment_type, notes)
    values (v_product_id, v_seller_id, v_old_stock, v_old_stock - v_quantity, 'sale', 'Stock deducted from sale');

    delete from public.stock_reservations where id = p_reservation_id;
  end if;
end;
$$;
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  buyer_name text not null,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_phone text,
  total_amount numeric not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending','success','failed','paid')),
  payment_method text,
  payment_details jsonb,
  receipt_image text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure buyer_id, payment_method, payment_details, receipt_image, and metadata exist in transactions
do $$
begin
  alter table public.transactions add column if not exists buyer_id uuid references public.profiles(id) on delete set null;
  alter table public.transactions add column if not exists payment_method text;
  alter table public.transactions add column if not exists payment_details jsonb;
  alter table public.transactions add column if not exists receipt_image text;
  alter table public.transactions add column if not exists metadata jsonb;
exception when duplicate_column then
  -- nothing
end;
$$;

-- Update status check constraint
do $$
begin
  alter table public.transactions drop constraint if exists transactions_status_check;
  alter table public.transactions add constraint transactions_status_check check (status in ('pending','success','failed','paid'));
exception when others then
  raise log 'Error updating transactions_status_check: %', SQLERRM;
end;
$$;

-- 4. Transaction Items Table
create table if not exists public.transaction_items (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  quantity integer not null check (quantity > 0),
  price numeric not null check (price >= 0),
  subtotal numeric not null check (subtotal >= 0),
  metadata jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure metadata exists in transaction_items
do $$
begin
  alter table public.transaction_items add column if not exists metadata jsonb;
exception when duplicate_column then
  -- nothing
end;
$$;

-- 5. Failed Transactions Log
create table if not exists public.failed_transactions (
  id uuid primary key default uuid_generate_v4(),
  buyer_name text not null,
  buyer_id uuid references public.profiles(id) on delete set null,
  attempted_amount numeric not null,
  reason text not null,
  receipt_image text,
  number_of_attempts integer not null default 1,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- 6. Categories Table
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- 7. Password Reset Requests Table
create table if not exists public.password_reset_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  user_nik text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure buyer_id exists in failed_transactions
do $$
begin
  alter table public.failed_transactions add column if not exists buyer_id uuid references public.profiles(id) on delete set null;
  alter table public.failed_transactions add column if not exists number_of_attempts integer not null default 1;
exception when duplicate_column then
  -- nothing
end;
$$;

-- 6. Settings Table
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 7. Withdrawals Table
create table if not exists public.withdrawals (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  fee numeric not null check (fee >= 0),
  net_amount numeric not null check (net_amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  transfer_receipt text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Function to decrement stock safely
create or replace function public.decrement_stock(p_id uuid, p_amount integer)
returns void language plpgsql as $$
begin
  update public.products
  set stock = stock - p_amount
  where id = p_id and stock >= p_amount;

  if not found then
    raise exception 'Insufficient stock for product %', p_id;
  end if;
end;
$$;

-- Trigger to update seller balance ONLY on approved/successful transactions
-- IMPORTANT: This trigger is now DISABLED to prevent phantom profits.
-- Balance and total_sales are updated manually in server.ts at the approve endpoint.
-- This ensures only items from APPROVED transactions contribute to seller stats.
create or replace function public.update_seller_balance()
returns trigger language plpgsql as $$
begin
  -- Only update balance if parent transaction is already 'success'
  -- This prevents phantom profits from pending/failed transactions
  if exists (
    select 1 from public.transactions 
    where id = NEW.transaction_id and status = 'success'
  ) then
    update public.profiles
    set 
      balance = coalesce(balance, 0) + (NEW.subtotal * 0.92),
      total_sales = coalesce(total_sales, 0) + NEW.subtotal,
      total_fee_paid = coalesce(total_fee_paid, 0) + (NEW.subtotal * 0.08)
    where id = NEW.seller_id;
  end if;
  return NEW;
end;
$$;

-- Drop trigger if exists, and WE DO NOT CREATE IT again to prevent double counting
drop trigger if exists on_transaction_item_created on public.transaction_items;
-- create trigger on_transaction_item_created
--   after insert on public.transaction_items
--   for each row
--   execute function public.update_seller_balance();


-- Function to check if a NIK exists (bypasses RLS)
create or replace function public.check_nik_exists(p_nik text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where nik = p_nik
  );
$$;

-- AUTOMATIC PROFILE CREATION TRIGGER
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first_user boolean;
  user_name text;
  user_role text;
  user_nik text;
  user_phone text;
begin
  -- Check if this is the very first user in the profiles table
  select not exists(select 1 from public.profiles limit 1) into is_first_user;

  -- derive a name from raw_user_meta_data if present, else from email, else default
  user_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'User'
  );
  
  -- derive role from metadata, default to 'seller' or 'buyer'
  -- Ensure it is lowercase and trimmed
  user_role := lower(trim(coalesce(
    nullif(new.raw_user_meta_data ->> 'role', ''),
    case when is_first_user then 'admin' else 'buyer' end
  )));

  -- Ensure role is strictly one of the allowed values
  if user_role not in ('admin', 'seller', 'buyer') then
    user_role := 'buyer';
  end if;

  user_nik := nullif(trim(new.raw_user_meta_data ->> 'nik'), '');
  user_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');

  insert into public.profiles (id, role, name, nik, phone)
  values (
    new.id,
    user_role,
    user_name,
    user_nik,
    user_phone
  )
  on conflict (id) do update 
  set 
    role = excluded.role,
    name = excluded.name,
    nik = excluded.nik,
    phone = excluded.phone;

  return new;
exception
  when others then
    -- Log the error but allow the user creation to proceed if possible, 
    -- or at least provide a clear error in the postgres logs.
    raise log 'Error in handle_new_user trigger: %', SQLERRM;
    raise;
end;
$$;

-- Drop existing trigger on auth.users if any, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- Function to delete a user completely (Admin only)
create or replace function public.delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Delete from auth.users (this will cascade to public.profiles and other tables)
  delete from auth.users where id = p_user_id;
end;
$$;
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 8. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('transaction', 'withdrawal', 'system')),
  title text not null,
  message text not null,
  path text,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Enable RLS safely (no-op if already enabled)
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.failed_transactions enable row level security;
alter table public.settings enable row level security;
alter table public.withdrawals enable row level security;
alter table public.notifications enable row level security;

-- POLICIES
-- Profiles: Users can read all profiles, but only update their own
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_delete on public.profiles;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_public') then
    create policy profiles_select_public on public.profiles for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own') then
    create policy profiles_insert_own on public.profiles for insert with check ((select auth.uid()) = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    create policy profiles_update_own on public.profiles for update using ((select auth.uid()) = id);
  end if;
  
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_update') then
    create policy profiles_admin_update on public.profiles for update using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_delete') then
    create policy profiles_admin_delete on public.profiles for delete using (public.is_admin());
  end if;
end;
$$;

-- Products policies
drop policy if exists products_admin_all on public.products;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_select_public') then
    create policy products_select_public on public.products for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_insert_own') then
    create policy products_insert_own on public.products for insert with check ((select auth.uid()) = seller_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_update_own') then
    create policy products_update_own on public.products for update using ((select auth.uid()) = seller_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_delete_own') then
    create policy products_delete_own on public.products for delete using ((select auth.uid()) = seller_id);
  end if;
  
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_admin_all') then
    create policy products_admin_all on public.products for all using (public.is_admin());
  end if;
end;
$$;

-- Stock Reservations policies
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_reservations' and policyname='stock_reservations_public_all') then
    create policy stock_reservations_public_all on public.stock_reservations for all using (true);
  end if;
end;
$$;

-- Settings policies
drop policy if exists settings_admin_update on public.settings;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='settings' and policyname='settings_select_public') then
    create policy settings_select_public on public.settings for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='settings' and policyname='settings_admin_update') then
    create policy settings_admin_update on public.settings for all using (public.is_admin());
  end if;
end;
$$;

-- Transactions policies
drop policy if exists transactions_admin_select on public.transactions;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='transactions_insert_public') then
    create policy transactions_insert_public on public.transactions for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='transactions_admin_select') then
    create policy transactions_admin_select on public.transactions for select using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='transactions_select_buyer') then
    create policy transactions_select_buyer on public.transactions for select using (auth.uid() = buyer_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='transactions_update_public') then
    create policy transactions_update_public on public.transactions for update using (true);
  end if;
end;
$$;

-- Transaction items policies
drop policy if exists transaction_items_select_seller_admin on public.transaction_items;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transaction_items' and policyname='transaction_items_insert_public') then
    create policy transaction_items_insert_public on public.transaction_items for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='transaction_items' and policyname='transaction_items_select_seller_admin') then
    create policy transaction_items_select_seller_admin on public.transaction_items for select using (
      (select auth.uid()) = seller_id or public.is_admin() or 
      exists (select 1 from public.transactions t where t.id = transaction_id and t.buyer_id = auth.uid())
    );
  end if;
end;
$$;

-- Failed transactions policies
drop policy if exists failed_tx_admin_select on public.failed_transactions;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='failed_transactions' and policyname='failed_tx_insert_public') then
    create policy failed_tx_insert_public on public.failed_transactions for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='failed_transactions' and policyname='failed_tx_admin_select') then
    create policy failed_tx_admin_select on public.failed_transactions for select using (public.is_admin());
  end if;
end;
$$;

-- Withdrawals policies
drop policy if exists withdrawals_admin_all on public.withdrawals;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='withdrawals' and policyname='withdrawals_seller_select') then
    create policy withdrawals_seller_select on public.withdrawals for select using ((select auth.uid()) = seller_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='withdrawals' and policyname='withdrawals_seller_insert') then
    create policy withdrawals_seller_insert on public.withdrawals for insert with check ((select auth.uid()) = seller_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='withdrawals' and policyname='withdrawals_admin_all') then
    create policy withdrawals_admin_all on public.withdrawals for all using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_select_own') then
    create policy notifications_select_own on public.notifications for select using ((select auth.uid()) = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_update_own') then
    create policy notifications_update_own on public.notifications for update using ((select auth.uid()) = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_insert_all') then
    create policy notifications_insert_all on public.notifications for insert with check (true);
  end if;
end;
$$;

-- Helpful indexes for policy performance
create index if not exists idx_profiles_id on public.profiles(id);
create index if not exists idx_products_seller_id on public.products(seller_id);
create index if not exists idx_withdrawals_seller_id on public.withdrawals(seller_id);
create index if not exists idx_transaction_items_seller_id on public.transaction_items(seller_id);
create index if not exists idx_stock_reservations_product_id on public.stock_reservations(product_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_stock_reservations_expires_at on public.stock_reservations(expires_at);

-- Notification Triggers

-- 1. Transaction Status Updates
create or replace function public.handle_transaction_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  v_admin_id uuid;
  v_seller_record record;
begin
  -- Only trigger on status change
  if (tg_op = 'UPDATE' and old.status = new.status) then
    return new;
  end if;

  -- Get an admin user (just pick the first one for simplicity, or notify all admins)
  -- For now, we'll notify all admins
  if new.status in ('paid', 'completed', 'cancelled') then
    for v_admin_id in (select id from public.profiles where role = 'admin') loop
      insert into public.notifications (user_id, type, title, message, path)
      values (
        v_admin_id,
        'transaction',
        case new.status
          when 'paid' then 'Pesanan Perlu Diproses'
          when 'completed' then 'Pesanan Selesai'
          when 'cancelled' then 'Pesanan Dibatalkan'
        end,
        case new.status
          when 'paid' then 'Pembayaran dari ' || coalesce(new.buyer_name, 'Pelanggan') || ' telah diterima.'
          when 'completed' then 'Pesanan dari ' || coalesce(new.buyer_name, 'Pelanggan') || ' telah selesai.'
          when 'cancelled' then 'Pesanan dari ' || coalesce(new.buyer_name, 'Pelanggan') || ' telah dibatalkan.'
        end,
        '/dashboard/admin/transactions?id=' || new.id
      );
    end loop;

    -- Also notify sellers involved in this transaction
    for v_seller_record in (select distinct seller_id from public.transaction_items where transaction_id = new.id and seller_id is not null) loop
      insert into public.notifications (user_id, type, title, message, path)
      values (
        v_seller_record.seller_id,
        'transaction',
        case new.status
          when 'paid' then 'Pesanan Baru'
          when 'completed' then 'Pesanan Selesai'
          when 'cancelled' then 'Pesanan Dibatalkan'
        end,
        case new.status
          when 'paid' then 'Ada pesanan baru dari ' || coalesce(new.buyer_name, 'Pelanggan') || ' yang mengandung produk Anda.'
          when 'completed' then 'Pesanan dari ' || coalesce(new.buyer_name, 'Pelanggan') || ' telah selesai.'
          when 'cancelled' then 'Pesanan dari ' || coalesce(new.buyer_name, 'Pelanggan') || ' telah dibatalkan.'
        end,
        '/dashboard/seller/transactions?id=' || new.id
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists on_transaction_status_change on public.transactions;
create trigger on_transaction_status_change
  after insert or update on public.transactions
  for each row execute function public.handle_transaction_notification();

-- 2. Withdrawal Updates
create or replace function public.handle_withdrawal_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  v_admin_id uuid;
  v_seller_name text;
begin
  -- If new withdrawal (pending)
  if (tg_op = 'INSERT' and new.status = 'pending') then
    select name into v_seller_name from public.profiles where id = new.seller_id;
    
    -- Notify admins
    for v_admin_id in (select id from public.profiles where role = 'admin') loop
      insert into public.notifications (user_id, type, title, message, path)
      values (
        v_admin_id,
        'withdrawal',
        'Permintaan Penarikan',
        'Penjual ' || coalesce(v_seller_name, 'Unknown') || ' mengajukan penarikan saldo.',
        '/dashboard/admin/withdrawals'
      );
    end loop;
  end if;

  -- If withdrawal status changed (approved/rejected)
  if (tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected', 'paid')) then
    -- Notify the seller
    insert into public.notifications (user_id, type, title, message, path)
    values (
      new.seller_id,
      'withdrawal',
      case new.status
        when 'rejected' then 'Penarikan Ditolak'
        else 'Penarikan Disetujui'
      end,
      'Penarikan saldo sebesar Rp ' || new.amount || ' telah ' || case new.status when 'rejected' then 'ditolak' else 'disetujui/dibayar' end || '.',
      '/dashboard/seller/withdrawals'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_withdrawal_status_change on public.withdrawals;
create trigger on_withdrawal_status_change
  after insert or update on public.withdrawals
  for each row execute function public.handle_withdrawal_notification();

-- Create Storage Bucket for Products
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- Storage Policies for Products Bucket
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Public Access') then
    create policy "Public Access" on storage.objects for select using ( bucket_id = 'products' );
  end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated users can upload') then
    create policy "Authenticated users can upload" on storage.objects for insert with check ( bucket_id = 'products' and auth.role() = 'authenticated' );
  end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Users can update their own uploads') then
    create policy "Users can update their own uploads" on storage.objects for update using ( bucket_id = 'products' and auth.uid() = owner );
  end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Users can delete their own uploads') then
    create policy "Users can delete their own uploads" on storage.objects for delete using ( bucket_id = 'products' and auth.uid() = owner );
  end if;
end;
$$;

create table if not exists public.stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  previous_stock integer not null,
  new_stock integer not null,
  adjustment_type text not null check (adjustment_type in ('manual_update', 'restock', 'correction', 'sale')),
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.stock_adjustments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_adjustments' and policyname='stock_adjustments_select_admin') then
    create policy stock_adjustments_select_admin on public.stock_adjustments for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_adjustments' and policyname='stock_adjustments_select_seller') then
    create policy stock_adjustments_select_seller on public.stock_adjustments for select using (
      exists (select 1 from public.products where id = stock_adjustments.product_id and seller_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_adjustments' and policyname='stock_adjustments_insert') then
    create policy stock_adjustments_insert on public.stock_adjustments for insert with check (
      public.is_admin() or 
      exists (select 1 from public.products where id = product_id and seller_id = auth.uid())
    );
  end if;
end
$$;

-- Stock Requests
create table if not exists public.stock_requests (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  requested_quantity integer not null check (requested_quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.stock_requests enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_requests' and policyname='stock_requests_select_admin') then
    create policy stock_requests_select_admin on public.stock_requests for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_requests' and policyname='stock_requests_select_seller') then
    create policy stock_requests_select_seller on public.stock_requests for select using (seller_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_requests' and policyname='stock_requests_insert_seller') then
    create policy stock_requests_insert_seller on public.stock_requests for insert with check (seller_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stock_requests' and policyname='stock_requests_update_admin') then
    create policy stock_requests_update_admin on public.stock_requests for update using (public.is_admin());
  end if;
end
$$;

-- Returns (Retur)
create table if not exists public.product_returns (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  initiated_by uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.product_returns enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_returns' and policyname='product_returns_select_admin') then
    create policy product_returns_select_admin on public.product_returns for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_returns' and policyname='product_returns_select_seller') then
    create policy product_returns_select_seller on public.product_returns for select using (seller_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_returns' and policyname='product_returns_insert') then
    create policy product_returns_insert on public.product_returns for insert with check (
      public.is_admin() or seller_id = auth.uid()
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_returns' and policyname='product_returns_update_admin') then
    create policy product_returns_update_admin on public.product_returns for update using (public.is_admin());
  end if;
end
$$;

-- Stock Opname System for Unmanned Kiosk
create table if not exists public.stock_opnames (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now(),
  notes text,
  status text default 'completed'
);

create table if not exists public.stock_opname_items (
  id uuid primary key default uuid_generate_v4(),
  opname_id uuid references public.stock_opnames(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  system_stock integer not null,
  physical_stock integer not null,
  variance integer not null,
  created_at timestamp with time zone default now()
);

-- Standby Schedule for Restocking
create table if not exists public.standby_schedules (
  id uuid primary key default uuid_generate_v4(),
  day_of_week integer not null, -- 0 (Sunday) to 6 (Saturday)
  start_time time not null,
  end_time time not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.stock_opnames enable row level security;
alter table public.stock_opname_items enable row level security;
alter table public.standby_schedules enable row level security;

-- Policies (Safe/Idempotent)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS stock_opnames_admin ON public.stock_opnames;
    CREATE POLICY stock_opnames_admin ON public.stock_opnames FOR ALL USING (public.is_admin());

    DROP POLICY IF EXISTS stock_opname_items_admin ON public.stock_opname_items;
    CREATE POLICY stock_opname_items_admin ON public.stock_opname_items FOR ALL USING (public.is_admin());

    DROP POLICY IF EXISTS standby_schedules_admin ON public.standby_schedules;
    CREATE POLICY standby_schedules_admin ON public.standby_schedules FOR ALL USING (public.is_admin());

    DROP POLICY IF EXISTS standby_schedules_select ON public.standby_schedules;
    CREATE POLICY standby_schedules_select ON public.standby_schedules FOR SELECT USING (true);
END $$;
