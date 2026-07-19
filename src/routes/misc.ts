// @ts-nocheck
import { __name } from "./route-utils.js";
import {
  issueReceiptValidationAttestation,
  recordReceiptValidationIssuance,
} from "../utils/receiptValidationToken.js";
import {
  loadCanonicalTransactionItems,
  normalizeTransactionCreationInput,
  resolveOptionalAuthenticatedBuyerId,
  sendTransactionValidationError,
} from "../utils/transactionCreationValidation.js";

export function registerMiscRoutes(app, { supabase, sendNotification, groq, sendSarirotiEmailInternal }) {

  app.post("/api/validate/receipt", async (req, res) => {
    try {
      const { imageBase64, totalAmount, items, buyer_id, mimeType = 'image/jpeg' } = req.body || {};
      if (!imageBase64 || !totalAmount) {
        return res.status(400).json({ error: 'Image and totalAmount required' });
      }
      // PWA lama belum mengirim snapshot keranjang. Jangan pernah menerbitkan
      // pengesahan success tanpa cart digest; arahkan transaksi ke verifikasi manual.
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({
          success: true,
          data: {
            valid: false,
            fallbackToPending: true,
            reason: 'Versi aplikasi ini belum dapat mengesahkan keranjang secara aman. Bukti akan diperiksa manual oleh Admin.',
          },
        });
      }

      const authenticatedBuyerId = await resolveOptionalAuthenticatedBuyerId(
        supabase,
        req.headers.authorization,
      );
      const normalized = normalizeTransactionCreationInput(
        { totalAmount, items, buyer_id },
        { authenticatedBuyerId, requireBuyerName: false },
      );
      const canonicalItems = await loadCanonicalTransactionItems(supabase, normalized.items);
      const amountNum = normalized.totalAmount;
      const amountFormatted = amountNum.toLocaleString('id-ID');
      const safeMimeType = /^image\/[a-z0-9.+-]+$/i.test(String(mimeType))
        ? String(mimeType)
        : 'image/jpeg';

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

      const visionModel = process.env.GROQ_VISION_MODEL?.trim() || 'qwen/qwen3.6-27b';
      if (!groq || !process.env.GROQ_API_KEY) {
        return res.json({
          success: true,
          data: {
            valid: false,
            fallbackToPending: true,
            reason: 'Verifikasi gambar otomatis belum tersedia. Bukti tetap dapat dikirim untuk review manual oleh Admin.',
          },
        });
      }
      const result = await groq.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${safeMimeType};base64,${imageBase64}` } },
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

      if (parsed.valid === true) {
        try {
          const attestation = issueReceiptValidationAttestation({
            amount: amountNum,
            imageBase64,
            items: canonicalItems,
            buyerId: normalized.buyerId,
          });
          await recordReceiptValidationIssuance(supabase, attestation.payload);
          parsed.validationToken = attestation.token;
        } catch (tokenError) {
          console.error('[Validate] Failed to issue server attestation:', tokenError?.message || tokenError);
          parsed = {
            valid: false,
            fallbackToPending: true,
            reason: 'Validasi berhasil dibaca, tetapi server belum dapat mengesahkan hasilnya. Bukti akan diperiksa manual oleh Admin.',
          };
        }
      }

      res.json({ success: true, data: parsed });
    } catch (error) {
      if (sendTransactionValidationError(res, error)) return;
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
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(" ")[1];
      if (!token) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin" && profile?.role !== "superadmin") {
        return res.status(403).json({ success: false, error: "Forbidden: Admin only" });
      }
      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({ success: false, error: 'AI belum dikonfigurasi di server. Hubungi administrator.' });
      }

      const { prompt, messages: conversation, currentForm } = req.body;
      const isChat = Array.isArray(conversation) && conversation.length > 0;
      const latestUserMessage = isChat
        ? [...conversation].reverse().find(message => message?.role === 'user')?.content
        : prompt;
      const userInstruction = typeof latestUserMessage === 'string' ? latestUserMessage.trim() : '';
      if (!userInstruction) return res.status(400).json({ success: false, error: 'Instruksi formulir wajib diisi.' });
      if (userInstruction.length > 4000) return res.status(400).json({ success: false, error: 'Instruksi terlalu panjang (maksimal 4.000 karakter).' });
      if (currentForm?.fields?.length > 100) return res.status(400).json({ success: false, error: 'Maksimal 100 pertanyaan per formulir.' });

      // Helper to sanitize fields from AI output
      function sanitizeAIFields(fields) {
        if (!Array.isArray(fields)) return [];
        const sourceFields = fields.slice(0, 100);
        const supportedTypes = [
          'text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'image_choice',
          'rating', 'scale', 'date', 'file_upload', 'image', 'addon_group', 'repeater', 'payment_section',
        ];
        const usedIds = new Set();
        const rawIdToSafeId = new Map();
        const sanitizedFields = sourceFields.map((rawField, index) => {
          const f = rawField && typeof rawField === 'object' ? rawField : {};
          const type = supportedTypes.includes(f?.type) ? f.type : 'text';
          const rawId = String(f?.id || `field_${index + 1}`);
          const idBase = rawId.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
          let id = idBase || `field_${index + 1}`;
          let suffix = 2;
          while (usedIds.has(id)) id = `${idBase}_${suffix++}`;
          usedIds.add(id);
          rawIdToSafeId.set(rawId, id);
          rawIdToSafeId.set(id, id);

          const supportsOptions = ['select', 'radio', 'checkbox', 'image_choice'].includes(type);
          const options = supportsOptions && Array.isArray(f.options)
            ? f.options.flatMap((rawOption, optionIndex) => {
                const option = rawOption && typeof rawOption === 'object' ? rawOption : {};
                const label = String(option.label || '').trim();
                if (!label) return [];
                return [{
                  value: String(option.value || `option_${optionIndex + 1}`),
                  label,
                  image: option.image ? String(option.image) : undefined,
                  price: Number.isFinite(Number(option.price)) ? Number(option.price) : undefined,
                  outcome_id: option.outcome_id ? String(option.outcome_id) : undefined,
                  helper_text: option.helper_text ? String(option.helper_text) : undefined,
                }];
              })
            : undefined;

          return {
            id,
            type,
            label: String(f?.label || `Pertanyaan ${index + 1}`).trim(),
            required: type === 'payment_section' ? false : f?.required === true,
            placeholder: String(f?.placeholder || ''),
            description: String(f?.description || ''),
            system_key: f?.system_key ? String(f.system_key) : undefined,
            options,
            min: type === 'number' && Number.isFinite(Number(f.min)) ? Number(f.min) : undefined,
            max: type === 'rating'
              ? Math.min(10, Math.max(3, Number(f.max) || 5))
              : type === 'number' && Number.isFinite(Number(f.max)) ? Number(f.max) : undefined,
            step: type === 'number' && Number.isFinite(Number(f.step)) ? Math.max(Number(f.step), 0.01) : undefined,
            unit_price: type === 'number' && Number.isFinite(Number(f.unit_price)) ? Math.max(Number(f.unit_price), 0) : undefined,
            max_scale: type === 'scale' ? Math.min(10, Math.max(2, Number(f.max_scale) || 10)) : undefined,
            items: type === 'addon_group' && Array.isArray(f.items)
              ? f.items.slice(0, 50).map((item, itemIndex) => ({
                  id: String(item?.id || `item_${itemIndex + 1}`),
                  name: String(item?.name || `Item ${itemIndex + 1}`),
                  sizes: Array.isArray(item?.sizes) ? item.sizes.map(String) : ['M'],
                  price: Number(item?.price) || 0,
                }))
              : undefined,
            allow_multiple: type === 'addon_group' ? (f.allow_multiple ?? true) : undefined,
            subfields: type === 'repeater' ? sanitizeAIFields(f.subfields || []) : undefined,
            min_items: type === 'repeater' ? Math.max(0, Number(f.min_items) || 0) : undefined,
            max_items: type === 'repeater' ? Math.min(50, Math.max(1, Number(f.max_items) || 5)) : undefined,
            item_label: type === 'repeater' ? String(f.item_label || 'Anggota') : undefined,
            item_unit_price: type === 'repeater' ? Math.max(0, Number(f.item_unit_price) || 0) : undefined,
            qris_image_url: type === 'payment_section' ? String(f.qris_image_url || '') : undefined,
            account_name: type === 'payment_section' ? String(f.account_name || '') : undefined,
            payment_description: type === 'payment_section' ? String(f.payment_description || '') : undefined,
            verify_with_ai: type === 'payment_section' ? f.verify_with_ai !== false : undefined,
            payment_methods: type === 'payment_section'
              ? (Array.isArray(f.payment_methods) ? f.payment_methods : ['bank_transfer', 'manual_qris'])
                  .filter(method => ['bank_transfer', 'manual_qris'].includes(method))
              : undefined,
            bank_accounts: type === 'payment_section' && Array.isArray(f.bank_accounts)
              ? f.bank_accounts.slice(0, 10).map((account, accountIndex) => ({
                  id: String(account?.id || `bank_${accountIndex + 1}`),
                  bank_name: String(account?.bank_name || ''),
                  account_number: String(account?.account_number || ''),
                  account_name: String(account?.account_name || ''),
                }))
              : undefined,
            payment_required_when: type === 'payment_section' ? 'total_positive' : undefined,
            proof_required: type === 'payment_section' ? (f.proof_required ?? true) : undefined,
          };
        });

        return sanitizedFields.map((field, index) => {
          const rawCondition = sourceFields[index]?.condition;
          const safeParentId = rawIdToSafeId.get(String(rawCondition?.fieldId || ''));
          const parentField = sanitizedFields.slice(0, index).find(candidate => candidate.id === safeParentId);
          if (!parentField || !['eq', 'neq', 'in'].includes(rawCondition?.operator)) return field;

          const normalizeValue = (value) => {
            const comparable = String(value).trim().toLowerCase();
            const option = parentField.options?.find(candidate =>
              candidate.value.trim().toLowerCase() === comparable
              || candidate.label.trim().toLowerCase() === comparable
            );
            return option?.value || String(value);
          };
          const values = (Array.isArray(rawCondition.value) ? rawCondition.value : [rawCondition.value])
            .filter(value => value !== undefined && value !== null && String(value).trim())
            .map(normalizeValue);
          if (values.length === 0) return field;

          return {
            ...field,
            condition: {
              fieldId: parentField.id,
              operator: rawCondition.operator,
              value: rawCondition.operator === 'in' ? values : values[0],
            },
          };
        });
      }

      // Helper to extract updatedForm from raw parsed JSON (handles various model output shapes)
      function extractUpdatedForm(parsed) {
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

      const systemPrompt = `Kamu adalah mesin pembuat dan pengubah schema formulir digital seperti Jotform.

TUGAS: Selalu kembalikan JSON valid dengan dua key: "message" dan "updatedForm".

ATURAN WAJIB:
1. Output HARUS berupa JSON murni — TANPA markdown, TANPA \`\`\`json, TANPA teks di luar JSON.
2. "message": string teks Bahasa Indonesia, singkat 1-2 kalimat, TIDAK boleh mengandung JSON atau kode.
3. "updatedForm": objek formulir LENGKAP dengan semua field yang diminta user. WAJIB ADA, TIDAK BOLEH null atau undefined.
4. Jika user minta buat form baru, LANGSUNG buat field-fieldnya. JANGAN hanya membalas dengan teks.
5. Jika currentForm ada, PERTAHANKAN id form, gaya, dan field yang tidak dimodifikasi. Selalu kirim schema formulir lengkap, bukan delta.
6. ID field harus unik, stabil, huruf kecil, dan tanpa spasi.
7. Untuk select/radio/checkbox, setiap options wajib memiliki value dan label.
8. Untuk percabangan, pasang condition pada PERTANYAAN TUJUAN (bukan induk) dan hanya referensikan field yang muncul sebelumnya.
9. Gunakan experience_version 2, layout_type card, review_enabled true, dan theme premium untuk formulir baru.
10. Jika satu jawaban harus langsung mengakhiri formulir, beri outcome_id pada opsi tersebut dan definisikan outcomes.
11. Harga selalu configurable: gunakan option.price, number.unit_price, repeater.item_unit_price, atau addon_group.items.price. Jangan menulis harga di label.
12. Untuk data anggota keluarga acara gunakan field number untuk jumlah orang, bukan repeater detail nama. Untuk pembayaran gunakan payment_section manual (bank_transfer/manual_qris), proof_required true, verify_with_ai true.

FORMAT OUTPUT WAJIB (tidak boleh ada yang berbeda):
{"message":"Teks respons singkat","updatedForm":{"title":"...","description":"...","experience_version":2,"theme_color":"#4F46E5","layout_type":"card","review_enabled":true,"autosave_draft":true,"theme":{"preset":"sps_event_premium","choice_style":"cards","show_progress":true},"outcomes":[],"fields":[{"id":"field_1","type":"text","label":"...","required":true,"placeholder":"...","condition":{"fieldId":"field_induk","operator":"eq","value":"nilai_opsi"}}]}}

TIPE FIELD YANG TERSEDIA: text, textarea, number, select, radio, checkbox, image_choice, rating, scale, date, file_upload, image, addon_group, repeater, payment_section
OPERATOR CONDITION: eq, neq, in. Nilai condition harus memakai option.value, bukan option.label.

CONTOH: Jika user minta "buat form pendaftaran karyawan baru", output harus:
{"message":"Form pendaftaran karyawan baru sudah siap dengan 6 pertanyaan.","updatedForm":{"title":"Form Pendaftaran Karyawan Baru","description":"Isi data diri Anda dengan lengkap","theme_color":"#6366F1","layout_type":"classic","font_family":"Inter","input_style":"rounded","bg_image_url":"","card_glassmorphism":false,"fields":[{"id":"nama_lengkap","type":"text","label":"Nama Lengkap","required":true,"placeholder":"Masukkan nama lengkap Anda"},{"id":"nik_karyawan","type":"text","label":"NIK Karyawan","required":true,"placeholder":"Nomor Induk Karyawan"},{"id":"departemen","type":"select","label":"Departemen","required":true,"options":[{"value":"hr","label":"HR"},{"value":"produksi","label":"Produksi"},{"value":"engineering","label":"Engineering"}]},{"id":"tanggal_masuk","type":"date","label":"Tanggal Mulai Kerja","required":true},{"id":"no_hp","type":"text","label":"Nomor HP","required":true,"placeholder":"08xxxxxxxxxx"},{"id":"keterangan","type":"textarea","label":"Keterangan Tambahan","required":false,"placeholder":"Informasi lain yang perlu disampaikan"}]}}

Formulir saat ini: ${currentForm && currentForm.fields && currentForm.fields.length > 0 ? JSON.stringify(currentForm) : 'null (buat dari awal)'}`;

      const messages = [{ role: 'system', content: systemPrompt }];

      messages.push({ role: 'user', content: userInstruction });

      const callFormModel = async (requestMessages) => {
        const result = await groq.chat.completions.create({
          model: process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile',
          messages: requestMessages,
          max_tokens: 4096,
          temperature: 0.25,
          response_format: { type: "json_object" }
        });
        return result.choices?.[0]?.message?.content || '{}';
      };

      const parseModelJSON = (content) => {
        const candidates = [
          content.trim(),
          content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(),
        ];
        for (const candidate of candidates) {
          try { return JSON.parse(candidate); } catch { /* try next representation */ }
        }
        return null;
      };

      let raw = await callFormModel(messages);
      let parsed = parseModelJSON(raw);
      let rawForm = parsed ? extractUpdatedForm(parsed) : null;

      // A model occasionally returns only a friendly chat message. Repair once
      // automatically so the user action always targets the canvas schema.
      if (!rawForm) {
        const repairMessages = [
          ...messages,
          { role: 'assistant', content: raw.slice(0, 8000) },
          {
            role: 'user',
            content: 'Respons sebelumnya belum memiliki updatedForm. Ulangi sekarang sebagai JSON murni dengan updatedForm lengkap dan minimal satu field.',
          },
        ];
        raw = await callFormModel(repairMessages);
        parsed = parseModelJSON(raw);
        rawForm = parsed ? extractUpdatedForm(parsed) : null;
      }

      if (!parsed) {
        console.error('[AI Chat Form] JSON parse failed after retry:', raw.substring(0, 300));
        return res.status(502).json({ success: false, error: 'AI mengembalikan format yang tidak valid. Silakan coba lagi.' });
      }

      let updatedForm = null;

      if (rawForm && (rawForm.fields || rawForm.title)) {
        const sanitizedFields = sanitizeAIFields(rawForm.fields || currentForm?.fields || []);
        updatedForm = {
          // Never trust a model-generated form id; database identity must remain stable.
          id: currentForm?.id,
          title: rawForm.title || currentForm?.title || 'Formulir Baru',
          description: rawForm.description ?? currentForm?.description ?? '',
          theme_color: rawForm.theme_color || currentForm?.theme_color || '#6366F1',
          banner_url: rawForm.banner_url ?? currentForm?.banner_url ?? '',
          layout_type: rawForm.layout_type || currentForm?.layout_type || 'classic',
          font_family: rawForm.font_family || currentForm?.font_family || 'Inter',
          input_style: rawForm.input_style || currentForm?.input_style || 'rounded',
          bg_image_url: rawForm.bg_image_url ?? currentForm?.bg_image_url ?? '',
          card_glassmorphism: rawForm.card_glassmorphism ?? currentForm?.card_glassmorphism ?? false,
          experience_version: rawForm.experience_version === 1 ? 1 : (currentForm?.experience_version || 2),
          theme: rawForm.theme || currentForm?.theme,
          outcomes: Array.isArray(rawForm.outcomes) ? rawForm.outcomes : (currentForm?.outcomes || []),
          default_outcome_id: rawForm.default_outcome_id || currentForm?.default_outcome_id,
          review_enabled: rawForm.review_enabled ?? currentForm?.review_enabled ?? true,
          autosave_draft: rawForm.autosave_draft ?? currentForm?.autosave_draft ?? true,
          program_automation: rawForm.program_automation || currentForm?.program_automation,
          fields: sanitizedFields,
        };
      }

      // If AI still didn't return a form, log for debugging
      if (!updatedForm) {
        console.warn('[AI Chat Form] No updatedForm in response. Keys:', Object.keys(parsed));
        return res.status(422).json({ success: false, error: 'AI belum menghasilkan schema formulir. Ulangi dengan kriteria yang lebih spesifik.' });
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
        to || process.env.SARIROTI_ADMIN_EMAIL || "";
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

  app.post('/api/notifications/admin-feedback', async (req, res) => {
    try {
      const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });
      const title = String(req.body?.title || '').slice(0, 120);
      const message = String(req.body?.message || '').slice(0, 500);
      const path = String(req.body?.path || '/dashboard/admin/pengaduan').slice(0, 200);
      if (!title || !message) return res.status(400).json({ error: 'Judul dan pesan wajib diisi' });
      const { data: admins, error } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin']);
      if (error) throw error;
      await Promise.all((admins || []).map(admin => sendNotification(admin.id, { type: 'system', title, message, path })));
      res.json({ success: true, count: (admins || []).length });
    } catch (error) { console.error('[admin-feedback-notification]', error); res.status(500).json({ error: 'Gagal mengirim notifikasi' }); }
  });

}
