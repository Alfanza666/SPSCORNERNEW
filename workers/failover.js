// Cloudflare Worker — Auto-failover: VPS (primary) → Vercel (fallback)
// Deploy via Cloudflare Dashboard → Workers & Pages → Create Worker
// Set route: api.spscorner.store/*

const VPS = 'http://103.193.179.217:3000';
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
        // Never replay a mutating request after the VPS may have processed it.
        // GET/HEAD can safely use Vercel if the origin returns 5xx.
        if (vpsRes.status >= 500 && request.method !== 'GET' && request.method !== 'HEAD') {
          return vpsRes;
        }
        if (vpsRes.ok || vpsRes.status < 500 || (request.method !== 'GET' && request.method !== 'HEAD')) {
          return new Response(vpsRes.body, {
            status: vpsRes.status,
            statusText: vpsRes.statusText,
            headers: vpsRes.headers,
          });
        }
        vpsHealthy = false;
      } catch {
        // A mutating request may have reached the VPS. Return an explicit
        // uncertain response instead of sending the same body to Vercel.
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return new Response(JSON.stringify({ error: 'ORIGIN_REQUEST_UNCERTAIN' }), {
            status: 502,
            headers: { 'content-type': 'application/json' },
          });
        }
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
