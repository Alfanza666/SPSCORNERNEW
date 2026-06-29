// @ts-nocheck
import { __name } from "./route-utils.js";

export function registerDigitalRoutes(app, { supabase, sendNotification, crypto, axios, DIGIFLAZZ_USERNAME, DIGIFLAZZ_API_KEY, getDigiflazzAxiosConfig, saveCacheToFile, priceCache, CACHE_TTL, isDefaultDigiflazz }) {

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
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ success: false, error: "Unauthorized" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return res.status(403).json({ success: false, error: "Forbidden: Admin only" });
    }

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
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ success: false, error: "Unauthorized" });

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

}
