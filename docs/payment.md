# Rules — Payment & Transaksi

> Muat file ini hanya saat task menyentuh: status transaksi, payment gateway (iPaymu), points, refund, atau approval alur pembayaran.

| ID | Rule | Ref |
|---|---|---|
| PAY-001 | Path yang set status `paid`/`success` wajib panggil stock deduction + seller balance settlement — no early return. | CAPA-v5.16.2 §5.2 |
| PAY-002 | `commitTransactionStock()` wajib dipanggil SEBELUM status → `paid`/`success`. Gagal = status tetap `pending`. | CAPA-v6.0.7 §8.2 |
| PAY-003 | Transaksi `paid`/`success` yang gagal potong sebagian item fisik → rollback potongan + turunkan ke `pending`. | CAPA-v6.0.7 |
| PAY-004 | Setiap payment endpoint wajib cek `metadata.remaining_amount` via `getChargeableAmount()` sebelum charge ke gateway. | CAPA-v5.16.7 |
| PAY-005 | Semua cancel path (buyer/admin/iPaymu failed/auto-cleanup) wajib panggil `refundTransactionPoints(transactionId)` setelah stock restore. | CAPA-v5.16.7 |
| PAY-006 | Potong point + update status transaksi wajib atomic atau ada kompensasi rollback. Cek `point_payment_processed` untuk idempotency. | CAPA-v5.16.7 |
| PAY-007 | Ganti metode pembayaran/kembali → wajib cancel transaksi pending dulu. Jangan reuse `transactionId` lintas metode. | CAPA-v6.0.6 |
| PAY-008 | Manual verify & admin approve wajib atomic status lock (`UPDATE WHERE status=...`); rollback ke status asal di catch block. | CAPA-v5.16.7 §8.6 |
| PAY-009 | Admin action yang ubah status lalu proses efek samping (potong stok/refund) wajib klaim status atomic dulu (cegah double-klik/dua tab). | v6.0.13 |
| PAY-010 | Points earned wajib dihitung dari `getChargeableAmount()`, bukan `total_amount`. | CAPA-v5.16.7 §8.7 |
| PAY-011 | `points_history` hanya boleh type: `earned`, `spent`, `expired`, `refund`, `compensation` (DB CHECK constraint). | CAPA-v5.16.7 §8.8 |
| PAY-012 | `points_history` insert HANYA jika RPC/fallback points increment berhasil. | CAPA-v5.16.7 §8.4 |
| PAY-013 | Jika `updateSellerBalances()`/`updateBuyerPoints()` gagal → simpan flag `seller_balance_failed`/`buyer_points_failed` untuk retry auto-reconcile. | CAPA-v5.16.7 §8.3 |
| PAY-014 | Callback tanpa validasi signature → set `unverified_callback: true`. Callback terverifikasi via API lookup wajib dipetakan ke status `paid`. | CAPA-v5.16.7 §8.1, 8.3 |
| PAY-015 | Jangan hapus pembacaan `receivedSignature` (dipakai audit trail). | CAPA-v6.0.5 |
| PAY-016 | Semua request cancel transaksi (frontend) wajib sertakan header `Authorization` jika user login. | v6.0.16 |
| PAY-017 | Bukti pembayaran wajib disimpan ke DB SEBELUM memanggil AI verifikasi (bukan sesudah). | v6.0.15 |
| PAY-018 | Semua jalur upload bukti wajib dikompres (`browser-image-compression`, maxSizeMB:2, maxWidthOrHeight:1920) sebelum dikirim ke AI/base64. | v6.0.13 |
| PAY-019 | `verification_failed` = AI menolak bukti → user wajib bisa upload ulang. Hanya `payment_details.ai_error === true` boleh masuk antrean admin approve. Bukti wajib disimpan di `receipt_image` tiap percobaan. | CAPA-v6.0.12 |
| PAY-020 | ❌ LARANGAN: Dilarang auto-cancel transaksi yang sudah punya bukti (`receipt_image` IS NOT NULL atau `payment_details.receipt_uploaded === true`) — MESKI `verification_failed=true`. Bukti harus selalu tampil di riwayat buyer & seller. Transaksi ber-bukti wajib ditandai `needs_manual_review` dan menunggu Admin, bukan diubah jadi `failed`. Berlaku untuk KEDUA jalur cleanup: `background-jobs.js autoCleanup()` DAN endpoint `/api/admin/transactions/cleanup` di `transactions.ts`. | v6.0.21 |
| PAY-021 | ✅ PERINTAH: Status `processing` WAJIB ada di CHECK constraint `transactions_status_check` pada tabel `transactions`. Kode memakainya sebagai lock idempotency. Jika constraint tidak mengenalnya, setiap verifikasi manual gagal (error 23514) dan bukti tidak tersimpan. Migrasi: `database/migrations/014_fix_transactions_status_check_add_processing.sql`. | v6.0.22 |
| PAY-022 | ✅ PERINTAH: Bukti pembayaran WAJIB disimpan ke DB SEBELUM claim lock idempotency (`status='processing'`), bukan sesudah. Ini safety net agar bukti selalu tersimpan meski lock gagal. | v6.0.22 |
| PAY-023 | 📄 REFERENSI: Transaksi manual `failed` (bukan hanya auto-cancelled) boleh di-upload ulang bukti oleh buyer — AI mencocokkan tanggal nota dengan `created_at` transaksi, sehingga nota lama yang sah tetap VALID. Admin approve juga boleh memproses status `failed` (untuk kasus lama yang buyer-nya tidak bisa upload ulang). | v6.0.22 |

**Fungsi terkait:** lihat `docs/GLOSSARY-fungsi-kritikal.md` untuk `commitTransactionStock()`, `getChargeableAmount()`, `refundTransactionPoints()`, `updateSellerBalances()`, `updateBuyerPoints()`.
