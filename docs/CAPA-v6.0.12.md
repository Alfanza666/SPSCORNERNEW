# QRIS Manual AI Verification — v6.0.12

## 1. RINGKASAN INSIDEN
| Item | Keterangan |
|------|-----------|
| Insiden | Bukti QRIS manual tidak konsisten diverifikasi AI dan hasil reject masuk antrean admin. |
| Dampak | Pembeli tidak dapat mengganti bukti dengan jelas; admin menerima pekerjaan yang seharusnya selesai di sisi user. |
| Status | RESOLVED / MONITORING |

## 2. ROOT CAUSE ANALYSIS (RCA)
| Lokasi | Penyebab |
|--------|----------|
| `src/pages/kiosk/Checkout.tsx` | UI QRIS manual menampilkan subtotal + MDR, sedangkan transaksi dan AI memvalidasi subtotal. |
| `src/routes/payments.ts` | Exception setelah endpoint dipanggil sebelumnya diperlakukan sebagai AI error dan diberi notifikasi admin; hasil AI non-JSON juga dipaksa menjadi reject. |
| `src/routes/adminReporting.ts` | Semua pending manual QRIS masuk pusat tindakan admin tanpa membedakan reject AI dan AI outage. |

## 3. KOREKTIF
| File | Perubahan |
|------|-----------|
| `src/pages/kiosk/Checkout.tsx` | Nominal instruksi QRIS manual disamakan dengan nominal transaksi/AI (`remainingTotal`). |
| `src/routes/payments.ts` | Reject AI disimpan sebagai `verification_failed`; hanya error setelah request Griphub benar-benar dimulai dan tanpa hasil yang valid yang diberi `ai_error`. Bukti selalu disimpan. |
| `src/routes/transactions.ts` | Admin approve ditolak untuk bukti yang ditolak AI atau belum mengalami AI outage. |
| `src/routes/adminReporting.ts` | Pusat tindakan admin hanya mengambil pending manual dengan `payment_details.ai_error=true`; histori menyertakan alasan dan detail pembayaran. |

## 4. PENCEGAHAN
| Layer | Komponen | Mekanisme |
|-------|----------|-----------|
| UI | Checkout QRIS manual | Nominal bayar sama dengan nominal transaksi yang dikirim ke verifier. |
| Backend | Manual verify | Memisahkan reject AI, AI error, dan error settlement. |
| Admin | Dashboard dan approve route | Hanya AI outage yang menjadi pekerjaan admin. |

## 5. PENCEGAHAN MASA DEPAN — RULES BARU
❌ LARANGAN: Mengarahkan `verification_failed` ke admin atau mengubahnya menjadi `ai_error`.

✅ PERINTAH: Simpan bukti pada setiap percobaan; reject AI tetap pending agar pembeli dapat upload ulang; admin hanya memproses `ai_error=true`.

## 6. VERIFIKASI & TESTING
| # | Skenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | Nominal QRIS manual dibayar sesuai instruksi | Nominal UI sama dengan nominal transaksi dan AI | PASS |
| 2 | AI menjawab `isValid=false` | Bukti tersimpan, status pending, user dapat upload ulang, tidak ada antrean admin | PASS |
| 3 | AI timeout/error/token habis/tidak terkonfigurasi | Bukti tersimpan, `ai_error=true`, masuk antrean admin | PASS |
| 4 | Respons AI kosong, bukan JSON, atau tanpa boolean `isValid` | Dipandang sebagai AI error, bukan reject user | PASS |
| 5 | Admin mencoba approve reject AI | Ditolak dengan `AI_REJECTED_RECEIPT` | PASS |

## 7. DOKUMEN TERKAIT
| Dokumen | Lokasi |
|---------|--------|
| Changelog | `changelog.txt` |
| Aturan operasional | `AGENTS.md` |
