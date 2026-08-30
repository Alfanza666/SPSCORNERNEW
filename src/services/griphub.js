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

export function createGriphubClient() {
  const apiKey = String(process.env.GRIPHUB_API_KEY || '').trim();
  const configuredBaseURL = String(process.env.GRIPHUB_BASE_URL || '').trim().replace(/\/+$/, '');
  const baseURL = configuredBaseURL.replace(/\/chat\/completions$/i, '');

  return {
    isConfigured: Boolean(apiKey && baseURL),
    chat: {
      completions: {
        create: async (payload) => {
          if (!apiKey || !baseURL) {
            const error = new Error('GRIPHUB_API_KEY atau GRIPHUB_BASE_URL belum dikonfigurasi.');
            error.code = 'GRIPHUB_NOT_CONFIGURED';
            throw error;
          }

          const requestedMaxTokens = Number(payload?.max_tokens);
          const maxTokens = Number.isFinite(requestedMaxTokens)
            ? Math.min(Math.max(requestedMaxTokens, 64), 1536)
            : 512;
          const response = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ ...payload, max_tokens: maxTokens }),
            signal: AbortSignal.timeout(30000),
          });

          const responseText = await response.text();
          const responseBody = parseGriphubResponse(
            responseText,
            response.headers.get('content-type') || '',
          );

          if (!response.ok) {
            const message = responseBody?.error?.message || responseBody?.error || `Griphub request failed: ${response.status}`;
            const error = new Error(String(message));
            error.status = response.status;
            error.code = 'GRIPHUB_UPSTREAM_ERROR';
            throw error;
          }

          return responseBody;
        },
      },
    },
  };
}

export { parseGriphubResponse };
