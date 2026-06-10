// @ts-nocheck
import { __name } from "./route-utils.js";

export function registerMiscRoutes(app, { supabase, sendNotification, groq, sendSarirotiEmailInternal }) {

  app.post("/api/validate/receipt", async (req, res) => {
    try {
      const { imageBase64, totalAmount } = req.body;
      if (!imageBase64 || !totalAmount) {
        return res.status(400).json({ error: 'Image and totalAmount required' });
      }

      const prompt = `
      Analyze this transfer receipt image.
      I need to verify if this is a valid payment receipt for the exact amount of Rp ${totalAmount}.
      
      CRITICAL CHECKS:
      1. Is it a valid payment/transfer receipt? (Not a random image)
      2. Does the amount match EXACTLY ${totalAmount} or Rp ${totalAmount}?
      3. Is the status "Berhasil", "Sukses", or "Successful"?
      4. Is the date of the transaction today or within the last 24 hours?
      
      You MUST respond in valid JSON format ONLY, with no markdown formatting or extra text.
      Structure:
      {
        "valid": boolean,
        "reason": "string. Jika valid, berikan pesan sukses singkat. Jika tidak valid, berikan alasan spesifik dalam Bahasa Indonesia."
      }
    `;

      const result = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.1,
      });

      const responseText = result.choices?.[0]?.message?.content || '';
      const cleanJson = responseText.replace(/```json?|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      res.json({ success: true, data: parsed });
    } catch (error) {
      console.error('[Validate] Receipt error:', error);
      res.status(500).json({ success: false, error: error.message });
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

}
