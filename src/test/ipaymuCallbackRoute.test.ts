import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registerPaymentRoutes } from '../routes/payments';

function createSupabase(transaction: any, updates: any[]) {
  const from = vi.fn((table: string) => {
    let updatePayload: any = null;
    const builder: any = {
      select: () => builder,
      update: (payload: any) => {
        updatePayload = payload;
        updates.push({ table, payload });
        return builder;
      },
      eq: () => builder,
      maybeSingle: async () => ({ data: transaction, error: null }),
      then: (resolve: (value: any) => any) => resolve({
        data: null,
        error: updatePayload ? null : undefined,
      }),
    };
    return builder;
  });

  return {
    from,
    auth: { getUser: vi.fn() },
  };
}

function registerCallbackRoute(transaction: any, gatewayStatus: any, updates: any[]) {
  const app = express();
  app.use(express.json());
  const supabase = createSupabase(transaction, updates);

  registerPaymentRoutes(app, {
    supabase,
    ipaymuClient: { getTransactionStatus: vi.fn(async () => gatewayStatus) },
    sendNotification: vi.fn(),
    sendSarirotiEmailInternal: vi.fn(),
    sendWANotification: vi.fn(),
    processDigitalItems: vi.fn(),
    updateSellerBalances: vi.fn(),
    updateBuyerPoints: vi.fn(),
    refundTransactionPoints: vi.fn(),
    triggerSarirotiEmail: vi.fn(),
    checkLowStockAndNotify: vi.fn(),
    sendBuyerReceiptEmail: vi.fn(),
    getDigiflazzAxiosConfig: vi.fn(),
    crypto: {},
    restoreTransactionStock: vi.fn(),
    deductTransactionStock: vi.fn(),
    commitTransactionStock: vi.fn(async () => ({ success: true })),
    IPAYMU_VA: 'va',
    IPAYMU_API_KEY: 'key',
    IPAYMU_SIGNATURE_KEY: 'signature',
    IPAYMU_PRODUCTION: false,
    griphub: {},
  });

  return app;
}

const pendingTransaction = {
  id: 'tx-1',
  buyer_id: 'buyer-1',
  buyer_name: 'Pembeli Resmi',
  total_amount: 25_000,
  status: 'pending',
  payment_details: {},
  metadata: {},
  transaction_items: [],
};

describe('iPaymu callback route', () => {
  it('settles a callback verified by gateway lookup without throwing on missing signature', async () => {
    const updates: any[] = [];
    const app = registerCallbackRoute(pendingTransaction, {
      Data: { Status: 6, StatusDesc: 'Berhasil - Unsettled', PaidStatus: 'paid' },
    }, updates);

    const response = await request(app)
      .post('/api/payment/ipaymu/callback')
      .send({ reference_id: 'tx-1' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(updates.some(({ payload }) => payload.status === 'paid')).toBe(true);
    expect(updates.at(-1).payload.payment_details).toEqual(expect.objectContaining({
      unverified_callback: true,
    }));
  });

  it('treats the literal paid callback status as paid', async () => {
    const updates: any[] = [];
    const app = registerCallbackRoute(pendingTransaction, { Data: { status: 'pending' } }, updates);

    const response = await request(app)
      .post('/api/payment/ipaymu/callback')
      .send({ reference_id: 'tx-1', status: 'paid' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(updates.some(({ payload }) => payload.status === 'paid')).toBe(true);
  });
});
