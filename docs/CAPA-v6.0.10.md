# iPaymu Paid Settlement dan Loyalty Ledger — v6.0.10

## 1. RINGKASAN INSIDEN
| Item | Keterangan |
|------|-----------|
| Insiden | Transaksi QRIS otomatis yang dikonfirmasi paid berhasil memproses stok dan saldo seller, tetapi histori earned points tidak tercatat. |
| Akar masalah | Insert `points_history` memakai kolom `amount`, sedangkan schema production memakai `points`. |
| Dampak | Saldo points berpotensi sudah bertambah tanpa ledger earned yang sesuai; memanggil earn ulang berisiko double-earn. |
| Status | MONITORING setelah repair ledger dan verifikasi ulang. |

## 2. KOREKTIF
| Komponen | Perubahan |
|----------|-----------|
| `src/services/payment.js` | Insert earned points memakai kolom `points`; error histori dilog tanpa menjalankan increment kedua. |
| `scripts/repair-paid-points-ledger.ts` | Menambahkan histori earned yang hilang tanpa menambah saldo profile. Wajib `--apply`. |
| `scripts/verify-pending-ipaymu.ts` | Menghapus jalur notifikasi yang tidak terinisialisasi saat script standalone. |

## 3. VERIFIKASI TRANSAKSI
| Hasil | Jumlah |
|-------|--------|
| iPaymu confirmed paid dan diproses | 16 |
| iPaymu expired/failed | 1 |
| iPaymu masih pending | 3 |
| Settlement flags gagal | 0 |
| Stock ledger missing | 0 |

## 4. RULES BARU
❌ **LARANGAN:** Memanggil `updateBuyerPoints()` ulang untuk transaksi yang sudah pernah diproses hanya karena histori ledger hilang.

✅ **PERINTAH:** Repair histori dilakukan dengan insert `points_history.points` saja setelah memastikan tidak ada baris `earned`; saldo points tidak boleh diincrement ulang.
