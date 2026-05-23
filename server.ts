// @ts-nocheck
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", { value, configurable: true });
import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
// ========== SELLER REGISTRATION ==========

// API untuk admin generate link pendaftaran seller
app.post("/api/admin/seller-registration-links", async (req, res) => {
  try {
    const { days, maxUses = 1, notes } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

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

    const { data: program } = await supabase.from("union_programs").select("is_targeted, name").eq("id", program_id).single();
    if (!program) return res.status(404).json({ error: "Program not found" });

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
            message: `Program "${title}" telah dibuka! Anda terdaftar sebagai peserta dan berhak menerima manfaat program ini. Cek kupon Anda di menu Program.`,
            path: "/portal/program"
          });
        } else {
          await sendNotification(u.id, {
            type: "system",
            title: `📢 Program Baru: ${title}`,
            message: `Program "${title}" telah dibuka di Portal Serikat. Segera cek informasi dan jadwalnya!`,
            path: "/portal/program"
          });
        }
      }
    } else {
      // Non-targeted: notify all employees
      await Promise.allSettled(employeeUsers.map(u => sendNotification(u.id, {
        type: "system",
        title: `📢 Program Baru: ${title}`,
        message: `Program "${title}" telah dibuka di Portal Serikat. Segera cek informasi dan jadwalnya!`,
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
          .select("id")
          .in("status", ["pending", "failed"])
          .lt("created_at", fiveMinsAgo);
        if (!expired || expired.length === 0) return;
        await supabase
          .from("transactions")
          .update({
            status: "failed",
            metadata: { cancel_reason: "Auto-cancelled: Unpaid > 5 minutes" },
          })
          .in("id", expired.map(tx => tx.id));
        for (const tx of expired) {
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

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })();
}
// TEMP: Run SQL via pg direct
app.post("/api/run-sql-temp", async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: "No SQL" });
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const pool = new Pool({
      host: 'db.jofwebrbdlovwkgklwab.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: key,
      max: 1,
      ssl: { rejectUnauthorized: false }
    });
    const result = await pool.query(sql);
    await pool.end();
    res.json({ success: true, rows: result.rows });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

var server_default = app;
export { server_default as default };
