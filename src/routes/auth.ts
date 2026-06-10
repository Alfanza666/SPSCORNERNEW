// @ts-nocheck
import crypto from "crypto";
import { __name } from "./route-utils.js";

export function registerAuthRoutes(app, { supabase, sendNotification, sendSarirotiEmailInternal }) {

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

}
