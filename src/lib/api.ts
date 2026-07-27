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
    const req = input instanceof Request
      ? new Request(input, init)
      : new Request(new URL(String(input), window.location.origin), init);
    const url = req.url;
    const requestUrl = new URL(url, window.location.origin);

    if (requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api/')) {
      const path = `${requestUrl.pathname}${requestUrl.search}`;
      const readOnly = isReadOnlyRequest(req.method);
      const alive = await checkPrimary(orig);

      if (alive) {
        try {
          const primaryRequest = new Request(`${PRIMARY_API}${path}`, req.clone());
          const res = await orig(primaryRequest);
          if (res.ok || res.status < 500) return res;
          usePrimary = false;
          if (!readOnly) return res;
        } catch {
          usePrimary = false;
          if (!readOnly) throw new Error('PRIMARY_API_REQUEST_UNCERTAIN');
        }
      }

      const fallbackRequest = new Request(
        `${window.location.origin}${path}`,
        req.clone(),
      );
      return orig(fallbackRequest);
    }

    return orig(input, init);
  };

  return () => {
    window.fetch = orig;
  };
}
