import { describe, expect, it } from 'vitest';
import { classifyAuthFailure } from '../middleware/auth';

describe('auth upstream error classification', () => {
  it('keeps invalid credentials as 401', () => {
    expect(classifyAuthFailure({ status: 401, message: 'invalid JWT' })).toBe(401);
  });

  it('classifies Supabase connectivity failures as 503', () => {
    expect(classifyAuthFailure({ message: 'TypeError: fetch failed' })).toBe(503);
    expect(classifyAuthFailure({ status: 504, message: 'upstream timeout' })).toBe(503);
    expect(classifyAuthFailure({ cause: { message: 'UND_ERR_CONNECT_TIMEOUT' } })).toBe(503);
  });
});
