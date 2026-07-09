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

      const systemPrompt = `
Kamu adalah asisten AI yang membantu user merancang, membuat, dan memodifikasi formulir digital secara interaktif (seperti JotForm).

Tugas utama kamu adalah merespons instruksi user dalam Bahasa Indonesia untuk memperbarui atau membuat konfigurasi formulir digital.
Kamu HARUS mengembalikan respons dalam format JSON valid dan utuh (TANPA markdown, TANPA tag \`\`\`json) dengan struktur berikut:
{
  "message": "Pesan balasan ramah dalam Bahasa Indonesia yang menjelaskan perubahan apa yang telah dilakukan. JANGAN bertele-tele atau banyak basa-basi. Tulis penjelasan sangat singkat, padat, dan langsung ke intinya (maksimal 2 kalimat) agar proses berjalan instan.",
  "updatedForm": { // Objek ini wajib disertakan jika formulir baru dibuat atau dirubah oleh instruksi user.
    "title": "Judul Formulir",
    "description": "Deskripsi Formulir",
    "theme_color": "#HexColor", // default: "#673AB7"
    "layout_type": "classic" | "card", // classic = scrollable biasa, card = satu pertanyaan per slide/kartu
    "font_family": "Inter" | "Outfit" | "Playfair Display" | "Space Grotesk", // default: "Inter"
    "input_style": "rounded" | "sharp" | "underline", // default: "rounded"
    "bg_image_url": "URL gambar background (opsional)",
    "card_glassmorphism": true | false, // default: false
    "fields": [ // Daftar semua field formulir lengkap setelah perubahan
      {
        "id": "id_unik_string",
        "type": "text" | "textarea" | "number" | "select" | "radio" | "checkbox" | "rating" | "scale" | "date" | "file_upload" | "image" | "image_choice" | "addon_group" | "payment_section",
        "label": "Pertanyaan / Label Field",
        "required": true | false,
        "placeholder": "Petunjuk isi (opsional)",
        "options": [{"value": "opt_value", "label": "Opsi Label", "price": 10000}], // opsional (price opsional) hanya untuk select, radio, checkbox, image_choice
        "max": 5, // hanya untuk rating
        "max_scale": 10, // hanya untuk scale
        "items": [{"id": "item1", "name": "Baju", "sizes": ["S", "M"], "price": 50000}], // hanya untuk addon_group
        "condition": { // logika bersyarat opsional
          "fieldId": "id_field_pemicu",
          "operator": "eq" | "neq" | "in",
          "value": "nilai_pemicu"
        }
      }
    ]
  }
}

PANDUAN PERILAKU:
- Bahasa: Gunakan Bahasa Indonesia yang ramah, sopan, langsung, dan profesional.
- Basa-basi: JANGAN berbelit-belit atau menulis paragraf panjang. Cukup jelaskan perubahan secara singkat di key "message".
- Modifikasi Form: Jika parameter currentForm di bawah ini dikirimkan, maka itu adalah struktur form saat ini. Lakukan modifikasi (tambah/hapus/edit field, ganti tema warna, ganti font, ubah layout) berdasarkan permintaan user. JANGAN menghapus field lain kecuali diminta oleh user.
- Tipe field baru: Jika menambahkan field baru, berikan ID acak yang unik (contoh: "nama_karyawan", "no_telp" atau random string singkat).
- Pastikan options selalu valid jika tipe field adalah pilihan (select/radio/checkbox/image_choice).

Formulir saat ini yang sedang diedit:
${currentForm ? JSON.stringify(currentForm, null, 2) : "Belum ada (rancang baru dari awal sesuai permintaan user)"}
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
        response_format: { type: "json_object" }
      });

      let raw = result.choices?.[0]?.message?.content || '{}';
      console.log('[AI Chat Form] JSON response received');
      const parsed = JSON.parse(raw.trim());

      res.json({ 
        success: true, 
        message: parsed.message || 'Formulir berhasil diproses.', 
        updatedForm: parsed.updatedForm 
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
