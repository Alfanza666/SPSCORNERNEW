import express from "express";
import dotenv from "dotenv";
import midtransClient from "midtrans-client";
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

// Initialize Midtrans Snap
const snap = new midtransClient.Snap({
  isProduction: process.env.VITE_MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'Mid-server-No9-Xc1Gg9IIAR2N932D0YS9',
  clientKey: process.env.VITE_MIDTRANS_CLIENT_KEY || 'Mid-client-oF_aGIBVFAqo0nd-'
});

// Digiflazz API Config
const DIGIFLAZZ_USERNAME = process.env.DIGIFLAZZ_USERNAME || 'lemicooBKLAD';
const DIGIFLAZZ_API_KEY = process.env.DIGIFLAZZ_API_KEY || '12434e87-6814-5ad0-8eab-2f2e3f511af9';
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

app.post("/api/digital/prices", async (req, res) => {
  try {
    const { category } = req.body;
    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "pricelist").toString();
    
    const response = await axios.post('https://api.digiflazz.com/v1/price-list', {
      cmd: 'prepaid',
      username: DIGIFLAZZ_USERNAME,
      sign: sign
    }, getDigiflazzAxiosConfig());

    const data = response.data;
    
    if (data.data) {
      let filtered = data.data;
      if (category) {
        filtered = data.data.filter((p: any) => p.category.toLowerCase().includes(category.toLowerCase()));
      }
      return res.json({ success: true, data: filtered });
    }
    
    res.status(500).json({ error: 'Failed to fetch prices from provider' });
  } catch (error: any) {
    console.error('Digiflazz Price Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.get("/api/digital/cek-saldo", async (req, res) => {
  try {
    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "depo").toString();
    
    const response = await axios.post('https://api.digiflazz.com/v1/cek-saldo', {
      cmd: 'deposit',
      username: DIGIFLAZZ_USERNAME,
      sign: sign
    }, getDigiflazzAxiosConfig());

    res.json({ success: true, data: response.data.data });
  } catch (error: any) {
    console.error('Digiflazz Cek Saldo Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post("/api/digital/order", async (req, res) => {
  try {
    const { sku, customer_no, ref_id } = req.body;
    const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id).toString();

    const response = await axios.post('https://api.digiflazz.com/v1/transaction', {
      username: DIGIFLAZZ_USERNAME,
      buyer_sku_code: sku,
      customer_no: customer_no,
      ref_id: ref_id,
      sign: sign
    }, getDigiflazzAxiosConfig());

    const data = response.data;
    res.json({ success: true, data: data.data });
  } catch (error: any) {
    console.error('Digiflazz Order Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post("/api/digital/callback", async (req, res) => {
  try {
    const callbackData = req.body;
    console.log('🔔 Digiflazz Callback Received:', callbackData);

    const { ref_id, status, sn, message } = callbackData.data;

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

app.post("/api/payment/notification", async (req, res) => {
  try {
    const notification = req.body;
    const statusResponse = await snap.transaction.notification(notification);
    
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    console.log(`Transaction notification received. Order ID: ${orderId}. Status: ${transactionStatus}. Fraud Status: ${fraudStatus}`);

    if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
      if (fraudStatus == 'accept') {
        const { data: transaction, error: updateError } = await supabase
          .from('transactions')
          .update({ status: 'paid' })
          .eq('id', orderId)
          .select('*, transaction_items(*)')
          .single();

        if (updateError) throw updateError;

        const digitalItems = transaction.transaction_items.filter((item: any) => item.metadata?.is_digital);
        
        for (const item of digitalItems) {
          const sku = item.metadata?.sku;
          const target = item.metadata?.target_number;
          
          if (sku && target) {
            console.log(`Placing Digiflazz order for SKU: ${sku}, Target: ${target}, Ref: ${orderId}`);
            
            const sign = CryptoJS.MD5(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + orderId).toString();
            
            const digiResponse = await axios.post('https://api.digiflazz.com/v1/transaction', {
              username: DIGIFLAZZ_USERNAME,
              buyer_sku_code: sku,
              customer_no: target,
              ref_id: orderId,
              sign: sign
            }, getDigiflazzAxiosConfig());
            
            const digiData = digiResponse.data;
            console.log('Digiflazz Order Response:', digiData);
          }
        }
      }
    } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', orderId);
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Midtrans Notification Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/payment/create", async (req, res) => {
  try {
    const { order_id, gross_amount, items, customer_details } = req.body;
    
    const parameter = {
      transaction_details: {
        order_id: order_id,
        gross_amount: Math.round(gross_amount)
      },
      item_details: items,
      customer_details: customer_details
    };

    const transaction = await snap.createTransaction(parameter);
    res.json({ token: transaction.token, redirect_url: transaction.redirect_url });
  } catch (error: any) {
    console.error('Midtrans error:', error);
    res.status(500).json({ error: error.message || 'Failed to create transaction' });
  }
});

app.post("/api/send-email", async (req, res) => {
  try {
    const { order_id, buyer_name, items, total_amount } = req.body;
    
    const isSariroti = (item: any) => {
      const cat = (item.category || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      return cat.includes('sariroti') || cat.includes('sari roti') || name.includes('sariroti') || name.includes('sari roti');
    };

    const hasSariroti = items.some(isSariroti);
    
    if (!hasSariroti) {
      return res.json({ success: true, message: "No Sariroti items, email skipped." });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const sarirotiItems = items.filter(isSariroti);
    
    if (!RESEND_API_KEY) {
      console.log("==========================================");
      console.log("📧 MOCK EMAIL SENT (RESEND_API_KEY not set)");
      console.log(`To: sales.admin@sariroti.com`);
      console.log(`Subject: Pesanan Baru Koperasi Sariroti - ${order_id}`);
      console.log(`Buyer: ${buyer_name}`);
      console.log(`Total: Rp ${total_amount}`);
      console.log("Items:", sarirotiItems.map((i:any) => `${i.name} (${i.quantity}x)`).join(', '));
      console.log("==========================================");
      return res.json({ success: true, message: "Mock email sent successfully (API key missing)" });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SPS Corner <noreply@spscorner.com>',
        to: ['sales.admin@sariroti.com'],
        subject: `Pesanan Baru Koperasi Sariroti - ${order_id}`,
        html: `
          <h2>Pesanan Baru Koperasi Sariroti</h2>
          <p><strong>Order ID:</strong> ${order_id}</p>
          <p><strong>Pemesan:</strong> ${buyer_name}</p>
          <p><strong>Total Pembayaran:</strong> Rp ${total_amount}</p>
          <h3>Detail Item Sariroti:</h3>
          <ul>
            ${sarirotiItems.map((i:any) => `<li>${i.name} - ${i.quantity}x</li>`).join('')}
          </ul>
        `
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send email via Resend');
    }

    res.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error('Email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

export default app;
