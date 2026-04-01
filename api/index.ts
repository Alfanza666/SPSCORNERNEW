import express from "express";
import dotenv from "dotenv";
import CryptoJS from "crypto-js";
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Initialize Supabase Client
const envUrl = process.env.VITE_SUPABASE_URL;
const supabaseUrl = typeof envUrl === 'string' && envUrl.startsWith('http') ? envUrl : 'https://jofwebrbdlovwkgklwab.supabase.co';

const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceKey = typeof envKey === 'string' && envKey.trim() !== '' ? envKey : 'sb_publishable_n4yagUnGhlpqiEBDwtzhwg_Sfvy8F8v';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Digiflazz API Config
const DIGIFLAZZ_USERNAME = (process.env.DIGIFLAZZ_USERNAME || 'lemicooBKLAD').trim();
const DIGIFLAZZ_API_KEY = (process.env.DIGIFLAZZ_API_KEY || '12434e87-6814-5ad0-8eab-2f2e3f511af9').trim();
const FIXIE_URL = process.env.FIXIE_URL;

const getDigiflazzAxiosConfig = () => {
  const config: any = {};
  if (FIXIE_URL) {
    config.httpsAgent = new HttpsProxyAgent(FIXIE_URL);
    config.proxy = false;
  }
  return config;
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: "vercel" });
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

  // IPaymu API Config
  const IPAYMU_VA = (process.env.IPAYMU_VA || '').trim();
  const IPAYMU_API_KEY = (process.env.IPAYMU_API_KEY || '').trim();
  const IPAYMU_URL = process.env.IPAYMU_PRODUCTION === 'true' 
    ? 'https://my.ipaymu.com/api/v2/payment' 
    : 'https://sandbox.ipaymu.com/api/v2/payment';

  // Internal helper to send Sariroti email
  const sendSarirotiEmailInternal = async (order_id: string, buyer_name: string, items: any[], total_amount: number) => {
    const isSariroti = (item: any) => {
      const cat = (item.category || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      // Only include items that are explicitly Sariroti/Bread related
      return cat.includes('sariroti') || cat.includes('sari roti') || 
             name.includes('sariroti') || name.includes('sari roti') ||
             cat === 'roti' || cat === 'koperasi';
    };

    const sarirotiItems = items.filter(isSariroti);
    
    // CRITICAL: If no Sariroti items, do NOT send email (Kantin & Digital excluded)
    if (sarirotiItems.length === 0) {
      return { success: true, message: "No Sariroti items, email skipped." };
    }

    // Calculate subtotal for Sariroti items only
    const sarirotiSubtotal = sarirotiItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.log("==========================================");
      console.log("📧 MOCK EMAIL SENT (RESEND_API_KEY not set)");
      console.log(`To: Sales.Adm.bjm@sariroti.com`);
      console.log(`Subject: Pesanan Baru Koperasi Sariroti - ${order_id}`);
      console.log(`Buyer: ${buyer_name}`);
      console.log(`Sariroti Subtotal: Rp ${sarirotiSubtotal}`);
      console.log("Items:", sarirotiItems.map((i:any) => `${i.name} (${i.quantity}x)`).join(', '));
      console.log("==========================================");
      return { success: true, message: "Mock email sent successfully (API key missing)" };
    }

    try {
      const response = await axios.post('https://api.resend.com/emails', {
        from: 'SPS Corner <noreply@spscorner.com>',
        to: ['Sales.Adm.bjm@sariroti.com'],
        subject: `Pesanan Baru Koperasi Sariroti - ${order_id}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px;">Pesanan Baru Koperasi Sariroti</h2>
            <p>Halo Tim Sales Sariroti,</p>
            <p>Terdapat pesanan baru dari SPS Corner dengan detail sebagai berikut:</p>
            
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${order_id}</p>
              <p style="margin: 5px 0;"><strong>Pemesan:</strong> ${buyer_name}</p>
              <p style="margin: 5px 0; color: #1d4ed8; font-size: 18px;"><strong>Total Tagihan Sariroti:</strong> Rp ${sarirotiSubtotal.toLocaleString('id-ID')}</p>
            </div>

            <h3 style="font-size: 16px; color: #374151;">Daftar Item:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f3f4f6; text-align: left;">
                  <th style="padding: 10px; border: 1px solid #e5e7eb;">Produk</th>
                  <th style="padding: 10px; border: 1px solid #e5e7eb;">Qty</th>
                  <th style="padding: 10px; border: 1px solid #e5e7eb;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${sarirotiItems.map((i:any) => `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${i.name}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${i.quantity}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">Rp ${(i.price * i.quantity).toLocaleString('id-ID')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <p style="margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center;">
              Email ini dikirim secara otomatis oleh sistem SPS Corner.
            </p>
          </div>
        `
      }, {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, message: "Email sent successfully", data: response.data };
    } catch (error: any) {
      console.error('Resend API Error:', error.response?.data || error.message);
      throw new Error(`Failed to send email via Resend: ${error.response?.data?.message || error.message}`);
    }
  };

  // Helper to trigger Sariroti email
  const triggerSarirotiEmail = async (transactionId: string, buyerName: string, totalAmount: number) => {
    try {
      // Fetch full item details including product names/categories for email
      const { data: fullItems } = await supabase
        .from('transaction_items')
        .select('*, products(name, category)')
        .eq('transaction_id', transactionId);

      if (fullItems && fullItems.length > 0) {
        const formattedItems = fullItems.map((item: any) => ({
          name: item.products?.name || item.metadata?.product_name || 'Unknown Item',
          category: item.products?.category || '',
          quantity: item.quantity,
          price: item.price
        }));

        await sendSarirotiEmailInternal(transactionId, buyerName, formattedItems, totalAmount);
      }
    } catch (emailErr) {
      console.error('Failed to trigger Sariroti email:', emailErr);
    }
  };

  // Helper to process digital items via Digiflazz
  const processDigitalItems = async (transactionId: string, transactionItems: any[]) => {
    const digitalItems = transactionItems.filter((item: any) => item.metadata?.is_digital);
    let allDigitalSuccess = true;

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
            : `${transactionId.substring(0, 30)}-${i}-${j}`;

          console.log(`Placing Digiflazz order for SKU: ${sku}, Target: ${target}, Ref: ${refId}`);
          
          const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + refId).toString();
          
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
            console.log('Digiflazz Order Response:', digiData);

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
              console.error(`Digiflazz Order Failed: ${digiData.data.message}`);
            }
          } catch (digiErr: any) {
            allDigitalSuccess = false;
            console.error('Digiflazz Order Error:', digiErr.response?.data || digiErr.message);
            
            await supabase
              .from('transaction_items')
              .update({
                metadata: {
                  ...item.metadata,
                  digiflazz_error: digiErr.response?.data || digiErr.message
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

// Simple in-memory cache for Digiflazz prices
const priceCache: {
  [key: string]: {
    data: any;
    timestamp: number;
  }
} = {};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Background fetcher to keep cache warm
const updateDigiflazzCache = async () => {
  try {
    console.log('Running background Digiflazz price update...');
    const types = ['prepaid', 'postpaid'];
    for (const type of types) {
      const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "pricelist").toString();
      const response = await axios.post('https://api.digiflazz.com/v1/price-list', {
        cmd: type === 'postpaid' ? 'pasca' : 'prepaid',
        username: DIGIFLAZZ_USERNAME,
        sign: sign
      }, getDigiflazzAxiosConfig());

      if (response.data?.data && Array.isArray(response.data.data)) {
        priceCache[type] = {
          data: response.data.data,
          timestamp: Date.now()
        };
        console.log(`Successfully updated ${type} price cache in background.`);
      }
      // Small delay between requests to avoid immediate rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error: any) {
    console.error('Background Digiflazz update failed:', error.message);
  }
};

// Run immediately and then every 1 hour
setTimeout(updateDigiflazzCache, 5000);
setInterval(updateDigiflazzCache, CACHE_TTL);

// Helper function to generate mock products when rate limited
const generateMockProducts = (category: string, type: string) => {
  const brands = category.toLowerCase().includes('pulsa') ? ['Telkomsel', 'Indosat', 'XL', 'Tri'] : 
                 category.toLowerCase().includes('data') ? ['Telkomsel', 'Indosat', 'XL'] :
                 category.toLowerCase().includes('e-money') ? ['GoPay', 'OVO', 'Dana', 'ShopeePay'] :
                 category.toLowerCase().includes('games') ? ['Free Fire', 'Mobile Legends', 'PUBG'] :
                 category.toLowerCase().includes('pln') ? ['PLN'] : [category];
                 
  const products = [];
  for (const brand of brands) {
    for (const amount of [10000, 20000, 50000, 100000]) {
      products.push({
        product_name: `${brand} ${amount.toLocaleString('id-ID')}`,
        category: category,
        brand: brand,
        type: type,
        seller_name: 'Mock Seller',
        price: amount,
        buyer_sku_code: `MOCK_${brand.toUpperCase().replace(/\s/g, '')}_${amount}`,
        buyer_product_status: true,
        seller_product_status: true,
        unlimited_stock: true,
        stock: 100,
        multi: true,
        start_cut_off: '00:00',
        end_cut_off: '00:00',
        desc: 'Mock product (Digiflazz rate limit reached)'
      });
    }
  }
  return products;
};

app.post("/api/digital/prices", async (req, res) => {
  try {
    const { category, type = 'prepaid' } = req.body;
    const cacheKey = `${type}`;

    // Check cache first
    if (priceCache[cacheKey] && (Date.now() - priceCache[cacheKey].timestamp < CACHE_TTL)) {
      let filtered = priceCache[cacheKey].data;
      if (category) {
        filtered = filtered.filter((p: any) => p.category.toLowerCase().includes(category.toLowerCase()));
      }
      return res.json({ success: true, data: filtered, cached: true });
    }

    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "pricelist").toString();
    
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
          // Provide mock data if no cache is available to prevent blocking development
          console.log(`Rate limited and no cache available. Serving MOCK data for ${category || type}`);
          const mockData = generateMockProducts(category || 'Umum', type);
          return res.json({ success: true, data: mockData, mock: true });
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
          // Provide mock data if no cache is available to prevent blocking development
          console.log(`Rate limited and no cache available. Serving MOCK data for ${category || type}`);
          const mockData = generateMockProducts(category || 'Umum', type);
          return res.json({ success: true, data: mockData, mock: true });
        }
      }

      return res.json({ success: false, error: data.message || 'Failed to fetch prices' });
    }
    
    res.json({ success: false, error: 'Invalid response from provider' });
  } catch (error: any) {
    console.error('Digiflazz Price Error:', error.response?.data || error.message);
    
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

    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + customer_no).toString();

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
    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).toString();

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
    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).toString();

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

app.get("/api/digital/cek-saldo", async (req, res) => {
  try {
    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "depo").toString();
    
    console.log(`Digiflazz Cek Saldo Request: Username=${DIGIFLAZZ_USERNAME}, SignGenerated=${sign.substring(0, 5)}...`);

    const response = await axios.post('https://api.digiflazz.com/v1/cek-saldo', {
      cmd: 'deposit',
      username: DIGIFLAZZ_USERNAME,
      sign: sign
    }, getDigiflazzAxiosConfig());

    const data = response.data.data;
    if (data && data.rc === '00') {
      res.json({ success: true, data: data });
    } else {
      const errorMsg = data?.message || 'Gagal mengecek saldo';
      res.json({ success: false, error: errorMsg });
    }
  } catch (error: any) {
    const errorData = error.response?.data?.data || error.response?.data || error.message;
    const errorMessage = typeof errorData === 'string' ? errorData : (errorData.message || JSON.stringify(errorData));
    
    console.error('Digiflazz Cek Saldo Error:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

app.post("/api/digital/order", async (req, res) => {
  try {
    const { sku, customer_no, ref_id, is_postpaid } = req.body;
    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).toString();

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
    console.error('Digiflazz Order Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
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

      // 6. Trigger Email for Sariroti items if any
      await triggerSarirotiEmail(transaction_id, transaction.buyer_name, transaction.total_amount);

      res.json({ success: true, message: 'Transaction approved and processed' });
    } catch (error: any) {
      console.error('Error approving transaction:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

app.post("/api/digital/callback", async (req, res) => {
  try {
    const callbackData = req.body;
    const hubSignature = req.header('X-Hub-Signature');
    const webhookSecret = process.env.DIGIFLAZZ_WEBHOOK_SECRET;

    console.log('🔔 Digiflazz Callback Received:', JSON.stringify(callbackData, null, 2));

    if (!callbackData.data) {
      return res.status(400).json({ error: 'Invalid callback data' });
    }

    const { ref_id, status, sn } = callbackData.data;

    // Validate Signature from Digiflazz
    if (webhookSecret && hubSignature) {
      // The documentation says X-Hub-Signature is HMAC SHA1 of the body
      const bodyString = JSON.stringify(req.body);
      const expectedHubSignature = 'sha1=' + CryptoJS.HmacSHA1(bodyString, webhookSecret).toString();
      
      if (hubSignature !== expectedHubSignature) {
        console.error('❌ Invalid X-Hub-Signature. Expected:', expectedHubSignature, 'Got:', hubSignature);
        // return res.status(401).json({ error: 'Invalid hub signature' });
      }
    } else {
      // Fallback to MD5 signature validation if secret is not provided
      const signature = callbackData.data.signature;
      const expectedSignature = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).toString();

      if (signature !== expectedSignature) {
        console.error('❌ Invalid Digiflazz Callback Signature. Expected:', expectedSignature, 'Got:', signature);
      }
    }

    if (ref_id) {
      const { error } = await supabase
        .from('transaction_items')
        .update({ 
          status: status.toLowerCase() === 'sukses' ? 'delivered' : (status.toLowerCase() === 'gagal' ? 'failed' : 'processing'),
          metadata: { 
            ...callbackData.data,
            sn: sn,
            last_update: new Date().toISOString()
          }
        })
        .eq('transaction_id', ref_id)
        .contains('metadata', { is_digital: true });

      if (error) console.error('Error updating transaction item from Digiflazz callback:', error);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/payment/ipaymu/create", async (req, res) => {
  try {
    const { transaction_id, amount, buyer_name, buyer_email, buyer_phone, items } = req.body;

    if (!IPAYMU_VA || !IPAYMU_API_KEY) {
      throw new Error("IPaymu credentials not configured");
    }

    const body = {
      name: buyer_name || 'Customer',
      email: buyer_email || 'customer@example.com',
      phone: buyer_phone || '08123456789',
      amount: amount,
      notifyUrl: `${process.env.APP_URL}/api/payment/ipaymu/callback`,
      returnUrl: `${process.env.APP_URL}/kiosk/success?id=${transaction_id}`,
      cancelUrl: `${process.env.APP_URL}/kiosk/cart?id=${transaction_id}`,
      referenceId: transaction_id,
      product: items.map((i: any) => i.name),
      qty: items.map((i: any) => i.quantity),
      price: items.map((i: any) => i.price),
    };

    const bodyHash = CryptoJS.SHA256(JSON.stringify(body)).toString(CryptoJS.enc.Hex).toLowerCase();
    const stringToSign = `POST:${IPAYMU_VA}:${bodyHash}:${IPAYMU_API_KEY}`;
    const signature = CryptoJS.HmacSHA256(stringToSign, IPAYMU_API_KEY).toString(CryptoJS.enc.Hex);
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

    const response = await axios.post(IPAYMU_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'va': IPAYMU_VA,
        'signature': signature,
        'timestamp': timestamp
      }
    });

    if (response.data && response.data.Status === 200) {
      res.json({ 
        success: true, 
        payment_url: response.data.Data.Url,
        session_id: response.data.Data.SessionId
      });
    } else {
      console.error('IPaymu Error Response:', response.data);
      throw new Error(response.data.Message || "Failed to create IPaymu payment");
    }
  } catch (error: any) {
    console.error('IPaymu Create Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/payment/ipaymu/callback", async (req, res) => {
  try {
    const { status, reference_id, trx_id, sid } = req.body;
    console.log('🔔 IPaymu Callback Received:', JSON.stringify(req.body, null, 2));

    if (status === 'berhasil') {
      // 1. Update transaction status
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'paid',
          metadata: { 
            ipaymu_trx_id: trx_id,
            ipaymu_sid: sid,
            paid_at: new Date().toISOString()
          }
        })
          .eq('id', reference_id);

      if (updateError) throw updateError;

      // 2. Fetch transaction items to process digital items
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('id', reference_id)
        .single();
        
      if (fetchError) throw fetchError;

      // 3. Process digital items
      await processDigitalItems(reference_id, transaction.transaction_items);

      // 4. Trigger Email for Sariroti items if any
      await triggerSarirotiEmail(reference_id, transaction.buyer_name, transaction.total_amount);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('IPaymu Callback Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/transactions/create", async (req, res) => {
  try {
    const { buyer_name, buyer_id, total_amount, items, payment_method, status, receipt_image } = req.body;

    // 1. Create transaction record
    const txData: any = {
      buyer_name,
      total_amount,
      status: status || 'pending'
    };
    if (buyer_id) txData.buyer_id = buyer_id;
    if (payment_method) txData.payment_method = payment_method;
    if (receipt_image) txData.receipt_image = receipt_image;

    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert(txData)
      .select()
      .single();

    if (txError) throw txError;

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
    if (txData.status === 'paid' || txData.status === 'success') {
      await processDigitalItems(tx.id, txItems);
      
      // Trigger Email for Sariroti items if any
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

    // Trigger Email for Sariroti items if any
    await triggerSarirotiEmail(transaction_id, transaction.buyer_name, transaction.total_amount);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Pay transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
});

app.post("/api/admin/test-email", async (req, res) => {
  try {
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

    // 2. Send test email
    const result = await sendSarirotiEmailInternal(
      "TEST-123",
      "Admin Tester",
      [
        { name: "Sari Roti Tawar", quantity: 2, price: 15000, category: "Sariroti" },
        { name: "Sari Roti Cokelat", quantity: 1, price: 8000, category: "Sariroti" }
      ],
      38000
    );

    res.json(result);
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send test email' });
  }
});

app.post("/api/send-email", async (req, res) => {
  try {
    const { order_id, buyer_name, items, total_amount } = req.body;
    const result = await sendSarirotiEmailInternal(order_id, buyer_name, items, total_amount);
    res.json(result);
  } catch (error: any) {
    console.error('Email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

export default app;
