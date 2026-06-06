// Cloudflare Worker — Auto-failover: VPS (primary) → Vercel (fallback)
// Deploy via Cloudflare Dashboard → Workers & Pages → Create Worker
// Set route: api.spscorner.store/*

const VPS = 'http://45.158.126.76:3000';
const VERCEL_FALLBACK = 'https://www.spscorner.store';
const HEALTH_CHECK_INTERVAL = 30_000; // 30 seconds
const VPS_TIMEOUT = 5000;

let vpsHealthy = false;
let lastHealthCheck = 0;

async function checkVPS() {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) return vpsHealthy;

  lastHealthCheck = now;
  try {
    const res = await fetch(`${VPS}/api/test-ping`, {
      signal: AbortSignal.timeout(VPS_TIMEOUT),
    });
    vpsHealthy = res.ok || res.status < 500;
  } catch {
    vpsHealthy = false;
  }
  return vpsHealthy;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    const isHealthy = await checkVPS();

    if (isHealthy) {
      const vpsUrl = `${VPS}${path}`;
      try {
        const vpsRes = await fetch(vpsUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: AbortSignal.timeout(VPS_TIMEOUT),
        });
        return new Response(vpsRes.body, {
          status: vpsRes.status,
          statusText: vpsRes.statusText,
          headers: vpsRes.headers,
        });
      } catch {
        vpsHealthy = false;
      }
    }

    const fallbackUrl = `${VERCEL_FALLBACK}${path}`;
    return fetch(fallbackUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  },
};
