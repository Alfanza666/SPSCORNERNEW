// Server-side Griphub Router client using the OpenAI-compatible chat API.
function parseGriphubResponse(responseText, contentType) {
  if (contentType.includes('text/event-stream')) {
    const chunks = responseText
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .filter(data => data && data !== '[DONE]')
      .flatMap(data => {
        try { return [JSON.parse(data)]; } catch { return []; }
      });
    const content = chunks
      .map(chunk => chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || '')
      .join('');
    const firstChoice = chunks.find(chunk => Array.isArray(chunk.choices))?.choices?.[0] || {};
    return {
      ...chunks.at(-1),
      choices: [{
        ...firstChoice,
        message: { ...(firstChoice.message || {}), content },
      }],
    };
  }

  try {
    return responseText ? JSON.parse(responseText) : null;
  } catch {
    return { error: responseText.slice(0, 500) };
  }
}

// Helper pembersih respons AI:
// Model Griphub (gpt-5.6-luna) adalah reasoning model — responsnya sering menyertakan
// blok reasoning (<think>/<reasoning>/<seed>) sebelum JSON jawaban, dan bisa menyisipkan
// token NaN (bukan JSON valid) sebagai nilai angka. Fungsi ini membersihkan semua pembungkus
// itu, mengekstrak objek JSON paling seimbang, dan menormalkan NaN -> null agar aman di-parse.
function stripAiWrapper(text) {
  let cleaned = String(text || '')
    // Buang code fence markdown dulu (bisa muncul di dalam blok reasoning).
    .replace(/```(?:json)?\s*/gi, ' ')
    .replace(/```/g, ' ')
    .trim();

  // Buang blok reasoning utuh (berbagai variasi nama tag). Loop untuk menangani tag bersarang.
  // Nama tag diikuti batas (spasi/>) agar field JSON seperti "reason":... TIDAK cocok sebagai tag <reason>.
  const tagNames = '(think|thinking|reasoning|reason|seed|cot|thought)';
  const closedTag = new RegExp(`<${tagNames}(?=[\\s>])[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
  let prev;
  do {
    prev = cleaned;
    cleaned = cleaned.replace(closedTag, ' ');
  } while (cleaned !== prev);

  // Buang blok reasoning yang TERPOTONG (tag pembuka tanpa penutup). Penting: hanya
  // hapus dari tag terakhir yang tak tertutup jika setelahnya tidak ada JSON lengkap,
  // supaya jawaban JSON yang kebetulan mengandung kata "reason" tidak ikut terhapus.
  const openTag = new RegExp(`<${tagNames}(?=[\\s>])[^>]*>`, 'gi');
  let match;
  let lastOpenIdx = -1;
  while ((match = openTag.exec(cleaned)) !== null) {
    const hasClose = new RegExp(`</${match[1]}\\s*>`, 'i').test(cleaned.slice(openTag.lastIndex));
    if (!hasClose) { lastOpenIdx = match.index; break; }
  }

  // Ekstrak objek JSON paling seimbang (brace-matching), bukan sekadar first-{ sampai last-},
  // supaya tidak terpotong oleh kurung kurawal yang muncul di teks pengantar.
  let extracted = extractBalancedJson(cleaned);

  // Jika ada tag pembuka terpotong DAN JSON yang terekstrak ternyata berada DI DALAM blok
  // reasoning (posisinya setelah tag terbuka), itu berarti reasoning bocor — buang prefix-nya.
  if (!extracted && lastOpenIdx !== -1) {
    cleaned = cleaned.slice(0, lastOpenIdx).trim();
    extracted = extractBalancedJson(cleaned);
  }
  // Jika JSON ditemukan setelah tag terpotong, ambil JSON-nya saja (buang reasoning prefix).
  if (extracted && lastOpenIdx !== -1) {
    const jsonPos = cleaned.indexOf(extracted);
    if (jsonPos > lastOpenIdx) {
      // JSON valid muncul setelah reasoning terpotong — gunakan JSON-nya.
      cleaned = extracted;
    } else {
      cleaned = extracted;
    }
  } else if (extracted) {
    cleaned = extracted;
  }

  // Normalisasi NaN/Infinity (bukan JSON valid) menjadi null.
  cleaned = cleaned
    .replace(/:\s*NaN\b/g, ': null')
    .replace(/:\s*Infinity\b/g, ': null')
    .replace(/:\s*-Infinity\b/g, ': null');

  return cleaned.trim();
}

// Mencari substring objek/array JSON pertama yang kurungnya seimbang.
// Menghormati string (abaikan kurung di dalam tanda kutip) & escape sequence.
function extractBalancedJson(text) {
  const s = String(text || '');
  const start = s.search(/[{[]/);
  if (start === -1) return '';
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  // Kurung tidak seimbang (respons terpotong) — kembalikan string kosong agar caller
  // memutuskan fallback (jangan parse setengah objek yang menyesatkan).
  return '';
}

async function callProvider(baseURL, apiKey, payload, timeoutMs = 30000) {
  // Reasoning model (gpt-5.6-luna) memakai token untuk blok reasoning SEBELUM jawaban.
  // Batas 600 terlalu kecil — jawaban JSON sering terpotong (finish_reason: length) dan
  // menyebabkan "Unexpected end of JSON input". Naikkan ceiling agar ada ruang untuk
  // reasoning + jawaban; pemanggil tetap bisa minta nilai lebih kecil.
  const requestedMaxTokens = Number(payload?.max_tokens);
  const maxTokens = Number.isFinite(requestedMaxTokens)
    ? Math.min(Math.max(requestedMaxTokens, 64), 4096)
    : 1500;
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ...payload, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const responseText = await response.text();
  const responseBody = parseGriphubResponse(
    responseText,
    response.headers.get('content-type') || '',
  );

  if (!response.ok) {
    const message = responseBody?.error?.message || responseBody?.error || `Provider request failed: ${response.status}`;
    const error = new Error(String(message));
    error.status = response.status;
    error.retryable = response.status === 429 || /rate limit|try again/i.test(message);
    throw error;
  }

  return responseBody;
}

// Groq tier gratis punya batas token/menit yang kecil. Saat kena rate limit,
// tunggu sebentar lalu coba lagi — rate limit pulih dalam hitungan detik.
async function callWithRateLimitRetry(call, maxAttempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error;
      if (!error?.retryable || attempt >= maxAttempts - 1) throw error;
      const waitMs = 3000 * (attempt + 1);
      console.warn(`[AI] Rate limit, retry dalam ${waitMs / 1000}s (percobaan ${attempt + 2}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

export function createGriphubClient() {
  const apiKey = String(process.env.GRIPHUB_API_KEY || '').trim();
  const configuredBaseURL = String(process.env.GRIPHUB_BASE_URL || '').trim().replace(/\/+$/, '');
  const baseURL = configuredBaseURL.replace(/\/chat\/completions$/i, '');

  const groqApiKey = String(process.env.GROQ_API_KEY || '').trim();
  const groqBaseURL = 'https://api.groq.com/openai/v1';
  const groqVisionModel = process.env.GROQ_VISION_MODEL?.trim() || 'qwen/qwen3.6-27b';
  const groqTextModel = process.env.GROQ_MODEL?.trim() || 'qwen/qwen3.6-27b';
  const griphubVisionModel = String(process.env.GRIPHUB_VISION_MODEL || '').trim() || 'gpt-5.6-luna';
  const griphubTextModel = String(process.env.GRIPHUB_MODEL || '').trim() || 'gpt-5.6-luna';

  return {
    // Prioritas utama adalah Griphub Router; Groq sebagai cadangan jika Griphub gagal.
    isConfigured: Boolean(apiKey && baseURL) || Boolean(groqApiKey),
    chat: {
      completions: {
        create: async (payload) => {
          const isVision = payload?.messages?.some(
            (m) => Array.isArray(m.content) && m.content.some((c) => c?.type === 'image_url'),
          );

          const cleanPayload = (model, keepResponseFormat) => {
            const p = { ...payload, model };
            if (!keepResponseFormat) delete p.response_format;
            return p;
          };

          // 1. PRIORITAS UTAMA: Griphub Router (Cepat, stabil, tanpa rate limit ketat)
          if (apiKey && baseURL) {
            const griphubModel = payload?.model || (isVision ? griphubVisionModel : griphubTextModel);
            try {
              const res = await callProvider(baseURL, apiKey, cleanPayload(griphubModel, true));
              if (res && typeof res === 'object') {
                res.provider_used = 'griphub';
                res.model_used = griphubModel;
              }
              return res;
            } catch (griphubError) {
              console.error('[AI] Griphub utama gagal:', griphubError?.message);

              // Jika Griphub gagal dan Groq tersedia, fallback otomatis ke Groq
              if (groqApiKey) {
                try {
                  console.warn('[AI] Mencoba fallback otomatis ke Groq...');
                  const targetGroqModel = isVision ? groqVisionModel : groqTextModel;
                  const res = await callWithRateLimitRetry(
                    () => callProvider(groqBaseURL, groqApiKey, cleanPayload(targetGroqModel, false)),
                    2,
                  );
                  if (res && typeof res === 'object') {
                    res.provider_used = 'groq';
                    res.model_used = targetGroqModel;
                  }
                  return res;
                } catch (groqError) {
                  console.error('[AI] Groq fallback juga gagal:', groqError?.message);
                  const combined = new Error(
                    `Semua layanan AI gagal. Griphub: ${griphubError?.message}. Groq: ${groqError?.message}`,
                  );
                  combined.code = 'AI_ALL_PROVIDERS_FAILED';
                  throw combined;
                }
              }
              throw griphubError;
            }
          }

          // 2. Jika Griphub belum dikonfigurasi, gunakan Groq langsung
          if (groqApiKey) {
            const targetGroqModel = isVision ? groqVisionModel : groqTextModel;
            const res = await callWithRateLimitRetry(
              () => callProvider(groqBaseURL, groqApiKey, cleanPayload(targetGroqModel, false)),
            );
            if (res && typeof res === 'object') {
              res.provider_used = 'groq';
              res.model_used = targetGroqModel;
            }
            return res;
          }

          const error = new Error('Layanan AI belum dikonfigurasi (GRIPHUB_API_KEY atau GROQ_API_KEY belum diisi).');
          error.code = 'AI_NOT_CONFIGURED';
          throw error;
        },
      },
    },
  };
}

// Parser toleran untuk respons verifikasi AI. Mengembalikan objek hasil parse atau null.
// Mencoba: (1) JSON dari content, (2) fallback: ekstrak JSON dari field reasoning_content
// (beberapa model meletakkan jawaban di sana saat content kosong).
function parseAiJsonResponse(aiResponse) {
  const content = aiResponse?.choices?.[0]?.message?.content;
  const reasoning = aiResponse?.choices?.[0]?.message?.reasoning_content;
  const finishReason = aiResponse?.choices?.[0]?.finish_reason;

  const attemptSources = [content, reasoning].filter((t) => typeof t === 'string' && t.trim());
  for (const source of attemptSources) {
    const cleaned = stripAiWrapper(source);
    if (!cleaned) continue;
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') return { parsed, finishReason };
    } catch {
      // lanjut ke sumber berikutnya
    }
  }
  return { parsed: null, finishReason };
}

export { parseGriphubResponse, stripAiWrapper, parseAiJsonResponse };

