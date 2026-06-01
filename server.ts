// @ts-nocheck
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", { value, configurable: true });
import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import nodemailer from "nodemailer";
import webpush from "web-push";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import { IpaymuClient } from "./src/services/ipaymu/client.js";
import { requireAuth, requireRole } from "./src/middleware/auth.js";
import { registerWithdrawalRoutes } from "./src/routes/withdrawals.js";
import { registerStockRoutes } from "./src/routes/stock.js";
import { registerProductReturnRoutes } from "./src/routes/productReturns.js";
dotenv.config();

try {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
} catch (e) {
  console.warn("Sentry init failed:", e);
}
const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
  throw new Error("VITE_SUPABASE_URL is not set or invalid");
}
const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceKey =
  typeof envKey === "string" && envKey.trim() !== ""
    ? envKey
    : (() => { throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set"); })();
const supabase = createClient(supabaseUrl, supabaseServiceKey);
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();

// Sentry request handler (must be first middleware)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(
  express.json({
    limit: "50mb",
    verify: __name((req, res, buf) => {
      req.rawBody = buf.toString();
    }, "verify"),
  }),
);
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled karena CSP di-handle Vercel headers
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting — cegah spam/brute force
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 10, // max 10 request pembayaran per menit per IP
  message: { error: 'Terlalu banyak request pembayaran. Coba lagi dalam 1 menit.' },
  standardHeaders: true,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
});
// Terapkan rate limiter ke endpoint sensitif
app.use('/api/payment', paymentLimiter);
app.use('/api/auth', authLimiter);

// Auth middleware — attach user to req for protected routes
app.use('/api/admin', requireAuth(supabase), requireRole(supabase, 'admin', 'superadmin'));
app.use('/api/withdrawals', requireAuth(supabase));
app.use('/api/stock-requests', requireAuth(supabase));
app.use('/api/product-returns', requireAuth(supabase));

try {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:test@test.com",
    process.env.VITE_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
} catch (e) {
  console.warn("VAPID details not configured properly", e);
}

app.post("/api/push/subscribe", async (req, res) => {
  const { user_id, subscription } = req.body;
  if (!user_id || !subscription) return res.status(400).json({ error: "Data tidak lengkap" });

  try {
    // Upsert: use endpoint as unique key to avoid duplicates
    const endpoint = subscription?.endpoint;
    if (endpoint) {
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .eq("subscription->endpoint", endpoint)
        .maybeSingle();

      if (!existing) {
        await supabase.from("push_subscriptions").insert({ user_id, subscription });
      }
    } else {
      await supabase.from("push_subscriptions").insert({ user_id, subscription });
    }
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Push subscribe error:", error);
    res.status(500).json({ error: "Gagal menyimpan langganan" });
  }
});

app.post("/api/push/unsubscribe", async (req, res) => {
  const { user_id, endpoint } = req.body;
  if (!user_id || !endpoint) return res.status(400).json({ error: "Data tidak lengkap" });

  try {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user_id)
      .eq("subscription->endpoint", endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    res.status(500).json({ error: "Gagal berhenti langganan" });
  }
});

// ─── Helper: send push notification to all subscriptions of a user ────────────
async function sendPushToUser(userId, title, body, url = "/", tag = "sps-notif") {
  try {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) return;

    const payload = JSON.stringify({ title, body, url, tag });
    const results = await Promise.allSettled(
      subs.map((row) => webpush.sendNotification(row.subscription, payload, { urgency: 'high' }))
    );

    // Clean up expired/invalid subscriptions
    results.forEach(async (result, idx) => {
      if (result.status === "rejected") {
        const statusCode = result.reason?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired — remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userId)
            .eq("subscription->endpoint", subs[idx].subscription?.endpoint);
        }
      }
    });
  } catch (e) {
    console.error("sendPushToUser error:", e);
  }
}

// ─── Helper: send push to all admins ─────────────────────────────────────────
async function sendPushToAdmins(title, body, url = "/dashboard/admin") {
  try {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "superadmin"]);

    if (!admins) return;
    await Promise.all(admins.map((a) => sendPushToUser(a.id, title, body, url)));
  } catch (e) {
    console.error("sendPushToAdmins error:", e);
  }
}

// ─── Helper: restore stock for a cancelled/failed transaction ───────────────
async function restoreTransactionStock(transactionId) {
  try {
    // Only restore if stock was actually deducted for this transaction
    const { data: tx } = await supabase
      .from("transactions")
      .select("metadata")
      .eq("id", transactionId)
      .single();

    if (!tx?.metadata?.stock_deducted) {
      console.log(`[Stock] Skipping restore for ${transactionId.slice(0,8)} — stock was not deducted`);
      return;
    }

    if (tx?.metadata?.stock_restored) {
      console.log(`[Stock] Skipping restore for ${transactionId.slice(0,8)} — stock already restored`);
      return;
    }

    const { data: items } = await supabase
      .from("transaction_items")
      .select("product_id, quantity, seller_id")
      .eq("transaction_id", transactionId);

    if (!items || items.length === 0) return;

    for (const item of items) {
      if (!item.product_id) continue;

      const { data: product } = await supabase
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .single();

      if (product) {
        await supabase
          .from("products")
          .update({ stock: product.stock + item.quantity })
          .eq("id", item.product_id);

        // Log adjustment if we have a valid user
        if (item.seller_id) {
          await supabase.from("stock_adjustments").insert({
            product_id: item.product_id,
            user_id: item.seller_id,
            previous_stock: product.stock,
            new_stock: product.stock + item.quantity,
            adjustment_type: "correction",
            notes: `Stock restored — transaction ${transactionId} cancelled/failed`,
          });
        }
      }
    }

    // Mark as restored in metadata to prevent double-restore
    await supabase
      .from("transactions")
      .update({
        metadata: { ...(tx.metadata || {}), stock_restored: true },
      })
      .eq("id", transactionId);
  } catch (e) {
    console.error(`restoreTransactionStock error for ${transactionId}:`, e);
  }
}

// ─── Insert notification helper (with specific path) ─────────────────────────
async function createNotification(userId, type, title, message, path = "/") {
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      message,
      path,
      is_read: false
    });
    // Also send push
    await sendPushToUser(userId, title, message, path);
  } catch (e) {
    console.error("createNotification error:", e);
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/config/public", (req, res) => {
  res.json({
    VITE_VAPID_PUBLIC_KEY: process.env.VITE_VAPID_PUBLIC_KEY || "",
    VAPID_SUBJECT: process.env.VAPID_SUBJECT || "",
  });
});

async function getAdminIds() {
  const { data: admins } = await supabase.from("profiles").select("id").in("role", ["admin", "superadmin"]);
  return (admins || []).map(a => a.id);
}

function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  return authHeader.split(" ")[1];
}

async function resolveUser(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// --- Route modules (registered above via registerWithdrawalRoutes, registerStockRoutes, registerProductReturnRoutes) ---

if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug-schema", async (req, res) => {
    const { data, error } = await supabase.rpc("get_schema_info");
    const { data: cols } = await supabase.from("transaction_items").select("*").limit(1);
    res.json({ error: null, cols: cols ? Object.keys(cols[0] || {}) : [] });
  });
  app.get("/api/debug/ip", async (req, res) => {
    try {
      const response = await axios.get("https://ifconfig.me/ip");
      const ip = response.data.trim();
      let proxyIp = null;
      if (FIXIE_URL) {
        try {
          const proxyResponse = await axios.get("https://ifconfig.me/ip", getDigiflazzAxiosConfig());
          proxyIp = proxyResponse.data.trim();
        } catch (e) { proxyIp = "Error fetching proxy IP"; }
      }
      res.json({ outbound_ip: ip, proxy_ip: proxyIp, using_proxy: !!FIXIE_URL });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch outbound IP" });
    }
  });
}
const DIGIFLAZZ_USERNAME = (process.env.DIGIFLAZZ_USERNAME || "")
  .replace(/['"]/g, "")
  .trim();
const DIGIFLAZZ_API_KEY = (process.env.DIGIFLAZZ_API_KEY || "")
  .replace(/['"]/g, "")
  .trim();
const isDefaultDigiflazz = !DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY;
console.log("\u{1F527} Digiflazz Config:", {
  username: DIGIFLAZZ_USERNAME,
  apiKeySet: !!process.env.DIGIFLAZZ_API_KEY,
  isDefault: isDefaultDigiflazz,
});
const FIXIE_URL =
  process.env.FIXIE_URL &&
  !process.env.FIXIE_URL.includes("YOUR_FIXIE_PROXY_URL")
    ? process.env.FIXIE_URL
    : null;
const getDigiflazzAxiosConfig = __name(() => {
  const config = {};
  if (FIXIE_URL) {
    try {
      config.httpsAgent = new HttpsProxyAgent(FIXIE_URL);
      config.proxy = false;
    } catch (error) {
      console.error(
        "\u274C Invalid FIXIE_URL provided. Proxy will not be used.",
        error,
      );
    }
  }
  return config;
}, "getDigiflazzAxiosConfig");
const getIpaymuAxiosConfig = __name(() => {
  const config = {};
  if (FIXIE_URL) {
    try {
      config.httpsAgent = new HttpsProxyAgent(FIXIE_URL);
      config.proxy = false;
      console.log("[iPaymu] Routing via Fixie static IP - OK");
    } catch (e) {
      console.error("[iPaymu] Invalid FIXIE_URL:", e.message);
    }
  } else {
    console.warn("[iPaymu] No Fixie proxy - ensure server IP is whitelisted in iPaymu dashboard.");
  }
  return config;
}, "getIpaymuAxiosConfig");
const IPAYMU_VA = (process.env.IPAYMU_VA || "").replace(/['"]/g, "").trim();
const IPAYMU_API_KEY = (process.env.IPAYMU_API_KEY || "")
  .replace(/['"]/g, "").trim();
const IPAYMU_PRODUCTION = process.env.IPAYMU_PRODUCTION !== "false";
if (!IPAYMU_VA || !IPAYMU_API_KEY) {
  console.warn("\u26A0\uFE0F IPAYMU_VA or IPAYMU_API_KEY not configured");
}
const ipaymuClient = new IpaymuClient(
  IPAYMU_VA,
  IPAYMU_API_KEY,
  IPAYMU_PRODUCTION,
  getIpaymuAxiosConfig(),
);
console.log("\u{1F4B3} Ipaymu Config:", {
  va: IPAYMU_VA ? "\u2713 Set" : "\u2717 Not Set",
  apiKey: IPAYMU_API_KEY ? "\u2713 Set" : "\u2717 Not Set",
  production: IPAYMU_PRODUCTION,
  baseUrl: IPAYMU_PRODUCTION
    ? "https://my.ipaymu.com"
    : "https://sandbox.ipaymu.com",
});
const sendNotification = __name(async (userId, payload) => {
  try {
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        path: payload.path || "/",
        is_read: false,
      });

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);

    if (subs && subs.length > 0) {
      const pushPayload = JSON.stringify({
        title: payload.title,
        body: payload.message,
        url: payload.path || "/",
        tag: `sps-${payload.type || 'notif'}`,
      });

      const pushPromises = subs.map((sub, idx) =>
        webpush.sendNotification(sub.subscription, pushPayload, { urgency: 'high' }).catch((err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            supabase
              .from("push_subscriptions")
              .delete()
              .eq("user_id", userId)
              .eq("subscription->endpoint", subs[idx].subscription?.endpoint)
              .then(() => {});
          }
        })
      );
      await Promise.all(pushPromises);
    }
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
}, "sendNotification");

// Register modular route groups
registerWithdrawalRoutes(app, { supabase, sendNotification, getAdminIds, getUserId, resolveUser });
registerStockRoutes(app, { supabase, sendNotification, getAdminIds, getUserId, resolveUser });
registerProductReturnRoutes(app, { supabase, sendNotification, getAdminIds, getUserId, resolveUser });

const processDigitalItems = __name(async (transactionId, transactionItems) => {
  const digitalItems = transactionItems.filter(
    (item) => item.metadata?.is_digital,
  );
  let allDigitalSuccess = true;
  if (digitalItems.length > 0 && (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY)) {
    console.error(
      "\u274C Digiflazz credentials not configured. Cannot process digital items.",
    );
    for (const item of digitalItems) {
      await supabase
        .from("transaction_items")
        .update({
          metadata: {
            ...item.metadata,
            status: "failed",
            digiflazz_message: "Digiflazz credentials not configured",
            digiflazz_error: "Digiflazz credentials not configured",
          },
        })
        .eq("id", item.id);
    }
    await supabase
      .from("transactions")
      .update({ status: "failed" })
      .eq("id", transactionId);
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
        const refId =
          digitalItems.length === 1 && quantity === 1
            ? transactionId
            : `${transactionId.substring(0, 25)}-${i}-${j}`;
        console.log(
          `Placing Digiflazz order for SKU: ${sku}, Target: ${target}, Ref: ${refId}`,
        );
        const sign = crypto
          .createHash("md5")
          .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + refId)
          .digest("hex");
        const payload = {
          username: DIGIFLAZZ_USERNAME,
          buyer_sku_code: sku,
          customer_no: target,
          ref_id: refId,
          sign,
          testing: process.env.DIGIFLAZZ_TESTING === "true",
        };
        if (isPostpaid) {
          payload.commands = "pay-pasca";
        }
        try {
          const digiResponse = await axios.post(
            "https://api.digiflazz.com/v1/transaction",
            payload,
            getDigiflazzAxiosConfig(),
          );
          const digiData = digiResponse.data;
          console.log(
            "Digiflazz Order Response:",
            JSON.stringify(digiData, null, 2),
          );
          const responseData = digiData.data || {};
          const rc = responseData.rc;
          const message = responseData.message || "No message from Digiflazz";
          const sn = responseData.sn || "";
          let itemStatus = "processing";
          if (rc === "00") {
            itemStatus = "delivered";
          } else if (rc === "03") {
            itemStatus = "processing";
          } else {
            itemStatus = "failed";
            allDigitalSuccess = false;
            console.error(
              `\u274C Digiflazz Order Failed (RC ${rc}): ${message}`,
            );
          }
          await supabase
            .from("transaction_items")
            .update({
              metadata: {
                ...item.metadata,
                status: itemStatus,
                digiflazz_response: responseData,
                digiflazz_rc: rc,
                digiflazz_message: message,
                sn,
                last_update: new Date().toISOString(),
                ref_id: refId,
              },
            })
            .eq("id", item.id);
          const txForNotif = await supabase
            .from("transactions")
            .select("buyer_id")
            .eq("id", transactionId)
            .single();
          if (txForNotif.data?.buyer_id) {
            if (itemStatus === "delivered") {
              await sendNotification(txForNotif.data.buyer_id, {
                type: "transaction",
                title: "\u{1F4E6} Produk Digital Terkirim!",
                message: `${item.metadata?.product_name || "Produk digital"} Anda untuk nomor ${item.metadata?.target_number} berhasil terkirim.`,
                path: `/kiosk/history?id=${transactionId}`,
              });
            } else if (itemStatus === "failed") {
              await sendNotification(txForNotif.data.buyer_id, {
                type: "transaction",
                title: "\u26A0\uFE0F Pengiriman Produk Gagal",
                message: `Pengiriman ${item.metadata?.product_name || "produk digital"} gagal (RC: ${rc}). Dana akan dikembalikan.`,
                path: `/kiosk/history?id=${transactionId}`,
              });
            }
          }
        } catch (digiErr) {
          allDigitalSuccess = false;
          const errorDetail = digiErr.response?.data || digiErr.message;
          console.error(
            "\u274C Digiflazz Order Error:",
            typeof errorDetail === "object"
              ? JSON.stringify(errorDetail, null, 2)
              : errorDetail,
          );
          await supabase
            .from("transaction_items")
            .update({
              metadata: {
                ...item.metadata,
                status: "failed",
                digiflazz_error: errorDetail,
                last_update: new Date().toISOString(),
                ref_id: refId,
              },
            })
            .eq("id", item.id);
        }
      }
    }
  }
  return allDigitalSuccess;
}, "processDigitalItems");
const sendSarirotiEmailInternal = __name(async (to, subject, html) => {
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error("\u26A0\uFE0F GMAIL_USER or GMAIL_APP_PASSWORD not set.");
    return {
      success: false,
      error:
        "GMAIL_USER atau GMAIL_APP_PASSWORD belum diatur di Environment Variables.",
    };
  }
  try {
    console.log(`\u{1F4E7} Attempting to send email to ${to} via Gmail...`);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      connectionTimeout: 5e3,
      greetingTimeout: 5e3,
      socketTimeout: 5e3,
    });
    const info = await transporter.sendMail({
      from: `"SPS Corner" <${GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log("\u2705 Email sent successfully:", info.messageId);
    return { success: true, data: info };
  } catch (error) {
    console.error("\u274C Error sending email via Gmail:", error);
    return { success: false, error: error.message || "Unknown email error" };
  }
}, "sendSarirotiEmailInternal");
const updateSellerBalances = __name(async (items) => {
  try {
    if (!items || items.length === 0) return;
    const sellerTotals = {};
    for (const item of items) {
      if (item.seller_id) {
        // Use subtotal (which is net) if fee was already deducted, else calculate net
        const isNetAlready = item.metadata && item.metadata.fee_deducted !== undefined;
        const itemGross = (item.price || 0) * (item.quantity || 1);
        const itemNet = isNetAlready ? (item.subtotal || 0) : Math.round(itemGross * 0.92);
        const itemFee = itemGross - itemNet;

        if (!sellerTotals[item.seller_id]) {
          sellerTotals[item.seller_id] = { net: 0, gross: 0, fee: 0 };
        }
        sellerTotals[item.seller_id].net += itemNet;
        sellerTotals[item.seller_id].gross += itemGross;
        sellerTotals[item.seller_id].fee += itemFee;
      }
    }
    for (const [sellerId, data] of Object.entries(sellerTotals)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance, total_sales, total_fee_paid")
        .eq("id", sellerId)
        .single();
      if (profile) {
        await supabase
          .from("profiles")
          .update({
            balance: (profile.balance || 0) + data.net,
            total_sales: (profile.total_sales || 0) + data.gross,
            total_fee_paid: (profile.total_fee_paid || 0) + data.fee,
          })
          .eq("id", sellerId);
      }
    }
    console.log("\u2705 Seller balances updated successfully");
  } catch (error) {
    console.error("\u274C Error updating seller balances:", error);
  }
}, "updateSellerBalances");

const checkLowStockAndNotify = __name(async (items) => {
  try {
    if (!items || items.length === 0) return;
    for (const item of items) {
      if (item.metadata?.is_digital) continue;
      
      const productId = item.product_id || item.products?.id;
      if (!productId) continue;
      
      const { data: product } = await supabase
        .from('products')
        .select('name, stock, seller_id, profiles(name)')
        .eq('id', productId)
        .single();
        
      if (product && product.stock < 5) {
        const { data: userAuth } = await supabase.auth.admin.getUserById(product.seller_id);
        const sellerEmail = userAuth?.user?.email;
        if (sellerEmail) {
          const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #ef4444;">Peringatan Stok Menipis</h2>
              <p>Halo ${product.profiles?.name || 'Penjual'},</p>
              <p>Produk <strong>${product.name}</strong> Anda di SPS Corner memiliki sisa stok yang sedikit.</p>
              <p style="font-size: 20px; font-weight: bold; color: #ef4444;">Sisa stok: ${product.stock}</p>
              <p>Silakan lakukan restok melalui dashboard penjual untuk memastikan ketersediaan barang.</p>
            </div>
          `;
          await sendSarirotiEmailInternal(
            sellerEmail,
            `[SPS Corner] Peringatan: Stok ${product.name} Menipis`,
            emailHtml
          );
          console.log(`\u2705 Low stock warning email sent to ${sellerEmail} for product ${product.name}`);
        }
      }
    }
  } catch (error) {
    console.error("\u274C Error checking low stock:", error);
  }
}, "checkLowStockAndNotify");

