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

  app.get("/api/debug-schema", async (req, res) => {
    const { data, error } = await supabase.rpc('get_schema_info'); // Wait, we can just select from information_schema
    const { data: cols } = await supabase.from('transaction_items').select('*').limit(1);
    res.json({ error: null, cols: cols ? Object.keys(cols[0] || {}) : [] });
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
  const IPAYMU_PRODUCTION = process.env.IPAYMU_PRODUCTION === 'true';

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
              status: 'failed',
              digiflazz_message: 'Digiflazz credentials not configured',
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

            const responseData = digiData.data || {};
            const rc = responseData.rc;
            const message = responseData.message || 'No message from Digiflazz';
            const sn = responseData.sn || '';

            // Map Digiflazz RC to item status
            let itemStatus = 'processing';
            if (rc === '00') {
              itemStatus = 'delivered';
            } else if (rc === '03') {
              itemStatus = 'processing'; // Still pending at Digiflazz
            } else {
              itemStatus = 'failed';
              allDigitalSuccess = false;
              console.error(`❌ Digiflazz Order Failed (RC ${rc}): ${message}`);
            }

            await supabase
              .from('transaction_items')
              .update({
                metadata: {
                  ...item.metadata,
                  status: itemStatus,
                  digiflazz_response: responseData,
                  digiflazz_rc: rc,
                  digiflazz_message: message,
                  sn: sn,
                  last_update: new Date().toISOString(),
                  ref_id: refId
                }
              })
              .eq('id', item.id);

          } catch (digiErr: any) {
            allDigitalSuccess = false;
            const errorDetail = digiErr.response?.data || digiErr.message;
            console.error('❌ Digiflazz Order Error:', typeof errorDetail === 'object' ? JSON.stringify(errorDetail, null, 2) : errorDetail);
            
            await supabase
              .from('transaction_items')
              .update({
                metadata: {
                  ...item.metadata,
                  status: 'failed',
                  digiflazz_error: errorDetail,
                  last_update: new Date().toISOString(),
                  ref_id: refId
                }
              })
              .eq('id', item.id);
          }
        }
      }
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

  // Helper to update seller balances (92% for seller, 8% platform fee)
  const updateSellerBalances = async (items: any[]) => {
    try {
      if (!items || items.length === 0) return;

      const sellerTotals: Record<string, { total: number }> = {};
      
      for (const item of items) {
        if (item.seller_id) {
          const itemTotal = (item.price || 0) * (item.quantity || 1);
          if (!sellerTotals[item.seller_id]) {
            sellerTotals[item.seller_id] = { total: 0 };
          }
          sellerTotals[item.seller_id].total += itemTotal;
        }
      }

      for (const [sellerId, data] of Object.entries(sellerTotals)) {
        const sellerShare = Math.round(data.total * 0.92);

        // Fetch current balance & sales
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance, total_sales')
          .eq('id', sellerId)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              balance: (profile.balance || 0) + sellerShare,
              total_sales: (profile.total_sales || 0) + data.total
            })
            .eq('id', sellerId);
        }
      }
      console.log('✅ Seller balances updated successfully');
    } catch (error) {
      console.error('❌ Error updating seller balances:', error);
    }
  };

  // Helper to trigger Sariroti email based on transaction
  const triggerSarirotiEmail = async (transactionId: string, buyerName: string, totalAmount: number) => {
    try {
      const { data: items, error } = await supabase
        .from('transaction_items')
        .select('*, products(name, category, price)')
        .eq('transaction_id', transactionId);

      if (error) throw error;

      // Filter only Sariroti/Koperasi items
      const sarirotiItems = items.filter((item: any) => {
        const name = (item.products?.name || item.metadata?.product_name || '').toLowerCase();
        const category = (item.products?.category || item.metadata?.category || '').toLowerCase();
        return name.includes('sariroti') || name.includes('roti') || name.includes('koperasi') ||
               category.includes('sariroti') || category.includes('roti') || category.includes('koperasi');
      });

      if (sarirotiItems.length === 0) {
        console.log(`ℹ️ No Sariroti items in transaction ${transactionId}. Skipping email.`);
        return;
      }

      const sarirotiSubtotal = sarirotiItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const orderDate = new Date().toLocaleString('id-ID', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });

      const itemRows = sarirotiItems.map((item: any) => {
        const name = item.products?.name || item.metadata?.product_name || 'Produk Koperasi';
        const qty = item.quantity || 1;
        const price = item.price || 0;
        const subtotal = price * qty;
        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${name}</td>
            <td style="padding: 12px 16px; text-align: center; color: #374151; font-weight: 600;">${qty}</td>
            <td style="padding: 12px 16px; text-align: right; color: #374151;">Rp ${price.toLocaleString('id-ID')}</td>
            <td style="padding: 12px 16px; text-align: right; color: #1d4ed8; font-weight: 700;">Rp ${subtotal.toLocaleString('id-ID')}</td>
          </tr>`;
      }).join('');

      let targetEmail = process.env.SARIROTI_ADMIN_EMAIL || 'Sales.Adm.bjm@sariroti.com';
      const appUrl = process.env.APP_URL || 'https://spscorner.store';
      const txShortId = transactionId.slice(0, 8).toUpperCase();

      const emailHtml = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Pesanan Roti Baru - SPS Corner</title></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 620px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%); padding: 32px 40px; text-align: center;">
      <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 50px; padding: 6px 20px; margin-bottom: 16px;">
        <span style="color: #bfdbfe; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Notifikasi Pesanan Baru</span>
      </div>
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Pesanan Roti Koperasi</h1>
      <p style="margin: 8px 0 0; color: #bfdbfe; font-size: 14px;">SPS Corner — Koperasi Karyawan</p>
    </div>

    <!-- Alert Banner -->
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 40px; display: flex; align-items: center; gap: 12px;">
      <div style="background: #3b82f6; border-radius: 50%; width: 8px; height: 8px; flex-shrink: 0;"></div>
      <p style="margin: 0; color: #1e40af; font-size: 13px; font-weight: 600;">Ada pesanan baru yang membutuhkan konfirmasi dari Anda sebagai Admin Sales Sariroti.</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px 40px;">
      
      <!-- Buyer Info -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px; font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Informasi Pemesan</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 40%;">Nama Pemesan</td>
            <td style="padding: 6px 0; color: #111827; font-size: 13px; font-weight: 700;">: ${buyerName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">ID Transaksi</td>
            <td style="padding: 6px 0; color: #1d4ed8; font-size: 13px; font-weight: 700; font-family: monospace;">: #${txShortId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Tanggal &amp; Waktu</td>
            <td style="padding: 6px 0; color: #111827; font-size: 13px; font-weight: 600;">: ${orderDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Status Pembayaran</td>
            <td style="padding: 6px 0;">
              <span style="background: #dcfce7; color: #16a34a; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">: Telah Dibayar</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Order Items -->
      <h2 style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Daftar Item Roti yang Dipesan</h2>
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Nama Produk</th>
              <th style="padding: 12px 16px; text-align: center; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase;">Qty</th>
              <th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase;">Harga</th>
              <th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr style="background: #eff6ff; border-top: 2px solid #bfdbfe;">
              <td colspan="3" style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #1e40af; text-align: right;">Total Pesanan Roti:</td>
              <td style="padding: 14px 16px; font-size: 16px; font-weight: 800; color: #1d4ed8; text-align: right;">Rp ${sarirotiSubtotal.toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Instructions -->
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
        <h3 style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #92400e;">📋 Langkah Selanjutnya untuk Admin Sales</h3>
        <ol style="margin: 0; padding-left: 20px; color: #78350f; font-size: 13px; line-height: 1.8;">
          <li>Login ke dashboard SPS Corner menggunakan akun Admin.</li>
          <li>Buka menu <strong>Riwayat Transaksi</strong> dan cari ID Transaksi: <strong>#${txShortId}</strong>.</li>
          <li>Klik <strong>Konfirmasi Pesanan Sariroti</strong> untuk menandai pesanan sebagai dikonfirmasi.</li>
          <li>Sistem akan otomatis mengirim <strong>nota pengambilan</strong> ke email pembeli.</li>
          <li>Lanjutkan proses pemesanan ke bagian produksi/distribusi sesuai prosedur.</li>
        </ol>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 8px;">
        <a href="${appUrl}/dashboard/admin/transactions" 
           style="display: inline-block; background: linear-gradient(135deg, #1e40af, #1d4ed8); color: #ffffff; padding: 14px 36px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.4);">
          🔗 Buka Dashboard &amp; Konfirmasi Pesanan
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">Email ini dikirim secara otomatis oleh sistem SPS Corner</p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Koperasi Karyawan SPS — Banjarmasin | <a href="${appUrl}" style="color: #3b82f6; text-decoration: none;">spscorner.store</a></p>
    </div>
  </div>
</body>
</html>`;

      const result = await sendSarirotiEmailInternal(targetEmail, `[SPS Corner] Pesanan Roti Baru #${txShortId} dari ${buyerName}`, emailHtml);
      if (result.success) {
        console.log(`✅ Sariroti email triggered for transaction ${transactionId}`);
      } else {
        console.error(`❌ Failed to send Sariroti email for transaction ${transactionId}:`, result.error);
      }
    } catch (err) {
      console.error('❌ Error triggering Sariroti email:', err);
    }
  };

  const sendBuyerReceiptEmail = async (transactionId: string, buyerEmail: string, buyerName: string, items: any[], totalAmount: number) => {
    try {
      const sarirotiItems = items.filter((item: any) => {
        const name = (item.products?.name || item.metadata?.product_name || '').toLowerCase();
        const category = (item.products?.category || item.metadata?.category || '').toLowerCase();
        return name.includes('sariroti') || name.includes('roti') || name.includes('koperasi') ||
               category.includes('sariroti') || category.includes('roti') || category.includes('koperasi');
      });

      if (sarirotiItems.length === 0) return;

      const itemsHtml = sarirotiItems.map((item: any) => {
        const name = item.products?.name || item.metadata?.product_name || 'Produk Koperasi';
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          </tr>
        `;
      }).join('');

      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0056b3; margin-bottom: 5px;">KOPERASI KARYAWAN</h2>
            <h4 style="color: #666; margin-top: 0;">SPS CORNER</h4>
            <h3 style="border-bottom: 2px dashed #ccc; padding-bottom: 10px;">NOTA PENGAMBILAN - SARIROTI</h3>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>ID Pesanan:</strong> #${transactionId.slice(0, 8)}</p>
            <p style="margin: 5px 0;"><strong>Nama Pemesan:</strong> ${buyerName}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Telah Dikonfirmasi</span></p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f1f1f1;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Produk</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; border: 1px solid #ffeeba; margin-top: 20px; font-size: 14px;">
            <p style="margin: 0;"><strong>PENTING:</strong> Gunakan nota ini untuk pengambilan roti di bagian Distribusi dan sebagai bukti pembelian pada saat pemeriksaan security.</p>
          </div>
          
          <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #999;">
            Terima kasih telah berbelanja di SPS Corner.
          </p>
        </div>
      `;

      const result = await sendSarirotiEmailInternal(buyerEmail, `Nota Pengambilan Sariroti - #${transactionId.slice(0, 8)}`, emailHtml);
      if (result.success) {
        console.log(`✅ Buyer receipt email sent to ${buyerEmail} for transaction ${transactionId}`);
      } else {
        console.error(`❌ Failed to send buyer receipt email for transaction ${transactionId}:`, result.error);
      }
    } catch (err) {
      console.error('❌ Error sending buyer receipt email:', err);
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
          filtered = filtered.filter((p: any) => p.category && p.category.toLowerCase().includes(category.toLowerCase()));
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
          filtered = data.data.filter((p: any) => p.category && p.category.toLowerCase().includes(category.toLowerCase()));
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
              filtered = filtered.filter((p: any) => p.category && p.category.toLowerCase().includes(category.toLowerCase()));
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
              filtered = filtered.filter((p: any) => p.category && p.category.toLowerCase().includes(category.toLowerCase()));
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
          filtered = filtered.filter((p: any) => p.category && p.category.toLowerCase().includes(req.body.category.toLowerCase()));
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

  app.post("/api/digital/check-status", async (req, res) => {
    try {
      const { transaction_item_id } = req.body;
      
      if (!transaction_item_id) {
        return res.status(400).json({ success: false, error: 'Missing transaction_item_id' });
      }

      // Fetch the transaction item
      const { data: item, error: fetchError } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('id', transaction_item_id)
        .single();

      if (fetchError || !item) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      // Robust fallback for refId, sku, and customerNo
      const refId = item.metadata?.ref_id || item.metadata?.digiflazz_response?.ref_id || item.transaction_id;
      const sku = item.metadata?.sku || item.metadata?.digiflazz_response?.buyer_sku_code;
      const customerNo = item.metadata?.target_number || item.metadata?.digiflazz_request?.customer_no || item.metadata?.digiflazz_response?.customer_no;

      if (!refId || !sku || !customerNo) {
        console.error('Incomplete metadata for checking status:', JSON.stringify(item.metadata, null, 2));
        return res.status(400).json({ success: false, error: 'Data produk digital tidak lengkap untuk mengecek status (hubungi admin sales)' });
      }

      const sign = crypto.createHash('md5').update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + refId).digest('hex');
      
      const payload: any = {
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: sku,
        customer_no: customerNo,
        ref_id: refId,
        sign: sign
      };

      if (item.metadata?.is_postpaid) {
        payload.commands = 'pay-pasca';
      }

      const digiResponse = await axios.post('https://api.digiflazz.com/v1/transaction', payload, getDigiflazzAxiosConfig());
      const digiData = digiResponse.data;

      const responseData = digiData.data || {};
      const rc = responseData.rc;
      const message = responseData.message || 'No message from Digiflazz';
      const sn = responseData.sn || '';

      // Map Digiflazz RC to item status
      let itemStatus = 'processing';
      if (rc === '00') {
        itemStatus = 'delivered';
      } else if (rc === '03') {
        itemStatus = 'processing';
      } else {
        itemStatus = 'failed';
      }

      // Update the database
      const { error: updateError } = await supabase
        .from('transaction_items')
        .update({
          metadata: {
            ...item.metadata,
            status: itemStatus,
            digiflazz_response: responseData,
            digiflazz_rc: rc,
            digiflazz_message: message,
            sn: sn || item.metadata?.sn, // preserve old SN if new SN is empty (though Digiflazz replaces it correctly)
            last_check: new Date().toISOString()
          }
        })
        .eq('id', transaction_item_id);

      if (updateError) {
        console.error('Error updating item based on manual check:', updateError);
      }

      res.json({ success: true, itemStatus, sn, message });
    } catch (error: any) {
      console.error('Check Status Error:', error);
      res.status(500).json({ success: false, error: error.message });
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

      let userFriendlyError = 'Failed to fetch balance';
      if (typeof errorData === 'string') {
        userFriendlyError = errorData;
      } else if (errorData?.data?.message) {
        userFriendlyError = errorData.data.message;
      } else if (errorData?.message) {
        userFriendlyError = errorData.message;
      } else if (error.message) {
        userFriendlyError = error.message;
      }
      
      // Digiflazz often returns "Signature Anda salah" if the IP is not whitelisted, even if the signature is correct.
      if (userFriendlyError.toLowerCase().includes('signature') || statusCode === 403 || statusCode === 401 || statusCode === 400) {
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

      // 4. Update seller balances AND total_sales
      await updateSellerBalances(transaction.transaction_items);

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

  // Admin: Confirm Sariroti Order
  app.post('/api/admin/transactions/confirm-sariroti', async (req, res) => {
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
        .select('*, transaction_items(*, products(*))')
        .eq('id', transaction_id)
        .single();

      if (txError || !transaction) return res.status(404).json({ error: 'Transaction not found' });

      // 3. Update transaction metadata to mark as confirmed
      const newMetadata = {
        ...(transaction.metadata || {}),
        sariroti_confirmed: true,
        sariroti_confirmed_at: new Date().toISOString(),
        sariroti_confirmed_by: user.id
      };

      const { error: updateError } = await supabase
        .from('transactions')
        .update({ metadata: newMetadata })
        .eq('id', transaction_id);

      if (updateError) throw updateError;

      // 4. Get buyer email
      let buyerEmail = null;
      if (transaction.buyer_id) {
        const { data: buyerAuth } = await supabase.auth.admin.getUserById(transaction.buyer_id);
        buyerEmail = buyerAuth?.user?.email;
      } else if (transaction.payment_details?.buyer_email) {
        buyerEmail = transaction.payment_details.buyer_email;
      }

      // 5. Send email to buyer
      if (buyerEmail) {
        await sendBuyerReceiptEmail(transaction_id, buyerEmail, transaction.buyer_name, transaction.transaction_items, transaction.total_amount);
      } else {
        console.log(`ℹ️ No buyer email found for transaction ${transaction_id}. Skipping buyer receipt email.`);
      }

      res.json({ success: true, message: 'Pesanan Sariroti berhasil dikonfirmasi' });
    } catch (error: any) {
      console.error('Error confirming Sariroti order:', error);
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
      const webhookId = process.env.DIGIFLAZZ_WEBHOOK_ID; // Optional: If user provides Webhook ID instead of Secret

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
      // Digiflazz uses HMAC SHA1 with the Secret key. If user provided Webhook ID, we'll try that too as a fallback.
      const secretToUse = webhookSecret || webhookId;
      
      if (secretToUse && hubSignature) {
        // Use rawBody for accurate HMAC generation
        const bodyString = req.rawBody || JSON.stringify(req.body);
        const expectedHubSignature = 'sha1=' + crypto.createHmac('sha1', secretToUse).update(bodyString).digest('hex');
        
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
        // First try to find by metadata->>ref_id
        const { data: itemsByRef, error: fetchError } = await supabase
          .from('transaction_items')
          .select('id, metadata')
          .contains('metadata', { ref_id: ref_id });

        if (itemsByRef && itemsByRef.length > 0) {
          for (const item of itemsByRef) {
            await supabase
              .from('transaction_items')
              .update({ 
                metadata: { 
                  ...item.metadata,
                  status: status.toLowerCase() === 'sukses' ? 'delivered' : (status.toLowerCase() === 'gagal' ? 'failed' : 'processing'),
                  ...callbackData.data, // Store full callback data for reference
                  sn: sn,
                  last_update: new Date().toISOString()
                }
              })
              .eq('id', item.id);
          }
        } else {
          // Fallback to transaction_id for backward compatibility
          const { data: itemsByTx, error: txFetchError } = await supabase
            .from('transaction_items')
            .select('id, metadata')
            .eq('transaction_id', ref_id)
            .contains('metadata', { is_digital: true });

          if (itemsByTx && itemsByTx.length > 0) {
            for (const item of itemsByTx) {
              await supabase
                .from('transaction_items')
                .update({ 
                  metadata: { 
                    ...item.metadata,
                    status: status.toLowerCase() === 'sukses' ? 'delivered' : (status.toLowerCase() === 'gagal' ? 'failed' : 'processing'),
                    ...callbackData.data,
                    sn: sn,
                    last_update: new Date().toISOString()
                  }
                })
                .eq('id', item.id);
            }
          }
        }
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

      // Clean up buyerName (remove numbers, special chars, ensure min length)
      let cleanName = (buyer_name || 'Customer').replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleanName.length < 3 || cleanName.toLowerCase().includes('test')) {
          cleanName = 'Pelanggan SPS Corner';
      }
      // Ensure name is at least 3 chars for iPaymu
      if (cleanName.length < 3) cleanName = "Pelanggan";

      const paymentData: any = {
        product: [],
        qty: [],
        price: [],
        amount: Math.round(Number(amount)).toString(),
        returnUrl: `${appUrl}/kiosk/success?id=${transaction_id}`,
        cancelUrl: `${appUrl}/kiosk/cart?id=${transaction_id}`,
        notifyUrl: `${appUrl}/api/payment/ipaymu/callback`,
        referenceId: String(transaction_id),
        buyerName: cleanName,
        buyerPhone: buyer_phone || ('0812' + Math.floor(10000000 + Math.random() * 90000000).toString()),
        buyerEmail: buyer_email || `${cleanName.replace(/\s+/g, '').toLowerCase().substring(0, 10)}${Math.floor(Math.random() * 1000)}@gmail.com`,
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
      
      // Upload receipt to Supabase Storage
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeType = receipt_image.match(/data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
      const fileExt = mimeType.split('/')[1] || 'jpg';
      const fileName = `receipts/${transaction_id}_${Date.now()}.${fileExt}`;
      
      let receiptUrl = receipt_image; // Fallback to base64 if upload fails
      try {
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, buffer, { contentType: mimeType });
          
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(fileName);
          receiptUrl = publicUrl;
        } else {
          console.error('Failed to upload receipt image:', uploadError);
        }
      } catch (uploadErr) {
        console.error('Exception uploading receipt image:', uploadErr);
      }

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

      const resultText = geminiResponse.text;
      if (!resultText) {
        throw new Error('Gagal mendapatkan respons dari AI');
      }

      const verificationResult = JSON.parse(resultText);

      // Fetch existing transaction to preserve payment_details (like buyer_email)
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('status, payment_details')
        .eq('id', transaction_id)
        .single();
      const existingPaymentDetails = existingTx?.payment_details || {};

      if (!verificationResult.isValid) {
        // Save the failed attempt
        await supabase
          .from('transactions')
          .update({
            receipt_image: receiptUrl,
            payment_details: {
              ...existingPaymentDetails,
              receipt_uploaded: true,
              verification_failed: true,
              reason: verificationResult.reason,
              attempted_at: new Date().toISOString()
            }
          })
          .eq('id', transaction_id);

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
          receipt_image: receiptUrl,
          payment_details: {
            ...existingPaymentDetails,
            receipt_uploaded: true,
            verified_at: new Date().toISOString()
          }
        })
        .eq('id', transaction_id);

      if (updateError) throw updateError;

      // Fetch transaction items for processing
      const { data: txData, error: txFetchError } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('id', transaction_id)
        .single();

      if (!txFetchError && txData && txData.transaction_items) {
        // Update seller balances
        if (existingTx && existingTx.status !== 'paid' && existingTx.status !== 'success') {
          await updateSellerBalances(txData.transaction_items);
        }
        // Process digital items if any
        await processDigitalItems(transaction_id, txData.transaction_items);
        // Trigger Sariroti Email
        await triggerSarirotiEmail(transaction_id, txData.buyer_name, txData.total_amount);
      }

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

      // Clean up buyerName (remove numbers, special chars, ensure min length)
      let cleanName = (buyer_name || 'Customer').replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleanName.length < 3 || cleanName.toLowerCase().includes('test')) {
          cleanName = 'Pelanggan SPS Corner';
      }
      // Ensure name is at least 3 chars for iPaymu
      if (cleanName.length < 3) cleanName = "Pelanggan";

      const directPaymentData: DirectPaymentData = {
        name: cleanName,
        phone: buyer_phone || ('0812' + Math.floor(10000000 + Math.random() * 90000000).toString()),
        email: buyer_email || `${cleanName.replace(/\s+/g, '').toLowerCase().substring(0, 10)}${Math.floor(Math.random() * 1000)}@gmail.com`,
        amount: Math.round(Number(amount)),
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
          payment_details: {
            ...(transaction.payment_details || {}),
            ipaymu_trx_id: trx_id || transaction_id,
            ipaymu_sid: sid,
            ipaymu_status: status,
            paid_at: txStatus === 'paid' ? new Date().toISOString() : null,
          }
        })
        .eq('id', refId);

      if (updateError) throw updateError;

      // Process if successful and ONLY IF IT WAS NOT ALREADY SUCCESSFUL
      if (txStatus === 'paid' && transaction.status !== 'paid' && transaction.status !== 'success' && transaction.transaction_items) {
        await updateSellerBalances(transaction.transaction_items);
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
      const { buyer_name, buyer_id, buyer_email, total_amount, items, payment_method, status, receipt_image } = req.body;

      // 1. Create transaction record
      const txDataToInsert: any = {
        buyer_name,
        total_amount,
        status: status || 'pending'
      };
      if (buyer_id) txDataToInsert.buyer_id = buyer_id;
      if (payment_method) txDataToInsert.payment_method = payment_method;
      if (receipt_image) txDataToInsert.receipt_image = receipt_image;
      if (buyer_email) txDataToInsert.payment_details = { buyer_email };

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
          status: 'processing',
          target_number: item.target_number,
          product_name: item.name,
          sku: item.sku,
          is_postpaid: item.metadata?.is_postpaid,
          customer_name: item.metadata?.customer_name,
          segment_power: item.metadata?.segment_power
        } : null
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('transaction_items')
        .insert(txItems)
        .select();

      if (itemsError) throw itemsError;

      // Process digital items via Digiflazz if status is paid or success
      if (tx.status === 'paid' || tx.status === 'success') {
        if (insertedItems && insertedItems.length > 0) {
          await processDigitalItems(tx.id, insertedItems);
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

  // Cancel pending transaction
  app.post("/api/transactions/cancel", async (req, res) => {
    try {
      const { transaction_id } = req.body;
      const { data: tx, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transaction_id)
        .single();
        
      if (fetchError || !tx) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (tx.status !== 'pending' && tx.status !== 'failed') {
        return res.status(400).json({ error: 'Hanya pesanan pending yang dapat dibatalkan.' });
      }

      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction_id);

      if (deleteError) throw deleteError;

      res.json({ success: true, message: 'Pesanan berhasil dibatalkan.' });
    } catch (error: any) {
      console.error('Cancel Order Error:', error);
      res.status(500).json({ error: error.message });
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

      let targetEmail = to || process.env.SARIROTI_ADMIN_EMAIL || 'Sales.Adm.bjm@sariroti.com';
      
      if (!to) {
        try {
          const { data: settingsData } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'contact_info_content')
            .single();
            
          if (settingsData && settingsData.value) {
            const contactInfo = typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value;
            if (contactInfo.email) {
              targetEmail = contactInfo.email;
            }
          }
        } catch (e) {
          console.error('Failed to fetch contact info from settings for test email', e);
        }
      }
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
