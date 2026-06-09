-- Migration v4.20.0
-- 1. Add 'expired' status to program_coupons
-- 2. Create points_history table for loyalty tracking (FIFO expiry)

-- ==========================================
-- 1. PROGRAM COUPONS: Add 'expired' status
-- ==========================================
do $$
begin
  -- Drop existing check constraint on program_coupons.status
  declare
    constraint_name text;
  begin
    select conname into constraint_name
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'program_coupons'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%';
      
    if constraint_name is not null then
      execute 'alter table public.program_coupons drop constraint ' || constraint_name;
    end if;
  end;
  
  -- Add updated constraint with 'expired' status
  alter table public.program_coupons add constraint program_coupons_status_check 
    check (status in ('active', 'claimed', 'expired'));
end;
$$;

-- ==========================================
-- 2. POINTS HISTORY TABLE (for FIFO expiry)
-- ==========================================
create table if not exists public.points_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  points integer not null check (points != 0),
  type text not null check (type in ('earned', 'spent', 'expired')),
  description text,
  earned_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz
);

-- Index for fast FIFO queries
create index if not exists idx_points_history_user_id on public.points_history(user_id);
create index if not exists idx_points_history_expires_at on public.points_history(expires_at);
create index if not exists idx_points_history_type on public.points_history(type);

-- ==========================================
-- 3. FUNCTION: Calculate available points (FIFO, exclude expired)
-- ==========================================
create or replace function calculate_available_points(p_user_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  total_points integer;
begin
  select coalesce(sum(
    case 
      when type = 'earned' and (expires_at is null or expires_at > now()) then points
      when type = 'spent' then points -- spent is negative, so this subtracts
      else 0
    end
  ), 0) into total_points
  from public.points_history
  where user_id = p_user_id;
  
  return total_points;
end;
$$;

-- ==========================================
-- 4. FUNCTION: Mark expired points
-- ==========================================
create or replace function expire_points()
returns integer
language plpgsql
security definer
as $$
declare
  expired_count integer;
begin
  insert into public.points_history (user_id, points, type, description, earned_at)
  select 
    ph.user_id,
    -ph.remaining_points,
    'expired',
    'Poin expired: ' || to_char(ph.expires_at, 'DD Mon YYYY'),
    now()
  from (
    select 
      user_id, 
      sum(points) as remaining_points,
      max(expires_at) as expires_at
    from public.points_history
    where type = 'earned' and expires_at <= now()
    group by user_id
  ) ph;
  
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;
