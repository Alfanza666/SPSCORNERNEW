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
import cors from "cors";
import rateLimit from "express-rate-limit";
import { HttpsProxyAgent } from "https-proxy-agent";
import * as Sentry from "@sentry/node";
import { IpaymuClient } from "./src/services/ipaymu/client.js";
import { IpaymuSignature } from "./src/services/ipaymu/signature.js";
import { requireAuth, requireRole } from "./src/middleware/auth.js";
import { registerWithdrawalRoutes } from "./src/routes/withdrawals.js";
import { registerStockRoutes } from "./src/routes/stock.js";
import { registerProductReturnRoutes } from "./src/routes/productReturns.js";
import { registerPushRoutes } from "./src/routes/push.js";
import { registerAnalyticsRoutes } from "./src/routes/analytics.js";
import { registerMiscRoutes } from "./src/routes/misc.js";
import { registerAuthRoutes } from "./src/routes/auth.js";
import { registerPortalRoutes } from "./src/routes/portal.js";
import { registerPaymentRoutes } from "./src/routes/payments.js";
import { registerDiagnosticsRoutes } from "./src/routes/diagnostics.js";
import { registerDigitalRoutes } from "./src/routes/digital.js";
import { registerTransactionRoutes } from "./src/routes/transactions.js";
import { registerAdminRoutes } from "./src/routes/admin.js";
import { initNotificationService, sendNotification, sendPushToUser, sendPushToAdmins } from "./src/services/notification.js";
import { initStockService, restoreTransactionStock, checkLowStockAndNotify } from "./src/services/stock.js";
import { initEmailService, sendSarirotiEmailInternal, triggerSarirotiEmail, sendBuyerReceiptEmail } from "./src/services/email.js";
import { initPaymentService, updateSellerBalances, updateBuyerPoints } from "./src/services/payment.js";
import { initBackgroundJobs, autoCleanup, dailyReport, checkProgramStartNotifications } from "./src/services/background-jobs.js";
import { processDigitalItems, updateDigiflazzCache } from "./src/services/digiflazz.js";
import { initWANotification, sendWANotification } from "./src/services/wa-notification.js";
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
import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();

// Trust proxy — VPS di belakang Vercel reverse proxy, X-Forwarded-For header perlu di-trust
app.set("trust proxy", 1);

// Init service modules
initNotificationService(supabase, webpush);
initStockService(supabase, sendNotification, sendWANotification);
initEmailService(supabase, nodemailer);
initPaymentService(supabase);
initBackgroundJobs(supabase, sendNotification, restoreTransactionStock, sendSarirotiEmailInternal);
initWANotification(supabase);
setTimeout(() => updateDigiflazzCache(), 100);

// Sentry auto-instruments Express requests in SDK v8+, so manual requestHandler and tracingHandler are not needed.

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
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.supabase.co"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co", "https://lh3.googleusercontent.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://*.supabase.co", "https://api.spscorner.store", "https://my.ipaymu.com", "https://sandbox.ipaymu.com"],
      frameSrc: ["'self'", "https://*.supabase.co"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS — izinkan akses dari domain resmi
app.use(cors({
  origin: [
    'https://www.spscorner.store',
    'https://spscorner.store',
    'https://api.spscorner.store',
    process.env.NODE_ENV !== 'production' && 'http://localhost:3000',
    process.env.NODE_ENV !== 'production' && 'http://localhost:5173',
  ].filter(Boolean),
  credentials: true,
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
// Rate limiter tambahan untuk endpoint kritis
const transactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Terlalu banyak request transaksi. Coba lagi dalam 1 menit.' },
  standardHeaders: true,
});
const digitalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Terlalu banyak request produk digital. Coba lagi dalam 1 menit.' },
  standardHeaders: true,
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak percobaan registrasi. Coba lagi dalam 1 jam.' },
  standardHeaders: true,
});
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak validasi. Coba lagi dalam 1 menit.' },
  standardHeaders: true,
});

