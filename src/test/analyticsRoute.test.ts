import { describe, expect, it } from 'vitest';
import { buildSellerAnalyticsData } from '../routes/analytics';

describe('seller analytics ledger calculation', () => {
  it('uses seller item subtotals and counts distinct settled orders', () => {
    const result = buildSellerAnalyticsData({
      monthItems: [
        {
          transaction_id: 'tx-1',
          quantity: 1,
          subtotal: 92_000,
          products: { name: 'Produk A' },
        },
        {
          transaction_id: 'tx-1',
          quantity: 2,
          subtotal: 46_000,
          products: [{ name: 'Produk B' }],
        },
        {
          transaction_id: 'tx-2',
          quantity: 1,
          subtotal: 9_200,
          products: { name: 'Produk A' },
        },
      ],
      last30DayItems: [
        {
          transaction_id: 'tx-1',
          subtotal: 92_000,
          transactions: { created_at: '2026-07-17T16:30:00.000Z' },
        },
        {
          transaction_id: 'tx-2',
          subtotal: 9_200,
          transactions: [{ created_at: '2026-07-18T04:00:00.000Z' }],
        },
      ],
      profile: { balance: '147200', total_sales: '160000' },
    });

    expect(result).toMatchObject({
      monthRevenue: 147_200,
      totalOrders: 2,
      balance: 147_200,
      totalSales: 160_000,
      weeklyBreakdown: [{ date: '2026-07-18', revenue: 101_200 }],
      productData: [
        { name: 'Produk A', quantity: 2 },
        { name: 'Produk B', quantity: 2 },
      ],
    });
  });
});
