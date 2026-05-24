-- Add store_open column to profiles (default true = open for business)
alter table if exists public.profiles
  add column if not exists store_open boolean not null default true;
