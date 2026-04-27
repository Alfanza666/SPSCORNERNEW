-- =============================================
-- AUTO-CREATE PROFILE ON FIRST SIGN UP / OAUTH
-- =============================================
-- Jalankan SQL ini di Supabase SQL Editor
-- Trigger ini otomatis membuat profil di tabel profiles
-- setiap kali user baru mendaftar (email/password ATAU Google OAuth)
-- =============================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  -- Ambil nama dari OAuth metadata (Google: full_name/name) atau email prefix
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Insert profil baru jika belum ada (idempotent / aman dijalankan berkali-kali)
  insert into public.profiles (id, role, name, balance, is_active)
  values (new.id, 'buyer', v_name, 0, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Pasang trigger pada tabel auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
