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
// Menghapus tag <think>...</think> (termasuk tag <think> yang terpotong tanpa penutup),
// code fence ```json / ```, dan mengekstrak objek JSON jika dibungkus teks pengantar.
function stripAiWrapper(text) {
  let cleaned = String(text || '')
    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think[^>]*>[\s\S]*$/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  if (!cleaned.startsWith('{') && cleaned.includes('{')) {
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1).trim();
    }
  }

  return cleaned;
}

async function callProvider(baseURL, apiKey, payload, timeoutMs = 30000) {
  const requestedMaxTokens = Number(payload?.max_tokens);
  const maxTokens = Number.isFinite(requestedMaxTokens)
    ? Math.min(Math.max(requestedMaxTokens, 64), 2048)
    : 600;
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

export { parseGriphubResponse, stripAiWrapper };

