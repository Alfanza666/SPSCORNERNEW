import { config } from 'dotenv';
config();
import { IpaymuClient } from '../src/services/ipaymu/client.js';

const client = new IpaymuClient(process.env.IPAYMU_VA || '', process.env.IPAYMU_API_KEY || '');

async function check() {
  try {
    const res = await client.getTransactionStatus('37827b32-acf4-4ae8-83a5-7ce1e5414423');
    console.log("By reference ID (our TX ID):", JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.error("By Ref ID error:", e?.response?.data || e.message);
  }
  
  try {
    const res = await client.getTransactionStatus('36601704');
    console.log("By iPaymu TX ID:", JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.error("By iPaymu TX ID error:", e?.response?.data || e.message);
  }
}

check();