const updateBuyerPoints = __name(async (transaction_id, buyer_id, total_amount) => {
  try {
    if (!buyer_id) return;
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "loyalty_enabled")
      .single();
    if (setting?.value !== "true") return;
    const earnedPoints = Math.floor((total_amount || 0) * 0.01);
    if (earnedPoints <= 0) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("loyalty_points")
      .eq("id", buyer_id)
      .single();
    if (profile) {
      await supabase
        .from("profiles")
        .update({
          loyalty_points: (profile.loyalty_points || 0) + earnedPoints,
        })
        .eq("id", buyer_id);
      console.log(`\u2705 Buyer points updated successfully for ${buyer_id}: +${earnedPoints} pts`);
    }
  } catch (error) {
    console.error("\u274C Error updating buyer points:", error);
  }
}, "updateBuyerPoints");
const triggerSarirotiEmail = __name(
  async (transactionId, buyerName, totalAmount) => {
    try {
      const { data: items, error } = await supabase
        .from("transaction_items")
        .select("*, products(name, category, price)")
        .eq("transaction_id", transactionId);
      if (error) throw error;
      const sarirotiItems = items.filter((item) => {
        const name = (
          item.products?.name ||
          item.metadata?.product_name ||
          ""
        ).toLowerCase();
        const category = (
          item.products?.category ||
          item.metadata?.category ||
          ""
        ).toLowerCase();
        return (
          name.includes("sariroti") ||
          name.includes("roti") ||
          name.includes("koperasi") ||
          category.includes("sariroti") ||
          category.includes("roti") ||
          category.includes("koperasi")
        );
      });
      if (sarirotiItems.length === 0) {
        console.log(
          `\u2139\uFE0F No Sariroti items in transaction ${transactionId}. Skipping email.`,
        );
        return;
      }
      const sarirotiSubtotal = sarirotiItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const orderDate = new Date().toLocaleString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const itemRows = sarirotiItems
        .map((item) => {
          const name =
            item.products?.name ||
            item.metadata?.product_name ||
            "Produk Koperasi";
          const qty = item.quantity || 1;
          const price = item.price || 0;
          const subtotal = price * qty;
          return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 16px; color: #111827; font-weight: 500;">${name}</td>
            <td style="padding: 12px 16px; text-align: center; color: #374151; font-weight: 600;">${qty}</td>
            <td style="padding: 12px 16px; text-align: right; color: #374151;">Rp ${price.toLocaleString("id-ID")}</td>
            <td style="padding: 12px 16px; text-align: right; color: #1d4ed8; font-weight: 700;">Rp ${subtotal.toLocaleString("id-ID")}</td>
          </tr>`;
        })
        .join("");
      let targetEmail =
        process.env.SARIROTI_ADMIN_EMAIL || "Sales.Adm.bjm@sariroti.com";
      const appUrl = process.env.APP_URL || "https://spscorner.store";
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
      <p style="margin: 8px 0 0; color: #bfdbfe; font-size: 14px;">SPS Corner \u2014 Koperasi Karyawan</p>
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
              <td style="padding: 14px 16px; font-size: 16px; font-weight: 800; color: #1d4ed8; text-align: right;">Rp ${sarirotiSubtotal.toLocaleString("id-ID")}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Instructions -->
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
        <h3 style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #92400e;">\u{1F4CB} Langkah Selanjutnya untuk Admin Sales</h3>
        <ol style="margin: 0; padding-left: 20px; color: #78350f; font-size: 13px; line-height: 1.8;">
          <li>Login ke dashboard SPS Corner menggunakan akun Anda.</li>
          <li>Buka menu <strong>Pesanan Masuk</strong> dan cari ID Transaksi: <strong>#${txShortId}</strong>.</li>
          <li>Klik <strong>Konfirmasi</strong> untuk menandai pesanan sebagai dikonfirmasi.</li>
          <li>Sistem akan otomatis mengirim <strong>nota pengambilan</strong> ke email pembeli.</li>
          <li>Lanjutkan proses pemesanan ke bagian produksi/distribusi sesuai prosedur.</li>
        </ol>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 8px;">
        <a href="${appUrl}/dashboard/seller/transactions?id=${transactionId}" 
           style="display: inline-block; background: linear-gradient(135deg, #1e40af, #1d4ed8); color: #ffffff; padding: 14px 36px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.4);">
          \u{1F517} Buka Dashboard &amp; Konfirmasi Pesanan
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">Email ini dikirim secara otomatis oleh sistem SPS Corner</p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Koperasi Karyawan SPS \u2014 Banjarmasin | <a href="${appUrl}" style="color: #3b82f6; text-decoration: none;">spscorner.store</a></p>
    </div>
  </div>
</body>
</html>`;
      const result = await sendSarirotiEmailInternal(
        targetEmail,
        `[SPS Corner] Pesanan Roti Baru #${txShortId} dari ${buyerName}`,
        emailHtml,
      );
      if (result.success) {
        console.log(
          `\u2705 Sariroti email triggered for transaction ${transactionId}`,
        );
      } else {
        console.error(
          `\u274C Failed to send Sariroti email for transaction ${transactionId}:`,
          result.error,
        );
      }
    } catch (err) {
      console.error("\u274C Error triggering Sariroti email:", err);
    }
  },
  "triggerSarirotiEmail",
);
const sendBuyerReceiptEmail = __name(
  async (transactionId, buyerEmail, buyerName, items, totalAmount) => {
    try {
      const sarirotiItems = items.filter((item) => {
        const name = (
          item.products?.name ||
          item.metadata?.product_name ||
          ""
        ).toLowerCase();
        const category = (
          item.products?.category ||
          item.metadata?.category ||
          ""
        ).toLowerCase();
        return (
          name.includes("sariroti") ||
          name.includes("roti") ||
          name.includes("koperasi") ||
          category.includes("sariroti") ||
          category.includes("roti") ||
          category.includes("koperasi")
        );
      });
      if (sarirotiItems.length === 0) return;
      const itemsHtml = sarirotiItems
        .map((item) => {
          const name =
            item.products?.name ||
            item.metadata?.product_name ||
            "Produk Koperasi";
          const price = item.price || 0;
          const subtotal = price * (item.quantity || 1);
          return `
          <tr>
            <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">
              <strong>${name}</strong>
            </td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 14px;">${item.quantity}</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #4b5563; font-size: 14px;">Rp ${price.toLocaleString("id-ID")}</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-weight: bold; font-size: 14px;">Rp ${subtotal.toLocaleString("id-ID")}</td>
          </tr>
        `;
        })
        .join("");
        
      const currentDate = new Date().toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      const currentTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit'
      });

      const emailHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 40px 0; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            
            <!-- Header -->
            <div style="background-color: #1e3a8a; padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">KOPERASI KARYAWAN</h1>
              <h2 style="margin: 5px 0 0; font-size: 14px; font-weight: 400; opacity: 0.9; letter-spacing: 2px;">SPS CORNER</h2>
            </div>
            
            <!-- Body -->
            <div style="padding: 30px;">
              <h3 style="color: #111827; font-size: 18px; font-weight: 600; margin-top: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">E-Receipt / Nota Pengambilan</h3>
              
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Halo <strong>${buyerName}</strong>,</p>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Terima kasih atas pembelian Anda. Pesanan Anda telah <strong>LUNAS</strong> dan dikonfirmasi oleh Admin. Berikut adalah rincian pesanan Anda:</p>
              
              <!-- Details Box -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <table style="width: 100%; font-size: 14px;">
                  <tr>
                    <td style="padding-bottom: 8px; color: #6b7280; width: 40%;">ID Transaksi</td>
                    <td style="padding-bottom: 8px; color: #111827; font-weight: 600;">#${transactionId.slice(0, 8).toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 8px; color: #6b7280;">Tanggal Konfirmasi</td>
                    <td style="padding-bottom: 8px; color: #111827; font-weight: 600;">${currentDate}, ${currentTime} WITA</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280;">Status Pembayaran</td>
                    <td style="color: #059669; font-weight: 700;">LUNAS & DIKONFIRMASI</td>
                  </tr>
                </table>
              </div>

              <!-- Item Table -->
              <h4 style="color: #111827; font-size: 16px; margin-bottom: 15px;">Rincian Produk Sariroti</h4>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #d1d5db; color: #374151; font-size: 13px; text-transform: uppercase; font-weight: 600;">Produk</th>
                    <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #d1d5db; color: #374151; font-size: 13px; text-transform: uppercase; font-weight: 600;">Qty</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #d1d5db; color: #374151; font-size: 13px; text-transform: uppercase; font-weight: 600;">Harga/Item</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #d1d5db; color: #374151; font-size: 13px; text-transform: uppercase; font-weight: 600;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding: 15px; text-align: right; font-weight: 600; color: #374151; font-size: 15px;">Total Keseluruhan</td>
                    <td style="padding: 15px; text-align: right; font-weight: 700; color: #111827; font-size: 16px;">Rp ${Number(totalAmount || 0).toLocaleString("id-ID")}</td>
                  </tr>
                </tfoot>
              </table>

              <!-- Warning Alert -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 4px; margin-top: 30px;">
                <p style="margin: 0; color: #b45309; font-size: 14px; line-height: 1.5;">
                  <strong style="color: #92400e;">INFORMASI PENTING:</strong><br>
                  Harap tunjukkan <strong>nota elektronik ini (E-Receipt)</strong> kepada petugas Distribusi saat pengambilan pesanan dan juga gunakan sebagai bukti pengesahan saat melewati pemeriksaan tim Keamanan/Security area perusahaan.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 25px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 13px;">Ini adalah email otomatis, mohon tidak membalas email ini.</p>
              <p style="margin: 10px 0 0; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} SPS Corner - Koperasi Karyawan</p>
            </div>
          </div>
        </div>
      `;
      const result = await sendSarirotiEmailInternal(
        buyerEmail,
        `Nota Pengambilan Sariroti SPS Corner - Ref #${transactionId.slice(0, 8).toUpperCase()}`,
        emailHtml,
      );
      if (result.success) {
        console.log(
          `\u2705 Buyer receipt email sent to ${buyerEmail} for transaction ${transactionId}`,
        );
      } else {
        console.error(
          `\u274C Failed to send buyer receipt email for transaction ${transactionId}:`,
          result.error,
        );
      }
    } catch (err) {
      console.error("\u274C Error sending buyer receipt email:", err);
    }
  },
  "sendBuyerReceiptEmail",
);
const CACHE_FILE = path.join(os.tmpdir(), "digiflazz_cache.json");
let priceCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    const fileContent = fs.readFileSync(CACHE_FILE, "utf-8");
    priceCache = JSON.parse(fileContent);
    console.log("\u2705 Loaded Digiflazz price cache from file.");
  }
} catch (err) {
  console.error("Failed to load Digiflazz cache from file:", err);
}
const saveCacheToFile = __name(() => {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(priceCache), "utf-8");
  } catch (err) {
    console.error("Failed to save Digiflazz cache to file:", err);
  }
}, "saveCacheToFile");
const CACHE_TTL = 12 * 60 * 60 * 1e3;
const updateDigiflazzCache = __name(async () => {
  if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
    console.log(
      "\u26A0\uFE0F Skipping background Digiflazz price update: Credentials not configured.",
    );
    return;
  }
  try {
    const types = ["prepaid", "postpaid"];
    for (const type of types) {
      if (
        priceCache[type] &&
        Date.now() - priceCache[type].timestamp < CACHE_TTL
      ) {
        console.log(
          `\u2139\uFE0F Skipping background update for ${type} prices: Cache is still fresh.`,
        );
        continue;
      }
      console.log(`Fetching ${type} price list from Digiflazz...`);
      const sign = crypto
        .createHash("md5")
        .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "pricelist")
        .digest("hex");
      const payload = {
        cmd: type === "postpaid" ? "pasca" : "prepaid",
        username: DIGIFLAZZ_USERNAME,
        sign,
      };
      const response = await axios.post(
        "https://api.digiflazz.com/v1/price-list",
        payload,
        getDigiflazzAxiosConfig(),
      );
      if (response.data?.data && Array.isArray(response.data.data)) {
        priceCache[type] = { data: response.data.data, timestamp: Date.now() };
        saveCacheToFile();
        console.log(
          `\u2705 Successfully updated ${type} price cache in background.`,
        );
      } else if (response.data?.data?.rc) {
        if (response.data.data.rc === "83") {
          console.warn(
            `\u26A0\uFE0F Digiflazz ${type} rate limit reached (Code 83). Will retry later. Existing cache retained.`,
          );
        } else {
          console.error(
            `\u274C Digiflazz ${type} update returned error code ${response.data.data.rc}: ${response.data.data.message}`,
          );
        }
      } else {
        console.warn(
          `\u26A0\uFE0F Digiflazz ${type} update returned unexpected format:`,
          JSON.stringify(response.data).substring(0, 200),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2e3));
    }
  } catch (error) {
    const errorDetail = error.response?.data || error.message;
    console.error(
      "\u274C Background Digiflazz update failed:",
      typeof errorDetail === "object"
        ? JSON.stringify(errorDetail, null, 2)
        : errorDetail,
    );
    if (error.response?.status === 400) {
      console.error(
        "\u{1F4A1} Tip: A 400 error often means an invalid signature or invalid parameters. Check your DIGIFLAZZ_USERNAME and DIGIFLAZZ_API_KEY.",
      );
    } else if (error.response?.status === 401) {
      console.error(
        "\u{1F4A1} Tip: A 401 error means unauthorized. Check your credentials and ensure your IP is whitelisted in Digiflazz dashboard.",
      );
    }
  }
}, "updateDigiflazzCache");
if (!process.env.VERCEL) {
  setTimeout(updateDigiflazzCache, 5e3);
  setInterval(updateDigiflazzCache, CACHE_TTL);
}
app.post("/api/digital/prices", async (req, res) => {
  try {
    const { category, type = "prepaid" } = req.body;
    const cacheKey = `${type}`;
    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      console.log(
        `Digiflazz credentials not configured. Returning empty data for ${category || type}`,
      );
      return res.json({ success: true, data: [], mock: true });
    }
    if (
      priceCache[cacheKey] &&
      Date.now() - priceCache[cacheKey].timestamp < CACHE_TTL
    ) {
      let filtered = priceCache[cacheKey].data;
      if (category) {
        filtered = filtered.filter(
          (p) =>
            p.category &&
            p.category.toLowerCase().includes(category.toLowerCase()),
        );
      }
      return res.json({ success: true, data: filtered, cached: true });
    }
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "pricelist")
      .digest("hex");
    const response = await axios.post(
      "https://api.digiflazz.com/v1/price-list",
      {
        cmd: type === "postpaid" ? "pasca" : "prepaid",
        username: DIGIFLAZZ_USERNAME,
        sign,
      },
      getDigiflazzAxiosConfig(),
    );
    const data = response.data;
    if (data.data && Array.isArray(data.data)) {
      priceCache[cacheKey] = { data: data.data, timestamp: Date.now() };
      saveCacheToFile();
      let filtered = data.data;
      if (category) {
        filtered = data.data.filter(
          (p) =>
            p.category &&
            p.category.toLowerCase().includes(category.toLowerCase()),
        );
      }
      return res.json({ success: true, data: filtered });
    } else if (data.data && data.data.rc) {
      if (data.data.rc !== "83") {
        console.error(
          "Digiflazz Price Error Response:",
          JSON.stringify(data.data),
        );
      }
      if (data.data.rc === "83") {
        if (priceCache[cacheKey]) {
          console.log(`Rate limited, serving STALE ${type} prices from cache`);
          let filtered = priceCache[cacheKey].data;
          if (category) {
            filtered = filtered.filter(
              (p) =>
                p.category &&
                p.category.toLowerCase().includes(category.toLowerCase()),
            );
          }
          return res.json({
            success: true,
            data: filtered,
            cached: true,
            stale: true,
          });
        } else {
          console.log(
            `Rate limited and no cache available. Returning empty data for ${category || type}`,
          );
          return res.json({ success: true, data: [], mock: true });
        }
      }
      return res.json({
        success: false,
        error: data.data.message || "Failed to fetch prices",
      });
    } else if (data.rc) {
      if (data.rc !== "83") {
        console.error("Digiflazz Price Error Response:", JSON.stringify(data));
      }
      if (data.rc === "83") {
        if (priceCache[cacheKey]) {
          console.log(`Rate limited, serving STALE ${type} prices from cache`);
          let filtered = priceCache[cacheKey].data;
          if (category) {
            filtered = filtered.filter(
              (p) =>
                p.category &&
                p.category.toLowerCase().includes(category.toLowerCase()),
            );
          }
          return res.json({
            success: true,
            data: filtered,
            cached: true,
            stale: true,
          });
        } else {
          console.log(
            `Rate limited and no cache available. Returning empty data for ${category || type}`,
          );
          return res.json({ success: true, data: [], mock: true });
        }
      }
      return res.json({
        success: false,
        error: data.message || "Failed to fetch prices",
      });
    }
    res.json({ success: false, error: "Invalid response from provider" });
  } catch (error) {
    console.error(
      "Digiflazz Price Error:",
      error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message,
    );
    const cacheKey = `${req.body.type || "prepaid"}`;
    if (priceCache[cacheKey]) {
      console.log(`Network error, serving STALE ${cacheKey} prices from cache`);
      let filtered = priceCache[cacheKey].data;
      if (req.body.category) {
        filtered = filtered.filter(
          (p) =>
            p.category &&
            p.category.toLowerCase().includes(req.body.category.toLowerCase()),
        );
      }
      return res.json({
        success: true,
        data: filtered,
        cached: true,
        stale: true,
      });
    }
    res.json({
      success: false,
      error:
        error.response?.data?.data?.message ||
        error.message ||
        "Failed to fetch prices",
    });
  }
});
app.post("/api/digital/inquiry-pln", async (req, res) => {
  try {
    const { customer_no } = req.body;
    if (!customer_no) {
      return res
        .status(400)
        .json({ success: false, error: "Nomor pelanggan harus diisi" });
    }
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + customer_no)
      .digest("hex");
    console.log("Digiflazz PLN Inquiry Request:", { customer_no });
    const response = await axios.post(
      "https://api.digiflazz.com/v1/inquiry-pln",
      { username: DIGIFLAZZ_USERNAME, customer_no, sign },
      getDigiflazzAxiosConfig(),
    );
    const data = response.data.data;
    if (data && data.rc === "00") {
      res.json({ success: true, data });
    } else {
      const errorMsg = data?.message || "Gagal melakukan inquiry PLN";
      console.error("Digiflazz PLN Inquiry Business Error:", data);
      res.json({ success: false, error: errorMsg });
    }
  } catch (error) {
    const errorData =
      error.response?.data?.data || error.response?.data || error.message;
    const errorMessage =
      typeof errorData === "string"
        ? errorData
        : errorData.message || JSON.stringify(errorData);
    console.error("Digiflazz PLN Inquiry Connection Error:", errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});
app.post("/api/digital/inquiry-pasca", async (req, res) => {
  try {
    const { customer_no, buyer_sku_code } = req.body;
    if (!customer_no || !buyer_sku_code) {
      return res
        .status(400)
        .json({ success: false, error: "Nomor pelanggan dan SKU harus diisi" });
    }
    const ref_id = `inq_${buyer_sku_code}_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id)
      .digest("hex");
    console.log("Digiflazz Pasca Inquiry Request:", {
      customer_no,
      buyer_sku_code,
      ref_id,
    });
    const response = await axios.post(
      "https://api.digiflazz.com/v1/transaction",
      {
        commands: "inq-pasca",
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code,
        customer_no,
        ref_id,
        sign,
      },
      getDigiflazzAxiosConfig(),
    );
    const data = response.data.data;
    if (data && data.rc === "00") {
      res.json({ success: true, data });
    } else {
      const errorMsg = data?.message || "Gagal melakukan inquiry tagihan";
      console.error("Digiflazz Pasca Inquiry Business Error:", data);
      res.json({ success: false, error: errorMsg });
    }
  } catch (error) {
    const errorData =
      error.response?.data?.data || error.response?.data || error.message;
    const errorMessage =
      typeof errorData === "string"
        ? errorData
        : errorData.message || JSON.stringify(errorData);
    console.error("Digiflazz Pasca Inquiry Connection Error:", errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});
app.post("/api/digital/inquiry-ewallet", async (req, res) => {
  try {
    const { customer_no, brand } = req.body;
    if (!customer_no || !brand) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Nomor pelanggan dan brand harus diisi",
        });
    }
    const brandLower = brand.toLowerCase();
    let sku = "";
    if (brandLower.includes("dana")) sku = "CEKDANA";
    else if (brandLower.includes("ovo")) sku = "CEKOVO";
    else if (brandLower.includes("gopay") || brandLower.includes("go-pay"))
      sku = "CEKGOPAY";
    else if (brandLower.includes("shopee") || brandLower.includes("shopeepay"))
      sku = "CEKSHOPEE";
    else if (brandLower.includes("linkaja")) sku = "CEKLINKAJA";
    else {
      return res
        .status(400)
        .json({
          success: false,
          error: `Pengecekan nama untuk brand ${brand} belum didukung`,
        });
    }
    const ref_id = `cek_${sku}_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id)
      .digest("hex");
    console.log("Digiflazz E-Wallet Inquiry Request:", {
      customer_no,
      brand,
      sku,
      ref_id,
    });
    const response = await axios.post(
      "https://api.digiflazz.com/v1/transaction",
      {
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: sku,
        customer_no,
        ref_id,
        sign,
      },
      getDigiflazzAxiosConfig(),
    );
    const data = response.data.data;
    if (data && (data.rc === "00" || data.status === "Sukses")) {
      let name = data.sn || data.message || "Nama ditemukan";
      if (name.toUpperCase().startsWith("A/N ")) {
        name = name.substring(4).trim();
      } else if (name.toUpperCase().startsWith("AN ")) {
        name = name.substring(3).trim();
      }
      res.json({ success: true, data: { name, raw: data } });
    } else {
      const errorMsg = data?.message || "Gagal melakukan pengecekan e-wallet";
      console.error("Digiflazz E-Wallet Inquiry Business Error:", data);
      res.json({ success: false, error: errorMsg });
    }
  } catch (error) {
    const errorData =
      error.response?.data?.data || error.response?.data || error.message;
    const errorMessage =
      typeof errorData === "string"
        ? errorData
        : errorData.message || JSON.stringify(errorData);
    console.error("Digiflazz E-Wallet Inquiry Connection Error:", errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});
app.post("/api/digital/status-pasca", async (req, res) => {
  try {
    const { sku, customer_no, ref_id } = req.body;
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id)
      .digest("hex");
    const response = await axios.post(
      "https://api.digiflazz.com/v1/transaction",
      {
        commands: "status-pasca",
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: sku,
        customer_no,
        ref_id,
        sign,
      },
      getDigiflazzAxiosConfig(),
    );
    const data = response.data.data;
    if (data && (data.rc === "00" || data.status === "Success")) {
      res.json({ success: true, data });
    } else {
      const errorMsg = data?.message || "Gagal mengecek status pascabayar";
      res.json({ success: false, error: errorMsg });
    }
  } catch (error) {
    const errorData =
      error.response?.data?.data || error.response?.data || error.message;
    const errorMessage =
      typeof errorData === "string"
        ? errorData
        : errorData.message || JSON.stringify(errorData);
    console.error("Digiflazz Status Pasca Error:", errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});
app.post("/api/digital/inq-pasca", async (req, res) => {
  try {
    const { sku, customer_no, ref_id } = req.body;
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id)
      .digest("hex");
    const response = await axios.post(
      "https://api.digiflazz.com/v1/transaction",
      {
        commands: "inq-pasca",
        username: DIGIFLAZZ_USERNAME,
        buyer_sku_code: sku,
        customer_no,
        ref_id,
        sign,
        testing: process.env.DIGIFLAZZ_TESTING === "true",
      },
      getDigiflazzAxiosConfig(),
    );
    const data = response.data.data;
    if (data && (data.rc === "00" || data.status === "Sukses")) {
      res.json({ success: true, data });
    } else {
      const errorMsg =
        data?.message || "Gagal melakukan cek tagihan pascabayar";
      res.json({ success: false, error: errorMsg });
    }
  } catch (error) {
    const errorData =
      error.response?.data?.data || error.response?.data || error.message;
    const errorMessage =
      typeof errorData === "string"
        ? errorData
        : errorData.message || JSON.stringify(errorData);
    console.error("Digiflazz Inq Pasca Error:", errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});
app.post("/api/digital/deposit", async (req, res) => {
  try {
    const { amount, bank, owner_name } = req.body;
    if (!amount || !bank || !owner_name) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Amount, bank, and owner_name are required",
        });
    }
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "deposit")
      .digest("hex");
    const response = await axios.post(
      "https://api.digiflazz.com/v1/deposit",
      {
        username: DIGIFLAZZ_USERNAME,
        amount: parseInt(amount),
        Bank: bank,
        owner_name,
        sign,
      },
      getDigiflazzAxiosConfig(),
    );
    const data = response.data.data;
    if (data && data.rc === "00") {
      res.json({ success: true, data });
    } else {
      const errorMsg = data?.message || "Gagal membuat tiket deposit";
      res.json({ success: false, error: errorMsg });
    }
  } catch (error) {
    const errorData =
      error.response?.data?.data || error.response?.data || error.message;
    const errorMessage =
      typeof errorData === "string"
        ? errorData
        : errorData.message || JSON.stringify(errorData);
    console.error("Digiflazz Deposit Error:", errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});
app.post("/api/digital/check-status", async (req, res) => {
  try {
    const { transaction_item_id } = req.body;
    if (!transaction_item_id) {
      return res
        .status(400)
        .json({ success: false, error: "Missing transaction_item_id" });
    }
    const { data: item, error: fetchError } = await supabase
      .from("transaction_items")
      .select("*")
      .eq("id", transaction_item_id)
      .single();
    if (fetchError || !item) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }
    const refId =
      item.metadata?.ref_id ||
      item.metadata?.digiflazz_response?.ref_id ||
      item.transaction_id;
    const sku =
      item.metadata?.sku || item.metadata?.digiflazz_response?.buyer_sku_code;
    const customerNo =
      item.metadata?.target_number ||
      item.metadata?.digiflazz_request?.customer_no ||
      item.metadata?.digiflazz_response?.customer_no;
    if (!refId || !sku || !customerNo) {
      console.error(
        "Incomplete metadata for checking status:",
        JSON.stringify(item.metadata, null, 2),
      );
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Data produk digital tidak lengkap untuk mengecek status (hubungi admin sales)",
        });
    }
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + refId)
      .digest("hex");
    const payload = {
      username: DIGIFLAZZ_USERNAME,
      buyer_sku_code: sku,
      customer_no: customerNo,
      ref_id: refId,
      sign,
    };
    if (item.metadata?.is_postpaid) {
      payload.commands = "pay-pasca";
    }
    const digiResponse = await axios.post(
      "https://api.digiflazz.com/v1/transaction",
      payload,
      getDigiflazzAxiosConfig(),
    );
    const digiData = digiResponse.data;
    const responseData = digiData.data || {};
    const rc = responseData.rc;
    const message = responseData.message || "No message from Digiflazz";
    const sn = responseData.sn || "";
    let itemStatus = "processing";
    if (rc === "00") {
      itemStatus = "delivered";
    } else if (rc === "03") {
      itemStatus = "processing";
    } else {
      itemStatus = "failed";
    }
    const { error: updateError } = await supabase
      .from("transaction_items")
      .update({
        metadata: {
          ...item.metadata,
          status: itemStatus,
          digiflazz_response: responseData,
          digiflazz_rc: rc,
          digiflazz_message: message,
          sn: sn || item.metadata?.sn,
          last_check: new Date().toISOString(),
        },
      })
      .eq("id", transaction_item_id);
    if (updateError) {
      console.error("Error updating item based on manual check:", updateError);
    }
    res.json({ success: true, itemStatus, sn, message });
  } catch (error) {
    console.error("Check Status Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/digital/cek-saldo", async (req, res) => {
  try {
    if (isDefaultDigiflazz) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Digiflazz credentials not configured. Please set DIGIFLAZZ_USERNAME and DIGIFLAZZ_API_KEY in environment variables.",
          is_default: true,
        });
    }
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "depo")
      .digest("hex");
    console.log("\u{1F50D} Cek Saldo Debug:", {
      username: DIGIFLAZZ_USERNAME,
      sign,
      apiKeyLength: DIGIFLAZZ_API_KEY.length,
      apiKeyPrefix: DIGIFLAZZ_API_KEY.substring(0, 5) + "...",
    });
    const response = await axios.post(
      "https://api.digiflazz.com/v1/cek-saldo",
      { cmd: "deposit", username: DIGIFLAZZ_USERNAME, sign },
      getDigiflazzAxiosConfig(),
    );
    if (!response.data || !response.data.data) {
      console.error(
        "\u274C Digiflazz Cek Saldo Invalid Response:",
        response.data,
      );
      return res
        .status(500)
        .json({
          success: false,
          error: "Invalid response from Digiflazz",
          details: response.data,
        });
    }
    if (response.data.data.rc && response.data.data.rc !== "00") {
      console.error("\u274C Digiflazz Cek Saldo RC Error:", response.data.data);
      return res
        .status(400)
        .json({
          success: false,
          error: response.data.data.message || "Digiflazz error",
          rc: response.data.data.rc,
        });
    }
    res.json({ success: true, data: response.data.data });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    const statusCode = error.response?.status || 500;
    console.error(`\u274C Digiflazz Cek Saldo Error [${statusCode}]:`, {
      message: error.message,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
      },
    });
    let userFriendlyError = "Failed to fetch balance";
    if (typeof errorData === "string") {
      userFriendlyError = errorData;
    } else if (errorData?.data?.message) {
      userFriendlyError = errorData.data.message;
    } else if (errorData?.message) {
      userFriendlyError = errorData.message;
    } else if (error.message) {
      userFriendlyError = error.message;
    }
    if (
      userFriendlyError.toLowerCase().includes("signature") ||
      statusCode === 403 ||
      statusCode === 401 ||
      statusCode === 400
    ) {
      userFriendlyError =
        "Akses Ditolak: Pastikan IP Address server (Cloud Run) sudah di-whitelist di Digiflazz ATAU gunakan FIXIE_URL yang valid. (Error asli: " +
        userFriendlyError +
        ")";
    }
    res
      .status(statusCode)
      .json({
        success: false,
        error: userFriendlyError,
        details: errorData,
        tip: "Digiflazz mewajibkan Whitelist IP. Jika deploy ke Cloud Run, IP akan berubah-ubah. Anda WAJIB menggunakan proxy statis (FIXIE_URL).",
      });
  }
});
app.post("/api/digital/order", async (req, res) => {
  try {
    const { sku, customer_no, ref_id, is_postpaid } = req.body || {};
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id)
      .digest("hex");
    const payload = {
      username: DIGIFLAZZ_USERNAME,
      buyer_sku_code: sku,
      customer_no,
      ref_id,
      sign,
      testing: process.env.DIGIFLAZZ_TESTING === "true",
    };
    if (is_postpaid) {
      payload.commands = "pay-pasca";
    }
    const response = await axios.post(
      "https://api.digiflazz.com/v1/transaction",
      payload,
      getDigiflazzAxiosConfig(),
    );
    const data = response.data;
    res.json({ success: true, data: data.data });
  } catch (error) {
    const errData = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error("Digiflazz Order Error:", errData);
    res.status(500).json({ error: errData });
  }
});
app.post("/api/admin/transactions/approve", async (req, res) => {
  try {
    const { transaction_id } = req.body;
    if (!transaction_id)
      return res.status(400).json({ error: "Transaction ID is required" });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user)
      return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin")
      return res.status(403).json({ error: "Forbidden: Admin only" });
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*, transaction_items(*)")
      .eq("id", transaction_id)
      .single();
    if (txError || !transaction)
      return res.status(404).json({ error: "Transaction not found" });
    if (transaction.status === "success")
      return res.status(400).json({ error: "Transaction already successful" });
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ status: "success" })
      .eq("id", transaction_id);
    if (updateError) throw updateError;
    await updateSellerBalances(transaction.transaction_items);
    await checkLowStockAndNotify(transaction.transaction_items);
    await updateBuyerPoints(transaction_id, transaction.buyer_id, transaction.total_amount);
    await processDigitalItems(transaction_id, transaction.transaction_items);
    await triggerSarirotiEmail(
      transaction_id,
      transaction.buyer_name,
      transaction.total_amount,
    );
    if (transaction.buyer_id) {
      await sendNotification(transaction.buyer_id, {
        type: "transaction",
        title: "\u2705 Pembayaran Dikonfirmasi!",
        message: `Pesanan Anda #${transaction_id.slice(0, 8)} telah diverifikasi oleh admin. Terima kasih!`,
        path: `/kiosk/history?id=${transaction_id}`,
      });
    }

    // Kirim email konfirmasi ke buyer jika ada email
    const buyerEmail = transaction.buyer_email;
    if (buyerEmail && buyerEmail.includes("@")) {
      const txItems = transaction.transaction_items || [];
      const itemRows = txItems.map((it) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${it.name||"Produk"}</td><td style="padding:8px 12px;text-align:center;">${it.quantity||1}</td><td style="padding:8px 12px;text-align:right;">Rp ${((it.price||0)*(it.quantity||1)).toLocaleString("id-ID")}</td></tr>`).join("");
      const witaTime = new Date().toLocaleString("id-ID",{timeZone:"Asia/Makassar",dateStyle:"long",timeStyle:"short"});
      const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;"><div style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;"><h1 style="color:white;margin:0;">&#x2705; Pembayaran Dikonfirmasi</h1><p style="color:#bfdbfe;margin:8px 0 0;">SPS Corner</p></div><div style="padding:24px;background:#f9fafb;border-radius:0 0 12px 12px;"><p>Halo, <strong>${transaction.buyer_name}</strong>! Pembayaran Anda telah dikonfirmasi.</p><table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;"><thead><tr style="background:#eff6ff;"><th style="padding:10px 12px;text-align:left;font-size:12px;color:#1d4ed8;">Produk</th><th style="padding:10px 12px;text-align:center;font-size:12px;color:#1d4ed8;">Qty</th><th style="padding:10px 12px;text-align:right;font-size:12px;color:#1d4ed8;">Subtotal</th></tr></thead><tbody>${itemRows}</tbody><tfoot><tr style="background:#f3f4f6;"><td colspan="2" style="padding:12px;font-weight:700;">Total</td><td style="padding:12px;text-align:right;font-weight:700;color:#1d4ed8;">Rp ${(transaction.total_amount||0).toLocaleString("id-ID")}</td></tr></tfoot></table><p style="font-size:12px;color:#6b7280;">ID: #${transaction_id.slice(0,8).toUpperCase()} &bull; ${witaTime} WITA</p><p style="font-size:12px;color:#6b7280;text-align:center;">Pertanyaan? <a href="https://wa.me/62818222604" style="color:#1d4ed8;">WhatsApp Admin</a></p></div></div>`;
      sendSarirotiEmailInternal(
        buyerEmail,
        `Pembayaran Dikonfirmasi - #${transaction_id.slice(0,8).toUpperCase()} | SPS Corner`,
        emailHtml
      ).then(() => console.log(`[Email] Konfirmasi terkirim ke ${buyerEmail}`)).catch(e => console.warn("[Email] Gagal:", e.message));
    }
    const uniqueSellers = [...new Set(transaction.transaction_items.map((item) => item.seller_id))];
    let hasKoperasi = false;
    for (const sellerId of uniqueSellers) {
      if (sellerId) {
        await sendNotification(sellerId, {
          type: "transaction",
          title: "💰 Pesanan Baru Masuk!",
          message: `Ada pesanan baru #${transaction_id.slice(0, 8)} dari ${transaction.buyer_name} yang perlu Anda proses.`,
          path: `/dashboard/seller/transactions?id=${transaction_id}`,
        });
      } else {
        hasKoperasi = true;
      }
    }
    if (hasKoperasi) {
      const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin']);
      if (admins) {
        for (const admin of admins) {
          await sendNotification(admin.id, {
            type: 'transaction',
            title: '🛒 Pesanan Koperasi Baru',
            message: `Ada pesanan baru #${transaction_id.slice(0, 8)} dari ${transaction.buyer_name}.`,
            path: `/dashboard/admin/transactions?id=${transaction_id}`
          });
        }
      }
    }
    res.json({ success: true, message: "Transaction approved and processed" });
  } catch (error) {
    console.error("Error approving transaction:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
app.post("/api/admin/transactions/reject", async (req, res) => {
  try {
    const { transaction_id } = req.body;
    if (!transaction_id) return res.status(400).json({ error: "Transaction ID is required" });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin")
      return res.status(403).json({ error: "Forbidden: Admin only" });

    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });
    if (transaction.status === "failed") return res.status(400).json({ error: "Transaction already failed" });

    // Restore stock before marking as failed
    await restoreTransactionStock(transaction_id);

    await supabase.from("transactions").update({ status: "failed" }).eq("id", transaction_id);

    if (transaction.buyer_id) {
      await sendNotification(transaction.buyer_id, {
        type: "transaction",
        title: "\u274C Pesanan Ditolak",
        message: `Pesanan Anda #${transaction_id.slice(0, 8)} telah ditolak oleh admin. Hubungi admin untuk detail lebih lanjut.`,
        path: `/kiosk/history?id=${transaction_id}`,
      });
    }

    res.json({ success: true, message: "Transaction rejected and stock restored" });
  } catch (error) {
    console.error("Error rejecting transaction:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

app.post("/api/admin/transactions/confirm-sariroti", async (req, res) => {
  try {
    const { transaction_id } = req.body;
    if (!transaction_id)
      return res.status(400).json({ error: "Transaction ID is required" });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user)
      return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin" && profile?.role !== "seller")
      return res.status(403).json({ error: "Forbidden: Admin/Seller only" });
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*, transaction_items(*, products(*))")
      .eq("id", transaction_id)
      .single();
    if (txError || !transaction)
      return res.status(404).json({ error: "Transaction not found" });
    const newMetadata = {
      ...(transaction.metadata || {}),
      sariroti_confirmed: true,
      sariroti_confirmed_at: new Date().toISOString(),
      sariroti_confirmed_by: user.id,
      sariroti_order_status: "confirmed",
    };
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ metadata: newMetadata })
      .eq("id", transaction_id);
    if (updateError) throw updateError;
    let buyerEmail = null;
    if (transaction.buyer_id) {
      const { data: buyerAuth } = await supabase.auth.admin.getUserById(
        transaction.buyer_id,
      );
      buyerEmail = buyerAuth?.user?.email;
    } else if (transaction.payment_details?.buyer_email) {
      buyerEmail = transaction.payment_details.buyer_email;
    }
    if (buyerEmail) {
      await sendBuyerReceiptEmail(
        transaction_id,
        buyerEmail,
        transaction.buyer_name,
        transaction.transaction_items,
        transaction.total_amount,
      );
    } else {
      console.log(
        `\u2139\uFE0F No buyer email found for transaction ${transaction_id}. Skipping buyer receipt email.`,
      );
    }
    if (transaction.buyer_id) {
      const emailNote = buyerEmail ? ` E-Receipt / Nota telah dikirim ke email Anda (${buyerEmail}).` : "";
      await sendNotification(transaction.buyer_id, {
        type: "transaction",
        title: "\u{1F4CB} Pesanan Roti Dikonfirmasi!",
        message: `Pesanan roti Anda #${transaction_id.slice(0, 8)} telah dikonfirmasi dan sedang diproses.${emailNote} Kami akan memberitahu saat siap diambil.`,
        path: `/kiosk/history?id=${transaction_id}`,
      });
    }
    res.json({
      success: true,
      message: "Pesanan Sariroti berhasil dikonfirmasi",
    });
  } catch (error) {
    console.error("Error confirming Sariroti order:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
app.post("/api/admin/transactions/notify-ready", async (req, res) => {
  try {
    const { transaction_id, custom_message } = req.body;
    if (!transaction_id)
      return res.status(400).json({ error: "Transaction ID is required" });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user)
      return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin")
      return res.status(403).json({ error: "Forbidden: Admin only" });
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();
    if (txError || !transaction)
      return res.status(404).json({ error: "Transaction not found" });
    const newMetadata = {
      ...(transaction.metadata || {}),
      sariroti_order_status: "ready",
      sariroti_ready_at: new Date().toISOString(),
      sariroti_ready_message: custom_message || null,
    };
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ metadata: newMetadata })
      .eq("id", transaction_id);
    if (updateError) throw updateError;
    const notifMessage =
      custom_message ||
      `Pesanan roti Anda #${transaction_id.slice(0, 8)} sudah siap diambil! Silakan datang ke toko kami. Terima kasih! \u{1F64F}`;
    if (transaction.buyer_id) {
      await sendNotification(transaction.buyer_id, {
        type: "transaction",
        title: "\u{1F35E} Pesanan Siap Diambil!",
        message: notifMessage,
        path: `/kiosk/history?id=${transaction_id}`,
      });
    }
    console.log(`\u2705 notify-ready sent: ${transaction_id}`);
    res.json({
      success: true,
      message: "Notifikasi siap diambil berhasil dikirim",
    });
  } catch (error) {
    console.error("Error sending ready notification:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
app.get("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select(
        `
          *,
          transaction_items (
            *,
            products (*)
          )
        `,
      )
      .eq("id", id)
      .single();
    if (error || !transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json({ success: true, transaction });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/api/digital/callback", async (req, res) => {
  try {
    const callbackData = req.body;
    const hubSignature = req.header("X-Hub-Signature");
    const digiflazzEvent = req.header("X-Digiflazz-Event");
    const webhookSecret = process.env.DIGIFLAZZ_WEBHOOK_SECRET;
    const webhookId = process.env.DIGIFLAZZ_WEBHOOK_ID;
    console.log(
      `\u{1F514} Digiflazz Webhook Received (Event: ${digiflazzEvent}):`,
      JSON.stringify(callbackData, null, 2),
    );
    if (digiflazzEvent === "ping" || callbackData.data === "ping") {
      return res.status(200).json({ success: true, message: "pong" });
    }
    if (!callbackData.data || typeof callbackData.data !== "object") {
      return res.status(400).json({ error: "Invalid callback data" });
    }
    const { ref_id, status, sn } = callbackData.data;
    if (!status) return res.json({ success: true, message: "No status, skipping" });
    const secretToUse = webhookSecret || webhookId;
    if (secretToUse && hubSignature) {
      const bodyString = req.rawBody || JSON.stringify(req.body);
      const expectedHubSignature =
        "sha1=" +
        crypto.createHmac("sha1", secretToUse).update(bodyString).digest("hex");
      if (hubSignature !== expectedHubSignature) {
        console.error(
          "\u274C Invalid X-Hub-Signature. Expected:",
          expectedHubSignature,
          "Got:",
          hubSignature,
        );
        return res.status(403).json({ error: "Invalid signature" });
      }
    } else if (callbackData.data.signature) {
      const signature = callbackData.data.signature;
      const expectedSignature = crypto
        .createHash("md5")
        .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + ref_id)
        .digest("hex");
      if (signature !== expectedSignature) {
        console.error(
          "\u274C Invalid Digiflazz Callback Signature. Expected:",
          expectedSignature,
          "Got:",
          signature,
        );
        return res.status(403).json({ error: "Invalid signature" });
      }
    } else {
      console.warn(
        "\u26A0\uFE0F Digiflazz Webhook received without signature validation. Ensure DIGIFLAZZ_WEBHOOK_SECRET is set.",
      );
    }
    if (ref_id) {
      const { data: itemsByRef, error: fetchError } = await supabase
        .from("transaction_items")
        .select("id, metadata")
        .contains("metadata", { ref_id });
      if (itemsByRef && itemsByRef.length > 0) {
        for (const item of itemsByRef) {
          await supabase
            .from("transaction_items")
            .update({
              metadata: {
                ...item.metadata,
                status:
                  status.toLowerCase() === "sukses"
                    ? "delivered"
                    : status.toLowerCase() === "gagal"
                      ? "failed"
                      : "processing",
                ...callbackData.data,
                sn,
                last_update: new Date().toISOString(),
              },
            })
            .eq("id", item.id);
        }
        
        // Trigger Notification
        if (status.toLowerCase() === "sukses" || status.toLowerCase() === "gagal") {
           const { data: tx } = await supabase.from('transactions').select('buyer_id').eq('id', ref_id).single();
           if (tx && tx.buyer_id) {
             await supabase.from('notifications').insert({
               user_id: tx.buyer_id,
               title: status.toLowerCase() === 'sukses' ? 'Pesanan Digital Berhasil' : 'Pesanan Digital Gagal',
               message: status.toLowerCase() === 'sukses' 
                  ? `Transaksi produk digital kamu dengan SN/Ref: ${sn || ref_id || ''} telah berhasil diproses.` 
                  : `Transaksi produk digital kamu gagal diproses. ${callbackData.data?.message || ''}`,
               type: status.toLowerCase() === 'sukses' ? 'transaction' : 'system',
               path: `/kiosk/history?id=${ref_id}`
             });
           }
        }
      } else {
        const { data: itemsByTx, error: txFetchError } = await supabase
          .from("transaction_items")
          .select("id, metadata")
          .eq("transaction_id", ref_id)
          .contains("metadata", { is_digital: true });
        if (itemsByTx && itemsByTx.length > 0) {
          for (const item of itemsByTx) {
            await supabase
              .from("transaction_items")
              .update({
                metadata: {
                  ...item.metadata,
                  status:
                    status.toLowerCase() === "sukses"
                      ? "delivered"
                      : status.toLowerCase() === "gagal"
                        ? "failed"
                        : "processing",
                  ...callbackData.data,
                  sn,
                  last_update: new Date().toISOString(),
                },
              })
              .eq("id", item.id);
          }
          // Trigger Notification
          if (status.toLowerCase() === "sukses" || status.toLowerCase() === "gagal") {
             const { data: tx } = await supabase.from('transactions').select('buyer_id').eq('id', ref_id).single();
             if (tx && tx.buyer_id) {
               await supabase.from('notifications').insert({
                 user_id: tx.buyer_id,
                 title: status.toLowerCase() === 'sukses' ? 'Pesanan Digital Berhasil' : 'Pesanan Digital Gagal',
                 message: status.toLowerCase() === 'sukses' 
                    ? `Transaksi produk digital kamu dengan SN/Ref: ${sn || ref_id || ''} telah berhasil diproses.` 
                    : `Transaksi produk digital kamu gagal diproses. ${callbackData.data?.message || ''}`,
                 type: status.toLowerCase() === 'sukses' ? 'transaction' : 'system',
                 path: `/kiosk/history?id=${ref_id}`
               });
             }
          }
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: error.message });
  }
});
if (process.env.NODE_ENV !== "production") {
  app.get("/api/payment/ipaymu/debug", (req, res) => {
    res.json({
      va: IPAYMU_VA,
      apiKeyLength: IPAYMU_API_KEY.length,
      production: IPAYMU_PRODUCTION,
      rawEnvProduction: process.env.IPAYMU_PRODUCTION,
    });
  });
}
app.post("/api/payment/ipaymu/create", async (req, res) => {
  try {
    const {
      transaction_id,
      amount,
      buyer_name,
      buyer_email,
      buyer_phone,
      items = [],
    } = req.body;
    if (
      !buyer_name ||
      !buyer_email ||
      !buyer_phone ||
      !amount ||
      !transaction_id
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Missing required fields: buyer_name, buyer_email, buyer_phone, amount, transaction_id",
        });
    }
    if (!IPAYMU_VA || !IPAYMU_API_KEY) {
      return res
        .status(500)
        .json({
          success: false,
          error: "Ipaymu not configured. Set IPAYMU_VA and IPAYMU_API_KEY",
        });
    }
    const appUrl = process.env.APP_URL || "https://spscorner.store";
    let cleanName = (buyer_name || "Customer")
      .replace(/[^a-zA-Z\s]/g, "")
      .trim();
    if (cleanName.length < 3 || cleanName.toLowerCase().includes("test")) {
      cleanName = "Pelanggan SPS Corner";
    }
    if (cleanName.length < 3) cleanName = "Pelanggan";
    const paymentData = {
      product: [],
      qty: [],
      price: [],
      amount: Math.round(Number(amount)).toString(),
      returnUrl: `${appUrl}/kiosk/success?id=${transaction_id}`,
      cancelUrl: `${appUrl}/kiosk/cart`,
      notifyUrl: `${appUrl}/api/payment/ipaymu/callback`,
      referenceId: String(transaction_id),
      buyerName: cleanName,
      buyerPhone:
        buyer_phone ||
        "0812" + Math.floor(1e7 + Math.random() * 9e7).toString(),
      buyerEmail:
        buyer_email ||
        `${cleanName.replace(/\s+/g, "").toLowerCase().substring(0, 10)}${Math.floor(Math.random() * 1e3)}@gmail.com`,
    };
    if (items && Array.isArray(items) && items.length > 0) {
      paymentData.product = items.map((i) => String(i.name || i.product_name));
      paymentData.qty = items.map((i) => String(i.quantity || 1));
      paymentData.price = items.map((i) => String(Math.round(Number(i.price))));
    } else {
      paymentData.product = ["Transaction"];
      paymentData.qty = ["1"];
      paymentData.price = [Math.round(Number(amount)).toString()];
    }
    console.log("\u{1F4DD} Payment Request:", {
      reference_id: transaction_id,
      amount,
      buyer_name,
    });
    const response = await ipaymuClient.createPayment(paymentData);
    res.json({
      success: true,
      payment_url: response.Data?.Url,
      session_id: response.Data?.SessionId,
    });
  } catch (error) {
    console.error("\u274C Payment Creation Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/payment/manual/verify", async (req, res) => {
  try {
    const { transaction_id, receipt_image, expected_amount } = req.body;
    if (!transaction_id || !receipt_image) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }
    const base64Data = receipt_image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const mimeType =
      receipt_image.match(/data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
    const fileExt = mimeType.split("/")[1] || "jpg";
    const fileName = `receipts/${transaction_id}_${Date.now()}.${fileExt}`;
    let receiptUrl = receipt_image;
    try {
      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(fileName, buffer, { contentType: mimeType });
      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("products").getPublicUrl(fileName);
        receiptUrl = publicUrl;
      } else {
        console.error("Failed to upload receipt image:", uploadError);
      }
    } catch (uploadErr) {
      console.error("Exception uploading receipt image:", uploadErr);
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
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: "GEMINI_API_KEY tidak dikonfigurasi di backend (.env). Sistem verifikasi AI tidak dapat berjalan." });
    }
    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType:
                  receipt_image.match(/data:(image\/\w+);base64,/)?.[1] ||
                  "image/jpeg",
              },
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    const resultText = geminiResponse.text;
    if (!resultText) {
      throw new Error("Gagal mendapatkan respons dari AI");
    }
    const verificationResult = JSON.parse(resultText);
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("status, payment_details")
      .eq("id", transaction_id)
      .single();
    const existingPaymentDetails = existingTx?.payment_details || {};
    if (!verificationResult.isValid) {
      await supabase
        .from("transactions")
        .update({
          receipt_image: receiptUrl,
          payment_details: {
            ...existingPaymentDetails,
            receipt_uploaded: true,
            verification_failed: true,
            reason: verificationResult.reason,
            attempted_at: new Date().toISOString(),
          },
        })
        .eq("id", transaction_id);
      return res
        .status(400)
        .json({
          success: false,
          error: `Bukti transfer tidak valid: ${verificationResult.reason}`,
        });
    }
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "paid",
        payment_method: "manual_qris",
        receipt_image: receiptUrl,
        payment_details: {
          ...existingPaymentDetails,
          receipt_uploaded: true,
          verified_at: new Date().toISOString(),
        },
      })
      .eq("id", transaction_id);
    if (updateError) throw updateError;
    const { data: txData, error: txFetchError } = await supabase
      .from("transactions")
      .select("*, transaction_items(*)")
      .eq("id", transaction_id)
      .single();
    if (!txFetchError && txData && txData.transaction_items) {
      if (
        existingTx &&
        existingTx.status !== "paid" &&
        existingTx.status !== "success"
      ) {
        await updateSellerBalances(txData.transaction_items);
        await checkLowStockAndNotify(txData.transaction_items);
        await updateBuyerPoints(transaction_id, txData.buyer_id, txData.total_amount);
      }
      await processDigitalItems(transaction_id, txData.transaction_items);
      await triggerSarirotiEmail(
        transaction_id,
        txData.buyer_name,
        txData.total_amount,
      );
    }
    res.json({ success: true, message: "Payment verified successfully" });
  } catch (error) {
    console.error("\u274C Manual Verification Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/payment/points/pay", async (req, res) => {
  try {
    const { transaction_id } = req.body;
    if (!transaction_id) throw new Error("Transaction ID is required");

    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "loyalty_enabled")
      .single();
    if (setting?.value !== "true") throw new Error("Fitur Loyalty Points sedang dinonaktifkan");

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select("*, transaction_items(*, products(name, category, price))")
      .eq("id", transaction_id)
      .single();

    if (txError || !tx) throw new Error("Transaksi tidak ditemukan");
    if (!tx.buyer_id) throw new Error("Hanya karyawan terdaftar yang dapat menggunakan Points");
    if (tx.status === "success" || tx.status === "paid") throw new Error("Transaksi sudah dibayar");

    const { data: profile } = await supabase
      .from("profiles")
      .select("loyalty_points")
      .eq("id", tx.buyer_id)
      .single();

    if (!profile || (profile.loyalty_points || 0) < tx.total_amount) {
      throw new Error(`Points tidak mencukupi. Point: ${profile?.loyalty_points || 0}, Tagihan: ${tx.total_amount}`);
    }

    // Deduct points
    const { error: deductError } = await supabase
      .from("profiles")
      .update({ loyalty_points: profile.loyalty_points - tx.total_amount })
      .eq("id", tx.buyer_id);
    if (deductError) throw deductError;

    // Update transaction
    const { error: updateTx } = await supabase
      .from("transactions")
      .update({ 
        status: "success", 
        payment_method: "points",
        metadata: { ...tx.metadata, point_payment: true }
      })
      .eq("id", transaction_id);
    if (updateTx) throw updateTx;

    // Run post processes
    await updateSellerBalances(tx.transaction_items);
    await checkLowStockAndNotify(tx.transaction_items);
    await processDigitalItems(transaction_id, tx.transaction_items);
    await triggerSarirotiEmail(transaction_id, tx.buyer_name, tx.total_amount);

    res.json({ success: true, message: "Pembayaran berhasil menggunakan Points" });
  } catch (error) {
    console.error("Point Payment Error:", error);
    res.status(500).json({ error: error.message || "Gagal memproses pembayaran dengan poin" });
  }
});
app.post("/api/payment/ipaymu/direct", async (req, res) => {
  try {
    const {
      transaction_id,
      amount,
      buyer_name,
      buyer_email,
      buyer_phone,
      payment_method = "qris",
      payment_channel = "qris",
    } = req.body || {};
    if (
      !buyer_name ||
      !buyer_email ||
      !buyer_phone ||
      !amount ||
      !transaction_id
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }
    if (!IPAYMU_VA || !IPAYMU_API_KEY) {
      return res
        .status(500)
        .json({ success: false, error: "Ipaymu not configured" });
    }
    const appUrl = process.env.APP_URL || "https://spscorner.store";
    let method = (payment_method || "qris").toLowerCase();
    let channel = (payment_channel || "qris").toLowerCase();
    if (method === "qris") {
      channel = "mpm";
    }
    let cleanName = (buyer_name || "Customer")
      .replace(/[^a-zA-Z\s]/g, "")
      .trim();
    if (cleanName.length < 3 || cleanName.toLowerCase().includes("test")) {
      cleanName = "Pelanggan SPS Corner";
    }
    if (cleanName.length < 3) cleanName = "Pelanggan";
    const directPaymentData = {
      name: cleanName,
      phone:
        buyer_phone ||
        "0812" + Math.floor(1e7 + Math.random() * 9e7).toString(),
      email:
        buyer_email ||
        `${cleanName.replace(/\s+/g, "").toLowerCase().substring(0, 10)}${Math.floor(Math.random() * 1e3)}@gmail.com`,
      amount: Math.round(Number(amount)),
      comments: `Payment for transaction ${transaction_id}`,
      notifyUrl: `${appUrl}/api/payment/ipaymu/callback`,
      referenceId: String(transaction_id),
      paymentMethod: method,
      paymentChannel: channel,
    };
    console.log("\u{1F4B3} Direct Payment:", {
      reference_id: transaction_id,
      payment_channel: channel,
    });
    const response = await ipaymuClient.createDirectPayment(directPaymentData);
    res.json({
      success: true,
      data: response.Data,
      qr_code: response.Data?.QrCode,
    });
  } catch (error) {
    console.error("\u274C Direct Payment Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/payment/ipaymu/callback", async (req, res) => {
  try {
    console.log("\u{1F514} Ipaymu Callback RAW:", {
      body: req.body,
      headers: req.headers,
      contentType: req.headers['content-type'],
      timestamp: new Date().toISOString(),
    });
    const body = req.body || {};
    const statusRaw = body.status || body.Status || body.payment_status || '';
    const reference_id = body.reference_id || body.referenceId || '';
    const trx_id = body.trx_id || body.trxId || '';
    const sid = body.sid || body.session_id || '';
    const transaction_id = body.transaction_id || body.transactionId || '';

    const refId = reference_id || transaction_id;
    if (!refId) {
      return res.status(400).json({ error: "Missing reference_id" });
    }

    const statusLower = String(statusRaw).toLowerCase().trim();
    const txStatus =
      statusLower === "berhasil"
        ? "paid"
        : statusLower === "gagal"
          ? "failed"
          : statusLower === "success" || statusLower === "sukses" || statusLower === "completed" || statusLower === "settlement"
            ? "paid"
            : statusLower === "fail" || statusLower === "expired" || statusLower === "deny" || statusLower === "cancel"
              ? "failed"
              : "pending";

    let transaction;
    let fetchError;
    // Coba cari pake reference_id dulu
    const lookupResult = await supabase
      .from("transactions")
      .select("*, transaction_items(*)")
      .eq("id", refId)
      .maybeSingle();
    transaction = lookupResult.data;
    fetchError = lookupResult.error;

    // Fallback: cari via payment_details->ipaymu_trx_id
    if (!transaction && transaction_id && transaction_id !== refId) {
      const fallbackResult = await supabase
        .from("transactions")
        .select("*, transaction_items(*)")
        .filter("payment_details->>ipaymu_trx_id", "eq", transaction_id)
        .maybeSingle();
      transaction = fallbackResult.data;
      if (transaction) {
        console.log(`[iPaymu] Found tx ${transaction.id} via ipaymu_trx_id fallback`);
      }
    }

    if (!transaction) {
      console.error("[iPaymu] Transaction not found for refId:", refId, "transaction_id:", transaction_id);
      return res.status(404).json({ error: "Transaction not found" });
    }

    // ─── Guard: jangan timpa transaksi yg sudah berhasil/dibayar dengan status gagal ───
    if (txStatus === "failed" && (transaction.status === "paid" || transaction.status === "success")) {
      console.log(`[iPaymu] Skip overwrite tx ${refId}: already ${transaction.status}, ignoring "gagal" callback`);
      return res.json({ success: true, message: "Ignored: transaction already paid/success" });
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: txStatus,
        payment_details: {
          ...(transaction.payment_details || {}),
          ipaymu_trx_id: trx_id || transaction_id,
          ipaymu_sid: sid,
          ipaymu_status: statusRaw,
          paid_at: txStatus === "paid" ? new Date().toISOString() : null,
        },
      })
      .eq("id", refId);
    if (updateError) throw updateError;
    if (
      txStatus === "paid" &&
      transaction.status !== "paid" &&
      transaction.status !== "success" &&
      transaction.transaction_items
    ) {
      await updateSellerBalances(transaction.transaction_items);
      await checkLowStockAndNotify(transaction.transaction_items);
      await updateBuyerPoints(refId, transaction.buyer_id, transaction.total_amount);
      await processDigitalItems(refId, transaction.transaction_items);
      await triggerSarirotiEmail(
        refId,
        transaction.buyer_name,
        transaction.total_amount,
      );
      if (transaction.buyer_id) {
        await sendNotification(transaction.buyer_id, {
          type: "transaction",
          title: "✅ Pembayaran Berhasil!",
          message: `Transaksi #${refId.slice(0, 8)} sebesar Rp ${Number(transaction.total_amount).toLocaleString("id-ID")} telah dikonfirmasi.`,
          path: `/kiosk/history?id=${refId}`,
        });
      }
      
      const uniqueSellers = [...new Set(transaction.transaction_items.map((item) => item.seller_id))];
      let hasKoperasi = false;
      for (const sellerId of uniqueSellers) {
        if (sellerId) {
          await sendNotification(sellerId, {
            type: 'transaction',
            title: '💰 Pesanan Baru Masuk!',
            message: `Ada pesanan baru #${refId.slice(0, 8)} dari ${transaction.buyer_name} yang perlu Anda proses.`,
            path: `/dashboard/seller/transactions?id=${refId}`,
          });
        } else {
          hasKoperasi = true;
        }
      }
      
      if (hasKoperasi) {
        const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin']);
        if (admins) {
          for (const admin of admins) {
            await sendNotification(admin.id, {
              type: 'transaction',
              title: '🛒 Pesanan Koperasi Baru',
              message: `Ada pesanan baru #${refId.slice(0, 8)} dari ${transaction.buyer_name}.`,
              path: `/dashboard/admin/transactions?id=${refId}`
            });
          }
        }
      }
    } else if (txStatus === "failed") {
      // ─── Cek apakah ada item digital yg sudah terkirim (delivered) ───
      const hasDeliveredDigital = (transaction.transaction_items || []).some(
        item => item.metadata?.is_digital && item.metadata?.status === 'delivered'
      );
      if (hasDeliveredDigital) {
        // Jika item digital sudah terkirim, jangan set status "failed", kembalikan ke "paid"
        console.log(`[iPaymu] Tx ${refId} has delivered digital items — reverting status to "paid" instead of "failed"`);
        await supabase
          .from("transactions")
          .update({ status: "paid" })
          .eq("id", refId);
        if (transaction.buyer_id) {
          await sendNotification(transaction.buyer_id, {
            type: "transaction",
            title: "✅ Pembayaran Berhasil!",
            message: `Transaksi #${refId.slice(0, 8)} sebesar Rp ${Number(transaction.total_amount).toLocaleString("id-ID")} telah dikonfirmasi.`,
            path: `/kiosk/history?id=${refId}`,
          });
        }
      } else {
        // Check if stock was already restored (prevent double-restore with auto-cleanup)
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("metadata")
          .eq("id", refId)
          .single();
        if (existingTx?.metadata?.stock_restored) {
          console.log(`[iPaymu] Tx ${refId} stock already restored — skipping`);
        } else {
          await restoreTransactionStock(refId);
        }
        if (transaction.buyer_id) {
          await sendNotification(transaction.buyer_id, {
            type: "transaction",
            title: "\u274C Pembayaran Gagal",
            message: `Transaksi #${refId.slice(0, 8)} Anda gagal diproses. Silakan coba kembali.`,
            path: `/kiosk/history?id=${refId}`,
          });
        }
      }
    }
    console.log("\u2705 Transaction Updated:", {
      reference_id: refId,
      txStatus,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("\u274C Callback Error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/payment/ipaymu/status/:reference_id", async (req, res) => {
  try {
    const { reference_id } = req.params;
    if (!IPAYMU_VA || !IPAYMU_API_KEY) {
      return res
        .status(500)
        .json({ success: false, error: "Ipaymu not configured" });
    }
    const status = await ipaymuClient.getTransactionStatus(reference_id);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error("\u274C Status Check Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/payment/ipaymu/methods", async (req, res) => {
  try {
    if (!IPAYMU_VA || !IPAYMU_API_KEY) {
      return res
        .status(500)
        .json({ success: false, error: "Ipaymu not configured" });
    }
    const methods = await ipaymuClient.getPaymentMethods();
    res.json({ success: true, data: methods });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/auth/reset-password-request", async (req, res) => {
  try {
    const { nikOrEmail } = req.body;
    if (!nikOrEmail) {
      return res.status(400).json({ error: "NIK atau Email wajib diisi" });
    }
    let userId = null;
    let userName = "Unknown";
    let userNik = null;
    const { data: profileByNik } = await supabase
      .from("profiles")
      .select("id, name, nik")
      .eq("nik", nikOrEmail)
      .single();
    if (profileByNik) {
      userId = profileByNik.id;
      userName = profileByNik.name;
      userNik = profileByNik.nik;
    } else {
      const listResult = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1e3,
      });
      const authUsers = listResult.data?.users ?? [];
      const listError = listResult.error;
      if (!listError && authUsers.length > 0) {
        const foundUser = authUsers.find(
          (u) => u.email?.toLowerCase() === nikOrEmail.toLowerCase(),
        );
        if (foundUser) {
          userId = foundUser.id;
          const { data: profileByEmail } = await supabase
            .from("profiles")
            .select("name, nik")
            .eq("id", userId)
            .single();
          if (profileByEmail) {
            userName = profileByEmail.name;
            userNik = profileByEmail.nik;
          }
        }
      }
    }
    if (!userId) {
      return res
        .status(404)
        .json({
          error:
            "Data tidak ditemukan. Pastikan NIK atau Email yang Anda masukkan benar.",
        });
    }
    const { error: requestError } = await supabase
      .from("password_reset_requests")
      .insert({
        user_id: userId,
        user_name: userName,
        user_nik: userNik,
        status: "pending",
      });
    if (requestError) throw requestError;

    // Fetch admins and create notifications
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const notificationsToInsert = admins.map((admin) => ({
        user_id: admin.id,
        type: "system",
        title: "🔑 Permintaan Reset Password Baru",
        message: `${userName} (${userNik || "Tidak ada NIK"}) meminta reset password.`,
        path: "/dashboard/admin#reset-requests",
      }));
      await supabase.from("notifications").insert(notificationsToInsert);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Reset password request error:", error);
    res
      .status(500)
      .json({ error: error.message || "Terjadi kesalahan pada server" });
  }
});

// Endpoint baru: Kirim email reset password dengan token manual
app.post("/api/auth/forgot-password-send-email", async (req, res) => {
  try {
    const { nikOrEmail } = req.body;
    if (!nikOrEmail) {
      return res.status(400).json({ error: "NIK atau Email wajib diisi" });
    }

    let userId = null;
    let userEmail = null;
    let userName = "User";

    // Cari user berdasarkan NIK atau email
    const { data: profileByNik } = await supabase
      .from("profiles")
      .select("id, name, nik, email")
      .eq("nik", nikOrEmail)
      .single();

    if (profileByNik) {
      userId = profileByNik.id;
      userName = profileByNik.name || "User";
      userEmail = profileByNik.email;
    } else if (nikOrEmail.includes('@')) {
      // Kalau input email, cari di auth.users
      const listResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authUsers = listResult.data?.users ?? [];
      const foundUser = authUsers.find(u => u.email?.toLowerCase() === nikOrEmail.toLowerCase());
      if (foundUser) {
        userId = foundUser.id;
        userEmail = foundUser.email;
        const { data: profileById } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", userId)
          .single();
        if (profileById) userName = profileById.name || "User";
      }
    }

    if (!userId || !userEmail) {
      return res.status(404).json({ error: "Akun tidak ditemukan" });
    }

    // Jangan izinkan reset untuk email fake
    if (userEmail.endsWith('@sps.local')) {
      return res.status(400).json({ error: "Akun ini tidak支持 reset password via email" });
    }

    // Generate token unik
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    // Simpan token ke database
    await supabase.from('password_reset_tokens').insert({
      user_id: userId,
      token: token,
      expires_at: expiresAt.toISOString()
    });

    // Kirim email dengan link reset
    const resetLink = `https://spscorner.store/reset-password?token=${token}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb;">🔐 Reset Password SPS Corner</h1>
        </div>
        <p style="font-size: 16px; color: #333;">Halo <strong>${userName}</strong>,</p>
        <p style="font-size: 14px; color: #666;">Anda meminta reset password untuk akun SPS Corner Anda.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #2563eb; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 12px; color: #999;">Link ini berlaku selama 1 jam. Jika Anda tidak meminta reset password, abaikan email ini.</p>
        <p style="font-size: 12px; color: #999; margin-top: 20px;">SPS Corner - Platformbelanja Karyawan</p>
      </div>
    `;

    const emailResult = await sendSarirotiEmailInternal(
      userEmail,
      "🔐 Reset Password SPS Corner",
      htmlContent
    );

    if (!emailResult.success) {
      return res.status(500).json({ error: "Gagal mengirim email: " + emailResult.error });
    }

    console.log(`✅ Reset password email sent to ${userEmail}`);
    res.json({ success: true, message: "Link reset password telah dikirim ke email Anda" });

  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: error.message || "Terjadi kesalahan" });
  }
});

// API endpoint untuk reset password dengan token manual
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token dan password wajib diisi" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password minimal 6 karakter" });
    }

    // Verifikasi token dari database
    const { data: tokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return res.status(400).json({ error: "Token tidak valid" });
    }

    // Cek apakah token sudah digunakan
    if (tokenData.used_at) {
      return res.status(400).json({ error: "Token sudah digunakan. Silakan minta link baru." });
    }

    // Cek apakah token expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: "Token sudah expired. Silakan minta link baru." });
    }

    // Update password user
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      tokenData.user_id,
      { password: newPassword }
    );

    if (updateError) {
      throw updateError;
    }

    // Tandai token sudah digunakan
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    console.log(`✅ Password reset successful for user ${tokenData.user_id}`);
    res.json({ success: true, message: "Password berhasil direset. Silakan login dengan password baru." });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: error.message || "Terjadi kesalahan saat reset password" });
  }
});
const getDigiflazzBalance = __name(async () => {
  if (isDefaultDigiflazz) return 0;
  try {
    const sign = crypto
      .createHash("md5")
      .update(DIGIFLAZZ_USERNAME + DIGIFLAZZ_API_KEY + "depo")
      .digest("hex");
    const response = await axios.post(
      "https://api.digiflazz.com/v1/cek-saldo",
      { cmd: "deposit", username: DIGIFLAZZ_USERNAME, sign },
    );
    return response.data?.data?.deposit || 0;
  } catch (err) {
    console.error(
      "Failed to get Digiflazz balance:",
      err?.response?.data || err.message,
    );
    return 0;
  }
}, "getDigiflazzBalance");
app.post("/api/transactions/create", async (req, res) => {
  try {
    const {
      buyer_name,
      buyer_id,
      buyer_phone,
      buyer_email,
      total_amount,
      items,
      payment_method,
      status,
      receipt_image,
    } = req.body;

    // ─── Idempotency: cek duplikat pending/paid untuk buyer yg sama dalam 60 detik ───
    if (buyer_id) {
      const sixtySecAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { data: recentTx } = await supabase
        .from("transactions")
        .select("id, status, total_amount, transaction_items(id, product_id, quantity, metadata)")
        .eq("buyer_id", buyer_id)
        .eq("status", "pending")
        .gte("created_at", sixtySecAgo)
        .order("created_at", { ascending: false })
        .limit(3);

      if (recentTx && recentTx.length > 0) {
        // Cari yg total_amount + item count sama (heuristic cukup kuat untuk cegah duplikat)
        const duplicate = recentTx.find((tx) => {
          if (Number(tx.total_amount) !== Number(total_amount)) return false;
          const existingCount = (tx.transaction_items || []).length;
          const incomingCount = (items || []).length;
          if (existingCount !== incomingCount) return false;
          return true;
        });
        if (duplicate) {
          console.log(`[Idempotency] Returning existing transaction ${duplicate.id} for buyer ${buyer_id}`);
          return res.json({ success: true, transaction: duplicate });
        }
      }
    }

    const digitalItems = items.filter((item) => item.is_digital);
    if (digitalItems.length > 0) {
      const totalDigitalValue = digitalItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const currentBalance = await getDigiflazzBalance();
      const estimatedHpp = totalDigitalValue * 0.95;
      if (currentBalance < estimatedHpp) {
        return res
          .status(400)
          .json({
            error: `Mohon maaf, saldo sistem (PPOB) sedang tidak mencukupi untuk memproses pesanan digital ini. Saldo: ${currentBalance}`,
          });
      }
    }

    // 1. Hitung Fee Platform (8%)
    const feeAmount = Math.round(total_amount * 0.08);
    // 2. Hitung Uang Bersih (Netto) yang menjadi milik Penjual
    const netAmount = total_amount - feeAmount;

    // 3. Modifikasi data transaksi utama
    const txDataToInsert = {
      buyer_name,
      buyer_phone,
      total_amount: total_amount, 
      status: status || "pending",
      metadata: { fee_platform: feeAmount, net_seller_amount: netAmount }
    };
    if (buyer_id) txDataToInsert.buyer_id = buyer_id;
    if (payment_method) txDataToInsert.payment_method = payment_method;
    if (receipt_image) txDataToInsert.receipt_image = receipt_image;
    if (buyer_email) txDataToInsert.payment_details = { buyer_email };
    
    const { data: txDataResult, error: txError } = await supabase
      .from("transactions")
      .insert(txDataToInsert)
      .select()
      .single();
    if (txError) throw txError;
    const tx = txDataResult;

    // 4. Modifikasi tabel Items
    const txItems = items.map((item) => {
      const itemGrossSubtotal = item.price * item.quantity;
      const itemFee = Math.round(itemGrossSubtotal * 0.08); 
      const itemNetSubtotal = itemGrossSubtotal - itemFee;

      return {
        transaction_id: tx.id,
        product_id: item.is_digital ? null : item.id,
        quantity: item.quantity,
        price: item.price,
        subtotal: itemNetSubtotal, // KRUSIAL: Ini yang akan dibaca saat update saldo seller nanti!
        seller_id: item.is_digital ? null : item.seller_id,
        metadata: item.is_digital
          ? {
              is_digital: true,
              status: "processing",
              target_number: item.target_number,
              product_name: item.name,
              sku: item.sku,
              is_postpaid: item.metadata?.is_postpaid,
              customer_name: item.metadata?.customer_name,
              segment_power: item.metadata?.segment_power,
            }
          : { fee_deducted: itemFee }, // Beri tanda di metadata kalau sudah dipotong fee
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from("transaction_items")
      .insert(txItems)
      .select();
    if (itemsError) throw itemsError;

    // ─── Server-side stock deduction (replaces frontend confirm_stock_deduction) ───
    const physicalItems = (insertedItems || []).filter(item => !item.metadata?.is_digital && item.product_id);
    let stockDeducted = false;
    if (physicalItems.length > 0) {
      let allDeducted = true;
      for (const item of physicalItems) {
        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", item.product_id)
          .single();

        if (product && product.stock >= item.quantity) {
          await supabase
            .from("products")
            .update({ stock: product.stock - item.quantity })
            .eq("id", item.product_id);

          await supabase.from("stock_adjustments").insert({
            product_id: item.product_id,
            user_id: item.seller_id || txDataToInsert.buyer_id,
            previous_stock: product.stock,
            new_stock: product.stock - item.quantity,
            adjustment_type: "sale",
            notes: `Stock deducted from transaction ${tx.id}`
          });
        } else {
          allDeducted = false;
        }
      }
      stockDeducted = allDeducted;
    }

    // Update transaction with stock_deducted flag in metadata
    await supabase
      .from("transactions")
      .update({
        metadata: { ...(tx.metadata || {}), stock_deducted: stockDeducted }
      })
      .eq("id", tx.id);

    // Also update local tx object for downstream use
    tx.metadata = { ...(tx.metadata || {}), stock_deducted: stockDeducted };

    if (tx.status === "paid" || tx.status === "success") {
      if (insertedItems && insertedItems.length > 0) {
        await processDigitalItems(tx.id, insertedItems);
      }
      await triggerSarirotiEmail(tx.id, buyer_name, total_amount);
      await updateSellerBalances(insertedItems); 
    }
    res.json({ success: true, transaction: tx });
  } catch (error) {
    console.error("Create transaction error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to create transaction" });
  }
});
app.post("/api/transactions/pay", async (req, res) => {
  try {
    const { transaction_id } = req.body;
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ status: "paid" })
      .eq("id", transaction_id);
    if (updateError) throw updateError;
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*, transaction_items(*)")
      .eq("id", transaction_id)
      .single();
    if (fetchError) throw fetchError;
    await processDigitalItems(transaction_id, transaction.transaction_items);
    await triggerSarirotiEmail(
      transaction_id,
      transaction.buyer_name,
      transaction.total_amount,
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Pay transaction error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to update transaction" });
  }
});
app.post("/api/transactions/cancel", async (req, res) => {
  try {
    const { transaction_id } = req.body;
    const { data: tx, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();
    if (fetchError || !tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (tx.status !== "pending" && tx.status !== "failed") {
      return res
        .status(400)
        .json({ error: "Hanya pesanan pending yang dapat dibatalkan." });
    }
    // Restore stock before deleting
    await restoreTransactionStock(transaction_id);
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction_id);
    if (deleteError) throw deleteError;
    res.json({ success: true, message: "Pesanan berhasil dibatalkan." });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/admin/transactions/cleanup", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") return res.status(403).json({ error: "Forbidden" });

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1e3).toISOString();
    const { data: expired, error: fetchError } = await supabase
      .from("transactions")
      .select("id, metadata")
      .in("status", ["pending"])
      .lt("created_at", fiveMinsAgo);
    if (fetchError) throw fetchError;
    if (!expired || expired.length === 0) {
      return res.json({ success: true, count: 0 });
    }
    for (const tx of expired) {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "failed",
          metadata: { ...(tx.metadata || {}), cancel_reason: "Auto-cancelled: Unpaid > 5 minutes" },
        })
        .eq("id", tx.id);
      if (updateError) throw updateError;
      await restoreTransactionStock(tx.id);
    }
    res.json({ success: true, count: expired.length });
  } catch (error) {
    console.error("Cleanup Error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/standby/check", async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().split(" ")[0];
    const { data: schedule, error } = await supabase
      .from("standby_schedules")
      .select("*")
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .lte("start_time", currentTime)
      .gte("end_time", currentTime);
    if (error) throw error;
    res.json({
      is_standby: schedule && schedule.length > 0,
      schedule: schedule && schedule.length > 0 ? schedule[0] : null,
      current_time: currentTime,
      day: dayOfWeek,
    });
  } catch (error) {
    console.error("Error checking standby schedule:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/password-resets", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return res.status(403).json({ error: "Forbidden: Admin only" });

    const { data: resets, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(resets || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/password-resets/complete", async (req, res) => {
  try {
    const { id } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return res.status(403).json({ error: "Forbidden: Admin only" });

    const { data: request, error: reqError } = await supabase
      .from('password_reset_requests')
      .select('user_id')
      .eq('id', id)
      .single();

    if (reqError || !request) {
      return res.status(404).json({ error: "Permintaan reset password tidak ditemukan." });
    }

    const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(request.user_id, {
      password: tempPassword
    });

    if (updateAuthError) throw updateAuthError;

    const { error } = await supabase
      .from('password_reset_requests')
      .update({ status: 'completed' })
      .eq('id', id);

    const { data: userProfile } = await supabase.from('profiles').select('email').eq('id', request.user_id).single();
    if (userProfile?.email) {
      sendSarirotiEmailInternal(
        userProfile.email,
        'Password Baru - SPS Corner',
        `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2>Password Anda Telah DiReset</h2>
          <p>Berikut password sementara Anda:</p>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;text-align:center;font-size:24px;font-family:monospace;letter-spacing:4px;margin:16px 0;">${tempPassword}</div>
          <p style="color:#ef4444;font-weight:bold;">Segera ganti password Anda setelah login.</p>
          <p style="color:#6b7280;font-size:12px;">Abaikan email ini jika Anda tidak meminta reset password.</p>
        </div>`
      ).catch(e => console.warn("[Email] Gagal kirim password reset:", e.message));
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/transactions/seller/:sellerId", async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { data: items, error } = await supabase
      .from('transaction_items')
      .select(`
        *,
        products ( name, category, seller_id ),
        transactions ( id, buyer_id, buyer_name, status, created_at, payment_method, metadata )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    // filter items that have non-null transactions
    const filteredItems = items?.filter((item: any) => 
      item.transactions !== null && 
      ['paid', 'success', 'completed'].includes(item.transactions.status)
    ) || [];
      
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(filteredItems);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
if (process.env.NODE_ENV !== "production") {
  app.get("/api/test-db4", async (req, res) => {
    try {
      const { data: items, error } = await supabase.from('transaction_items')
        .select(`*, products(name), transactions(id, buyer_id, buyer_name, status, created_at, payment_method)`)
        .eq('seller_id', 'cc4a7d0a-8020-4549-8e71-04bcbe673d1e')
        .order('created_at', { ascending: false });
      res.json({ count: items?.length, error: error?.message, items: items?.slice(0, 2) });
    } catch (e: any) { res.json({ error: e.message }); }
  });
  app.get("/api/test-db2", async (req, res) => {
    try {
      const { data } = await supabase.from('profiles').select('*')
        .in('id', ['0b11d7b5-d920-4c7b-bee0-472267ba92bc', 'cc4a7d0a-8020-4549-8e71-04bcbe673d1e']);
      res.json(data);
    } catch (e: any) { res.json({ error: e.message }); }
  });
  app.get("/api/test-db", async (req, res) => {
    try {
      const { data: sarirotiUsers } = await supabase.from("profiles").select("id, name")
        .eq("role", "seller").ilike("name", "%sariroti%");
      if (!sarirotiUsers || sarirotiUsers.length === 0) return res.json({ msg: "No sariroti seller" });
      const { data: items } = await supabase.from('transaction_items')
        .select(`id, seller_id, products ( name, category, seller_id )`)
        .order('created_at', { ascending: false }).limit(20);
      res.json({ users: sarirotiUsers, items });
    } catch (e: any) { res.json({ error: e.message }); }
  });
  app.get("/api/fix-sariroti", async (req, res) => {
    try {
      const { data: sarirotiUsers } = await supabase.from("profiles").select("id")
        .eq("role", "seller").ilike("name", "%sariroti%").limit(1);
      if (!sarirotiUsers || sarirotiUsers.length === 0) return res.json({ success: false, message: "Tidak ada admin sariroti" });
      const sarirotiId = sarirotiUsers[0].id;
      const { data: products } = await supabase.from("products").select("id")
        .or("category.eq.Sariroti,name.ilike.%roti%");
      if (products && products.length > 0) {
        const ids = products.map(p => p.id);
        await supabase.from("products").update({ seller_id: sarirotiId }).in("id", ids);
        await supabase.from("transaction_items").update({ seller_id: sarirotiId }).in("product_id", ids);
      }
      res.json({ success: true, message: "Berhasil mengaitkan Roti ke Admin Sariroti!", updatedProducts: (products || []).length });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });
}
app.get("/api/admin/stock-report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return res.status(403).json({ error: "Forbidden: Admin only" });

    const sellerFilter = req.query.seller_id as string | undefined;
    const dateStart = req.query.date_start as string | undefined;
    const dateEnd = req.query.date_end as string | undefined;
    const categoryFilter = req.query.category as string | undefined;

    // 1. Get all products
    let query = supabase
      .from("products")
      .select("id, name, stock, seller_id, created_at, category");
    if (sellerFilter) query = query.eq("seller_id", sellerFilter);
    if (dateStart) query = query.gte("created_at", dateStart + "T00:00:00+07:00");
    if (dateEnd) query = query.lte("created_at", dateEnd + "T23:59:59+07:00");
    if (categoryFilter) query = query.eq("category", categoryFilter);
    const { data: products, error: productsError } = await query;
    if (productsError) throw productsError;

    const productIds = products.map(p => p.id);

    // 2. Get stock adjustments within date range (or all if no range)
    let adjQuery = supabase
      .from("stock_adjustments")
      .select("product_id, adjustment_type, previous_stock, new_stock, created_at")
      .in("product_id", productIds);
    if (dateStart) adjQuery = adjQuery.gte("created_at", dateStart + "T00:00:00+07:00");
    if (dateEnd) adjQuery = adjQuery.lte("created_at", dateEnd + "T23:59:59+07:00");
    adjQuery = adjQuery.order("created_at", { ascending: true });
    const { data: adjustments, error: adjError } = await adjQuery;
    if (adjError) throw adjError;

    // 3. Group adjustments by product — separate retur (stock down) vs restore (stock up from cancel)
    const adjustmentsByProduct: Record<string, {
      restock: number; sold: number; returned: number; restored: number; manualUpdate: number;
    }> = {};
    for (const adj of adjustments || []) {
      const productId = adj.product_id;
      if (!adjustmentsByProduct[productId]) {
        adjustmentsByProduct[productId] = { restock: 0, sold: 0, returned: 0, restored: 0, manualUpdate: 0 };
      }
      const entry = adjustmentsByProduct[productId];
      if (adj.adjustment_type === "restock") {
        entry.restock += (adj.new_stock - adj.previous_stock);
      } else if (adj.adjustment_type === "sale") {
        entry.sold += (adj.previous_stock - adj.new_stock);
      } else if (adj.adjustment_type === "correction") {
        const diff = adj.new_stock - adj.previous_stock;
        if (diff > 0) {
          entry.restored += diff;
        } else {
          entry.returned += Math.abs(diff);
        }
      } else if (adj.adjustment_type === "manual_update") {
        entry.manualUpdate += (adj.new_stock - adj.previous_stock);
      }
    }

    // 4. Build report — initialStock derived: StokAwal = StokAkhir - Restock + Terjual + Retur - Restore +/- Manual
    const report = products.map(product => {
      const d = adjustmentsByProduct[product.id] || { restock: 0, sold: 0, returned: 0, restored: 0, manualUpdate: 0 };
      const netChange = d.restock - d.sold - d.returned + d.restored + d.manualUpdate;
      const initialStock = product.stock - netChange;

      return {
        id: product.id,
        name: product.name,
        seller_id: product.seller_id,
        createdAt: product.created_at,
        initialStock,
        totalRestock: d.restock,
        totalSold: d.sold,
        totalReturned: d.returned,
        totalRestored: d.restored,
        totalManualUpdate: d.manualUpdate,
        currentStock: product.stock
      };
    });

    // 5. Get sellers info
    const sellerIds = [...new Set(products.map(p => p.seller_id).filter(Boolean))];
    let sellersMap: Record<string, string> = {};
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase.from("profiles").select("id, name").in("id", sellerIds);
      for (const s of sellers || []) sellersMap[s.id] = s.name;
    }

    // 6. Get all categories for filter
    let allCategories: string[] = [];
    try {
      const { data: categoryRows } = await supabase.from("products").select("category");
      allCategories = [...new Set((categoryRows || []).map(c => c.category).filter(Boolean))];
    } catch (e) {
      // categories column may not exist — ignore
    }

    res.json({ report, sellers: sellersMap, categories: allCategories });
  } catch (err: any) {
    console.error("Stock report error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/test-email", async (req, res) => {
  try {
    const { to } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user)
      return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin")
      return res.status(403).json({ error: "Forbidden: Admin only" });
    let targetEmail =
      to || process.env.SARIROTI_ADMIN_EMAIL || "Sales.Adm.bjm@sariroti.com";
    if (!to) {
      try {
        const { data: settingsData } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "contact_info_content")
          .single();
        if (settingsData && settingsData.value) {
          const contactInfo =
            typeof settingsData.value === "string"
              ? JSON.parse(settingsData.value)
              : settingsData.value;
          if (contactInfo.email) {
            targetEmail = contactInfo.email;
          }
        }
      } catch (e) {
        console.error(
          "Failed to fetch contact info from settings for test email",
          e,
        );
      }
    }
    const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0056b3;">Test Email Sariroti</h2>
          <p>Halo Admin,</p>
          <p>Ini adalah email percobaan untuk memastikan sistem notifikasi Sariroti berfungsi dengan baik.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Status:</strong> Aktif</p>
            <p><strong>Waktu:</strong> ${new Date().toLocaleString("id-ID")}</p>
            <p><strong>Target:</strong> ${targetEmail}</p>
          </div>
          <p>Jika Anda menerima email ini, berarti konfigurasi Gmail Nodemailer sudah benar.</p>
        </div>
      `;
    const result = await sendSarirotiEmailInternal(
      targetEmail,
      "Test Email Sariroti - Berhasil",
      emailHtml,
    );
    if (result.success) {
      res.json({
        success: true,
        message: "Test email sent successfully",
        data: result.data,
      });
    } else {
      res
        .status(500)
        .json({
          error: "Failed to send test email",
          details: result.error,
          tip: "Pastikan GMAIL_USER dan GMAIL_APP_PASSWORD sudah benar di Environment Variables.",
        });
    }
  } catch (error) {
    console.error("Error in test-email endpoint:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

app.post("/api/report", async (req, res) => {
  try {
    const { type, message, url, userAgent, userId } = req.body;
    const fs = await import('fs');
    const path = await import('path');
    
    const reportObj = {
      timestamp: new Date().toISOString(),
      type: type || 'unknown',
      message: message || '',
      url: url || '',
      userAgent: userAgent || '',
      userId: userId || 'anonymous'
    };
    
    const logLine = `[${reportObj.timestamp}] [${reportObj.type.toUpperCase()}] User: ${reportObj.userId} | URL: ${reportObj.url} | Message: ${reportObj.message} | UA: ${reportObj.userAgent}\n`;
    const logFile = path.resolve(process.cwd(), 'error_history.txt');
    
    fs.appendFileSync(logFile, logLine);

    // Also send notification to all admins/superadmins
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'superadmin']);
        
      if (admins && admins.length > 0) {
        const notificationsToInsert = admins.map(admin => ({
          user_id: admin.id,
          type: 'system',
          title: `Laporan Baru: ${reportObj.type.toUpperCase()}`,
          message: reportObj.message.length > 80 ? reportObj.message.substring(0, 80) + '...' : reportObj.message,
          path: '/dashboard/admin/reports'
        }));
        await supabase.from('notifications').insert(notificationsToInsert);
      }
    } catch (dbErr) {
      console.error("Gagal mengirim notif ke admin:", dbErr);
    }

    res.json({ success: true, message: "Laporan berhasil dikirim dan dicatat." });
  } catch (error) {
    console.error("Gagal menyimpan laporan:", error);
    res.status(500).json({ error: "Gagal menyimpan laporan" });
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const logFile = path.resolve(process.cwd(), 'error_history.txt');
    
    if (!fs.existsSync(logFile)) {
      return res.json({ success: true, data: [] });
    }
    
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    const reports = lines.map((line, index) => {
      // Very basic parsing
      // Format: [TIMESTAMP] [TYPE] User: USER_ID | URL: URL | Message: MESSAGE | UA: UA
      const match = line.match(/^\[(.*?)\] \[(.*?)\] User: (.*?) \| URL: (.*?) \| Message: (.*?) \| UA: (.*)$/);
      if (match) {
        return {
          id: index.toString(),
          timestamp: match[1],
          type: match[2],
          userId: match[3],
          url: match[4],
          message: match[5],
          userAgent: match[6]
        };
      }
return { id: index.toString(), raw: line, timestamp: new Date().toISOString() };
      });
      
      res.json({ success: true, data: reports.reverse().slice(0, 100) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

// ========== SELLER REGISTRATION ==========

// API untuk admin generate link pendaftaran seller
app.post("/api/admin/seller-registration-links", async (req, res) => {
  try {
    const { days, maxUses = 1, notes } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized - no auth header" });
    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized - no token" });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError) return res.status(401).json({ error: `Unauthorized - ${authError.message}` });
    if (!user) return res.status(401).json({ error: "Unauthorized - no user" });

    const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!adminProfile || (adminProfile.role !== "admin" && adminProfile.role !== "superadmin")) {
      return res.status(403).json({ error: "Hanya admin yang dapat membuat link" });
    }

    if (!days || days < 1 || days > 30) {
      return res.status(400).json({ error: "Hari harus antara 1-30" });
    }

    const regToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("seller_registration_links")
      .insert({
        token: regToken,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        max_uses: maxUses,
        notes
      })
      .select()
      .single();

    if (error) throw error;

    const link = `https://spscorner.store/register-seller?token=${regToken}`;
    
    console.log(`✅ Seller registration link created: ${link}`);
    res.json({ 
      success: true, 
      link,
      expiresAt: expiresAt.toISOString(),
      maxUses: maxUses
    });

  } catch (error: any) {
    console.error("Error creating seller link:", error);
    res.status(500).json({ error: error.message });
  }
});

// API untuk cek validitas link
app.get("/api/seller-registration/verify", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Token diperlukan" });
    }

    const { data: link, error } = await supabase
      .from("seller_registration_links")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (error || !link) {
      return res.status(404).json({ valid: false, error: "Link tidak ditemukan atau tidak aktif" });
    }

    // Cek expired
    if (new Date(link.expires_at) < new Date()) {
      return res.status(400).json({ valid: false, error: "Link sudah expired" });
    }

    // Cek max uses
    if (link.used_count >= link.max_uses) {
      return res.status(400).json({ valid: false, error: "Link sudah mencapai batas penggunaan" });
    }

    res.json({ 
      valid: true, 
      expiresAt: link.expires_at,
      notes: link.notes
    });

  } catch (error: any) {
    console.error("Verify link error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API untuk daftar sebagai seller
app.post("/api/seller-register", async (req, res) => {
  try {
    const { token, nik, name, email, phone, bankName, bankAccountNumber, bankAccountName, password } = req.body;

    if (!token || !nik || !name || !email || !phone || !password) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }

    // Verifikasi link
    const { data: link, error: linkError } = await supabase
      .from("seller_registration_links")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (linkError || !link) {
      return res.status(400).json({ error: "Link tidak valid" });
    }

    if (new Date(link.expires_at) < new Date()) {
      return res.status(400).json({ error: "Link sudah expired" });
    }

    if (link.used_count >= link.max_uses) {
      return res.status(400).json({ error: "Link sudah reach limit" });
    }

    // Cek NIK sudah terdaftar belum
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("nik", nik.trim())
      .single();

    let userId;

    if (existingProfile) {
      // User sudah ada, update jadi seller
      if (existingProfile.role === "seller") {
        return res.status(400).json({ error: "NIK ini sudah terdaftar sebagai seller" });
      }
      
      userId = existingProfile.id;
      
      // Update profile jadi seller + data bank (JANGAN overwrite role jika sudah admin/superadmin)
      const currentRole = existingProfile.role;
      const newRole = (currentRole === "admin" || currentRole === "superadmin") ? currentRole : "seller";
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          role: newRole,
          email: email.trim(),
          phone: phone.trim(),
          bank_name: bankName,
          bank_account_number: bankAccountNumber,
          bank_account_name: bankAccountName,
          seller_registered_at: new Date().toISOString(),
          seller_registration_token: token
        })
        .eq("id", userId);

      if (updateError) throw updateError;

    } else {
      // Buat user baru di Supabase Auth + profile
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nik: nik.trim(),
            name: name.trim(),
            phone: phone.trim(),
            role: "seller"
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Gagal membuat akun");

      userId = authData.user.id;

      // Update profile dengan data bank + ensure role is seller (jika trigger gagal set role)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          role: "seller", // Explicitly set role to seller
          email: email.trim(),
          phone: phone.trim(),
          bank_name: bankName,
          bank_account_number: bankAccountNumber,
          bank_account_name: bankAccountName,
          seller_registered_at: new Date().toISOString(),
          seller_registration_token: token
        })
        .eq("id", userId);

      if (profileError) throw profileError;
    }

    // Update link usage count
    await supabase
      .from("seller_registration_links")
      .update({ used_count: link.used_count + 1 })
      .eq("id", link.id);

    // Nonaktifkan link kalau sudah reach max uses
    if (link.used_count + 1 >= link.max_uses) {
      await supabase
        .from("seller_registration_links")
        .update({ is_active: false })
        .eq("id", link.id);
    }

    console.log(`✅ Seller registered: ${email} (NIK: ${nik})`);
    res.json({ success: true, message: "Pendaftaran seller berhasil! Silakan login." });

  } catch (error: any) {
    console.error("Seller registration error:", error);
    res.status(500).json({ error: error.message || "Terjadi kesalahan" });
  }
});

// API untuk cek produk seller (validasi tidak boleh sama)
app.get("/api/seller/products/check", async (req, res) => {
  try {
    const { name, category, sellerId } = req.query;
    
    if (!name || !category || !sellerId) {
      return res.status(400).json({ error: "Parameter tidak lengkap" });
    }

    // Cek produk seller sendiri yang masih aktif
    const { data: existingProducts } = await supabase
      .from("products")
      .select("id, name, category")
      .eq("seller_id", sellerId)
      .eq("is_active", true);

    if (existingProducts && existingProducts.length > 0) {
      // Cek nama sama (case insensitive)
      const sameName = existingProducts.find(p => 
        p.name.toLowerCase() === (name as string).toLowerCase()
      );
      
      if (sameName) {
        return res.json({ 
          allowed: false, 
          reason: `Produk dengan nama "${sameName.name}" sudah ada` 
        });
      }

      // Cek kategori sama
      const sameCategory = existingProducts.filter(p => 
        p.category.toLowerCase() === (category as string).toLowerCase()
      );

      if (sameCategory.length >= 3) {
        return res.json({ 
          allowed: false, 
          reason: `Kategori "${category}" sudah ada ${sameCategory.length} produk. Maksimal 3 produk per kategori.` 
        });
      }
    }

    res.json({ allowed: true });

} catch (error: any) {
    console.error("Check product error:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// API: Program Serikat Push Method (Coupons & Doorprize)
// =====================================================

// Generate coupons from eligibility (Bulk)
app.post("/api/admin/programs/:programId/generate-coupons", async (req, res) => {
  try {
    const { programId } = req.params;
    const { couponType = 'attendance', prefix = 'ATT' } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: Admin only" });
    }

    const result = await supabase.rpc("generate_program_coupons", {
      p_program_id: programId,
      p_coupon_type: couponType,
      p_prefix: prefix
    });
    
    if (result.error) throw result.error;
    
    res.json({ success: true, count: result.data, message: `${result.data} kupon berhasil digenerate` });
  } catch (error: any) {
    console.error("Generate coupons error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate manual coupon (external/affiliate)
app.post("/api/admin/programs/:programId/manual-coupon", async (req, res) => {
  try {
    const { programId } = req.params;
    const { nik, name } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: Admin only" });
    }

    const result = await supabase.rpc("generate_manual_coupon", {
      p_program_id: programId,
      p_nik: nik,
      p_name: name,
      p_creator_id: user.id
    });
    
    if (result.error) throw result.error;
    
    res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error("Generate manual coupon error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Claim/scan coupon
app.post("/api/admin/coupons/claim", async (req, res) => {
  try {
    const { qrCode } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: Admin only" });
    }

    const result = await supabase.rpc("claim_program_coupon", {
      p_qr_code: qrCode,
      p_scanner_user_id: user.id
    });
    
    if (result.error) throw result.error;
    
    res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error("Claim coupon error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Bypass attendance (remote doorprize)
app.post("/api/admin/programs/:programId/bypass-attendance", async (req, res) => {
  try {
    const { programId } = req.params;
    const { nik } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: Admin only" });
    }

    const result = await supabase.rpc("bypass_attendance_coupon", {
      p_program_id: programId,
      p_nik: nik,
      p_scanner_user_id: user.id
    });
    
    if (result.error) throw result.error;
    
    res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error("Bypass attendance error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Draw doorprize winner
app.post("/api/admin/programs/:programId/draw-doorprize", async (req, res) => {
  try {
    const { programId } = req.params;
    const { prizeName } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: Admin only" });
    }

    const result = await supabase.rpc("draw_doorprize_winner", {
      p_program_id: programId,
      p_prize_name: prizeName,
      p_drawer_id: user.id
    });
    
    if (result.error) throw result.error;
    
    res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error("Draw doorprize error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get program coupons
app.get("/api/admin/programs/:programId/coupons", async (req, res) => {
  try {
    const { programId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: Admin only" });
    }

    const { data, error } = await supabase
      .from("program_coupons")
      .select("*")
      .eq("program_id", programId)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Get coupons error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get doorprize logs
app.get("/api/admin/programs/:programId/doorprize-log", async (req, res) => {
  try {
    const { programId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: Admin only" });
    }

    const { data, error } = await supabase
      .from("program_doorprize_log")
      .select("*")
      .eq("program_id", programId)
      .order("draw_sequence", { ascending: true });
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Get doorprize log error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's coupons (for portal)
app.get("/api/portal/my-coupons", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("program_coupons")
      .select("*, union_programs(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Get my coupons error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Notify about new/activated program — targeted if is_targeted, else all employees
app.post("/api/admin/programs/notify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") return res.status(403).json({ error: "Forbidden" });

    const { program_id, title } = req.body;
    if (!program_id || !title) return res.status(400).json({ error: "program_id and title required" });

    const { data: program } = await supabase.from("union_programs").select("is_targeted, name, start_date, end_date").eq("id", program_id).single();
    if (!program) return res.status(404).json({ error: "Program not found" });

    const formatDate = (d) => {
      if (!d) return null;
      const date = new Date(d);
      return date.toLocaleDateString("id-ID", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    };

    const startStr = formatDate(program.start_date);
    const endStr = formatDate(program.end_date);
    let scheduleMsg = "";
    if (startStr && endStr) {
      scheduleMsg = `\n🗓 Pelaksanaan: ${startStr} - ${endStr}`;
    } else if (startStr) {
      scheduleMsg = `\n🗓 Mulai: ${startStr}`;
    }

    // Get all employee users (NIK starts with digit or M)
    const { data: users } = await supabase.from("profiles").select("id, nik");
    const employeeUsers = (users || []).filter(u => u.nik && /^[0-9Mm]/.test(u.nik));

    if (employeeUsers.length === 0) return res.json({ success: true, count: 0 });

    if (program.is_targeted) {
      // Get targeted NIKs from eligibility
      const { data: eligibility } = await supabase.from("program_eligibility").select("nik").eq("program_id", program_id);
      const targetedNikSet = new Set((eligibility || []).map(e => e.nik));

      for (const u of employeeUsers) {
        if (targetedNikSet.has(u.nik)) {
          await sendNotification(u.id, {
            type: "system",
            title: `🎯 Program Baru: ${title}`,
            message: `Program "${title}" telah dibuka! Anda terdaftar sebagai peserta dan berhak menerima manfaat program ini. Cek kupon Anda di menu Program.${scheduleMsg}`,
            path: "/portal/program"
          });
        } else {
          await sendNotification(u.id, {
            type: "system",
            title: `📢 Program Baru: ${title}`,
            message: `Program "${title}" telah dibuka di Portal Serikat. Segera cek informasi dan jadwalnya!${scheduleMsg}`,
            path: "/portal/program"
          });
        }
      }
    } else {
      // Non-targeted: notify all employees
      await Promise.allSettled(employeeUsers.map(u => sendNotification(u.id, {
        type: "system",
        title: `📢 Program Baru: ${title}`,
        message: `Program "${title}" telah dibuka di Portal Serikat. Segera cek informasi dan jadwalnya!${scheduleMsg}`,
        path: "/portal/program"
      })));
    }

    res.json({ success: true, count: employeeUsers.length });
  } catch (error: any) {
    console.error("Program notify error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Broadcast notification to all users
app.post("/api/notifications/broadcast", async (req, res) => {
  try {
    const { title, message, url = "/" } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: Admin only" });
    }

    // Get all users so it appears in notification panel even if no push subscription
    // Only send to employees (NIK starts with digit or M), not vendors (NIK starts with H)
    const { data: users, error } = await supabase.from("profiles").select("id, nik");
    if (error) throw error;
    
    const employeeUsers = (users || []).filter(u => u.nik && /^[0-9Mm]/.test(u.nik));
    
    if (employeeUsers.length > 0) {
      const userIds = employeeUsers.map(u => u.id);
      await Promise.allSettled(userIds.map(id => sendNotification(id, {
        type: 'system',
        title: title,
        message: message,
        path: url
      })));
    }
    
    res.json({ success: true, count: employeeUsers.length });
  } catch (error: any) {
    console.error("Broadcast push error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test push endpoint (localhost only)
app.post("/api/push/test", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress;
    if (clientIp !== "127.0.0.1" && clientIp !== "::1" && clientIp !== "::ffff:127.0.0.1") {
      return res.status(403).json({ error: "Localhost only" });
    }
    const { userId, title = "Test Push", message = "Test dari VPS", url = "/" } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    await sendNotification(userId, { type: "system", title, message, path: url });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Test push error:", error);
    res.status(500).json({ error: error.message });
  }
});

if (!process.env.VERCEL) {
  const PORT = 3e3;
  (async () => {
    // ── Pre-Order Share / OG Tags Route ────────────────────────────
    app.get("/kiosk/pre-order/:id", async (req, res, next) => {
      const ua = (req.headers["user-agent"] || "").toLowerCase();
      const isCrawler = /facebook|twitter|whatsapp|telegram|discord|googlebot|slack|pinterest|linkedin/.test(ua);

      if (!isCrawler) return next();

      try {
        const { data: config } = await supabase
          .from("pre_order_configs")
          .select("*, products!inner(id, name, price, image_url, description, category)")
          .eq("id", req.params.id)
          .single();

        if (!config) return next();

        const product = config.products;
        const title = `${product.name} - Pre-Order SPS Corner`;
        const description = product.description || `Pre-Order ${product.name} - SPS Corner`;
        const imageUrl = product.image_url || "https://spscorner.store/og-default.jpg";
        const pageUrl = `https://spscorner.store/kiosk/pre-order/${req.params.id}`;

        res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description.replace(/"/g, '&quot;')}" />
  <meta property="og:title" content="${product.name.replace(/"/g, '&quot;')}" />
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="SPS Corner" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${product.name.replace(/"/g, '&quot;')}" />
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <script>location.replace("${pageUrl}");</script>
</head>
<body>
  <h1>${product.name}</h1>
  <p>${description}</p>
</body>
</html>`);
      } catch {
        return next();
      }
    });

    // API 404 catch-all — return JSON instead of HTML for unmatched API routes
    app.use('/api/*', (req, res) => {
      res.status(404).json({ error: 'API endpoint not found' });
    });

    if (process.env.NODE_ENV !== "production") {
      const viteModule = "vite";
      const { createServer: createViteServer } = await import(viteModule).then(
        (s) => {
          const e = "default";
          return s[e] && typeof s[e] == "object" && "__esModule" in s[e]
            ? s[e]
            : s;
        },
      );
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static("dist"));
      app.get("*", (req, res) => {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        );
        res.sendFile("dist/index.html", { root: "." });
      });
    }
    // =====================================================
    // NEW ROUTE: FAMILY PAYMENT CHECKOUT
    // =====================================================
app.post("/api/portal/programs/:programId/checkout-family", async (req, res) => {
      try {
        const { programId } = req.params;
        const { userId, familyCount, totalAmount, userEmail, userName, userPhone } = req.body;

        if (!familyCount || familyCount < 1 || !totalAmount) return res.status(400).json({ error: "Invalid data" });

        // 1. Create Pending Coupon
        const familyCode = `FAM-${userId?.slice(0,4) || 'USER'}-${Date.now()}`;
        const { data: newCoupon, error: insertError } = await supabase
          .from('program_coupons')
          .insert({
            program_id: programId,
            user_id: userId,
            nik: 'PENDING_PAYMENT',
            name: userName || 'Karyawan SPS',
            email: userEmail,
            phone: userPhone,
            coupon_code: familyCode,
            gate_type: 'attendance_family',
            status: 'active',
            metadata: { family_count: familyCount, total_price: totalAmount, payment_status: 'pending' }
          })
          .select()
          .single();
        if (insertError) throw insertError;

        // 2. Call iPaymu Direct
        const directPaymentData = {
            name: userName || 'Karyawan SPS',
            phone: userPhone || '0812000000', 
            email: userEmail || 'user@sps.store',
            amount: totalAmount,
            comments: `Pembayaran Keluarga Gathering - ${familyCount} Orang`,
            notifyUrl: `${process.env.APP_URL}/api/payment/ipaymu/callback`,
            referenceId: newCoupon.id,
            paymentMethod: 'QRIS',
            paymentChannel: 'qris' 
        };

        console.log("Sending iPaymu direct payment:", directPaymentData);
        const paymentResponse = await ipaymuClient.createDirectPayment(directPaymentData);
        console.log("iPaymu response:", paymentResponse);
        
        // 3. Response
        if (paymentResponse.Status === 200 && paymentResponse.Data) {
            const qrisData = paymentResponse.Data.QrCode || paymentResponse.Data.Url || "PAYMENT_PENDING";
            res.json({ 
                success: true, 
                qris_string: qrisData,
                coupon_id: newCoupon.id,
                amount: totalAmount 
            });
        } else {
            throw new Error(paymentResponse.Message || "Gagal generate QRIS");
        }
} catch (error: any) {
        console.error("Checkout Family Error:", error);
        res.status(500).json({ error: error.message || "Terjadi kesalahan" });
      }
    });

    // ── Auto-cleanup expired transactions every 3 minutes ─────────────────
    async function autoCleanup() {
      try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1e3).toISOString();
        const { data: expired } = await supabase
          .from("transactions")
          .select("id, metadata")
          .in("status", ["pending"])
          .lt("created_at", fiveMinsAgo);
        if (!expired || expired.length === 0) return;
        for (const tx of expired) {
          await supabase
            .from("transactions")
            .update({
              status: "failed",
              metadata: { ...(tx.metadata || {}), cancel_reason: "Auto-cancelled: Unpaid > 5 minutes" },
            })
            .eq("id", tx.id);
          await restoreTransactionStock(tx.id);
        }
        if (expired.length > 0) {
          console.log(`[AutoCleanup] Restored stock for ${expired.length} expired transaction(s)`);
        }
      } catch (e) {
        console.error("[AutoCleanup] Error:", e);
      }
    }
    autoCleanup();
    setInterval(autoCleanup, 3 * 60 * 1e3);

    let lastDailyReportDate = "";
    const dailyReport = __name(async () => {
      try {
        const now = new Date();
        const witaOffset = 8 * 60;
        const wita = new Date(now.getTime() + witaOffset * 60 * 1000);
        const todayStr = wita.toISOString().slice(0, 10);
        if (lastDailyReportDate === todayStr) return;
        const hourWITA = wita.getUTCHours();
        const minWITA = wita.getUTCMinutes();
        if (hourWITA !== 20 || minWITA > 5) return;

        lastDailyReportDate = todayStr;
        console.log(`[DailyReport] Sending daily report for ${todayStr}`);

        const { data: sellers } = await supabase.from("profiles").select("id").eq("role", "seller");
        if (!sellers || sellers.length === 0) return;

        const dayStart = new Date(Date.UTC(wita.getUTCFullYear(), wita.getUTCMonth(), wita.getUTCDate(), 0, 0, 0) - witaOffset * 60 * 1000).toISOString();

        for (const seller of sellers) {
          try {
            const { data: items } = await supabase
              .from("transaction_items")
              .select("id, transaction_id, quantity, subtotal, transactions!inner(id, total_amount, status, created_at)")
              .eq("seller_id", seller.id)
              .gte("transactions.created_at", dayStart);

            if (!items || items.length === 0) continue;

            const txMap = new Map();
            for (const item of items) {
              const tx = item.transactions;
              if (!txMap.has(tx.id)) {
                txMap.set(tx.id, { ...tx, itemCount: 0, itemRevenue: 0 });
              }
              const entry = txMap.get(tx.id);
              entry.itemCount += item.quantity;
              entry.itemRevenue += Number(item.subtotal || 0);
            }
            const txns = Array.from(txMap.values());
            const totalCount = txns.length;
            const totalRevenue = txns.reduce((s, t) => s + Number(t.total_amount || 0), 0);
            const pendingCount = txns.filter(t => t.status === "pending").length;
            const processedCount = txns.filter(t => t.status === "processed").length;
            const readyCount = txns.filter(t => t.status === "ready_for_pickup" || t.status === "pending_pickup").length;
            const completedCount = txns.filter(t => t.status === "completed" || t.status === "paid" || t.status === "success").length;

            const revFormatted = totalRevenue.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            await sendNotification(seller.id, {
              type: "system",
              title: "Laporan Harian",
              message: `Ringkasan hari ini: ${totalCount} pesanan, Rp${revFormatted}. ${completedCount} selesai, ${pendingCount} pending, ${processedCount} diproses, ${readyCount} siap ambil.`,
              path: "/dashboard/seller/dashboard"
            });
          } catch (e) {
            console.error(`[DailyReport] Error for seller ${seller.id}:`, e);
          }
        }
      } catch (e) {
        console.error("[DailyReport] Error:", e);
      }
    }, "dailyReport");
    setInterval(dailyReport, 60 * 1e3);

    // ── Program start notifications every 30 seconds ─────────────────────
    const notifiedProgramStarts = new Set();
    async function checkProgramStartNotifications() {
      try {
        const now = new Date().toISOString();
        const { data: programs } = await supabase
          .from("union_programs")
          .select("id, name")
          .eq("is_active", true)
          .lte("start_date", now)
          .gte("start_date", new Date(Date.now() - 120 * 1e3).toISOString());

        if (!programs || programs.length === 0) return;

        for (const prog of programs) {
          if (notifiedProgramStarts.has(prog.id)) continue;
          notifiedProgramStarts.add(prog.id);

          const { data: couponHolders } = await supabase
            .from("program_coupons")
            .select("user_id")
            .eq("program_id", prog.id)
            .not("user_id", "is", null);

          if (!couponHolders || couponHolders.length === 0) continue;

          const uniqueUserIds = [...new Set(couponHolders.map(c => c.user_id))];
          for (const userId of uniqueUserIds) {
            await sendNotification(userId, {
              type: "system",
              title: `🎫 Program Dimulai: ${prog.name}`,
              message: `Program "${prog.name}" telah dimulai! Segera tukarkan kupon Anda dan hadiri acaranya. Cek detail & kupon di menu Program.`,
              path: "/portal/program"
            });
          }
          console.log(`[ProgramStartNotif] Sent to ${uniqueUserIds.length} users for "${prog.name}"`);
        }
      } catch (e) {
        console.error("[ProgramStartNotif] Error:", e);
      }
    }
    checkProgramStartNotifications();
    setInterval(checkProgramStartNotifications, 30 * 1e3);

    // Sentry error handler (must be last middleware)
    if (process.env.SENTRY_DSN) {
      app.use(Sentry.Handlers.errorHandler());
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })();
}

var server_default = app;
export { server_default as default };
