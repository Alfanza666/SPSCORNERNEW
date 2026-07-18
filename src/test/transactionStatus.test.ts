import { describe, expect, it } from 'vitest';
import {
  classifyTransactionStatus,
  getTransactionStatusPresentation,
  normalizeTransactionStatus,
  statusBelongsToGroup,
} from '../utils/transactionStatus';

describe('transaction status contract', () => {
  it('normalizes supported status values without changing their meaning', () => {
    expect(normalizeTransactionStatus(' PAID ')).toBe('paid');
    expect(normalizeTransactionStatus(null)).toBe('');
    expect(normalizeTransactionStatus(123)).toBe('');
  });

  it.each([
    ['paid', 'settled'],
    ['success', 'settled'],
    ['pending', 'pending'],
    ['failed', 'failed'],
  ] as const)('classifies %s as %s', (status, expected) => {
    expect(classifyTransactionStatus(status)).toBe(expected);
  });

  it('does not silently classify unsupported or missing statuses as failed', () => {
    expect(classifyTransactionStatus('cancelled')).toBe('unknown');
    expect(classifyTransactionStatus('processing')).toBe('unknown');
    expect(classifyTransactionStatus(undefined)).toBe('unknown');
    expect(getTransactionStatusPresentation('cancelled')).toEqual({
      normalized: 'cancelled',
      kind: 'unknown',
      label: 'Status tidak dikenal (cancelled)',
    });
  });

  it('matches rows to exactly their canonical history group', () => {
    expect(statusBelongsToGroup('paid', 'settled')).toBe(true);
    expect(statusBelongsToGroup('paid', 'failed')).toBe(false);
    expect(statusBelongsToGroup('failed', 'failed')).toBe(true);
    expect(statusBelongsToGroup('unknown-status', 'failed')).toBe(false);
  });
});
