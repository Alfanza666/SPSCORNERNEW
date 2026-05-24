import { describe, it, expect } from 'vitest';
import { formatRupiah } from '../lib/utils';

describe('formatRupiah', () => {
  const NBSP = '\u00A0';

  it('formats zero', () => {
    expect(formatRupiah(0)).toBe(`Rp${NBSP}0`);
  });

  it('formats whole number', () => {
    expect(formatRupiah(15000)).toBe(`Rp${NBSP}15.000`);
  });

  it('formats large number', () => {
    expect(formatRupiah(1000000)).toBe(`Rp${NBSP}1.000.000`);
  });

  it('formats decimal', () => {
    expect(formatRupiah(15000.5)).toBe(`Rp${NBSP}15.001`);
  });

  it('handles negative', () => {
    expect(formatRupiah(-5000)).toBe(`-Rp${NBSP}5.000`);
  });
});
