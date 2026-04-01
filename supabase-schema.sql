-- Safe, re-runnable Supabase Schema Setup for SPS Corner

-- 0. Ensure uuid_generate_v4 is available
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (Extends Supabase Auth)
create table if not exists public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  role text not null,
  name text not null,
  nik text unique,
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
begin
  select product_id, quantity into v_product_id, v_quantity
  from public.stock_reservations
  where id = p_reservation_id;

  if found then
    update public.products
    set stock = stock - v_quantity
    where id = v_product_id;
    
    delete from public.stock_reservations where id = p_reservation_id;
  end if;
end;
$$;
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  buyer_name text not null,
  buyer_id uuid references public.profiles(id) on delete set null,
  total_amount numeric not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending','success','failed','paid')),
  payment_method text,
  receipt_image text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure buyer_id and payment_method exist in transactions
do $$
begin
  alter table public.transactions add column if not exists buyer_id uuid references public.profiles(id) on delete set null;
  alter table public.transactions add column if not exists payment_method text;
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

-- Trigger to update seller balance on successful transaction item insert
create or replace function public.update_seller_balance()
returns trigger language plpgsql as $$
begin
  update public.profiles
  set 
    balance = coalesce(balance,0) + NEW.subtotal,
    total_sales = coalesce(total_sales,0) + NEW.subtotal
  where id = NEW.seller_id;
  return NEW;
end;
$$;

-- Drop trigger if exists, then create (idempotent)
drop trigger if exists on_transaction_item_created on public.transaction_items;
create trigger on_transaction_item_created
  after insert on public.transaction_items
  for each row
  execute function public.update_seller_balance();

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

  insert into public.profiles (id, role, name, nik)
  values (
    new.id,
    user_role,
    user_name,
    user_nik
  )
  on conflict (id) do update 
  set 
    role = excluded.role,
    name = excluded.name,
    nik = excluded.nik;

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

-- Enable RLS safely (no-op if already enabled)
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.failed_transactions enable row level security;
alter table public.settings enable row level security;
alter table public.withdrawals enable row level security;

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
end;
$$;

-- Helpful indexes for policy performance
create index if not exists idx_profiles_id on public.profiles(id);
create index if not exists idx_products_seller_id on public.products(seller_id);
create index if not exists idx_withdrawals_seller_id on public.withdrawals(seller_id);
create index if not exists idx_transaction_items_seller_id on public.transaction_items(seller_id);
create index if not exists idx_stock_reservations_product_id on public.stock_reservations(product_id);
create index if not exists idx_stock_reservations_expires_at on public.stock_reservations(expires_at);

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

