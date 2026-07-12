// @ts-nocheck
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", { value, configurable: true });
import express from "express";
import https from "https";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import path from "path";
import crypto from "crypto";
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
import { registerStockTraceRoutes } from "./src/routes/stock-trace.js";
import { registerProgramRegistrationWorkflowRoutes } from "./src/routes/programRegistrationWorkflow.js";
import { registerEventWorkflowRoutes } from "./src/routes/eventWorkflow.js";
import { initNotificationService, sendNotification, sendPushToUser, sendPushToAdmins } from "./src/services/notification.js";
import { initStockService, restoreTransactionStock, deductTransactionStock, atomicAdjustStock, reconcileStock, checkLowStockAndNotify } from "./src/services/stock.js";
import { initEmailService, sendSarirotiEmailInternal, triggerSarirotiEmail, sendBuyerReceiptEmail } from "./src/services/email.js";
import { initPaymentService, updateSellerBalances, updateBuyerPoints } from "./src/services/payment.js";
import { initBackgroundJobs } from "./src/services/background-jobs.js";
import { processDigitalItems, updateDigiflazzCache, getDigiflazzBalance, getDigiflazzAxiosConfig, saveCacheToFile, priceCache, CACHE_TTL, isDefaultDigiflazz, DIGIFLAZZ_USERNAME, DIGIFLAZZ_API_KEY, digiflazzAxios } from "./src/services/digiflazz.js";
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
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "", dangerouslyAllowBrowser: true });

const app = express();

// Trust proxy — VPS di belakang Vercel reverse proxy, X-Forwarded-For header perlu di-trust
app.set("trust proxy", 1);

// Init service modules
initNotificationService(supabase, webpush);
initStockService(supabase, sendNotification, sendWANotification);
initEmailService(supabase, nodemailer);
initPaymentService(supabase);
initBackgroundJobs(supabase, sendNotification, restoreTransactionStock, sendSarirotiEmailInternal, reconcileStock);
initWANotification(supabase);


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
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Terlalu banyak permintaan AI. Coba lagi dalam 1 menit.' },
  standardHeaders: true,
});
const programWorkflowLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Terlalu banyak request formulir program. Coba lagi dalam 1 menit.' },
  standardHeaders: true,
});

// Terapkan rate limiter ke endpoint sensitif
app.use('/api/payment', paymentLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/transactions', transactionLimiter);
app.use('/api/digital', digitalLimiter);
app.use('/api/seller-register', registerLimiter);
app.use('/api/validate', validateLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/portal/programs/:programId/registration-v2', programWorkflowLimiter);

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

async function getAdminIds() {
  const { data: admins } = await supabase.from("profiles").select("id").in("role", ["admin", "superadmin"]);
  return (admins || []).map(a => a.id);
}

function getToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  return authHeader.split(" ")[1];
}

async function resolveUser(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const FIXIE_URL =
  process.env.FIXIE_URL &&
  !process.env.FIXIE_URL.includes("YOUR_FIXIE_PROXY_URL")
    ? process.env.FIXIE_URL
    : null;
const getIpaymuAxiosConfig = __name(() => {
  // Priority 1: No proxy, but force IPv4 so it uses the whitelisted IP (45.158.126.76). Fixie fallback remains Priority 2.
  return {
    httpsAgent: new https.Agent({ family: 4 })
  };
}, "getIpaymuAxiosConfig");
const IPAYMU_VA = (process.env.IPAYMU_VA || "").replace(/['"]/g, "").trim();
const IPAYMU_API_KEY = (process.env.IPAYMU_API_KEY || "")
  .replace(/['"]/g, "").trim();
const IPAYMU_SIGNATURE_KEY = (process.env.IPAYMU_SIGNATURE_KEY || "")
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
  FIXIE_URL
);
console.log("\u{1F4B3} Ipaymu Config:", {
  va: IPAYMU_VA ? "\u2713 Set" : "\u2717 Not Set",
  apiKey: IPAYMU_API_KEY ? "\u2713 Set" : "\u2717 Not Set",
  production: IPAYMU_PRODUCTION,
  baseUrl: IPAYMU_PRODUCTION
    ? "https://my.ipaymu.com"
    : "https://sandbox.ipaymu.com",
});
// Health check
app.get("/api/test-ping", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Register modular route groups
registerWithdrawalRoutes(app, { supabase, sendNotification, getAdminIds, getToken, resolveUser });
registerStockRoutes(app, { supabase, sendNotification, getAdminIds, getToken, resolveUser, atomicAdjustStock });
registerProductReturnRoutes(app, { supabase, sendNotification, getAdminIds, getToken, resolveUser, atomicAdjustStock });
registerDiagnosticsRoutes(app, { supabase });
registerPushRoutes(app, { supabase, webpush, sendNotification, sendPushToUser });
registerPaymentRoutes(app, {
  supabase, sendNotification, ipaymuClient, sendSarirotiEmailInternal,
  sendWANotification, processDigitalItems, updateSellerBalances,
  updateBuyerPoints, triggerSarirotiEmail, checkLowStockAndNotify,
  sendBuyerReceiptEmail, getDigiflazzAxiosConfig, crypto, restoreTransactionStock, deductTransactionStock,
  IPAYMU_VA, IPAYMU_API_KEY, IPAYMU_SIGNATURE_KEY, IPAYMU_PRODUCTION, groq,
});

if (!process.env.VERCEL) {
  setTimeout(updateDigiflazzCache, 5e3);
  setInterval(updateDigiflazzCache, CACHE_TTL);
}
registerDigitalRoutes(app, { supabase, sendNotification, crypto, axios: digiflazzAxios, DIGIFLAZZ_USERNAME, DIGIFLAZZ_API_KEY, getDigiflazzAxiosConfig, saveCacheToFile, priceCache, CACHE_TTL, isDefaultDigiflazz });

registerTransactionRoutes(app, { supabase, sendNotification, sendWANotification, sendSarirotiEmailInternal, sendBuyerReceiptEmail, restoreTransactionStock, deductTransactionStock, atomicAdjustStock, checkLowStockAndNotify, updateSellerBalances, updateBuyerPoints, processDigitalItems, triggerSarirotiEmail, getDigiflazzBalance });
registerAdminRoutes(app, { supabase, sendNotification, sendSarirotiEmailInternal });
registerStockTraceRoutes(app, { supabase });




registerAnalyticsRoutes(app, { supabase });
registerMiscRoutes(app, { supabase, sendNotification, groq, sendSarirotiEmailInternal });
registerAuthRoutes(app, { supabase, sendNotification, sendSarirotiEmailInternal });
registerPortalRoutes(app, { supabase, sendNotification, ipaymuClient });
registerProgramRegistrationWorkflowRoutes(app, { supabase, sendNotification });
registerEventWorkflowRoutes(app, { supabase, sendNotification });

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


    // Sentry error handler (must be last middleware)
    if (process.env.SENTRY_DSN) {
      Sentry.setupExpressErrorHandler(app);
    }

    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  })();
}

var server_default = app;
export { server_default as default };
