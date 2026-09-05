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
    const raw = {
      ...chunks.at(-1),
      choices: [{
        ...firstChoice,
        message: { ...(firstChoice.message || {}), content },
      }],
    };
    if (raw.choices?.[0]?.message?.content) {
      raw.choices[0].message.content = stripAiWrapper(raw.choices[0].message.content);
    }
    return raw;
  }

  let parsed;
  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsed = { error: responseText.slice(0, 500) };
  }
  if (parsed?.choices?.[0]?.message?.content) {
    parsed.choices[0].message.content = stripAiWrapper(parsed.choices[0].message.content);
  }
  return parsed;
}

// Model qwen di Groq kadang mengaktifkan mode "thinking" yang membungkus
// jawaban dengan tag <think>...</think>, membuat JSON tidak bisa di-parse.
// Helper ini menghapus tag tersebut + markdown fence dari respons AI.
function stripAiWrapper(text) {
  return String(text || '')
    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

async function callProvider(baseURL, apiKey, payload, timeoutMs = 30000) {
  const requestedMaxTokens = Number(payload?.max_tokens);
  const maxTokens = Number.isFinite(requestedMaxTokens)
    ? Math.min(Math.max(requestedMaxTokens, 64), 1536)
    : 200;
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
async function callWithRateLimitRetry(call, maxAttempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error;
      if (!error?.retryable || attempt >= maxAttempts - 1) throw error;
      const waitMs = 4000 * (attempt + 1);
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
  const griphubVisionModel = String(process.env.GRIPHUB_VISION_MODEL || '').trim();
  const griphubTextModel = String(process.env.GRIPHUB_MODEL || '').trim();

  return {
    // Prioritas utama adalah Groq; Griphub hanya dipakai sebagai cadangan.
    isConfigured: Boolean(groqApiKey) || Boolean(apiKey && baseURL),
    chat: {
      completions: {
        create: async (payload) => {
          const isVision = payload?.messages?.some(
            (m) => Array.isArray(m.content) && m.content.some((c) => c?.type === 'image_url'),
          );
          // Model qwen Groq TIDAK mendukung strict JSON mode (response_format json_object)
          // — Groq langsung menolak dengan "Failed to validate JSON". Kirim tanpa
          // response_format dan andalkan prompt + parsing toleran di sisi caller.
          const cleanPayload = (model, keepResponseFormat) => {
            const p = { ...payload, model };
            if (!keepResponseFormat) delete p.response_format;
            return p;
          };
          const groqPayload = cleanPayload(isVision ? groqVisionModel : groqTextModel, false);
          // Tag <think> (mode thinking qwen) ditangani oleh stripAiWrapper
          // di sisi parser — parameter reasoning tidak dipakai karena
          // API Groq menolak properti yang tidak didukung.

          if (groqApiKey) {
            try {
              return await callWithRateLimitRetry(
                () => callProvider(groqBaseURL, groqApiKey, groqPayload),
              );
            } catch (groqError) {
              console.error('[AI] Groq gagal:', groqError?.message);
              if (apiKey && baseURL) {
                try {
                  // Fallback ke Griphub WAJIB memakai model milik Griphub sendiri —
                  // jangan kirim model Groq (Griphub menolak "provider-prefixed internal-only").
                  const griphubModel = isVision
                    ? (griphubVisionModel || griphubTextModel)
                    : (griphubTextModel || griphubVisionModel);
                  if (!griphubModel) throw groqError;
                  return await callProvider(baseURL, apiKey, cleanPayload(griphubModel, true));
                } catch (griphubError) {
                  console.error('[AI] Griphub fallback juga gagal:', griphubError?.message);
                  const combined = new Error(
                    `Semua layanan AI gagal. Groq: ${groqError?.message}. Griphub: ${griphubError?.message}`,
                  );
                  combined.code = 'AI_ALL_PROVIDERS_FAILED';
                  throw combined;
                }
              }
              throw groqError;
            }
          }

          // Tidak ada Groq — pakai Griphub seperti sebelumnya (perilaku lama).
          if (!apiKey || !baseURL) {
            const error = new Error('GRIPHUB_API_KEY atau GRIPHUB_BASE_URL belum dikonfigurasi.');
            error.code = 'GRIPHUB_NOT_CONFIGURED';
            throw error;
          }
          return callProvider(baseURL, apiKey, payload);
        },
      },
    },
  };
}

export { parseGriphubResponse, stripAiWrapper };

