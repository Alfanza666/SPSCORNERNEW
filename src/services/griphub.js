// Server-side Griphub Router client using the OpenAI-compatible chat API.
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
          });

          const responseText = await response.text();
          let responseBody;
          try {
            responseBody = responseText ? JSON.parse(responseText) : null;
          } catch {
            responseBody = { error: responseText.slice(0, 500) };
          }

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