// Terapkan rate limiter ke endpoint sensitif
app.use('/api/payment', paymentLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/transactions', transactionLimiter);
app.use('/api/digital', digitalLimiter);
app.use('/api/seller-register', registerLimiter);
app.use('/api/validate', validateLimiter);

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

// ─── Re-exported from service modules for backward compatibility ───────────
// sendPushToUser, sendPushToAdmins, restoreTransactionStock, createNotification
// are now in src/services/notification.js and src/services/stock.js

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
// sendNotification is now imported from src/services/notification.js

// Register modular route groups
registerWithdrawalRoutes(app, { supabase, sendNotification, getAdminIds, getUserId, resolveUser });
registerStockRoutes(app, { supabase, sendNotification, getAdminIds, getUserId, resolveUser });
registerProductReturnRoutes(app, { supabase, sendNotification, getAdminIds, getUserId, resolveUser });
registerDiagnosticsRoutes(app, { supabase });
registerPushRoutes(app, { supabase, webpush, sendNotification, sendPushToUser });
registerPaymentRoutes(app, {
  supabase, sendNotification, ipaymuClient, sendSarirotiEmailInternal,
  sendWANotification, processDigitalItems, updateSellerBalances,
  updateBuyerPoints, triggerSarirotiEmail, checkLowStockAndNotify,
  sendBuyerReceiptEmail, getDigiflazzAxiosConfig, crypto, restoreTransactionStock,
  IPAYMU_VA, IPAYMU_API_KEY, IPAYMU_PRODUCTION, groq,
});

// ─── Service functions imported from src/services/ modules ──────────────────
// processDigitalItems    → ./src/services/digiflazz.js
// sendSarirotiEmailInternal → ./src/services/email.js
// updateSellerBalances   → ./src/services/payment.js
// checkLowStockAndNotify → ./src/services/stock.js
// updateBuyerPoints      → ./src/services/payment.js
// triggerSarirotiEmail   → ./src/services/email.js
// sendBuyerReceiptEmail  → ./src/services/email.js
// sendNotification       → ./src/services/notification.js
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
registerDigitalRoutes(app, { supabase, sendNotification, crypto, axios, DIGIFLAZZ_USERNAME, DIGIFLAZZ_API_KEY, getDigiflazzAxiosConfig, saveCacheToFile, priceCache, CACHE_TTL, isDefaultDigiflazz });

// ── Digiflazz balance check helper ──────────────────────────────
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

registerTransactionRoutes(app, { supabase, sendNotification, sendWANotification, sendSarirotiEmailInternal, sendBuyerReceiptEmail, restoreTransactionStock, checkLowStockAndNotify, updateSellerBalances, updateBuyerPoints, processDigitalItems, triggerSarirotiEmail, getDigiflazzBalance });
registerAdminRoutes(app, { supabase, sendNotification, sendSarirotiEmailInternal });

// admin/transactions/approve moved to src/routes/transactions.ts
// admin/transactions/reject moved to src/routes/transactions.ts
// admin/transactions/confirm-sariroti moved to src/routes/transactions.ts
// admin/transactions/notify-ready moved to src/routes/transactions.ts
// admin/transactions/cleanup moved to src/routes/transactions.ts
// transactions/:id moved to src/routes/transactions.ts
// transactions/create moved to src/routes/transactions.ts
// transactions/pay moved to src/routes/transactions.ts
// transactions/:id/process moved to src/routes/transactions.ts
// transactions/:id/ready moved to src/routes/transactions.ts
// transactions/:id/complete moved to src/routes/transactions.ts
// transactions/cancel moved to src/routes/transactions.ts
// transactions/seller/:sellerId moved to src/routes/transactions.ts
// admin/password-resets moved to src/routes/admin.ts
// admin/password-resets/complete moved to src/routes/admin.ts
// admin/stock-report moved to src/routes/admin.ts
// digital/callback moved to src/routes/digital.ts
// payment/ipaymu/debug moved to src/routes/payments.ts
// payment/ipaymu/create moved to src/routes/payments.ts
// payment/manual/verify moved to src/routes/payments.ts
// payment/points/pay moved to src/routes/payments.ts
// payment/points/partial-pay moved to src/routes/payments.ts

// Get user points balance (calculated from history with expiry)
// portal/points/balance moved to src/routes/portal.ts

// portal/points/history moved to src/routes/portal.ts
// payment/ipaymu/direct moved to src/routes/payments.ts
// payment/ipaymu/callback moved to src/routes/payments.ts
// payment/ipaymu/status/:reference_id moved to src/routes/payments.ts
// payment/ipaymu/methods moved to src/routes/payments.ts
// auth/reset-password-request moved to src/routes/auth.ts

// auth/forgot-password-send-email moved to src/routes/auth.ts

// auth/reset-password moved to src/routes/auth.ts
// test-email moved to src/routes/misc.ts

// report + reports moved to src/routes/misc.ts

// ========== SELLER REGISTRATION ==========

// auth/admin/seller-registration-links moved to src/routes/auth.ts

// auth/seller-registration/verify moved to src/routes/auth.ts

// auth/seller-register moved to src/routes/auth.ts

// auth/seller/products/check moved to src/routes/auth.ts

// =====================================================
// API: Program Serikat Push Method (Coupons & Doorprize)
// =====================================================

// Generate coupons from eligibility (Bulk)
// admin/programs/generate-coupons moved to src/routes/portal.ts

// admin/programs/manual-coupon moved to src/routes/portal.ts

// admin/coupons/claim moved to src/routes/portal.ts

// admin/programs/bypass-attendance moved to src/routes/portal.ts

// admin/programs/draw-doorprize moved to src/routes/portal.ts

// admin/programs/coupons moved to src/routes/portal.ts

// admin/programs/doorprize-log moved to src/routes/portal.ts

// portal/my-coupons moved to src/routes/portal.ts

// admin/programs/notify moved to src/routes/portal.ts

// admin/programs/close moved to src/routes/portal.ts

// Broadcast notification to all users
// broadcast moved to src/routes/misc.ts

registerAnalyticsRoutes(app, { supabase });
registerMiscRoutes(app, { supabase, sendNotification, groq, sendSarirotiEmailInternal });
registerAuthRoutes(app, { supabase, sendNotification, sendSarirotiEmailInternal });
registerPortalRoutes(app, { supabase, sendNotification, ipaymuClient });

// API 404 catch-all — return JSON instead of HTML for unmatched API routes (must be BEFORE SPA fallback)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
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


    // portal/programs/checkout-family moved to src/routes/portal.ts

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
      Sentry.setupExpressErrorHandler(app);
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })();
}

var server_default = app;
export { server_default as default };
