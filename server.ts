import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import midtransClient from "midtrans-client";

dotenv.config();

// Initialize Midtrans Snap
const snap = new midtransClient.Snap({
  isProduction: true, // Based on the keys provided
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'Mid-server-No9-Xc1Gg9IIAR2N932D0YS9',
  clientKey: process.env.VITE_MIDTRANS_CLIENT_KEY || 'Mid-client-oF_aGIBVFAqo0nd-'
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Midtrans Create Transaction Endpoint
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

  // Email Trigger Endpoint for Sariroti Purchases
  app.post("/api/send-email", async (req, res) => {
    try {
      const { order_id, buyer_name, items, total_amount } = req.body;
      
      const isSariroti = (item: any) => {
        const cat = (item.category || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        return cat.includes('sariroti') || cat.includes('sari roti') || name.includes('sariroti') || name.includes('sari roti');
      };

      // Check if there are any Sariroti items
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

      // If API key exists, send real email using Resend API
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'SPS Corner <noreply@spscorner.com>',
          to: ['sales.admin@sariroti.com'], // Ganti dengan email admin sales yang sebenarnya
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
}

startServer();
