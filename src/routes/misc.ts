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
      });

      const responseText = result.choices?.[0]?.message?.content || '';
      const cleanJson = responseText.replace(/```json?\n?|```/g, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        // Fallback: AI returned non-JSON, treat as failed validation
        console.warn('[Validate] AI returned non-JSON:', cleanJson.substring(0, 200));
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
      const { prompt, messages: conversation } = req.body;
      const isChat = Array.isArray(conversation) && conversation.length > 0;

      const systemPrompt = `
Kamu adalah asisten AI yang membantu user membuat formulir digital secara CHAT/PERCAKAPAN.

PANDUAN PERCAKAPAN:
- Kamu HARUS BICARA DALAM BAHASA INDONESIA.
- Jika user belum memberikan deskripsi yang cukup, tanyakan detail yang diperlukan secara ramah dan natural.
- Jika user sudah memberikan deskripsi yang cukup detail, AKHIRI balasan kamu dengan marker:
  ---GENERATE---
  lalu di baris berikutnya output HANYA array JSON dari field-field formulir.
- Jangan pernah mengeluarkan marker ---GENERATE--- jika masih butuh informasi tambahan.
- Pastikan user menyebutkan field-field apa saja yang diperlukan sebelum generate.

Tipe field yang tersedia:
- "text"     : Teks jawaban singkat (input pendek)
- "textarea" : Paragraf / teks panjang
- "number"   : Angka
- "select"   : Dropdown / tarik-turun (butuh options)
- "radio"    : Pilihan ganda (butuh options)
- "checkbox" : Centang banyak pilihan (butuh options)
- "rating"   : Penilaian bintang 1-5
- "scale"    : Skala linier 1-10
- "date"     : Tanggal
- "file_upload" : Upload file
- "image"    : Upload gambar / URL gambar

Setiap field harus punya properti:
{
  "id": "string_unik",
  "type": "salah satu tipe di atas",
  "label": "Pertanyaan",
  "required": true/false,
  "placeholder": "Petunjuk mengisi (optional)",
  "options": [{"value": "opt1", "label": "Opsi 1"}] // hanya untuk select/radio/checkbox
}

FIELD BERSYARAT (CONDITIONAL LOGIC):
Gunakan properti "condition" jika suatu field bergantung pada field sebelumnya:
{
  "condition": {
    "fieldId": "id_dari_field_pemicu",
    "operator": "eq",    // eq, neq, atau in
    "value": "nilai_pemicu"
  }
}

Contoh:
{
  "id": "kehadiran",
  "type": "radio",
  "label": "Apakah Anda hadir?",
  "required": true,
  "options": [{"value":"ya_hadir","label":"Ya, Hadir"},{"value":"tidak_hadir","label":"Tidak Hadir"}]
},
{
  "id": "ukuran_baju",
  "type": "select",
  "label": "Ukuran Baju",
  "required": true,
  "options": [{"value":"S","label":"S"},{"value":"M","label":"M"},{"value":"L","label":"L"}],
  "condition": {"fieldId": "kehadiran", "operator": "eq", "value": "ya_hadir"}
}

INGAT: Kamu adalah AI yang CHAT dengan user. Bicaralah secara natural, bantu user mendeskripsikan form yang mereka butuhkan. Jangan langsung generate jika deskripsi masih kurang.
`;

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
        temperature: 0.7,
      });

      let raw = result.choices?.[0]?.message?.content || '';
      console.log('[AI Chat Form] Raw response:', raw.slice(0, 500));

      const generateMarker = '---GENERATE---';
      const markerIndex = raw.indexOf(generateMarker);

      if (markerIndex >= 0) {
        const chatPart = raw.substring(0, markerIndex).trim();
        const jsonPart = raw.substring(markerIndex + generateMarker.length).trim();

        let clean = jsonPart;
        const jsonMatch = clean.match(/\[[\s\S]*\]/);
        if (jsonMatch) clean = jsonMatch[0];

        let fields = [];
        try {
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed)) fields = parsed;
        } catch {
          console.log('[AI Chat Form] JSON parse failed on:', clean.slice(0, 300));
        }

        if (fields.length > 0) {
          return res.json({ success: true, type: 'fields', message: chatPart, data: fields });
        }
      }

      res.json({ success: true, type: 'chat', message: raw });
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
