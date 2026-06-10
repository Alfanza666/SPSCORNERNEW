// @ts-nocheck
import crypto from "crypto";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";

export const DIGIFLAZZ_USERNAME = (process.env.DIGIFLAZZ_USERNAME || "").replace(/['"]/g, "").trim();
export const DIGIFLAZZ_API_KEY = (process.env.DIGIFLAZZ_API_KEY || "").replace(/['"]/g, "").trim();
export const isDefaultDigiflazz = !DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY;
export const CACHE_FILE = path.join(os.tmpdir(), "digiflazz_cache.json");
export const CACHE_TTL = 12 * 60 * 60 * 1e3;
export let priceCache = {};

try {
  if (fs.existsSync(CACHE_FILE)) {
    const fileContent = fs.readFileSync(CACHE_FILE, "utf-8");
    priceCache = JSON.parse(fileContent);
    console.log("\u2705 Loaded Digiflazz price cache from file.");
  }
} catch (err) {
  console.error("Failed to load Digiflazz cache from file:", err);
}

const FIXIE_URL =
  process.env.FIXIE_URL && !process.env.FIXIE_URL.includes("YOUR_FIXIE_PROXY_URL")
    ? process.env.FIXIE_URL
    : null;

export function getDigiflazzAxiosConfig() {
  const config = {};
  if (FIXIE_URL) {
    try {
      config.httpsAgent = new (require("https-proxy-agent").HttpsProxyAgent)(FIXIE_URL);
      config.proxy = false;
    } catch (error) {
      console.error("\u274C Invalid FIXIE_URL provided. Proxy will not be used.", error);
    }
  }
  return config;
}

export function saveCacheToFile() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(priceCache), "utf-8");
  } catch (err) {
    console.error("Failed to save Digiflazz cache to file:", err);
  }
}

export async function updateDigiflazzCache() {
  if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
    console.log("\u26A0\uFE0F Skipping background Digiflazz price update: Credentials not configured.");
    return;
  }
  try {
    const types = ["prepaid", "postpaid"];
    for (const type of types) {
      if (priceCache[type] && Date.now() - priceCache[type].timestamp < CACHE_TTL) {
        console.log(`\u2139\uFE0F Skipping background update for ${type} prices: Cache is still fresh.`);
        continue;
      }
      console.log(`Fetching ${type} price list from Digiflazz...`);
      const sign = crypto.createHash("md5").update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "pricelist").digest("hex");
      const payload = { cmd: type === "postpaid" ? "pasca" : "prepaid", username: DIGIFLAZZ_USERNAME, sign };
      const response = await axios.post("https://api.digiflazz.com/v1/price-list", payload, getDigiflazzAxiosConfig());
      if (response.data?.data && Array.isArray(response.data.data)) {
        priceCache[type] = { data: response.data.data, timestamp: Date.now() };
        saveCacheToFile();
        console.log(`\u2705 Successfully updated ${type} price cache in background.`);
      } else if (response.data?.data?.rc) {
        if (response.data.data.rc === "83") {
          console.warn(`\u26A0\uFE0F Digiflazz ${type} rate limit reached (Code 83). Will retry later. Existing cache retained.`);
        } else {
          console.error(`\u274C Digiflazz ${type} update returned error code ${response.data.data.rc}: ${response.data.data.message}`);
        }
      } else {
        console.warn(`\u26A0\uFE0F Digiflazz ${type} update returned unexpected format:`, JSON.stringify(response.data).substring(0, 200));
      }
      await new Promise((resolve) => setTimeout(resolve, 2e3));
    }
  } catch (error) {
    const errorDetail = error.response?.data || error.message;
    console.error("\u274C Background Digiflazz update failed:", typeof errorDetail === "object" ? JSON.stringify(errorDetail, null, 2) : errorDetail);
    if (error.response?.status === 400) {
      console.error("\u{1F4A1} Tip: A 400 error often means an invalid signature or invalid parameters. Check your DIGIFLAZZ_USERNAME and DIGIFLAZZ_API_KEY.");
    } else if (error.response?.status === 401) {
      console.error("\u{1F4A1} Tip: A 401 error means unauthorized. Check your credentials and ensure your IP is whitelisted in Digiflazz dashboard.");
    }
  }
}

export async function getDigiflazzBalance() {
  if (isDefaultDigiflazz) return 0;
  try {
    const sign = crypto.createHash("md5").update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "deposit").digest("hex");
    const response = await axios.post("https://api.digiflazz.com/v1/cek-saldo", { cmd: "deposit", username: DIGIFLAZZ_USERNAME, sign });
    return response.data?.data?.deposit || 0;
  } catch (err) {
    console.error("Failed to get Digiflazz balance:", err?.response?.data || err.message);
    return 0;
  }
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
