import type { ReactNode } from 'react';
import { ReceiptText } from 'lucide-react';
import { cx, formatMoney } from './utils';

export interface OrderSummaryItem {
  id: string;
  label: string;
  detail?: ReactNode;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}

export interface OrderSummaryLine {
  id: string;
  label: string;
  amount: number;
  description?: string;
}

export interface OrderSummaryProps {
  items: readonly OrderSummaryItem[];
  lines?: readonly OrderSummaryLine[];
  title?: string;
  description?: string;
  subtotal?: number;
  total?: number;
  totalLabel?: string;
  currency?: string;
  locale?: string;
  emptyMessage?: string;
  note?: ReactNode;
  className?: string;
}

function itemAmount(item: OrderSummaryItem): number {
  if (item.amount !== undefined) return item.amount;
  return (item.unitPrice ?? 0) * (item.quantity ?? 1);
}

export function OrderSummary({
  items,
  lines = [],
  title = 'Ringkasan biaya',
  description = 'Rincian dihitung dari pilihan yang aktif.',
  subtotal,
  total,
  totalLabel = 'Total pembayaran',
  currency = 'IDR',
  locale = 'id-ID',
  emptyMessage = 'Belum ada biaya tambahan.',
  note,
  className,
}: OrderSummaryProps) {
  const resolvedSubtotal = subtotal ?? items.reduce((sum, item) => sum + itemAmount(item), 0);
  const resolvedTotal = total ?? resolvedSubtotal + lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <section aria-labelledby="order-summary-title" className={cx('overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_70px_-45px_rgba(24,24,27,0.55)] dark:border-zinc-800 dark:bg-zinc-900', className)}>
      <div className="flex items-start gap-3 border-b border-zinc-100 p-5 sm:p-6 dark:border-zinc-800">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
          <ReceiptText aria-hidden="true" className="size-5" />
        </div>
        <div>
          <h2 id="order-summary-title" className="font-bold text-zinc-950 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{description}</p> : null}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {items.length > 0 ? (
          <ul className="space-y-4" aria-label="Item biaya">
            {items.map(item => {
              const quantity = item.quantity ?? 1;
              return (
                <li key={item.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.label}</p>
                    <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {item.detail}
                      {quantity > 1 ? <span className="ml-1 tabular-nums">× {quantity}</span> : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{formatMoney(itemAmount(item), currency, locale)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:bg-zinc-950/50 dark:text-zinc-400">{emptyMessage}</p>
        )}

        <dl className="mt-6 space-y-3 border-t border-dashed border-zinc-200 pt-5 text-sm dark:border-zinc-700">
          <div className="flex items-center justify-between gap-4 text-zinc-500 dark:text-zinc-400">
            <dt>Subtotal</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(resolvedSubtotal, currency, locale)}</dd>
          </div>
          {lines.map(line => (
            <div key={line.id} className="flex items-start justify-between gap-4 text-zinc-500 dark:text-zinc-400">
              <dt>
                <span>{line.label}</span>
                {line.description ? <span className="mt-0.5 block text-[11px] text-zinc-400">{line.description}</span> : null}
              </dt>
              <dd className={cx('font-semibold tabular-nums', line.amount < 0 && 'text-emerald-600 dark:text-emerald-400')}>{formatMoney(line.amount, currency, locale)}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex items-end justify-between gap-4 rounded-2xl bg-zinc-950 p-4 text-white sm:p-5 dark:bg-white dark:text-zinc-950">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">{totalLabel}</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Sudah termasuk seluruh tambahan terpilih</p>
          </div>
          <output className="shrink-0 text-xl font-black tracking-tight tabular-nums sm:text-2xl" aria-label={`${totalLabel}: ${formatMoney(resolvedTotal, currency, locale)}`}>
            {formatMoney(resolvedTotal, currency, locale)}
          </output>
        </div>

        {note ? <div className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{note}</div> : null}
      </div>
    </section>
  );
}

export default OrderSummary;

