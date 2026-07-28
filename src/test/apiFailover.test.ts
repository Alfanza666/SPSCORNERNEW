import { afterEach, describe, expect, it, vi } from 'vitest';

const realFetch = window.fetch;

afterEach(() => {
  window.fetch = realFetch;
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('API failover policy', () => {
  it('classifies only GET and HEAD as replay-safe', async () => {
    const { isReadOnlyRequest } = await import('../lib/api');

    expect(isReadOnlyRequest()).toBe(true);
    expect(isReadOnlyRequest('HEAD')).toBe(true);
    expect(isReadOnlyRequest('POST')).toBe(false);
    expect(isReadOnlyRequest('PATCH')).toBe(false);
  });

  it('does not replay a POST after the primary request becomes uncertain', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push({ url, init });
      if (input instanceof Request && input.body) {
        throw new TypeError('ReadableStream uploading is not supported');
      }
      if (url.endsWith('/api/test-ping')) return new Response('ok', { status: 200 });
      if (url.startsWith('https://api.spscorner.store/')) {
        throw new TypeError('fetch failed');
      }
      return new Response('fallback', { status: 200 });
    }) as typeof fetch;

    const { patchGlobalFetch } = await import('../lib/api');
    const restore = patchGlobalFetch();
    await vi.waitFor(() => expect(calls.some(({ url }) => url.endsWith('/api/test-ping'))).toBe(true));

    await expect(window.fetch('/api/payment/ipaymu/direct', {
      method: 'POST',
      body: JSON.stringify({ transaction_id: 'tx-1' }),
    })).rejects.toThrow('PRIMARY_API_REQUEST_UNCERTAIN');

    expect(calls
      .filter(({ url }) => url.includes('/api/payment/ipaymu/direct'))
      .map(({ url }) => url)).toEqual([
      'https://api.spscorner.store/api/payment/ipaymu/direct',
    ]);
    expect(calls.find(({ url }) => url.includes('/api/payment/ipaymu/direct'))?.init?.body).toBe(
      JSON.stringify({ transaction_id: 'tx-1' }),
    );
    restore?.();
  });

  it('preserves a JSON POST body without converting it to a Request stream', async () => {
    const body = JSON.stringify({ transaction_id: 'tx-safari' });
    const calls: string[] = [];
    window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input instanceof Request && input.body) {
        throw new TypeError('ReadableStream uploading is not supported');
      }
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/api/test-ping')) return new Response('ok', { status: 200 });
      expect(url).toBe('https://api.spscorner.store/api/transactions/create');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(body);
      expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
      return new Response('created', { status: 200 });
    }) as typeof fetch;

    const { patchGlobalFetch } = await import('../lib/api');
    const restore = patchGlobalFetch();

    const response = await window.fetch('/api/transactions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      'https://api.spscorner.store/api/test-ping',
      'https://api.spscorner.store/api/transactions/create',
    ]);
    restore?.();
  });

  it('falls back once for a GET when the primary returns 5xx', async () => {
    const calls: string[] = [];
    window.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      if (url.endsWith('/api/test-ping')) return new Response('ok', { status: 200 });
      if (url.startsWith('https://api.spscorner.store/')) {
        return new Response('primary down', { status: 503 });
      }
      return new Response('fallback ok', { status: 200 });
    }) as typeof fetch;

    const { patchGlobalFetch } = await import('../lib/api');
    const restore = patchGlobalFetch();
    await vi.waitFor(() => expect(calls.some(url => url.endsWith('/api/test-ping'))).toBe(true));

    const response = await window.fetch('/api/dashboard/summary');

    expect(response.status).toBe(200);
    expect(calls.filter(url => url.includes('/api/dashboard/summary'))).toEqual([
      'https://api.spscorner.store/api/dashboard/summary',
      `${window.location.origin}/api/dashboard/summary`,
    ]);
    restore?.();
  });

  it('sends a POST once to fallback when preflight already marked primary unhealthy', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push({ url, init });
      if (input instanceof Request && input.body) {
        throw new TypeError('ReadableStream uploading is not supported');
      }
      if (url.endsWith('/api/test-ping')) return new Response('down', { status: 503 });
      return new Response('fallback ok', { status: 200 });
    }) as typeof fetch;

    const { patchGlobalFetch } = await import('../lib/api');
    const restore = patchGlobalFetch();
    await vi.waitFor(() => expect(calls.some(({ url }) => url.endsWith('/api/test-ping'))).toBe(true));

    const body = JSON.stringify({ transaction_id: 'tx-1' });
    const response = await window.fetch('/api/payment/ipaymu/direct', {
      method: 'POST',
      body,
    });

    expect(response.status).toBe(200);
    expect(calls
      .filter(({ url }) => url.includes('/api/payment/ipaymu/direct'))
      .map(({ url }) => url)).toEqual([
      `${window.location.origin}/api/payment/ipaymu/direct`,
    ]);
    expect(calls.find(({ url }) => url.includes('/api/payment/ipaymu/direct'))?.init?.body).toBe(body);
    restore?.();
  });
});
