import { describe, expect, it } from 'vitest';
import {
  consumeReceiptValidationIssuance,
  issueReceiptValidationAttestation,
  recordReceiptValidationIssuance,
  verifyReceiptValidationToken,
} from '../utils/receiptValidationToken';

const secret = 'test-only-receipt-validation-secret';
const imageBase64 = 'data:image/png;base64,aGVsbG8=';
const buyerId = '11111111-1111-4111-8111-111111111111';
const cart = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    seller_id: '22222222-2222-4222-8222-222222222222',
    name: 'Nasi',
    price: 20_000,
    quantity: 1,
    is_digital: false,
  },
  {
    id: 'digital-PLN20-1',
    seller_id: null,
    name: 'Token PLN',
    price: 5_000,
    quantity: 1,
    is_digital: true,
    sku: 'PLN20',
    target_number: '1234567890',
    metadata: { is_digital: true, sku: 'PLN20', target_number: '1234567890' },
  },
];

function input(overrides: Record<string, unknown> = {}) {
  return {
    amount: 25_000,
    imageBase64,
    items: cart,
    buyerId,
    ...overrides,
  };
}

describe('receipt validation token', () => {
  it('accepts the exact amount, receipt, cart, and buyer during its validity window', () => {
    const { token } = issueReceiptValidationAttestation(input(), {
      secret,
      now: 1_000,
      ttlMs: 5_000,
      jti: '00000000-0000-4000-8000-000000000001',
    });

    expect(verifyReceiptValidationToken(token, input(), { secret, now: 2_000 }).valid).toBe(true);
  });

  it('rejects changed amount, receipt, cart, buyer, signature, and expiry', () => {
    const { token } = issueReceiptValidationAttestation(input(), {
      secret,
      now: 1_000,
      ttlMs: 5_000,
      jti: '00000000-0000-4000-8000-000000000002',
    });

    expect(verifyReceiptValidationToken(token, input({ amount: 24_000 }), { secret, now: 2_000 }))
      .toEqual({ valid: false, reason: 'validation_amount_mismatch' });
    expect(verifyReceiptValidationToken(token, input({ imageBase64: 'b3RoZXI=' }), { secret, now: 2_000 }))
      .toEqual({ valid: false, reason: 'validation_image_mismatch' });
    expect(verifyReceiptValidationToken(token, input({
      items: [{ ...cart[0], quantity: 2 }, cart[1]],
    }), { secret, now: 2_000 })).toEqual({ valid: false, reason: 'validation_cart_mismatch' });
    expect(verifyReceiptValidationToken(token, input({ buyerId: 'guest' }), { secret, now: 2_000 }))
      .toEqual({ valid: false, reason: 'validation_buyer_mismatch' });
    expect(verifyReceiptValidationToken(`${token}x`, input(), { secret, now: 2_000 }).valid).toBe(false);
    expect(verifyReceiptValidationToken(token, input(), { secret, now: 7_000 }))
      .toEqual({ valid: false, reason: 'validation_token_expired' });
  });

  it('binds digital destination and physical seller into the canonical cart digest', () => {
    const { token } = issueReceiptValidationAttestation(input(), {
      secret,
      now: 1_000,
      ttlMs: 5_000,
      jti: '00000000-0000-4000-8000-000000000003',
    });
    const changedTarget = [cart[0], { ...cart[1], target_number: '9999999999' }];
    const changedSeller = [{ ...cart[0], seller_id: buyerId }, cart[1]];

    expect(verifyReceiptValidationToken(token, input({ items: changedTarget }), { secret, now: 2_000 }))
      .toEqual({ valid: false, reason: 'validation_cart_mismatch' });
    expect(verifyReceiptValidationToken(token, input({ items: changedSeller }), { secret, now: 2_000 }))
      .toEqual({ valid: false, reason: 'validation_cart_mismatch' });
  });

  it('rejects a missing token instead of trusting a browser status', () => {
    expect(verifyReceiptValidationToken(undefined, input(), { secret })).toEqual({
      valid: false,
      reason: 'validation_token_missing',
    });
  });

  it('persists an issuance and allows exactly one atomic claim under replay', async () => {
    const rows = new Map<string, any>();
    const supabase = {
      from: () => ({
        insert: async (row: any) => {
          if (rows.has(row.jti)) return { error: { code: '23505', message: 'duplicate' } };
          rows.set(row.jti, { ...row, consumed: false });
          return { error: null };
        },
      }),
      rpc: async (_name: string, args: any) => {
        const row = rows.get(args.p_jti);
        const matches = row
          && row.amount === args.p_amount
          && row.image_hash === args.p_image_hash
          && row.cart_digest === args.p_cart_digest
          && row.buyer_subject === args.p_buyer_subject
          && row.issued_at === args.p_issued_at
          && row.expires_at === args.p_expires_at;
        if (!matches || row.consumed) return { data: false, error: null };
        row.consumed = true;
        return { data: true, error: null };
      },
    };
    const attestation = issueReceiptValidationAttestation(input(), {
      secret,
      now: Date.now(),
      jti: '00000000-0000-4000-8000-000000000004',
    });
    await recordReceiptValidationIssuance(supabase, attestation.payload);

    const claims = await Promise.all([
      consumeReceiptValidationIssuance(supabase, attestation.payload),
      consumeReceiptValidationIssuance(supabase, attestation.payload),
    ]);
    expect(claims).toEqual(expect.arrayContaining([
      { consumed: true },
      { consumed: false, reason: 'validation_token_consumed_or_unknown' },
    ]));
  });
});
