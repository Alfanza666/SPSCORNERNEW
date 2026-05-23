-- ============================================================================
-- fix_stock_correction_v2.sql
-- Koreksi stock berdasarkan data TRANSAKSI SUKSES (ground truth)
-- 
-- Rumus:
--   correct_stock = first_known_adjustment + total_restock - total_terjual_sukses
--
-- Catatan: tipe 'correction' di stock_adjustments TIDAK dipakai karena
-- tercampur inflasi dari auto-cleanup bug (restore stock berulang).
-- Yang dipakai hanya 'restock' (real) dan transaction_items (ground truth).
-- ============================================================================

-- ─── 1. Total terjual dari transaksi sukses (ground truth) ────────────────
with actual_sales as (
  select
    ti.product_id,
    sum(ti.quantity)::int as total_sold
  from transaction_items ti
  join transactions t on t.id = ti.transaction_id
  where t.status in ('paid', 'success', 'completed')
    and (ti.metadata->>'is_digital') is distinct from 'true'
    and ti.product_id is not null
  group by ti.product_id
),

-- ─── 2. Total restock real ─────────────────────────────────────────────────
total_restock as (
  select
    product_id,
    sum(new_stock - previous_stock)::int as total_restock
  from stock_adjustments
  where adjustment_type = 'restock'
  group by product_id
),

-- ─── 3. First known stock per produk ───────────────────────────────────────
first_known as (
  select distinct on (product_id)
    product_id,
    previous_stock as first_stock
  from stock_adjustments
  order by product_id, created_at asc
),

-- ─── 4. Hitung koreksi ────────────────────────────────────────────────────
correction as (
  select
    p.id,
    p.name,
    p.stock as current_stock,
    coalesce(fk.first_stock, p.stock) as estimated_initial,
    coalesce(tr.total_restock, 0) as total_restock,
    coalesce(s.total_sold, 0) as total_sold,
    (coalesce(fk.first_stock, p.stock)
      + coalesce(tr.total_restock, 0)
      - coalesce(s.total_sold, 0)
    )::int as correct_stock
  from products p
  left join first_known fk on fk.product_id = p.id
  left join total_restock tr on tr.product_id = p.id
  left join actual_sales s on s.product_id = p.id
)

-- ─── 5. Tampilkan hasil ⚠️ PERIKSA DULU ⚠️ ────────────────────────────────
select
  id,
  name,
  current_stock,
  estimated_initial as stok_awal,
  total_restock,
  total_sold,
  correct_stock,
  (correct_stock - current_stock) as perlu_ditambah
from correction
where current_stock != correct_stock
  and (estimated_initial != current_stock or total_restock > 0 or total_sold > 0)
order by abs(correct_stock - current_stock) desc;

-- ============================================================================
-- HASIL DI ATAS SUDAH SESUAI? Kalau ya, jalankan dari sini:
-- ============================================================================

-- ─── 6. Update stock ───────────────────────────────────────────────────────
with
actual_sales as (
  select
    ti.product_id,
    sum(ti.quantity)::int as total_sold
  from transaction_items ti
  join transactions t on t.id = ti.transaction_id
  where t.status in ('paid', 'success', 'completed')
    and (ti.metadata->>'is_digital') is distinct from 'true'
    and ti.product_id is not null
  group by ti.product_id
),
total_restock as (
  select
    product_id,
    sum(new_stock - previous_stock)::int as total_restock
  from stock_adjustments
  where adjustment_type = 'restock'
  group by product_id
),
first_known as (
  select distinct on (product_id)
    product_id,
    previous_stock as first_stock
  from stock_adjustments
  order by product_id, created_at asc
),
correction as (
  select
    p.id,
    p.stock as current_stock,
    coalesce(fk.first_stock, p.stock) as estimated_initial,
    coalesce(tr.total_restock, 0) as total_restock,
    coalesce(s.total_sold, 0) as total_sold,
    (coalesce(fk.first_stock, p.stock)
      + coalesce(tr.total_restock, 0)
      - coalesce(s.total_sold, 0)
    )::int as correct_stock
  from products p
  left join first_known fk on fk.product_id = p.id
  left join total_restock tr on tr.product_id = p.id
  left join actual_sales s on s.product_id = p.id
)
update products p
set stock = c.correct_stock
from correction c
where p.id = c.id
  and p.stock != c.correct_stock
  and (c.estimated_initial != c.current_stock or c.total_restock > 0 or c.total_sold > 0);

-- ─── 7. Catat ke stock_adjustments ─────────────────────────────────────────
with
actual_sales as (
  select
    ti.product_id,
    sum(ti.quantity)::int as total_sold
  from transaction_items ti
  join transactions t on t.id = ti.transaction_id
  where t.status in ('paid', 'success', 'completed')
    and (ti.metadata->>'is_digital') is distinct from 'true'
    and ti.product_id is not null
  group by ti.product_id
),
total_restock as (
  select
    product_id,
    sum(new_stock - previous_stock)::int as total_restock
  from stock_adjustments
  where adjustment_type = 'restock'
  group by product_id
),
first_known as (
  select distinct on (product_id)
    product_id,
    previous_stock as first_stock
  from stock_adjustments
  order by product_id, created_at asc
),
correction as (
  select
    p.id,
    p.stock as current_stock,
    coalesce(fk.first_stock, p.stock) as estimated_initial,
    coalesce(tr.total_restock, 0) as total_restock,
    coalesce(s.total_sold, 0) as total_sold,
    (coalesce(fk.first_stock, p.stock)
      + coalesce(tr.total_restock, 0)
      - coalesce(s.total_sold, 0)
    )::int as correct_stock
  from products p
  left join first_known fk on fk.product_id = p.id
  left join total_restock tr on tr.product_id = p.id
  left join actual_sales s on s.product_id = p.id
)
insert into stock_adjustments (product_id, user_id, previous_stock, new_stock, adjustment_type, notes)
select
  c.id,
  (select id from profiles where role = 'superadmin' order by created_at asc limit 1),
  c.current_stock,
  c.correct_stock,
  'manual_update',
  'Koreksi v2: hitung ulang dari transaksi sukses + restock'
from correction c
where c.current_stock != c.correct_stock
  and (c.estimated_initial != c.current_stock or c.total_restock > 0 or c.total_sold > 0);
