# AGENTS.md — SPS Corner

## Commands

```bash
npm run dev      # Start dev server (runs server.ts via tsx on port 3000)
npm run build    # Vite build → dist/
npm run lint     # TypeScript type-check only (no linter)
```

## Architecture

- **Frontend**: React 19 + Vite, served from `dist/` (SPA mode)
- **Backend**: Express API in `server.ts` (server-side only, no Next.js)
- **Path alias**: `@/*` maps to project root (src is at `.`)
- **PWA**: Service worker at `src/sw.ts` with `injectManifest` strategy
- **Database**: Supabase (Postgres + Auth + Storage)

## Server Startup

`server.ts` runs on port 3000 when `process.env.VERCEL` is not set. In development it attaches Vite middleware. In production it serves `dist/` and proxies API to `/api/index`.

## Environment Variables (Critical)

- `.env` contains production keys — do not commit real credentials
- `VERCEL_` prefix for Vercel deployment env vars
- Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Required for payment: `IPAYMU_VA`, `IPAYMU_API_KEY`, `DIGIFLAZZ_USERNAME`, `DIGIFLAZZ_API_KEY`
- Required for email: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- Required for AI: `GEMINI_API_KEY`
- Optional but needed: `FIXIE_URL` (static IP proxy for Digiflazz/iPaymu whitelist)

## Key Integrations

- **iPaymu**: Payment gateway for QRIS, VA, direct payment
- **Digiflazz**: PPOB for digital products (pulsa, e-wallet, PLN). Requires static IP. Use `FIXIE_URL` if server IP changes
- **Gemini**: Receipt image verification via AI in `/api/payment/manual/verify`
- **Gmail SMTP**: Order notifications to Sariroti admin and buyers

## Important Quirks

- Rate limits: `/api/payment` (10/min), `/api/auth` (20/15min)
- Digiflazz balance check before digital order creation — fails if insufficient
- Sariroti items trigger special email flow when product name/category contains "roti" or "koperasi"
- Seller share: 92% of transaction amount goes to seller balance
- Loyalty points: 1% of transaction amount earned as points
- Pending transactions auto-cancelled after 5 minutes

## TypeScript

`server.ts` has `@ts-nocheck` at top — it is compiled output, not source. Edit with caution.

## Deployment

- Vercel: `vercel.json` handles rewrites for SPA and API
- Frontend build output: `dist/`
- API routes: `/api/*` → `/api/index` (Vercel serverless functions)