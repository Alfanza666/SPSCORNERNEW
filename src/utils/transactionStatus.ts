export type TransactionHistoryGroup = 'settled' | 'pending' | 'failed';
export type TransactionStatusKind = TransactionHistoryGroup | 'unknown';

export interface TransactionStatusPresentation {
  normalized: string;
  kind: TransactionStatusKind;
  label: string;
}

export function normalizeTransactionStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

export function classifyTransactionStatus(status: unknown): TransactionStatusKind {
  const normalized = normalizeTransactionStatus(status);

  if (normalized === 'paid' || normalized === 'success') return 'settled';
  if (normalized === 'pending') return 'pending';
  if (normalized === 'failed') return 'failed';
  return 'unknown';
}

export function getTransactionStatusPresentation(status: unknown): TransactionStatusPresentation {
  const normalized = normalizeTransactionStatus(status);
  const kind = classifyTransactionStatus(normalized);

  if (normalized === 'paid') return { normalized, kind, label: 'Dibayar' };
  if (normalized === 'success') return { normalized, kind, label: 'Selesai' };
  if (normalized === 'pending') return { normalized, kind, label: 'Menunggu' };
  if (normalized === 'failed') return { normalized, kind, label: 'Gagal' };

  return {
    normalized,
    kind: 'unknown',
    label: normalized ? `Status tidak dikenal (${normalized})` : 'Status tidak dikenal',
  };
}

export function statusBelongsToGroup(status: unknown, group: TransactionHistoryGroup): boolean {
  return classifyTransactionStatus(status) === group;
}
