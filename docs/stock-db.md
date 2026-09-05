# Rules — Stock & Database Query

> Muat file ini hanya saat task menyentuh: stok produk, `stock_adjustments`, atau query Supabase langsung.

| ID | Rule | Ref |
|---|---|---|
| DB-001 | Dilarang `.or()` + `metadata->>` di Supabase query (PostgREST crash) → pakai `.not('metadata', 'cs', ...)`. | CAPA-v5.16.2 |
| DB-002 | Read-then-update untuk balance/points dilarang — wajib atomic increment. | AUDIT-v5.16.2 C13 |
| DB-003 | Fallback read-then-write `loyalty_points` wajib pakai guard `.gte()` untuk cegah concurrent overwrite. | CAPA-v5.16.7 §8.5 |
| STK-001 | Dilarang baca `stock_adjustments` tanpa pagination (tabel >16.000 row, limit Supabase 1.000 baris/query). | CAPA-v6.0.7 |
| STK-002 | Update stok wajib berhasil dulu SEBELUM menulis `stock_adjustments`. Jangan pernah log opname sebelum perubahan stok dikonfirmasi. | CAPA-v6.0.7 |
| STK-003 | `reconcileStock()` di `src/services/stock.js` wajib baca `stock_adjustments` per halaman (pagination), bukan hanya di route reporting. | v6.0.13 |
