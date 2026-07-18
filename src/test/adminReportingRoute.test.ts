import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  buildOverviewData,
  fetchAllByRange,
  parseHistoryQuery,
  registerAdminReportingRoutes,
  witaDateKey,
} from '../routes/adminReporting';

type Row = Record<string, any>;

class MemoryQuery implements PromiseLike<any> {
  private filters: Array<(row: Row) => boolean> = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private countRequested = false;
  private head = false;
  private singleRequested = false;
  private rangeBounds: [number, number] | null = null;
  private rowLimit: number | null = null;

  constructor(private readonly sourceRows: Row[]) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    this.countRequested = options?.count === 'exact';
    this.head = options?.head === true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push(row => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push(row => values.includes(row[column]));
    return this;
  }

  ilike(column: string, pattern: string) {
    const needle = pattern.replace(/^%|%$/g, '').replace(/\\([%_\\])/g, '$1').toLowerCase();
    this.filters.push(row => String(row[column] || '').toLowerCase().includes(needle));
    return this;
  }

  or(expression: string) {
    const values = expression.split(',').map(part => part.split('.eq.')[1]);
    this.filters.push(row => values.includes(row.id) || values.includes(row.buyer_id));
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push(row => String(row[column]) >= value);
    return this;
  }

  lte(column: string, value: string) {
    this.filters.push(row => String(row[column]) <= value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  range(from: number, to: number) {
    this.rangeBounds = [from, to];
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.singleRequested = true;
    return this;
  }

  private execute() {
    let rows = this.sourceRows.filter(row => this.filters.every(filter => filter(row)));
    for (const order of [...this.orders].reverse()) {
      rows = [...rows].sort((left, right) => {
        const result = String(left[order.column] || '').localeCompare(String(right[order.column] || ''));
        return order.ascending ? result : -result;
      });
    }
    const count = rows.length;
    if (this.rangeBounds) rows = rows.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit);

    if (this.singleRequested) {
      return rows.length
        ? { data: rows[0], error: null, count: this.countRequested ? count : null }
        : { data: null, error: { code: 'PGRST116' }, count: this.countRequested ? 0 : null };
    }
    return {
      data: this.head ? null : rows,
      error: null,
      count: this.countRequested ? count : null,
    };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function createSupabaseMock(role: string, tables: Record<string, Row[]>) {
  return {
    auth: {
      getUser: async (token: string) => token === 'valid-token'
        ? { data: { user: { id: 'admin-user' } }, error: null }
        : { data: { user: null }, error: { code: 'invalid_token' } },
    },
    from: (table: string) => new MemoryQuery(
      table === 'profiles'
        ? [{ id: 'admin-user', role }]
        : (tables[table] || []),
    ),
  };
}

function createReportingApp(supabase: any) {
  const app = express();
  registerAdminReportingRoutes(app, { supabase });
  return app;
}

const historyTables = {
  transactions: [
    { id: 'paid-1', buyer_name: 'Ani', total_amount: 10_000, status: 'paid', created_at: '2026-07-18T03:00:00.000Z' },
    { id: 'success-1', buyer_name: 'Budi', total_amount: 20_000, status: 'success', created_at: '2026-07-18T02:00:00.000Z' },
    { id: 'pending-1', buyer_name: 'Citra', total_amount: 30_000, status: 'pending', created_at: '2026-07-18T01:00:00.000Z' },
    { id: 'failed-1', buyer_name: 'Dedi', total_amount: 40_000, status: 'failed', created_at: '2026-07-18T04:00:00.000Z' },
  ],
  failed_transactions: [
    { id: 'attempt-1', buyer_name: 'Eka', attempted_amount: 50_000, reason: 'Bukti tidak valid', created_at: '2026-07-18T05:00:00.000Z' },
  ],
};

describe('admin reporting route authorization and canonical status groups', () => {
  it('requires a verified bearer user and an admin profile', async () => {
    const adminApp = createReportingApp(createSupabaseMock('admin', historyTables));
    await request(adminApp).get('/api/admin/transactions/history').expect(401);

    const buyerApp = createReportingApp(createSupabaseMock('buyer', historyTables));
    await request(buyerApp)
      .get('/api/admin/transactions/history')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
  });

  it('never leaks pending or failed rows into the settled group', async () => {
    const app = createReportingApp(createSupabaseMock('superadmin', historyTables));
    const response = await request(app)
      .get('/api/admin/transactions/history?group=settled&pageSize=250')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.data.map((row: Row) => row.id)).toEqual(['paid-1', 'success-1']);
    expect(response.body.counts).toMatchObject({ settled: 2, pending: 1, failed: 2 });
    expect(response.body.pagination).toEqual({ page: 1, pageSize: 250, total: 2, totalPages: 1 });
  });

  it('combines main failures and validation attempts with deterministic pagination', async () => {
    const app = createReportingApp(createSupabaseMock('admin', historyTables));
    const response = await request(app)
      .get('/api/admin/transactions/history?group=failed&page=2&pageSize=1')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.pagination).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: 'failed-1', source: 'transaction', status: 'failed', amount: 40_000 }),
    ]);
  });
});

