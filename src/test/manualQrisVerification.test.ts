import { describe, expect, it } from 'vitest';
import { isManualPaymentAdminActionable } from '../routes/transactions';

describe('manual QRIS verification routing', () => {
  it('does not send an AI rejection to admin approval', () => {
    expect(isManualPaymentAdminActionable({
      payment_method: 'manual_qris',
      status: 'pending',
      payment_details: { verification_failed: true, ai_error: false },
    })).toBe(false);
  });

  it('sends only a real AI outage to admin approval', () => {
    expect(isManualPaymentAdminActionable({
      payment_method: 'manual_qris',
      status: 'pending',
      payment_details: { ai_error: true },
    })).toBe(true);
    expect(isManualPaymentAdminActionable({
      payment_method: 'manual_qris',
      status: 'pending',
      payment_details: { processing_error: true, ai_error: false },
    })).toBe(false);
  });

  it('keeps non-manual payment approval behavior unchanged', () => {
    expect(isManualPaymentAdminActionable({ payment_method: 'qris', status: 'pending' })).toBe(true);
  });
});
