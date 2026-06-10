// @ts-nocheck
import crypto from "crypto";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";

const DIGIFLAZZ_USERNAME = process.env.DIGIFLAZZ_USERNAME || '';
const DIGIFLAZZ_API_KEY = process.env.DIGIFLAZZ_API_KEY || '';
const CACHE_FILE = path.join(os.tmpdir(), 'sps-digiflazz-cache.json');
const CACHE_TTL = 12 * 60 * 60 * 1000;

export function getDigiflazzAxiosConfig() {
  const config = { timeout: 15000 };
  if (process.env.FIXIE_URL) {
    const { HttpsProxyAgent } = require("https-proxy-agent");
    config.httpsAgent = new HttpsProxyAgent(process.env.FIXIE_URL);
  }
  return config;
}

export async function getDigiflazzBalance() {
  const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + 'deposit').digest('hex');
  const { data } = await axios.post('https://api.digiflazz.com/v1/cek-saldo', {
    cmd: 'deposit', username: DIGIFLAZZ_USERNAME, sign,
  }, getDigiflazzAxiosConfig());
  return data;
}

export function saveCacheToFile(data) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, timestamp: Date.now() })); }
  catch (e) { console.error('saveCacheToFile error:', e); }
}

export function updateDigiflazzCache() {
  if (process.env.VERCEL) return;
  setInterval(async () => {
    try {
      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + 'pricelist').digest('hex');
      const { data } = await axios.post('https://api.digiflazz.com/v1/price-list', {
        username: DIGIFLAZZ_USERNAME, sign, status: 'all',
      }, getDigiflazzAxiosConfig());
      if (data?.data) saveCacheToFile(data.data);
    } catch (e) { console.error('Cache update error:', e); }
  }, CACHE_TTL);
}

export async function processDigitalItems(transactionId, items) {
  const digitalItems = items.filter(item => item.metadata?.is_digital);
  if (digitalItems.length === 0) return;
  if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) { console.error("Digiflazz not configured"); return; }
  let allSuccess = true;
  for (const item of digitalItems) {
    try {
      const refId = `${transactionId}-${item.id}`;
      const buyerPhone = item.metadata?.customer_number || item.metadata?.phone || '';
      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + refId).digest('hex');
      const { data: result } = await axios.post('https://api.digiflazz.com/v1/transaction', {
        username: DIGIFLAZZ_USERNAME, buyer_sk_code: item.metadata?.buyer_sk_code || '', customer_no: buyerPhone,
        ref_id: refId, sign, commands: 'topup',
      }, getDigiflazzAxiosConfig());
      if (result?.data?.status === 'Sukses' || result?.data?.status === 'Gagal') {
        const { default: supabase } = await import('../lib/supabase.js');
        await supabase.from('transaction_items').update({
          metadata: { ...item.metadata, digiflazz_status: result.data.status, digiflazz_sn: result.data.sn || '', status: result.data.status === 'Sukses' ? 'delivered' : 'failed', paid_at: new Date().toISOString() },
        }).eq('id', item.id);
      }
    } catch (e) {
      console.error(`processDigitalItems error for item ${item.id}:`, e);
      allSuccess = false;
    }
  }
  return allSuccess;
}