describe('admin reporting calculations', () => {
  it('caps public page size and interprets date-only filters as WITA calendar bounds', () => {
    expect(parseHistoryQuery({ pageSize: '999', startDate: '2026-07-18', endDate: '2026-07-18' }))
      .toMatchObject({
        pageSize: 250,
        startIso: '2026-07-17T16:00:00.000Z',
        endIso: '2026-07-18T15:59:59.999Z',
      });
  });

  it('loads more than the Supabase 1,000-row default without truncation', async () => {
    const rows = Array.from({ length: 1_201 }, (_, id) => ({ id }));
    const ranges: Array<[number, number]> = [];
    const result = await fetchAllByRange(() => ({
      range: async (from: number, to: number) => {
        ranges.push([from, to]);
        return { data: rows.slice(from, to + 1), error: null };
      },
    }), 500);

    expect(result).toHaveLength(1_201);
    expect(ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it('reconciles gross, net, fee, seller/digital/unallocated totals, and WITA chart days', () => {
    const overview = buildOverviewData({
      settledTransactions: [
        { id: 'tx-1', buyer_name: 'A', total_amount: 130, status: 'paid', created_at: '2026-07-17T16:30:00.000Z' },
        { id: 'tx-2', buyer_name: 'B', total_amount: 70, status: 'success', created_at: '2026-07-17T15:30:00.000Z' },
      ],
      settledItems: [
        { transaction_id: 'tx-1', seller_id: 'seller-1', price: 100, quantity: 1, subtotal: 90, profiles: { name: 'Penjual A' } },
        { transaction_id: 'tx-1', seller_id: null, price: 50, quantity: 1, subtotal: 45, metadata: { is_digital: true, status: 'failed' } },
      ],
      pendingTransactions: [],
      pendingCount: 2,
      failedTransactions: [{ id: 'failed', total_amount: 75 }],
      validationFailedCount: 3,
      totalSellers: 8,
      activeSellers: 7,
      pendingWithdrawals: 1,
      now: new Date('2026-07-18T04:00:00.000Z'),
    });

    expect(overview.metrics).toMatchObject({
      grossSettled: 200,
      netSettled: 135,
      recordedFee: 15,
      itemGrossSettled: 150,
      allocationDifference: 50,
      unallocatedGross: 70,
      overallocatedGross: 20,
      ledgerComplete: false,
      failedCount: 1,
      failedAmount: 75,
      validationFailedCount: 3,
      fulfillmentFailedCount: 1,
      fulfillmentFailedAmount: 50,
    });
    expect(overview.sellerBreakdown.reduce((sum, row) => sum + row.total, 0)).toBe(200);
    expect(
      overview.metrics.netSettled
        + overview.metrics.recordedFee
        + overview.metrics.unallocatedGross
        - overview.metrics.overallocatedGross,
    ).toBe(overview.metrics.grossSettled);
    expect(overview.sellerBreakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'seller-1', kind: 'seller', total: 100 }),
      expect.objectContaining({ id: 'digital', kind: 'digital', total: 50 }),
      expect.objectContaining({ id: 'unallocated', kind: 'unallocated', total: 70 }),
      expect.objectContaining({ id: 'overallocated', kind: 'unallocated', total: -20 }),
    ]));
    expect(witaDateKey('2026-07-17T16:30:00.000Z')).toBe('2026-07-18');
    expect(witaDateKey('2026-07-17T15:30:00.000Z')).toBe('2026-07-17');
    expect(overview.salesChart.at(-1)).toMatchObject({ date: '2026-07-18', sales: 130 });
  });

  it('derives recorded fee only from complete item-ledger rows', () => {
    const overview = buildOverviewData({
      settledTransactions: [
        { id: 'tx-complete', total_amount: 100_000, status: 'paid', created_at: '2026-07-18T01:00:00.000Z' },
      ],
      settledItems: [
        { transaction_id: 'tx-complete', seller_id: 'seller-1', price: 100_000, quantity: 1, subtotal: 92_000 },
      ],
      pendingTransactions: [],
      pendingCount: 0,
      failedTransactions: [],
      validationFailedCount: 0,
      totalSellers: 1,
      activeSellers: 1,
      pendingWithdrawals: 0,
    });

    expect(overview.metrics).toMatchObject({
      grossSettled: 100_000,
      itemGrossSettled: 100_000,
      netSettled: 92_000,
      recordedFee: 8_000,
      allocationDifference: 0,
      unallocatedGross: 0,
      overallocatedGross: 0,
      ledgerComplete: true,
    });
  });

  it('does not let one over-allocated order hide another order with missing items', () => {
    const overview = buildOverviewData({
      settledTransactions: [
        { id: 'tx-missing', total_amount: 100, status: 'paid', created_at: '2026-07-18T01:00:00.000Z' },
        { id: 'tx-over', total_amount: 100, status: 'paid', created_at: '2026-07-18T02:00:00.000Z' },
      ],
      settledItems: [
        { transaction_id: 'tx-over', seller_id: 'seller-1', price: 200, quantity: 1, subtotal: 184 },
      ],
      pendingTransactions: [],
      pendingCount: 0,
      failedTransactions: [],
      validationFailedCount: 0,
      totalSellers: 1,
      activeSellers: 1,
      pendingWithdrawals: 0,
    });

    expect(overview.metrics).toMatchObject({
      grossSettled: 200,
      itemGrossSettled: 200,
      recordedFee: 16,
      unallocatedGross: 100,
      overallocatedGross: 100,
      allocationDifference: 0,
      ledgerComplete: false,
    });
    expect(overview.sellerBreakdown.reduce((sum, row) => sum + row.total, 0)).toBe(200);
  });
});
