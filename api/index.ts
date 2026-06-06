// @ts-nocheck
export default function handler(req, res) {
  const parts = [];
  
  parts.push('URL: ' + (req.url || ''));
  parts.push('METHOD: ' + (req.method || ''));
  parts.push('HEADERS: ' + JSON.stringify(Object.fromEntries(
    Object.entries(req.headers || {}).filter(([k]) => k.startsWith('x-') || k.startsWith('cf-') || k === 'host')
  ), null, 2));
  
  const qIdx = req.url?.indexOf('?__api=');
  if (qIdx !== -1) {
    const rest = decodeURIComponent(req.url.slice(qIdx + 7));
    parts.push('RESTORED: /api/' + rest);
  }
  
  res.setHeader('content-type', 'text/plain');
  res.status(200).end(parts.join('\n\n'));
}
