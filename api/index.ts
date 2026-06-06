// @ts-nocheck
import express from 'express';

const testApp = express();
testApp.get('/api/test-ping', (req, res) => {
  res.json({ ok: true, from: 'vercel-minimal' });
});

export default function handler(req, res) {
  return testApp(req, res);
}
