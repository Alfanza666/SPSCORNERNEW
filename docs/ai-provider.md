# Rules — AI Provider (Griphub / Groq)

> Muat file ini hanya saat task menyentuh: integrasi AI verifikasi bukti pembayaran, `src/services/griphub.js`, atau fallback provider AI.

| ID | Rule | Ref |
|---|---|---|
| AI-001 | `stripAiWrapper()` di `src/services/griphub.js` wajib menangani tag `<think>...</think>` lengkap maupun terpotong (token habis), serta mengekstrak objek JSON `{...}`. | v6.0.20 |
| AI-002 | Griphub Router (`gpt-5.6-luna`) = provider AI UTAMA (stabil 2–4s, native vision, JSON konsisten). Groq = cadangan otomatis jika Griphub gagal/timeout. | v6.0.20 |
| AI-003 | Dilarang kirim `response_format: { type: "json_object" }` ke model yang tidak dukung strict mode (mis. qwen di Groq). Andalkan prompt + parsing JSON toleran terhadap markdown fence. | v6.0.18 |
| AI-004 | Saat fallback lintas provider, model wajib disesuaikan mapping provider tujuan (`GRIPHUB_VISION_MODEL`/`GRIPHUB_MODEL` vs `GROQ_VISION_MODEL`/`GROQ_MODEL`). Dilarang teruskan model antar provider tanpa mapping. | v6.0.18 |
| AI-005 | ✅ PERINTAH: Untuk semua parse respons verifikasi AI, WAJIB pakai `parseAiJsonResponse(aiResponse)` (bukan `JSON.parse(stripAiWrapper(content))` manual). Helper ini membersihkan blok reasoning, menormalkan NaN, dan fallback membaca `reasoning_content` saat `content` kosong. | v6.0.21 |
| AI-006 | ❌ LARANGAN: Dilarang pakai `max_tokens` ≤ 600 untuk model reasoning (gpt-5.6-luna). Blok reasoning menelan budget token sehingga JSON jawaban terpotong ("Unexpected end of JSON input"). Minimum 1200; default callProvider 1500 (ceiling 4096). | v6.0.21 |
| AI-007 | ❌ LARANGAN: `stripAiWrapper` tidak boleh memakai regex nama tag yang bisa cocok dengan field JSON (mis. `<reason>` bertabrakan dengan `"reason":`). Nama tag wajib diikuti lookahead `(?=[\s>])`. | v6.0.21 |
| AI-008 | 📄 REFERENSI: Model Griphub `gpt-5.6-luna` adalah reasoning model. Respons SSE-nya bisa menyertakan `<think>`/`<reasoning>`/`<seed>`, token `NaN`/`Infinity`, dan jawaban kadang hanya ada di `reasoning_content`. `stripAiWrapper` mengekstrak JSON via brace-matching seimbang (bukan first-`{` s/d last-`}`). | v6.0.21 |

**Terkait payment:** rule verifikasi bukti (upload, kompresi, status `verification_failed`/`ai_error`) ada di `docs/rules/payment.md` (PAY-017–019), bukan di sini.
