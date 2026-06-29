// @ts-nocheck
import { __name } from "./route-utils.js";
import { IpaymuSignature } from "../services/ipaymu/signature.js";

export function registerPaymentRoutes(app, {
  supabase, sendNotification, ipaymuClient, sendSarirotiEmailInternal,
  sendWANotification, processDigitalItems, updateSellerBalances,
  updateBuyerPoints, triggerSarirotiEmail, checkLowStockAndNotify,
  sendBuyerReceiptEmail, getDigiflazzAxiosConfig, crypto, restoreTransactionStock, deductTransactionStock,
  IPAYMU_VA, IPAYMU_API_KEY, IPAYMU_SIGNATURE_KEY, IPAYMU_PRODUCTION, groq,
}) {
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
      // Ambil data transaksi termasuk tanggal dibuat
      const { data: txRecord } = await supabase
        .from("transactions")
        .select("created_at, status, payment_details")
        .eq("id", transaction_id)
        .single();

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

        Nominal transaksi yang harus dibayar: Rp ${Number(expected_amount).toLocaleString('id-ID')}
        Tanggal transaksi dibuat: ${txDateFormatted || 'tidak diketahui'}${txDateShort ? ` (${txDateShort})` : ''}

        INSTRUKSI PENTING:
        - Gambar bisa berupa screenshot panjang dari aplikasi mobile banking, QRIS, GoPay, OVO, DANA, ShopeePay, atau aplikasi transfer lainnya.
        - JANGAN tolak hanya karena gambar tidak ter-crop atau ada elemen lain di sekitar nota.
        - Fokus mencari bukti pembayaran di MANA PUN lokasinya dalam gambar.
        - Cari teks nominal seperti: "${expected_amount}", "Rp ${Number(expected_amount).toLocaleString('id-ID')}", atau angka yang mendekati ±5%.
        - Cari indikator keberhasilan: "Berhasil", "Sukses", "Success", "Selesai", tanda centang hijau, atau teks serupa.
        - Cari nama pengirim, nama penerima, atau nama bank/dompet digital sebagai konteks pendukung.

        PENGECEKAN TANGGAL (WAJIB):
        - Cari tanggal transaksi di nota/bukti pembayaran.
        - Tanggal di nota harus sesuai dengan tanggal transaksi: ${txDateFormatted || 'tidak diketahui'}.
        - Toleransi tanggal: HANYA boleh beda 1 hari (bisa H atau H-1 dari ${txDateFormatted || 'tanggal transaksi'}).
        - Jika tanggal di nota JAUH berbeda (lebih dari 1 hari), TOLAK dengan alasan tanggal tidak sesuai.
        - Jika tanggal di nota TIDAK TERLIHAT, abaikan pengecekan tanggal dan fokus ke nominal & status saja.

        TOLAK hanya jika:
        - Gambar bukan bukti pembayaran sama sekali
        - Nominal yang terlihat JELAS berbeda jauh dari Rp ${Number(expected_amount).toLocaleString('id-ID')}
        - Status transaksi JELAS menunjukkan gagal/pending/dibatalkan
        - Tanggal di nota JELAS berbeda lebih dari 1 hari dari tanggal transaksi

        Balas HANYA dengan JSON tanpa markdown:
        {
          "isValid": boolean,
          "amountFound": number or null,
          "reason": "Pesan singkat dalam Bahasa Indonesia. Jika valid sebutkan nominal dan tanggal yang terdeteksi. Jika tidak valid jelaskan alasannya."
        }
      `;
      if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ success: false, error: "GROQ_API_KEY tidak dikonfigurasi di backend (.env). Sistem verifikasi AI tidak dapat berjalan." });
      }
      const groqResponse = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
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

      // Deduct points from profile (cache)
      const { error: deductError } = await supabase
        .from("profiles")
        .update({ loyalty_points: profile.loyalty_points - tx.total_amount })
        .eq("id", tx.buyer_id);
      if (deductError) throw deductError;

      // Record points spent in history
      await supabase.from("points_history").insert({
        user_id: tx.buyer_id,
        transaction_id,
        points: -tx.total_amount,
        type: "spent",
        description: `Bayar transaksi Rp ${tx.total_amount.toLocaleString()} dengan poin`,
      });

      // Update transaction
      const { error: updateTx } = await supabase
        .from("transactions")
        .update({ 
          status: "success", 
          payment_method: "points",
          metadata: { ...tx.metadata, point_payment: true, points_used: tx.total_amount }
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

  // Partial payment with points (split payment: points + remainder via other method)
  app.post("/api/payment/points/partial-pay", async (req, res) => {
    try {
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

      // Deduct points
      const { error: deductError } = await supabase
        .from("profiles")
        .update({ loyalty_points: (profile.loyalty_points || 0) - pointsToUse })
        .eq("id", tx.buyer_id);
      if (deductError) throw deductError;

      // Record points spent
      await supabase.from("points_history").insert({
        user_id: tx.buyer_id,
        transaction_id,
        points: -pointsToUse,
        type: "spent",
        description: `Pembayaran parsial Rp ${pointsToUse.toLocaleString()} dari Rp ${tx.total_amount.toLocaleString()}`,
      });

      // Update transaction with points discount, remainder still pending
      const remainingAmount = tx.total_amount - pointsToUse;
      const { error: updateTx } = await supabase
        .from("transactions")
        .update({
          total_amount: remainingAmount,
          metadata: { 
            ...tx.metadata, 
            point_payment: true, 
            points_used: pointsToUse,
            original_amount: tx.total_amount,
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
      const body = req.body || {};
      
      // ─── Verifikasi HMAC Signature iPaymu ─────────────────────────
      const receivedSignature = body.signature || body.Signature || '';
      if (receivedSignature) {
        const isValid = IpaymuSignature.verify(body, receivedSignature, IPAYMU_API_KEY);
        if (!isValid) {
          console.error('[iPaymu] Invalid callback signature! Possible fraud attempt.');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } else {
        console.warn('[iPaymu] No signature in callback — skipping verification');
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
      // ─── Stock re-deduction: jika auto-cleanup sudah restore stock, deduct kembali ───
      if (txStatus === "paid" && transaction.metadata?.stock_restored && deductTransactionStock) {
        await deductTransactionStock(refId);
      }

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
          // restoreTransactionStock has internal guard against double-restore
          await restoreTransactionStock(refId);
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
}
