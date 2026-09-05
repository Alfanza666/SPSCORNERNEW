# Rules — Infrastruktur & Networking

> Muat file ini hanya saat task menyentuh: deployment, auth session, fetch failover VPS/Vercel, atau routing server.

| ID | Rule | Ref |
|---|---|---|
| INFRA-001 | Auto-reconcile job (`autoReconcileTransactions()`) TIDAK BOLEH dinonaktifkan. | — |
| INFRA-002 | Semua endpoint payment/transaction wajib punya auth middleware. | AUDIT-v5.16.2 C04–C06 |
| INFRA-003 | Semua user-generated content yang di-render ke HTML wajib disanitasi (cegah HTML injection). | AUDIT-v5.16.2 C02, C14 |
| INFRA-004 | VPS = primary, Vercel + Fixie = fallback. GET/HEAD boleh auto-fallback; mutating request/payment dilarang blind replay setelah timeout/5xx tanpa idempotency + verifikasi status. | CAPA-v5.16.5 |
| INFRA-005 | Dilarang membungkus ulang body mutating request jadi `Request`/`ReadableStream` di global fetch failover — pertahankan `RequestInit` asli. Wajib uji primary & fallback dengan simulasi WebKit. | CAPA-v5.16.6 |
| INFRA-006 | Request iPaymu dari VPS via IP whitelist langsung; dari Vercel wajib via Fixie/static egress terverifikasi. | — |
| INFRA-007 | Dilarang mengabaikan seluruh event `onAuthStateChange` setelah startup — `TOKEN_REFRESHED`, `SIGNED_IN`, `SIGNED_OUT` wajib ditangani selektif agar Zustand & sesi Supabase tetap sinkron. | — |
| INFRA-008 | Dilarang `git reset --hard` / hapus untracked files / timpa worktree VPS yang drift tanpa backup + diff dulu. Hotfix manual valid wajib dipindahkan ke Git. | — |
| INFRA-009 | API 404 catch-all di `server.ts` wajib ada SEBELUM SPA fallback. | — |

**Status infrastruktur yang bisa berubah** (IP aktif, kondisi CI/CD, dependency yang sering hilang): lihat `docs/STATUS.md` — jangan anggap detail di sana permanen.
