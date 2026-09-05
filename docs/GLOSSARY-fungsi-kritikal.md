# Glosarium Fungsi Kritikal

Definisi singkat fungsi-fungsi yang sering dirujuk di `docs/rules/*.md`. Rule cukup menyebut nama fungsi tanpa mengulang deskripsi.

| Fungsi | Fungsi Untuk | File (perkiraan) |
|---|---|---|
| `commitTransactionStock()` | Memotong stok fisik untuk sebuah transaksi. Wajib sukses sebelum status → paid/success. | services stock/transaction |
| `getChargeableAmount(transaction)` | Menghitung nominal yang benar-benar harus ditagihkan/dipakai sebagai basis poin, memperhitungkan `metadata.remaining_amount`. | services transaction |
| `refundTransactionPoints(transactionId)` | Mengembalikan poin buyer saat transaksi dibatalkan, dipanggil setelah stock restore. | services points |
| `updateSellerBalances()` | Menyetel saldo seller setelah transaksi settle. | services payment |
| `updateBuyerPoints()` | Menambah/mengurangi poin buyer. | services points |
| `autoReconcileTransactions()` | Background job auto-fix mismatch stok/saldo/poin; tidak boleh dinonaktifkan. | background jobs |
| `reconcileStock()` | Deteksi selisih stok dari `stock_adjustments` (wajib pagination). | `src/services/stock.js` |
| `stripAiWrapper()` | Membersihkan wrapper `<think>...</think>` dan mengekstrak JSON dari respons model AI thinking-mode. | `src/services/griphub.js` |

> Tambahkan entri baru di sini setiap kali sebuah CAPA memperkenalkan fungsi kritikal baru, alih-alih menjelaskan ulang fungsinya di tiap rule.
