// @ts-nocheck
import { __name } from "./route-utils.js";

export function registerTransactionRoutes(app, {
  supabase, sendNotification, sendWANotification,
  sendSarirotiEmailInternal, sendBuyerReceiptEmail,
  restoreTransactionStock, deductTransactionStock, atomicAdjustStock, checkLowStockAndNotify,
  updateSellerBalances, updateBuyerPoints,
  processDigitalItems, triggerSarirotiEmail,
  getDigiflazzBalance,
}) {

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

    // Re-deduct stock if auto-cleanup had restored it
    if (transaction.metadata?.stock_restored && deductTransactionStock) {
      await deductTransactionStock(transaction_id);
    }

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

    // ─── Server-side stock deduction (atomic via RPC → optimistic locking) ───
    const physicalItems = (insertedItems || []).filter(item => !item.metadata?.is_digital && item.product_id);
    const deductedProducts = {};
    for (const item of physicalItems) {
      const result = await atomicAdjustStock(
        item.product_id, -item.quantity,
        item.seller_id || txDataToInsert.buyer_id, 'sale',
        `Stock deducted from transaction ${tx.id}`, 0, tx.id
      );
      if (result && result.success) {
        deductedProducts[item.product_id] = { quantity: item.quantity, seller_id: item.seller_id };
      }
    }
    const hasDeducted = Object.keys(deductedProducts).length > 0;

    // Update transaction with stock_deducted flag + deducted_products map in metadata
    await supabase
      .from("transactions")
      .update({
        metadata: {
          ...(tx.metadata || {}),
          stock_deducted: hasDeducted,
          ...(hasDeducted ? { deducted_products: deductedProducts } : {})
        }
      })
      .eq("id", tx.id);

    // Also update local tx object for downstream use
    tx.metadata = {
      ...(tx.metadata || {}),
      stock_deducted: hasDeducted,
      ...(hasDeducted ? { deducted_products: deductedProducts } : {})
    };

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

// ─── Order tracking: status flow endpoints ──────────────────────────────────
app.post("/api/transactions/:id/process", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: tx, error } = await supabase.from("transactions").select("*, transaction_items(*)").eq("id", id).single();
    if (error || !tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.status !== "paid") return res.status(400).json({ error: "Only paid orders can be processed" });
    await supabase.from("transactions").update({
      status: "processed",
      processed_at: new Date().toISOString(),
      metadata: { ...(tx.metadata || {}), processed_by: req.body?.user_id || null },
    }).eq("id", id);
    if (tx.buyer_id) {
      await sendNotification(tx.buyer_id, {
        type: "transaction", title: "📦 Pesanan Diproses",
        message: `Pesanan #${id.slice(0,8)} sedang diproses oleh penjual.`,
        path: `/kiosk/history?id=${id}`,
      });
      await sendWANotification(tx.buyer_id, 'order_processed', { transaction_id: id });
    }
    res.json({ success: true, status: "processed" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/transactions/:id/ready", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: tx, error } = await supabase.from("transactions").select("*").eq("id", id).single();
    if (error || !tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.status !== "processed" && tx.status !== "paid") return res.status(400).json({ error: "Order must be processed first" });
    await supabase.from("transactions").update({
      status: "ready",
      ready_at: new Date().toISOString(),
    }).eq("id", id);
    if (tx.buyer_id) {
      await sendNotification(tx.buyer_id, {
        type: "transaction", title: "🟢 Pesanan Siap Diambil!",
        message: `Pesanan #${id.slice(0,8)} sudah siap diambil.`,
        path: `/kiosk/history?id=${id}`,
      });
      await sendWANotification(tx.buyer_id, 'order_ready', { transaction_id: id });
    }
    res.json({ success: true, status: "ready" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/transactions/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: tx, error } = await supabase.from("transactions").select("*").eq("id", id).single();
    if (error || !tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.status !== "ready") return res.status(400).json({ error: "Order must be ready first" });
    await supabase.from("transactions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", id);
    if (tx.buyer_id) {
      await sendNotification(tx.buyer_id, {
        type: "transaction", title: "🎉 Pesanan Selesai!",
        message: `Pesanan #${id.slice(0,8)} telah selesai. Terima kasih!`,
        path: `/kiosk/history?id=${id}`,
      });
      await sendWANotification(tx.buyer_id, 'order_completed', { transaction_id: id });
    }
    res.json({ success: true, status: "completed" });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    const filteredItems = items?.filter((item) =>
      item.transactions !== null &&
      ['paid', 'success', 'completed'].includes(item.transactions.status)
    ) || [];

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(filteredItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

}
