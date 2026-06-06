// API failover: api.spscorner.store (Worker → VPS/Vercel) → fallback ke relative path (Vercel direct)
const PRIMARY_API = 'https://api.spscorner.store';
let usePrimary = true;
let lastCheck = 0;
const CHECK_TTL = 30_000;

async function isPrimaryHealthy(): Promise<boolean> {
  const now = Date.now();
  if (now - lastCheck < CHECK_TTL) return usePrimary;
  lastCheck = now;
  try {
    await fetch(`${PRIMARY_API}/api/test-ping`, { signal: AbortSignal.timeout(3000) });
    usePrimary = true;
  } catch {
    usePrimary = false;
  }
  return usePrimary;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const healthy = await isPrimaryHealthy();
  if (healthy) {
    try {
      const res = await fetch(`${PRIMARY_API}${path}`, {
        ...init,
        credentials: 'include',
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok || res.status < 500) return res;
    } catch {
      usePrimary = false;
    }
  }
  return fetch(path, { ...init, credentials: 'include' });
}

let primaryAlive = true;
let primaryCheckAt = 0;
const PRIMARY_CHECK_TTL = 30_000;

async function checkPrimary(): Promise<boolean> {
  const now = Date.now();
  if (now - primaryCheckAt < PRIMARY_CHECK_TTL) return primaryAlive;
  primaryCheckAt = now;
  try {
    await fetch(`${PRIMARY_API}/api/health`, { signal: AbortSignal.timeout(3000) });
    primaryAlive = true;
  } catch {
    primaryAlive = false;
  }
  return primaryAlive;
}

export function patchGlobalFetch() {
  if (typeof window === 'undefined') return;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = req.url;
    if (url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)) {
      const path = url.startsWith(window.location.origin) ? url.slice(window.location.origin.length) : url;
      const alive = await checkPrimary();
      if (alive) {
        try {
          const res = await orig(`${PRIMARY_API}${path}`, init);
          if (res.ok || res.status < 500) return res;
        } catch {
          primaryAlive = false;
        }
      }
      return orig(path, init);
    }
    return orig(input, init);
  };
}
