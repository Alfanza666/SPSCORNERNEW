import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';
dotenv.config();

const FIXIE_URL = process.env.FIXIE_URL;
const agent = FIXIE_URL ? new HttpsProxyAgent(FIXIE_URL) : undefined;

const req = https.get('https://api.spscorner.store/api/test-ping', { agent, timeout: 5000 }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data.trim()}`);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});
