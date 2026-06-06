// @ts-nocheck
let appPromise;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = import('../server.js').then(m => m.default).catch(e => {
      console.error('[api] Failed to load server:', e);
      return null;
    });
  }
  const app = await appPromise;
  if (!app) {
    res.status(500).json({ error: 'Server module not loaded', module: String(appPromise) });
    return;
  }
  return app(req, res);
}
