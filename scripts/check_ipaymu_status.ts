import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { IpaymuClient } from './src/services/ipaymu/client.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ipaymuClient = new IpaymuClient(
  process.env.IPAYMU_VA || '',
  process.env.IPAYMU_API_KEY || '',
  process.env.IPAYMU_PRODUCTION === 'true',
  {},
  process.env.FIXIE_URL
);

async function checkIpaymuStatus() {
  try {
    const status = await ipaymuClient.getTransactionStatus('37827b32-acf4-4ae8-83a5-7ce1e5414423');
    console.log("Status for 37827b32-acf4-4ae8-83a5-7ce1e5414423:", JSON.stringify(status, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

checkIpaymuStatus();
