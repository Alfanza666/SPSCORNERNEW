// @ts-nocheck
import { __name } from "./route-utils.js";

export function registerMiscRoutes(app, { supabase, sendNotification, groq, sendSarirotiEmailInternal }) {

  app.post("/api/validate/receipt", async (req, res) => {
    try {
      const { imageBase64, totalAmount, mimeType = 'image/jpeg' } = req.body;
      if (!imageBase64 || !totalAmount) {
        return res.status(400).json({ error: 'Image and totalAmount required' });
      }
      const amountNum = Number(totalAmount);
      const amountFormatted = isNaN(amountNum) ? String(totalAmount) : amountNum.toLocaleString('id-ID');

      const prompt = `
      Kamu adalah sistem verifikasi bukti pembayaran untuk toko kantin digital.
      Analisis gambar berikut dan tentukan apakah ini adalah bukti transfer/pembayaran yang valid.

      Nominal transaksi yang harus dibayar: Rp ${amountFormatted}

      INSTRUKSI PENTING:
      - Gambar bisa berupa screenshot panjang dari aplikasi mobile banking, QRIS, GoPay, OVO, DANA, ShopeePay, atau aplikasi transfer lainnya.
      - JANGAN tolak hanya karena gambar tidak ter-crop atau ada elemen lain di sekitar nota.
      - Fokus mencari bukti pembayaran di MANA PUN lokasinya dalam gambar.
      - Cari teks nominal seperti: "${totalAmount}", "Rp ${amountFormatted}", atau angka yang mendekati ± 5%.
      - Cari indikator keberhasilan seperti: "Berhasil", "Sukses", "Success", "Selesai", tanda centang hijau, atau teks serupa.
      - Cari nama pengirim, nama penerima, atau nama bank/dompet digital sebagai konteks tambahan.
      - JANGAN tolak berdasarkan tanggal transaksi — customer mungkin upload bukti dari hari sebelumnya, itu TETAP VALID.
      - Jika nominal TERLIHAT dan status BERHASIL terdeteksi, anggap valid meskipun gambar tidak sempurna.

      TOLAK hanya jika:
      - Gambar bukan bukti pembayaran sama sekali (foto biasa, meme, dll)
      - Nominal yang terlihat JELAS berbeda jauh dari Rp ${amountFormatted}
      - Status transaksi JELAS menunjukkan gagal/pending/dibatalkan

      Balas HANYA dengan JSON tanpa markdown:
      {
        "valid": boolean,
        "reason": "Pesan singkat dalam Bahasa Indonesia. Jika valid sebutkan nominalnya. Jika tidak valid jelaskan alasannya."
      }
    `;

      const result = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const responseText = result.choices?.[0]?.message?.content || '';
      let parsed;
      try {
        parsed = JSON.parse(responseText.trim());
      } catch {
        // Fallback: AI returned non-JSON, treat as failed validation
        console.warn('[Validate] AI returned non-JSON:', responseText.substring(0, 200));
        parsed = { valid: false, reason: 'Sistem AI tidak dapat membaca gambar dengan jelas. Pastikan gambar bukti pembayaran terlihat jelas dan coba lagi.' };
      }

      res.json({ success: true, data: parsed });
    } catch (error) {
      console.error('[Validate] Receipt error:', error);
      // Fallback gracefully on Groq/network/timeout errors: let frontend allow manual verification
      res.json({
        success: true,
        data: {
          valid: false,
          fallbackToPending: true,
          reason: 'Layanan verifikasi otomatis sedang sibuk. Bukti pembayaran Anda tetap dapat dikirim untuk diverifikasi manual oleh Admin.'
        }
      });
    }
  });

  app.post("/api/ai/generate-form", async (req, res) => {
    try {
      const { prompt, messages: conversation, currentForm } = req.body;
      const isChat = Array.isArray(conversation) && conversation.length > 0;

      // Helper to sanitize fields from AI output
      function sanitizeAIFields(fields) {
        if (!Array.isArray(fields)) return [];
        return fields.map((f) => ({
          id: f.id || Math.random().toString(36).substr(2, 9),
          type: f.type || 'text',
          label: f.label || 'Pertanyaan',
          required: f.required || false,
          placeholder: f.placeholder || '',
          description: f.description || '',
          options: ['select', 'radio', 'checkbox', 'image_choice'].includes(f.type) && Array.isArray(f.options)
            ? f.options.filter((o) => o && o.label && o.label.trim())
            : undefined,
          max: f.type === 'rating' ? (f.max || 5) : undefined,
          max_scale: f.type === 'scale' ? (f.max_scale || 10) : undefined,
          condition: f.condition || undefined,
          items: f.type === 'addon_group' && Array.isArray(f.items) ? f.items : undefined,
          allow_multiple: f.type === 'addon_group' ? (f.allow_multiple ?? true) : undefined,
          qris_image_url: f.type === 'payment_section' ? (f.qris_image_url || '') : undefined,
          account_name: f.type === 'payment_section' ? (f.account_name || '') : undefined,
          payment_description: f.type === 'payment_section' ? (f.payment_description || '') : undefined,
          verify_with_ai: f.type === 'payment_section' ? (f.verify_with_ai ?? true) : undefined,
        }));
      }

      // Helper to extract updatedForm from raw parsed JSON (handles various model output shapes)
      function extractUpdatedForm(parsed, fallback) {
        // Shape 1: { updatedForm: { title, fields } }
        if (parsed.updatedForm && (parsed.updatedForm.fields || parsed.updatedForm.title)) {
          return parsed.updatedForm;
        }
        // Shape 2: { form: { title, fields } }
        if (parsed.form && (parsed.form.fields || parsed.form.title)) {
          return parsed.form;
        }
        // Shape 3: top-level has fields directly { title, fields, ... }
        if (parsed.fields && Array.isArray(parsed.fields)) {
          return parsed;
        }
        // Shape 4: { data: { updatedForm: ... } }
        if (parsed.data && parsed.data.updatedForm) {
          return parsed.data.updatedForm;
        }
        return null;
      }

      const systemPrompt = `Kamu adalah asisten AI pembuat formulir digital seperti JotForm.

TUGAS: Selalu kembalikan JSON valid dengan dua key: "message" dan "updatedForm".

ATURAN WAJIB:
1. Output HARUS berupa JSON murni — TANPA markdown, TANPA \`\`\`json, TANPA teks di luar JSON.
2. "message": string teks Bahasa Indonesia, singkat 1-2 kalimat, TIDAK boleh mengandung JSON atau kode.
3. "updatedForm": objek formulir LENGKAP dengan semua field yang diminta user. WAJIB ADA, TIDAK BOLEH null atau undefined.
4. Jika user minta buat form baru, LANGSUNG buat field-fieldnya. JANGAN hanya membalas dengan teks.
5. Jika currentForm ada, PERTAHANKAN field yang tidak dimodifikasi.

FORMAT OUTPUT WAJIB (tidak boleh ada yang berbeda):
{"message":"Teks respons singkat","updatedForm":{"title":"...","description":"...","theme_color":"#6366F1","layout_type":"classic","font_family":"Inter","input_style":"rounded","bg_image_url":"","card_glassmorphism":false,"fields":[{"id":"field_1","type":"text","label":"...","required":true,"placeholder":"..."}]}}

TIPE FIELD YANG TERSEDIA: text, textarea, number, select, radio, checkbox, rating, scale, date, file_upload

CONTOH: Jika user minta "buat form pendaftaran karyawan baru", output harus:
{"message":"Form pendaftaran karyawan baru sudah siap dengan 6 pertanyaan.","updatedForm":{"title":"Form Pendaftaran Karyawan Baru","description":"Isi data diri Anda dengan lengkap","theme_color":"#6366F1","layout_type":"classic","font_family":"Inter","input_style":"rounded","bg_image_url":"","card_glassmorphism":false,"fields":[{"id":"nama_lengkap","type":"text","label":"Nama Lengkap","required":true,"placeholder":"Masukkan nama lengkap Anda"},{"id":"nik_karyawan","type":"text","label":"NIK Karyawan","required":true,"placeholder":"Nomor Induk Karyawan"},{"id":"departemen","type":"select","label":"Departemen","required":true,"options":[{"value":"hr","label":"HR"},{"value":"produksi","label":"Produksi"},{"value":"engineering","label":"Engineering"}]},{"id":"tanggal_masuk","type":"date","label":"Tanggal Mulai Kerja","required":true},{"id":"no_hp","type":"text","label":"Nomor HP","required":true,"placeholder":"08xxxxxxxxxx"},{"id":"keterangan","type":"textarea","label":"Keterangan Tambahan","required":false,"placeholder":"Informasi lain yang perlu disampaikan"}]}}

Formulir saat ini: ${currentForm && currentForm.fields && currentForm.fields.length > 0 ? JSON.stringify(currentForm) : 'null (buat dari awal)'}`;

      const messages = [{ role: 'system', content: systemPrompt }];

      if (isChat) {
        for (const msg of conversation) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      } else {
        messages.push({ role: 'user', content: prompt || '' });
      }

      const result = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages,
        max_tokens: 4096,
        temperature: 0.4,
        response_format: { type: "json_object" }
      });

      let raw = result.choices?.[0]?.message?.content || '{}';
      console.log('[AI Chat Form] Raw response length:', raw.length);

      let parsed;
      try {
        parsed = JSON.parse(raw.trim());
      } catch (parseErr) {
        // Strip any accidental markdown fences and retry
        const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        try {
          parsed = JSON.parse(stripped);
        } catch {
          console.error('[AI Chat Form] JSON parse failed:', raw.substring(0, 300));
          return res.status(500).json({ success: false, error: 'AI mengembalikan format yang tidak valid. Coba lagi.' });
        }
      }

      const rawForm = extractUpdatedForm(parsed, currentForm);
      let updatedForm = null;

      if (rawForm && (rawForm.fields || rawForm.title)) {
        const sanitizedFields = sanitizeAIFields(rawForm.fields || []);
        updatedForm = {
          title: rawForm.title || 'Formulir Baru',
          description: rawForm.description || '',
          theme_color: rawForm.theme_color || '#6366F1',
          banner_url: rawForm.banner_url || '',
          layout_type: rawForm.layout_type || 'classic',
          font_family: rawForm.font_family || 'Inter',
          input_style: rawForm.input_style || 'rounded',
          bg_image_url: rawForm.bg_image_url || '',
          card_glassmorphism: rawForm.card_glassmorphism || false,
          fields: sanitizedFields,
        };
      }

      // If AI still didn't return a form, log for debugging
      if (!updatedForm) {
        console.warn('[AI Chat Form] No updatedForm in response. Keys:', Object.keys(parsed));
      }

      const message = typeof parsed.message === 'string' && !parsed.message.includes('{')
        ? parsed.message
        : (updatedForm ? `Formulir "${updatedForm.title}" berhasil dibuat dengan ${updatedForm.fields.length} pertanyaan.` : 'Permintaan Anda telah diproses.');

      res.json({ 
        success: true, 
        message,
        updatedForm 
      });
    } catch (error) {
      console.error('[AI Chat Form] Error:', error);
      res.status(500).json({ success: false, error: 'Gagal memproses AI. Coba lagi.' });
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
