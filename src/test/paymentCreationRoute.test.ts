// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { registerPaymentRoutes } from '../routes/payments';

function registerRoutes(transaction: any, ipaymuClient: any, savedUpdates: any[]) {
  const handlers = new Map<string, Function>();
  const app = {
    get: vi.fn(),
    post: vi.fn((path: string, handler: Function) => handlers.set(path, handler)),
  };
  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'buyer-1' } }, error: null })),
    },
    from: vi.fn(() => {
      let updatePayload: any = null;
      const builder: any = {
        select: () => builder,
        update: (payload: any) => {
          updatePayload = payload;
          savedUpdates.push(payload);
          return builder;
        },
        eq: () => builder,
        single: async () => ({ data: transaction, error: null }),
        then: (resolve: Function) => resolve({ error: updatePayload ? null : undefined }),
      };
      return builder;
    }),
  };

  registerPaymentRoutes(app, {
    supabase,
    ipaymuClient,
    sendNotification: vi.fn(),
    sendSarirotiEmailInternal: vi.fn(),
    sendWANotification: vi.fn(),
    processDigitalItems: vi.fn(),
    updateSellerBalances: vi.fn(),
    updateBuyerPoints: vi.fn(),
    triggerSarirotiEmail: vi.fn(),
    checkLowStockAndNotify: vi.fn(),
    sendBuyerReceiptEmail: vi.fn(),
    getDigiflazzAxiosConfig: vi.fn(),
    crypto: {},
    restoreTransactionStock: vi.fn(),
    deductTransactionStock: vi.fn(),
    commitTransactionStock: vi.fn(),
    IPAYMU_VA: 'va',
    IPAYMU_API_KEY: 'key',
    IPAYMU_SIGNATURE_KEY: 'signature',
    IPAYMU_PRODUCTION: false,
    groq: {},
  });

  return handlers;
}

function createResponse() {
  const response: any = {
    statusCode: 200,
    payload: null,
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((payload: any) => {
      response.payload = payload;
      return response;
    }),
  };
  return response;
}

const canonicalTransaction = {
  id: 'tx-1',
  buyer_id: 'buyer-1',
  buyer_name: 'Pembeli Resmi',
  buyer_phone: '081200000000',
  total_amount: 25000,
  status: 'pending',
  payment_method: 'qris',
  payment_details: { buyer_email: 'canonical@example.com' },
  transaction_items: [
    {
      quantity: 1,
      price: 25000,
      metadata: {},
      products: { name: 'Produk Resmi' },
    },
  ],
};

describe('iPaymu payment creation route', () => {
  it('uses canonical amount and buyer data from the transaction', async () => {
    const savedUpdates: any[] = [];
    const ipaymuClient = {
      createPayment: vi.fn(async () => ({
        Data: { Url: 'https://pay.example.com', SessionId: 'session-1' },
      })),
    };
    const handlers = registerRoutes(canonicalTransaction, ipaymuClient, savedUpdates);
    const response = createResponse();

    await handlers.get('/api/payment/ipaymu/create')?.({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        transaction_id: 'tx-1',
        amount: 1,
        buyer_name: 'Data Palsu',
        buyer_email: 'fake@example.com',
        buyer_phone: '000',
        items: [{ name: 'Palsu', price: 1, quantity: 1 }],
      },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(ipaymuClient.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: '25000',
      buyerName: 'Pembeli Resmi',
      buyerEmail: 'canonical@example.com',
      buyerPhone: '081200000000',
      product: ['Produk Resmi'],
      price: ['25000'],
    }));
    expect(savedUpdates[0].payment_details).toEqual(expect.objectContaining({
      buyer_email: 'canonical@example.com',
      ipaymu_sid: 'session-1',
    }));
  });

  it('blocks a second gateway request for an existing iPaymu reference', async () => {
    const ipaymuClient = { createPayment: vi.fn() };
    const handlers = registerRoutes({
      ...canonicalTransaction,
      payment_details: {
        buyer_email: 'canonical@example.com',
        ipaymu_sid: 'existing-session',
      },
    }, ipaymuClient, []);
    const response = createResponse();

    await handlers.get('/api/payment/ipaymu/create')?.({
      headers: { authorization: 'Bearer valid-token' },
      body: { transaction_id: 'tx-1' },
    }, response);

    expect(response.statusCode).toBe(409);
    expect(response.payload.code).toBe('IPAYMU_PAYMENT_ALREADY_CREATED');
    expect(ipaymuClient.createPayment).not.toHaveBeenCalled();
  });
});
