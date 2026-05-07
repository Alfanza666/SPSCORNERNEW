import { test } from 'node:test';
import assert from 'node:assert';
import { formatRupiah } from './utils.pure.ts';

test('formatRupiah utility', async (t) => {
  await t.test('should format positive numbers correctly', () => {
    assert.strictEqual(formatRupiah(1000).replace(/\u00A0/g, ' '), 'Rp 1.000');
    assert.strictEqual(formatRupiah(50000).replace(/\u00A0/g, ' '), 'Rp 50.000');
  });

  await t.test('should format large numbers correctly', () => {
    assert.strictEqual(formatRupiah(1000000).replace(/\u00A0/g, ' '), 'Rp 1.000.000');
  });

  await t.test('should format zero correctly', () => {
    assert.strictEqual(formatRupiah(0).replace(/\u00A0/g, ' '), 'Rp 0');
  });

  await t.test('should format negative numbers correctly', () => {
    assert.strictEqual(formatRupiah(-1000).replace(/\u00A0/g, ' '), '-Rp 1.000');
  });
});
