# Migrasi Griphub dan Penghematan Token — v6.0.9

## 1. RINGKASAN
| Item | Keterangan |
|------|-----------|
| Insiden | Integrasi AI aktif masih menggunakan provider lama, sementara konfigurasi lokal sudah memakai Griphub Router. |
| Dampak | Key/model baru belum digunakan production dan pemakaian token belum memiliki batas output terpusat. |
| Status | MONITORING setelah deploy dan smoke test Griphub. |

## 2. KOREKTIF
| Komponen | Perubahan |
|----------|-----------|
| AI client | `src/services/griphub.js` memakai endpoint OpenAI-compatible `/chat/completions`. |
| Provider | Route pembayaran, workflow program, Form Builder, dan Moments memakai `griphub`. |
| Environment | Production memakai `GRIPHUB_API_KEY`, `GRIPHUB_BASE_URL`, `GRIPHUB_MODEL`, `GRIPHUB_VISION_MODEL`. |
| Dependency | SDK provider lama dihapus dari `package.json` dan lockfile. |

## 3. TOKEN COST GUARD
| Jalur | Batas output |
|-------|-------------|
| Receipt vision | 256 token |
| Program receipt vision | 256 token |
| Moments prompt | 256 token |
| Form Builder | 1.536 token |
| Client global | Maksimal 1.536 token per request |
| Form context | Snapshot ringkas maksimal 12.000 karakter |

Rumus biaya yang digunakan:

```text
(Total Token / 1.000.000) x 0,3 kredit
```

Pemakaian dashboard `14.803.836` token setara sekitar `4,4411508` kredit.

## 4. RULES BARU
❌ **LARANGAN:** Mengirim API key ke frontend atau menaikkan `max_tokens` tanpa alasan fitur yang jelas.

✅ **PERINTAH:** Jalur vision wajib memakai output JSON ringkas dan fallback manual jika AI gagal; Form Builder wajib mengirim context yang sudah dipadatkan.

## 5. VERIFIKASI
| Skenario | Expected |
|----------|----------|
| `npm run lint` | Lulus |
| Test AI route | Lulus |
| Health API | `runtime=vps` |
| Startup log | Griphub configured tanpa secret |
| `.env` VPS | Mode `600`, key tidak dicetak |
