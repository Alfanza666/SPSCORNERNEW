import { describe, expect, it } from 'vitest';
import { parseGriphubResponse } from '../services/griphub.js';

describe('Griphub response parser', () => {
  it('merges SSE delta chunks into an OpenAI-compatible message', () => {
    const response = parseGriphubResponse(
      [
        'data: {"choices":[{"delta":{"role":"assistant"}}]}',
        'data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}',
        'data: {"choices":[{"delta":{"content":"true}"}}]}',
        'data: [DONE]',
        '',
      ].join('\n'),
      'text/event-stream',
    );

    expect(response.choices[0].message.content).toBe('{"ok":true}');
  });
});
