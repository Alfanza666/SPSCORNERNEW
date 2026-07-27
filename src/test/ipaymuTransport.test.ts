import { describe, expect, it } from 'vitest';
import { IpaymuClient } from '../services/ipaymu/client';

describe('iPaymu runtime transport', () => {
  it('fails before sending when serverless static egress is missing', async () => {
    const client = new IpaymuClient('va', 'api-key', false, {}, null, true);

    expect(client.getTransportMode()).toBe('unavailable');
    await expect(client.createDirectPayment({
      name: 'Pelanggan',
      phone: '081200000000',
      email: 'buyer@example.com',
      amount: 10000,
      notifyUrl: 'https://example.com/callback',
      referenceId: 'tx-1',
      paymentMethod: 'qris',
      paymentChannel: 'mpm',
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'IPAYMU_STATIC_EGRESS_UNAVAILABLE',
      ambiguous: false,
    });
  });
});
