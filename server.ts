import express from "express";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import nodemailer from "nodemailer";
import { IpaymuClient } from './src/services/ipaymu/client.js';
import type { RedirectPaymentData, DirectPaymentData } from './src/services/ipaymu/client.js';

dotenv.config();

// Initialize Supabase Client (Server-side with Service Role Key for bypass RLS)
const envUrl = process.env.VITE_SUPABASE_URL;
const supabaseUrl = typeof envUrl === 'string' && envUrl.startsWith('http') ? envUrl : 'https://jofwebrbdlovwkgklwab.supabase.co';

const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceKey = typeof envKey === 'string' && envKey.trim() !== '' ? envKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvZndlYnJiZGxvdndrZ2tsd2FiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc5MTkwNywiZXhwIjoyMDg2MzY3OTA3fQ.Q51X1VHwEB9vnB5tXWd9ajJJ58F4OaYqUnaqi20DJxQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

import { GoogleGenAI } from '@google/genai';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();

// Increase payload limit for base64 images and save raw body for webhook signature verification
app.use(express.json({ 
  limit: '50mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Debug endpoint to check outbound IP
  app.get("/api/debug/ip", async (req, res) => {
    try {
      const response = await axios.get('https://ifconfig.me/ip');
      const ip = response.data.trim();
      
      let proxyIp = null;
      if (FIXIE_URL) {
        try {
          const proxyResponse = await axios.get('https://ifconfig.me/ip', getDigiflazzAxiosConfig());
          proxyIp = proxyResponse.data.trim();
        } catch (e) {
          proxyIp = 'Error fetching proxy IP';
        }
      }

      res.json({ 
        outbound_ip: ip,
        proxy_ip: proxyIp,
        using_proxy: !!FIXIE_URL
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch outbound IP' });
    }
  });

  // Digiflazz API Config
  const DIGIFLAZZ_USERNAME = (process.env.DIGIFLAZZ_USERNAME || '').replace(/['"]/g, '').trim();
  const DIGIFLAZZ_API_KEY = (process.env.DIGIFLAZZ_API_KEY || '').replace(/['"]/g, '').trim();
  
  const isDefaultDigiflazz = !DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY;

  console.log('🔧 Digiflazz Config:', {
    username: DIGIFLAZZ_USERNAME,
    apiKeySet: !!process.env.DIGIFLAZZ_API_KEY,
    isDefault: isDefaultDigiflazz
  });

  const FIXIE_URL = process.env.FIXIE_URL && !process.env.FIXIE_URL.includes('YOUR_FIXIE_PROXY_URL') ? process.env.FIXIE_URL : null;

  // Helper to get Axios config with proxy if available
  const getDigiflazzAxiosConfig = () => {
    const config: any = {};
    if (FIXIE_URL) {
      try {
        config.httpsAgent = new HttpsProxyAgent(FIXIE_URL);
        config.proxy = false;
      } catch (error) {
        console.error('❌ Invalid FIXIE_URL provided. Proxy will not be used.', error);
      }
    }
    return config;
  };

  // ===== IPAYMU PAYMENT INITIALIZATION =====
  const IPAYMU_VA = (process.env.IPAYMU_VA || '').replace(/['"]/g, '').trim();
  const IPAYMU_API_KEY = (process.env.IPAYMU_API_KEY || '').replace(/['"]/g, '').trim();
  // Force production to true since user stated they only use production keys
  const IPAYMU_PRODUCTION = true;

  if (!IPAYMU_VA || !IPAYMU_API_KEY) {
    console.warn('⚠️ IPAYMU_VA or IPAYMU_API_KEY not configured');
  }

  const ipaymuClient = new IpaymuClient(IPAYMU_VA, IPAYMU_API_KEY, IPAYMU_PRODUCTION, getDigiflazzAxiosConfig());

  console.log('💳 Ipaymu Config:', {
    va: IPAYMU_VA ? '✓ Set' : '✗ Not Set',
    apiKey: IPAYMU_API_KEY ? '✓ Set' : '✗ Not Set',
    production: IPAYMU_PRODUCTION,
    baseUrl: IPAYMU_PRODUCTION ? 'https://my.ipaymu.com' : 'https://sandbox.ipaymu.com',
  });

  // Helper to process digital items via Digiflazz
  const processDigitalItems = async (transactionId: string, transactionItems: any[]) => {
    const digitalItems = transactionItems.filter((item: any) => item.metadata?.is_digital);
    let allDigitalSuccess = true;

    if (digitalItems.length > 0 && (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY)) {
      console.error('❌ Digiflazz credentials not configured. Cannot process digital items.');
      
      for (const item of digitalItems) {
        await supabase
          .from('transaction_items')
          .update({
            metadata: {
              ...item.metadata,
              digiflazz_error: 'Digiflazz credentials not configured'
            }
          })
          .eq('id', item.id);
      }
      
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transactionId);
        
      return false;
    }

    for (let i = 0; i < digitalItems.length; i++) {
      const item = digitalItems[i];
      const sku = item.metadata?.sku;
      const target = item.metadata?.target_number;
      const isPostpaid = item.metadata?.is_postpaid;
      const quantity = item.quantity || 1;
      
      if (sku && target) {
        for (let j = 0; j < quantity; j++) {
          const refId = (digitalItems.length === 1 && quantity === 1) 
            ? transactionId 
            : `${transactionId.substring(0, 25)}-${i}-${j}`;

          console.log(`Placing Digiflazz order for SKU: ${sku}, Target: ${target}, Ref: ${refId}`);
          
          const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + refId).digest('hex');
          
          const payload: any = {
            username: DIGIFLAZZ_USERNAME,
            buyer_sku_code: sku,
            customer_no: target,
            ref_id: refId,
            sign: sign,
            testing: process.env.DIGIFLAZZ_TESTING === 'true'
          };

          if (isPostpaid) {
            payload.commands = 'pay-pasca';
          }

          try {
            const digiResponse = await axios.post('https://api.digiflazz.com/v1/transaction', payload, getDigiflazzAxiosConfig());
            const digiData = digiResponse.data;
            console.log('Digiflazz Order Response:', JSON.stringify(digiData, null, 2));

            await supabase
              .from('transaction_items')
              .update({
                metadata: {
                  ...item.metadata,
                  digiflazz_response: digiData.data
                }
              })
              .eq('id', item.id);

            if (digiData.data && digiData.data.rc && digiData.data.rc !== '00' && digiData.data.rc !== '03') {
              allDigitalSuccess = false;
              console.error(`❌ Digiflazz Order Failed (RC ${digiData.data.rc}): ${digiData.data.message}`);
            }
          } catch (digiErr: any) {
            allDigitalSuccess = false;
            const errorDetail = digiErr.response?.data || digiErr.message;
            console.error('❌ Digiflazz Order Error:', typeof errorDetail === 'object' ? JSON.stringify(errorDetail, null, 2) : errorDetail);
            
            await supabase
              .from('transaction_items')
              .update({
                metadata: {
                  ...item.metadata,
                  digiflazz_error: errorDetail
                }
              })
              .eq('id', item.id);
          }
        }
      }
    }

    if (digitalItems.length > 0 && !allDigitalSuccess) {
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transactionId);
    }
    
    return allDigitalSuccess;
  };

  // Helper to send email via Nodemailer (Gmail)
  const sendSarirotiEmailInternal = async (to: string, subject: string, html: string) => {
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error('⚠️ GMAIL_USER or GMAIL_APP_PASSWORD not set.');
      return { success: false, error: 'GMAIL_USER atau GMAIL_APP_PASSWORD belum diatur di Environment Variables.' };
    }

    try {
      console.log(`📧 Attempting to send email to ${to} via Gmail...`);
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD
        },
        connectionTimeout: 5000, // 5 seconds timeout
        greetingTimeout: 5000,
        socketTimeout: 5000
      });

      const info = await transporter.sendMail({
        from: `"SPS Corner" <${GMAIL_USER}>`,
        to: to,
        subject: subject,
        html: html,
      });

      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true, data: info };
    } catch (error: any) {
      console.error('❌ Error sending email via Gmail:', error);
      return { success: false, error: error.message || 'Unknown email error' };
    }
  };

  // Helper to trigger Sariroti email based on transaction
  const triggerSarirotiEmail = async (transactionId: string, buyerName: string, totalAmount: number) => {
    try {
      const { data: items, error } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('transaction_id', transactionId);

      if (error) throw error;

      // Filter only Sariroti items
      const sarirotiItems = items.filter((item: any) => {
        const name = (item.name || '').toLowerCase();
        const category = (item.category || '').toLowerCase();
        return name.includes('sariroti') || name.includes('roti') || name.includes('koperasi') ||
               category.includes('sariroti') || category.includes('roti') || category.includes('koperasi');
      });

      if (sarirotiItems.length === 0) {
        console.log(`ℹ️ No Sariroti items in transaction ${transactionId}. Skipping email.`);
        return;
      }

      const sarirotiSubtotal = sarirotiItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const itemsHtml = sarirotiItems.map((item: any) => 
        `<li>${item.name} x ${item.quantity} - Rp ${item.price.toLocaleString('id-ID')}</li>`
      ).join('');

      const targetEmail = process.env.SARIROTI_ADMIN_EMAIL || 'Sales.Adm.bjm@sariroti.com';

      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0056b3;">Pesanan Baru Sariroti</h2>
          <p>Halo Admin Sariroti,</p>
          <p>Ada pesanan baru dari <strong>${buyerName}</strong> dengan detail sebagai berikut:</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>ID Transaksi:</strong> ${transactionId}</p>
            <p><strong>Item Sariroti:</strong></p>
            <ul>${itemsHtml}</ul>
            <p><strong>Subtotal Sariroti:</strong> Rp ${sarirotiSubtotal.toLocaleString('id-ID')}</p>
          </div>
          <p>Mohon segera diproses. Terima kasih.</p>
        </div>
      `;

      const result = await sendSarirotiEmailInternal(targetEmail, `Pesanan Sariroti Baru - ${buyerName}`, emailHtml);
      if (result.success) {
        console.log(`✅ Sariroti email triggered for transaction ${transactionId}`);
      } else {
        console.error(`❌ Failed to send Sariroti email for transaction ${transactionId}:`, result.error);
      }
    } catch (err) {
      console.error('❌ Error triggering Sariroti email:', err);
    }
  };

  // Simple file-based cache for Digiflazz prices to survive server restarts
  // Use os.tmpdir() to support read-only filesystems like Cloud Run and Vercel
  const CACHE_FILE = path.join(os.tmpdir(), 'digiflazz_cache.json');
  let priceCache: {
    [key: string]: {
      data: any;
      timestamp: number;
    }
  } = {};

  // Load cache from file on startup
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const fileContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      priceCache = JSON.parse(fileContent);
      console.log('✅ Loaded Digiflazz price cache from file.');
    }
  } catch (err) {
    console.error('Failed to load Digiflazz cache from file:', err);
  }

  const saveCacheToFile = () => {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(priceCache), 'utf-8');
    } catch (err) {
      console.error('Failed to save Digiflazz cache to file:', err);
    }
  };
  
  const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

  // Background fetcher to keep cache warm
  const updateDigiflazzCache = async () => {
    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      console.log('⚠️ Skipping background Digiflazz price update: Credentials not configured.');
      return;
    }

    try {
      const types = ['prepaid', 'postpaid'];
      for (const type of types) {
        // Check if we already have a fresh cache
        if (priceCache[type] && (Date.now() - priceCache[type].timestamp < CACHE_TTL)) {
          console.log(`ℹ️ Skipping background update for ${type} prices: Cache is still fresh.`);
          continue;
        }

        console.log(`Fetching ${type} price list from Digiflazz...`);
        const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "pricelist").digest('hex');
        
        const payload = {
          cmd: type === 'postpaid' ? 'pasca' : 'prepaid',
          username: DIGIFLAZZ_USERNAME,
          sign: sign
        };

        const response = await axios.post('https://api.digiflazz.com/v1/price-list', payload, getDigiflazzAxiosConfig());

        if (response.data?.data && Array.isArray(response.data.data)) {
          priceCache[type] = {
            data: response.data.data,
            timestamp: Date.now()
          };
          saveCacheToFile();
          console.log(`✅ Successfully updated ${type} price cache in background.`);
        } else if (response.data?.data?.rc) {
          if (response.data.data.rc === '83') {
            console.warn(`⚠️ Digiflazz ${type} rate limit reached (Code 83). Will retry later. Existing cache retained.`);
          } else {
            console.error(`❌ Digiflazz ${type} update returned error code ${response.data.data.rc}: ${response.data.data.message}`);
          }
        } else {
          console.warn(`⚠️ Digiflazz ${type} update returned unexpected format:`, JSON.stringify(response.data).substring(0, 200));
        }
        
        // Small delay between requests to avoid immediate rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      const errorDetail = error.response?.data || error.message;
      console.error('❌ Background Digiflazz update failed:', typeof errorDetail === 'object' ? JSON.stringify(errorDetail, null, 2) : errorDetail);
      
      if (error.response?.status === 400) {
        console.error('💡 Tip: A 400 error often means an invalid signature or invalid parameters. Check your DIGIFLAZZ_USERNAME and DIGIFLAZZ_API_KEY.');
      } else if (error.response?.status === 401) {
        console.error('💡 Tip: A 401 error means unauthorized. Check your credentials and ensure your IP is whitelisted in Digiflazz dashboard.');
      }
    }
  };

  // Run immediately and then every 1 hour
  if (!process.env.VERCEL) {
    setTimeout(updateDigiflazzCache, 5000);
    setInterval(updateDigiflazzCache, CACHE_TTL);
  }

  // 1. Get Real-time Prices from Digiflazz
  app.post("/api/digital/prices", async (req, res) => {
    try {
      const { category, type = 'prepaid' } = req.body;
      const cacheKey = `${type}`;

      if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
        console.log(`Digiflazz credentials not configured. Returning empty data for ${category || type}`);
        return res.json({ success: true, data: [], mock: true });
      }

      // Check cache first
      if (priceCache[cacheKey] && (Date.now() - priceCache[cacheKey].timestamp < CACHE_TTL)) {
        let filtered = priceCache[cacheKey].data;
        if (category) {
          filtered = filtered.filter((p: any) => p.category.toLowerCase().includes(category.toLowerCase()));
        }
        return res.json({ success: true, data: filtered, cached: true });
      }

      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "pricelist").digest('hex');
      
      const response = await axios.post('https://api.digiflazz.com/v1/price-list', {
        cmd: type === 'postpaid' ? 'pasca' : 'prepaid',
        username: DIGIFLAZZ_USERNAME,
        sign: sign
      }, getDigiflazzAxiosConfig());

      const data = response.data;
      
      if (data.data && Array.isArray(data.data)) {
        // Update cache
        priceCache[cacheKey] = {
          data: data.data,
          timestamp: Date.now()
        };
        saveCacheToFile();

        // Filter by category if provided
        let filtered = data.data;
        if (category) {
          filtered = data.data.filter((p: any) => p.category.toLowerCase().includes(category.toLowerCase()));
        }
        return res.json({ success: true, data: filtered });
      } else if (data.data && data.data.rc) {
        if (data.data.rc !== '83') {
          console.error('Digiflazz Price Error Response:', JSON.stringify(data.data));
        }
        
        // If rate limited (rc 83) and we have stale cache, serve stale cache
        if (data.data.rc === '83') {
          if (priceCache[cacheKey]) {
            console.log(`Rate limited, serving STALE ${type} prices from cache`);
            let filtered = priceCache[cacheKey].data;
            if (category) {
              filtered = filtered.filter((p: any) => p.category.toLowerCase().includes(category.toLowerCase()));
            }
            return res.json({ success: true, data: filtered, cached: true, stale: true });
          } else {
            // Return empty data if rate limited and no cache
            console.log(`Rate limited and no cache available. Returning empty data for ${category || type}`);
            return res.json({ success: true, data: [], mock: true });
          }
        }

        return res.json({ success: false, error: data.data.message || 'Failed to fetch prices' });
      } else if (data.rc) {
        if (data.rc !== '83') {
          console.error('Digiflazz Price Error Response:', JSON.stringify(data));
        }
        
        // If rate limited (rc 83) and we have stale cache, serve stale cache
        if (data.rc === '83') {
          if (priceCache[cacheKey]) {
            console.log(`Rate limited, serving STALE ${type} prices from cache`);
            let filtered = priceCache[cacheKey].data;
            if (category) {
              filtered = filtered.filter((p: any) => p.category.toLowerCase().includes(category.toLowerCase()));
            }
            return res.json({ success: true, data: filtered, cached: true, stale: true });
          } else {
            // Return empty data if rate limited and no cache
            console.log(`Rate limited and no cache available. Returning empty data for ${category || type}`);
            return res.json({ success: true, data: [], mock: true });
          }
        }

        return res.json({ success: false, error: data.message || 'Failed to fetch prices' });
      }
      
      res.json({ success: false, error: 'Invalid response from provider' });
    } catch (error: any) {
      console.error('Digiflazz Price Error:', error.response?.data ? JSON.stringify(error.response.data) : error.message);
      
      // If error and we have stale cache, serve stale cache
      const cacheKey = `${req.body.type || 'prepaid'}`;
      if (priceCache[cacheKey]) {
        console.log(`Network error, serving STALE ${cacheKey} prices from cache`);
        let filtered = priceCache[cacheKey].data;
        if (req.body.category) {
          filtered = filtered.filter((p: any) => p.category.toLowerCase().includes(req.body.category.toLowerCase()));
        }
        return res.json({ success: true, data: filtered, cached: true, stale: true });
      }

      res.json({ success: false, error: error.response?.data?.data?.message || error.message || 'Failed to fetch prices' });
    }
  });

  app.post("/api/digital/inquiry-pln", async (req, res) => {
    try {
      const { customer_no } = req.body;
      if (!customer_no) {
        return res.status(400).json({ success: false, error: 'Nomor pelanggan harus diisi' });
      }

      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + customer_no).digest('hex');

      console.log('Digiflazz PLN Inquiry Request:', { customer_no });

      const response = await axios.post('https://api.digiflazz.com/v1/inquiry-pln', {
        username: DIGIFLAZZ_USERNAME,
        customer_no: customer_no,
        sign: sign
      }, getDigiflazzAxiosConfig());

      const data = response.data.data;
      
      if (data && data.rc === '00') {
        res.json({ success: true, data: data });
      } else {
        const errorMsg = data?.message || 'Gagal melakukan inquiry PLN';
        console.error('Digiflazz PLN Inquiry Business Error:', data);
        res.json({ success: false, error: errorMsg });
      }
    } catch (error: any) {
      const errorData = error.response?.data?.data || error.response?.data || error.message;
      const errorMessage = typeof errorData === 'string' ? errorData : (errorData.message || JSON.stringify(errorData));
      
      console.error('Digiflazz PLN Inquiry Connection Error:', errorMessage);
      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  app.post("/api/digital/inquiry-pasca", async (req, res) => {
    try {
      const { customer_no, buyer_sku_code } = req.body;
      if (!customer_no || !buyer_sku_code) {
        return res.status(400).json({ success: false, error: 'Nomor pelanggan dan SKU harus diisi' });
      }

      const ref_id = `inq_${buyer_sku_code}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).digest('hex');

      console.log('Digiflazz Pasca Inquiry Request:', { customer_no, buyer_sku_code, ref_id });

      const response = await axios.post('https://api.digiflazz.com/v1/transaction', {
        commands: 'inq-pasca',
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: buyer_sku_code,
        customer_no: customer_no,
        ref_id: ref_id,
        sign: sign
      }, getDigiflazzAxiosConfig());

      const data = response.data.data;
      
      if (data && data.rc === '00') {
        res.json({ success: true, data: data });
      } else {
        const errorMsg = data?.message || 'Gagal melakukan inquiry tagihan';
        console.error('Digiflazz Pasca Inquiry Business Error:', data);
        res.json({ success: false, error: errorMsg });
      }
    } catch (error: any) {
      const errorData = error.response?.data?.data || error.response?.data || error.message;
      const errorMessage = typeof errorData === 'string' ? errorData : (errorData.message || JSON.stringify(errorData));
      
      console.error('Digiflazz Pasca Inquiry Connection Error:', errorMessage);
      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  app.post("/api/digital/inquiry-ewallet", async (req, res) => {
    try {
      const { customer_no, brand } = req.body;
      if (!customer_no || !brand) {
        return res.status(400).json({ success: false, error: 'Nomor pelanggan dan brand harus diisi' });
      }

      // Map brand to common check SKUs
      const brandLower = brand.toLowerCase();
      let sku = '';
      if (brandLower.includes('dana')) sku = 'CEKDANA';
      else if (brandLower.includes('ovo')) sku = 'CEKOVO';
      else if (brandLower.includes('gopay') || brandLower.includes('go-pay')) sku = 'CEKGOPAY';
      else if (brandLower.includes('shopee') || brandLower.includes('shopeepay')) sku = 'CEKSHOPEE';
      else if (brandLower.includes('linkaja')) sku = 'CEKLINKAJA';
      else {
        return res.status(400).json({ success: false, error: `Pengecekan nama untuk brand ${brand} belum didukung` });
      }

      const ref_id = `cek_${sku}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).digest('hex');

      console.log('Digiflazz E-Wallet Inquiry Request:', { customer_no, brand, sku, ref_id });

      const response = await axios.post('https://api.digiflazz.com/v1/transaction', {
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: sku,
        customer_no: customer_no,
        ref_id: ref_id,
        sign: sign
      }, getDigiflazzAxiosConfig());

      const data = response.data.data;
      
      if (data && (data.rc === '00' || data.status === 'Sukses')) {
        // Digiflazz usually returns the name in 'sn' or 'message'
        // Example SN: "A/N BUDI SANTOSO" or just "BUDI SANTOSO"
        let name = data.sn || data.message || 'Nama ditemukan';
        
        // Clean up common prefixes if needed
        if (name.toUpperCase().startsWith('A/N ')) {
          name = name.substring(4).trim();
        } else if (name.toUpperCase().startsWith('AN ')) {
          name = name.substring(3).trim();
        }

        res.json({ success: true, data: { name: name, raw: data } });
      } else {
        const errorMsg = data?.message || 'Gagal melakukan pengecekan e-wallet';
        console.error('Digiflazz E-Wallet Inquiry Business Error:', data);
        res.json({ success: false, error: errorMsg });
      }
    } catch (error: any) {
      const errorData = error.response?.data?.data || error.response?.data || error.message;
      const errorMessage = typeof errorData === 'string' ? errorData : (errorData.message || JSON.stringify(errorData));
      
      console.error('Digiflazz E-Wallet Inquiry Connection Error:', errorMessage);
      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  app.post("/api/digital/status-pasca", async (req, res) => {
    try {
      const { sku, customer_no, ref_id } = req.body;
      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).digest('hex');

      const response = await axios.post('https://api.digiflazz.com/v1/transaction', {
        commands: 'status-pasca',
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: sku,
        customer_no: customer_no,
        ref_id: ref_id,
        sign: sign
      }, getDigiflazzAxiosConfig());

      const data = response.data.data;
      if (data && (data.rc === '00' || data.status === 'Success')) {
        res.json({ success: true, data: data });
      } else {
        const errorMsg = data?.message || 'Gagal mengecek status pascabayar';
        res.json({ success: false, error: errorMsg });
      }
    } catch (error: any) {
      const errorData = error.response?.data?.data || error.response?.data || error.message;
      const errorMessage = typeof errorData === 'string' ? errorData : (errorData.message || JSON.stringify(errorData));
      
      console.error('Digiflazz Status Pasca Error:', errorMessage);
      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  app.post("/api/digital/inq-pasca", async (req, res) => {
    try {
      const { sku, customer_no, ref_id } = req.body;
      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).digest('hex');

      const response = await axios.post('https://api.digiflazz.com/v1/transaction', {
        commands: 'inq-pasca',
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: sku,
        customer_no: customer_no,
        ref_id: ref_id,
        sign: sign,
        testing: process.env.DIGIFLAZZ_TESTING === 'true'
      }, getDigiflazzAxiosConfig());

      const data = response.data.data;
      if (data && (data.rc === '00' || data.status === 'Sukses')) {
        res.json({ success: true, data: data });
      } else {
        const errorMsg = data?.message || 'Gagal melakukan cek tagihan pascabayar';
        res.json({ success: false, error: errorMsg });
      }
    } catch (error: any) {
      const errorData = error.response?.data?.data || error.response?.data || error.message;
      const errorMessage = typeof errorData === 'string' ? errorData : (errorData.message || JSON.stringify(errorData));
      
      console.error('Digiflazz Inq Pasca Error:', errorMessage);
      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  app.post("/api/digital/deposit", async (req, res) => {
    try {
      const { amount, bank, owner_name } = req.body;
      
      if (!amount || !bank || !owner_name) {
        return res.status(400).json({ success: false, error: 'Amount, bank, and owner_name are required' });
      }

      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "deposit").digest('hex');

      const response = await axios.post('https://api.digiflazz.com/v1/deposit', {
        username: DIGIFLAZZ_USERNAME,
        amount: parseInt(amount),
        Bank: bank,
        owner_name: owner_name,
        sign: sign
      }, getDigiflazzAxiosConfig());

      const data = response.data.data;
      if (data && data.rc === '00') {
        res.json({ success: true, data: data });
      } else {
        const errorMsg = data?.message || 'Gagal membuat tiket deposit';
        res.json({ success: false, error: errorMsg });
      }
    } catch (error: any) {
      const errorData = error.response?.data?.data || error.response?.data || error.message;
      const errorMessage = typeof errorData === 'string' ? errorData : (errorData.message || JSON.stringify(errorData));
      
      console.error('Digiflazz Deposit Error:', errorMessage);
      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  // 1.5 Cek Saldo Digiflazz (Test Endpoint)
  app.get("/api/digital/cek-saldo", async (req, res) => {
    try {
      if (isDefaultDigiflazz) {
        return res.status(400).json({ 
          success: false, 
          error: 'Digiflazz credentials not configured. Please set DIGIFLAZZ_USERNAME and DIGIFLAZZ_API_KEY in environment variables.',
          is_default: true
        });
      }

      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "depo").digest('hex');
      
      console.log('🔍 Cek Saldo Debug:', {
        username: DIGIFLAZZ_USERNAME,
        sign: sign,
        apiKeyLength: DIGIFLAZZ_API_KEY.length,
        apiKeyPrefix: DIGIFLAZZ_API_KEY.substring(0, 5) + '...'
      });

      const response = await axios.post('https://api.digiflazz.com/v1/cek-saldo', {
        cmd: 'deposit',
        username: DIGIFLAZZ_USERNAME,
        sign: sign
      }, getDigiflazzAxiosConfig());

      if (!response.data || !response.data.data) {
        console.error('❌ Digiflazz Cek Saldo Invalid Response:', response.data);
        return res.status(500).json({ 
          success: false, 
          error: 'Invalid response from Digiflazz',
          details: response.data
        });
      }

      if (response.data.data.rc && response.data.data.rc !== '00') {
        console.error('❌ Digiflazz Cek Saldo RC Error:', response.data.data);
        return res.status(400).json({ 
          success: false, 
          error: response.data.data.message || 'Digiflazz error',
          rc: response.data.data.rc
        });
      }

      res.json({ success: true, data: response.data.data });
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      const statusCode = error.response?.status || 500;
      
      console.error(`❌ Digiflazz Cek Saldo Error [${statusCode}]:`, {
        message: error.message,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });

      let userFriendlyError = typeof errorData === 'string' ? errorData : (errorData.message || error.message || 'Failed to fetch balance');
      
      // Digiflazz often returns "Signature Anda salah" if the IP is not whitelisted, even if the signature is correct.
      if (userFriendlyError.toLowerCase().includes('signature') || statusCode === 403 || statusCode === 401) {
        userFriendlyError = 'Akses Ditolak: Pastikan IP Address server (Cloud Run) sudah di-whitelist di Digiflazz ATAU gunakan FIXIE_URL yang valid. (Error asli: ' + userFriendlyError + ')';
      }

      res.status(statusCode).json({ 
        success: false, 
        error: userFriendlyError,
        details: errorData,
        tip: 'Digiflazz mewajibkan Whitelist IP. Jika deploy ke Cloud Run, IP akan berubah-ubah. Anda WAJIB menggunakan proxy statis (FIXIE_URL).'
      });
    }
  });

  // 2. Place Order to Digiflazz
  app.post("/api/digital/order", async (req, res) => {
    try {
      const { sku, customer_no, ref_id, is_postpaid } = req.body || {};
      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).digest('hex');

      const payload: any = {
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: sku,
        customer_no: customer_no,
        ref_id: ref_id,
        sign: sign,
        testing: process.env.DIGIFLAZZ_TESTING === 'true'
      };

      if (is_postpaid) {
        payload.commands = 'pay-pasca';
      }

      const response = await axios.post('https://api.digiflazz.com/v1/transaction', payload, getDigiflazzAxiosConfig());

      const data = response.data;
      res.json({ success: true, data: data.data });
    } catch (error: any) {
      const errData = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error('Digiflazz Order Error:', errData);
      res.status(500).json({ error: errData });
    }
  });

  // Admin: Approve Transaction (Manual QRIS)
  app.post('/api/admin/transactions/approve', async (req, res) => {
    try {
      const { transaction_id } = req.body;
      if (!transaction_id) return res.status(400).json({ error: 'Transaction ID is required' });

      // 1. Verify admin status
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split(' ')[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin only' });

      // 2. Get transaction details
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('id', transaction_id)
        .single();

      if (txError || !transaction) return res.status(404).json({ error: 'Transaction not found' });
      if (transaction.status === 'success') return res.status(400).json({ error: 'Transaction already successful' });

      // 3. Update transaction status
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'success' })
        .eq('id', transaction_id);

      if (updateError) throw updateError;

      // 4. Update seller balances
      const sellerUpdates: Record<string, number> = {};
      transaction.transaction_items.forEach((item: any) => {
        if (item.seller_id) {
          sellerUpdates[item.seller_id] = (sellerUpdates[item.seller_id] || 0) + (item.price * item.quantity);
        }
      });

      for (const [sellerId, amount] of Object.entries(sellerUpdates)) {
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', sellerId)
          .single();
        
        if (sellerProfile) {
          await supabase
            .from('profiles')
            .update({ balance: (sellerProfile.balance || 0) + amount })
            .eq('id', sellerId);
        }
      }

      // 5. Process digital items if any
      await processDigitalItems(transaction_id, transaction.transaction_items);

      // 6. Trigger Sariroti Email if applicable
      await triggerSarirotiEmail(transaction_id, transaction.buyer_name, transaction.total_amount);

      res.json({ success: true, message: 'Transaction approved and processed' });
    } catch (error: any) {
      console.error('Error approving transaction:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // 3. Digiflazz Webhook (Callback)
  app.post("/api/digital/callback", async (req: any, res) => {
    try {
      const callbackData = req.body;
      const hubSignature = req.header('X-Hub-Signature');
      const digiflazzEvent = req.header('X-Digiflazz-Event');
      const webhookSecret = process.env.DIGIFLAZZ_WEBHOOK_SECRET;

      console.log(`🔔 Digiflazz Webhook Received (Event: ${digiflazzEvent}):`, JSON.stringify(callbackData, null, 2));

      // Handle Ping Event
      if (digiflazzEvent === 'ping' || callbackData.data === 'ping') {
        return res.status(200).json({ success: true, message: 'pong' });
      }

      // Digiflazz sends data in 'data' object
      if (!callbackData.data || typeof callbackData.data !== 'object') {
        return res.status(400).json({ error: 'Invalid callback data' });
      }

      const { ref_id, status, sn } = callbackData.data;

      // Validate Signature from Digiflazz
      if (webhookSecret && hubSignature) {
        // Use rawBody for accurate HMAC generation
        const bodyString = req.rawBody || JSON.stringify(req.body);
        const expectedHubSignature = 'sha1=' + crypto.createHmac('sha1', webhookSecret).update(bodyString).digest('hex');
        
        if (hubSignature !== expectedHubSignature) {
          console.error('❌ Invalid X-Hub-Signature. Expected:', expectedHubSignature, 'Got:', hubSignature);
          return res.status(403).json({ error: 'Invalid signature' });
        }
      } else if (callbackData.data.signature) {
        // Fallback to old MD5 signature if X-Hub-Signature is not used/configured
        const signature = callbackData.data.signature;
        const expectedSignature = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).digest('hex');

        if (signature !== expectedSignature) {
          console.error('❌ Invalid Digiflazz Callback Signature. Expected:', expectedSignature, 'Got:', signature);
          return res.status(403).json({ error: 'Invalid signature' });
        }
      } else {
        console.warn('⚠️ Digiflazz Webhook received without signature validation. Ensure DIGIFLAZZ_WEBHOOK_SECRET is set.');
      }

      // Update transaction status in Supabase
      if (ref_id) {
        const { error } = await supabase
          .from('transaction_items')
          .update({ 
            status: status.toLowerCase() === 'sukses' ? 'delivered' : (status.toLowerCase() === 'gagal' ? 'failed' : 'processing'),
            metadata: { 
              ...callbackData.data, // Store full callback data for reference
              sn: sn,
              last_update: new Date().toISOString()
            }
          })
          .eq('transaction_id', ref_id)
          .contains('metadata', { is_digital: true });

        if (error) console.error('Error updating transaction item from Digiflazz callback:', error);
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Webhook Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Debug IPaymu Config
   */
  app.get('/api/payment/ipaymu/debug', (req, res) => {
    res.json({
      va: IPAYMU_VA,
      apiKeyLength: IPAYMU_API_KEY.length,
      production: IPAYMU_PRODUCTION,
      rawEnvProduction: process.env.IPAYMU_PRODUCTION
    });
  });

  /**
   * Create Redirect Payment (User diarahkan ke Ipaymu)
   * POST /api/payment/ipaymu/create
   */
  app.post('/api/payment/ipaymu/create', async (req, res) => {
    try {
      const { transaction_id, amount, buyer_name, buyer_email, buyer_phone, items = [] } = req.body;

      // Validation
      if (!buyer_name || !buyer_email || !buyer_phone || !amount || !transaction_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: buyer_name, buyer_email, buyer_phone, amount, transaction_id',
        });
      }

      if (!IPAYMU_VA || !IPAYMU_API_KEY) {
        return res.status(500).json({
          success: false,
          error: 'Ipaymu not configured. Set IPAYMU_VA and IPAYMU_API_KEY',
        });
      }

      const appUrl = process.env.APP_URL || 'https://spscorner.store';

      const paymentData: any = {
        product: [],
        qty: [],
        price: [],
        amount: Math.round(Number(amount)).toString(),
        returnUrl: `${appUrl}/kiosk/success?id=${transaction_id}`,
        cancelUrl: `${appUrl}/kiosk/cart?id=${transaction_id}`,
        notifyUrl: `${appUrl}/api/payment/ipaymu/callback`,
        referenceId: String(transaction_id),
        buyerName: buyer_name || 'Customer',
        buyerPhone: buyer_phone || ('08' + Math.floor(1000000000 + Math.random() * 9000000000).toString().substring(0, 10)),
        buyerEmail: buyer_email || `buyer${Date.now()}@spscorner.store`,
      };

      // Add items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        paymentData.product = items.map((i: any) => String(i.name || i.product_name));
        paymentData.qty = items.map((i: any) => String(i.quantity || 1));
        paymentData.price = items.map((i: any) => String(Math.round(Number(i.price))));
      } else {
        paymentData.product = ['Transaction'];
        paymentData.qty = ['1'];
        paymentData.price = [Math.round(Number(amount)).toString()];
      }

      console.log('📝 Payment Request:', { reference_id: transaction_id, amount, buyer_name });

      const response = await ipaymuClient.createPayment(paymentData as RedirectPaymentData);

      res.json({
        success: true,
        payment_url: response.Data?.Url,
        session_id: response.Data?.SessionId,
      });
    } catch (error: any) {
      console.error('❌ Payment Creation Error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * Manual Payment Verification
   * POST /api/payment/manual/verify
   */
  app.post('/api/payment/manual/verify', async (req, res) => {
    try {
      const { transaction_id, receipt_image, expected_amount } = req.body;

      if (!transaction_id || !receipt_image) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // Use Gemini Vision to verify the receipt
      const base64Data = receipt_image.replace(/^data:image\/\w+;base64,/, "");
      
      const prompt = `
        Tolong verifikasi bukti transfer ini.
        Nominal yang diharapkan adalah: Rp ${expected_amount}
        
        Apakah bukti transfer ini valid dan nominalnya sesuai dengan yang diharapkan?
        Jawab dengan format JSON:
        {
          "isValid": boolean,
          "amountFound": number,
          "reason": "Alasan singkat mengapa valid/tidak valid"
        }
      `;

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: receipt_image.match(/data:(image\/\w+);base64,/)?.[1] || 'image/jpeg'
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
        }
      });

      const resultText = geminiResponse.text();
      if (!resultText) {
        throw new Error('Gagal mendapatkan respons dari AI');
      }

      const verificationResult = JSON.parse(resultText);

      if (!verificationResult.isValid) {
        return res.status(400).json({ 
          success: false, 
          error: `Bukti transfer tidak valid: ${verificationResult.reason}` 
        });
      }
      
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'paid',
          payment_method: 'manual_qris',
          payment_details: {
            receipt_uploaded: true,
            verified_at: new Date().toISOString()
          }
        })
        .eq('id', transaction_id);

      if (updateError) throw updateError;

      // Process digital items if any
      await processDigitalItems(transaction_id);

      res.json({ success: true, message: 'Payment verified successfully' });

    } catch (error: any) {
      console.error('❌ Manual Verification Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Create Direct Payment (Pembayaran langsung)
   * POST /api/payment/ipaymu/direct
   */
  app.post('/api/payment/ipaymu/direct', async (req, res) => {
    try {
      const {
        transaction_id,
        amount,
        buyer_name,
        buyer_email,
        buyer_phone,
        payment_method = 'qris',
        payment_channel = 'qris',
      } = req.body || {};

      if (!buyer_name || !buyer_email || !buyer_phone || !amount || !transaction_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      if (!IPAYMU_VA || !IPAYMU_API_KEY) {
        return res.status(500).json({
          success: false,
          error: 'Ipaymu not configured',
        });
      }

      const appUrl = process.env.APP_URL || 'https://spscorner.store';

      let method = (payment_method || 'qris').toLowerCase();
      let channel = (payment_channel || 'qris').toLowerCase();
      
      // IPaymu requires paymentChannel to be 'mpm' if paymentMethod is 'qris'
      if (method === 'qris') {
        channel = 'mpm';
      }

      const directPaymentData: DirectPaymentData = {
        name: buyer_name || 'Customer',
        phone: buyer_phone || ('08' + Math.floor(1000000000 + Math.random() * 9000000000).toString().substring(0, 10)),
        email: buyer_email || `buyer${Date.now()}@spscorner.store`,
        amount: Math.round(Number(amount)).toString(),
        comments: `Payment for transaction ${transaction_id}`,
        notifyUrl: `${appUrl}/api/payment/ipaymu/callback`,
        referenceId: String(transaction_id),
        paymentMethod: method,
        paymentChannel: channel,
      };

      console.log('💳 Direct Payment:', { reference_id: transaction_id, payment_channel: channel });

      const response = await ipaymuClient.createDirectPayment(directPaymentData);

      res.json({
        success: true,
        data: response.Data,
        qr_code: response.Data?.QrCode,
      });
    } catch (error: any) {
      console.error('❌ Direct Payment Error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * Ipaymu Webhook Callback
   * POST /api/payment/ipaymu/callback
   */
  app.post('/api/payment/ipaymu/callback', async (req, res) => {
    try {
      const { status, reference_id, trx_id, sid, transaction_id } = req.body || {};

      console.log('🔔 Ipaymu Callback Received:', {
        status,
        reference_id,
        trx_id,
        sid,
        transaction_id,
        timestamp: new Date().toISOString(),
      });

      // IPaymu might send reference_id or transaction_id depending on the endpoint
      const refId = reference_id || transaction_id;

      if (!refId) {
        return res.status(400).json({ error: 'Missing reference_id' });
      }

      // Map Ipaymu status
      const txStatus =
        status === 'berhasil'
          ? 'paid'
          : status === 'gagal'
            ? 'failed'
            : 'processing';

      // Get transaction
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('id', refId)
        .single();

      if (fetchError) {
        console.error('Transaction not found:', refId);
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Update transaction
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: txStatus,
          metadata: {
            ...(transaction.metadata || {}),
            ipaymu_trx_id: trx_id || transaction_id,
            ipaymu_sid: sid,
            ipaymu_status: status,
            paid_at: txStatus === 'paid' ? new Date().toISOString() : null,
          }
        })
        .eq('id', refId);

      if (updateError) throw updateError;

      // Process if successful
      if (txStatus === 'paid' && transaction.transaction_items) {
        await processDigitalItems(refId, transaction.transaction_items);
        await triggerSarirotiEmail(refId, transaction.buyer_name, transaction.total_amount);
      }

      console.log('✅ Transaction Updated:', { reference_id: refId, txStatus });
      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Callback Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Check Payment Status
   * GET /api/payment/ipaymu/status/:reference_id
   */
  app.get('/api/payment/ipaymu/status/:reference_id', async (req, res) => {
    try {
      const { reference_id } = req.params;

      if (!IPAYMU_VA || !IPAYMU_API_KEY) {
        return res.status(500).json({
          success: false,
          error: 'Ipaymu not configured',
        });
      }

      const status = await ipaymuClient.getTransactionStatus(reference_id);

      res.json({ success: true, data: status });
    } catch (error: any) {
      console.error('❌ Status Check Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Get Payment Methods
   * GET /api/payment/ipaymu/methods
   */
  app.get('/api/payment/ipaymu/methods', async (req, res) => {
    try {
      if (!IPAYMU_VA || !IPAYMU_API_KEY) {
        return res.status(500).json({
          success: false,
          error: 'Ipaymu not configured',
        });
      }

      const methods = await ipaymuClient.getPaymentMethods();
      res.json({ success: true, data: methods });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/transactions/create", async (req, res) => {
    try {
      const { buyer_name, buyer_id, total_amount, items, payment_method, status, receipt_image } = req.body;

      // 1. Create transaction record
      const txDataToInsert: any = {
        buyer_name,
        total_amount,
        status: status || 'pending'
      };
      if (buyer_id) txDataToInsert.buyer_id = buyer_id;
      if (payment_method) txDataToInsert.payment_method = payment_method;
      if (receipt_image) txDataToInsert.receipt_image = receipt_image;

      const { data: txDataResult, error: txError } = await supabase
        .from('transactions')
        .insert(txDataToInsert)
        .select()
        .single();

      if (txError) throw txError;

      const tx = txDataResult;

      // 2. Create transaction items
      const txItems = items.map((item: any) => ({
        transaction_id: tx.id,
        product_id: item.is_digital ? null : item.id,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
        seller_id: item.is_digital ? null : item.seller_id,
        metadata: item.is_digital ? {
          is_digital: true,
          target_number: item.target_number,
          product_name: item.name,
          sku: item.sku,
          is_postpaid: item.metadata?.is_postpaid,
          customer_name: item.metadata?.customer_name,
          segment_power: item.metadata?.segment_power
        } : null
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(txItems);

      if (itemsError) throw itemsError;

      // Process digital items via Digiflazz if status is paid or success
      if (tx.status === 'paid' || tx.status === 'success') {
        const digitalItems = txItems.filter((item: any) => item.metadata?.is_digital);
        
        for (let i = 0; i < digitalItems.length; i++) {
          const item = digitalItems[i];
          const sku = item.metadata?.sku;
          const target = item.metadata?.target_number;
          const isPostpaid = item.metadata?.is_postpaid;
          const quantity = item.quantity || 1;
          
          if (sku && target) {
            for (let j = 0; j < quantity; j++) {
              const refId = (digitalItems.length === 1 && quantity === 1) 
                ? tx.id 
                : `${tx.id.substring(0, 30)}-${i}-${j}`;
              
              console.log(`Placing Digiflazz order for SKU: ${sku}, Target: ${target}, Ref: ${refId}`);
              
              const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + refId).digest('hex');
              
              const payload: any = {
                username: DIGIFLAZZ_USERNAME,
                buyer_sku_code: sku,
                customer_no: target,
                ref_id: refId,
                sign: sign,
                testing: process.env.DIGIFLAZZ_TESTING === 'true'
              };

              if (isPostpaid) {
                payload.commands = 'pay-pasca';
              }

              try {
                const digiResponse = await axios.post('https://api.digiflazz.com/v1/transaction', payload, getDigiflazzAxiosConfig());
                console.log('Digiflazz Order Response:', digiResponse.data);
              } catch (digiErr: any) {
                console.error('Digiflazz Order Error:', digiErr.response?.data ? JSON.stringify(digiErr.response.data) : digiErr.message);
              }
            }
          }
        }
      }

      // 3. Trigger Sariroti Email if status is paid or success
      if (tx.status === 'paid' || tx.status === 'success') {
        await triggerSarirotiEmail(tx.id, buyer_name, total_amount);
      }

      res.json({ success: true, transaction: tx });
    } catch (error: any) {
      console.error('Create transaction error:', error);
      res.status(500).json({ error: error.message || 'Failed to create transaction' });
    }
  });

  app.post("/api/transactions/pay", async (req, res) => {
    try {
      const { transaction_id } = req.body;

      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'paid' })
        .eq('id', transaction_id);

      if (updateError) throw updateError;

      // We need to fetch the transaction items to process digital items
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('id', transaction_id)
        .single();
        
      if (fetchError) throw fetchError;

      // Process digital items via Digiflazz
      await processDigitalItems(transaction_id, transaction.transaction_items);

      // Trigger Sariroti Email
      await triggerSarirotiEmail(transaction_id, transaction.buyer_name, transaction.total_amount);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Pay transaction error:', error);
      res.status(500).json({ error: error.message || 'Failed to update transaction' });
    }
  });

  // Admin: Test Email Sariroti
  app.post('/api/admin/test-email', async (req, res) => {
    try {
      const { to } = req.body;
      
      // Verify admin status
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
      const token = authHeader.split(' ')[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin only' });

      const targetEmail = to || 'Sales.Adm.bjm@sariroti.com';
      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0056b3;">Test Email Sariroti</h2>
          <p>Halo Admin,</p>
          <p>Ini adalah email percobaan untuk memastikan sistem notifikasi Sariroti berfungsi dengan baik.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Status:</strong> Aktif</p>
            <p><strong>Waktu:</strong> ${new Date().toLocaleString('id-ID')}</p>
            <p><strong>Target:</strong> ${targetEmail}</p>
          </div>
          <p>Jika Anda menerima email ini, berarti konfigurasi Gmail Nodemailer sudah benar.</p>
        </div>
      `;

      const result = await sendSarirotiEmailInternal(targetEmail, 'Test Email Sariroti - Berhasil', emailHtml);
      
      if (result.success) {
        res.json({ success: true, message: 'Test email sent successfully', data: result.data });
      } else {
        res.status(500).json({ 
          error: 'Failed to send test email', 
          details: result.error,
          tip: 'Pastikan GMAIL_USER dan GMAIL_APP_PASSWORD sudah benar di Environment Variables.'
        });
      }
    } catch (error: any) {
      console.error('Error in test-email endpoint:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (!process.env.VERCEL) {
    const PORT = 3000;
    (async () => {
      if (process.env.NODE_ENV !== "production") {
        const viteModule = "vite";
        const { createServer: createViteServer } = await import(viteModule);
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } else {
        app.use(express.static('dist'));
        app.get('*', (req, res) => {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.sendFile('dist/index.html', { root: '.' });
        });
      }

      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })();
  }

export default app;
