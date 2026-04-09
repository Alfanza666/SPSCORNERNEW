import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';
dotenv.config();

async function testIpaymu() {
  try {
    const config: any = {};
    if (process.env.FIXIE_URL) {
      config.httpsAgent = new HttpsProxyAgent(process.env.FIXIE_URL);
    }

    const payload = {
      // Invalid payload
    };

    const res = await axios.post('https://sandbox.ipaymu.com/api/v2/payment', payload, config);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.error('Error:', e.response?.data || e.message);
  }
}

testIpaymu();
