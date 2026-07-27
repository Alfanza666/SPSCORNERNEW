import axios from 'axios';
import 'dotenv/config';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyUrl = process.env.FIXIE_URL;
if (!proxyUrl) {
  throw new Error('FIXIE_URL is required');
}

const agent = new HttpsProxyAgent(proxyUrl);
axios.get('https://my.ipaymu.com', { httpsAgent: agent, proxy: false })
  .then(response => console.log('Success, Status:', response.status))
  .catch(error => {
    console.error('Proxy test failed:', error.response?.status || error.message);
    process.exitCode = 1;
  });
