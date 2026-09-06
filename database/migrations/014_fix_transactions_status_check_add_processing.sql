-- ============================================================================
-- Migrasi 014: Perbaiki transactions_status_check — tambahkan status 'processing'
-- ============================================================================
-- ROOT CAUSE (v6.0.21 RCA):
--   Kode verifikasi manual (payments.ts) memakai status 'processing' sebagai
--   lock idempotency SEBELUM menyimpan bukti pembayaran. Namun CHECK constraint
--   'transactions_status_check' HANYA mengizinkan ('pending','success','failed','paid')
--   — TANPA 'processing'. Akibatnya setiap UPDATE status -> 'processing' DITOLAK
--   database (error 23514), claim lock gagal, handler berhenti SEBELUM bukti
--   tersimpan, sehingga receipt_image NULL dan buyer melihat "Sedang Diverifikasi"
--   palsu. Seller rugi karena transaksi tidak pernah bisa diverifikasi.
--
-- PERBAIKAN (aman, non-destruktif):
--   Hanya MENAMBAHKAN 'processing' ke daftar status yang sah. Tidak mengubah
--   data existing, tidak mengubah kode, tidak membatasi apapun yang sudah berjalan.
--   Ini mengembalikan perilaku yang benar sesuai desain lock idempotency.
--
-- Jalankan di Supabase SQL Editor (atau via psql). Idempotent — aman dijalankan ulang.
-- ============================================================================

do $$
declare
  current_def text;
begin
  -- Baca definisi constraint saat ini untuk logging/verifikasi
  select pg_get_constraintdef(c.oid) into current_def
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  where t.relname = 'transactions' and c.conname = 'transactions_status_check';

  raise log 'Constraint SEBELUM: %', coalesce(current_def, '(tidak ada)');

  -- Drop constraint lama (jika ada), lalu buat ulang dengan 'processing' disertakan.
  alter table public.transactions drop constraint if exists transactions_status_check;
  alter table public.transactions
    add constraint transactions_status_check
    check (status in ('pending','processing','success','failed','paid'));

  raise log 'Constraint SESUDAH: ditambah status ''processing''';
exception when others then
  -- Jangan biarkan migrasi menggagalkan transaksi lain; catat saja.
  raise log 'Error updating transactions_status_check: %', SQLERRM;
end;
$$;

-- Verifikasi cepat: pastikan 'processing' kini diterima.
do $$
declare
  probe_id uuid;
begin
  insert into public.transactions (buyer_name, total_amount, status, payment_method)
  values ('MIGRATION-014 PROBE', 0, 'pending', 'manual_qris')
  returning id into probe_id;

  update public.transactions set status = 'processing' where id = probe_id;

  -- bersihkan probe
  delete from public.transactions where id = probe_id;

  raise notice 'SUKSES: status ''processing'' kini diterima oleh transactions_status_check.';
exception when others then
  raise warning 'GAGAL: status ''processing'' masih ditolak: %', SQLERRM;
end;
$$;
