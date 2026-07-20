import { IpaymuSignature } from './src/services/ipaymu/signature.js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const va = process.env.IPAYMU_VA || '';
const apiKey = process.env.IPAYMU_API_KEY || '';
const baseUrl = 'https://my.ipaymu.com/api/v2';

async function check(body: any) {
  const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
    va, body, 'POST', apiKey
  );
  try {
    const res = await axios.post(`${baseUrl}/transaction`, JSON.parse(jsonBody), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'va': va,
        'signature': signature,
        'timestamp': timestamp,
      }
    });
    console.log("Success:", JSON.stringify(res.data, null, 2));
  } catch(e: any) {
    console.error("Error:", e.response?.data || e.message);
  }
}

check({ transactionId: "36601704" });
