// @ts-nocheck
import app from '../server.js';

export default function handler(req, res) {
  const qIdx = req.url?.indexOf('?__api=');
  if (qIdx !== -1) {
    const rest = decodeURIComponent(req.url.slice(qIdx + 7));
    req.url = '/api/' + rest;
    req.originalUrl = req.url;
  }
  return app(req, res);
}
