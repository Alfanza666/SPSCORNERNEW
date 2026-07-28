// API failover: api.spscorner.store (Worker → VPS/Vercel) → fallback ke relative path (Vercel direct)
const PRIMARY_API = 'https://api.spscorner.store';
let usePrimary = true;
let lastCheck = 0;
let pendingHealthCheck: Promise<boolean> | null = null;
const CHECK_TTL = 30_000;

export function isReadOnlyRequest(method?: string): boolean {
  const normalizedMethod = (method || 'GET').toUpperCase();
  return normalizedMethod === 'GET' || normalizedMethod === 'HEAD';
}

async function checkPrimary(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const now = Date.now();
  if (pendingHealthCheck) return pendingHealthCheck;
  if (now - lastCheck < CHECK_TTL) return usePrimary;
  lastCheck = now;
  pendingHealthCheck = (async () => {
    try {
      const response = await fetchImpl(`${PRIMARY_API}/api/test-ping`, {
        signal: AbortSignal.timeout(3000),
      });
      usePrimary = response.ok;
    } catch {
      usePrimary = false;
    } finally {
      pendingHealthCheck = null;
    }
    return usePrimary;
  })();
  return pendingHealthCheck;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const healthy = await checkPrimary();
  const readOnly = isReadOnlyRequest(init?.method);
  if (healthy) {
    try {
      const res = await fetch(`${PRIMARY_API}${path}`, {
        ...init,
        credentials: 'include',
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok || res.status < 500) return res;
      usePrimary = false;
      if (!readOnly) return res;
    } catch {
      usePrimary = false;
      if (!readOnly) throw new Error('PRIMARY_API_REQUEST_UNCERTAIN');
    }
  }
  return fetch(path, { ...init, credentials: 'include' });
}

export function patchGlobalFetch(): (() => void) | undefined {
  if (typeof window === 'undefined') return undefined;
  const orig = window.fetch.bind(window);
  void checkPrimary(orig);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Internal application calls use URL/string + RequestInit. Keep Request
    // objects untouched because rebuilding their body turns it into a
    // ReadableStream that Safari/WebKit cannot upload reliably.
    if (input instanceof Request) return orig(input, init);

    const requestUrl = new URL(String(input), window.location.origin);

    if (requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api/')) {
      const path = `${requestUrl.pathname}${requestUrl.search}`;
      const readOnly = isReadOnlyRequest(init?.method);
      const alive = await checkPrimary(orig);

      if (alive) {
        try {
          const res = await orig(`${PRIMARY_API}${path}`, init);
          if (res.ok || res.status < 500) return res;
          usePrimary = false;
          if (!readOnly) return res;
        } catch {
          usePrimary = false;
          if (!readOnly) throw new Error('PRIMARY_API_REQUEST_UNCERTAIN');
        }
      }

      return orig(`${window.location.origin}${path}`, init);
    }

    return orig(input, init);
  };

  return () => {
    window.fetch = orig;
  };
}
