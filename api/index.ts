// @ts-nocheck
export default function handler(req, res) {
  const vars = {};
  const keys = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'FIXIE_URL', 'SENTRY_DSN', 'IPAYMU_VA', 'IPAYMU_API_KEY', 'DIGIFLAZZ_USERNAME', 'GMAIL_USER', 'VAPID_PRIVATE_KEY', 'APP_URL', 'VERCEL', 'VERCEL_ENV'];
  for (const k of keys) {
    vars[k] = process.env[k] ? (k.includes('KEY') || k.includes('SECRET') ? '***SET***' : process.env[k].slice(0,40)) : 'NOT SET';
  }
  res.setHeader('content-type', 'application/json');
  res.status(200).end(JSON.stringify({ env: vars, url: req.url }, null, 2));
}
