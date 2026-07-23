// @ts-nocheck
import { __name } from "./route-utils.js";

export function registerPortalRoutes(app, { supabase, sendNotification, ipaymuClient }) {

  app.get("/api/portal/points/balance", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

      // Calculate from points_history (FIFO-aware)
      const { data: history } = await supabase
        .from("points_history")
        .select("points, type, expires_at, earned_at")
        .eq("user_id", user.id)
        .order("earned_at", { ascending: true });

      let balance = 0;
      let expiringSoon = 0;
      const now = new Date();

      if (history) {
        for (const h of history) {
          if (h.type === "earned") {
            if (h.expires_at && new Date(h.expires_at) <= now) continue;
            balance += h.points;
            if (h.expires_at) {
              const daysLeft = Math.floor((new Date(h.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              if (daysLeft <= 30 && daysLeft >= 0) expiringSoon += h.points;
            }
          } else if (h.type === "spent" || h.type === "expired") {
            balance += h.points; // negative
          }
        }
      }

      // Also check profile cache
      const { data: profile } = await supabase
        .from("profiles")
        .select("loyalty_points")
        .eq("id", user.id)
        .single();

      res.json({ 
        success: true, 
        balance: Math.max(0, balance),
        cached_balance: profile?.loyalty_points || 0,
        expiring_soon: expiringSoon
      });
    } catch (error) {
      console.error("Points balance error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user points history
  app.get("/api/portal/points/history", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from("points_history")
        .select("*")
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error("Points history error:", error);
      res.status(500).json({ error: error.message });
    }
  });

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

  // Close/expire a program and its active coupons
  app.post("/api/admin/programs/:programId/close", async (req, res) => {
    try {
      const { programId } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin" && profile?.role !== "superadmin") return res.status(403).json({ error: "Forbidden" });

      const { data: program } = await supabase.from("union_programs").select("*").eq("id", programId).single();
      if (!program) return res.status(404).json({ error: "Program not found" });
      if (!program.is_active) return res.status(400).json({ error: "Program already inactive" });

      // 1. Expire all active coupons
      const { error: couponError } = await supabase
        .from("program_coupons")
        .update({ status: "expired" })
        .eq("program_id", programId)
        .eq("status", "active");
      if (couponError) throw couponError;

      // 2. Deactivate program
      const { error: progError } = await supabase
        .from("union_programs")
        .update({ 
          is_active: false,
          metadata: { 
            ...(program.metadata || {}), 
            closed_at: new Date().toISOString(),
            closed_by: user.id,
            close_reason: "manual"
          }
        })
        .eq("id", programId);
      if (progError) throw progError;

      res.json({ success: true, message: "Program ditutup dan kupon di-expire" });
    } catch (error: any) {
      console.error("Close program error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // NEW ROUTE: FAMILY PAYMENT CHECKOUT
  // =====================================================
  app.post("/api/portal/programs/:programId/checkout-family", async (req, res) => {
    try {
      const { programId } = req.params;
      const { familyCount, totalAmount, userEmail, userName, userPhone } = req.body;

      // Auth: get userId from token, not from req.body
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
      const userId = user.id;

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
        notifyUrl: `${process.env.API_URL || 'https://api.spscorner.store'}/api/payment/ipaymu/callback`,
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
}
