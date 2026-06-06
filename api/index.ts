// @ts-nocheck
let app;
try {
  const mod = await import('../server.js');
  app = mod.default;
} catch (e) {
  console.error('[api/index] Failed to load server:', e);
}

export default function handler(req, res) {
  if (!app) {
    res.status(500).json({ error: 'Server module not loaded' });
    return;
  }
  return app(req, res);
}
