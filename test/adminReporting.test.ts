import { describe, it, expect } from 'vitest';
// @vitest-environment node

import { buildOverviewData } from '../src/routes/adminReporting';

const NOW = new Date('2026-10-08T12:00:00.000Z'); // Kamis, 8 Okt 2026 19:00 WITA

function tx(id: string, total: number, created_at: string) {
  return {
    id,
    buyer_name: 'Pembeli',
    buyer_id: null,
    total_amount: total,
    status: 'paid',
    payment_method: 'manual_qris',
    receipt_image: null,
    created_at,
    metadata: null,
  };
}

function item(id: string, transaction_id: string, subtotal: number) {
  return {
    id,
    transaction_id,
    seller_id: 'seller-1',
    quantity: 1,
    price: subtotal,
    subtotal,
    metadata: null,
    created_at: '2026-10-01T00:00:00.000Z',
    profiles: { name: 'Seller Satu' },
    products: { seller_id: 'seller-1', profiles: { name: 'Seller Satu' } },
  };
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    settledTransactions: [
      tx('today-tx', 10_000, '2026-10-08T05:00:00.000Z'),   // 12:00 WITA → masuk "today"
      tx('yesterday-tx', 20_000, '2026-10-07T00:00:00.000Z'), // 7 Okt → kemarin, masuk "week"
      tx('month-tx', 40_000, '2026-10-01T02:00:00.000Z'),   // 1 Okt → masuk "month", bukan "week"
      tx('old-tx', 80_000, '2026-09-15T00:00:00.000Z'),     // September → hanya "all"
    ],
    settledItems: [
      item('i1', 'today-tx', 9_200),
      item('i2', 'yesterday-tx', 18_400),
      item('i3', 'month-tx', 36_800),
      item('i4', 'old-tx', 73_600),
    ],
    pendingTransactions: [],
    pendingCount: 0,
    failedTransactions: [
      tx('fail-today', 5_000, '2026-10-08T01:00:00.000Z'),
      tx('fail-old', 7_000, '2026-09-01T00:00:00.000Z'),
    ],
    validationFailedCount: 0,
    totalSellers: 1,
    activeSellers: 1,
    pendingWithdrawals: 0,
    now: NOW,
    ...overrides,
  };
}

describe('buildOverviewData — period filtering (WITA)', () => {
  it('period=all menjumlahkan semua transaksi settled (perilaku lama tidak berubah)', () => {
    const data = buildOverviewData(makeInput({ period: 'all' }));
    expect(data.metrics.grossSettled).toBe(150_000);
    expect(data.metrics.settledCount).toBe(4);
    expect(data.metrics.failedCount).toBe(2);
    expect(data.metrics.failedAmount).toBe(12_000);
    expect(data.period).toBe('all');
    expect(data.periodStart).toBeNull();
  });

  it('default period (tanpa argumen) setara all', () => {
    const data = buildOverviewData(makeInput());
    expect(data.metrics.grossSettled).toBe(150_000);
    expect(data.period).toBe('all');
  });

  it('period=today hanya menghitung transaksi hari ini (WITA)', () => {
    const data = buildOverviewData(makeInput({ period: 'today' }));
    expect(data.metrics.grossSettled).toBe(10_000);
    expect(data.metrics.settledCount).toBe(1);
    expect(data.metrics.failedCount).toBe(1);
    expect(data.metrics.failedAmount).toBe(5_000);
    expect(data.periodStart).toBe('2026-10-07T16:00:00.000Z'); // 00:00 WITA 8 Okt
  });

  it('period=week menghitung 7 hari kalender terakhir termasuk hari ini', () => {
    const data = buildOverviewData(makeInput({ period: 'week' }));
    expect(data.metrics.grossSettled).toBe(30_000);
    expect(data.metrics.settledCount).toBe(2);
  });

  it('period=month menghitung dari tanggal 1 bulan berjalan (WITA)', () => {
    const data = buildOverviewData(makeInput({ period: 'month' }));
    expect(data.metrics.grossSettled).toBe(70_000);
    expect(data.metrics.settledCount).toBe(3);
    expect(data.periodStart).toBe('2026-09-30T16:00:00.000Z'); // 00:00 WITA 1 Okt
  });

  it('fee & net dihitung dari item milik transaksi dalam periode saja', () => {
    const data = buildOverviewData(makeInput({ period: 'today' }));
    // itemGross dihitung dari quantity*price item (=9.200), net = subtotal (9.200) → fee 0.
    // Selisih gross transaksi (10.000) vs item (9.200) dilaporkan sebagai unallocated,
    // sesuai perilaku rekonsiliasi yang sudah ada — bukan disamarkan sebagai fee.
    expect(data.metrics.itemGrossSettled).toBe(9_200);
    expect(data.metrics.netSettled).toBe(9_200);
    expect(data.metrics.recordedFee).toBe(0);
    // item milik transaksi di luar periode tidak ikut
    expect(data.metrics.unallocatedGross).toBe(800);
  });

  it('salesChart selalu menampilkan 7 hari WITA terakhir meski period=today', () => {
    const data = buildOverviewData(makeInput({ period: 'today' }));
    expect(data.salesChart).toHaveLength(7);
    const total = data.salesChart.reduce((sum: number, entry: any) => sum + entry.sales, 0);
    // 8 Okt (10.000) + 5 Okt (20.000) = 30.000 dalam 7 hari terakhir
    expect(total).toBe(30_000);
  });

  it('transaksi di menit-menit awal hari WITA tidak terlewat (boundary UTC vs WITA)', () => {
    // 2026-10-07T17:00:00Z = 2026-10-08 00:00 WITA → harus masuk "today"
    const data = buildOverviewData(makeInput({
      period: 'today',
      settledTransactions: [tx('edge', 3_000, '2026-10-07T17:00:00.000Z')],
      settledItems: [item('ie', 'edge', 2_760)],
    }));
    expect(data.metrics.grossSettled).toBe(3_000);
  });

  it('previousPeriodGross menghitung periode sebelumnya dengan benar', () => {
    // NOW = Kamis 8 Okt 2026 WITA. Transaksi: today 10rb, 7 Okt (kemarin) 20rb,
    // 1 Okt (dalam minggu ini, bulan ini) 40rb, 15 Sep (bulan lalu) 80rb.
    const base = makeInput();
    const all = buildOverviewData({ ...base, period: 'all' });
    expect(all.previousPeriodGross).toBe(0); // all: tidak ada pembanding

    const today = buildOverviewData({ ...base, period: 'today' });
    expect(today.previousPeriodGross).toBe(20_000); // kemarin = 7 Okt

    const week = buildOverviewData({ ...base, period: 'week' });
    // Minggu berjalan dimulai 2 Okt (7 hari terakhir) → minggu lalu = 25 Sep–1 Okt.
    // month-tx (1 Okt, 40rb) jatuh di minggu lalu; 15 Sep tidak masuk.
    expect(week.previousPeriodGross).toBe(40_000);
  });

  it('previousPeriodGross untuk month menjumlahkan bulan kalender sebelumnya', () => {
    // Transaksi 15 Sep 2026 (80rb) = bulan lalu dari Oktober
    const month = buildOverviewData(makeInput({ period: 'month' }));
    expect(month.previousPeriodGross).toBe(80_000);
  });
});
