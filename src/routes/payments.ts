// @ts-nocheck
import { __name } from "./route-utils.js";
import { IpaymuSignature } from "../services/ipaymu/signature.js";
// FIX H: Valid points_history types (DB constraint enforced):
//   'earned', 'spent', 'expired', 'refund', 'compensation'

// ── iPaymu callback monitoring: count unverified callbacks per hour ──
let unverifiedCallbackCount = 0;
let unverifiedCallbackWindowStart = Date.now();
const UNVERIFIED_ALERT_THRESHOLD = 5;
const UNVERIFIED_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function registerPaymentRoutes(app, {
  supabase, sendNotification, ipaymuClient, sendSarirotiEmailInternal,
  sendWANotification, processDigitalItems, updateSellerBalances,
  updateBuyerPoints, refundTransactionPoints, triggerSarirotiEmail, checkLowStockAndNotify,
  sendBuyerReceiptEmail, getDigiflazzAxiosConfig, crypto, restoreTransactionStock, deductTransactionStock, commitTransactionStock,
  IPAYMU_VA, IPAYMU_API_KEY, IPAYMU_SIGNATURE_KEY, IPAYMU_PRODUCTION, groq,
}) {
  // Auth helper — returns buyer_id or null
  function routeError(statusCode, code, message, ambiguous = false) {
    const error: any = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    error.ambiguous = ambiguous;
    return error;
  }

  function isAuthUpstreamFailure(error) {
    const message = String(error?.message || error?.cause?.message || "").toLowerCase();
    return Number(error?.status) >= 500
      || message.includes("fetch failed")
      || message.includes("timeout")
      || message.includes("econn")
      || message.includes("und_err");
  }

  async function requireUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(" ")[1];
    if (!token) return null;
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error && isAuthUpstreamFailure(error)) {
        throw routeError(503, "AUTH_UPSTREAM_UNAVAILABLE", "Layanan autentikasi sementara tidak tersedia.");
      }
      if (error || !user) return null;
      return user.id;
    } catch (error) {
      if (error?.statusCode) throw error;
      if (isAuthUpstreamFailure(error)) {
        throw routeError(503, "AUTH_UPSTREAM_UNAVAILABLE", "Layanan autentikasi sementara tidak tersedia.");
      }
      throw error;
    }
  }

  /**
   * Get the amount that should actually be charged to the payment gateway.
   * If loyalty points were applied (partial-pay), remaining_amount is stored
   * in metadata. Charge that instead of total_amount.
   */
  function getChargeableAmount(transaction) {
    const meta = transaction.metadata || {};
    const remaining = Number(meta.remaining_amount);
    if (meta.point_payment && remaining > 0 && remaining < Number(transaction.total_amount)) {
      return Math.round(remaining);
    }
    return Math.round(Number(transaction.total_amount));
  }

  async function loadPayableTransaction(transactionId, buyerId) {
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select(`
        id,
        buyer_id,
        buyer_name,
        buyer_phone,
        total_amount,
        status,
        payment_method,
        payment_details,
        metadata,
        transaction_items(quantity, price, metadata, products(name))
      `)
      .eq("id", transactionId)
      .single();

    if (error || !transaction) {
      if (error?.code === "PGRST116") {
        throw routeError(404, "TRANSACTION_NOT_FOUND", "Transaksi tidak ditemukan.");
      }
      throw routeError(503, "TRANSACTION_LOOKUP_UNAVAILABLE", "Data transaksi sementara tidak dapat diperiksa.");
    }
    if (transaction.buyer_id !== buyerId) {
      throw routeError(403, "TRANSACTION_FORBIDDEN", "Transaksi bukan milik pengguna ini.");
    }
    if (String(transaction.status).toLowerCase() !== "pending") {
      throw routeError(409, "TRANSACTION_NOT_PENDING", "Transaksi sudah tidak berstatus pending.");
    }

    const paymentDetails = transaction.payment_details && typeof transaction.payment_details === "object"
      ? transaction.payment_details
      : {};
    if (paymentDetails.ipaymu_trx_id || paymentDetails.ipaymu_sid) {
      throw routeError(409, "IPAYMU_PAYMENT_ALREADY_CREATED", "Permintaan pembayaran iPaymu untuk transaksi ini sudah dibuat.");
    }

    return { ...transaction, payment_details: paymentDetails };
  }

  function paymentItemsFromTransaction(transaction) {
    const items = Array.isArray(transaction.transaction_items)
      ? transaction.transaction_items
      : [];
    if (!items.length) {
      return {
        product: ["Transaction"],
        qty: ["1"],
        price: [Math.round(Number(transaction.total_amount)).toString()],
      };
    }

    return {
      product: items.map((item) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        return String(product?.name || item.metadata?.product_name || "Produk SPS Corner");
      }),
      qty: items.map((item) => String(item.quantity || 1)),
      price: items.map((item) => String(Math.round(Number(item.price)))),
    };
  }

  async function saveIpaymuReference(transaction, response) {
    const transactionId = response.Data?.TransactionId || null;
    const sessionId = response.Data?.SessionId || null;
    if (!transactionId && !sessionId) return;

    const { error } = await supabase
      .from("transactions")
      .update({
        payment_details: {
          ...transaction.payment_details,
          ipaymu_trx_id: transactionId,
          ipaymu_sid: sessionId,
          ipaymu_status: "created",
        },
      })
      .eq("id", transaction.id)
      .eq("buyer_id", transaction.buyer_id);

    if (error) {
      throw routeError(
        502,
        "IPAYMU_REFERENCE_PERSIST_FAILED",
        "Pembayaran mungkin sudah dibuat, tetapi referensinya belum tersimpan. Jangan ulangi pembayaran; periksa riwayat transaksi.",
        true,
      );
    }
  }

  function sendRouteError(res, error, fallbackMessage) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      success: false,
      error: error?.message || fallbackMessage,
      code: error?.code || "INTERNAL_ERROR",
      ambiguous: Boolean(error?.ambiguous),
    });
  }

  const gatewayStatusIsPaid = (payload: any) => {
    const paidStatuses = new Set(['paid', 'success', 'sukses', 'berhasil', 'completed', 'settlement']);
    const values: string[] = [];
    const visit = (value: any, key = '') => {
      if (!value || typeof value !== 'object') {
        if (key.toLowerCase().includes('status') && typeof value === 'string') values.push(value.toLowerCase().trim());
        return;
      }
      for (const [childKey, childValue] of Object.entries(value)) visit(childValue, childKey);
    };
    visit(payload);
    return values.some(value => paidStatuses.has(value));
  };

  const verifyGatewayCallback = async (req: any, referenceId: string, body: any) => {
    const headerSignature = String(req.headers['x-signature'] || req.headers.signature || '').trim();
    const bodySignature = String(body.signature || body.Signature || '').trim();
    const receivedSignature = headerSignature || bodySignature;
    if (receivedSignature && IPAYMU_VA) {
      const signatureBody = { ...body };
      delete signatureBody.signature;
      delete signatureBody.Signature;
      if (IpaymuSignature.verify(signatureBody, receivedSignature, IPAYMU_VA)) return { verified: true, method: 'signature' };
    }

    // Fallback: confirm directly with iPaymu API
    try {
      const ipaymuTrxId = body.transaction_id || body.transactionId || body.trx_id || body.trxId || referenceId;
      const statusResponse = await ipaymuClient.getTransactionStatus(ipaymuTrxId);
      if (gatewayStatusIsPaid(statusResponse)) return { verified: true, method: 'api_lookup' };
      const callbackStatus = String(body.status || body.Status || body.payment_status || '').toLowerCase();
      const callbackIsPaid = ['paid', 'success', 'sukses', 'berhasil', 'completed', 'settlement'].includes(callbackStatus);
      if (!callbackIsPaid) return { verified: true, method: 'callback_not_paid' };
      // Callback claims paid but API doesn't confirm — log but don't hard-reject
      console.warn(`[iPaymu] WARNING: Callback for ${referenceId} claims paid but API lookup unclear. Processing with caution.`);
      return { verified: true, method: 'soft_trust' };
    } catch (error) {
      console.error(`[iPaymu] Unable to verify callback for ${referenceId}:`, error);
      const callbackStatus = String(body.status || body.Status || body.payment_status || '').toLowerCase();
      const callbackIsPaid = ['paid', 'success', 'sukses', 'berhasil', 'completed', 'settlement'].includes(callbackStatus);
      if (callbackIsPaid) {
        console.warn(`[iPaymu] CRITICAL: API lookup failed but callback claims PAID for ${referenceId}. Processing with caution.`);
        return { verified: true, method: 'fallback_trust' };
      }
      return { verified: false, method: 'failed' };
    }
  };

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
      const buyerId = await requireUser(req);
      if (!buyerId) return res.status(401).json({ success: false, error: "Unauthorized" });
      const {
        transaction_id,
        buyer_email,
        buyer_phone,
      } = req.body || {};
      if (!transaction_id) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: transaction_id",
          code: "TRANSACTION_ID_REQUIRED",
        });
      }
      const transaction = await loadPayableTransaction(transaction_id, buyerId);
      const serverEmail = transaction.payment_details.buyer_email || buyer_email;
      const serverPhone = transaction.buyer_phone || buyer_phone;
      if (!serverEmail || !serverPhone) {
        throw routeError(400, "BUYER_CONTACT_REQUIRED", "Email dan nomor telepon pembeli wajib tersedia.");
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
      const apiUrl = process.env.API_URL || "https://api.spscorner.store";
      let cleanName = (transaction.buyer_name || "Customer")
        .replace(/[^a-zA-Z\s]/g, "")
        .trim();
      if (cleanName.length < 3 || cleanName.toLowerCase().includes("test")) {
        cleanName = "Pelanggan SPS Corner";
      }
      if (cleanName.length < 3) cleanName = "Pelanggan";
      const canonicalItems = paymentItemsFromTransaction(transaction);
      const chargeableAmount = getChargeableAmount(transaction);
      const paymentData = {
        ...canonicalItems,
        amount: chargeableAmount.toString(),
        returnUrl: `${appUrl}/kiosk/success?id=${transaction_id}`,
        cancelUrl: `${appUrl}/kiosk/cart`,
        notifyUrl: `${apiUrl}/api/payment/ipaymu/callback`,
        referenceId: String(transaction_id),
        buyerName: cleanName,
        buyerPhone: serverPhone,
        buyerEmail: serverEmail,
      };
      console.log("\u{1F4DD} Payment Request:", {
        reference_id: transaction_id,
        amount: chargeableAmount,
      });
      const response = await ipaymuClient.createPayment(paymentData);
      await saveIpaymuReference(transaction, response);
      res.json({
        success: true,
        payment_url: response.Data?.Url,
        session_id: response.Data?.SessionId,
      });
    } catch (error) {
      console.error("\u274C Payment Creation Error:", error);
      sendRouteError(res, error, "Gagal membuat pembayaran iPaymu.");
    }
  });

  app.post("/api/payment/manual/verify", async (req, res) => {
    let transaction_id: string | undefined;
    let receipt_image: string | undefined;
    let expected_amount: number | undefined;
    let receiptUrl: string | undefined;
    try {
      // Auth optional — guest checkout juga pakai endpoint ini
      const buyerId = await requireUser(req);
      ({ transaction_id, receipt_image, expected_amount } = req.body || {});
      if (!transaction_id || !receipt_image) {
        return res
          .status(400)
          .json({ success: false, error: "Missing required fields" });
      }

      // Validasi status transaksi — izinkan verify dari pending, failed (auto-cancelled), atau paid/success (idempotent)
      const { data: txCheck, error: txCheckError } = await supabase
        .from("transactions")
        .select("id, status, payment_method, metadata, payment_details")
        .eq("id", transaction_id)
        .single();

      if (txCheckError || !txCheck) {
        return res.status(404).json({ success: false, error: "Transaksi tidak ditemukan." });
      }

      const validMethods = ["manual_qris", "transfer_koperasi"];
      if (!validMethods.includes(txCheck.payment_method)) {
        return res.status(400).json({ success: false, error: "Metode pembayaran tidak didukung untuk verifikasi manual." });
      }

      // Sudah paid/success — return idempotent
      if (txCheck.status === "paid" || txCheck.status === "success") {
        return res.json({ success: true, message: "Pembayaran sudah terverifikasi." });
      }

      // Status pending — lanjut verifikasi
      // Status failed dengan auto-cancelled — reset ke pending dulu
      const isAutoCancelled = txCheck.status === "failed"
        && (txCheck.metadata?.cancel_reason || "").includes("Auto-cancelled");

      if (txCheck.status === "pending" || isAutoCancelled) {
        if (isAutoCancelled) {
          // Reset status ke pending agar bisa diverifikasi ulang
          await supabase
            .from("transactions")
            .update({ status: "pending", metadata: { ...txCheck.metadata, cancel_reason: null } })
            .eq("id", transaction_id)
            .eq("status", "failed");
        }
      } else {
        return res.status(409).json({ success: false, error: `Transaksi dalam status "${txCheck.status}", tidak bisa diverifikasi.` });
      }
      const base64Data = receipt_image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const mimeType =
        receipt_image.match(/data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
      const fileExt = mimeType.split("/")[1] || "jpg";
      const fileName = `receipts/${transaction_id}_${Date.now()}.${fileExt}`;
      receiptUrl = receipt_image;
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
      // Ambil data transaksi termasuk tanggal dibuat
      const { data: txRecord } = await supabase
        .from("transactions")
        .select("created_at, status, payment_details, total_amount, metadata")
        .eq("id", transaction_id)
        .single();

      // Gunakan chargeable amount dari metadata (jika pakai points, bayar sisa saja)
      const chargeableAmount = (() => {
        const meta = txRecord?.metadata || {};
        const remaining = Number(meta.remaining_amount);
        if (meta.point_payment && remaining > 0 && remaining < Number(txRecord?.total_amount)) {
          return Math.round(remaining);
        }
        return Number(expected_amount || txRecord?.total_amount || 0);
      })();

      // Format tanggal transaksi ke bahasa Indonesia
      const txDate = txRecord?.created_at ? new Date(txRecord.created_at) : null;
      const txDateFormatted = txDate
        ? txDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })
        : null;
      const txDateShort = txDate
        ? txDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Makassar' })
        : null;

      const prompt = `
        Kamu adalah sistem verifikasi bukti pembayaran untuk toko kantin digital.
        Analisis gambar berikut dan tentukan apakah ini adalah bukti transfer/pembayaran yang valid.

        Nominal transaksi yang harus dibayar: Rp ${Number(chargeableAmount).toLocaleString('id-ID')}
        Tanggal transaksi dibuat: ${txDateFormatted || 'tidak diketahui'}${txDateShort ? ` (${txDateShort})` : ''}

        INSTRUKSI PENTING:
        - Gambar bisa berupa screenshot panjang dari aplikasi mobile banking, QRIS, GoPay, OVO, DANA, ShopeePay, atau aplikasi transfer lainnya.
        - JANGAN tolak hanya karena gambar tidak ter-crop atau ada elemen lain di sekitar nota.
        - Fokus mencari bukti pembayaran di MANA PUN lokasinya dalam gambar.
        - Cari teks nominal seperti: "${chargeableAmount}", "Rp ${Number(chargeableAmount).toLocaleString('id-ID')}", atau angka yang mendekati ±5%.
        - Cari indikator keberhasilan: "Berhasil", "Sukses", "Success", "Selesai", tanda centang hijau, atau teks serupa.
        - Cari nama pengirim, nama penerima, atau nama bank/dompet digital sebagai konteks pendukung.

        PENGECEKAN TANGGAL (WAJIB):
        - Cari tanggal transaksi di nota/bukti pembayaran.
        - Tanggal di nota harus sesuai dengan tanggal transaksi: ${txDateFormatted || 'tidak diketahui'}.
        - Toleransi tanggal: HANYA boleh beda 1 hari (bisa H atau H-1 dari ${txDateFormatted || 'tanggal transaksi'}).
        - Jika tanggal di nota JAUH berbeda (lebih dari 1 hari), TOLAK dengan alasan tanggal tidak sesuai.
        - Jika tanggal di nota TIDAK TERLIHAT, abaikan pengecekan tanggal dan fokus ke nominal & status saja.

        TOLAK hanya jika:
        - Gambar bukan bukti pembayaran sama sekali (misal: foto selfie, screenshot chat, dll)
        - Nominal yang terlihat JELAS berbeda jauh dari Rp ${Number(chargeableAmount).toLocaleString('id-ID')} (toleransi ±5%)
        - Status transaksi JELAS menunjukkan gagal/pending/dibatalkan
        - Tanggal di nota JELAS berbeda lebih dari 1 hari dari tanggal transaksi

        FORMAT ALASAN PENOLAKAN (WAJIB JELAS & ACTIONABLE):
        Jika TIDAK VALID, alasan HARUS spesifik dan memberitahu user apa yang salah. Contoh format:
        - "Nominal tidak sesuai. Yang tertera: Rp 50.000, seharusnya: Rp 75.000. Silakan upload bukti dengan nominal yang benar."
        - "Bukti pembayaran tidak terbaca jelas. Silakan upload ulang dengan gambar yang lebih jelas."
        - "Status transaksi pada bukti menunjukkan GAGAL. Silakan lakukan pembayaran ulang dan upload bukti yang berhasil."
        - "Tanggal pada bukti (01/01/2025) tidak sesuai dengan tanggal transaksi (15/08/2026). Silakan upload bukti pembayaran yang benar."
        - "Gambar yang diupload bukan bukti pembayaran. Silakan upload screenshot bukti transfer/pembayaran yang berhasil."

        JANGAN berikan alasan umum seperti "bukti tidak valid" tanpa penjelasan spesifik.

        Balas HANYA dengan JSON tanpa markdown:
        {
          "isValid": boolean,
          "amountFound": number or null,
          "reason": "Pesan singkat dalam Bahasa Indonesia. Jika valid sebutkan nominal dan tanggal yang terdeteksi. Jika tidak valid WAJIB jelaskan secara spesifik apa yang salah dan apa yang harus dilakukan user."
        }
      `;
      const visionModel = process.env.GROQ_VISION_MODEL?.trim() || "qwen/qwen3.6-27b";
      if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY tidak tersedia; gunakan review manual");
      }
      const groqResponse = await groq.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });
      const resultText = groqResponse.choices?.[0]?.message?.content;
      if (!resultText) {
        throw new Error("Gagal mendapatkan respons dari AI");
      }
      let verificationResult;
      try {
        verificationResult = JSON.parse(resultText);
      } catch {
        console.warn('[ManualVerify] AI returned non-JSON:', resultText?.substring(0, 200));
        verificationResult = { isValid: false, reason: 'Sistem AI tidak dapat membaca gambar. Pastikan gambar jelas dan coba lagi.' };
      }
      const existingPaymentDetails = txRecord?.payment_details || {};
      if (!verificationResult.isValid) {
        // Update payment_details dengan info verifikasi gagal (status tetap "pending")
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
      // ── Reorder (FIX B-1): commit stock SEBELUM update status "paid" ──
      // Kalau stock commit gagal, status tetap "pending" → bisa di-retry.
      const previousStatus = txRecord?.status;
      const { data: txData, error: txFetchError } = await supabase
        .from("transactions")
        .select("*, transaction_items(*)")
        .eq("id", transaction_id)
        .single();
      if (!txFetchError && txData && txData.transaction_items) {
        if (
          previousStatus !== "paid" &&
          previousStatus !== "success"
        ) {
          if (txData.metadata?.stock_deducted && txData.metadata?.stock_restored && deductTransactionStock) {
            await deductTransactionStock(transaction_id);
          } else {
            const stockCommit = await commitTransactionStock(transaction_id);
            if (!stockCommit.success) throw new Error(stockCommit.error || 'Stok gagal dikunci setelah pembayaran');
          }
        }
      }
      // Update status ke "paid" SETELAH stock berhasil di-commit
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "paid",
          receipt_image: receiptUrl,
          payment_details: {
            ...existingPaymentDetails,
            receipt_uploaded: true,
            manual_verify: true,
            verified_at: new Date().toISOString(),
          },
        })
        .eq("id", transaction_id);
      if (updateError) throw updateError;
      // Post-payment processing SETELAH status "paid"
      if (!txFetchError && txData && txData.transaction_items) {
        if (
          previousStatus !== "paid" &&
          previousStatus !== "success"
        ) {
          await updateSellerBalances(txData.transaction_items, transaction_id);
          await checkLowStockAndNotify(txData.transaction_items);
          // FIX G: Points earned berdasarkan amount yang benar-benar dibayar
          await updateBuyerPoints(transaction_id, txData.buyer_id, getChargeableAmount(txData));
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
      console.error("❌ Manual Verification Error:", error);
      // Status tetap "pending" karena tidak pernah diubah ke "processing"
      try {
        if (transaction_id && receiptUrl) {
          const { data: currentTx } = await supabase
            .from("transactions")
            .select("payment_details")
            .eq("id", transaction_id)
            .single();
          const currentDetails = currentTx?.payment_details || {};
          
          await supabase
            .from("transactions")
            .update({
              receipt_image: receiptUrl,
              payment_details: {
                ...currentDetails,
                receipt_uploaded: true,
                ai_error: true,
                reason: `Sistem verifikasi otomatis (AI) sedang sibuk. Bukti pembayaran disimpan untuk verifikasi manual oleh Admin.`,
                attempted_at: new Date().toISOString()
              }
            })
            .eq("id", transaction_id);


          // Kirim notifikasi realtime ke semua admin untuk verifikasi manual
          try {
            const { data: admins } = await supabase
              .from("profiles")
              .select("id")
              .in("role", ["admin", "superadmin"]);
              
            if (admins && admins.length > 0) {
              for (const admin of admins) {
                await sendNotification(admin.id, {
                  type: "transaction",
                  title: "🔔 Verifikasi Manual Baru",
                  message: `Bukti pembayaran baru diunggah untuk pesanan #${transaction_id.slice(0, 8)} (AI sedang offline).`,
                  path: `/dashboard/admin/transactions?id=${transaction_id}`,
                });
              }
            }
          } catch (err) {
            console.error("Failed to notify admins of manual verification fallback:", err);
          }

          return res.json({
            success: true,
            fallbackToPending: true,
            message: "Layanan verifikasi otomatis (AI) sedang sibuk. Bukti pembayaran Anda telah disimpan untuk diverifikasi manual oleh Admin."
          });
        }
      } catch (dbErr) {
        console.error("❌ Failed to save fallback receipt info to DB:", dbErr);
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/payment/points/pay", async (req, res) => {
    try {
      const buyerId = await requireUser(req);
      if (!buyerId) return res.status(401).json({ success: false, error: "Unauthorized" });
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

      // Idempotency guard — jika sudah diproses, return success tanpa proses ulang
      if (tx.status === "success" || tx.status === "paid") {
        return res.json({ success: true, message: "Pembayaran sudah diproses sebelumnya" });
      }
      if (tx.metadata?.point_payment_processed) {
        return res.json({ success: true, message: "Pembayaran poin sudah diproses sebelumnya" });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("loyalty_points")
        .eq("id", tx.buyer_id)
        .single();

      if (!profile || (profile.loyalty_points || 0) < tx.total_amount) {
        throw new Error(`Points tidak mencukupi. Point: ${profile?.loyalty_points || 0}, Tagihan: ${tx.total_amount}`);
      }

      // Deduct points atomically — cegah double-spend dengan .gte()
      const { data: deductData, error: deductError } = await supabase
        .from("profiles")
        .update({ loyalty_points: profile.loyalty_points - tx.total_amount })
        .gte("loyalty_points", tx.total_amount)
        .eq("id", tx.buyer_id)
        .select("loyalty_points");
      if (deductError || !deductData || deductData.length === 0) {
        throw new Error("Gagal memotong poin. Mungkin saldo sudah berubah.");
      }

      // Record points spent in history
      await supabase.from("points_history").insert({
        user_id: tx.buyer_id,
        transaction_id,
        points: -tx.total_amount,
        type: "spent",
        description: `Bayar transaksi Rp ${tx.total_amount.toLocaleString()} dengan poin`,
      });

      // Update transaction — set point_payment_processed untuk idempotency
      const { error: updateTx } = await supabase
        .from("transactions")
        .update({ 
          status: "success", 
          payment_method: "points",
          metadata: { ...tx.metadata, point_payment: true, points_used: tx.total_amount, point_payment_processed: true }
        })
        .eq("id", transaction_id);
      if (updateTx) {
        // Rollback points jika status update gagal
        try {
          await supabase.rpc('increment_loyalty_points', {
            p_user_id: tx.buyer_id,
            p_amount: tx.total_amount,
          });
        } catch (rollbackErr) {
          console.error(`[PointsPay] CRITICAL: Points rollback failed for ${transaction_id}:`, rollbackErr);
        }
        throw updateTx;
      }

      // Run post processes
      const stockCommit = await commitTransactionStock(transaction_id);
      if (!stockCommit.success) throw new Error(stockCommit.error || 'Stok gagal dikunci setelah pembayaran');
      await updateSellerBalances(tx.transaction_items, transaction_id);
      await checkLowStockAndNotify(tx.transaction_items);
      await processDigitalItems(transaction_id, tx.transaction_items);
      await triggerSarirotiEmail(transaction_id, tx.buyer_name, tx.total_amount);

      res.json({ success: true, message: "Pembayaran berhasil menggunakan Points" });
    } catch (error) {
      console.error("Point Payment Error:", error);
      res.status(500).json({ error: error.message || "Gagal memproses pembayaran dengan poin" });
    }
  });

  // Partial payment with points (split payment: points + remainder via other method)
  app.post("/api/payment/points/partial-pay", async (req, res) => {
    try {
      const buyerId = await requireUser(req);
      if (!buyerId) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { transaction_id, points_to_use } = req.body;
      if (!transaction_id || !points_to_use) throw new Error("transaction_id and points_to_use required");

      const { data: setting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "loyalty_enabled")
        .single();
      if (setting?.value !== "true") throw new Error("Fitur Loyalty Points sedang dinonaktifkan");

      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transaction_id)
        .single();

      if (txError || !tx) throw new Error("Transaksi tidak ditemukan");
      if (!tx.buyer_id) throw new Error("Hanya karyawan terdaftar yang dapat menggunakan Points");
      if (tx.status === "success" || tx.status === "paid") throw new Error("Transaksi sudah dibayar");

      // Idempotency guard — jika points sudah dipakai, return success tanpa potong ulang
      if (tx.metadata?.point_payment && Number(tx.metadata?.points_used) > 0) {
        const remaining = tx.total_amount - Number(tx.metadata.points_used);
        return res.json({
          success: true,
          message: `Poin sudah digunakan sebelumnya`,
          remaining_amount: remaining,
          points_used: Number(tx.metadata.points_used)
        });
      }

      const pointsToUse = parseInt(points_to_use) || 0;
      if (pointsToUse < 1000) throw new Error("Minimal 1.000 poin");
      if (pointsToUse > tx.total_amount) throw new Error("Poin tidak boleh lebih dari total tagihan");

      const { data: profile } = await supabase
        .from("profiles")
        .select("loyalty_points")
        .eq("id", tx.buyer_id)
        .single();

      if (!profile || (profile.loyalty_points || 0) < pointsToUse) {
        throw new Error(`Points tidak mencukupi. Point: ${profile?.loyalty_points || 0}, Dibutuhkan: ${pointsToUse}`);
      }

      // Deduct points atomically — cegah double-spend dengan .gte()
      const { data: deductData, error: deductError } = await supabase
        .from("profiles")
        .update({ loyalty_points: (profile.loyalty_points || 0) - pointsToUse })
        .gte("loyalty_points", pointsToUse)
        .eq("id", tx.buyer_id)
        .select("loyalty_points");
      if (deductError || !deductData || deductData.length === 0) {
        throw new Error("Gagal memotong poin. Mungkin saldo sudah berubah.");
      }

      // Record points spent
      await supabase.from("points_history").insert({
        user_id: tx.buyer_id,
        transaction_id,
        points: -pointsToUse,
        type: "spent",
        description: `Pembayaran parsial Rp ${pointsToUse.toLocaleString()} dari Rp ${tx.total_amount.toLocaleString()}`,
      });

      // Update transaction metadata — JANGAN ubah total_amount agar laporan tetap akurat
      const remainingAmount = tx.total_amount - pointsToUse;
      const { error: updateTx } = await supabase
        .from("transactions")
        .update({
          metadata: { 
            ...tx.metadata, 
            point_payment: true, 
            points_used: pointsToUse,
            remaining_amount: remainingAmount,
            points_discount: pointsToUse
          }
        })
        .eq("id", transaction_id);
      if (updateTx) throw updateTx;

      res.json({ 
        success: true, 
        message: `Poin Rp ${pointsToUse.toLocaleString()} berhasil digunakan`,
        remaining_amount: remainingAmount,
        points_used: pointsToUse
      });
    } catch (error) {
      console.error("Partial Point Payment Error:", error);
      res.status(500).json({ error: error.message || "Gagal memproses pembayaran parsial" });
    }
  });

  app.post("/api/payment/ipaymu/direct", async (req, res) => {
    try {
      const buyerId = await requireUser(req);
      if (!buyerId) return res.status(401).json({ success: false, error: "Unauthorized" });
      const {
        transaction_id,
        buyer_email,
        buyer_phone,
        payment_method = "qris",
        payment_channel = "qris",
      } = req.body || {};
      if (!transaction_id) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: transaction_id",
          code: "TRANSACTION_ID_REQUIRED",
        });
      }
      const transaction = await loadPayableTransaction(transaction_id, buyerId);
      const serverEmail = transaction.payment_details.buyer_email || buyer_email;
      const serverPhone = transaction.buyer_phone || buyer_phone;
      if (!serverEmail || !serverPhone) {
        throw routeError(400, "BUYER_CONTACT_REQUIRED", "Email dan nomor telepon pembeli wajib tersedia.");
      }
      if (!IPAYMU_VA || !IPAYMU_API_KEY) {
        return res
          .status(500)
          .json({ success: false, error: "Ipaymu not configured" });
      }
      const apiUrl = process.env.API_URL || "https://api.spscorner.store";
      let method = String(transaction.payment_method || payment_method || "qris").toLowerCase();
      let channel = (payment_channel || "qris").toLowerCase();
      if (method === "qris") {
        channel = "mpm";
      }
      const allowedChannels = {
        qris: ["mpm"],
        va: ["bca", "mandiri"],
      };
      if (!allowedChannels[method]?.includes(channel)) {
        throw routeError(400, "PAYMENT_CHANNEL_INVALID", "Metode atau kanal pembayaran tidak didukung.");
      }
      let cleanName = (transaction.buyer_name || "Customer")
        .replace(/[^a-zA-Z\s]/g, "")
        .trim();
      if (cleanName.length < 3 || cleanName.toLowerCase().includes("test")) {
        cleanName = "Pelanggan SPS Corner";
      }
      if (cleanName.length < 3) cleanName = "Pelanggan";
      const chargeableAmount = getChargeableAmount(transaction);
      const directPaymentData = {
        name: cleanName,
        phone: serverPhone,
        email: serverEmail,
        amount: chargeableAmount,
        comments: `Payment for transaction ${transaction_id}`,
        notifyUrl: `${apiUrl}/api/payment/ipaymu/callback`,
        referenceId: String(transaction_id),
        paymentMethod: method,
        paymentChannel: channel,
      };
      console.log("\u{1F4B3} Direct Payment:", {
        reference_id: transaction_id,
        payment_channel: channel,
      });
      const response = await ipaymuClient.createDirectPayment(directPaymentData);
      await saveIpaymuReference(transaction, response);

      res.json({
        success: true,
        data: response.Data,
        qr_code: response.Data?.QrCode,
      });
    } catch (error) {
      console.error("\u274C Direct Payment Error:", error);
      sendRouteError(res, error, "Gagal membuat pembayaran langsung iPaymu.");
    }
  });

  app.post("/api/payment/ipaymu/callback", async (req, res) => {
    try {
      const body = req.body || {};
      
      // ─── Verifikasi HMAC Signature iPaymu ─────────────────────────
      // iPaymu sends signature in HEADER (X-Signature), NOT in body
      const receivedSignature = String(req.headers['x-signature'] || req.headers.signature || '').trim();
      if (receivedSignature) {
        const isValid = IpaymuSignature.verify(body, receivedSignature, IPAYMU_VA);
        if (!isValid) {
          console.error('[iPaymu] Invalid callback signature! Possible fraud attempt.');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } else {
        console.warn('[iPaymu] No signature in callback — skipping verification');
        // ── Monitoring: track unverified callbacks ──
        const now = Date.now();
        if (now - unverifiedCallbackWindowStart > UNVERIFIED_WINDOW_MS) {
          unverifiedCallbackCount = 0;
          unverifiedCallbackWindowStart = now;
        }
        unverifiedCallbackCount++;
        if (unverifiedCallbackCount > UNVERIFIED_ALERT_THRESHOLD) {
          console.error(`[iPaymu ALERT] Suspicious: ${unverifiedCallbackCount} callbacks without signature in last 1 hour`);
        }
      }
      
      const statusRaw = body.status || body.Status || body.payment_status || '';
      const reference_id = body.reference_id || body.referenceId || '';
      const trx_id = body.trx_id || body.trxId || '';
      const sid = body.sid || body.session_id || '';
      const transaction_id = body.transaction_id || body.transactionId || '';

      const refId = reference_id || transaction_id;
      if (!refId) {
        return res.status(400).json({ error: "Missing reference_id" });
      }

      const verification = await verifyGatewayCallback(req, refId, body);
      if (!verification.verified) {
        console.warn(`[iPaymu] Unverified callback rejected for ${refId}`);
        return res.status(202).json({ success: false, pending: true, message: 'Callback menunggu verifikasi gateway' });
      }
      console.log(`[iPaymu] Callback verified via: ${verification.method} for ${refId}`);

      const statusLower = String(statusRaw).toLowerCase().trim();
      let txStatus =
        statusLower === "berhasil" || statusLower === "success" || statusLower === "sukses" || statusLower === "completed" || statusLower === "settlement"
          ? "paid"
          : statusLower === "gagal" || statusLower === "fail" || statusLower === "expired" || statusLower === "deny" || statusLower === "cancel"
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

      // ── Audit trail: flag callback without signature (non-blocking) ──
      if (!receivedSignature) {
        try {
          await supabase
            .from("transactions")
            .update({
              payment_details: {
                ...(transaction.payment_details || {}),
                unverified_callback: true,
                unverified_at: new Date().toISOString(),
              },
            })
            .eq("id", refId);
        } catch (flagErr) {
          console.warn(`[iPaymu] Failed to set unverified_callback flag for ${refId}:`, flagErr);
        }
      }

      // ─── Guard: jangan timpa transaksi yg sudah berhasil/dibayar dengan status gagal/pending ───
      if ((txStatus === "failed" || txStatus === "pending") && (transaction.status === "paid" || transaction.status === "success")) {
        console.log(`[iPaymu] Skip overwrite tx ${refId}: already ${transaction.status}, ignoring "${txStatus}" callback`);
        return res.json({ success: true, message: "Ignored: transaction already paid/success" });
      }

      // ─── Failed flow: restore stock DULU, baru update status ───
      // Urutan ini penting: kalau restoreTransactionStock error (uncaught),
      // status tetap "pending" → callback bisa di-retry. Jangan update
      // status dulu karena setelah "failed" tidak ada mekanisme retry.
      if (txStatus === "failed") {
        const hasDeliveredDigital = (transaction.transaction_items || []).some(
          item => item.metadata?.is_digital && item.metadata?.status === 'delivered'
        );
        if (hasDeliveredDigital) {
          console.log(`[iPaymu] Tx ${refId} has delivered digital items — reverting status to "paid" instead of "failed"`);
          txStatus = "paid";
        } else {
          // Restore stock DULU — jika restore gagal, status tetap "pending" untuk retry
          await restoreTransactionStock(refId);
          // Refund loyalty points jika transaction pakai points
          if (refundTransactionPoints) {
            try { await refundTransactionPoints(refId); } catch (e) { console.error(`[iPaymu] Points refund failed for ${refId}:`, e); }
          }
          await supabase
            .from("transactions")
            .update({
              status: "failed",
              payment_details: {
                ...(transaction.payment_details || {}),
                ipaymu_trx_id: trx_id || transaction_id,
                ipaymu_sid: sid,
                ipaymu_status: statusRaw,
              },
            })
            .eq("id", refId);
          if (transaction.buyer_id) {
            await sendNotification(transaction.buyer_id, {
              type: "transaction",
              title: "\u274C Pembayaran Gagal",
              message: `Transaksi #${refId.slice(0, 8)} Anda gagal diproses. Silakan coba kembali.`,
              path: `/kiosk/history?id=${refId}`,
            });
          }
        }
        console.log("\u2705 Transaction Updated:", { reference_id: refId, txStatus });
        return res.json({ success: true });
      }

      // ─── Reorder (FIX B-2): stock commit SEBELUM update status "paid" ───
      // Kalau stock commit gagal, status tetap "pending" → iPaymu bisa retry.
      if (txStatus === "paid") {
        if (transaction.metadata?.stock_deducted && transaction.metadata?.stock_restored && deductTransactionStock) {
          await deductTransactionStock(refId);
        } else {
          const stockCommit = await commitTransactionStock(refId);
          if (!stockCommit.success) {
            console.error(`[iPaymu] WARNING: Stock commit failed for ${refId}: ${stockCommit.error}. Status kept pending for retry.`);
            // Jangan update status — biarkan "pending" agar iPaymu retry
            return res.json({ success: true, message: "Payment received, stock commit pending" });
          }
        }
      }

      // ─── Update status SETELAH stock berhasil di-commit ───
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
        try {
          await updateSellerBalances(transaction.transaction_items, refId);
        } catch (e) {
          console.error(`[iPaymu] Seller balance update failed for ${refId}:`, e);
          // FIX C: save flag untuk retry di auto-reconcile
          try {
            await supabase.from('transactions').update({
              payment_details: { ...(transaction.payment_details || {}), seller_balance_failed: true, seller_balance_error: String(e?.message || e) }
            }).eq('id', refId);
          } catch (_) { /* non-blocking */ }
        }
        try { await checkLowStockAndNotify(transaction.transaction_items); } catch (e) { console.error(`[iPaymu] Low stock check failed for ${refId}:`, e); }
        try {
          // FIX G: Points earned berdasarkan amount yang benar-benar dibayar
          await updateBuyerPoints(refId, transaction.buyer_id, getChargeableAmount(transaction));
        } catch (e) {
          console.error(`[iPaymu] Buyer points update failed for ${refId}:`, e);
          // FIX C: save flag untuk retry di auto-reconcile
          try {
            await supabase.from('transactions').update({
              payment_details: { ...(transaction.payment_details || {}), buyer_points_failed: true }
            }).eq('id', refId);
          } catch (_) { /* non-blocking */ }
        }
        try { await processDigitalItems(refId, transaction.transaction_items); } catch (e) { console.error(`[iPaymu] Digital items processing failed for ${refId}:`, e); }
        try {
          await triggerSarirotiEmail(
            refId,
            transaction.buyer_name,
            transaction.total_amount,
          );
        } catch (e) { console.error(`[iPaymu] Sariroti email failed for ${refId}:`, e); }
        if (transaction.buyer_id) {
          await sendNotification(transaction.buyer_id, {
            type: "transaction",
            title: "✅ Pembayaran Berhasil!",
            message: `Transaksi #${refId.slice(0, 8)} sebesar Rp ${Number(transaction.total_amount).toLocaleString("id-ID")} telah dikonfirmasi.`,
            path: `/kiosk/history?id=${refId}`,
          });
          await sendWANotification(transaction.buyer_id, 'payment_confirmed', { transaction_id: refId });
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

  // ─── Admin Integration Routes ───────────────────────────────────────

  app.get("/api/admin/ipaymu/history", async (req, res) => {
    try {
      if (!IPAYMU_VA || !IPAYMU_API_KEY) {
        return res.status(500).json({ success: false, error: "iPaymu not configured" });
      }
      const { status = '1', startdate, enddate, page = '1', limit: limitStr = '20' } = req.query;
      const result = await ipaymuClient.getTransactionHistory({
        status: String(status),
        startdate: startdate ? String(startdate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enddate: enddate ? String(enddate) : new Date().toISOString().slice(0, 10),
        page: Number(page),
        limit: Math.min(Number(limitStr), 20),
        orderBy: 'id',
        order: 'DESC',
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("[Admin] iPaymu history error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/ipaymu/status/:transactionId", async (req, res) => {
    try {
      if (!IPAYMU_VA || !IPAYMU_API_KEY) {
        return res.status(500).json({ success: false, error: "iPaymu not configured" });
      }
      const { transactionId } = req.params;
      const result = await ipaymuClient.getTransactionStatus(transactionId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("[Admin] iPaymu status check error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/ipaymu/callbacks", async (req, res) => {
    try {
      const { limit: limitStr = '50', offset: offsetStr = '0' } = req.query;
      const limit = Math.min(Number(limitStr), 100);
      const offset = Number(offsetStr);
      const { data, error } = await supabase
        .from('transactions')
        .select('id, status, total_amount, buyer_name, payment_method, payment_details, created_at')
        .not('payment_details->>ipaymu_trx_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .not('payment_details->>ipaymu_trx_id', 'is', null);
      res.json({ success: true, data, total: count });
    } catch (error: any) {
      console.error("[Admin] Callbacks error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
